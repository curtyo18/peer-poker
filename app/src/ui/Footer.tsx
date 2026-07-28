const REPO_URL = 'https://github.com/curtyo18/peer-poker';

export function Footer() {
  return (
    <footer className="mx-auto mt-10 max-w-[1200px] px-4 pb-8 text-center text-xs text-muted sm:px-6">
      <p>
        Open source &middot; no tracking &middot; no backend &middot;{' '}
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="underline hover:text-fg">
          GitHub
        </a>
      </p>
      <p className="mt-1">
        <a
          href={`${REPO_URL}/issues/new`}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-fg"
        >
          Spot an issue?
        </a>
      </p>
    </footer>
  );
}
