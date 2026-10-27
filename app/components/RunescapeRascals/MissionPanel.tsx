import Panel from '~/components/Panel';
import type { Mission, Snapshot } from '~/utils/runescapeRascals/types';
import { ago } from './format';
import Clamp from './Clamp';
import { Plan } from './Talk';

interface MissionPanelProps {
  mission: Mission | null;
  plan: Snapshot['plan'];
  now: number;
}

/** Who agreed to do what at the last council, folded away under the mission it serves. */
function PlanFold({ plan }: { plan: Snapshot['plan'] }) {
  if (!plan) return null;
  return (
    <details className="group mt-4 border-2 border-black">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold tracking-wider uppercase hover:bg-black hover:text-white [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Council {plan.council} plan ↓</span>
        <span className="hidden group-open:inline">Council {plan.council} plan ↑</span>
      </summary>
      <div className="border-t-2 border-black">
        <Plan plan={plan} />
      </div>
    </details>
  );
}

/** The party's mission: a vision chosen in council, the milestones towards it, and who does what. */
export default function MissionPanel({ mission, plan, now }: MissionPanelProps) {
  if (!mission?.mission) {
    return (
      <Panel title="Mission" padded>
        <p className="m-0 text-sm text-neutral-700">None yet: the next council chooses one.</p>
        <PlanFold plan={plan} />
      </Panel>
    );
  }
  const active = mission.milestones.filter((m) => !m.done);
  const completed = mission.milestones.filter((m) => m.done);
  return (
    <Panel
      title={`Mission: ${mission.title}`}
      subtitle={`Proposed by ${mission.proposedBy} · council ${mission.council}${mission.unanimous ? ' · unanimous' : ''} · ${ago(mission.set, now)}`}
    >
      <div className="px-4 pt-3 pb-4">
        <Clamp lines={2} className="mb-4 text-base leading-relaxed">
          {mission.mission}
        </Clamp>
        <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {active.map((m) => (
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
        {completed.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer py-1 font-semibold text-neutral-600">
              {completed.length} completed
            </summary>
            <ul className="m-0 mt-2 list-none space-y-2 p-0">
              {completed.map((m) => (
                <li key={m.id} className="text-sm text-neutral-600">
                  <span className="mr-2 font-mono text-xs">M{m.id} ✓</span>
                  {m.what}
                </li>
              ))}
            </ul>
          </details>
        )}
        <PlanFold plan={plan} />
      </div>
    </Panel>
  );
}
