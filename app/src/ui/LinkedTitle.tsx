import { ticketKey } from '../domain/ticket';

export function LinkedTitle({ title, url }: { title: string; url?: string }) {
  if (!url) return <span className="text-fg">{title || '(untitled)'}</span>;
  const key = ticketKey(url);
  return (
    <>
      <a href={url} target="_blank" rel="noreferrer" className="text-fg no-underline hover:text-accent-soft">
        {title || '(untitled)'}
        {/* The arrow marks the last of the two links, so a title followed by a key does not
            grow a second one. Both go to the same place. */}
        {key === null && <> <span className="text-link" aria-hidden="true">↗</span></>}
        <span className="sr-only"> (opens the reference link in a new tab)</span>
      </a>
      {key !== null && (
        <>
          {' '}
          <span className="text-muted">(</span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[0.82em] text-link no-underline hover:underline"
          >
            {key}
            <span className="sr-only"> (opens the reference link in a new tab)</span>
          </a>
          <span className="text-muted">)</span>
        </>
      )}
    </>
  );
}
