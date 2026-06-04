# NeuralCast Performance Optimization Prompt

You are working in the NeuralCast web PWA repo.

## Goal

Improve perceived load speed without changing product behavior, visual design, API contracts, auth behavior, or playback functionality. Keep the current Next.js stack unless an optimization clearly requires otherwise. Do not migrate frameworks.

## Current Context

- Framework: Next.js App Router + React.
- Public home route currently builds as dynamic SSR.
- Build output showed `/` around 123 kB first-load JS, `/about` around 117 kB, `/admin` around 129 kB, `/login` around 126 kB.
- Root layout reads `cookies()` and `headers()` for locale detection, making routes dynamic.
- Home route calls `getAuthSession()` to decide whether to show admin skip controls.
- Main public player is client-heavy and fetches now-playing/schedule data after hydration.
- Admin/login can remain dynamic and protected.
- Public radio experience should be fast: first render should show useful UI quickly, then progressively fill now-playing/schedules.

## General Constraints

- Preserve existing UI appearance unless a tiny change is necessary for performance.
- Preserve Spanish/English locale behavior.
- Preserve PWA behavior, media session behavior, playback behavior, request-song flow, admin skip controls, admin console, and auth.
- Do not remove functionality.
- Run `npm run typecheck`.
- Run `npm run build` and compare route rendering modes and first-load JS before/after.
- Keep changes focused and explain tradeoffs.

## Optimization 1: Stop Making The Whole App Dynamic Just For Locale

### Goal

- Make public pages eligible for static rendering by removing `cookies()` and `headers()` from the root layout if feasible.
- Keep locale selection working on the client via localStorage/cookie after hydration.
- Avoid hydration mismatch and avoid visible language flicker as much as practical.

### Completeness Conditions

- `src/app/layout.tsx` no longer calls dynamic request APIs unless absolutely necessary.
- `/` and `/about` are no longer forced dynamic by locale detection alone.
- Language switcher still persists language choice.
- Initial HTML has a reasonable default language.
- `npm run build` shows public routes improved where possible.

## Optimization 2: Remove Auth Session Dependency From Public Home Render

### Goal

- Avoid making `/` dynamic just to know whether admin skip controls should show.
- Public listeners should not pay auth/session cost on initial render.
- Admin skip controls should still appear for authenticated admins, either after a lightweight client-side check or through a separate dynamic endpoint.

### Completeness Conditions

- `src/app/page.tsx` no longer calls `getAuthSession()` directly if feasible.
- Public `/` can statically render or at least no longer depends on auth for first paint.
- Admin users still eventually see skip controls.
- Non-admin users never get working skip access.
- Server-side skip API remains protected.
- No auth regression on `/admin` or `/login`.

## Optimization 3: Split Admin/Login Code Away From Public Player Bundle

### Goal

- Ensure admin console, login form, auth-only code, and heavy admin UI do not inflate the public home bundle.
- Public route should not import admin components unless necessary.

### Completeness Conditions

- Public player route imports only public-player components.
- Admin components stay under `/admin` and are not pulled into `/`.
- `next build` first-load JS for `/` does not include avoidable admin/login weight.
- Admin page still works.

## Optimization 4: Defer Schedule Loading

### Goal

- Improve first paint by not blocking perceived readiness on full schedule data for both stations.
- Load now-playing first; schedule can load after initial render, idle time, or when the user opens the schedule modal.
- Keep "Active playlists" behavior acceptable: if schedule is not ready, show existing loading/waiting copy.

### Completeness Conditions

- Initial visible station cards render quickly with now-playing state.
- Schedules still load automatically soon after initial render or on demand when needed.
- Opening schedule modal reliably fetches/uses schedule data.
- Existing open-rotation logic still works.
- No unhandled loading/error states.

## Optimization 5: Audit Now-Playing And Schedule API Timing

### Goal

- Identify whether perceived slowness is from JS/hydration or from API latency.
- Add lightweight timing instrumentation in development only, or document measured timings from local/prod endpoints.
- Avoid noisy production logs unless there is already an established logging pattern.

### Completeness Conditions

- There is a clear answer for which calls are slow: initial document, JS hydration, `/api/nowplaying`, `/api/schedule`, image loading, or auth/session.
- Any temporary debug code is removed before final commit unless intentionally gated to development.
- Findings are summarized.

## Optimization 6: Reduce Avoidable Client-Side JavaScript

### Goal

- Review `"use client"` boundaries and move static/noninteractive pieces out of client components where practical.
- Do not over-refactor; target high-impact boundaries only.
- Keep player, language/theme controls, modals, and playback controls interactive.

### Completeness Conditions

- Static parts of the shell/header/about page are server-rendered where practical.
- Client components remain only where state/effects/browser APIs are needed.
- No broken language/theme behavior.
- Build output shows equal or reduced JS for public routes.

## Optimization 7: Image And Asset Loading

### Goal

- Ensure background/artwork assets are not slowing initial rendering unnecessarily.
- Consider preloading only critical visible images, lazy-loading noncritical art, and confirming image formats/sizes are appropriate.
- Do not degrade visual quality noticeably.

### Completeness Conditions

- Public images are reasonably sized for their usage.
- Critical first-viewport images are prioritized appropriately.
- Noncritical images are lazy or deferred where feasible.
- No broken PWA icons/manifest behavior.

## Optimization 8: Verify Production Behavior

### Goal

- Validate performance changes in production build, not only dev mode.
- Next dev mode can feel slower and is not representative.

### Completeness Conditions

- `npm run typecheck` passes.
- `npm run build` passes.
- Build output is included in the final summary, especially route static/dynamic status and first-load JS.
- If possible, run `npm start` after build and manually smoke-test:
  - Home loads
  - Play/stop works
  - Theme switch works
  - Language switch works
  - Schedule modal works
  - Request modal opens
  - Admin/login routes still render
- Do not leave long-running server sessions active unless explicitly needed.

## Preferred Implementation Order

1. Run baseline `npm run build` and record route modes/first-load JS.
2. Fix root layout locale dynamism.
3. Remove public home auth dependency or defer admin detection.
4. Split/defer admin and schedule code where practical.
5. Run build again and compare.
6. Make smaller follow-up optimizations only if they clearly improve the numbers or perceived load.

## Final Response Requirements

- Summarize what changed.
- Include before/after build output for relevant public routes.
- State whether `/` and `/about` are static or dynamic after changes.
- State any tradeoffs, especially locale initial render or admin skip control timing.
- State tests/checks run.
