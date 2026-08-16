import { useRetroreflectance } from "./retroreflectance-context";

/**
 * Footer control that turns the retroreflective background on and off.
 * Desktop only - the panel it opens is a fixed side console that has nowhere
 * sensible to sit on a phone.
 */
export default function RetroreflectanceTrigger() {
  const retro = useRetroreflectance();
  if (!retro || !retro.supported) return null;

  const { enabled, setEnabled } = retro;

  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      aria-expanded={enabled}
      className="mt-4 hidden border-2 px-3 py-1 text-xs md:inline-block"
    >
      {enabled ? "Click to remove color" : "Click to add color"}
    </button>
  );
}
