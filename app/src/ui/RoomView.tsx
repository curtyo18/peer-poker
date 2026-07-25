import type { SessionState } from '../domain/types';
import { useSession } from '../store/session';
import { getHost } from '../net/live';
import { HostView } from './HostView';
import { ParticipantView } from './ParticipantView';
import { ConsoleStage } from './ConsoleStage';

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
// active item, not revealed), and reveal (revealed). Only the console has its own stage so far —
// VotingStage and RevealStage are later tasks and don't exist yet — so those two branches
// delegate to the pre-refresh HostView/ParticipantView, which already render those states
// correctly. Each later task replaces one delegation with its real stage and, once both are
// gone, deletes HostView/ParticipantView. Delegating here (rather than skipping the router
// entirely) keeps every intermediate commit shippable.
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

  if (active === null) {
    if (role === 'host') {
      const onMutate = (fn: (s: SessionState) => SessionState) => {
        useSession.getState().update(fn);
        getHost()?.broadcast();
      };
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

  // TODO(3.5/3.6): VotingStage and RevealStage replace these two delegations.
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
