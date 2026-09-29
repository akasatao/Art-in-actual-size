import type OpenSeadragon from "openseadragon";
import type { Artwork } from "@/lib/works";

/** Keeps the polygon within a fraction of a screen pixel of a true circle even at max zoom. */
const ROUND_SEGMENTS = 1024;

/**
 * The scan is anti-aliased into its white surround, and downscaled pyramid levels smear that
 * over about a screen pixel, so the crop sits this far inside the edge at any zoom.
 */
const EDGE_INSET_SOURCE_PX = 1.5;
const EDGE_INSET_SCREEN_PX = 2;

/**
 * Crops the image to the painted surface so the page background shows around non-rectangular
 * works. The inset is re-derived as the zoom changes, before each frame is drawn.
 */
export function cropToShape(
  viewer: OpenSeadragon.Viewer,
  image: OpenSeadragon.TiledImage,
  shape: Artwork["shape"],
) {
  if (shape !== "round") return;

  const { x: width, y: height } = image.source.dimensions;
  let croppedAtZoom: number | undefined;

  const crop = () => {
    const zoom = viewer.viewport.getZoom(true);
    if (zoom === croppedAtZoom) return;
    croppedAtZoom = zoom;

    const screenPxPerSourcePx = image.viewportToImageZoom(zoom);
    const inset = Math.max(EDGE_INSET_SOURCE_PX, EDGE_INSET_SCREEN_PX / screenPxPerSourcePx);
    const rx = width / 2 - inset;
    const ry = height / 2 - inset;
    const polygon = Array.from({ length: ROUND_SEGMENTS }, (_, i) => {
      const angle = (2 * Math.PI * i) / ROUND_SEGMENTS;
      return { x: width / 2 + rx * Math.cos(angle), y: height / 2 + ry * Math.sin(angle) };
    });
    // OSD accepts plain {x, y} objects here; its typings ask for Point instances.
    image.setCroppingPolygons([polygon as OpenSeadragon.Point[]]);
  };

  crop();
  viewer.addHandler("viewport-change", crop);
}
