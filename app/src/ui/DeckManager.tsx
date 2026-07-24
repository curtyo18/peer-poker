import { useEffect, useRef, useState } from 'react';
import type { Deck } from '../domain/types';
import { newDeck, validateDeck } from '../domain/decks';
import { loadDecks, saveDecks } from '../store/persistence';

const dialogClass =
  'max-w-lg w-[90vw] rounded-lg border border-border bg-bg text-fg p-0 backdrop:bg-black/50';
const inputClass = 'rounded border border-border bg-muted px-2 py-1 text-fg';
const buttonClass =
  'rounded border border-border bg-muted px-3 py-1.5 text-sm text-fg hover:text-accent transition-colors';
const smallButtonClass =
  'rounded border border-border bg-muted px-2 py-0.5 text-xs text-fg hover:text-accent transition-colors';
const chipClass = 'rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-fg';

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
      <section className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Manage decks</h2>
          <button type="button" className={buttonClass} onClick={onClose}>
            Close
          </button>
        </div>

        <ul className="space-y-2">
          {decks.map((deck) => {
            const readOnly = deck.id === 'builtin-fibonacci';
            const isEditing = editingId === deck.id;
            return (
              <li key={deck.id} className="rounded border border-border p-3 space-y-2">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`edit-name-${deck.id}`}>Name</label>
                      <input
                        id={`edit-name-${deck.id}`}
                        className={inputClass}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`edit-values-${deck.id}`}>Values (comma separated)</label>
                      <input
                        id={`edit-values-${deck.id}`}
                        className={inputClass}
                        value={editValues}
                        onChange={(e) => setEditValues(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className={smallButtonClass} onClick={() => saveEdit(deck.id)}>
                        Save
                      </button>
                      <button type="button" className={smallButtonClass} onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{deck.name}</span>
                      {!readOnly && (
                        <div className="flex gap-2">
                          <button type="button" className={smallButtonClass} onClick={() => startEdit(deck)}>
                            Edit
                          </button>
                          <button type="button" className={smallButtonClass} onClick={() => handleDelete(deck.id)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {deck.values.map((v, i) => (
                        <span key={`${deck.id}-${i}`} className={chipClass}>
                          {v}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        <div className="space-y-2 border-t border-border pt-4">
          <h3 className="font-medium">Add a deck</h3>
          <div className="flex flex-col gap-1">
            <label htmlFor="new-deck-name">Name</label>
            <input
              id="new-deck-name"
              className={inputClass}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleAddKeyDown}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="new-deck-values">Values (comma or Enter separated)</label>
            <input
              id="new-deck-values"
              className={inputClass}
              placeholder="e.g. XS, S, M, L, XL"
              value={newValues}
              onChange={(e) => setNewValues(e.target.value)}
              onKeyDown={handleAddKeyDown}
            />
          </div>
          {error && <p className="text-sm text-accent">{error}</p>}
          <button type="button" className={buttonClass} onClick={handleAdd}>
            Add deck
          </button>
        </div>
      </section>
    </dialog>
  );
}
