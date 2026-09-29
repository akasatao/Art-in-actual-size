"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useMessages } from "@/lib/i18n";
import {
  CARD_CORNER_RADIUS_MM,
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  savePxPerMm,
  usePxPerMm,
} from "@/lib/calibration";

const CSS_PX_PER_MM = 96 / 25.4;
const MIN_WIDTH_PX = 120;
const MAX_WIDTH_PX = 900;
const FINE_STEP_PX = 0.5;

export default function CalibrationScreen() {
  const stored = usePxPerMm();
  if (stored === undefined) return <div className="h-dvh bg-black" />;
  return <CalibrationForm initialPxPerMm={stored ?? CSS_PX_PER_MM} canCancel={stored !== null} />;
}

function CalibrationForm({
  initialPxPerMm,
  canCancel,
}: {
  initialPxPerMm: number;
  canCancel: boolean;
}) {
  const router = useRouter();
  const t = useMessages();
  const [cardWidthPx, setCardWidthPx] = useState(() =>
    clamp(initialPxPerMm * CARD_WIDTH_MM),
  );

  const pxPerMm = cardWidthPx / CARD_WIDTH_MM;
  const cardHeightPx = CARD_HEIGHT_MM * pxPerMm;

  const confirm = () => {
    savePxPerMm(pxPerMm);
    router.push("/");
  };

  return (
    <main className="relative flex h-dvh flex-col items-center justify-between gap-6 overflow-hidden bg-neutral-950 px-6 py-8 select-none">
      <div className="absolute top-4 right-4 rounded-full bg-black/60">
        <LanguageSwitcher />
      </div>

      <p className="max-w-2xl text-center text-sm leading-relaxed text-neutral-400 max-lg:pt-10">
        {t.calibrationInstruction}
      </p>

      <div className="flex flex-1 items-center justify-center">
        <div
          aria-label={t.cardFrame}
          className="shrink-0"
          style={{
            width: cardHeightPx,
            height: cardWidthPx,
            borderRadius: CARD_CORNER_RADIUS_MM * pxPerMm,
            boxShadow: "inset 0 0 0 2px #ef4444",
          }}
        />
      </div>

      <div className="flex w-full max-w-xl flex-col items-center gap-5">
        <div className="flex w-full items-center gap-3">
          <StepButton label={t.shrink} onClick={() => setCardWidthPx((w) => clamp(w - FINE_STEP_PX))}>
            −
          </StepButton>
          <input
            type="range"
            min={MIN_WIDTH_PX}
            max={MAX_WIDTH_PX}
            step={0.1}
            value={cardWidthPx}
            onChange={(e) => setCardWidthPx(Number(e.target.value))}
            aria-label={t.frameSize}
            className="h-2 w-full cursor-pointer accent-red-500"
          />
          <StepButton label={t.enlarge} onClick={() => setCardWidthPx((w) => clamp(w + FINE_STEP_PX))}>
            +
          </StepButton>
        </div>

        <p className="font-mono text-xs text-neutral-500 tabular-nums">
          {pxPerMm.toFixed(3)} px/mm
        </p>

        <div className="flex gap-3">
          {canCancel && (
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-full px-6 py-2.5 text-sm text-neutral-400 transition hover:text-white"
            >
              {t.cancel}
            </button>
          )}
          <button
            type="button"
            onClick={confirm}
            className="rounded-full bg-white px-8 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-200"
          >
            {t.confirm}
          </button>
        </div>
      </div>
    </main>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-700 text-lg text-neutral-300 transition hover:border-neutral-400 hover:text-white"
    >
      {children}
    </button>
  );
}

function clamp(widthPx: number) {
  return Math.min(MAX_WIDTH_PX, Math.max(MIN_WIDTH_PX, widthPx));
}
