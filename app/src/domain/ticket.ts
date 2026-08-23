// A Jira-style issue key: an uppercase project prefix, a hyphen, a number. Matching on the shape
// rather than on the host keeps self-hosted and behind-the-VPN Jira working, and picks up the
// other trackers that borrowed the same convention.
const ISSUE_KEY = /^[A-Z][A-Z0-9]*-\d+$/;

/**
 * The issue key a reference link points at, or null. Read off the end of the path
 * (`…/browse/PROJ-123`) or, for a board link that keeps the issue in the query
 * (`…/RapidBoard.jspa?selectedIssue=PROJ-123`), off that parameter.
 *
 * A stored url is only scheme-normalised, never validated (ADR-0003), so parsing can fail here
 * even for a url that was accepted on the way in — that just means no key.
 */
export function ticketKey(url: string | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const selected = parsed.searchParams.get('selectedIssue')?.trim().toUpperCase();
  if (selected && ISSUE_KEY.test(selected)) return selected;

  // Anchored on `/browse/`, which every Jira deployment serves issues under, rather than on any
  // trailing key-shaped segment — `example.com/blog/top-10` is a slug, not TOP-10.
  const segments = parsed.pathname.split('/').filter(Boolean);
  const browse = segments.lastIndexOf('browse');
  if (browse === -1) return null;
  const last = segments[browse + 1]?.toUpperCase();
  return last && ISSUE_KEY.test(last) ? last : null;
}

/**
 * The human-readable shorthand for a reference link: host + path + query, minus the scheme.
 *
 * Keeps the query string — `…/browse?id=PROJ-241` and `…/browse?id=PROJ-999` would otherwise
 * collapse to one string and two agenda rows would look identical. A stored url is only
 * scheme-normalised, never validated (ADR-0003), so parsing can fail here; the raw string is
 * the honest fallback.
 */
export function urlPreview(url: string): string {
  try {
    const { host, pathname, search } = new URL(url);
    return `${host}${pathname === '/' ? '' : pathname}${search}`;
  } catch {
    return url;
  }
}

/**
 * What to call an agenda item on screen.
 *
 * A title is optional (ADR-0008): pasting a ticket link alone is the fast path for building an
 * agenda, so an item with only a url still needs a name. The ticket key is the best one when the
 * link carries it, the url shorthand when it doesn't. Everything falls back to `(untitled)`,
 * because a blank one-off item is still allowed.
 */
export function itemLabel(item: { title?: string; url?: string }): string {
  const title = item.title?.trim();
  if (title) return title;
  const key = ticketKey(item.url);
  if (key) return key;
  if (item.url) return urlPreview(item.url);
  return '(untitled)';
}
