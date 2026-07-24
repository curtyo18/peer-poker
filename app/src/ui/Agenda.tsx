import { useState } from 'react';
import type { SessionState } from '../domain/types';
import { addItem, setActive } from '../domain/hostActions';

const sectionClass = 'rounded-lg border border-border bg-muted p-4 space-y-3';
const inputClass = 'rounded border border-border bg-bg px-2 py-1 text-fg w-full';
const buttonClass =
  'rounded border border-border bg-bg px-3 py-1.5 text-sm text-fg hover:text-accent transition-colors';
const smallButtonClass =
  'rounded border border-border bg-bg px-2 py-0.5 text-xs text-fg hover:text-accent transition-colors';
const itemClass = 'rounded border border-border p-3 space-y-2';
const activeItemClass = 'rounded border-2 border-accent p-3 space-y-2';

interface AgendaProps {
  state: SessionState;
  onMutate: (fn: (s: SessionState) => SessionState) => void;
}

export function Agenda({ state, onMutate }: AgendaProps) {
  const [title, setTitle] = useState('');

  const handleAdd: React.FormEventHandler = (e) => {
    e.preventDefault();
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
    <section className={sectionClass}>
      <h2 className="text-lg font-semibold">Agenda</h2>

      <form className="flex items-end gap-2" onSubmit={handleAdd}>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm text-fg" htmlFor="agenda-title">
            Item title
          </label>
          <input
            id="agenda-title"
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <button type="submit" className={buttonClass}>
          Add item
        </button>
        <button type="button" className={buttonClass} onClick={handleQuickVote}>
          Quick vote
        </button>
      </form>

      <ol className="space-y-2">
        {state.items.map((item, index) => (
          <li key={item.id} className={item.id === state.activeItemId ? activeItemClass : itemClass}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{item.title || '(untitled)'}</span>
              <span className="text-xs text-fg">
                {item.status}
                {item.acceptedEstimate !== null && ` · ${item.acceptedEstimate}`}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={smallButtonClass} onClick={() => onMutate((s) => setActive(s, item.id))}>
                Vote on this
              </button>
              <button type="button" className={smallButtonClass} onClick={() => moveItem(index, -1)} disabled={index === 0}>
                Move up
              </button>
              <button
                type="button"
                className={smallButtonClass}
                onClick={() => moveItem(index, 1)}
                disabled={index === state.items.length - 1}
              >
                Move down
              </button>
              <button type="button" className={smallButtonClass} onClick={() => removeItem(item.id)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
