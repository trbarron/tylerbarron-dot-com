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
        <p className="m-0 mb-3 text-base">{mission.mission}</p>
        <ol className="m-0 grid list-none gap-2 p-0 md:grid-cols-3">
          {mission.milestones.map((m) => (
            <li
              key={m.id}
              className={`relative border-2 border-black py-2 pr-3 pl-9 ${m.done ? 'bg-neutral-100' : ''}`}
            >
              <span
                aria-label={m.done ? 'done' : 'open'}
                className={`absolute top-2.5 left-3 grid h-4 w-4 place-items-center border-2 border-black text-[10px] leading-none font-extrabold ${m.done ? 'bg-black text-white' : ''}`}
              >
                {m.done ? '✓' : ''}
              </span>
              <span className={`block text-sm font-bold ${m.done ? 'line-through' : ''}`}>
                M{m.id} {m.what}
              </span>
              <span className="block font-mono text-xs text-neutral-700">needs {m.needs}</span>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}
