import { describe, it, expect } from 'vitest';
import { ticketKey } from './ticket';

describe('ticketKey', () => {
  it('reads the key off the end of a Jira browse url', () => {
    expect(ticketKey('https://acme.atlassian.net/browse/MYTHING-123')).toBe('MYTHING-123');
  });

  it('ignores a query string and a trailing slash', () => {
    expect(ticketKey('https://acme.atlassian.net/browse/PROJ-9?filter=42')).toBe('PROJ-9');
    expect(ticketKey('https://jira.internal/browse/PROJ-9/')).toBe('PROJ-9');
  });

  it('reads a board url that keeps the issue in the query', () => {
    expect(ticketKey('https://acme.atlassian.net/secure/RapidBoard.jspa?rapidView=1&selectedIssue=AB-7'))
      .toBe('AB-7');
  });

  it('uppercases a lowercased key', () => {
    expect(ticketKey('https://acme.atlassian.net/browse/mything-123')).toBe('MYTHING-123');
  });

  it('is null for a link that is not an issue', () => {
    expect(ticketKey('https://example.com/docs/some-page')).toBeNull();
    expect(ticketKey('https://example.com/')).toBeNull();
  });

  // The key shape alone is not enough — a blog slug can wear it too, so `/browse/` is required.
  it('is null for a slug that only looks like a key', () => {
    expect(ticketKey('https://example.com/blog/top-10')).toBeNull();
  });

  it('is null with no url, or one that will not parse', () => {
    expect(ticketKey(undefined)).toBeNull();
    expect(ticketKey('not a url')).toBeNull();
  });
});
