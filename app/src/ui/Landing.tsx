import { useState } from 'react';
import type { Deck } from '../domain/types';
import { FIBONACCI } from '../domain/decks';
import { loadDecks, loadLastDeckId, loadName, saveLastDeckId, saveName } from '../store/persistence';
import { DeckManager } from './DeckManager';

const sectionClass = 'rounded-lg border border-border bg-muted p-4 space-y-3';
const inputClass = 'rounded border border-border bg-bg px-2 py-1 text-fg w-full';
const buttonClass =
  'rounded border border-border bg-bg px-3 py-1.5 text-sm text-fg hover:text-accent transition-colors';
const labelClass = 'text-sm text-fg';
const fieldClass = 'flex flex-col gap-1';

interface LandingProps {
  initialRoom?: string;
  onHost: (args: { deck: Deck; name: string; hostVotes: boolean }) => void;
  onJoin: (args: { roomId: string; name: string; role: 'voter' | 'observer' }) => void;
}

export function Landing({ initialRoom, onHost, onJoin }: LandingProps) {
  const [decks, setDecks] = useState<Deck[]>(() => loadDecks());
  const [deckManagerOpen, setDeckManagerOpen] = useState(false);

  const lastDeckId = loadLastDeckId() ?? FIBONACCI.id;
  const [hostDeckId, setHostDeckId] = useState(
    decks.some((d) => d.id === lastDeckId) ? lastDeckId : FIBONACCI.id,
  );
  const [hostName, setHostName] = useState(() => loadName());
  const [hostVotes, setHostVotes] = useState(true);

  const [joinName, setJoinName] = useState(() => loadName());
  const [joinRole, setJoinRole] = useState<'voter' | 'observer'>('voter');
  const [joinRoom, setJoinRoom] = useState(initialRoom ?? '');

  const closeDeckManager = () => {
    setDeckManagerOpen(false);
    setDecks(loadDecks());
  };

  const handleHostSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();
    const deck = decks.find((d) => d.id === hostDeckId) ?? FIBONACCI;
    saveName(hostName);
    saveLastDeckId(deck.id);
    onHost({ deck, name: hostName, hostVotes });
  };

  const handleJoinSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();
    saveName(joinName);
    onJoin({ roomId: joinRoom.trim(), name: joinName, role: joinRole });
  };

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <form className={sectionClass} onSubmit={handleHostSubmit}>
        <h2 className="text-lg font-semibold">Host a session</h2>
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="host-deck">Deck</label>
          <select
            id="host-deck"
            className={inputClass}
            value={hostDeckId}
            onChange={(e) => setHostDeckId(e.target.value)}
          >
            {decks.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="host-name">Your name</label>
          <input
            id="host-name"
            className={inputClass}
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            required
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="host-votes"
            type="checkbox"
            checked={hostVotes}
            onChange={(e) => setHostVotes(e.target.checked)}
          />
          <label className={labelClass} htmlFor="host-votes">I&rsquo;ll vote too</label>
        </div>
        <button type="submit" className={buttonClass}>Host</button>
      </form>

      <form className={sectionClass} onSubmit={handleJoinSubmit}>
        <h2 className="text-lg font-semibold">Join a session</h2>
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="join-room">Room code</label>
          <input
            id="join-room"
            className={inputClass}
            value={joinRoom}
            onChange={(e) => setJoinRoom(e.target.value)}
            required
          />
        </div>
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="join-name">Your name</label>
          <input
            id="join-name"
            className={inputClass}
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            required
          />
        </div>
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="join-role">Role</label>
          <select
            id="join-role"
            className={inputClass}
            value={joinRole}
            onChange={(e) => setJoinRole(e.target.value as 'voter' | 'observer')}
          >
            <option value="voter">Voter</option>
            <option value="observer">Observer</option>
          </select>
        </div>
        <button type="submit" className={buttonClass}>Join</button>
      </form>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold">Decks</h2>
        <button type="button" className={buttonClass} onClick={() => setDeckManagerOpen(true)}>
          Manage decks
        </button>
      </section>

      <DeckManager open={deckManagerOpen} onClose={closeDeckManager} />
    </main>
  );
}
