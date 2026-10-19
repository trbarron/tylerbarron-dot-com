import { useRetroreflectance } from './retroreflectance-context';
import Button from '~/components/Button';

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
    // The wrapper hides it on phones: <Button> sets its own display.
    <span className="mt-4 hidden md:inline-block">
      <Button size="sm" onClick={() => setEnabled(!enabled)} aria-expanded={enabled}>
        {enabled ? 'Click to remove color' : 'Click to add color'}
      </Button>
    </span>
  );
}
