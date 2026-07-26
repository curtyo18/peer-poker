import { useEffect, useState } from 'react';
import type { AgendaItem, CardValue, SessionState } from '../domain/types';
import { getGuest } from '../net/live';
import { reveal, skipItem } from '../domain/hostActions';
import { CardHand } from './CardHand';
import { DeadRoom } from './ConnState';
import { LinkedTitle } from './LinkedTitle';
import { PlayingCard } from './PlayingCard';
import { Avatar, Button, DisplayHeading, Kicker, Panel, PlayerPill, StatusDot, insetClass } from './primitives';

type VotingStageProps = {
  state: SessionState;
  item: AgendaItem;
  myPeerId: string | undefined;
  onVote: (value: CardValue) => void;
} & (
  | {
      role: 'host';
      onMutate: (fn: (s: SessionState) => SessionState) => void;
      /** Ask everyone who has not played a card yet to play one. */
      onNudge: () => void;
    }
  | {
      role: 'guest';
      /** A kick or an ended session leaves the last state in place, so the stage must say so. */
      terminal: 'kicked' | 'ended' | 'unreachable' | 'not-found' | 'no-answer' | null;
      /** Increments each time the host nudges the room. */
      nudgeSignal: number;
      onLeave: () => void;
    }
);

// The confirmation banner's lifetime is also the cooldown: the host cannot nudge again while it
// is on screen, so there is nothing to debounce separately and nothing to spam.
const NUDGE_CONFIRM_MS = 3000;
const NUDGE_PROMPT_MS = 6000;

export function VotingStage(props: VotingStageProps) {
  const { state, item, myPeerId, onVote } = props;
  const nudgeSignal = props.role === 'guest' ? props.nudgeSignal : 0;

  // How many players the last nudge went out to, while the confirmation is up.
  const [nudgeSentTo, setNudgeSentTo] = useState<number | null>(null);
  const [nudged, setNudged] = useState(false);

  useEffect(() => {
    if (nudgeSentTo === null) return;
    const timer = setTimeout(() => setNudgeSentTo(null), NUDGE_CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [nudgeSentTo]);

  // Keyed on the signal alone, so a later round cannot resurrect an old nudge. Whether it
  // applies to *this* player is decided at render, which means playing a card dismisses it.
  useEffect(() => {
    if (nudgeSignal === 0) return;
    setNudged(true);
    const timer = setTimeout(() => setNudged(false), NUDGE_PROMPT_MS);
    return () => clearTimeout(timer);
  }, [nudgeSignal]);

  // A kick or an ended session closes this guest's connection before the host broadcasts
  // the roster without them, so `state` still seats them and every control below would
  // still render, wired to a connection that is already gone. Hand over instead.
  // Below the hooks, not above them: a guard that skips a hook is a rules-of-hooks violation
  // that React does not throw on, so lint is the only thing that catches it.
  if (props.role === 'guest' && props.terminal) {
    return <DeadRoom terminal={props.terminal} onLeave={props.onLeave} />;
  }

  const me = state.participants.find((p) => p.peerId === myPeerId);
  const voters = state.participants.filter((p) => p.role === 'voter');
  const votedCount = voters.filter((p) => item.votes[p.peerId] !== undefined).length;
  const myVote = myPeerId ? item.votes[myPeerId] : undefined;
  const stillDeciding = voters.length - votedCount;

  // Three seats, not two: a host who chose not to play is never seated at all, and a kicked guest
  // stops being seated mid-round. Collapsing "no record" into "observer" tells a host they are
  // waiting for themselves, and tells a removed guest they are observing. Both were live bugs.
  const seat: 'voter' | 'observer' | 'none' = me?.role ?? 'none';

  // Guest-only: identical to ConsoleStage's/ParticipantView's role toggle.
  const handleToggleRole = () => {
    if (!me) return;
    getGuest()?.changeRole(me.role === 'observer' ? 'voter' : 'observer');
  };

  const handleNudge = () => {
    if (props.role !== 'host' || stillDeciding === 0 || nudgeSentTo !== null) return;
    props.onNudge();
    setNudgeSentTo(stillDeciding);
  };

  // A nudge is addressed to people who still owe a card. An observer does not, and neither does
  // anyone who has already played — so for them nothing is shown at all.
  const showNudgePrompt = props.role === 'guest' && nudged && seat === 'voter' && myVote === undefined;

  return (
    <main className="mx-auto max-w-[760px] px-[26px] pt-6 pb-20" style={{ animation: 'var(--animate-ppfade)' }}>
      <div className="flex flex-col gap-3.5">
        <Panel>
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
            <Kicker tone="muted">Table &middot; {voters.length} seated</Kicker>
            <div className="flex items-center gap-3">
              {props.role === 'guest' && me && (
                <Button variant="secondary" size="sm" onClick={handleToggleRole}>
                  {me.role === 'voter' ? '👁 Observe instead' : 'Take a seat'}
                </Button>
              )}
              {/* Host only, and gone entirely once there is nobody left to wait for. */}
              {props.role === 'host' && stillDeciding > 0 && (
                <button
                  type="button"
                  onClick={handleNudge}
                  disabled={nudgeSentTo !== null}
                  aria-label={`Nudge ${stillDeciding} ${stillDeciding === 1 ? 'player who has' : 'players who have'} not voted`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/35 bg-accent/12 px-3 py-1 text-xs font-semibold text-accent-soft transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span aria-hidden="true">👋</span>
                  <span aria-hidden="true">Nudge unvoted ({stillDeciding})</span>
                </button>
              )}
              <span className="text-[12.5px] font-semibold text-accent-soft">
                {votedCount} of {voters.length} voted
              </span>
            </div>
          </div>
          {nudgeSentTo !== null && (
            <div
              role="status"
              className="mb-2.5 rounded-[10px] border border-accent/35 bg-accent/12 px-3 py-2 text-xs text-accent-soft"
              style={{ animation: 'var(--animate-ppfade)' }}
            >
              <span aria-hidden="true">👋 </span>
              Nudge sent to the {nudgeSentTo} {nudgeSentTo === 1 ? 'person' : 'people'} who
              {nudgeSentTo === 1 ? ' hasn’t' : ' haven’t'} voted.
            </div>
          )}
          {/* role="list" restores what `list-style: none` takes away: WebKit drops list semantics
              — and with them the aria-label that tells this row apart from the played-card row. */}
          <ul
            role="list"
            aria-label="Who has voted"
            className="m-0 flex list-none flex-wrap gap-2 p-0"
          >
            {voters.map((p) => (
              <li key={p.peerId}>
                <PlayerPill
                  name={p.name}
                  voted={item.votes[p.peerId] !== undefined}
                  isSelf={p.peerId === myPeerId}
                  connected={p.connected}
                />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <div className="mb-4.5 flex flex-wrap items-start justify-between gap-3.5">
            <div>
              <Kicker>Now estimating</Kicker>
              <DisplayHeading as="h3" className="mt-1 text-[22px]">
                <LinkedTitle title={item.title} url={item.url} />
              </DisplayHeading>
            </div>
            <div className="flex-none text-right">
              <div className="font-display text-[18px] text-accent-soft">
                {votedCount}
                <span className="text-[13px] text-muted"> / {voters.length}</span>
              </div>
              <div className="text-[10px] uppercase tracking-[.14em] text-muted">cards in</div>
            </div>
          </div>

          <ul
            role="list"
            aria-label="Cards played"
            className="m-0 flex list-none flex-wrap items-center justify-center gap-3 p-0"
          >
            {voters.map((p) => {
              const voted = item.votes[p.peerId] !== undefined;
              return (
                <li key={p.peerId} className="flex flex-col items-center gap-1.5">
                  <PlayingCard face={voted ? 'down' : 'slot'} size="sm" />
                  {/* The face-down card and the dashed slot are the only visible difference
                      between having played and not, so the state has to be said in words too. */}
                  <span className={`flex items-center gap-1.5 text-xs ${voted ? 'text-fg-2' : 'text-muted'}`}>
                    <Avatar name={p.name} size="sm" isSelf={p.peerId === myPeerId} dimmed={!voted} />
                    {p.name}
                    <span className="sr-only">{voted ? ' — card played' : ' — still thinking'}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {voters.length === 0 && (
            <p className="text-center text-sm text-muted">No voters yet.</p>
          )}

          {seat !== 'none' && (
            <p className="mt-4 text-center text-[12.5px] text-muted">
              {seat === 'observer'
                ? 'Waiting for the host to reveal.'
                : myVote !== undefined
                  ? `You played ${myVote} · tap another card to change it — the table flips when the host reveals.`
                  : 'Play a card to join the round — the table flips when the host reveals.'}
            </p>
          )}
        </Panel>

        {/* Announced, not just animated: a screen-reader user gets nothing from a border. */}
        {showNudgePrompt && (
          <div
            role="status"
            className="rounded-[10px] border border-accent/35 bg-accent/12 px-3.5 py-2.5 text-center text-[13px] text-accent-soft"
            style={{ animation: 'var(--animate-ppfade)' }}
          >
            <span aria-hidden="true">👋 </span>
            The host is waiting on your estimate.
          </div>
        )}

        {seat === 'voter' && (
          // An arbitrary property, not a `border-accent` utility: panelClass already sets
          // `border-border` and Tailwind emits it after, so an appended class silently loses.
          <Panel className={showNudgePrompt ? '[border-color:var(--color-accent)]' : ''}>
            <Kicker className="mb-3 block text-center">Your vote</Kicker>
            <CardHand deck={state.deck} myVote={myVote} disabled={state.revealed} onVote={onVote} />
          </Panel>
        )}

        {props.role === 'guest' && seat === 'observer' && (
          <Panel className="p-8 text-center">
            <div aria-hidden="true" className="text-3xl">
              👁
            </div>
            <DisplayHeading as="h3" className="mt-2 text-xl">
              You&rsquo;re observing this round
            </DisplayHeading>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Observers see the table and the reveal but don&rsquo;t play a card, so they never sway
              the estimate. Take a seat to join the next hand.
            </p>
            <Button variant="primary" className="mt-4" onClick={handleToggleRole}>
              Take a seat
            </Button>
          </Panel>
        )}

        {props.role === 'host' ? (
          <div className={`${insetClass} flex flex-wrap items-center gap-3`}>
            <span className="text-[13px] text-muted">
              {voters.length === 0
                ? 'Nobody has taken a seat yet.'
                : stillDeciding === 0
                  ? "Everyone's in."
                  : `${stillDeciding} ${stillDeciding === 1 ? 'player' : 'players'} still deciding.`}
            </span>
            <div className="ml-auto flex items-center gap-2.5">
              <Button variant="secondary" onClick={() => props.onMutate(skipItem)}>
                Skip item
              </Button>
              <Button variant="primary" onClick={() => props.onMutate(reveal)}>
                Reveal all &rarr;
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Nothing at all when the viewer has no seat — a host who chose not to play has
                no participant record, and a line about "your card" would be addressed to nobody. */}
            {seat !== 'none' && (
              <div className="flex items-center gap-2.5 text-[13px] text-muted">
                <StatusDot tone="success" />
                {seat === 'observer'
                  ? "You're observing. The host reveals when everyone's in."
                  : myVote !== undefined
                    ? "Your card's in. You can change it any time until the host reveals."
                    : "Play a card when you're ready — the host reveals when everyone's in."}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
