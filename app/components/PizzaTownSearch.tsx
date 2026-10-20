// "Check your town": a city or ZIP search over the pre-scored indexes, with a
// result card and a shareable link (?town=new-haven-ct or ?town=06511).
// A combobox in the ARIA sense: the input owns a listbox of suggestions and
// arrow keys move through them.

import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import Button from '~/components/Button';
import { TextField } from '~/components/Field';
import Notice from '~/components/Notice';
import Panel from '~/components/Panel';
import { useCopy } from '~/hooks/useCopy';
import {
  MIN_STORES,
  RADIUS_KM,
  findBySlug,
  findZip,
  isZip,
  loadPlaces,
  loadZips,
  percentile,
  searchPlaces,
  type Town,
} from '~/utils/pizza/towns';

const RADIUS_MI = Math.round(RADIUS_KM * 0.621371);
/** Below this many stores, one store's rating visibly moves the score. */
const FEW_STORES = 10;

interface Props {
  town: Town | null;
  onTown: (town: Town | null) => void;
}

export default function PizzaTownSearch({ town, onTown }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Town[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const latest = useRef('');
  const listId = useId();
  const { state: copyState, copy } = useCopy();

  // A shared link: open its town once, on arrival.
  const linked = searchParams.get('town');
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !linked) return;
    opened.current = true;
    findBySlug(linked)
      .then((found) => {
        if (!found) return setHint(`Couldn’t find “${linked}”. Try searching for it.`);
        onTown(found);
        setQuery(found.label);
      })
      .catch(() => setHint('Couldn’t load the town list. Try again in a moment.'));
  }, [linked, onTown]);

  const search = (value: string) => {
    setQuery(value);
    setOpen(true);
    setActive(0);
    setHint(null);
    latest.current = value;
    const q = value.trim();

    const show = (found: Town[], empty: string | null) => {
      if (latest.current !== value) return; // A newer keystroke won.
      setOptions(found);
      setHint(found.length ? null : empty);
    };
    const failed = () => latest.current === value && setHint('Couldn’t load the town list. Try again in a moment.');

    if (isZip(q)) {
      loadZips()
        .then((zips) => {
          const found = findZip(zips, q);
          show(found ? [found] : [], `No ZIP code ${q} in the 50 states.`);
        })
        .catch(failed);
    } else if (/^\d+$/.test(q)) {
      show([], 'A ZIP code has five digits.');
    } else if (q.length >= 2) {
      loadPlaces()
        .then((places) => show(searchPlaces(places, q), `No town matching “${q}”.`))
        .catch(failed);
    } else {
      show([], null);
    }
  };

  const choose = (picked: Town) => {
    onTown(picked);
    setQuery(picked.label);
    setOpen(false);
    setHint(null);
    setSearchParams(
      (params) => {
        params.set('town', picked.slug);
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Enter' && open && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && options.length > 0;
  const link = town && typeof window !== 'undefined' ? `${window.location.origin}/pizza-rating?town=${town.slug}` : '';

  return (
    <div className="mb-6 space-y-4">
      <div className="relative">
        <TextField
          label="Check your town"
          placeholder="City or ZIP code"
          value={query}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          onChange={(e) => search(e.target.value)}
          onKeyDown={onKeyDown}
          // Fetch the town list while they type the first letters.
          onFocus={() => void loadPlaces().catch(() => {})}
          onBlur={() => setOpen(false)}
        />
        {showList && (
          // divs, not ul/li: this sits inside .prose, whose list rules would add bullets and indents.
          <div
            id={listId}
            role="listbox"
            className="font-neo absolute inset-x-0 top-full z-20 border-2 border-t-0 border-black bg-white"
          >
            {options.map((option, i) => (
              <div
                key={option.slug}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // Focus stays in the input (aria-activedescendant points here); -1 keeps the option out of the tab order.
                tabIndex={-1}
                // mousedown, not click: it lands before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm font-bold ${
                  i === active ? 'bg-black text-white' : 'text-black'
                }`}
              >
                <span className="truncate">{option.label}</span>
                <span className="shrink-0 font-mono text-xs font-normal">
                  {option.score === null ? 'not enough data' : option.score.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {hint && <Notice tone="info">{hint}</Notice>}

      {town && (
        <Panel
          dark
          title={town.label}
          aside={
            <Button size="sm" onClick={() => void copy(link)}>
              {copyState === 'copied' ? 'Copied' : 'Copy link'}
            </Button>
          }
        >
          <div className="font-neo space-y-3 p-4 text-black md:p-6">
            {town.score === null ? (
              <Notice tone="info">
                Not enough Domino’s near {town.label} to score it: {town.stores} within {RADIUS_KM} km ({RADIUS_MI} mi),
                and a score needs {MIN_STORES}.
              </Notice>
            ) : (
              <TownScore town={town} score={town.score} />
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

function TownScore({ town, score }: { town: Town; score: number }) {
  const pct = percentile(score);
  return (
    <>
      <div className="flex items-baseline gap-3">
        <span className="text-5xl leading-none font-black tracking-tighter">{score.toFixed(2)}</span>
        <span className="text-sm font-extrabold tracking-wider uppercase">Pizza Score</span>
      </div>
      <div className="text-base font-medium">
        {pct >= 50
          ? `Domino’s here rate worse than in ${pct}% of the country: a sign the local pizza is strong.`
          : `Domino’s here rate better than in ${100 - pct}% of the country: a sign the local pizza isn’t much competition.`}
      </div>
      <div className="text-xs text-gray-600">
        From {town.stores.toLocaleString()} Domino’s within {RADIUS_KM} km ({RADIUS_MI} mi)
        {town.stores < FEW_STORES ? ', few enough that one store moves the score' : ''}. A percentile, not a star
        rating: the whole map spans well under half a star.
      </div>
    </>
  );
}
