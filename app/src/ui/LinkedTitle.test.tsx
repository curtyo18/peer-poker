import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LinkedTitle } from './LinkedTitle';

describe('LinkedTitle', () => {
  it('shows the issue key beside the title, linked to the ticket', () => {
    const url = 'https://acme.atlassian.net/browse/MYTHING-123';
    render(<LinkedTitle title="Custom item" url={url} />);
    const link = screen.getByRole('link', { name: /Custom item\s*\(MYTHING-123\)/ });
    expect(link).toHaveAttribute('href', url);
  });

  // One anchor, so the row contributes one entry to a screen reader's links list and reads the
  // new-tab boilerplate once, not twice.
  it('keeps the title and its key inside a single link', () => {
    render(<LinkedTitle title="Custom item" url="https://acme.atlassian.net/browse/AB-1" />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getAllByText(/opens the reference link/)).toHaveLength(1);
  });

  it('leaves a non-ticket link as a plain linked title', () => {
    render(<LinkedTitle title="Checkout spike" url="https://example.com/docs" />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText(/\(\w+-\d+\)/)).not.toBeInTheDocument();
  });

  // The new-tab arrow is the only visual cue that the title navigates; a ticket key must not
  // silently cost an item its affordance.
  it('keeps the new-tab arrow whether or not there is a key', () => {
    const { unmount } = render(<LinkedTitle title="A" url="https://acme.atlassian.net/browse/AB-1" />);
    expect(screen.getByText('↗')).toBeInTheDocument();
    unmount();
    render(<LinkedTitle title="A" url="https://example.com/docs" />);
    expect(screen.getByText('↗')).toBeInTheDocument();
  });

  it('renders an unlinked item as text', () => {
    render(<LinkedTitle title="Checkout spike" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
