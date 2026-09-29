"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type OpenSeadragon from "openseadragon";
import CmRuler, { RULER_GAP_MM, RULER_HEIGHT_MM } from "@/components/CmRuler";
import { useRequiredPxPerMm } from "@/lib/calibration";
import { useMessages } from "@/lib/i18n";
import { useShowRuler } from "@/lib/preferences";
import type { Artwork } from "@/lib/works";

const UI_IDLE_MS = 2500;

const PAN_ONLY_GESTURES: OpenSeadragon.GestureSettings = {
  dragToPan: true,
  flickEnabled: true,
  scrollToZoom: false,
  clickToZoom: false,
  dblClickToZoom: false,
  dblClickDragToZoom: false,
  pinchToZoom: false,
  pinchRotate: false,
};

const PAN_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
]);

const BROWSER_ZOOM_KEYS = new Set(["+", "-", "=", "_", "0"]);

type Status = "loading" | "ready" | "error";

export default function ActualSizeViewer({ work }: { work: Artwork }) {
  const pxPerMm = useRequiredPxPerMm();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [rulerElement, setRulerElement] = useState<HTMLDivElement | null>(null);
  const showRuler = useShowRuler();
  const t = useMessages();
  const uiVisible = useIdleVisibility(UI_IDLE_MS);

  const close = useCallback(() => router.push("/"), [router]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if ((e.ctrlKey || e.metaKey) && BROWSER_ZOOM_KEYS.has(e.key)) e.preventDefault();
    };
    // Ctrl+wheel is also what trackpad pinch emits in Chromium.
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const preventGesture = (e: Event) => e.preventDefault();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("gesturestart", preventGesture);
    window.addEventListener("gesturechange", preventGesture);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("gesturestart", preventGesture);
      window.removeEventListener("gesturechange", preventGesture);
    };
  }, [close]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || pxPerMm === undefined) return;

    const targetWidthPx = work.widthMm * pxPerMm;
    let viewer: OpenSeadragon.Viewer | undefined;
    let cancelled = false;

    import("openseadragon").then(({ default: OSD }) => {
      if (cancelled) return;

      viewer = OSD({
        element: container,
        tileSources: work.iiifUrl,
        showNavigationControl: false,
        preserveImageSizeOnResize: true,
        ...lockedZoom(targetWidthPx, container.clientWidth),
        visibilityRatio: 0.1,
        animationTime: 0.6,
        blendTime: 0.15,
        gestureSettingsMouse: PAN_ONLY_GESTURES,
        gestureSettingsTouch: PAN_ONLY_GESTURES,
        gestureSettingsPen: PAN_ONLY_GESTURES,
        gestureSettingsUnknown: PAN_ONLY_GESTURES,
      });
      viewerRef.current = viewer;

      // The container may not have its final size when the viewer is created, so the
      // 1:1 zoom (which is relative to container width) is re-derived from the live size.
      // "resize" fires after the new container size is known but before OSD re-zooms.
      const syncLockedZoom = () => {
        if (!viewer) return;
        const { viewport } = viewer;
        Object.assign(viewport, lockedZoom(targetWidthPx, viewport.getContainerSize().x));
      };

      viewer.addHandler("open", () => {
        syncLockedZoom();
        viewer?.viewport.goHome(true);
        setStatus("ready");
      });
      viewer.addHandler("resize", syncLockedZoom);
      viewer.addHandler("canvas-key", (e) => {
        const { code, shiftKey } = e.originalEvent as KeyboardEvent;
        if (shiftKey || !PAN_KEYS.has(code)) e.preventDefaultAction = true;
      });
      viewer.addHandler("open-failed", () => setStatus("error"));
      viewer.addHandler("canvas-double-click", (e) => {
        e.preventDefaultAction = true;
        viewer?.viewport.goHome();
      });
    });

    return () => {
      cancelled = true;
      viewerRef.current = null;
      viewer?.destroy();
    };
  }, [pxPerMm, work.iiifUrl, work.widthMm]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const image = viewer?.world.getItemAt(0);
    if (!viewer || !image || status !== "ready" || !showRuler) return;

    const bounds = image.getBounds();
    const worldPerMm = bounds.width / work.widthMm;
    const location = bounds.clone();
    location.y = bounds.y + bounds.height + RULER_GAP_MM * worldPerMm;
    location.height = RULER_HEIGHT_MM * worldPerMm;

    const element = document.createElement("div");
    element.style.pointerEvents = "none";
    viewer.addOverlay({ element, location });
    setRulerElement(element);

    return () => {
      viewer.removeOverlay(element);
      setRulerElement(null);
    };
  }, [status, showRuler, work.widthMm]);

  return (
    <main className="fixed inset-0 touch-none overflow-hidden overscroll-none bg-black">
      <div ref={containerRef} className="absolute inset-0 touch-none" />
      {rulerElement && createPortal(<CmRuler widthMm={work.widthMm} />, rulerElement)}

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="size-6 animate-spin rounded-full border border-white/10 border-t-white/60" />
        </div>
      )}

      {status === "error" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
          {t.loadFailed}
        </div>
      )}

      <Link
        href="/"
        aria-label={t.close}
        className={`absolute top-4 right-4 z-10 flex size-11 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur transition-opacity duration-500 hover:bg-black/70 hover:text-white ${
          uiVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </Link>
    </main>
  );
}

/** OpenSeadragon zoom is "image width / container width", so 1:1 depends on the container. */
function lockedZoom(targetWidthPx: number, containerWidthPx: number) {
  const zoom = targetWidthPx / Math.max(containerWidthPx, 1);
  return { defaultZoomLevel: zoom, minZoomLevel: zoom, maxZoomLevel: zoom };
}

/** Visible while the pointer is active; fades out after `idleMs` of no movement. */
function useIdleVisibility(idleMs: number) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let timer = window.setTimeout(() => setVisible(false), idleMs);
    const wake = () => {
      setVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), idleMs);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, [idleMs]);

  return visible;
}
