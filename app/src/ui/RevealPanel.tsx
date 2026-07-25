import { useEffect, useState } from 'react';
import type { SessionState } from '../domain/types';
import { voteStats } from '../domain/voting';
import { reveal, revote, accept } from '../domain/hostActions';
import { PlayingCard } from './PlayingCard';
import { Button, DisplayHeading, Felt, Kicker } from './primitives';

const feltSelectClass =
  'rounded-lg border border-felt-border bg-white/6 px-3 py-2 text-sm text-felt-fg focus-visible:border-accent';

const CONFETTI_COLORS = ['#d9b45b', '#5fd39a', '#e88', '#8bd', '#f4ecd8'];

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="absolute -top-2.5 h-3 w-2 rounded-sm"
          style={{
            left: `${(i * 7 + 5) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animation: `fall ${1.8 + (i % 5) * 0.25}s ${(i % 6) * 0.12}s ease-in infinite`,
          }}
        />
      ))}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-[10px] border border-felt-border bg-black/20 p-2.5 text-[13px] text-felt-muted">
      <div className="font-display text-xl text-felt-fg">{value}</div>
      {label}
    </div>
  );
}

interface RevealPanelProps {
  state: SessionState;
  isHost: boolean;
  myPeerId?: string;
  onMutate: (fn: (s: SessionState) => SessionState) => void;
}

export function RevealPanel({ state, isHost, myPeerId, onMutate }: RevealPanelProps) {
  const active = state.items.find((i) => i.id === state.activeItemId) ?? null;
  const stats = active ? voteStats(active.votes) : null;
  const [chosen, setChosen] = useState<string>('');

  useEffect(() => {
    if (stats && stats.mode.length) setChosen(stats.mode[0]);
  }, [active?.id, state.revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  const voters = state.participants.filter((p) => p.role === 'voter');
  const me = state.participants.find((p) => p.peerId === myPeerId);

  if (!active) {
    return (
      <Felt className="grid min-h-[220px] place-items-center p-6 text-center">
        <div>
          <Kicker>Voting</Kicker>
          <p className="mt-2 text-sm text-felt-muted">
            {isHost ? 'Pick an agenda item to start a round.' : 'Waiting for the host to pick an item.'}
          </p>
        </div>
      </Felt>
    );
  }

  if (!state.revealed) {
    const votedCount = voters.filter((p) => active.votes[p.peerId] !== undefined).length;
    return (
      <Felt className="flex min-h-[220px] flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Kicker>Now estimating</Kicker>
            <DisplayHeading as="h3" className="mt-1 text-xl sm:text-2xl">
              {active.title || '(untitled)'}
            </DisplayHeading>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl leading-none text-accent">
              {votedCount}
              <span className="text-lg text-felt-muted">/{voters.length}</span>
            </div>
            <div className="text-[11px] tracking-[.1em] text-felt-muted">CARDS IN</div>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-center gap-4 py-2">
          {voters.map((p) => {
            const voted = active.votes[p.peerId] !== undefined;
            return (
              <div key={p.peerId} className="flex flex-col items-center gap-2">
                <PlayingCard face={voted ? 'down' : 'slot'} size="md" />
                <span className="text-[13px] text-felt-muted">{p.name}</span>
              </div>
            );
          })}
          {voters.length === 0 && <p className="text-sm text-felt-muted">No voters yet.</p>}
        </div>

        {isHost ? (
          <div className="flex justify-end border-t border-felt-border pt-4">
            <Button variant="primary" onClick={() => onMutate(reveal)}>
              Reveal the table &rarr;
            </Button>
          </div>
        ) : me?.role === 'voter' ? (
          <p className="text-center text-[13px] text-felt-muted">
            You played {(myPeerId && active.votes[myPeerId]) ?? 'a card'} &middot; the table flips
            when the host reveals.
          </p>
        ) : (
          <p className="text-center text-[13px] text-felt-muted">
            Waiting for the host to reveal.
          </p>
        )}
      </Felt>
    );
  }

  const revealedVoters = voters.filter((p) => active.votes[p.peerId] !== undefined);

  return (
    <Felt className="flex flex-col gap-5 p-5 sm:p-6">
      <div>
        <Kicker>Result &middot; {active.title || '(untitled)'}</Kicker>
        <DisplayHeading as="h3" className="mt-1 text-xl sm:text-2xl">
          {active.title || '(untitled)'}
        </DisplayHeading>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        {revealedVoters.map((p, i) => {
          const value = active.votes[p.peerId];
          const isMode = stats?.mode.includes(value);
          return (
            <div key={p.peerId} className="flex flex-col items-center gap-2">
              <PlayingCard face="up" value={value} size="lg" highlighted={isMode} animateDelay={i * 0.08} showCorner />
              <span className="text-[13px] text-muted">{p.name}</span>
            </div>
          );
        })}
      </div>

      {stats && (
        <div
          className="relative overflow-hidden rounded-[18px] p-6 text-center"
          style={
            stats.consensus
              ? { background: 'linear-gradient(135deg, #e7c874, #d9b45b)', color: '#0b1d17' }
              : {
                  background: 'radial-gradient(120% 120% at 50% -20%, #5a2f26, #3a1f1a)',
                  color: 'var(--color-felt-fg)',
                  border: '1px solid #6b3a30',
                }
          }
        >
          {stats.consensus && <Confetti />}
          <div className="relative">
            <div className="text-xs font-semibold uppercase tracking-[.16em] opacity-80">
              {stats.consensus ? 'Consensus — nice' : 'Split table — discuss'}
            </div>
            <div className="font-display text-5xl leading-none sm:text-6xl" style={{ margin: '10px 0' }}>
              {stats.mode[0] ?? '—'}
            </div>
            <div className="mx-auto max-w-[440px] text-sm opacity-90">
              {stats.consensus
                ? 'Everyone landed on the same card. Accept it and move on.'
                : 'Estimates are spread out — worth a quick discussion, then re-vote.'}
            </div>
          </div>
        </div>
      )}

      {stats && (stats.min !== null || stats.max !== null) && (
        <div className="flex justify-center gap-6">
          {stats.min !== null && <StatTile label="LOW" value={stats.min} />}
          {stats.min !== null && <StatTile label="MODE" value={stats.mode[0] ?? '—'} />}
          {stats.max !== null && <StatTile label="HIGH" value={stats.max} />}
        </div>
      )}

      {isHost && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-felt-border pt-4">
          <Button variant="felt" onClick={() => onMutate(revote)}>
            Re-vote this item
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-felt-muted" htmlFor="accept-estimate">
              Accept
            </label>
            <select
              id="accept-estimate"
              className={feltSelectClass}
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
            >
              {state.deck.values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <Button variant="primary" onClick={() => onMutate((s) => accept(s, chosen))}>
              Confirm &middot; next item &rarr;
            </Button>
          </div>
        </div>
      )}
    </Felt>
  );
}
