"use client";

export type SegmentedOption<T extends string> = { value: T; label: string };

export default function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`flex items-center gap-0.5 text-xs ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-2.5 py-1.5 transition ${
            value === option.value ? "bg-white/15 text-white" : "text-neutral-500 hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
