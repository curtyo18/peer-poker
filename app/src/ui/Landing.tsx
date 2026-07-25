import { useState } from 'react';
import type { Deck } from '../domain/types';
import { FIBONACCI } from '../domain/decks';
import { loadDecks, loadLastDeckId, loadName, saveLastDeckId, saveName } from '../store/persistence';
import { DeckManager } from './DeckManager';
import { PlayingCard } from './PlayingCard';
import { PrivacyExplainer } from './PrivacyExplainer';
import { Button, DisplayHeading, Felt, Kicker, inputClass, monoClass } from './primitives';

const fieldLabelClass = 'mb-2 block text-[12.5px] font-semibold text-fg-2';

// The visible half of the "I'll vote too" checkbox. The real input stays in the tab order as a
// `sr-only peer`, so every state this box paints is driven off the input rather than duplicated.
const checkboxBoxClass =
  'grid h-5 w-5 flex-none place-items-center rounded-[6px] border border-border-strong ' +
  'text-[13px] font-extrabold text-accent-fg transition-colors ' +
  'peer-checked:border-accent-btn peer-checked:bg-accent-btn ' +
  'peer-focus-visible:outline peer-focus-visible:outline-2 ' +
  'peer-focus-visible:outline-accent peer-focus-visible:outline-offset-2';

const HERO_CARDS = [
  { value: '3', rotate: -16, translateY: 10 },
  { value: '5', rotate: -8, translateY: 2 },
  { value: '8', rotate: 0, translateY: -4 },
  { value: '13', rotate: 8, translateY: 2 },
  { value: '?', rotate: 16, translateY: 10 },
];

// The handoff also gives the raised centre card a deeper shadow, which is not reproduced here:
// PlayingCard sets its own boxShadow for a face-up card after spreading this style, so passing
// one is dead code. The lift still reads from the translate and the z-index.
function HeroFan() {
  return (
    <div className="flex items-end" aria-hidden="true">
      {HERO_CARDS.map((c, i) => (
        <PlayingCard
          key={c.value}
          value={c.value}
          face="up"
          style={{
            width: 60,
            height: 84,
            fontSize: 22,
            marginLeft: i === 0 ? 0 : -10,
            transform: `rotate(${c.rotate}deg) translateY(${c.translateY}px)`,
            zIndex: c.rotate === 0 ? 2 : 1,
          }}
        />
      ))}
    </div>
  );
}

interface LandingProps {
  onHost: (args: { deck: Deck; name: string; hostVotes: boolean; roomName: string }) => void;
  /** A typed room code routes to the join screen; the landing page never joins directly. */
  onEnterCode: (code: string) => void;
  /** A prior host session on this device, offered directly above the host card. */
  resume?: { roomLabel: string; onResume: () => void; onDiscard: () => void };
}

export function Landing({ onHost, onEnterCode, resume }: LandingProps) {
  const [decks, setDecks] = useState<Deck[]>(() => loadDecks());
  const [deckManagerOpen, setDeckManagerOpen] = useState(false);

  const lastDeckId = loadLastDeckId() ?? FIBONACCI.id;
  const [hostDeckId, setHostDeckId] = useState(
    decks.some((d) => d.id === lastDeckId) ? lastDeckId : FIBONACCI.id,
  );
  const [hostName, setHostName] = useState(() => loadName());
  const [hostVotes, setHostVotes] = useState(true);
  const [roomName, setRoomName] = useState('');

  const [enterCode, setEnterCode] = useState('');

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

  const handleEnterCodeSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();
    const trimmed = enterCode.trim();
    if (!trimmed) return;
    onEnterCode(trimmed);
  };

  return (
    <main className="mx-auto max-w-[1080px] px-[26px] pt-10 pb-20" style={{ animation: 'var(--animate-ppfade)' }}>
      <div className="mb-[52px] grid items-center gap-11 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <Kicker>Anonymous planning poker</Kicker>
          <DisplayHeading as="h1" className="mt-4 text-[36px] leading-[1.02] sm:text-[52px]">
            Estimate together.
            <br />
            Reveal all at once.
          </DisplayHeading>
          <p className="mt-5 max-w-[430px] text-[17px] leading-[1.55] text-muted">
            No accounts, no anchoring, no loudest-voice-wins. Everyone plays a card face-down —
            the table turns over the moment the host says <em>reveal</em>.
          </p>
          <div className="mt-[22px] flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] text-muted">
            {/* The glyphs are decoration; read aloud they are punctuation noise in front of
                the only part of the note that carries meaning. */}
            <span><span aria-hidden="true">&#9824;</span> Play a card to join</span>
            <span><span aria-hidden="true">&#9678;</span> Hidden until reveal</span>
            <span><span aria-hidden="true">&#10022;</span> No sign-up</span>
          </div>
        </div>
        <div className="relative hidden h-[290px] lg:block">
          <Felt className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden p-0">
            <HeroFan />
            <div className="mt-[26px] text-center text-[11px] uppercase tracking-[.22em] text-felt-caption">
              The table awaits
            </div>
          </Felt>
        </div>
      </div>

      {resume && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface-2 px-[18px] py-3.5">
          <span className="text-sm text-fg">
            You have a prior host session for room &ldquo;{resume.roomLabel}&rdquo;.
          </span>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={resume.onResume}>
              Resume session
            </Button>
            <Button variant="secondary" size="sm" onClick={resume.onDiscard}>
              Discard
            </Button>
          </div>
        </div>
      )}

      <form
        className="rounded-[20px] border border-border-gold px-[34px] py-8 shadow-[0_24px_60px_rgba(0,0,0,.35)]"
        style={{ background: 'linear-gradient(180deg, var(--color-surface), var(--color-surface-2))' }}
        onSubmit={handleHostSubmit}
      >
        <div className="mb-[22px] flex items-baseline justify-between">
          <div>
            <Kicker>Host</Kicker>
            <DisplayHeading as="h2" className="mt-1 text-[30px]">
              Start a session
            </DisplayHeading>
          </div>
          <button
            type="button"
            className="text-[13px] font-semibold text-accent hover:text-accent-soft"
            onClick={() => setDeckManagerOpen(true)}
          >
            Manage decks
          </button>
        </div>

        <div className="mb-5 grid gap-[18px] sm:grid-cols-2">
          <div>
            <label className={fieldLabelClass} htmlFor="host-deck">Deck</label>
            <div className="relative">
              <select
                id="host-deck"
                className={`${inputClass} w-full pr-9`}
                value={hostDeckId}
                onChange={(e) => setHostDeckId(e.target.value)}
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted"
              >
                &#9662;
              </span>
            </div>
          </div>

          <div>
            <label className={fieldLabelClass} htmlFor="host-name">Your name</label>
            <input
              id="host-name"
              className={`${inputClass} w-full`}
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="mb-[18px]">
          <label className={fieldLabelClass} htmlFor="host-room-name">
            Room name <span className="font-normal text-muted">— optional, makes a reusable link</span>
          </label>
          <input
            id="host-room-name"
            className={`${inputClass} w-full uppercase tracking-[.08em]`}
            placeholder="e.g. FROG-42"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
        </div>

        <label className="mb-[22px] flex cursor-pointer items-center gap-2.5 text-[14.5px] text-fg-2" htmlFor="host-votes">
          <input
            id="host-votes"
            type="checkbox"
            className="peer sr-only"
            checked={hostVotes}
            onChange={(e) => setHostVotes(e.target.checked)}
          />
          <span aria-hidden="true" className={checkboxBoxClass}>
            {hostVotes && '✓'}
          </span>
          I&rsquo;ll vote too
        </label>

        <Button type="submit" variant="primary" className="w-full py-4 text-base">
          Start a session &rarr;
        </Button>
      </form>

      <form
        className="mt-4 flex flex-wrap items-center gap-4 rounded-[14px] border border-border bg-input-bg px-5 py-4"
        onSubmit={handleEnterCodeSubmit}
      >
        <div className="min-w-[230px] flex-1">
          {/* The eyebrow is the field's label, so it is one — the input's only other name would
              be its placeholder, which is not a label. */}
          <label
            htmlFor="enter-code"
            className="mb-[3px] block text-[11px] font-bold uppercase tracking-[.16em] text-muted"
          >
            Joining a session?
          </label>
          <div className="text-[13.5px] text-muted">
            You probably have an invite link — just open it. Or enter a code:
          </div>
        </div>
        <input
          id="enter-code"
          className={`${inputClass} ${monoClass} w-[150px]`}
          placeholder="FROG-42"
          value={enterCode}
          onChange={(e) => setEnterCode(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={enterCode.trim() === ''}>
          Join
        </Button>
      </form>

      <div className="mt-8 text-center">
        <PrivacyExplainer />
      </div>

      <DeckManager open={deckManagerOpen} onClose={closeDeckManager} />
    </main>
  );
}
