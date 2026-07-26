import { useRef } from 'react';
import { DisplayHeading, Kicker } from './primitives';

const triggerClass =
  'rounded-full border border-border-strong bg-input-bg px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-fg';
const dialogClass =
  'w-[90vw] max-w-[600px] rounded-2xl border border-border-gold bg-bg p-0 text-fg backdrop:bg-black/60';
const closeButtonClass =
  'rounded-full border border-border-strong bg-input-bg px-3 py-1.5 text-sm text-fg transition-colors hover:border-accent hover:text-accent';

const questions = [
  {
    icon: '🕸',
    q: 'Where do the votes actually go?',
    a: "Straight from player to player. PeerPoker connects your browsers directly (peer-to-peer) — there's no PeerPoker server in the middle collecting cards, names, or your ticket text. The table lives only in the browsers around it.",
  },
  {
    icon: '📡',
    q: 'Does anything touch a server at all?',
    a: 'Only the introduction. Two browsers can’t find each other on their own, so a matchmaking service passes along “here’s where to reach me”, and a second one (Google’s) helps each browser work out its own address from behind a router. Both are used just while you connect, and both see only network details — never a name, a card, or a word of what you’re estimating. All of that goes straight between you.',
  },
  {
    icon: '🂠',
    q: 'Are votes really hidden until reveal?',
    a: 'Yes. Until the host reveals, other players’ cards are simply not shared to your screen — you couldn’t peek early even if you tried. And you can change your card freely up to the reveal; only your latest one counts and no one is told you switched.',
  },
  {
    icon: '👁',
    q: 'What do observers see?',
    a: 'Observers watch the table fill and see the final reveal, but they hold no card, so they can’t nudge the estimate. Perfect for stakeholders who want to listen in.',
  },
  {
    icon: '🗑',
    q: 'How long do you keep any of this?',
    a: 'There’s nothing to keep — no database, no accounts, no tracking cookies. When everyone leaves, the room and every card in it are simply gone.',
  },
];

export function PrivacyExplainer() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  const handleBackdropClick: React.MouseEventHandler<HTMLDialogElement> = (e) => {
    if (e.target === dialogRef.current) close();
  };

  return (
    <>
      <button type="button" className={triggerClass} onClick={open}>
        How does this work?
      </button>
      <dialog ref={dialogRef} className={dialogClass} onClick={handleBackdropClick}>
        <section className="max-h-[85vh] overflow-y-auto p-6 sm:p-8">
          <div className="mb-6 text-center">
            <div aria-hidden="true" className="text-3xl">🕵</div>
            <DisplayHeading as="h2" className="mt-2 text-[26px] sm:text-[30px]">
              What we hide, and when
            </DisplayHeading>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              PeerPoker is built so estimates can&rsquo;t be anchored. Here&rsquo;s exactly how the
              hidden-until-reveal guarantee works.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {questions.map((item) => (
              <div key={item.q} className="flex gap-4 rounded-2xl border border-border bg-surface p-4">
                <div
                  aria-hidden="true"
                  className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[10px] border border-border bg-surface-2 text-xl"
                >
                  {item.icon}
                </div>
                <div>
                  <h3 className="mb-1 text-[15px] font-semibold text-fg">{item.q}</h3>
                  <p className="text-sm leading-relaxed text-muted">{item.a}</p>
                </div>
              </div>
            ))}
          </div>

          <Kicker tone="muted" className="mt-6 text-center normal-case tracking-normal text-xs">
            Peer-to-peer &middot; servers introduce you, then step out of the way &middot; no
            accounts, no cookies, no server storing your names or your cards.
          </Kicker>

          <div className="mt-6 flex justify-end">
            <button type="button" className={closeButtonClass} onClick={close}>
              Close
            </button>
          </div>
        </section>
      </dialog>
    </>
  );
}
