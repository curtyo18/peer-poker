import { describe, it, expect } from 'vitest';
import { itemLabel, ticketKey, urlPreview } from './ticket';

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

describe('urlPreview', () => {
  it('drops the scheme and keeps the query that tells two links apart', () => {
    expect(urlPreview('https://jira.acme.com/browse?id=PROJ-241')).toBe('jira.acme.com/browse?id=PROJ-241');
    expect(urlPreview('https://jira.acme.com/browse?id=PROJ-999')).toBe('jira.acme.com/browse?id=PROJ-999');
  });

  it('drops a bare root path rather than leaving a dangling slash', () => {
    expect(urlPreview('https://example.com/')).toBe('example.com');
  });

  it('falls back to the raw string for a url that will not parse', () => {
    expect(urlPreview('not a url')).toBe('not a url');
  });
});

describe('itemLabel', () => {
  it('prefers a title the host typed', () => {
    expect(itemLabel({ title: 'Checkout spike', url: 'https://acme.atlassian.net/browse/AB-1' }))
      .toBe('Checkout spike');
  });

  // The whole point of the link-first form: paste a ticket, get a row that names itself.
  it('names a bare ticket link by its issue key', () => {
    expect(itemLabel({ url: 'https://acme.atlassian.net/browse/AB-1' })).toBe('AB-1');
  });

  it('names a bare non-ticket link by its url shorthand', () => {
    expect(itemLabel({ url: 'https://example.com/docs/spec' })).toBe('example.com/docs/spec');
  });

  it('treats a whitespace-only title as no title at all', () => {
    expect(itemLabel({ title: '   ', url: 'https://acme.atlassian.net/browse/AB-1' })).toBe('AB-1');
  });

  it('falls back to (untitled) for an item with neither', () => {
    expect(itemLabel({})).toBe('(untitled)');
  });
});
