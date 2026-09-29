"use client";

import { useEffect, useRef } from "react";
import type OpenSeadragon from "openseadragon";
import { cropToShape } from "@/lib/shape";
import type { Artwork } from "@/lib/works";

/**
 * The main viewer's viewport, as fractions of the image's width and height.
 * Not clipped: it may extend beyond 0–1 when the viewport shows more than the image.
 */
export type ViewRect = { x: number; y: number; w: number; h: number };

const BOX_WIDTH_PX = 180;
const BOX_HEIGHT_PX = 120;
const PADDING_PX = 8;
const MIN_RECT_PX = 4;
const EPSILON = 0.002;
/** Once zoomed in, the minimap shows this many times the main viewport's width/height. */
const ZOOM_OUT_FACTOR = 3;
/** After a minimap drag, the minimap eases back to follow the main view instead of jumping. */
const SETTLE_MS = 600;

export default function Minimap({
  tileSource,
  shape,
  view,
  visible: uiVisible,
  label,
  onNavigate,
}: {
  tileSource: string;
  shape: Artwork["shape"];
  view: ViewRect;
  /** False while the viewer UI is idle-hidden. */
  visible: boolean;
  label: string;
  onNavigate: (x: number, y: number, immediately: boolean) => void;
}) {
  const visible = uiVisible && !showsWholeImage(clip(view));

  const mapRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<OpenSeadragon.Viewer | null>(null);
  const viewRef = useRef(view);
  const syncRef = useRef<() => void>(() => {});
  const draggingRef = useRef(false);
  const settleUntilRef = useRef(0);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    let mini: OpenSeadragon.Viewer | undefined;
    let cancelled = false;

    import("openseadragon").then(({ default: OSD }) => {
      if (cancelled) return;

      mini = OSD({
        element,
        tileSources: tileSource,
        // WebGL can fail to create textures here (e.g. a second context, tainted tiles) and
        // then stays blank until the next animation; a 180×120 canvas is cheap anyway.
        drawer: "canvas",
        showNavigationControl: false,
        mouseNavEnabled: false,
        keyboardNavEnabled: false,
        visibilityRatio: 0,
        constrainDuringPan: false,
        minZoomLevel: 1e-6,
        maxZoomLevel: 1e6,
        animationTime: 0.3,
        blendTime: 0,
        imageLoaderLimit: 4,
      });
      mini.canvas.tabIndex = -1;
      miniRef.current = mini;

      const drawRect = () => {
        const image = mini?.world.getItemAt(0);
        const rect = rectRef.current;
        if (!mini || !image || !rect) return;
        const b = image.getBounds();
        const m = mini.viewport.getBounds(true);
        const v = clip(viewRef.current);
        const scale = BOX_WIDTH_PX / m.width;
        const width = v.w * b.width * scale;
        const height = v.h * b.height * scale;
        const left = (b.x + v.x * b.width - m.x) * scale - Math.max(0, MIN_RECT_PX - width) / 2;
        const top = (b.y + v.y * b.height - m.y) * scale - Math.max(0, MIN_RECT_PX - height) / 2;
        Object.assign(rect.style, {
          left: `${left}px`,
          top: `${top}px`,
          width: `${Math.max(width, MIN_RECT_PX)}px`,
          height: `${Math.max(height, MIN_RECT_PX)}px`,
          visibility: "visible",
        });
      };

      const sync = () => {
        const image = mini?.world.getItemAt(0);
        if (!mini || !image) return;
        if (!draggingRef.current) {
          const target = minimapBounds(image.getBounds(), viewRef.current);
          const bounds = new OSD.Rect(target.x, target.y, target.width, target.height);
          mini.viewport.fitBounds(bounds, performance.now() > settleUntilRef.current);
        }
        drawRect();
      };
      syncRef.current = sync;

      mini.addHandler("open", () => {
        const image = mini?.world.getItemAt(0);
        if (mini && image) cropToShape(mini, image, shape);
        sync();
      });
      mini.addHandler("viewport-change", drawRect);
    });

    return () => {
      cancelled = true;
      miniRef.current = null;
      syncRef.current = () => {};
      mini?.destroy();
    };
  }, [tileSource, shape]);

  useEffect(() => {
    viewRef.current = view;
    syncRef.current();
  }, [view]);

  const navigateTo = (e: React.PointerEvent<HTMLDivElement>, immediately: boolean) => {
    const mini = miniRef.current;
    const image = mini?.world.getItemAt(0);
    if (!mini || !image) return;
    const box = e.currentTarget.getBoundingClientRect();
    const b = image.getBounds();
    const m = mini.viewport.getBounds(true);
    const worldX = m.x + ((e.clientX - box.left) / box.width) * m.width;
    const worldY = m.y + ((e.clientY - box.top) / box.height) * m.height;
    onNavigate(clamp01((worldX - b.x) / b.width), clamp01((worldY - b.y) / b.height), immediately);
  };

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    settleUntilRef.current = performance.now() + SETTLE_MS;
    syncRef.current();
  };

  return (
    <div
      className={`absolute right-4 bottom-4 z-10 transition-opacity duration-500 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div
        style={{ width: BOX_WIDTH_PX, height: BOX_HEIGHT_PX }}
        className="relative overflow-hidden bg-[#191919] shadow-[0_0_0_2px_#fff] select-none"
      >
        <div ref={mapRef} className="pointer-events-none absolute inset-0" />
        <div
          ref={rectRef}
          className="pointer-events-none invisible absolute border border-[#F7DF9E] bg-[#F7DF9E]/30"
        />
        <div
          aria-label={label}
          role="img"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            draggingRef.current = true;
            navigateTo(e, false);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) navigateTo(e, true);
          }}
          onPointerUp={endDrag}
          onLostPointerCapture={endDrag}
          className="absolute inset-0 cursor-pointer touch-none"
        />
      </div>
    </div>
  );
}

/**
 * The world rect the minimap should show: the whole image when the main view is zoomed
 * out, otherwise `ZOOM_OUT_FACTOR`× the main viewport around its center, kept inside the image.
 */
function minimapBounds(image: OpenSeadragon.Rect, view: ViewRect) {
  const viewWidth = view.w * image.width;
  const viewHeight = view.h * image.height;
  const fitScale = Math.min(
    (BOX_WIDTH_PX - PADDING_PX * 2) / image.width,
    (BOX_HEIGHT_PX - PADDING_PX * 2) / image.height,
  );
  const followScale = Math.min(
    BOX_WIDTH_PX / (viewWidth * ZOOM_OUT_FACTOR),
    BOX_HEIGHT_PX / (viewHeight * ZOOM_OUT_FACTOR),
  );
  const scale = Math.max(fitScale, followScale);
  const width = BOX_WIDTH_PX / scale;
  const height = BOX_HEIGHT_PX / scale;
  const centerX = clampCenter(image.x + (view.x + view.w / 2) * image.width, image.x, image.width, width);
  const centerY = clampCenter(image.y + (view.y + view.h / 2) * image.height, image.y, image.height, height);
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

function clampCenter(center: number, start: number, length: number, span: number) {
  if (span >= length) return start + length / 2;
  return Math.min(start + length - span / 2, Math.max(start + span / 2, center));
}

function clip({ x, y, w, h }: ViewRect): ViewRect {
  const x0 = clamp01(x);
  const y0 = clamp01(y);
  return { x: x0, y: y0, w: clamp01(x + w) - x0, h: clamp01(y + h) - y0 };
}

function showsWholeImage({ x, y, w, h }: ViewRect) {
  return x <= EPSILON && y <= EPSILON && x + w >= 1 - EPSILON && y + h >= 1 - EPSILON;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
