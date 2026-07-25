import { useState } from 'react';
import type { AgendaItem, SessionState } from '../domain/types';
import { addItem, setActive } from '../domain/hostActions';
import { Button, Panel, SectionHeading, StatusDot, fieldClass, inputClass, labelClass } from './primitives';

interface AgendaProps {
  state: SessionState;
  onMutate: (fn: (s: SessionState) => SessionState) => void;
}

function itemDotTone(item: AgendaItem, isActive: boolean): 'success' | 'accent' | 'muted' {
  if (item.status === 'accepted') return 'success';
  if (isActive) return 'accent';
  return 'muted';
}

export function Agenda({ state, onMutate }: AgendaProps) {
  const [title, setTitle] = useState('');
  const doneCount = state.items.filter((i) => i.status === 'accepted').length;

  const handleAdd: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onMutate((s) => addItem(s, title));
    setTitle('');
  };

  const handleQuickVote = () => {
    onMutate((s) => {
      const s2 = addItem(s, '');
      return setActive(s2, s2.items[s2.items.length - 1].id);
    });
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

  return (
    <Panel>
      <SectionHeading
        title="Agenda"
        action={
          <span className="text-xs text-muted">
            {doneCount} / {state.items.length}
          </span>
        }
      />

      <form className="flex items-end gap-2" onSubmit={handleAdd}>
        <div className={`flex-1 ${fieldClass}`}>
          <label className={`sr-only ${labelClass}`} htmlFor="agenda-title">
            Item title
          </label>
          <input
            id="agenda-title"
            className={inputClass}
            placeholder="New agenda item&hellip;"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Add
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={handleQuickVote}>
          Quick vote
        </Button>
      </form>

      <ol className="space-y-1">
        {state.items.map((item, index) => {
          const isActive = item.id === state.activeItemId;
          const dimmed = item.status === 'pending' && !isActive;
          return (
            <li
              key={item.id}
              className={`rounded-[9px] border px-2.5 py-2 ${
                isActive ? 'border-border bg-surface-2' : 'border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <StatusDot tone={itemDotTone(item, isActive)} glow={false} />
                <span className={`flex-1 truncate text-sm ${dimmed ? 'text-muted' : 'text-fg'}`}>
                  {item.title || '(untitled)'}
                </span>
                {item.acceptedEstimate !== null && (
                  <span className="font-display text-accent">{item.acceptedEstimate}</span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => onMutate((s) => setActive(s, item.id))}>
                  Vote on this
                </Button>
                <Button size="sm" variant="ghost" onClick={() => moveItem(index, -1)} disabled={index === 0}>
                  Move up
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === state.items.length - 1}
                >
                  Move down
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)}>
                  Remove
                </Button>
              </div>
            </li>
          );
        })}
        {state.items.length === 0 && (
          <li className="rounded-[9px] border border-dashed border-border px-2.5 py-3 text-center text-sm text-muted">
            No items yet &mdash; add one above.
          </li>
        )}
      </ol>
    </Panel>
  );
}
