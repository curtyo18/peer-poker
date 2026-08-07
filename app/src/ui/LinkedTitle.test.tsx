import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LinkedTitle } from './LinkedTitle';

describe('LinkedTitle', () => {
  it('shows the issue key beside the title, linked to the ticket', () => {
    const url = 'https://acme.atlassian.net/browse/MYTHING-123';
    render(<LinkedTitle title="Custom item" url={url} />);
    const key = screen.getByRole('link', { name: /MYTHING-123/ });
    expect(key).toHaveAttribute('href', url);
    expect(screen.getByRole('link', { name: /Custom item/ })).toHaveAttribute('href', url);
  });

  it('leaves a non-ticket link as a plain linked title', () => {
    render(<LinkedTitle title="Checkout spike" url="https://example.com/docs" />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders an unlinked item as text', () => {
    render(<LinkedTitle title="Checkout spike" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
