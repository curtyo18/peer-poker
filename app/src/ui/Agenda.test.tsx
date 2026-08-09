import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Agenda } from './Agenda';
import type { AgendaItem, SessionState } from '../domain/types';
import { FIBONACCI } from '../domain/decks';

function emptyState(): SessionState {
  return {
    roomId: 'FROG-42',
    hostPeerId: 'host-1',
    deck: FIBONACCI,
    participants: [],
    items: [],
    activeItemId: null,
    revealed: false,
  };
}

function stateWith(items: Array<Partial<AgendaItem>>): SessionState {
  return {
    ...emptyState(),
    items: items.map((item, i) => ({
      id: `item-${i}`,
      title: item.title ?? '',
      url: item.url,
      status: item.status ?? 'pending',
      votes: item.votes ?? {},
      acceptedEstimate: item.acceptedEstimate ?? null,
    })),
  };
}

describe('Agenda', () => {
  it('adds an item with a reference url', async () => {
    const onMutate = vi.fn((fn) => fn(emptyState()));
    render(<Agenda state={emptyState()} onMutate={onMutate} />);
    await userEvent.type(screen.getByLabelText(/item title/i), 'Checkout spike');
    await userEvent.type(screen.getByLabelText(/reference link/i), 'jira.acme.com/browse/PROJ-241');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(onMutate.mock.results[0].value.items[0]).toMatchObject({
      title: 'Checkout spike', url: 'https://jira.acme.com/browse/PROJ-241',
    });
  });

  it('renders a linked title as an anchor and a plain one as text', () => {
    render(<Agenda state={stateWith([
      { title: 'Linked', url: 'https://a.test' }, { title: 'Plain' },
    ])} onMutate={vi.fn()} />);
    expect(screen.getByRole('link', { name: /linked/i })).toHaveAttribute('href', 'https://a.test');
    expect(screen.queryByRole('link', { name: /plain/i })).not.toBeInTheDocument();
  });

  it('keeps secondary actions behind the overflow menu', async () => {
    render(<Agenda state={stateWith([{ title: 'Item' }])} onMutate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /more actions/i }));
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('preserves the existing url when only the title is edited', async () => {
    const initial = stateWith([{ title: 'Original', url: 'https://a.test/ticket-1' }]);
    const onMutate = vi.fn((fn) => fn(initial));
    render(<Agenda state={initial} onMutate={onMutate} />);
    await userEvent.click(screen.getByRole('button', { name: /more actions/i }));
    await userEvent.click(screen.getByRole('button', { name: /edit item/i }));
    const titleInput = screen.getByLabelText(/title for Original/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Renamed');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onMutate.mock.results[0].value.items[0]).toMatchObject({
      title: 'Renamed', url: 'https://a.test/ticket-1',
    });
    expect(onMutate).toHaveBeenCalledTimes(1);
  });

  // The add form and an open edit form are on screen together, so their fields must not collide:
  // two controls sharing an accessible name are ambiguous to a screen reader and to getByLabelText.
  it('keeps the add fields addressable while a row is being edited', async () => {
    render(<Agenda state={stateWith([{ title: 'Original' }])} onMutate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /more actions/i }));
    await userEvent.click(screen.getByRole('button', { name: /edit item/i }));
    expect(screen.getByLabelText(/item title/i)).toHaveAttribute('id', 'agenda-title');
    expect(screen.getByLabelText(/reference link/i)).toHaveAttribute('id', 'agenda-url');
  });

  describe('the overflow menu', () => {
    const twoItems = () => stateWith([{ title: 'First' }, { title: 'Second' }]);

    it('closes on Escape', async () => {
      render(<Agenda state={twoItems()} onMutate={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: /more actions for First/i }));
      expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    });

    // The menu is tall enough to overlap the row below it, so a click there has to dismiss it —
    // otherwise it hangs over the list swallowing every subsequent click.
    it('closes on a click elsewhere in the agenda', async () => {
      render(<Agenda state={twoItems()} onMutate={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: /more actions for First/i }));
      await userEvent.click(screen.getByLabelText(/item title/i));
      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    });

    it('opens only one menu at a time', async () => {
      render(<Agenda state={twoItems()} onMutate={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: /more actions for First/i }));
      await userEvent.click(screen.getByRole('button', { name: /more actions for Second/i }));
      expect(screen.getByRole('button', { name: /more actions for First/i })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(1);
    });

    it('reorders through move up and leaves focus somewhere reachable', async () => {
      const initial = twoItems();
      const onMutate = vi.fn((fn) => fn(initial));
      render(<Agenda state={initial} onMutate={onMutate} />);
      await userEvent.click(screen.getByRole('button', { name: /more actions for Second/i }));
      await userEvent.click(screen.getByRole('button', { name: /move up/i }));
      expect(onMutate.mock.results[0].value.items.map((i: AgendaItem) => i.title)).toEqual([
        'Second',
        'First',
      ]);
      // The button that was clicked has unmounted; focus must not have fallen to <body>.
      expect(document.activeElement).not.toBe(document.body);
    });

    it('cannot move the first item up or the last item down', async () => {
      render(<Agenda state={twoItems()} onMutate={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: /more actions for First/i }));
      expect(screen.getByRole('button', { name: /move up/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /move down/i })).toBeEnabled();
    });

    it('removes an item and clears it as the active one', async () => {
      const initial = { ...twoItems(), activeItemId: 'item-0' };
      const onMutate = vi.fn((fn) => fn(initial));
      render(<Agenda state={initial} onMutate={onMutate} />);
      await userEvent.click(screen.getByRole('button', { name: /more actions for First/i }));
      await userEvent.click(screen.getByRole('button', { name: /remove/i }));
      expect(onMutate.mock.results[0].value).toMatchObject({
        items: [{ title: 'Second' }],
        activeItemId: null,
      });
      expect(document.activeElement).not.toBe(document.body);
    });
  });

  describe('the reference preview line', () => {
    it('keeps the query string so two links to the same path stay distinguishable', () => {
      render(
        <Agenda
          state={stateWith([
            { title: 'A', url: 'https://jira.acme.com/browse?id=PROJ-241' },
            { title: 'B', url: 'https://jira.acme.com/browse?id=PROJ-999' },
          ])}
          onMutate={vi.fn()}
        />,
      );
      expect(screen.getByText('jira.acme.com/browse?id=PROJ-241')).toBeInTheDocument();
      expect(screen.getByText('jira.acme.com/browse?id=PROJ-999')).toBeInTheDocument();
    });

    it('says so when an item has no link', () => {
      render(<Agenda state={stateWith([{ title: 'Plain' }])} onMutate={vi.fn()} />);
      expect(screen.getByText('No reference link')).toBeInTheDocument();
    });
  });
});
