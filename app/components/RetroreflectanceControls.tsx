import { useId, useState } from "react";

import {
  DEFAULT_RETRO_PARAMS,
  RETRO_PARAM_SPECS,
  type RetroParamSpec,
  type RetroParams,
} from "./retroreflectance-params";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Decimal places implied by a step, so 0.005 shows as 0.005 and not 0.01. */
const decimalsFor = (step: number) => {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
};

interface RowProps {
  spec: RetroParamSpec;
  value: number;
  onChange: (value: number) => void;
}

function ParamRow({ spec, value, onChange }: RowProps) {
  const id = useId();
  /*
   * The number field keeps its own draft string while focused. Formatting the
   * committed number on every keystroke instead would fight the typist: "0."
   * parses to 0 and would rewrite the field to "0" mid-entry, moving the caret.
   * Whatever parses gets committed live; blur snaps back to canonical form.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value.toFixed(decimalsFor(spec.step));

  const commit = (raw: string) => {
    setDraft(raw);
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) onChange(clamp(parsed, spec.min, spec.max));
  };

  return (
    <div className="border-b-2 border-black/10 py-2 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-[0.7rem] font-bold tracking-wide uppercase"
        >
          {spec.label}
        </label>
        <input
          type="number"
          aria-label={`${spec.label} value`}
          value={shown}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          onChange={(event) => commit(event.target.value)}
          onBlur={() => setDraft(null)}
          className="w-20 border-2 px-1 py-0.5 text-right font-mono text-xs"
        />
      </div>
      <input
        id={id}
        type="range"
        value={value}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        onChange={(event) => onChange(Number.parseFloat(event.target.value))}
        className="mt-2 w-full"
      />
    </div>
  );
}

interface Props {
  enabled: boolean;
  params: RetroParams;
  onEnabledChange: (enabled: boolean) => void;
  onParamsChange: (params: RetroParams) => void;
}

/**
 * The parameter console. Opened from the footer trigger, and hidden below md
 * along with it - it is a fixed side panel with nowhere to sit on a phone.
 */
export default function RetroreflectanceControls({
  enabled,
  params,
  onEnabledChange,
  onParamsChange,
}: Props) {
  if (!enabled) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 hidden md:block print:hidden">
      <section
        aria-label="Retroreflectance controls"
        className="flex max-h-[min(32rem,calc(100vh-2rem))] w-80 max-w-[calc(100vw-2rem)] flex-col border-4 border-black bg-white"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b-4 border-black px-3 py-2">
          <h2 className="text-xs font-extrabold tracking-wider uppercase">
            Retroreflectance
          </h2>
          <button
            type="button"
            onClick={() => onEnabledChange(false)}
            aria-label="Remove retroreflectance"
            className="border-2 px-2 py-0.5 text-xs leading-none"
          >
            Remove
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          {RETRO_PARAM_SPECS.map((spec) => (
            <ParamRow
              key={spec.key}
              spec={spec}
              value={params[spec.key]}
              onChange={(value) =>
                onParamsChange({ ...params, [spec.key]: value })
              }
            />
          ))}
        </div>

        <footer className="shrink-0 border-t-4 border-black px-3 py-2">
          <button
            type="button"
            onClick={() => onParamsChange(DEFAULT_RETRO_PARAMS)}
            className="border-2 px-2 py-1 text-[0.7rem] leading-none"
          >
            Reset to defaults
          </button>
        </footer>
      </section>
    </div>
  );
}
