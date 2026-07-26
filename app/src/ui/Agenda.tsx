import { useState } from 'react';
import type { AgendaItem, SessionState } from '../domain/types';
import { addItem, editItem, setActive } from '../domain/hostActions';
import { Button, DisplayHeading, Kicker, Panel, StatusDot, fieldClass, inputClass, monoClass } from './primitives';
import { LinkedTitle } from './LinkedTitle';
import {
  menuItemClass,
  menuItemDangerClass,
  menuPanelClass,
  menuTriggerClass,
  useRowMenu,
} from './rowMenu';

interface AgendaProps {
  state: SessionState;
  onMutate: (fn: (s: SessionState) => SessionState) => void;
  /** Applied to the panel itself — the console emphasises this one with a gold edge. */
  className?: string;
}

function itemDotTone(item: AgendaItem, isActive: boolean): 'success' | 'accent' | 'muted' {
  if (item.status === 'accepted') return 'success';
  if (isActive) return 'accent';
  return 'muted';
}

// The preview line exists to tell two rows apart at a glance, so it keeps the query string —
// `…/browse?id=PROJ-241` and `…/browse?id=PROJ-999` would otherwise collapse to one string. A
// stored url is only scheme-normalised, never validated (ADR-0003), so it can still fail to parse
// here even though it was accepted on the way in; the raw string is the honest fallback.
function urlPreview(url: string): string {
  try {
    const { host, pathname, search } = new URL(url);
    return `${host}${pathname === '/' ? '' : pathname}${search}`;
  } catch {
    return url;
  }
}

export function Agenda({ state, onMutate, className = '' }: AgendaProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const menu = useRowMenu();
  const doneCount = state.items.filter((i) => i.status === 'accepted').length;

  const handleAdd: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onMutate((s) => addItem(s, title, url));
    setTitle('');
    setUrl('');
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    onMutate((s) => {
      const next = index + dir;
      if (next < 0 || next >= s.items.length) return s;
      const items = [...s.items];
      [items[index], items[next]] = [items[next], items[index]];
      return { ...s, items };
    });
  };

  const removeItem = (id: string) => {
    onMutate((s) => ({
      ...s,
      items: s.items.filter((i) => i.id !== id),
      activeItemId: s.activeItemId === id ? null : s.activeItemId,
    }));
  };

  const startEdit = (item: AgendaItem) => {
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditUrl(item.url ?? '');
    menu.close();
  };

  const saveEdit: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (!editingItemId || !editTitle.trim()) return;
    // `url` is required-but-nullable on editItem, so the current draft is passed even when only
    // the title changed — otherwise a forgotten argument silently drops the item's link.
    onMutate((s) => editItem(s, editingItemId, editTitle, editUrl));
    setEditingItemId(null);
  };

  return (
    // tabIndex -1 so focus has somewhere to land after a menu action: the item that was focused,
    // and often the row anchoring it, both unmount — see useRowMenu.
    <div ref={menu.containerRef} tabIndex={-1} className="outline-none">
      <Panel className={className}>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <Kicker>Agenda</Kicker>
            <DisplayHeading as="h2" className="text-[20px]">
              What are we estimating?
            </DisplayHeading>
          </div>
          <span className="whitespace-nowrap text-xs text-muted">
            {doneCount} / {state.items.length} done
          </span>
        </div>

        <form className="mb-4" onSubmit={handleAdd}>
          <div className="rounded-xl bg-input-bg p-2.5">
            <div className={fieldClass}>
              <label className="sr-only" htmlFor="agenda-title">
                Item title
              </label>
              <input
                id="agenda-title"
                className={`${inputClass} w-full`}
                placeholder="Item title — what are you estimating?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <div className={`${fieldClass} flex-1`}>
                <label className="sr-only" htmlFor="agenda-url">
                  Reference link (optional)
                </label>
                <input
                  id="agenda-url"
                  className={`${inputClass} ${monoClass} w-full`}
                  placeholder="Reference link (optional) — https://jira…/PROJ-241"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <Button type="submit" variant="primary" disabled={!title.trim()}>
                Add
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Give the item a plain-text title. Add a reference URL and the title becomes a link
            everyone at the table can click — no ticket lookup needed.
          </p>
        </form>

        <ol className="flex flex-col gap-2.5">
          {state.items.map((item, index) => {
            const isActive = item.id === state.activeItemId;
            const label = item.title || 'untitled item';
            return (
              <li
                key={item.id}
                className={`rounded-xl border bg-surface-2 px-4 py-3.5 ${
                  isActive ? 'border-border-gold' : 'border-border'
                }`}
              >
                {editingItemId === item.id ? (
                  <form className="flex flex-col gap-2" onSubmit={saveEdit}>
                    <div className={fieldClass}>
                      <label className="sr-only" htmlFor={`edit-title-${item.id}`}>
                        Title for {label}
                      </label>
                      <input
                        id={`edit-title-${item.id}`}
                        // The menu item that opened this form has unmounted, so without an
                        // explicit focus the form the user asked for opens with focus nowhere.
                        autoFocus
                        className={`${inputClass} w-full`}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    </div>
                    <div className={fieldClass}>
                      <label className="sr-only" htmlFor={`edit-url-${item.id}`}>
                        Reference URL for {label}
                      </label>
                      <input
                        id={`edit-url-${item.id}`}
                        className={`${inputClass} ${monoClass} w-full`}
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" variant="primary" size="sm" disabled={!editTitle.trim()}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingItemId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <StatusDot tone={itemDotTone(item, isActive)} glow={false} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold">
                        <LinkedTitle title={item.title} url={item.url} />
                      </div>
                      <div className={`mt-1 truncate text-[11px] text-muted ${monoClass}`}>
                        {item.url ? urlPreview(item.url) : 'No reference link'}
                      </div>
                    </div>
                    {item.acceptedEstimate !== null && (
                      <span className="font-display text-accent">{item.acceptedEstimate}</span>
                    )}
                    <Button variant="primary" onClick={() => onMutate((s) => setActive(s, item.id))}>
                      Vote &rarr;
                    </Button>
                    <div
                      className="relative"
                      ref={menu.openId === item.id ? menu.menuRef : undefined}
                    >
                      <button
                        type="button"
                        aria-label={`More actions for ${label}`}
                        aria-haspopup="menu"
                        aria-expanded={menu.openId === item.id}
                        className={menuTriggerClass}
                        onClick={() => menu.toggle(item.id)}
                      >
                        ⋯
                      </button>
                      {menu.openId === item.id && (
                        <div className={menuPanelClass}>
                          <button
                            type="button"
                            className={menuItemClass}
                            onClick={() => startEdit(item)}
                          >
                            Edit item
                          </button>
                          <button
                            type="button"
                            className={menuItemClass}
                            disabled={index === 0}
                            onClick={() => {
                              moveItem(index, -1);
                              menu.close();
                            }}
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            className={menuItemClass}
                            disabled={index === state.items.length - 1}
                            onClick={() => {
                              moveItem(index, 1);
                              menu.close();
                            }}
                          >
                            Move down
                          </button>
                          <button
                            type="button"
                            className={menuItemDangerClass}
                            onClick={() => {
                              removeItem(item.id);
                              menu.close();
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {state.items.length === 0 && (
            <li className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-sm text-muted">
              No items yet &mdash; add one above.
            </li>
          )}
        </ol>
      </Panel>
    </div>
  );
}
