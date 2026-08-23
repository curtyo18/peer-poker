import { useEffect, useState } from 'react';
import type { AgendaItem, SessionState } from '../domain/types';
import { addItem, clearItems, editItem, setActive } from '../domain/hostActions';
import { itemLabel, urlPreview } from '../domain/ticket';
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

export function Agenda({ state, onMutate, className = '' }: AgendaProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const menu = useRowMenu();
  const doneCount = state.items.filter((i) => i.status === 'accepted').length;

  // The last row going means there is nothing left to clear, so the prompt has to close itself —
  // otherwise it hangs over an empty agenda offering to clear 0 items.
  useEffect(() => {
    if (state.items.length === 0) setConfirmingClear(false);
  }, [state.items.length]);

  // On the document rather than on the prompt: clicking the question's own text moves focus to the
  // panel container, an *ancestor* of the prompt, so a handler on the prompt would never see the
  // key. This is the rule useRowMenu already applies a few hundred pixels away — Escape closing
  // one thing in this panel and not the other is worse than either rule alone.
  useEffect(() => {
    if (!confirmingClear) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setConfirmingClear(false);
      menu.containerRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmingClear, menu.containerRef]);

  // Both exits land focus on the panel: the button that was focused unmounts either way, and
  // dropping a keyboard user at the top of the document is the worst possible answer to "are you
  // sure?" — see useRowMenu, which exists for the same reason.
  const cancelClear = () => {
    setConfirmingClear(false);
    menu.containerRef.current?.focus();
  };

  const clearAll = () => {
    onMutate(clearItems);
    setConfirmingClear(false);
    menu.containerRef.current?.focus();
  };

  // Either field alone is enough — the point of the link-first form is that a run of pasted
  // tickets becomes an agenda without a word being typed.
  const canAdd = Boolean(title.trim() || url.trim());

  const handleAdd: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (!canAdd) return;
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
    setEditTitle(item.title ?? '');
    setEditUrl(item.url ?? '');
    menu.close();
  };

  const canSaveEdit = Boolean(editTitle.trim() || editUrl.trim());

  const saveEdit: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (!editingItemId || !canSaveEdit) return;
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
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-xs text-muted">
              {doneCount} / {state.items.length} done
            </span>
            {state.items.length > 0 && !confirmingClear && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmingClear(true)}>
                Clear all
              </Button>
            )}
          </div>
        </div>

        {confirmingClear && (
          // Not a browser confirm() and not a modal: the thing being cleared is right there
          // underneath, and this keeps it in view while the question is answered. Deliberately not
          // an alertdialog — that promises a modal with a focus trap, which this is not.
          <div
            role="group"
            aria-label="Confirm clearing the agenda"
            // The question carries the count and the cost, so it is what the group is described by
            // — otherwise the focused Cancel button announces neither.
            aria-describedby="agenda-clear-cost"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-border bg-surface-2 px-3.5 py-3"
          >
            <p id="agenda-clear-cost" className="m-0 text-[13.5px] text-fg-2">
              Clear all {state.items.length} {state.items.length === 1 ? 'item' : 'items'}?{' '}
              <span className="text-muted">
                This room won&rsquo;t bring them back next time.
              </span>
            </p>
            <div className="flex gap-2">
              {/* Focus lands here rather than on the destructive button: the second step exists to
                  make this a second decision, and a focused "Clear" that Enter would fire hands
                  back the accident the confirmation was added to prevent. */}
              <Button autoFocus variant="secondary" size="sm" onClick={cancelClear}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={clearAll}>
                Clear all
              </Button>
            </div>
          </div>
        )}

        {/* Link first, title second: the fastest way to fill an agenda is to paste a run of
            tickets, and a required title would make every one of them a typing job. */}
        <form className="mb-4" onSubmit={handleAdd}>
          <div className="rounded-xl bg-input-bg p-2.5">
            <div className={fieldClass}>
              <label className="sr-only" htmlFor="agenda-url">
                Reference link
              </label>
              <input
                id="agenda-url"
                className={`${inputClass} ${monoClass} w-full`}
                placeholder="Paste a link — https://jira…/browse/PROJ-241"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <div className={`${fieldClass} flex-1`}>
                <label className="sr-only" htmlFor="agenda-title">
                  Item title (optional)
                </label>
                <input
                  id="agenda-title"
                  className={`${inputClass} w-full`}
                  placeholder="Custom title (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <Button type="submit" variant="primary" disabled={!canAdd}>
                Add
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Paste a ticket link and press Enter — the row names itself from the issue key, and the
            title everyone sees links straight to the ticket. Add a custom title only when the
            link doesn&rsquo;t speak for itself.
          </p>
        </form>

        <ol className="flex flex-col gap-2.5">
          {state.items.map((item, index) => {
            const isActive = item.id === state.activeItemId;
            const label = itemLabel(item);
            // The second line repeats the link so two rows sharing a title stay tellable apart.
            // It is dropped when the label is already that same shorthand — an untitled non-ticket
            // link would otherwise print its url twice, once per line.
            const preview = item.url ? urlPreview(item.url) : null;
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
                      <label className="sr-only" htmlFor={`edit-url-${item.id}`}>
                        Reference URL for {label}
                      </label>
                      <input
                        id={`edit-url-${item.id}`}
                        // The menu item that opened this form has unmounted, so without an
                        // explicit focus the form the user asked for opens with focus nowhere.
                        // It lands on the link, which is the field the form leads with.
                        autoFocus
                        className={`${inputClass} ${monoClass} w-full`}
                        placeholder="Paste a link — https://jira…/browse/PROJ-241"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                      />
                    </div>
                    <div className={fieldClass}>
                      <label className="sr-only" htmlFor={`edit-title-${item.id}`}>
                        Title for {label}
                      </label>
                      <input
                        id={`edit-title-${item.id}`}
                        className={`${inputClass} w-full`}
                        placeholder="Custom title (optional)"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" variant="primary" size="sm" disabled={!canSaveEdit}>
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
                      {preview !== label && (
                        <div className={`mt-1 truncate text-[11px] text-muted ${monoClass}`}>
                          {preview ?? 'No reference link'}
                        </div>
                      )}
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
