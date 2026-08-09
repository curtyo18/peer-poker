import { useState } from 'react';
import type { AgendaItem, CardValue, SessionState } from '../domain/types';
import { voteStats, suggestedValue, outlierValue } from '../domain/voting';
import { accept, revote, setActive } from '../domain/hostActions';
import { CardHand } from './CardHand';
import { DeadRoom } from './ConnState';
import { Histogram } from './Histogram';
import { LinkedTitle } from './LinkedTitle';
import { PlayingCard } from './PlayingCard';
import { ResultsExport } from './ResultsExport';
import { changeSeat, otherSeat } from './seat';
import {
  Avatar,
  Button,
  DisplayHeading,
  Kicker,
  Panel,
  StatTile,
  StatusDot,
  inputClass,
  insetClass,
} from './primitives';

type RevealStageProps = {
  state: SessionState;
  item: AgendaItem;
  myPeerId: string | undefined;
  onVote: (value: CardValue) => void;
} & (
  | { role: 'host'; onMutate: (fn: (s: SessionState) => SessionState) => void; onEnd: () => void }
  | {
      role: 'guest';
      /** A kick or an ended session leaves the last state in place, so the stage must say so. */
      terminal: 'kicked' | 'ended' | 'unreachable' | 'not-found' | 'no-answer' | null;
      onLeave: () => void;
    }
);

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

export function RevealStage(props: RevealStageProps) {
  const { state, item, myPeerId, onVote } = props;

  const me = state.participants.find((p) => p.peerId === myPeerId);
  // Three seats, not two: 'none' is now only "no participant record", reachable for a kicked
  // guest or before a record exists — an observing host holds a real 'observer' record, same as
  // any other observer, so collapsing it into 'none' would tell them they have no seat at all.
  const seat: 'voter' | 'observer' | 'none' = me?.role ?? 'none';
  const voters = state.participants.filter((p) => p.role === 'voter');
  const revealedVoters = voters.filter((p) => item.votes[p.peerId] !== undefined);
  const myVote = myPeerId ? item.votes[myPeerId] : undefined;
  const stats = voteStats(item.votes);
  const suggested = suggestedValue(item.votes);
  const outlier = outlierValue(item.votes, state.deck.values);

  // `null` means "whatever the table suggests" — the state the host is in before they touch the
  // dropdown, and one a plain `useState<CardValue>` cannot tell apart from having deliberately
  // chosen the suggested value. Keeping it distinct means late votes keep moving the selection
  // while the host is reading, and a host who has picked something never has it yanked back.
  const [override, setOverride] = useState<CardValue | null>(null);
  const chosen = override ?? suggested ?? '';

  // Below every hook, deliberately: this returns on some renders and not others, so anything
  // above it would be called conditionally and React would see the hook count change the moment
  // a guest is kicked. A kick or an ended session closes their connection before the host
  // broadcasts the roster without them, so `state` still seats them and every control below
  // would otherwise render, wired to a connection that is already gone.
  if (props.role === 'guest' && props.terminal) {
    return <DeadRoom terminal={props.terminal} onLeave={props.onLeave} />;
  }

  // Host and guest both. It belongs on this screen because votes stay open until the estimate is
  // accepted, so "take a seat" is still a real offer after the cards are face-up.
  const handleToggleRole = () => {
    if (!me) return;
    changeSeat(otherSeat(me.role), props.role === 'host', state.hostPeerId);
  };

  const showStats = stats.mode.length > 0 || stats.min !== null;
  const nobodyVoted = revealedVoters.length === 0 && Object.keys(item.votes).length === 0;

  return (
    <main className="mx-auto max-w-[760px] px-[26px] pt-6 pb-20" style={{ animation: 'var(--animate-ppfade)' }}>
      <div className="flex flex-col gap-3.5">
        {/* Not a Panel: this strip is deliberately tighter than the panel padding, and Tailwind
            emits `p-[18px]` after `p-3`, so an override class on Panel would silently lose. */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-3.5 py-2.5">
          <div className="flex items-center">
            {state.participants.map((p) => (
              <Avatar key={p.peerId} name={p.name} isSelf={p.peerId === myPeerId} stacked />
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-[12.5px] text-ready">
            <StatusDot tone="success" />
            {revealedVoters.length} of {voters.length} in &middot; revealed
          </span>
        </div>

        <Panel>
          <Kicker>The reveal</Kicker>
          <DisplayHeading as="h3" className="mt-1 text-[22px]">
            <LinkedTitle title={item.title} url={item.url} />
          </DisplayHeading>

          {revealedVoters.length > 0 ? (
            <ul
              role="list"
              aria-label="Revealed cards"
              className="m-0 mt-5 flex list-none flex-wrap items-start justify-center gap-4 p-0"
            >
              {revealedVoters.map((p, i) => {
                const value = item.votes[p.peerId];
                return (
                  <li key={p.peerId} className="flex flex-col items-center gap-1.5">
                    <PlayingCard
                      face="up"
                      value={value}
                      size="lg"
                      highlighted={stats.mode.includes(value)}
                      animateDelay={i * 0.08}
                    />
                    <div className="flex items-center gap-1.5">
                      <Avatar name={p.name} size="sm" />
                      <span className="text-[12px] text-muted">{p.name}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-5 text-center text-sm text-muted">Nobody played a card.</p>
          )}

          <Histogram deck={state.deck.values} counts={stats.counts} mode={stats.mode} outlier={outlier} />

          <div
            className={`relative mt-4 overflow-hidden rounded-[14px] p-4 text-center ${
              nobodyVoted
                ? 'border border-border bg-surface-2'
                : stats.consensus
                  ? 'border border-ready-border bg-ready/10'
                  : stats.majority !== null
                    ? 'border border-accent/35 bg-accent/12'
                    : 'border border-verdict-border bg-verdict-bg'
            }`}
          >
            {stats.consensus && <Confetti />}
            <div className="relative">
              {/* An empty table is not a split table — there is nothing to be split about, and
                  showing "—" under a "discuss" heading invites accepting a number nobody chose. */}
              {nobodyVoted ? (
                <>
                  <div className="text-[11px] font-bold uppercase tracking-[.16em] text-muted">
                    No cards played
                  </div>
                  <p className="mx-auto mt-1 max-w-[440px] text-[13px] text-fg-2">
                    Nothing to read yet — re-vote to give the table another go.
                  </p>
                </>
              ) : stats.consensus ? (
                <>
                  <div className="text-[11px] font-bold uppercase tracking-[.16em] text-ready">
                    Consensus &mdash; nice
                  </div>
                  <div className="font-display text-[40px] leading-tight text-fg">{stats.mode[0] ?? '—'}</div>
                  <p className="mx-auto max-w-[440px] text-[13px] text-fg-2">
                    Everyone landed on the same card. Accept it and move on.
                  </p>
                </>
              ) : stats.majority !== null ? (
                /* Not unanimous, but one card is ahead of every other and holds more than half
                   the table. That is a decision the room has already made — reading it back as
                   "split, discuss" sends them into a debate they are not actually having. */
                <>
                  <div className="text-[11px] font-bold uppercase tracking-[.16em] text-accent-soft">
                    Majority &mdash; most of the table agrees
                  </div>
                  <div className="font-display text-[40px] leading-tight text-fg">{stats.majority}</div>
                  <p className="mx-auto max-w-[440px] text-[13px] text-fg-2">
                    {stats.counts[stats.majority]} of {stats.total} played {stats.majority}
                    {/* The spread is over every card played, the majority's included — saying
                        "the rest run 1 to 2" would be describing a range they are inside. */}
                    {stats.min !== null && stats.max !== null && stats.min !== stats.max
                      ? `, and estimates run ${stats.min} to ${stats.max}. `
                      : '. '}
                    Accept it, or hear the others out first.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-[11px] font-bold uppercase tracking-[.16em] text-verdict-fg">
                    Split table &mdash; discuss
                  </div>
                  <div className="font-display text-[40px] leading-tight text-verdict-num">{suggested ?? '—'}</div>
                  <p className="mx-auto max-w-[440px] text-[13px] text-fg-2">
                    {stats.min !== null && stats.max !== null
                      ? `Estimates run ${stats.min} to ${stats.max} — talk it through, then re-vote or accept.`
                      : 'Estimates don’t agree — talk it through, then re-vote or accept.'}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Low/high only exist for numeric decks; the "most picked" value is meaningful for any
              deck (T-shirt sizes, custom labels), so it gets its own guard rather than riding on `min`. */}
          {showStats && (
            <div className="mt-2.5 flex gap-2.5">
              {stats.min !== null && <StatTile label="LOW" value={stats.min} />}
              {stats.mode.length > 0 && <StatTile label="MOST PICKED" value={stats.mode.join(' or ')} />}
              {stats.max !== null && <StatTile label="HIGH" value={stats.max} />}
            </div>
          )}
        </Panel>

        {seat === 'voter' && (
          <Panel>
            <Kicker className="mb-3 block text-center">Your vote</Kicker>
            <CardHand deck={state.deck} myVote={myVote} disabled={false} onVote={onVote} />
            <p className="text-center text-[12px] text-muted">
              {myVote !== undefined
                ? `You played ${myVote} · tap another card to change it before the host accepts a value.`
                : "You didn't play a card — you still can."}
            </p>
          </Panel>
        )}

        {props.role === 'host' ? (
          <>
            <div className={`${insetClass} flex flex-wrap items-center gap-3`}>
              <Button variant="secondary" onClick={() => props.onMutate(revote)}>
                &#8635; Re-vote this item
              </Button>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <label className="text-sm text-muted" htmlFor="accept-estimate">
                  Accept
                </label>
                <select
                  id="accept-estimate"
                  className={inputClass}
                  value={chosen}
                  onChange={(e) => setOverride(e.target.value)}
                >
                  {/* With no votes there is no suggestion, so the field opens empty rather than
                      preselecting the first card of the deck — which nobody chose. */}
                  {chosen === '' && <option value="">&mdash;</option>}
                  {state.deck.values.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  disabled={chosen === ''}
                  onClick={() =>
                    props.onMutate((s) => {
                      const accepted = accept(s, chosen);
                      const next = accepted.items.find((i) => i.status === 'pending');
                      return next ? setActive(accepted, next.id) : { ...accepted, activeItemId: null, revealed: false };
                    })
                  }
                >
                  Confirm &middot; next item &rarr;
                </Button>
              </div>
            </div>

            {me && (
              <Button variant="secondary" size="sm" onClick={handleToggleRole}>
                {me.role === 'voter' ? '👁 Observe instead' : 'Take a seat'}
              </Button>
            )}

            {/* Mounted here as well as on the console, so a host can export or end the session
                without first finishing the round. ResultsExport already carries its own
                "Results & export" heading — an outer one would say it twice. */}
            <ResultsExport state={state} onEnd={props.onEnd} />
          </>
        ) : (
          seat !== 'none' && (
            <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-muted">
              <StatusDot tone="success" />
              {seat === 'observer'
                ? "You're observing. The host accepts a value or starts a re-vote."
                : myVote !== undefined
                  ? `You played ${myVote} — change it any time until the host accepts a value or starts a re-vote.`
                  : "You didn't play this round — you still can, until the host accepts a value."}
              {/* Votes stay open until the estimate is accepted, so an observer watching the
                  reveal can still decide to play — this was the one screen not offering it. */}
              {seat === 'observer' && (
                <Button variant="secondary" size="sm" onClick={handleToggleRole}>
                  Take a seat
                </Button>
              )}
            </div>
          )
        )}
      </div>
    </main>
  );
}
