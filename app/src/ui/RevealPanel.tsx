import { useEffect, useState } from 'react';
import type { SessionState } from '../domain/types';
import { voteStats } from '../domain/voting';
import { reveal, revote, accept } from '../domain/hostActions';

const sectionClass = 'rounded-lg border border-border bg-muted p-4 space-y-3';
const buttonClass =
  'rounded border border-border bg-bg px-3 py-1.5 text-sm text-fg hover:text-accent transition-colors';
const inputClass = 'rounded border border-border bg-bg px-2 py-1 text-fg';
const barTrackClass = 'h-2 flex-1 rounded bg-bg overflow-hidden';
const barFillClass = 'h-full bg-accent';
const badgeClass = 'rounded-full border border-accent bg-bg px-2 py-0.5 text-xs text-accent';

interface RevealPanelProps {
  state: SessionState;
  isHost: boolean;
  onMutate: (fn: (s: SessionState) => SessionState) => void;
}

export function RevealPanel({ state, isHost, onMutate }: RevealPanelProps) {
  const active = state.items.find((i) => i.id === state.activeItemId) ?? null;
  const stats = active ? voteStats(active.votes) : null;
  const [chosen, setChosen] = useState<string>('');

  useEffect(() => {
    if (stats && stats.mode.length) setChosen(stats.mode[0]);
  }, [active?.id, state.revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) {
    return (
      <section className={sectionClass}>
        <h2 className="text-lg font-semibold">Voting</h2>
        <p className="text-sm text-fg">
          {isHost ? 'No item selected.' : 'Waiting for the host to pick an item.'}
        </p>
      </section>
    );
  }

  const voters = state.participants.filter((p) => p.role === 'voter');
  const maxCount = stats ? Math.max(1, ...Object.values(stats.counts)) : 1;

  return (
    <section className={sectionClass}>
      <h2 className="text-lg font-semibold">Voting: {active.title || '(untitled)'}</h2>

      {!state.revealed && (
        <>
          <ul className="space-y-1">
            {voters.map((p) => (
              <li key={p.peerId} className="text-sm text-fg">
                {p.name}: {active.votes[p.peerId] !== undefined ? '✓' : '—'}
              </li>
            ))}
          </ul>
          {isHost && (
            <button type="button" className={buttonClass} onClick={() => onMutate(reveal)}>
              Reveal
            </button>
          )}
        </>
      )}

      {state.revealed && stats && (
        <>
          <ul className="space-y-1">
            {voters.map((p) => (
              <li key={p.peerId} className="text-sm text-fg">
                {p.name}: {active.votes[p.peerId] ?? '—'}
              </li>
            ))}
          </ul>

          <div className="space-y-1">
            {state.deck.values
              .filter((v) => stats.counts[v])
              .map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <span className={`w-8 text-sm ${stats.mode.includes(v) ? 'font-bold text-accent' : 'text-fg'}`}>
                    {v}
                  </span>
                  <div className={barTrackClass}>
                    <div
                      className={barFillClass}
                      style={{ width: `${(stats.counts[v] / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-fg">{stats.counts[v]}</span>
                </div>
              ))}
          </div>

          <div className="flex items-center gap-2 text-sm text-fg">
            {stats.min !== null && stats.max !== null && (
              <span>
                Spread: {stats.min}–{stats.max}
              </span>
            )}
            {stats.consensus && <span className={badgeClass}>Consensus</span>}
          </div>

          {isHost && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={buttonClass} onClick={() => onMutate(revote)}>
                Re-vote
              </button>
              <label className="text-sm text-fg" htmlFor="accept-estimate">
                Accept
              </label>
              <select
                id="accept-estimate"
                className={inputClass}
                value={chosen}
                onChange={(e) => setChosen(e.target.value)}
              >
                {state.deck.values.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <button type="button" className={buttonClass} onClick={() => onMutate((s) => accept(s, chosen))}>
                Confirm
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
