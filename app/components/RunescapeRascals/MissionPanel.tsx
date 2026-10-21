import Panel from '~/components/Panel';
import type { Mission } from '~/utils/runescapeRascals/types';
import { ago } from './format';

/** The party's mission: a vision chosen in council, and the milestones towards it. */
export default function MissionPanel({ mission, now }: { mission: Mission | null; now: number }) {
  if (!mission?.mission) {
    return (
      <Panel title="Mission" padded>
        <p className="m-0 text-sm text-neutral-700">None yet: the next council chooses one.</p>
      </Panel>
    );
  }
  return (
    <Panel
      title={`Mission: ${mission.title}`}
      subtitle={`Proposed by ${mission.proposedBy} · council ${mission.council}${mission.unanimous ? ' · unanimous' : ''} · ${ago(mission.set, now)}`}
    >
      <div className="px-4 pt-3 pb-4">
        <p className="m-0 mb-4 text-base leading-relaxed">{mission.mission}</p>
        <ol className="m-0 grid list-none gap-2 p-0 md:grid-cols-3">
          {mission.milestones.map((m) => (
            <li key={m.id} className={`border-2 border-black px-3 py-2 ${m.done ? 'bg-neutral-100' : ''}`}>
              <span className="mb-1 flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold">M{m.id}</span>
                {m.done && (
                  <span className="border-2 border-black bg-black px-1 text-[10px] leading-4 font-bold tracking-wider text-white uppercase">
                    Done
                  </span>
                )}
              </span>
              <span className={`block text-sm leading-snug font-bold ${m.done ? 'line-through' : ''}`}>{m.what}</span>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}
