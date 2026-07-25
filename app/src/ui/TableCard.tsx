import { useEffect, useRef, useState } from 'react';
import type { SessionState } from '../domain/types';
import { Avatar, Badge, Kicker, Panel, StatusDot } from './primitives';

interface TableCardProps {
  state: SessionState;
  isHost: boolean;
  onKick?: (peerId: string) => void;
}

const rowClass = 'flex items-center gap-2.5 py-1.5';
const menuButtonClass =
  'rounded-lg border border-border px-2.5 py-1.5 text-muted transition-colors hover:text-fg';
const menuPanelClass =
  'absolute right-0 top-[calc(100%+6px)] z-20 min-w-[170px] rounded-[10px] border border-border ' +
  'bg-surface-2 p-1.5 shadow-[0_16px_40px_-8px_rgba(0,0,0,.5)]';
const menuItemClass =
  'w-full rounded-[7px] px-3 py-2 text-left text-[13.5px] text-danger-text transition-colors hover:bg-surface';

export function TableCard({ state, isHost, onKick }: TableCardProps) {
  const [openMenuPeerId, setOpenMenuPeerId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuPeerId) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenuPeerId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuPeerId(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuPeerId]);

  return (
    // tabIndex -1 so focus has somewhere to land after a kick: the menu item that was focused
    // and the row anchoring it both unmount, which would otherwise drop focus to <body>.
    <div ref={containerRef} tabIndex={-1} className="outline-none">
      <Panel>
        <div className="mb-3.5 flex items-baseline justify-between">
          <Kicker>Table</Kicker>
          <span className="text-xs text-muted">{state.participants.length} seated</span>
        </div>
        <ul className="flex flex-col">
          {state.participants.map((p) => {
            const isRoomHost = p.peerId === state.hostPeerId;
            const canKick = isHost && onKick && !isRoomHost;
            return (
              <li key={p.peerId} className={rowClass}>
                {/* A dropped guest keeps their seat until the host removes them, so the row has
                    to say which of the two a silent name is. */}
                <span className="relative inline-flex">
                  <Avatar name={p.name} />
                  <StatusDot
                    tone={p.connected ? 'success' : 'muted'}
                    glow={false}
                    className="absolute -bottom-0.5 -right-0.5 ring-2 ring-surface"
                  />
                </span>
                <span className="flex-1 truncate text-sm font-medium text-fg">
                  {p.name}
                  {!p.connected && <span className="sr-only"> (disconnected)</span>}
                </span>
                {p.role === 'observer' && <Badge tone="neutral">Observer</Badge>}
                {isRoomHost && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                    <StatusDot tone="success" glow={false} /> host
                  </span>
                )}
                {canKick && (
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={`More actions for ${p.name}`}
                      aria-haspopup="menu"
                      aria-expanded={openMenuPeerId === p.peerId}
                      className={menuButtonClass}
                      onClick={() =>
                        setOpenMenuPeerId((cur) => (cur === p.peerId ? null : p.peerId))
                      }
                    >
                      ⋯
                    </button>
                    {openMenuPeerId === p.peerId && (
                      <div className={menuPanelClass}>
                        <button
                          type="button"
                          className={menuItemClass}
                          onClick={() => {
                            onKick?.(p.peerId);
                            setOpenMenuPeerId(null);
                            containerRef.current?.focus();
                          }}
                        >
                          Remove from table
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {state.participants.length === 0 && (
            <li className="text-sm text-muted">Nobody&rsquo;s here yet.</li>
          )}
        </ul>
      </Panel>
    </div>
  );
}
