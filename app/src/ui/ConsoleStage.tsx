import type { SessionState } from '../domain/types';
import { getGuest } from '../net/live';
import { Agenda } from './Agenda';
import { ConnState } from './ConnState';
import { ResultsExport } from './ResultsExport';
import { ShareBar } from './ShareBar';
import { TableCard } from './TableCard';
import { Badge, Button, DisplayHeading, Kicker, Panel, StatusDot } from './primitives';

type ConsoleStageProps =
  | {
      role: 'host';
      state: SessionState;
      roomCode: string | undefined;
      shareLink: string;
      qrDataUrl: string | null;
      onLeave: () => void;
      onMutate: (fn: (s: SessionState) => SessionState) => void;
      onKick: (peerId: string) => void;
      onEnd: () => void;
    }
  | {
      role: 'guest';
      state: SessionState;
      roomCode: string | undefined;
      myPeerId: string | undefined;
      /** A kick or an ended session leaves the last state in place, so the lobby must say so. */
      terminal: 'kicked' | 'ended' | 'unreachable' | 'not-found' | 'no-answer' | null;
      onLeave: () => void;
    };

const stepBadgeActiveClass =
  'grid h-6 w-6 flex-none place-items-center rounded-full bg-accent-btn text-xs font-extrabold text-accent-fg';
const stepBadgeMutedClass =
  'grid h-6 w-6 flex-none place-items-center rounded-full border border-border-gold text-xs font-extrabold text-muted';

const CHECKLIST_STEPS = [
  { title: 'Share the invite', body: 'Copy the link above or show the QR.' },
  { title: "Add what you're estimating", body: 'Paste tickets or type items — right here.' },
  { title: 'Start a round', body: "Hit 'Vote' on an item when everyone's in." },
];

export function ConsoleStage(props: ConsoleStageProps) {
  const { role, state, roomCode, onLeave } = props;
  const roomLabel = roomCode?.toUpperCase() ?? state.roomId;

  // Guest-only: identical to ParticipantView's role toggle, since the waiting lobby needs the
  // same "take a seat / observe instead" affordance before any item is active.
  const me =
    role === 'guest' && props.myPeerId
      ? state.participants.find((p) => p.peerId === props.myPeerId)
      : undefined;
  const handleToggleRole = () => {
    if (!me) return;
    getGuest()?.changeRole(me.role === 'observer' ? 'voter' : 'observer');
  };

  return (
    <main
      className="mx-auto max-w-[1120px] px-[26px] pt-[26px] pb-20"
      style={{ animation: 'var(--animate-ppfade)' }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <div>
            <Kicker>{role === 'host' ? 'Host console' : 'Room'}</Kicker>
            <DisplayHeading as="h2" className="text-2xl">
              Room <span className="font-mono text-accent-soft">{roomLabel}</span>
            </DisplayHeading>
          </div>
          <Badge tone="neutral">
            <StatusDot tone="success" /> live
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {role === 'host' && <ShareBar shareLink={props.shareLink} qrDataUrl={props.qrDataUrl} />}
          <Button variant="ghost" size="sm" onClick={onLeave}>
            Leave
          </Button>
        </div>
      </div>

      {role === 'host' ? (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.35fr]">
          <div className="flex flex-col gap-4">
            <Panel>
              <DisplayHeading as="h3" className="text-lg">
                Your table is live
              </DisplayHeading>
              <p className="mb-4 mt-1 text-[13.5px] text-muted">
                Three quick steps to your first round.
              </p>
              <ol className="flex flex-col gap-3.5">
                {CHECKLIST_STEPS.map((step, i) => (
                  <li key={step.title} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className={i === 0 ? stepBadgeActiveClass : stepBadgeMutedClass}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-[14.5px] font-semibold text-fg">{step.title}</div>
                      <div className="text-[12.5px] text-muted">{step.body}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
            <TableCard state={state} isHost onKick={props.onKick} />
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border-gold">
              <Agenda state={state} onMutate={props.onMutate} />
            </div>
            {/* A host who has finished every item lands back here, so ending the session and
                exporting what it produced have to be reachable without an active round. */}
            <ResultsExport state={state} onEnd={props.onEnd} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <TableCard state={state} isHost={false} />
          <Panel className="text-center">
            <p className="text-sm text-muted">Waiting for the host to start a round.</p>
            {me && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={handleToggleRole}>
                {me.role === 'observer' ? 'Take a seat' : '👁 Observe instead'}
              </Button>
            )}
          </Panel>
          {/* Being kicked or having the room closed does not clear the last state we were sent,
              so without this a removed guest waits in a dead lobby forever. */}
          <ConnState terminal={props.terminal} connected onLeave={onLeave} />
        </div>
      )}
    </main>
  );
}
