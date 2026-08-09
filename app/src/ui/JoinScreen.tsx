import { useState } from 'react';
import { loadSeatPref, saveName, saveSeatPref } from '../store/persistence';
import { Avatar, Button, Kicker, inputClass, monoClass } from './primitives';
import { otherSeat } from './seat';

type Seat = 'voter' | 'observer';

const seatLabel = (role: Seat) => (role === 'voter' ? 'Join room →' : 'Observe');

interface JoinScreenProps {
  roomCode: string;
  storedName: string;
  onJoin: (args: { roomCode: string; name: string; role: Seat }) => void;
}

export function JoinScreen({ roomCode, storedName, onJoin }: JoinScreenProps) {
  const [name, setName] = useState(() => storedName.trim());
  // Read once, at mount: the preference decides which action this screen leads with, and a value
  // that moved underneath it would reorder the buttons while someone was reaching for one.
  const [preferred] = useState<Seat>(() => loadSeatPref());

  // Every join goes through here so the seat is remembered wherever it was picked — the primary
  // action, the secondary, or the Enter key.
  const join = (joinedName: string, role: Seat) => {
    saveSeatPref(role);
    onJoin({ roomCode, name: joinedName, role });
  };

  return (
    <main
      className="mx-auto max-w-[940px] px-[26px] pt-6 pb-20"
      style={{ animation: 'var(--animate-ppfade)' }}
    >
      <div
        className="mx-auto max-w-[460px] rounded-[22px] border border-border-gold bg-surface px-[30px] py-[34px] text-center shadow-[0_24px_60px_rgba(0,0,0,.4)]"
      >
        <Kicker tone="muted" className="mb-3.5">
          You&rsquo;re about to join
        </Kicker>
        {/* The room code is what this page is *about*, so it carries the heading rather than
            being a styled div under no landmark at all. */}
        <h1
          className={`${monoClass} mb-1.5 break-all text-[30px] tracking-[.04em] text-accent-soft`}
        >
          {roomCode.toUpperCase()}
        </h1>
        <div className="mb-6 text-sm text-muted">Estimate together, reveal all at once.</div>

        {name ? (
          <KnownGuest
            name={name}
            preferred={preferred}
            onNotYou={() => setName('')}
            onJoin={(role) => join(name, role)}
          />
        ) : (
          <NewGuest
            preferred={preferred}
            onJoin={(joinedName, role) => join(joinedName, role)}
          />
        )}
      </div>
    </main>
  );
}

function KnownGuest({
  name,
  preferred,
  onNotYou,
  onJoin,
}: {
  name: string;
  preferred: Seat;
  onNotYou: () => void;
  onJoin: (role: Seat) => void;
}) {
  const alternative = otherSeat(preferred);
  return (
    <>
      <div className="mb-[18px] flex items-center gap-3 rounded-[14px] border border-border bg-input-bg p-3.5 text-left sm:p-4">
        <Avatar name={name} />
        <div>
          <div className="text-xs text-muted">Joining as</div>
          <div className="text-[17px] font-bold text-fg">{name}</div>
        </div>
      </div>
      <Button variant="primary" className="mb-3 w-full" onClick={() => onJoin(preferred)}>
        {seatLabel(preferred)}
      </Button>
      <div className="flex items-center justify-center gap-3 text-[13.5px]">
        <Button variant="ghost" size="sm" onClick={onNotYou}>
          Not you? Use a different name
        </Button>
        <span className="text-muted">&middot;</span>
        <Button variant="ghost" size="sm" onClick={() => onJoin(alternative)}>
          {alternative === 'observer' ? 'Join as observer' : 'Join as a player'}
        </Button>
      </div>
    </>
  );
}

function NewGuest({
  preferred,
  onJoin,
}: {
  preferred: Seat;
  onJoin: (name: string, role: Seat) => void;
}) {
  const [draftName, setDraftName] = useState('');
  const trimmedName = draftName.trim();
  const alternative = otherSeat(preferred);

  const submit = (role: Seat) => {
    if (!trimmedName) return;
    saveName(trimmedName);
    onJoin(trimmedName, role);
  };

  // A form, not a bare field: Enter submits everywhere else a name is typed in this app, and a
  // one-field screen where the keyboard does nothing is the worst place to break that. Enter takes
  // the preferred seat, the same one the primary button offers.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(preferred);
      }}
    >
      <div className="mb-4 text-left">
        <label htmlFor="join-name" className="mb-2 block text-[12.5px] font-semibold text-fg-2">
          What should we call you?
        </label>
        <input
          id="join-name"
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Your name"
          // `inputClass` already sets `border-border-strong`; appending `border-border-gold`
          // loses on source order, so the colour is overridden directly.
          className={`${inputClass} w-full text-[15px] [border-color:var(--color-border-gold)]`}
        />
        <span className="mt-2 block text-xs text-muted">
          We&rsquo;ll remember it on this device next time.
        </span>
      </div>
      <div className="mb-1.5 flex gap-2.5">
        <Button type="submit" variant="primary" className="flex-1" disabled={!trimmedName}>
          {seatLabel(preferred)}
        </Button>
        <Button variant="secondary" disabled={!trimmedName} onClick={() => submit(alternative)}>
          {seatLabel(alternative)}
        </Button>
      </div>
    </form>
  );
}
