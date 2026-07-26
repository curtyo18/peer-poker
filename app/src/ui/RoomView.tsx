import type { CardValue, SessionState } from '../domain/types';
import { useSession } from '../store/session';
import { getGuest, getHost } from '../net/live';
import { HostView } from './HostView';
import { ParticipantView } from './ParticipantView';
import { ConsoleStage } from './ConsoleStage';
import { VotingStage } from './VotingStage';

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
// active item, not revealed), and reveal (revealed). Console and voting have their own stages
// now — RevealStage is the remaining later task and doesn't exist yet — so the revealed branch
// still delegates to the pre-refresh HostView/ParticipantView, which already renders that state
// correctly. TODO(3.6) replaces that delegation with RevealStage and, once it's gone, deletes
// HostView/ParticipantView. Delegating here (rather than skipping the router entirely) keeps
// every intermediate commit shippable.
export function RoomView(props: RoomViewProps) {
  const { role, state, shareLink, roomCode, qrDataUrl, myPeerId, terminal, onHostRoom, onLeave } = props;

  // A guest with no state yet is still connecting (or has hit a terminal state);
  // ParticipantView already renders exactly that, including ConnState.
  if (!state) {
    return (
      <ParticipantView
        state={null}
        myPeerId={myPeerId}
        terminal={terminal}
        roomCode={roomCode}
        onHostRoom={onHostRoom}
        onLeave={onLeave}
      />
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

  // TODO(3.6): RevealStage replaces these two delegations.
  if (role === 'host') {
    // App only renders RoomView with role="host" once myPeerId is assigned (see App.tsx's
    // `mode === 'host' && state && myPeerId` guard), so this is safely non-null here.
    return (
      <HostView
        state={state}
        shareLink={shareLink}
        roomCode={roomCode}
        qrDataUrl={qrDataUrl}
        myPeerId={myPeerId as string}
        onLeave={onLeave}
      />
    );
  }
  return (
    <ParticipantView
      state={state}
      myPeerId={myPeerId}
      terminal={terminal}
      roomCode={roomCode}
      onHostRoom={onHostRoom}
      onLeave={onLeave}
    />
  );
}
