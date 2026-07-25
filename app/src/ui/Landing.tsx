import { useState } from 'react';
import type { Deck } from '../domain/types';
import { FIBONACCI } from '../domain/decks';
import { loadDecks, loadLastDeckId, loadName, saveLastDeckId, saveName } from '../store/persistence';
import { DeckManager } from './DeckManager';
import { PlayingCard } from './PlayingCard';
import {
  Button,
  DisplayHeading,
  Felt,
  Kicker,
  fieldClass,
  inputClass,
  labelClass,
  panelClass,
} from './primitives';

const HERO_VALUES = ['3', '5', '8', '13', '?'];

function HeroFan() {
  const center = (HERO_VALUES.length - 1) / 2;
  return (
    <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
      <div className="relative h-[170px] w-[300px]">
        {HERO_VALUES.map((v, i) => {
          const offset = i - center;
          return (
            <PlayingCard
              key={v}
              value={v}
              face="up"
              style={{
                position: 'absolute',
                left: '50%',
                bottom: 0,
                width: 70,
                height: 100,
                fontSize: 28,
                marginLeft: -35,
                transform: `translateX(${offset * 46}px) rotate(${offset * 8}deg) translateY(${
                  Math.abs(offset) ** 1.4 * 10
                }px)`,
                transformOrigin: 'bottom center',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

interface LandingProps {
  initialRoom?: string;
  onHost: (args: { deck: Deck; name: string; hostVotes: boolean; roomName: string }) => void;
  onJoin: (args: { roomCode: string; name: string; role: 'voter' | 'observer' }) => void;
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
  const [roomName, setRoomName] = useState('');

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
    onHost({ deck, name: hostName, hostVotes, roomName: roomName.trim() });
  };

  const handleJoinSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();
    saveName(joinName);
    onJoin({ roomCode: joinRoom.trim(), name: joinName, role: joinRole });
  };

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
      <div className="grid items-center gap-10 lg:min-h-[54vh] lg:grid-cols-[1.15fr_.85fr]">
        <div>
          <Kicker>Anonymous planning poker</Kicker>
          <DisplayHeading as="h1" className="mt-4 text-[36px] sm:text-[52px]">
            Estimate together.
            <br />
            Reveal all at once.
          </DisplayHeading>
          <p className="mt-4 max-w-[460px] text-base leading-relaxed text-muted sm:text-[17px]">
            No accounts, no anchoring, no loudest-voice-wins. Everyone plays a card face-down —
            the table turns over the moment the host says <em>reveal</em>.
          </p>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted">
            <span>🃏 Play a card to join</span>
            <span>👁 Votes stay hidden until reveal</span>
            <span>🕵 No sign-up</span>
          </div>
        </div>
        <div className="relative hidden h-[300px] lg:block">
          <Felt className="absolute inset-0 overflow-hidden p-0">
            <HeroFan />
            <div className="absolute inset-x-0 bottom-4 text-center text-[12px] uppercase tracking-[.14em] text-felt-muted">
              The table awaits
            </div>
          </Felt>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <form className={`${panelClass} space-y-4`} onSubmit={handleHostSubmit}>
          <div>
            <Kicker>Host</Kicker>
            <DisplayHeading as="h2" className="mt-1 text-2xl">
              Start a session
            </DisplayHeading>
          </div>

          <div className={fieldClass}>
            <div className="flex items-center justify-between">
              <label className={labelClass} htmlFor="host-deck">Deck</label>
              <button
                type="button"
                className="text-xs font-medium text-accent hover:underline"
                onClick={() => setDeckManagerOpen(true)}
              >
                Manage decks
              </button>
            </div>
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

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="host-room-name">
              Room name <span className="font-normal normal-case text-muted">(optional — makes a reusable link)</span>
            </label>
            <input
              id="host-room-name"
              className={`${inputClass} uppercase tracking-[.08em]`}
              placeholder="e.g. FROG-42"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-fg" htmlFor="host-votes">
            <input
              id="host-votes"
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={hostVotes}
              onChange={(e) => setHostVotes(e.target.checked)}
            />
            I&rsquo;ll vote too
          </label>

          <Button type="submit" variant="primary" className="w-full">
            Start a session
          </Button>
        </form>

        <form className={`${panelClass} space-y-4`} onSubmit={handleJoinSubmit}>
          <div>
            <Kicker>Join</Kicker>
            <DisplayHeading as="h2" className="mt-1 text-2xl">
              Join a session
            </DisplayHeading>
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="join-room">Room name or code</label>
            <input
              id="join-room"
              className={`${inputClass} text-lg uppercase tracking-[.1em]`}
              placeholder="FROG-42"
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
          <Button type="submit" variant="secondary" className="w-full">
            Join
          </Button>
        </form>
      </div>

      <DeckManager open={deckManagerOpen} onClose={closeDeckManager} />
    </main>
  );
}
