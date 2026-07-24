import type { SessionState } from '../domain/types';

const sectionClass = 'rounded-lg border border-border bg-muted p-4 space-y-3';
const rowClass = 'flex items-center justify-between gap-2 text-sm text-fg';
const smallButtonClass =
  'rounded border border-border bg-bg px-2 py-0.5 text-xs text-fg hover:text-accent transition-colors';

interface ParticipantListProps {
  state: SessionState;
  isHost: boolean;
  onKick: (peerId: string) => void;
}

export function ParticipantList({ state, isHost, onKick }: ParticipantListProps) {
  const active = state.items.find((i) => i.id === state.activeItemId) ?? null;

  return (
    <section className={sectionClass}>
      <h2 className="text-lg font-semibold">Participants</h2>
      <ul className="space-y-1">
        {state.participants.map((p) => {
          const voted = !state.revealed && active ? active.votes[p.peerId] !== undefined : false;
          return (
            <li key={p.peerId} className={rowClass}>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`inline-block h-2 w-2 rounded-full ${p.connected ? 'bg-accent' : 'bg-border'}`}
                />
                <span>
                  {p.name} · {p.role}
                </span>
                {voted && <span aria-label="voted">✓</span>}
              </span>
              {isHost && p.peerId !== state.hostPeerId && (
                <button type="button" className={smallButtonClass} onClick={() => onKick(p.peerId)}>
                  Kick
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
