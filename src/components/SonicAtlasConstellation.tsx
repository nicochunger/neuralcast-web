"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useI18n } from "@/lib/i18n";
import type { AtlasBridge, AtlasPlaylistNode, RotationRole } from "@/types/atlas";
import styles from "./SonicAtlas.module.css";

interface SonicAtlasConstellationProps {
  stationId: "neuralcast" | "neuralforge";
  stationName: string;
  playlists: AtlasPlaylistNode[];
  bridges: AtlasBridge[];
  selectedSlug: string | null;
  selectedDecades: number[];
  onSelectPlaylist: (slug: string | null) => void;
}

interface PositionedNode {
  playlist: AtlasPlaylistNode;
  cx: number;
  cy: number;
  r: number;
  lx: number;
  ly: number;
  lines: string[];
  anchor: "start" | "middle" | "end";
  matchesDecade: boolean;
}

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 620;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 0.25;
const LABEL_LINE_HEIGHT = 12.2;

type ListSortKey = "tracks" | "name" | "bridges";

function roleBadgeClass(role: RotationRole): string {
  if (role === "open_only") return styles.roleOpen;
  if (role === "reserved_window") return styles.roleReserved;
  return styles.roleThemed;
}

function playlistMatchesDecades(playlist: AtlasPlaylistNode, selectedDecades: number[]): boolean {
  if (selectedDecades.length === 0) return true;
  return selectedDecades.some((decade) => (playlist.decades[String(decade)] ?? 0) > 0);
}

function formatYearSpan(minYear: number | null, maxYear: number | null): string {
  if (minYear && maxYear) {
    return minYear === maxYear ? String(minYear) : `${minYear}–${maxYear}`;
  }
  if (minYear) return `${minYear}–`;
  if (maxYear) return `–${maxYear}`;
  return "—";
}

function wrapPlaylistLabel(name: string): string[] {
  const trimmed = name.trim();
  if (trimmed.length <= 16) return [trimmed];

  // Split cleanly at the space closest to the visual midpoint
  const mid = trimmed.length / 2;
  let bestIdx = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 3; i < trimmed.length - 3; i += 1) {
    if (trimmed[i] === " ") {
      const dist = Math.abs(i - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
  }

  if (bestIdx === -1) return [trimmed];
  return [trimmed.slice(0, bestIdx).trim(), trimmed.slice(bestIdx + 1).trim()];
}

function computeQuadraticEdgePath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const curve = Math.min(34, dist * 0.11);
  const nx = -dy / dist;
  const ny = dx / dist;
  const cx = mx + nx * curve;
  const cy = my + ny * curve;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function computeInsetHitPath(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): string | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const pad1 = r1 + 9;
  const pad2 = r2 + 9;
  if (dist <= pad1 + pad2 + 12) {
    return null;
  }

  const ux = dx / dist;
  const uy = dy / dist;
  const sx = x1 + ux * pad1;
  const sy = y1 + uy * pad1;
  const ex = x2 - ux * pad2;
  const ey = y2 - uy * pad2;

  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const curve = Math.min(34, dist * 0.11);
  const nx = -uy;
  const ny = ux;
  const cx = mx + nx * curve;
  const cy = my + ny * curve;
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

function rectOverlapArea(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: { x1: number; y1: number; x2: number; y2: number }
): number {
  const ox = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const oy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  return ox * oy;
}

export function SonicAtlasConstellation({
  stationId,
  stationName,
  playlists,
  bridges,
  selectedSlug,
  selectedDecades,
  onSelectPlaylist,
}: SonicAtlasConstellationProps) {
  const { t } = useI18n();
  const accentHex = stationId === "neuralforge" ? "#b55748" : "#1f8a78";
  const accentBrightHex = stationId === "neuralforge" ? "#df7b6a" : "#39bfa8";
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [userChoseView, setUserChoseView] = useState(false);
  const [bridgeMode, setBridgeMode] = useState<"strongest" | "all">("strongest");
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [listSort, setListSort] = useState<ListSortKey>("tracks");

  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
    pointerId: number | null;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originPanX: 0,
    originPanY: 0,
    pointerId: null,
  });

  useEffect(() => {
    if (userChoseView) return;
    if (typeof window === "undefined") return;
    const narrow = window.matchMedia("(max-width: 639px)").matches;
    if (narrow) {
      setViewMode("list");
    }
  }, [userChoseView]);

  // Reset camera & hover when station playlist set changes
  const stationSignature = useMemo(
    () => `${stationName}:${playlists.length}`,
    [stationName, playlists.length]
  );

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHoveredSlug(null);
    setHoveredEdgeKey(null);
  }, [stationSignature]);

  // Build positioned nodes with deterministic 8-direction + radial anti-overlap label placement
  const positionedNodes = useMemo<PositionedNode[]>(() => {
    const raw = playlists.map((playlist) => {
      const cx = 54 + playlist.x * (VIEW_WIDTH - 108);
      const cy = 42 + playlist.y * (VIEW_HEIGHT - 84);
      const r = Math.max(8.5, Math.min(22, 6.5 + Math.sqrt(Math.max(1, playlist.track_count)) * 1.12));
      const lines = wrapPlaylistLabel(playlist.name);
      return {
        playlist,
        cx,
        cy,
        r,
        lines,
        matchesDecade: playlistMatchesDecades(playlist, selectedDecades),
      };
    });

    // Place labels for largest / most connected playlists first
    const order = [...raw.keys()].sort(
      (a, b) =>
        raw[b].playlist.track_count - raw[a].playlist.track_count ||
        raw[b].playlist.bridge_count - raw[a].playlist.bridge_count
    );

    const placedBoxes: Array<{ x1: number; y1: number; x2: number; y2: number }> = raw.map(
      (item) => ({
        x1: item.cx - item.r - 4,
        y1: item.cy - item.r - 4,
        x2: item.cx + item.r + 4,
        y2: item.cy + item.r + 4,
      })
    );

    const labelPositions = new Map<
      number,
      { lx: number; ly: number; anchor: "start" | "middle" | "end" }
    >();

    for (const idx of order) {
      const item = raw[idx];
      const maxChars = Math.max(...item.lines.map((line) => line.length));
      const estWidth = Math.min(168, Math.max(46, maxChars * 6.9 + 6));
      const estHeight = item.lines.length * LABEL_LINE_HEIGHT + 3;
      const diag = (item.r + 6) * 0.78;

      const buildCandidate = (
        lx: number,
        ly: number,
        anchor: "start" | "middle" | "end",
        bias: number
      ) => {
        const x1 =
          anchor === "middle"
            ? lx - estWidth / 2
            : anchor === "start"
              ? lx
              : lx - estWidth;
        const x2 = x1 + estWidth;
        const y1 = ly - 10;
        const y2 = y1 + estHeight;
        return { lx, ly, anchor, box: { x1, y1, x2, y2 }, bias };
      };

      const topBaseline = item.cy - item.r - 7 - (item.lines.length - 1) * LABEL_LINE_HEIGHT;
      const midBaseline = item.cy + 4 - ((item.lines.length - 1) * LABEL_LINE_HEIGHT) / 2;
      const bottomBaseline = item.cy + item.r + 13;

      const candidates = [
        // 8 primary directions close to orb
        buildCandidate(item.cx, bottomBaseline, "middle", 0),
        buildCandidate(item.cx, topBaseline, "middle", 5),
        buildCandidate(item.cx + item.r + 8, midBaseline, "start", 9),
        buildCandidate(item.cx - item.r - 8, midBaseline, "end", 10),
        buildCandidate(item.cx + diag + 4, item.cy + diag + 10, "start", 14),
        buildCandidate(item.cx - diag - 4, item.cy + diag + 10, "end", 15),
        buildCandidate(
          item.cx + diag + 4,
          item.cy - diag - 4 - (item.lines.length - 1) * LABEL_LINE_HEIGHT,
          "start",
          16
        ),
        buildCandidate(
          item.cx - diag - 4,
          item.cy - diag - 4 - (item.lines.length - 1) * LABEL_LINE_HEIGHT,
          "end",
          17
        ),
        // 4 wider fallback offsets for dense center clusters
        buildCandidate(item.cx, bottomBaseline + 10, "middle", 28),
        buildCandidate(item.cx, topBaseline - 10, "middle", 30),
        buildCandidate(item.cx + item.r + 16, midBaseline, "start", 32),
        buildCandidate(item.cx - item.r - 16, midBaseline, "end", 34),
      ];

      let best = candidates[0];
      let bestCost = Number.POSITIVE_INFINITY;

      for (const candidate of candidates) {
        let cost = candidate.bias;
        if (candidate.box.x1 < 12) cost += (12 - candidate.box.x1) * 50;
        if (candidate.box.x2 > VIEW_WIDTH - 12) cost += (candidate.box.x2 - (VIEW_WIDTH - 12)) * 50;
        if (candidate.box.y1 < 14) cost += (14 - candidate.box.y1) * 50;
        if (candidate.box.y2 > VIEW_HEIGHT - 12) cost += (candidate.box.y2 - (VIEW_HEIGHT - 12)) * 50;

        for (let bIdx = 0; bIdx < placedBoxes.length; bIdx += 1) {
          if (bIdx === idx) continue;
          const overlap = rectOverlapArea(candidate.box, placedBoxes[bIdx]);
          if (overlap > 0) {
            cost += overlap * (bIdx < raw.length ? 8.5 : 10.5);
          }
        }

        if (cost < bestCost) {
          bestCost = cost;
          best = candidate;
        }
      }

      const clampedX =
        best.anchor === "middle"
          ? Math.max(estWidth / 2 + 10, Math.min(VIEW_WIDTH - estWidth / 2 - 10, best.lx))
          : best.anchor === "start"
            ? Math.min(VIEW_WIDTH - estWidth - 10, best.lx)
            : Math.max(estWidth + 10, best.lx);

      const finalBox = {
        x1:
          best.anchor === "middle"
            ? clampedX - estWidth / 2
            : best.anchor === "start"
              ? clampedX
              : clampedX - estWidth,
        y1: best.box.y1,
        x2:
          best.anchor === "middle"
            ? clampedX + estWidth / 2
            : best.anchor === "start"
              ? clampedX + estWidth
              : clampedX,
        y2: best.box.y2,
      };

      labelPositions.set(idx, { lx: clampedX, ly: best.ly, anchor: best.anchor });
      placedBoxes.push(finalBox);
    }

    return raw.map((item, idx) => {
      const pos = labelPositions.get(idx) ?? {
        lx: item.cx,
        ly: item.cy + item.r + 13,
        anchor: "middle" as const,
      };
      return { ...item, ...pos };
    });
  }, [playlists, selectedDecades]);

  const nodeBySlug = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    for (const node of positionedNodes) {
      map.set(node.playlist.slug, node);
    }
    return map;
  }, [positionedNodes]);

  const activeFocusSlug = hoveredSlug ?? selectedSlug;

  // Determine strongest bridges threshold cleanly
  const strongestBridgeKeys = useMemo(() => {
    const limit = Math.max(18, Math.min(40, Math.ceil(playlists.length * 1.15)));
    const keys = new Set<string>();
    for (let i = 0; i < Math.min(limit, bridges.length); i += 1) {
      const b = bridges[i];
      keys.add(`${b.source}::${b.target}`);
    }
    return keys;
  }, [bridges, playlists.length]);

  const visibleBridges = useMemo(() => {
    const maxShared = Math.max(1, ...bridges.map((b) => b.shared_count));
    return bridges
      .filter((bridge) => {
        if (!nodeBySlug.has(bridge.source) || !nodeBySlug.has(bridge.target)) return false;
        if (bridgeMode === "all") return true;
        const key = `${bridge.source}::${bridge.target}`;
        if (strongestBridgeKeys.has(key)) return true;
        if (
          activeFocusSlug &&
          (bridge.source === activeFocusSlug || bridge.target === activeFocusSlug)
        ) {
          return true;
        }
        return false;
      })
      .map((bridge) => {
        const src = nodeBySlug.get(bridge.source)!;
        const dst = nodeBySlug.get(bridge.target)!;
        const key = `${bridge.source}::${bridge.target}`;
        const strength = bridge.shared_count / maxShared;
        return {
          bridge,
          key,
          src,
          dst,
          path: computeQuadraticEdgePath(src.cx, src.cy, dst.cx, dst.cy),
          hitPath: computeInsetHitPath(src.cx, src.cy, src.r, dst.cx, dst.cy, dst.r),
          strokeWidth: 1.1 + strength * 3.2 + bridge.jaccard * 2.2,
          baseOpacity: Math.min(0.62, 0.16 + strength * 0.34 + bridge.jaccard * 0.25),
        };
      });
  }, [activeFocusSlug, bridgeMode, bridges, nodeBySlug, strongestBridgeKeys]);

  const connectedToFocus = useMemo(() => {
    if (!activeFocusSlug) return null;
    const neighbors = new Set<string>([activeFocusSlug]);
    for (const bridge of bridges) {
      if (bridge.source === activeFocusSlug) neighbors.add(bridge.target);
      if (bridge.target === activeFocusSlug) neighbors.add(bridge.source);
    }
    return neighbors;
  }, [activeFocusSlug, bridges]);

  const hoveredEdgeData = useMemo(() => {
    if (!hoveredEdgeKey) return null;
    return visibleBridges.find((item) => item.key === hoveredEdgeKey) ?? null;
  }, [hoveredEdgeKey, visibleBridges]);

  const matchingCount = useMemo(
    () => positionedNodes.filter((n) => n.matchesDecade).length,
    [positionedNodes]
  );

  // Ordered nodes for SVG z-layering: dimmed first, normal middle, focus/selected on top
  const layeredNodes = useMemo(() => {
    return [...positionedNodes].sort((a, b) => {
      const rank = (node: PositionedNode): number => {
        if (node.playlist.slug === selectedSlug) return 4;
        if (node.playlist.slug === hoveredSlug) return 3;
        if (connectedToFocus?.has(node.playlist.slug)) return 2;
        if (node.matchesDecade) return 1;
        return 0;
      };
      return rank(a) - rank(b);
    });
  }, [connectedToFocus, hoveredSlug, positionedNodes, selectedSlug]);

  // Sorted list view playlists
  const sortedListPlaylists = useMemo(() => {
    return [...positionedNodes].sort((a, b) => {
      if (selectedDecades.length > 0 && a.matchesDecade !== b.matchesDecade) {
        return a.matchesDecade ? -1 : 1;
      }
      if (listSort === "name") {
        return a.playlist.name.localeCompare(b.playlist.name);
      }
      if (listSort === "bridges") {
        return (
          b.playlist.bridge_count - a.playlist.bridge_count ||
          b.playlist.track_count - a.playlist.track_count
        );
      }
      return b.playlist.track_count - a.playlist.track_count;
    });
  }, [listSort, positionedNodes, selectedDecades.length]);

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    // Allow clicking directly on node groups without immediately dragging
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      originPanX: pan.x,
      originPanY: pan.y,
      pointerId: event.pointerId,
    };
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    if (!dragRef.current.moved && Math.hypot(dx, dy) > 5) {
      dragRef.current.moved = true;
      setIsDragging(true);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture failure on synthetic pointers
      }
    }
    if (dragRef.current.moved) {
      const svgRect = event.currentTarget.getBoundingClientRect();
      const scaleX = svgRect.width > 0 ? VIEW_WIDTH / svgRect.width : 1;
      const scaleY = svgRect.height > 0 ? VIEW_HEIGHT / svgRect.height : 1;
      setPan({
        x: Math.max(-420, Math.min(420, dragRef.current.originPanX + (dx * scaleX) / zoom)),
        y: Math.max(-280, Math.min(280, dragRef.current.originPanY + (dy * scaleY) / zoom)),
      });
    }
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current.active) return;
    if (dragRef.current.moved) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore
      }
    }
    dragRef.current.active = false;
    setIsDragging(false);
  };

  const handleNodeSelect = (slug: string) => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    onSelectPlaylist(selectedSlug === slug ? null : slug);
  };

  const handleNodeKeyDown = (event: KeyboardEvent<SVGGElement>, slug: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectPlaylist(selectedSlug === slug ? null : slug);
    }
  };

  const cameraTransform = `translate(${VIEW_WIDTH / 2}, ${VIEW_HEIGHT / 2}) scale(${zoom.toFixed(3)}) translate(${(-VIEW_WIDTH / 2 + pan.x).toFixed(1)}, ${(-VIEW_HEIGHT / 2 + pan.y).toFixed(1)})`;

  return (
    <section className={styles.constellationSection} aria-label={t("atlas.map.ariaLabel", { station: stationName })}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeadingGroup}>
          <h2 className={styles.sectionTitle}>{t("atlas.map.title")}</h2>
          <p className={styles.sectionSubtitle}>{t("atlas.map.subtitle")}</p>
        </div>

        <div className={styles.toolbarControls}>
          {viewMode === "map" ? (
            <>
              <div className={styles.segmentedControl} role="group" aria-label={t("atlas.stats.bridges")}>
                <button
                  type="button"
                  className={`${styles.segmentedButton} ${bridgeMode === "strongest" ? styles.segmentedButtonActive : ""}`}
                  aria-pressed={bridgeMode === "strongest"}
                  onClick={() => setBridgeMode("strongest")}
                >
                  {t("atlas.map.strongestBridges")}
                </button>
                <button
                  type="button"
                  className={`${styles.segmentedButton} ${bridgeMode === "all" ? styles.segmentedButtonActive : ""}`}
                  aria-pressed={bridgeMode === "all"}
                  onClick={() => setBridgeMode("all")}
                >
                  {t("atlas.map.showAllBridges")}
                </button>
              </div>

              <div className={styles.zoomControls}>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Number((z - ZOOM_STEP).toFixed(2))))}
                  disabled={zoom <= MIN_ZOOM}
                  aria-label={t("atlas.map.zoomOut")}
                  title={t("atlas.map.zoomOut")}
                >
                  −
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Number((z + ZOOM_STEP).toFixed(2))))}
                  disabled={zoom >= MAX_ZOOM}
                  aria-label={t("atlas.map.zoomIn")}
                  title={t("atlas.map.zoomIn")}
                >
                  +
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
                  aria-label={t("atlas.map.resetView")}
                  title={t("atlas.map.resetView")}
                >
                  {t("atlas.map.resetView")}
                </button>
              </div>
            </>
          ) : null}

          <div className={styles.segmentedControl} role="group" aria-label={t("atlas.map.mapView")}>
            <button
              type="button"
              className={`${styles.segmentedButton} ${viewMode === "map" ? styles.segmentedButtonActive : ""}`}
              aria-pressed={viewMode === "map"}
              onClick={() => {
                setUserChoseView(true);
                setViewMode("map");
              }}
            >
              {t("atlas.map.mapView")}
            </button>
            <button
              type="button"
              className={`${styles.segmentedButton} ${viewMode === "list" ? styles.segmentedButtonActive : ""}`}
              aria-pressed={viewMode === "list"}
              onClick={() => {
                setUserChoseView(true);
                setViewMode("list");
              }}
            >
              {t("atlas.map.listView")}
            </button>
          </div>
        </div>
      </div>

      {viewMode === "map" ? (
        <>
          <div
            className={`${styles.canvasStage} ${isDragging ? styles.canvasStageDragging : styles.canvasStageGrabbable}`}
          >
            {selectedDecades.length > 0 || selectedSlug ? (
              <div className={styles.filterBadgeRow}>
                {selectedDecades.length > 0 ? (
                  <span className={styles.filterBadge}>
                    {matchingCount === 0
                      ? t("atlas.map.noMatches")
                      : t("atlas.map.matchingCount", {
                          count: matchingCount,
                          total: playlists.length,
                        })}
                  </span>
                ) : null}
                {selectedSlug ? (
                  <button
                    type="button"
                    className={styles.filterBadge}
                    onClick={() => onSelectPlaylist(null)}
                  >
                    {t("atlas.map.clearSelection")} ×
                  </button>
                ) : null}
              </div>
            ) : null}

            <svg
              viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
              className={styles.constellationSvg}
              role="img"
              aria-label={t("atlas.map.ariaLabel", { station: stationName })}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <defs>
                <radialGradient id="atlasNodeGlow" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                  <stop offset="45%" stopColor={accentBrightHex} stopOpacity="0.95" />
                  <stop offset="100%" stopColor={accentHex} stopOpacity="1" />
                </radialGradient>
                <radialGradient id="atlasNodeHaloGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={accentBrightHex} stopOpacity="0.42" />
                  <stop offset="100%" stopColor={accentHex} stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Atmospheric polar sky grid */}
              <g aria-hidden="true">
                <circle cx="500" cy="310" r="115" className={styles.skyRing} />
                <circle cx="500" cy="310" r="225" className={styles.skyRing} />
                <circle cx="500" cy="310" r="340" className={styles.skyRing} />
                <circle cx="500" cy="310" r="460" className={styles.skyRing} />
                <line x1="60" y1="310" x2="940" y2="310" className={styles.skyCrosshair} />
                <line x1="500" y1="30" x2="500" y2="590" className={styles.skyCrosshair} />
              </g>

              <g transform={cameraTransform}>
                {/* Shared-track bridge chords */}
                <g>
                  {visibleBridges.map(({ bridge, key, src, dst, path, hitPath, strokeWidth, baseOpacity }) => {
                    const isEdgeHovered = hoveredEdgeKey === key;
                    const touchesFocus =
                      activeFocusSlug !== null &&
                      (bridge.source === activeFocusSlug || bridge.target === activeFocusSlug);
                    const matchesFilter = src.matchesDecade && dst.matchesDecade;

                    let opacity = baseOpacity;
                    let stroke = "rgba(186, 204, 224, 0.55)";
                    let width = strokeWidth;

                    if (isEdgeHovered) {
                      opacity = 0.96;
                      stroke = accentBrightHex;
                      width = strokeWidth + 1.4;
                    } else if (touchesFocus) {
                      opacity = 0.85;
                      stroke = accentBrightHex;
                      width = strokeWidth + 0.7;
                    } else if (activeFocusSlug !== null || hoveredEdgeKey !== null) {
                      opacity = 0.06;
                    } else if (!matchesFilter) {
                      opacity = 0.05;
                    }

                    const edgeLabel = `${t("atlas.map.bridgeTooltip", {
                      source: src.playlist.name,
                      target: dst.playlist.name,
                    })} — ${t("atlas.map.sharedTracks", { count: bridge.shared_count })}`;

                    return (
                      <g key={key}>
                        <path
                          d={path}
                          className={styles.bridgeEdge}
                          stroke={stroke}
                          strokeWidth={width}
                          strokeOpacity={opacity}
                          pointerEvents="none"
                        />
                        {hitPath ? (
                          <path
                            d={hitPath}
                            className={styles.bridgeHitArea}
                            aria-label={edgeLabel}
                            onMouseEnter={() => setHoveredEdgeKey(key)}
                            onMouseLeave={() => setHoveredEdgeKey((prev) => (prev === key ? null : prev))}
                            onClick={(event) => {
                              event.stopPropagation();
                              setHoveredEdgeKey((prev) => (prev === key ? null : key));
                            }}
                          />
                        ) : null}
                      </g>
                    );
                  })}
                </g>

                {/* Playlist nodes */}
                <g>
                  {layeredNodes.map((node) => {
                    const { playlist, cx, cy, r, lx, ly, lines, anchor, matchesDecade } = node;
                    const isSelected = playlist.slug === selectedSlug;
                    const isHovered = playlist.slug === hoveredSlug;
                    const isNeighbor = connectedToFocus?.has(playlist.slug) ?? false;
                    const isDimmedByFocus =
                      (activeFocusSlug !== null && !isNeighbor) ||
                      (hoveredEdgeData !== null &&
                        hoveredEdgeData.bridge.source !== playlist.slug &&
                        hoveredEdgeData.bridge.target !== playlist.slug);
                    const isDimmedByDecade = !matchesDecade;

                    const groupOpacity =
                      isSelected || isHovered
                        ? 1
                        : isDimmedByDecade
                          ? 0.16
                          : isDimmedByFocus
                            ? 0.22
                            : 0.96;

                    const isEmphasized = isSelected || isHovered || (activeFocusSlug !== null && isNeighbor);
                    const ariaText = `${playlist.name}, ${t(`atlas.role.${playlist.rotation_role}`)}, ${t("atlas.timeline.tracksLabel", { count: playlist.track_count })}`;

                    return (
                      <g
                        key={playlist.slug}
                        className={styles.nodeGroup}
                        style={{ opacity: groupOpacity }}
                        role="button"
                        tabIndex={0}
                        aria-label={ariaText}
                        aria-pressed={isSelected}
                        data-playlist-slug={playlist.slug}
                        onMouseEnter={() => {
                          setHoveredSlug(playlist.slug);
                          setHoveredEdgeKey(null);
                        }}
                        onMouseLeave={() =>
                          setHoveredSlug((prev) => (prev === playlist.slug ? null : prev))
                        }
                        onFocus={() => setHoveredSlug(playlist.slug)}
                        onBlur={() =>
                          setHoveredSlug((prev) => (prev === playlist.slug ? null : prev))
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          handleNodeSelect(playlist.slug);
                        }}
                        onKeyDown={(event) => handleNodeKeyDown(event, playlist.slug)}
                      >
                        {/* Generous transparent hit target bridging orb and label above edges */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={Math.max(17, r + 6)}
                          fill="transparent"
                        />
                        <line
                          x1={cx}
                          y1={cy}
                          x2={lx}
                          y2={ly}
                          stroke="transparent"
                          strokeWidth={12}
                        />

                        {/* Ambient glow halo */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isSelected ? r * 2.35 : isHovered ? r * 2.05 : r * 1.55}
                          fill="url(#atlasNodeHaloGrad)"
                          className={styles.nodeHalo}
                          opacity={isSelected ? 0.95 : isHovered ? 0.85 : 0.45}
                        />

                        {/* Focus-visible ring */}
                        <circle cx={cx} cy={cy} r={r + 6} className={styles.nodeFocusRing} />

                        {/* Selected outer ring */}
                        {isSelected ? (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={r + 5}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="2"
                            strokeOpacity="0.92"
                          />
                        ) : null}

                        {/* Role-differentiated geometry */}
                        {playlist.rotation_role === "reserved_window" ? (
                          <g transform={`translate(${cx}, ${cy})`}>
                            <rect
                              x={-(r * 0.88)}
                              y={-(r * 0.88)}
                              width={r * 1.76}
                              height={r * 1.76}
                              rx={3}
                              transform="rotate(45)"
                              fill="rgba(215, 187, 134, 0.24)"
                              stroke="#d7bb86"
                              strokeWidth={isSelected || isHovered ? 2.4 : 1.7}
                            />
                            <circle cx={0} cy={0} r={Math.max(4.5, r * 0.48)} fill="#d7bb86" />
                          </g>
                        ) : playlist.rotation_role === "open_only" ? (
                          <>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={r + 2.5}
                              fill="none"
                              stroke="#7cc4ff"
                              strokeWidth="1.6"
                              strokeDasharray="3.5 2.5"
                              strokeOpacity="0.88"
                            />
                            <circle
                              cx={cx}
                              cy={cy}
                              r={r}
                              fill="rgba(52, 118, 186, 0.72)"
                              stroke="rgba(219, 238, 255, 0.85)"
                              strokeWidth={isSelected || isHovered ? 2 : 1.2}
                            />
                          </>
                        ) : (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="url(#atlasNodeGlow)"
                            stroke={isSelected || isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.48)"}
                            strokeWidth={isSelected || isHovered ? 2.1 : 1.15}
                          />
                        )}

                        {/* Track count inside larger orbs */}
                        {r >= 13.5 ? (
                          <text x={cx} y={cy} className={styles.nodeCountBadge}>
                            {playlist.track_count}
                          </text>
                        ) : null}

                        {/* Crisp multi-line playlist label */}
                        <text
                          x={lx}
                          y={ly}
                          textAnchor={anchor}
                          className={`${styles.nodeLabel} ${
                            isEmphasized
                              ? styles.nodeLabelEmphasized
                              : isDimmedByFocus || isDimmedByDecade
                                ? styles.nodeLabelDimmed
                                : ""
                          }`}
                        >
                          {lines.map((line, lineIdx) => (
                            <tspan
                              key={lineIdx}
                              x={lx}
                              dy={lineIdx === 0 ? 0 : LABEL_LINE_HEIGHT}
                            >
                              {line}
                            </tspan>
                          ))}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </g>
            </svg>

            {/* Floating bridge detail tooltip */}
            {hoveredEdgeData ? (
              <div className={styles.bridgeTooltip} role="status" aria-live="polite">
                <div className={styles.bridgeTooltipHeader}>
                  <span className={styles.bridgeTooltipTitle}>
                    {t("atlas.map.bridgeTooltip", {
                      source: hoveredEdgeData.src.playlist.name,
                      target: hoveredEdgeData.dst.playlist.name,
                    })}
                  </span>
                  <span className={styles.bridgeTooltipMetric}>
                    {t("atlas.map.sharedTracks", { count: hoveredEdgeData.bridge.shared_count })}
                  </span>
                </div>
                {hoveredEdgeData.bridge.sample_tracks.length > 0 ? (
                  <ul className={styles.bridgeSampleList}>
                    {hoveredEdgeData.bridge.sample_tracks.slice(0, 5).map((track, index) => (
                      <li key={`${track.artist}-${track.title}-${index}`}>
                        <span className={styles.bridgeSampleTrack}>
                          {track.artist} — {track.title}
                        </span>
                        {track.year ? <span className={styles.bridgeSampleYear}>{track.year}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className={styles.canvasLegendBar}>
            <div className={styles.legendItems}>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatchThemed} aria-hidden="true" />
                {t("atlas.role.themed")}
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatchOpen} aria-hidden="true" />
                {t("atlas.role.open_only")}
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatchReserved} aria-hidden="true" />
                {t("atlas.role.reserved_window")}
              </span>
            </div>
            <span className={styles.keyboardHint}>{t("atlas.map.keyboardHint")}</span>
          </div>
        </>
      ) : (
        <div className={styles.playlistListWrap}>
          <div className={styles.playlistListSortRow}>
            <span className={styles.vaultMetaNote}>
              {selectedDecades.length > 0
                ? t("atlas.map.matchingCount", {
                    count: matchingCount,
                    total: playlists.length,
                  })
                : t("atlas.vault.resultsCount", { count: playlists.length })}
            </span>
            <div className={styles.sortBar}>
              {(
                [
                  { key: "tracks", label: t("atlas.stats.tracks") },
                  { key: "name", label: t("atlas.inspector.sortTitle") },
                  { key: "bridges", label: t("atlas.stats.bridges") },
                ] as Array<{ key: ListSortKey; label: string }>
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`${styles.sortChip} ${listSort === opt.key ? styles.sortChipActive : ""}`}
                  aria-pressed={listSort === opt.key}
                  onClick={() => setListSort(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {selectedDecades.length > 0 && matchingCount === 0 ? (
            <div className={styles.emptyState}>{t("atlas.map.noMatches")}</div>
          ) : (
            <ul className={styles.playlistListGrid}>
              {sortedListPlaylists.map(({ playlist, matchesDecade }) => {
                const isSelected = playlist.slug === selectedSlug;
                return (
                  <li key={playlist.slug}>
                    <button
                      type="button"
                      className={`${styles.playlistListCard} ${
                        isSelected ? styles.playlistListCardSelected : ""
                      } ${!matchesDecade ? styles.playlistListCardDimmed : ""}`}
                      aria-pressed={isSelected}
                      onClick={() => onSelectPlaylist(isSelected ? null : playlist.slug)}
                    >
                      <div className={styles.playlistListCardTop}>
                        <span className={styles.playlistListCardName}>{playlist.name}</span>
                        <span className={`${styles.roleBadge} ${roleBadgeClass(playlist.rotation_role)}`}>
                          {t(`atlas.role.${playlist.rotation_role}`)}
                        </span>
                      </div>
                      <div className={styles.playlistListCardMeta}>
                        <span>{t("atlas.timeline.tracksLabel", { count: playlist.track_count })}</span>
                        <span>·</span>
                        <span>{formatYearSpan(playlist.min_year, playlist.max_year)}</span>
                        {playlist.bridge_count > 0 ? (
                          <>
                            <span>·</span>
                            <span>
                              {playlist.bridge_count} {t("atlas.stats.bridges").toLowerCase()}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
