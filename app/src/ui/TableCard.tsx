import type { SessionState } from '../domain/types';
import { Avatar, Badge, Kicker, Panel, StatusDot } from './primitives';
import { menuItemDangerClass, menuPanelClass, menuTriggerClass, useRowMenu } from './rowMenu';

interface TableCardProps {
  state: SessionState;
  isHost: boolean;
  onKick?: (peerId: string) => void;
}

const rowClass = 'flex items-center gap-2.5 py-1.5';

export function TableCard({ state, isHost, onKick }: TableCardProps) {
  const menu = useRowMenu();

  return (
    // tabIndex -1 so focus has somewhere to land after a kick: the menu item that was focused
    // and the row anchoring it both unmount — see useRowMenu.
    <div ref={menu.containerRef} tabIndex={-1} className="outline-none">
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
                  <div
                    className="relative"
                    ref={menu.openId === p.peerId ? menu.menuRef : undefined}
                  >
                    <button
                      type="button"
                      aria-label={`More actions for ${p.name}`}
                      aria-haspopup="menu"
                      aria-expanded={menu.openId === p.peerId}
                      className={menuTriggerClass}
                      onClick={() => menu.toggle(p.peerId)}
                    >
                      ⋯
                    </button>
                    {menu.openId === p.peerId && (
                      <div className={menuPanelClass}>
                        <button
                          type="button"
                          className={menuItemDangerClass}
                          onClick={() => {
                            onKick?.(p.peerId);
                            menu.close();
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
