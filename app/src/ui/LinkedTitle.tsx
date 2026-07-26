export function LinkedTitle({ title, url }: { title: string; url?: string }) {
  if (!url) return <span className="text-fg">{title || '(untitled)'}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-fg no-underline hover:text-accent-soft">
      {title || '(untitled)'} <span className="text-link" aria-hidden="true">↗</span>
      <span className="sr-only"> (opens the reference link in a new tab)</span>
    </a>
  );
}
