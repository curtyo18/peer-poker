import type { SessionState } from '../domain/types';
import { useSession } from '../store/session';
import { getHost } from '../net/live';
import { Agenda } from './Agenda';
import { RevealPanel } from './RevealPanel';
import { ParticipantList } from './ParticipantList';
import { ResultsExport } from './ResultsExport';
import { ConnState } from './ConnState';
import { CardHand } from './CardHand';

const mainClass = 'mx-auto flex max-w-2xl flex-col gap-4 p-4';
const sectionClass = 'rounded-lg border border-border bg-muted p-4 space-y-3';
const buttonClass =
  'rounded border border-border bg-bg px-3 py-1.5 text-sm text-fg hover:text-accent transition-colors';

interface HostViewProps {
  state: SessionState;
  shareLink: string;
  qrDataUrl: string | null;
  myPeerId: string;
  onLeave: () => void;
}

export function HostView({ state, shareLink, qrDataUrl, myPeerId, onLeave }: HostViewProps) {
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
    <main className={mainClass}>
      <section className={sectionClass}>
        <h2 className="text-lg font-semibold">Waiting for participants&hellip;</h2>
        <p className="break-all text-sm text-fg">{shareLink}</p>
        <div className="flex items-center gap-3">
          <button type="button" className={buttonClass} onClick={handleCopyLink}>
            Copy link
          </button>
          <button type="button" className={buttonClass} onClick={onLeave}>
            Leave
          </button>
        </div>
        {qrDataUrl && <img src={qrDataUrl} alt="QR code for room link" width={180} height={180} />}
        <ConnState mode="host" terminal={null} onLeave={onLeave} />
      </section>

      <Agenda state={state} onMutate={onMutate} />
      <RevealPanel state={state} isHost onMutate={onMutate} />
      <ParticipantList state={state} isHost onKick={(peerId) => getHost()?.kick(peerId)} />

      {state.hostVotes && (
        <section className={sectionClass}>
          <h2 className="text-lg font-semibold">Your vote</h2>
          <CardHand
            deck={state.deck}
            myVote={activeItem?.votes[myPeerId]}
            disabled={!activeItem || state.revealed}
            onVote={handleVote}
          />
        </section>
      )}

      <ResultsExport state={state} onEnd={handleEnd} />
    </main>
  );
}
