"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type OpenSeadragon from "openseadragon";
import CmRuler, { RULER_GAP_MM, RULER_HEIGHT_MM } from "@/components/CmRuler";
import Minimap, { type ViewRect } from "@/components/Minimap";
import { useRequiredPxPerMm } from "@/lib/calibration";
import { useMessages } from "@/lib/i18n";
import { useShowRuler } from "@/lib/preferences";
import { cropToShape } from "@/lib/shape";
import type { Artwork } from "@/lib/works";

const UI_IDLE_MS = 2500;

const GESTURES: OpenSeadragon.GestureSettings = {
  dragToPan: true,
  flickEnabled: true,
  scrollToZoom: true,
  pinchToZoom: true,
  clickToZoom: false,
  dblClickToZoom: false,
  dblClickDragToZoom: false,
  pinchRotate: false,
};

/** OSD shortcuts for rotate and flip; these would break the physical scale's orientation. */
const BLOCKED_KEYS = new Set(["KeyR", "KeyF"]);

const BROWSER_ZOOM_KEYS = new Set(["+", "-", "=", "_", "0"]);

type Status = "loading" | "ready" | "error";

export default function ActualSizeViewer({ work }: { work: Artwork }) {
  const pxPerMm = useRequiredPxPerMm();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const [isActualSize, setIsActualSize] = useState(true);
  const [view, setView] = useState<ViewRect | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [rulerElement, setRulerElement] = useState<HTMLDivElement | null>(null);
  const showRuler = useShowRuler();
  const t = useMessages();
  const uiVisible = useIdleVisibility(UI_IDLE_MS);

  const close = useCallback(() => router.push("/"), [router]);
  const resetToActualSize = useCallback(() => {
    const viewer = viewerRef.current;
    if (viewer) zoomToActualSize(viewer);
  }, []);

  const panToImagePoint = useCallback((x: number, y: number, immediately: boolean) => {
    const viewer = viewerRef.current;
    const image = viewer?.world.getItemAt(0);
    if (!viewer || !image) return;
    const bounds = image.getBounds();
    const center = viewer.viewport.getCenter();
    center.x = bounds.x + x * bounds.width;
    center.y = bounds.y + y * bounds.height;
    viewer.viewport.panTo(center, immediately);
  }, []);

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
        ...zoomLimits({
          targetWidthPx,
          container: { x: container.clientWidth, y: container.clientHeight },
          aspect: work.heightMm / work.widthMm,
        }),
        visibilityRatio: 0.1,
        zoomPerScroll: 1.15,
        animationTime: 0.6,
        blendTime: 0.15,
        gestureSettingsMouse: GESTURES,
        gestureSettingsTouch: GESTURES,
        gestureSettingsPen: GESTURES,
        gestureSettingsUnknown: GESTURES,
      });
      viewerRef.current = viewer;

      // The container may not have its final size when the viewer is created, so the
      // 1:1 zoom (which is relative to container width) is re-derived from the live size.
      // "resize" fires after the new container size is known but before OSD re-zooms.
      const syncZoomLimits = () => {
        const image = viewer?.world.getItemAt(0);
        if (!viewer || !image) return;
        const { viewport } = viewer;
        const { x, y } = image.source.dimensions;
        Object.assign(
          viewport,
          zoomLimits({
            targetWidthPx,
            container: viewport.getContainerSize(),
            aspect: y / x,
            imageWidthPx: x,
          }),
        );
      };

      const syncIsActualSize = () => {
        if (!viewer) return;
        const { viewport } = viewer;
        const actualZoom = targetWidthPx / viewport.getContainerSize().x;
        setIsActualSize(Math.abs(viewport.getZoom() / actualZoom - 1) < 0.005);
      };

      const syncView = () => {
        const image = viewer?.world.getItemAt(0);
        if (!viewer || !image) return;
        const next = relativeRect(image.getBounds(true), viewer.viewport.getBounds(true));
        setView((prev) => (prev && sameRect(prev, next) ? prev : next));
      };

      viewer.addHandler("open", () => {
        const image = viewer?.world.getItemAt(0);
        if (viewer && image) cropToShape(viewer, image, work.shape);
        syncZoomLimits();
        viewer?.viewport.goHome(true);
        setStatus("ready");
      });
      viewer.addHandler("resize", syncZoomLimits);
      viewer.addHandler("zoom", syncIsActualSize);
      viewer.addHandler("viewport-change", syncView);
      viewer.addHandler("canvas-key", (e) => {
        const { code } = e.originalEvent as KeyboardEvent;
        if (BLOCKED_KEYS.has(code)) e.preventDefaultAction = true;
        if (code === "Digit0" || code === "Numpad0") {
          e.preventDefaultAction = true;
          if (viewer) zoomToActualSize(viewer);
        }
      });
      viewer.addHandler("open-failed", () => setStatus("error"));
      viewer.addHandler("canvas-double-click", (e) => {
        e.preventDefaultAction = true;
        if (viewer) zoomToActualSize(viewer);
      });
    });

    return () => {
      cancelled = true;
      viewerRef.current = null;
      setView(null);
      viewer?.destroy();
    };
  }, [pxPerMm, work.iiifUrl, work.widthMm, work.shape]);

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

      <div
        className={`absolute top-4 right-4 z-10 flex gap-2 transition-opacity duration-500 ${
          uiVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={resetToActualSize}
          aria-label={t.actualSize}
          title={t.actualSize}
          className={`flex h-11 min-w-11 items-center justify-center rounded-full bg-black/40 px-3 font-mono text-sm backdrop-blur transition hover:bg-black/70 hover:text-white ${
            isActualSize ? "text-white/40" : "text-white/90"
          }`}
        >
          1:1
        </button>
        <Link
          href="/"
          aria-label={t.close}
          className="flex size-11 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur transition hover:bg-black/70 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      {status === "ready" && view && (
        <Minimap
          tileSource={work.iiifUrl}
          shape={work.shape}
          view={view}
          visible={uiVisible}
          label={t.overview}
          onNavigate={panToImagePoint}
        />
      )}
    </main>
  );
}

/** Zooms to 1:1 around the current center (the home zoom is kept at actual size). */
function zoomToActualSize(viewer: OpenSeadragon.Viewer) {
  const { viewport } = viewer;
  viewport.zoomTo(viewport.getHomeZoom());
  viewport.applyConstraints();
}

/**
 * OpenSeadragon zoom is "image width / container width", so 1:1 depends on the container.
 * Zoom out to a bit below fit-to-screen; zoom in to 2× the image's native resolution
 * (or 2× actual size for images too small to reach it).
 */
function zoomLimits({
  targetWidthPx,
  container,
  aspect,
  imageWidthPx,
}: {
  targetWidthPx: number;
  container: { x: number; y: number };
  aspect: number;
  imageWidthPx?: number;
}) {
  const containerWidth = Math.max(container.x, 1);
  const actual = targetWidthPx / containerWidth;
  const fit = Math.min(1, container.y / containerWidth / aspect);
  const native = imageWidthPx ? imageWidthPx / (containerWidth * window.devicePixelRatio) : actual * 8;
  return {
    defaultZoomLevel: actual,
    minZoomLevel: Math.min(actual, fit) * 0.5,
    maxZoomLevel: Math.max(actual, native) * 2,
  };
}

/** `viewport` as fractions of `image`'s size (unclipped). */
function relativeRect(image: OpenSeadragon.Rect, viewport: OpenSeadragon.Rect): ViewRect {
  return {
    x: (viewport.x - image.x) / image.width,
    y: (viewport.y - image.y) / image.height,
    w: viewport.width / image.width,
    h: viewport.height / image.height,
  };
}

function sameRect(a: ViewRect, b: ViewRect) {
  const close = (p: number, q: number) => Math.abs(p - q) < 1e-4;
  return close(a.x, b.x) && close(a.y, b.y) && close(a.w, b.w) && close(a.h, b.h);
}

const WAKE_EVENTS = ["pointermove", "pointerdown", "wheel", "keydown"] as const;

/** Visible while the user is active; fades out after `idleMs` without input. */
function useIdleVisibility(idleMs: number) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let timer = window.setTimeout(() => setVisible(false), idleMs);
    const wake = () => {
      setVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), idleMs);
    };
    for (const type of WAKE_EVENTS) window.addEventListener(type, wake, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const type of WAKE_EVENTS) window.removeEventListener(type, wake);
    };
  }, [idleMs]);

  return visible;
}
