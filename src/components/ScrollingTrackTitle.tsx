"use client";

import { useEffect, useRef } from "react";

/** Reveal an overflowing title without duplicating its accessible text. */
export function ScrollingTrackTitle({ title }: { title: string }) {
  const viewportRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const text = textRef.current;
    if (!viewport || !text) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animation: Animation | undefined;
    let previousDistance = -1;
    const update = () => {
      const distance = Math.max(0, text.scrollWidth - viewport.clientWidth);
      const effectiveDistance = reducedMotion.matches ? 0 : distance;
      if (effectiveDistance === previousDistance) return;
      previousDistance = effectiveDistance;
      animation?.cancel();
      if (effectiveDistance <= 1) return;

      // Travel at 28px/second, with a two-second pause at either end.
      const travel = Math.max(1800, effectiveDistance / 28 * 1000);
      const duration = travel * 2 + 4000;
      animation = text.animate([
        { transform: "translateX(0)", offset: 0 },
        { transform: "translateX(0)", offset: 2000 / duration },
        { transform: `translateX(-${effectiveDistance}px)`, offset: (2000 + travel) / duration },
        { transform: `translateX(-${effectiveDistance}px)`, offset: (4000 + travel) / duration },
        { transform: "translateX(0)", offset: 1 }
      ], { duration, iterations: Infinity, easing: "linear" });
    };

    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(text);
    reducedMotion.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", update);
      animation?.cancel();
    };
  }, [title]);

  return (
    <strong className="trackTitleText trackTitleViewport" ref={viewportRef} title={title}>
      <span className="trackTitleScroll" ref={textRef}>{title}</span>
    </strong>
  );
}
