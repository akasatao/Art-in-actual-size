export const RULER_GAP_MM = 6;
export const RULER_HEIGHT_MM = 12;

const TICK_MM = { cm: 2, halfDecimeter: 3.5, decimeter: 5 };
const LABEL_Y_MM = 8.8;
const FONT_SIZE_MM = 2.8;

/** A centimetre scale drawn in millimetre units; the parent sizes it to `widthMm` at 1:1. */
export default function CmRuler({ widthMm }: { widthMm: number }) {
  const cmCount = Math.floor(widthMm / 10);
  const labelEveryCm = widthMm < 500 ? 1 : 10;

  return (
    <svg
      viewBox={`0 0 ${widthMm} ${RULER_HEIGHT_MM}`}
      preserveAspectRatio="none"
      className="block size-full overflow-visible text-white/55"
      aria-hidden
    >
      <g stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke">
        <line x1={0} y1={0} x2={widthMm} y2={0} vectorEffect="non-scaling-stroke" />
        {Array.from({ length: cmCount + 1 }, (_, cm) => (
          <line
            key={cm}
            x1={cm * 10}
            y1={0}
            x2={cm * 10}
            y2={tickLength(cm)}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1={widthMm}
          y1={0}
          x2={widthMm}
          y2={TICK_MM.decimeter}
          vectorEffect="non-scaling-stroke"
        />
      </g>

      <g fill="currentColor" fontSize={FONT_SIZE_MM} className="tabular-nums">
        {Array.from({ length: cmCount + 1 }, (_, cm) =>
          cm % labelEveryCm === 0 ? (
            <text key={cm} x={cm * 10} y={LABEL_Y_MM} textAnchor={cm === 0 ? "start" : "middle"}>
              {cm}
            </text>
          ) : null,
        )}
        <text x={widthMm + 2} y={LABEL_Y_MM} textAnchor="start">
          cm
        </text>
      </g>
    </svg>
  );
}

function tickLength(cm: number) {
  if (cm % 10 === 0) return TICK_MM.decimeter;
  if (cm % 5 === 0) return TICK_MM.halfDecimeter;
  return TICK_MM.cm;
}
