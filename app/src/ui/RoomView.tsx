import type { CardValue, SessionState } from '../domain/types';
import { useSession } from '../store/session';
import { getGuest, getHost } from '../net/live';
import { ConnState } from './ConnState';
import { ConsoleStage } from './ConsoleStage';
import { VotingStage } from './VotingStage';
import { RevealStage } from './RevealStage';
import { panelClass } from './primitives';

interface RoomViewProps {
  role: 'host' | 'guest';
  state: SessionState | null;
  shareLink: string;
  roomCode: string | undefined;
  qrDataUrl: string | null;
  myPeerId: string | undefined;
  terminal: 'kicked' | 'ended' | 'unreachable' | 'not-found' | 'no-answer' | null;
  onHostRoom?: () => void;
  onLeave: () => void;
}

// RoomView is a stage router with three destinations: the console (no active item), voting (an
// active item, not revealed), and reveal (revealed). Each has its own stage component; this file
// just picks one and wires up the host/guest mutation closures they need.
export function RoomView(props: RoomViewProps) {
  const { role, state, shareLink, roomCode, qrDataUrl, myPeerId, terminal, onHostRoom, onLeave } = props;

  // A guest with no state yet is still connecting, or has hit a terminal state (kicked, ended,
  // unreachable, ...) before ever receiving one — this is what ParticipantView used to render.
  if (!state) {
    return (
      <main className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
        {terminal ? (
          <ConnState terminal={terminal} roomCode={roomCode} onHostRoom={onHostRoom} onLeave={onLeave} />
        ) : (
          <div className={`${panelClass} flex items-center justify-center`}>
            <ConnState terminal={null} onLeave={onLeave} />
          </div>
        )}
      </main>
    );
  }

  const active = state.items.find((i) => i.id === state.activeItemId) ?? null;

  // Every host mutation is the same two steps — apply locally, then tell the room — so the stages
  // below share one closure rather than each rebuilding it.
  const onMutate = (fn: (s: SessionState) => SessionState) => {
    useSession.getState().update(fn);
    getHost()?.broadcast();
  };

  if (active === null) {
    if (role === 'host') {
      const onKick = (peerId: string) => { getHost()?.kick(peerId); };
      // Tell the room it is over before tearing the peer down, or guests are left holding a
      // state for a host that has simply stopped answering.
      const onEnd = () => { getHost()?.end(); onLeave(); };
      return (
        <ConsoleStage
          role="host"
          state={state}
          roomCode={roomCode}
          shareLink={shareLink}
          qrDataUrl={qrDataUrl}
          onLeave={onLeave}
          onMutate={onMutate}
          onKick={onKick}
          onEnd={onEnd}
        />
      );
    }
    return (
      <ConsoleStage
        role="guest"
        state={state}
        roomCode={roomCode}
        myPeerId={myPeerId}
        terminal={terminal}
        onLeave={onLeave}
      />
    );
  }

  if (!state.revealed) {
    if (role === 'host') {
      const onVote = (value: CardValue) => {
        // App only renders RoomView with role="host" once myPeerId is assigned (see App.tsx's
        // `mode === 'host' && state && myPeerId` guard), so this is safely non-null here.
        useSession.getState().dispatch({ type: 'castVote', value }, myPeerId as string);
        getHost()?.broadcast();
      };
      return (
        <VotingStage role="host" state={state} item={active} myPeerId={myPeerId} onVote={onVote} onMutate={onMutate} />
      );
    }
    const onVote = (value: CardValue) => { getGuest()?.vote(value); };
    return (
      <VotingStage
        role="guest"
        state={state}
        item={active}
        myPeerId={myPeerId}
        onVote={onVote}
        terminal={terminal}
        onLeave={onLeave}
      />
    );
  }

  if (role === 'host') {
    const onVote = (value: CardValue) => {
      // App only renders RoomView with role="host" once myPeerId is assigned (see App.tsx's
      // `mode === 'host' && state && myPeerId` guard), so this is safely non-null here.
      useSession.getState().dispatch({ type: 'castVote', value }, myPeerId as string);
      getHost()?.broadcast();
    };
    // Tell the room it is over before tearing the peer down, or guests are left holding a
    // state for a host that has simply stopped answering.
    const onEnd = () => { getHost()?.end(); onLeave(); };
    return (
      <RevealStage role="host" state={state} item={active} myPeerId={myPeerId} onVote={onVote} onMutate={onMutate} onEnd={onEnd} />
    );
  }
  const onVote = (value: CardValue) => { getGuest()?.vote(value); };
  return (
    <RevealStage
      role="guest"
      state={state}
      item={active}
      myPeerId={myPeerId}
      onVote={onVote}
      terminal={terminal}
      onLeave={onLeave}
    />
  );
}
