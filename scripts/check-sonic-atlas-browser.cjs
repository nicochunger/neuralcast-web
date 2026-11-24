// Offline full-stack browser verification for Sonic Atlas & Station Vault (/explore).
// Spins up an ephemeral read-only FastAPI instance (reading real local station files with
// isolated temp dirs and dummy offline env) and a local Next.js server, verifies E2E
// interactions, persistent audio identity, i18n, mobile/desktop layout, and 503 degradation.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

function loadPlaywright() {
  const candidates = [
    process.env.ATLAS_PLAYWRIGHT_MODULE,
    process.env.EPISODE_PLAYWRIGHT_MODULE,
    "playwright",
    "/root/.npm/_npx/7d835fc058142333/node_modules/playwright",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // Try next candidate
    }
  }
  throw new Error(
    "Unable to resolve Playwright. Set ATLAS_PLAYWRIGHT_MODULE or install playwright."
  );
}

const { chromium } = loadPlaywright();

async function reservePort() {
  const srv = createServer();
  srv.listen(0, "127.0.0.1");
  await once(srv, "listening");
  const { port } = srv.address();
  await new Promise((resolve) => srv.close(resolve));
  return port;
}

async function waitForHttp(url, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status} from ${url}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timed out waiting for ${label} at ${url}: ${lastError}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit"),
    new Promise((resolve) =>
      setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
        resolve();
      }, 5000)
    ),
  ]);
}

function makeSyntheticSchedule(stationId) {
  const today = new Date().toISOString().slice(0, 10);
  const playlistName = stationId === "neuralforge" ? "Heavy Metal" : "Classic Rock";
  return {
    stationId,
    timeZone: "Europe/Zurich",
    date: today,
    segments: [
      {
        startTime: `${today}T18:00:00Z`,
        endTime: `${today}T20:00:00Z`,
        title: `${playlistName} Spotlight`,
        playlistNames: [playlistName],
      },
    ],
  };
}

async function installOfflineRoutes(page) {
  await page.route("**/api/nowplaying/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
  await page.route("**/api/host-companion/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
  await page.route("**/api/schedule/**", (route) => {
    const url = route.request().url();
    const stationId = url.includes("neuralforge") ? "neuralforge" : "neuralcast";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeSyntheticSchedule(stationId)),
    });
  });
  await page.route("**/api/time**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ timestamp: Math.floor(Date.now() / 1000) }),
    })
  );
  await page.route("**/_vercel/insights/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
  );
  await page.route("**/listen/**", (route) =>
    route.fulfill({ status: 204, body: "" })
  );
}

async function assertNoOverflow(page, label) {
  const metrics = await page.evaluate(() => {
    const hero = document.querySelector("section[aria-labelledby='atlas-page-heading']");
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      heroScrollWidth: hero ? hero.scrollWidth : 0,
      heroClientWidth: hero ? hero.clientWidth : 0,
    };
  });
  assert.ok(
    metrics.scrollWidth <= metrics.innerWidth,
    `Horizontal overflow detected (${label}): scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`
  );
  assert.ok(
    metrics.heroScrollWidth <= metrics.heroClientWidth + 1,
    `Hero internal clipping detected (${label}): hero.scrollWidth=${metrics.heroScrollWidth} > hero.clientWidth=${metrics.heroClientWidth}`
  );
}

async function assertNoMissingAtlasKeys(page, label) {
  const leaked = await page.evaluate(() => {
    const text = document.body.innerText || "";
    const matches = text.match(/\batlas\.[a-zA-Z0-9_.]+\b/g) || [];
    return [...new Set(matches)];
  });
  assert.deepEqual(
    leaked,
    [],
    `Missing i18n keys rendered (${label}): ${leaked.join(", ")}`
  );
}

(async () => {
  const backendRoot = path.resolve(
    process.env.ATLAS_BACKEND_ROOT || path.join(process.cwd(), "..", "NeuralCast")
  );
  const venvPython = path.join(backendRoot, ".venv", "bin", "python");
  const pythonBin =
    process.env.ATLAS_PYTHON_BIN ||
    (fs.existsSync(venvPython) ? venvPython : "python3");
  const screenshotDir = process.env.ATLAS_SCREENSHOT_DIR || "";
  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const apiPort = await reservePort();
  const webPort = await reservePort();
  const apiBase = `http://127.0.0.1:${apiPort}`;
  const webBase = `http://127.0.0.1:${webPort}`;

  const inlineServerPy = `
import tempfile
from pathlib import Path
import uvicorn
from neuralcast.admin_api.app import create_app
from neuralcast.admin_api.favorites import FavoriteStore
from neuralcast.admin_api.jobs import JobManager

with tempfile.TemporaryDirectory(prefix="sonic-atlas-e2e-") as td_str:
    td = Path(td_str)
    app = create_app(
        job_manager=JobManager(base_dir=td / "admin_http"),
        favorite_store=FavoriteStore(
            path=td / "favorites.json",
            lock_path=td / "favorites.lock",
        ),
    )
    uvicorn.run(app, host="127.0.0.1", port=${apiPort}, log_level="warning")
`;

  const backendEnv = {
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
    HOME: process.env.HOME || "/root",
    PYTHONPATH: path.join(backendRoot, "src"),
    NEURALCAST_ADMIN_HTTP_TOKEN: "offline-e2e-token",
    AZURACAST_BASE_URL: "http://127.0.0.1:9",
    AZURACAST_API_KEY: "offline-dummy-key",
    PYTHONUNBUFFERED: "1",
  };

  let backendStderr = "";
  const apiProc = spawn(pythonBin, ["-c", inlineServerPy], {
    cwd: backendRoot,
    env: backendEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  apiProc.stderr.on("data", (chunk) => {
    backendStderr += chunk.toString();
  });

  let webStderr = "";
  let webProc = null;
  let browser = null;

  try {
    await waitForHttp(`${apiBase}/healthz`, "FastAPI backend", 45000);

    // Quick direct contract check against live ephemeral FastAPI
    const ncRes = await fetch(`${apiBase}/public/atlas/neuralcast`);
    assert.equal(ncRes.status, 200, "FastAPI /public/atlas/neuralcast must return 200");
    const ncEtag = ncRes.headers.get("etag");
    assert.ok(ncEtag, "FastAPI atlas endpoint must emit ETag");
    const nc304 = await fetch(`${apiBase}/public/atlas/neuralcast`, {
      headers: { "If-None-Match": ncEtag },
    });
    assert.equal(nc304.status, 304, "FastAPI atlas endpoint must honor If-None-Match 304");
    const ncAtlas = await ncRes.json();
    assert.ok(ncAtlas.playlists.length > 0 && ncAtlas.bridges.length > 0);

    const nfRes = await fetch(`${apiBase}/public/atlas/neuralforge`);
    assert.equal(nfRes.status, 200, "FastAPI /public/atlas/neuralforge must return 200");
    const nfAtlas = await nfRes.json();
    assert.ok(nfAtlas.playlists.length > 0 && nfAtlas.bridges.length > 0);

    webProc = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(webPort),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_OPTIONS: "--max-old-space-size=256",
          HOST_ADMIN_BASE_URL: apiBase,
          HOST_ADMIN_TOKEN: "offline-e2e-token",
          NEXTAUTH_SECRET: "offline-e2e-nextauth-secret",
          NEXTAUTH_URL: webBase,
          ADMIN_EMAIL: "admin@example.test",
          ADMIN_PASSWORD_HASH: "offline-fixture",
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    webProc.stderr.on("data", (chunk) => {
      webStderr += chunk.toString();
    });

    await waitForHttp(`${webBase}/explore`, "Next.js server", 45000);

    browser = await chromium.launch({
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--no-first-run",
        "--js-flags=--max-old-space-size=192",
      ],
    });

    // --- 1. DESKTOP E2E & PERSISTENT AUDIO JOURNEY ---
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const pageErrors = [];
    const consoleErrors = [];
    let allowExpected503ConsoleError = false;

    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (allowExpected503ConsoleError && text.includes("503")) return;
        consoleErrors.push(text);
      }
    });

    await installOfflineRoutes(page);

    // Start at Live Radio (/) and capture persistent audio DOM node identity
    await page.goto(`${webBase}/`, { waitUntil: "domcontentloaded" });
    await page.locator("#neuralcast-persistent-audio").waitFor({ state: "attached" });
    const hasAudio = await page.evaluate(() => {
      const el = document.getElementById("neuralcast-persistent-audio");
      window.__audioEl = el;
      return Boolean(el);
    });
    assert.equal(hasAudio, true, "#neuralcast-persistent-audio must exist on /");

    // Navigate via SiteHeader Explore tab -> /explore
    const exploreLink = page.locator(".productNavigation a", { hasText: "Explore" });
    await exploreLink.click();
    await page.waitForURL((u) => u.pathname === "/explore");
    await page.getByRole("heading", { name: "Explore the musical DNA", exact: true }).waitFor();
    assert.equal(
      await exploreLink.getAttribute("aria-current"),
      "page",
      "Explore tab must carry aria-current=page on /explore"
    );
    assert.equal(
      await page.evaluate(
        () => window.__audioEl === document.getElementById("neuralcast-persistent-audio")
      ),
      true,
      "#neuralcast-persistent-audio identity must survive / -> /explore"
    );

    // Switch station to NeuralForge and verify audio identity persists
    const nfButton = page.getByRole("button", { name: /Explore NeuralForge/i });
    await nfButton.click();
    await page.waitForURL((u) => u.searchParams.get("station") === "neuralforge");
    await page.waitForFunction(
      (expected) => document.querySelectorAll("[data-playlist-slug]").length === expected,
      nfAtlas.playlists.length
    );
    assert.equal(
      await page.evaluate(
        () => window.__audioEl === document.getElementById("neuralcast-persistent-audio")
      ),
      true,
      "#neuralcast-persistent-audio identity must survive station switch"
    );

    // Navigate to Podcasts (/episodes) and back to Live Radio (/) preserving audio identity
    await page.locator(".productNavigation a", { hasText: "Podcasts" }).click();
    await page.waitForURL((u) => u.pathname === "/episodes");
    assert.equal(
      await page.evaluate(
        () => window.__audioEl === document.getElementById("neuralcast-persistent-audio")
      ),
      true,
      "#neuralcast-persistent-audio identity must survive /explore -> /episodes"
    );

    await page.locator(".productNavigation a", { hasText: "Live radio" }).click();
    await page.waitForURL((u) => u.pathname === "/");
    assert.equal(
      await page.evaluate(
        () => window.__audioEl === document.getElementById("neuralcast-persistent-audio")
      ),
      true,
      "#neuralcast-persistent-audio identity must survive /episodes -> /"
    );

    // Return to Explore -> NeuralCast for full interactive checks & desktop screenshots
    await page.locator(".productNavigation a", { hasText: "Explore" }).click();
    await page.waitForURL((u) => u.pathname === "/explore");
    const ncButton = page.getByRole("button", { name: /Explore NeuralCast/i });
    if ((await ncButton.getAttribute("aria-pressed")) !== "true") {
      await ncButton.click();
    }
    await page.waitForFunction(
      (expected) => document.querySelectorAll("[data-playlist-slug]").length === expected,
      ncAtlas.playlists.length
    );

    // Verify NeuralCast hero stats, SVG constellation nodes & bridges, decade bars, and Vault cards
    const ncNodeCount = await page.locator("[data-playlist-slug]").count();
    assert.equal(ncNodeCount, ncAtlas.playlists.length, "All NeuralCast playlists must render on map");
    const ncEdgeCount = await page.locator("svg[role='img'] path").count();
    assert.ok(ncEdgeCount >= 10, `Expected bridge paths in SVG, got ${ncEdgeCount}`);
    const ncDecadeCount = await page.locator("[data-decade]").count();
    assert.equal(ncDecadeCount, ncAtlas.decades.length, "All NeuralCast decade buckets must render");

    await assertNoOverflow(page, "NeuralCast desktop overview");
    await assertNoMissingAtlasKeys(page, "NeuralCast desktop EN");

    // Capture Desktop NeuralCast clean overview screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    if (screenshotDir) {
      await page.screenshot({
        path: path.join(screenshotDir, "sonic-atlas-neuralcast-desktop.png"),
        fullPage: true,
      });
    }

    // Hover & click a rich bridged playlist node -> Liner Notes Inspector + on-demand tracklist
    const targetNcPlaylist =
      ncAtlas.playlists.find((p) => p.slug === "classic-rock") ||
      ncAtlas.playlists.slice().sort((a, b) => b.bridge_count - a.bridge_count)[0];
    const targetNode = page.locator(`[data-playlist-slug="${targetNcPlaylist.slug}"]`);
    const targetOrb = targetNode.locator("circle").last();
    await targetOrb.scrollIntoViewIfNeeded();
    await targetOrb.hover();
    await targetOrb.click();

    const inspector = page.locator(`[data-inspector-slug="${targetNcPlaylist.slug}"]`);
    await inspector.waitFor({ state: "visible" });
    // Wait for on-demand tracklist to load from /api/atlas/neuralcast/playlist/<slug>
    const trackSearchInput = inspector.locator('input[type="search"]');
    await trackSearchInput.waitFor({ state: "visible" });
    const loadedTrackCount = await inspector.locator("ul li").count();
    assert.ok(loadedTrackCount > 0, "Inspector must load tracklist entries on demand");

    await assertNoOverflow(page, "NeuralCast desktop with inspector");

    // Capture Desktop NeuralCast with Liner Notes Inspector open
    await page.evaluate(() => window.scrollTo(0, 0));
    if (screenshotDir) {
      await page.screenshot({
        path: path.join(screenshotDir, "sonic-atlas-neuralcast-inspector-desktop.png"),
        fullPage: true,
      });
    }

    // Test tracklist filtering & sorting inside inspector
    const firstTrackTitle = await inspector.locator("ul li").last().innerText();
    assert.ok(firstTrackTitle.length > 0);
    await inspector.getByRole("button", { name: /^Year/i }).click();
    await page.keyboard.press("Escape");
    await inspector.waitFor({ state: "hidden" });

    // Test Decade Timeline multi-select filtering
    const targetDecade =
      ncAtlas.decades.find((d) => d.decade === 1990) || ncAtlas.decades[0];
    const decadeBtn = page.locator(`[data-decade="${targetDecade.decade}"]`);
    await decadeBtn.click();
    assert.equal(await decadeBtn.getAttribute("aria-pressed"), "true");
    // Verify clear era filter pill appears and resets filter
    const clearDecadesBtn = page.getByRole("button", { name: /Clear era filter/i });
    await clearDecadesBtn.waitFor({ state: "visible" });
    await clearDecadesBtn.click();
    assert.equal(await decadeBtn.getAttribute("aria-pressed"), "false");

    // Test Vault instant search + tabs + Artist Dossier
    const featuredArtist =
      ncAtlas.artists.find((a) => a.playlists.length >= 2 && a.track_count >= 3) ||
      ncAtlas.artists[0];
    const vaultSearch = page.getByRole("searchbox", {
      name: /Search artists, tracks, albums, or playlists/i,
    });
    await vaultSearch.fill(featuredArtist.name);
    const artistCard = page.getByRole("button", { name: new RegExp(featuredArtist.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first();
    await artistCard.waitFor({ state: "visible" });

    // Switch Vault tabs (Tracks & Playlists) then back to Artists
    await page.getByRole("tab", { name: /Tracks/i }).click();
    await page.getByRole("tab", { name: /Playlists/i }).click();
    await page.getByRole("tab", { name: /Artists/i }).click();

    // Open Artist Dossier
    await artistCard.click();
    const dossier = page.locator(`[data-artist-dossier="${featuredArtist.slug}"]`);
    await dossier.waitFor({ state: "visible" });
    await dossier.getByRole("heading", { name: featuredArtist.name, exact: true }).waitFor();
    assert.ok(
      (await dossier.locator("tbody tr").count()) >= 1,
      "Artist dossier must list station tracks"
    );
    await dossier.getByRole("button", { name: /Back to vault/i }).click();
    await dossier.waitFor({ state: "hidden" });
    await vaultSearch.fill("");

    // Test Locale switching: EN -> ES -> FR -> EN with zero missing keys
    const langTrigger = page.locator(".languageMenuTrigger");
    await langTrigger.scrollIntoViewIfNeeded();
    await langTrigger.click();
    await page.getByRole("menuitemradio", { name: "Español" }).click();
    await page.getByRole("heading", { name: "Explorá el ADN musical", exact: true }).waitFor();
    await assertNoMissingAtlasKeys(page, "NeuralCast desktop ES");

    await langTrigger.click();
    await page.getByRole("menuitemradio", { name: "Français" }).click();
    await page.getByRole("heading", { name: "Explorer l’ADN musical", exact: true }).waitFor();
    await assertNoMissingAtlasKeys(page, "NeuralCast desktop FR");

    await langTrigger.click();
    const enOption = page.getByRole("menuitemradio", { name: "English" });
    await enOption.waitFor({ state: "visible" });
    await enOption.click();
    await page.getByRole("heading", { name: "Explore the musical DNA", exact: true }).waitFor();

    // Switch to NeuralForge on Desktop & capture screenshot
    await page.getByRole("button", { name: /Explore NeuralForge/i }).click();
    await page.waitForURL((u) => u.searchParams.get("station") === "neuralforge");
    await page.waitForFunction(
      (expected) => document.querySelectorAll("[data-playlist-slug]").length === expected,
      nfAtlas.playlists.length
    );
    await assertNoOverflow(page, "NeuralForge desktop overview");
    await assertNoMissingAtlasKeys(page, "NeuralForge desktop EN");

    await page.evaluate(() => window.scrollTo(0, 0));
    if (screenshotDir) {
      await page.screenshot({
        path: path.join(screenshotDir, "sonic-atlas-neuralforge-desktop.png"),
        fullPage: true,
      });
    }
    await page.close();

    // --- 2. MOBILE (390x844) NEURALCAST & NEURALFORGE + SCREENSHOTS ---
    const mPage = await context.newPage();
    mPage.setDefaultTimeout(60000);
    await mPage.setViewportSize({ width: 390, height: 844 });
    mPage.on("pageerror", (err) => pageErrors.push(`mobile: ${err}`));
    mPage.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`mobile: ${msg.text()}`);
    });
    await installOfflineRoutes(mPage);
    await mPage.goto(`${webBase}/explore?station=neuralcast`, { waitUntil: "domcontentloaded" });
    await mPage.getByRole("heading", { name: "Explore the musical DNA", exact: true }).waitFor();
    // On < 640px, list view becomes active after hydration matchMedia effect
    await mPage.locator('button[aria-pressed="true"]', { hasText: "List view" }).waitFor({
      state: "visible",
    });
    await assertNoOverflow(mPage, "NeuralCast mobile list view");
    await assertNoMissingAtlasKeys(mPage, "NeuralCast mobile EN");

    if (screenshotDir) {
      await mPage.screenshot({
        path: path.join(screenshotDir, "sonic-atlas-neuralcast-mobile.png"),
        fullPage: true,
      });
    }

    // Verify toggling to Map view on mobile also stays overflow-free
    await mPage.getByRole("button", { name: "Map view", exact: true }).click();
    await mPage.locator("svg[role='img']").waitFor({ state: "visible" });
    await assertNoOverflow(mPage, "NeuralCast mobile map view");
    await mPage.getByRole("button", { name: "List view", exact: true }).click();

    // Switch to NeuralForge on mobile & capture screenshot
    await mPage.getByRole("button", { name: /Explore NeuralForge/i }).click();
    await mPage.waitForURL((u) => u.searchParams.get("station") === "neuralforge");
    await mPage.waitForTimeout(300);
    await assertNoOverflow(mPage, "NeuralForge mobile view");
    await assertNoMissingAtlasKeys(mPage, "NeuralForge mobile EN");

    await mPage.evaluate(() => window.scrollTo(0, 0));
    if (screenshotDir) {
      await mPage.screenshot({
        path: path.join(screenshotDir, "sonic-atlas-neuralforge-mobile.png"),
        fullPage: true,
      });
    }
    await mPage.close();

    // --- 3. GRACEFUL DEGRADATION WHEN BACKEND /api/atlas/* RETURNS 503 ---
    await stopChild(apiProc);
    const dPage = await context.newPage();
    dPage.setDefaultTimeout(60000);
    await dPage.setViewportSize({ width: 1440, height: 900 });
    dPage.on("pageerror", (err) => pageErrors.push(`degraded: ${err}`));
    await installOfflineRoutes(dPage);
    allowExpected503ConsoleError = true;

    // Verify /api/atlas/neuralcast proxy itself returns HTTP 503 with Cache-Control: no-store
    const degradedApiRes = await fetch(`${webBase}/api/atlas/neuralcast`);
    assert.equal(degradedApiRes.status, 503, "/api/atlas/neuralcast must return 503 when upstream is down");
    const degradedBody = await degradedApiRes.json();
    assert.equal(degradedBody.code, "unavailable");

    await dPage.goto(`${webBase}/explore?station=neuralcast`, { waitUntil: "domcontentloaded" });
    const alertBanner = dPage.locator('section[role="alert"]');
    await alertBanner.waitFor({ state: "visible" });
    const retryBtn = alertBanner.getByRole("button", { name: /Try again/i });
    await retryBtn.waitFor({ state: "visible" });
    await alertBanner.getByRole("link", { name: /Listen live/i }).waitFor({ state: "visible" });
    await retryBtn.click();
    await alertBanner.waitFor({ state: "visible" });
    await assertNoOverflow(dPage, "Degraded 503 state");
    await dPage.close();
    await context.close();

    assert.deepEqual(pageErrors, [], `Uncaught page errors: ${pageErrors.join("\n")}`);
    assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join("\n")}`);

    console.log(
      `Sonic Atlas browser verification passed: persistent audio across / -> /explore -> station switch -> /episodes -> /, ` +
        `NeuralCast (${ncAtlas.playlists.length} playlists, ${ncAtlas.bridges.length} bridges) & ` +
        `NeuralForge (${nfAtlas.playlists.length} playlists, ${nfAtlas.bridges.length} bridges), ` +
        `constellation hover/select + Liner Notes on-demand tracklist, decade filtering, Vault search + Artist Dossier, ` +
        `en/es/fr locales, zero overflow on desktop (1440x900) & mobile (390x844), and 503 graceful degradation.`
    );
  } catch (err) {
    if (backendStderr) console.error("[backend stderr]\n" + backendStderr.slice(-2000));
    if (webStderr) console.error("[next stderr]\n" + webStderr.slice(-2000));
    throw err;
  } finally {
    if (browser) await browser.close();
    await stopChild(webProc);
    await stopChild(apiProc);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
