import type { SessionState } from '../domain/types';
import { getGuest } from '../net/live';
import { RevealPanel } from './RevealPanel';
import { ParticipantList } from './ParticipantList';
import { ConnState } from './ConnState';
import { CardHand } from './CardHand';

const mainClass = 'mx-auto flex max-w-2xl flex-col gap-4 p-4';
const sectionClass = 'rounded-lg border border-border bg-muted p-4 space-y-3';

interface ParticipantViewProps {
  state: SessionState | null;
  myPeerId: string | undefined;
  terminal: 'kicked' | 'ended' | 'unreachable' | null;
  onLeave: () => void;
}

const noop = () => { /* guests cannot mutate session state */ };

export function ParticipantView({ state, myPeerId, terminal, onLeave }: ParticipantViewProps) {
  if (!state && !terminal) {
    return (
      <main className={mainClass}>
        <section className={sectionClass}>
          <h2 className="text-lg font-semibold">Connecting&hellip;</h2>
        </section>
        <ConnState mode="guest" terminal={terminal} onLeave={onLeave} />
      </main>
    );
  }

  if (!state) {
    return (
      <main className={mainClass}>
        <ConnState mode="guest" terminal={terminal} onLeave={onLeave} />
      </main>
    );
  }

  const me = state.participants.find((p) => p.peerId === myPeerId);
  const activeItem = state.items.find((i) => i.id === state.activeItemId) ?? null;

  return (
    <main className={mainClass}>
      <section className={sectionClass}>
        <h2 className="text-lg font-semibold">{activeItem?.title || 'No item selected'}</h2>
      </section>

      <RevealPanel state={state} isHost={false} onMutate={noop} />
      <ParticipantList state={state} isHost={false} onKick={() => { /* guests cannot kick */ }} />

      {me?.role === 'voter' && (
        <section className={sectionClass}>
          <h2 className="text-lg font-semibold">Your vote</h2>
          <CardHand
            deck={state.deck}
            myVote={myPeerId ? activeItem?.votes[myPeerId] : undefined}
            disabled={!activeItem || state.revealed}
            onVote={(value) => getGuest()?.vote(value)}
          />
        </section>
      )}

      <ConnState mode="guest" terminal={terminal} onLeave={onLeave} />
    </main>
  );
}
