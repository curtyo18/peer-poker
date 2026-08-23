import { useState } from 'react';
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
      title: item.title,
      url: item.url,
      status: item.status ?? 'pending',
      votes: item.votes ?? {},
      acceptedEstimate: item.acceptedEstimate ?? null,
    })),
  };
}

// Most cases here render a static state and assert on the mutation. Two of them are about what
// the panel does once that mutation comes back, which needs a parent that actually applies it.
function LiveAgenda({ initial }: { initial: SessionState }) {
  const [state, setState] = useState(initial);
  return <Agenda state={state} onMutate={(fn) => setState((s) => fn(s))} />;
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

  // Link-first: a run of pasted tickets should become an agenda without a word being typed.
  it('adds an item from a link alone, with no title typed', async () => {
    const onMutate = vi.fn((fn) => fn(emptyState()));
    render(<Agenda state={emptyState()} onMutate={onMutate} />);
    await userEvent.type(screen.getByLabelText(/reference link/i), 'jira.acme.com/browse/PROJ-241');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(onMutate.mock.results[0].value.items[0]).toMatchObject({
      title: undefined, url: 'https://jira.acme.com/browse/PROJ-241',
    });
  });

  it('refuses only the item that is blank on both fields', async () => {
    render(<Agenda state={emptyState()} onMutate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/item title/i), 'One-off');
    expect(screen.getByRole('button', { name: /^add$/i })).toBeEnabled();
  });

  // A row with no title of its own is named by its ticket key — once. The key also renders as a
  // suffix beside a real title, and printing both would read as "(PROJ-241) (PROJ-241)".
  it('names an untitled ticket row by its key, without doubling it', () => {
    render(<Agenda state={stateWith([{ url: 'https://acme.atlassian.net/browse/PROJ-241' }])} onMutate={vi.fn()} />);
    expect(screen.getByRole('link', { name: /PROJ-241/ })).toBeInTheDocument();
    expect(screen.queryByText('(PROJ-241)')).not.toBeInTheDocument();
    // The preview line still earns its place here — it says *which* Jira the key lives in.
    expect(screen.getByText('acme.atlassian.net/browse/PROJ-241')).toBeInTheDocument();
  });

  // Nothing to add: the label already is the url shorthand, so a preview line would print the
  // same string twice, one under the other.
  it('does not repeat the url under an untitled non-ticket row', () => {
    render(<Agenda state={stateWith([{ url: 'https://example.com/docs/spec' }])} onMutate={vi.fn()} />);
    expect(screen.getAllByText('example.com/docs/spec')).toHaveLength(1);
  });

  it('lets a titled row be edited down to a bare link', async () => {
    const initial = stateWith([{ title: 'Original', url: 'https://a.test/ticket-1' }]);
    const onMutate = vi.fn((fn) => fn(initial));
    render(<Agenda state={initial} onMutate={onMutate} />);
    await userEvent.click(screen.getByRole('button', { name: /more actions/i }));
    await userEvent.click(screen.getByRole('button', { name: /edit item/i }));
    await userEvent.clear(screen.getByLabelText(/title for Original/i));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onMutate.mock.results[0].value.items[0]).toMatchObject({
      title: undefined, url: 'https://a.test/ticket-1',
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

  describe('clear all', () => {
    it('is not offered when there is nothing to clear', () => {
      render(<Agenda state={emptyState()} onMutate={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
    });

    // Clearing now also drops the room's remembered copy, so it asks first — and says so.
    it('asks before clearing, naming the cost', async () => {
      render(<Agenda state={stateWith([{ title: 'First' }, { title: 'Second' }])} onMutate={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
      expect(screen.getByText(/clear all 2 items\?/i)).toBeInTheDocument();
      expect(screen.getByText(/won.t bring them back/i)).toBeInTheDocument();
    });

    it('leaves the agenda alone when the prompt is dismissed', async () => {
      const onMutate = vi.fn();
      render(<Agenda state={stateWith([{ title: 'First' }])} onMutate={onMutate} />);
      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onMutate).not.toHaveBeenCalled();
      expect(screen.queryByText(/won.t bring them back/i)).not.toBeInTheDocument();
    });

    // Escape has to work from wherever the pointer left focus, not only from the button the
    // prompt opened on — clicking the question's own text focuses the panel container, which is
    // an ancestor of the prompt, so a handler scoped to the prompt would never see the key.
    it('closes the prompt on Escape, wherever focus has landed', async () => {
      render(<Agenda state={stateWith([{ title: 'First' }])} onMutate={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByText(/won.t bring them back/i)).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
      await userEvent.click(screen.getByText(/clear all 1 item\?/i));
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByText(/won.t bring them back/i)).not.toBeInTheDocument();
    });

    // On the buttons, not only on the group around them: a description is computed per element,
    // so one that lives on the group is one the focused control never says.
    it('describes both answers by the sentence carrying the count and the cost', async () => {
      render(<Agenda state={stateWith([{ title: 'First' }])} onMutate={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
      const cost = /clear all 1 item\?.*won.t bring them back/i;
      expect(screen.getByRole('button', { name: /cancel/i })).toHaveAccessibleDescription(cost);
      expect(screen.getByRole('button', { name: /clear all/i })).toHaveAccessibleDescription(cost);
    });

    // Two document-level Escape handlers are live at once here; the innermost layer goes first.
    it('backs out of a row menu opened over the prompt without losing the prompt', async () => {
      render(<Agenda state={stateWith([{ title: 'First' }])} onMutate={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
      await userEvent.click(screen.getByRole('button', { name: /more actions/i }));
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
      expect(screen.getByText(/won.t bring them back/i)).toBeInTheDocument();

      await userEvent.keyboard('{Escape}');
      expect(screen.queryByText(/won.t bring them back/i)).not.toBeInTheDocument();
    });

    // Both exits unmount the focused button, and the answer to "are you sure?" must not be to
    // drop a keyboard user at the top of the document.
    it('keeps focus in the panel after either answer', async () => {
      const { unmount } = render(<LiveAgenda initial={stateWith([{ title: 'First' }])} />);
      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(document.activeElement).not.toBe(document.body);
      unmount();

      render(<LiveAgenda initial={stateWith([{ title: 'First' }])} />);
      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
      expect(document.activeElement).not.toBe(document.body);
    });

    // Otherwise the prompt hangs over an empty agenda offering to clear nothing.
    it('closes itself when the last row goes some other way', async () => {
      render(<LiveAgenda initial={stateWith([{ title: 'Only one' }])} />);
      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
      await userEvent.click(screen.getByRole('button', { name: /more actions/i }));
      await userEvent.click(screen.getByRole('button', { name: /remove/i }));
      expect(screen.queryByText(/won.t bring them back/i)).not.toBeInTheDocument();
      expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
    });

    // Enter on the freshly-opened prompt must not clear the agenda: the focused control is the
    // way out, not the destructive one.
    it('opens with the safe action focused', async () => {
      const onMutate = vi.fn();
      render(<Agenda state={stateWith([{ title: 'First' }])} onMutate={onMutate} />);
      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
      expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(onMutate).not.toHaveBeenCalled();
    });

    it('empties the agenda and the round on confirmation', async () => {
      const initial = {
        ...stateWith([{ title: 'First', status: 'voting' as const }, { title: 'Second' }]),
        activeItemId: 'item-0',
        revealed: true,
      };
      const onMutate = vi.fn((fn) => fn(initial));
      render(<Agenda state={initial} onMutate={onMutate} />);
      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
      // The header trigger gives way to the prompt, so "Clear all" is unambiguous here: while the
      // question is on screen the only button carrying that name is the one that answers it.
      await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
      expect(onMutate.mock.results[0].value).toMatchObject({
        items: [], activeItemId: null, revealed: false,
      });
    });
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
