import { useEffect, useRef, useState } from 'react';
import type { Deck } from '../domain/types';
import { newDeck, validateDeck } from '../domain/decks';
import { loadDecks, saveDecks } from '../store/persistence';
import { PlayingCard } from './PlayingCard';
import { Badge, Button, DisplayHeading, fieldClass, inputClass, labelClass } from './primitives';

const dialogClass =
  'w-[92vw] max-w-3xl rounded-2xl border border-border bg-bg p-0 text-fg backdrop:bg-black/60';

interface DeckManagerProps {
  open: boolean;
  onClose: () => void;
}

function splitValues(raw: string): string[] {
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '');
}

export function DeckManager({ open, onClose }: DeckManagerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [decks, setDecks] = useState<Deck[]>(() => loadDecks());
  const [newName, setNewName] = useState('');
  const [newValues, setNewValues] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editValues, setEditValues] = useState('');

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      setDecks(loadDecks());
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  const handleBackdropClick: React.MouseEventHandler<HTMLDialogElement> = (e) => {
    if (e.target === dialogRef.current) onClose();
  };

  const persist = (next: Deck[]) => {
    setDecks(next);
    saveDecks(next);
  };

  const handleAdd = () => {
    const deck = newDeck(newName.trim(), splitValues(newValues));
    const err = validateDeck(deck);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    persist([...decks, deck]);
    setNewName('');
    setNewValues('');
  };

  const handleAddKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const startEdit = (deck: Deck) => {
    setEditingId(deck.id);
    setEditName(deck.name);
    setEditValues(deck.values.join(', '));
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditValues('');
  };

  const saveEdit = (id: string) => {
    const candidate: Deck = { id, name: editName.trim(), values: splitValues(editValues) };
    const err = validateDeck(candidate);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    persist(decks.map((d) => (d.id === id ? candidate : d)));
    cancelEdit();
  };

  const handleDelete = (id: string) => {
    persist(decks.filter((d) => d.id !== id));
    if (editingId === id) cancelEdit();
  };

  return (
    <dialog ref={dialogRef} className={dialogClass} onClick={handleBackdropClick} onClose={onClose}>
      <section className="max-h-[85vh] overflow-y-auto p-6 sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[.16em] text-accent">
              Deck manager
            </span>
            <DisplayHeading as="h2" className="mt-1 text-2xl sm:text-[28px]">
              Choose the cards on the table
            </DisplayHeading>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {decks.map((deck) => {
            const readOnly = deck.id === 'builtin-fibonacci';
            const isEditing = editingId === deck.id;
            return (
              <div
                key={deck.id}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className={fieldClass}>
                      <label className={labelClass} htmlFor={`edit-name-${deck.id}`}>Name</label>
                      <input
                        id={`edit-name-${deck.id}`}
                        className={inputClass}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div className={fieldClass}>
                      <label className={labelClass} htmlFor={`edit-values-${deck.id}`}>
                        Values (comma separated)
                      </label>
                      <input
                        id={`edit-values-${deck.id}`}
                        className={inputClass}
                        value={editValues}
                        onChange={(e) => setEditValues(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="primary" onClick={() => saveEdit(deck.id)}>
                        Save
                      </Button>
                      <Button size="sm" variant="secondary" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display text-lg">{deck.name}</h3>
                        <p className="mt-0.5 text-xs text-muted">{deck.values.length} cards</p>
                      </div>
                      {readOnly && <Badge tone="neutral">Built-in</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {deck.values.map((v, i) => (
                        <PlayingCard key={`${deck.id}-${i}`} value={v} face="up" size="sm" />
                      ))}
                    </div>
                    {!readOnly && (
                      <div className="mt-4 flex gap-2 border-t border-border pt-3">
                        <Button size="sm" variant="secondary" onClick={() => startEdit(deck)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(deck.id)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          <div className="flex min-h-[200px] flex-col justify-center gap-3 rounded-2xl border border-dashed border-border p-4">
            <div>
              <h3 className="text-sm font-semibold text-fg">+ Build a custom deck</h3>
              <p className="mt-0.5 text-xs text-muted">
                Any sequence of values — numbers, sizes, or your own symbols.
              </p>
            </div>
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="new-deck-name">Name</label>
              <input
                id="new-deck-name"
                className={inputClass}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleAddKeyDown}
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="new-deck-values">
                Values (comma or Enter separated)
              </label>
              <input
                id="new-deck-values"
                className={inputClass}
                placeholder="e.g. XS, S, M, L, XL"
                value={newValues}
                onChange={(e) => setNewValues(e.target.value)}
                onKeyDown={handleAddKeyDown}
              />
            </div>
            <Button size="sm" variant="primary" onClick={handleAdd}>
              Add deck
            </Button>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-danger-text" role="alert">
            {error}
          </p>
        )}
      </section>
    </dialog>
  );
}
