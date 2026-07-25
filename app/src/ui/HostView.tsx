import type { SessionState } from '../domain/types';
import { useSession } from '../store/session';
import { getHost } from '../net/live';
import { Agenda } from './Agenda';
import { RevealPanel } from './RevealPanel';
import { ParticipantList } from './ParticipantList';
import { ResultsExport } from './ResultsExport';
import { CardHand } from './CardHand';
import { Button, DisplayHeading, Felt, Kicker, Panel } from './primitives';

interface HostViewProps {
  state: SessionState;
  shareLink: string;
  roomCode: string | undefined;
  qrDataUrl: string | null;
  myPeerId: string;
  onLeave: () => void;
}

export function HostView({ state, shareLink, roomCode, qrDataUrl, myPeerId, onLeave }: HostViewProps) {
  const onMutate = (fn: (s: SessionState) => SessionState) => {
    useSession.getState().update(fn);
    getHost()?.broadcast();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).catch(() => { /* ignore */ });
  };

  const activeItem = state.items.find((i) => i.id === state.activeItemId) ?? null;

  const handleVote = (value: string) => {
    useSession.getState().dispatch({ type: 'castVote', value }, myPeerId);
    getHost()?.broadcast();
  };

  const handleEnd = () => {
    getHost()?.end();
    onLeave();
  };

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Kicker>Host console</Kicker>
        <DisplayHeading as="h2" className="mt-1 text-2xl sm:text-[28px]">
          Room {roomCode?.toUpperCase() ?? state.roomId}
        </DisplayHeading>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="flex flex-col gap-5">
          <Panel>
            <Kicker className="mb-1">Invite</Kicker>
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-3xl tracking-[.06em] text-accent">
                {roomCode?.toUpperCase() ?? state.roomId}
              </span>
            </div>
            <p className="break-all text-xs text-muted">{shareLink}</p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleCopyLink}>
                Copy link
              </Button>
              <Button variant="ghost" size="sm" onClick={onLeave}>
                Leave
              </Button>
            </div>
            {qrDataUrl && (
              <div className="flex flex-col items-center gap-2 pt-1">
                <div className="rounded-[14px] bg-white p-2.5 shadow-[0_12px_30px_-12px_rgba(0,0,0,.5)]">
                  <img src={qrDataUrl} alt="QR code for room link" width={140} height={140} />
                </div>
                <span className="text-xs text-muted">Scan to join on your phone</span>
              </div>
            )}
          </Panel>

          <Agenda state={state} onMutate={onMutate} />
          <ParticipantList state={state} isHost onKick={(peerId) => getHost()?.kick(peerId)} />
        </aside>

        <div className="flex flex-col gap-5">
          <RevealPanel state={state} isHost myPeerId={myPeerId} onMutate={onMutate} />

          {state.hostVotes && (
            <Felt className="p-5 sm:p-6">
              <Kicker className="mb-3">Your vote</Kicker>
              <CardHand
                deck={state.deck}
                myVote={activeItem?.votes[myPeerId]}
                disabled={!activeItem || state.revealed}
                onVote={handleVote}
              />
            </Felt>
          )}

          <ResultsExport state={state} onEnd={handleEnd} />
        </div>
      </div>
    </main>
  );
}
