import type { SessionState } from '../domain/types';
import { getGuest } from '../net/live';
import { RevealPanel } from './RevealPanel';
import { ParticipantList } from './ParticipantList';
import { ConnState } from './ConnState';
import { CardHand } from './CardHand';
import { Avatar, Button, DisplayHeading, Felt, Kicker, StatusDot, panelClass } from './primitives';

interface ParticipantViewProps {
  state: SessionState | null;
  myPeerId: string | undefined;
  terminal: 'kicked' | 'ended' | 'unreachable' | null;
  onLeave: () => void;
}

const noop = () => { /* guests cannot mutate session state */ };

export function ParticipantView({ state, myPeerId, terminal, onLeave }: ParticipantViewProps) {
  const mainClass = 'mx-auto flex max-w-[760px] flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8';

  if (!state) {
    return (
      <main className={mainClass}>
        {terminal ? (
          <ConnState mode="guest" terminal={terminal} onLeave={onLeave} />
        ) : (
          <div className={`${panelClass} flex items-center justify-center`}>
            <ConnState mode="guest" terminal={null} onLeave={onLeave} />
          </div>
        )}
      </main>
    );
  }

  const me = state.participants.find((p) => p.peerId === myPeerId);
  const activeItem = state.items.find((i) => i.id === state.activeItemId) ?? null;
  const voters = state.participants.filter((p) => p.role === 'voter');
  const votedCount = activeItem ? voters.filter((p) => activeItem.votes[p.peerId] !== undefined).length : 0;

  const handleToggleRole = () => {
    if (!me) return;
    getGuest()?.changeRole(me.role === 'observer' ? 'voter' : 'observer');
  };

  return (
    <main className={mainClass}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <div className="flex items-center">
          {state.participants.map((p) => (
            <Avatar key={p.peerId} name={p.name} isSelf={p.peerId === myPeerId} stacked />
          ))}
        </div>
        <div className="flex items-center gap-3">
          {me && (
            <Button size="sm" variant="secondary" onClick={handleToggleRole}>
              {me.role === 'observer' ? 'Take a seat' : '👁 Observe instead'}
            </Button>
          )}
          <span className="flex items-center gap-2 text-xs text-muted">
            <StatusDot tone="accent" />
            {votedCount} of {voters.length} in
          </span>
        </div>
      </div>

      <RevealPanel state={state} isHost={false} myPeerId={myPeerId} onMutate={noop} />

      {me?.role === 'observer' && activeItem && !state.revealed && (
        <Felt className="p-8 text-center">
          <div aria-hidden="true" className="text-3xl">👁</div>
          <DisplayHeading as="h3" className="mt-2 text-xl">
            You&rsquo;re observing this round
          </DisplayHeading>
          <p className="mx-auto mt-2 max-w-sm text-sm text-felt-muted">
            Observers see the table and the reveal but don&rsquo;t play a card, so they never sway
            the estimate. Take a seat to join the next hand.
          </p>
          <Button variant="primary" className="mt-4" onClick={handleToggleRole}>
            Take a seat
          </Button>
        </Felt>
      )}

      {me?.role === 'voter' && (
        <Felt className="p-5 sm:p-6">
          <Kicker className="mb-3">Your vote</Kicker>
          <CardHand
            deck={state.deck}
            myVote={myPeerId ? activeItem?.votes[myPeerId] : undefined}
            disabled={!activeItem || state.revealed}
            onVote={(value) => getGuest()?.vote(value)}
          />
        </Felt>
      )}

      <ParticipantList state={state} isHost={false} onKick={() => { /* guests cannot kick */ }} />

      <ConnState mode="guest" terminal={terminal} connected onLeave={onLeave} />
    </main>
  );
}
