import type { SessionState } from '../domain/types';
import { Avatar, Badge, Button, Panel, SectionHeading, StatusDot } from './primitives';

interface ParticipantListProps {
  state: SessionState;
  isHost: boolean;
  onKick: (peerId: string) => void;
}

export function ParticipantList({ state, isHost, onKick }: ParticipantListProps) {
  const active = state.items.find((i) => i.id === state.activeItemId) ?? null;
  const votingLive = active !== null && !state.revealed;

  return (
    <Panel>
      <SectionHeading
        title={
          <>
            Table &middot; <span className="font-normal text-muted">{state.participants.length} seated</span>
          </>
        }
      />
      <ul className="space-y-1.5">
        {state.participants.map((p) => {
          const voted = votingLive && active!.votes[p.peerId] !== undefined;
          return (
            <li key={p.peerId} className="flex items-center gap-2.5 py-0.5">
              <span className="relative inline-flex">
                <Avatar name={p.name} />
                <StatusDot
                  tone={p.connected ? 'success' : 'muted'}
                  glow={false}
                  className="absolute -bottom-0.5 -right-0.5 ring-2 ring-surface"
                />
              </span>
              <span className="flex-1 truncate text-sm text-fg">
                {p.name}
                {!p.connected && <span className="sr-only"> (disconnected)</span>}
              </span>
              {p.role === 'observer' && <Badge tone="neutral">Observer</Badge>}
              {votingLive && p.role === 'voter' && (
                <Badge tone={voted ? 'success' : 'neutral'}>{voted ? 'Ready' : 'Thinking'}</Badge>
              )}
              {isHost && p.peerId !== state.hostPeerId && (
                <Button size="sm" variant="ghost" onClick={() => onKick(p.peerId)}>
                  Kick
                </Button>
              )}
            </li>
          );
        })}
        {state.participants.length === 0 && (
          <li className="text-sm text-muted">Nobody&rsquo;s here yet.</li>
        )}
      </ul>
    </Panel>
  );
}
