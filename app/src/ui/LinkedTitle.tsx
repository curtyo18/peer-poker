import { ticketKey } from '../domain/ticket';

export function LinkedTitle({ title, url }: { title: string; url?: string }) {
  if (!url) return <span className="text-fg">{title || '(untitled)'}</span>;
  const key = ticketKey(url);
  // One anchor, not a title link beside a key link: two adjacent links to the same href put two
  // entries in a screen reader's links list and read the "opens in a new tab" boilerplate twice.
  // The key is inside the link, so it still goes to the ticket.
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-fg no-underline hover:text-accent-soft">
      {title || '(untitled)'}
      {/* The gap is a margin rather than a leading space, so it survives independently of how
          the text nodes get normalised into the link's accessible name. */}
      {key !== null && <span className="ml-1 font-mono text-[0.82em] text-link">({key})</span>}{' '}
      <span className="text-link" aria-hidden="true">↗</span>
      <span className="sr-only"> (opens the reference link in a new tab)</span>
    </a>
  );
}
