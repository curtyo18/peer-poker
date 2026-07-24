import { useRef } from 'react';

const buttonClass =
  'rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-fg hover:text-accent transition-colors';
const dialogClass =
  'max-w-md w-[90vw] rounded-lg border border-border bg-bg text-fg p-0 backdrop:bg-black/50';
const closeButtonClass =
  'rounded-full border border-border bg-muted px-3 py-1 text-sm text-fg hover:text-accent transition-colors';

export function PrivacyExplainer() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  const handleBackdropClick: React.MouseEventHandler<HTMLDialogElement> = (e) => {
    if (e.target === dialogRef.current) close();
  };

  return (
    <>
      <button type="button" className={buttonClass} onClick={open}>
        How does this work?
      </button>
      <dialog ref={dialogRef} className={dialogClass} onClick={handleBackdropClick}>
        <section className="p-5 space-y-3">
          <h2 className="text-lg font-semibold">How does this work? Where does my data go?</h2>
          <p>
            Nowhere. PeerPoker has no server storing your session. Your votes, ticket names, and
            results are sent directly between you and the other people in the room — peer-to-peer,
            browser to browser — and stay on your machines.
          </p>
          <p>
            The only thing that briefly involves an outside service is the initial
            &ldquo;introduction&rdquo; that lets your browsers find each other (like swapping phone
            numbers) — and even that never sees your votes or tickets, just the connection details.
          </p>
          <p>No accounts. No tracking. Nothing to delete afterwards, because nothing was ever stored.</p>
          <div className="flex justify-end">
            <button type="button" className={closeButtonClass} onClick={close}>
              Close
            </button>
          </div>
        </section>
      </dialog>
    </>
  );
}
