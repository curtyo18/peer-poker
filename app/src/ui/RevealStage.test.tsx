import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CardValue, Deck, SessionState, Participant, AgendaItem } from '../domain/types';
import { FIBONACCI, TSHIRT } from '../domain/decks';
import { applyIntent } from '../domain/reducer';
import { RevealStage } from './RevealStage';

interface Overrides {
  deck?: Deck;
  votes?: Record<string, CardValue>;
  participants?: Participant[];
  myPeerId?: string;
  terminal?: 'kicked' | 'ended' | 'unreachable' | 'not-found' | 'no-answer' | null;
}

// Split by role rather than switched on a `role` override, so each helper's return type is the
// concrete branch of the union — a single helper returns the union and neither `onMutate` nor
// `terminal` narrows at the call site.
function base(overrides: Overrides) {
  const item: AgendaItem = {
    id: 'i1',
    title: 'Checkout spike',
    status: 'revealed',
    votes: overrides.votes ?? { p1: '5', p2: '5' },
    acceptedEstimate: null,
  };
  const state: SessionState = {
    roomId: 'FROG-42',
    hostPeerId: 'host',
    hostVotes: true,
    deck: overrides.deck ?? FIBONACCI,
    participants: overrides.participants ?? [
      { peerId: 'p1', name: 'Ana', role: 'voter', connected: true },
      { peerId: 'p2', name: 'Ben', role: 'voter', connected: true },
    ],
    items: [item],
    activeItemId: 'i1',
    revealed: true,
  };
  return { state, item, myPeerId: overrides.myPeerId ?? 'p1', onVote: vi.fn() };
}

const hostProps = (overrides: Overrides = {}) => ({
  ...base(overrides),
  role: 'host' as const,
  onMutate: vi.fn(),
  onEnd: vi.fn(),
});

const guestProps = (overrides: Overrides = {}) => ({
  ...base(overrides),
  role: 'guest' as const,
  terminal: overrides.terminal ?? null,
  onLeave: vi.fn(),
});

describe('RevealStage', () => {
  it('preselects the suggested value in the accept dropdown', () => {
    render(<RevealStage {...hostProps({ votes: { p1: '5', p2: '5', p3: '8' } })} />);
    expect(screen.getByLabelText(/accept/i)).toHaveValue('5');
  });

  it('shows the split verdict when the table disagrees', () => {
    render(<RevealStage {...guestProps({ votes: { p1: '3', p2: '13' } })} />);
    expect(screen.getByText(/split table/i)).toBeInTheDocument();
  });

  it('shows every voter’s card to a guest, not just their own', () => {
    render(<RevealStage {...guestProps({ votes: { p1: '3', p2: '13' } })} />);
    // showCorner duplicates the value (once as the corner index, once centred), so each value
    // legitimately matches twice within a single card — getAllByText, not getByText.
    const cards = within(screen.getByRole('list', { name: /revealed cards/i }));
    expect(cards.getAllByText('3').length).toBeGreaterThan(0);
    expect(cards.getAllByText('13').length).toBeGreaterThan(0);
  });

  it('keeps host controls away from guests', () => {
    render(<RevealStage {...guestProps()} />);
    expect(screen.queryByRole('button', { name: /end session/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-vote/i })).not.toBeInTheDocument();
  });

  // Agreement gets its own copy so it never gets mistaken for a split table.
  it('shows the consensus verdict when every vote matches', () => {
    render(<RevealStage {...guestProps({ votes: { p1: '5', p2: '5' } })} />);
    expect(screen.getByText(/consensus/i)).toBeInTheDocument();
    expect(screen.queryByText(/split table/i)).not.toBeInTheDocument();
  });

  it('shows both values in the MOST PICKED tile on a tie, never the jargon word', () => {
    render(<RevealStage {...guestProps({ votes: { p1: '5', p2: '8' } })} />);
    expect(screen.getByText('5 or 8')).toBeInTheDocument();
    expect(screen.getByText('MOST PICKED')).toBeInTheDocument();
    expect(screen.queryByText('MODE')).not.toBeInTheDocument();
  });

  // Same as the voting stage: the kicked guest's state still seats them, so the notice has to
  // replace the reveal rather than appear beneath a hand they can no longer play from.
  it('replaces the reveal for a kicked guest rather than sitting under it', () => {
    render(<RevealStage {...guestProps({ terminal: 'kicked' })} />);
    expect(screen.getByRole('heading', { name: /removed/i })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /card hand/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/you played/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /revealed cards/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to start/i })).toBeInTheDocument();
  });

  // A kick arrives as a prop change on an already-mounted stage, not as a fresh render, and that
  // is the path the app actually takes. (It does not pin the rules-of-hooks violation that used
  // to sit here: React's too-few-hooks check doesn't fire when a render produces zero hooks, so
  // this passed against the broken code too. The lint rule is what guards that, now via CI.)
  it('swaps a live reveal for the removal notice when the kick lands', () => {
    const props = guestProps({ votes: { p1: '5', p2: '8' } });
    const { rerender } = render(<RevealStage {...props} />);
    expect(screen.getByText(/the reveal/i)).toBeInTheDocument();
    rerender(<RevealStage {...props} terminal="kicked" />);
    expect(screen.getByRole('heading', { name: /removed/i })).toBeInTheDocument();
    expect(screen.queryByText(/the reveal/i)).not.toBeInTheDocument();
  });

  it('lets an observer take a seat, since votes are still open here', async () => {
    render(
      <RevealStage
        {...guestProps({
          votes: { p2: '5' },
          participants: [
            { peerId: 'p1', name: 'Ana', role: 'observer', connected: true },
            { peerId: 'p2', name: 'Ben', role: 'voter', connected: true },
          ],
        })}
      />,
    );
    expect(screen.getByText(/you're observing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /take a seat/i })).toBeInTheDocument();
  });

  it('accepts the chosen value and advances to the next pending item', async () => {
    const item2: AgendaItem = {
      id: 'i2', title: 'Second', status: 'pending', votes: {}, acceptedEstimate: null,
    };
    const props = hostProps({ votes: { p1: '5', p2: '5' } });
    const state: SessionState = { ...props.state, items: [props.item, item2] };
    const onMutate = vi.fn((fn: (s: SessionState) => SessionState) => fn(state));
    render(<RevealStage {...props} state={state} onMutate={onMutate} />);
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onMutate).toHaveBeenCalledTimes(1);
    const result = onMutate.mock.results[0].value as SessionState;
    expect(result.items[0]).toMatchObject({ status: 'accepted', acceptedEstimate: '5' });
    expect(result.activeItemId).toBe('i2');
  });

  it('lands the host back on the console after accepting the last item', async () => {
    const props = hostProps({ votes: { p1: '5', p2: '5' } });
    const onMutate = vi.fn((fn: (s: SessionState) => SessionState) => fn(props.state));
    render(<RevealStage {...props} onMutate={onMutate} />);
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
    const result = onMutate.mock.results[0].value as SessionState;
    expect(result.activeItemId).toBeNull();
    expect(result.revealed).toBe(false);
  });

  // Asserted through the resulting state rather than by identity, so rewriting the handler as
  // `onMutate((s) => revote(s))` — the same behaviour — doesn't fail the test.
  it('sends the round back to voting with the cards cleared', async () => {
    const props = hostProps({ votes: { p1: '5', p2: '5' } });
    const onMutate = vi.fn((fn: (s: SessionState) => SessionState) => fn(props.state));
    render(<RevealStage {...props} onMutate={onMutate} />);
    await userEvent.click(screen.getByRole('button', { name: /re-vote/i }));
    const result = onMutate.mock.results[0].value as SessionState;
    expect(result.revealed).toBe(false);
    expect(result.items[0]).toMatchObject({ status: 'voting', votes: {} });
  });

  // The copy on this screen promises the card can still be changed, so the vote has to survive
  // the whole way through the reducer — a wired-up click handler is not the same thing.
  it('still counts a card played after the reveal', async () => {
    const props = hostProps({ votes: { p1: '5', p2: '5' } });
    render(<RevealStage {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /play 8/i }));
    expect(props.onVote).toHaveBeenCalledWith('8');
    const after = applyIntent(props.state, { type: 'castVote', value: '8' }, 'p1');
    expect(after.items[0].votes).toEqual({ p1: '8', p2: '5' });
  });

  it('has no low/high tiles for an all-non-numeric table', () => {
    render(<RevealStage {...guestProps({ votes: { p1: '?', p2: '?' } })} />);
    expect(screen.queryByText('LOW')).not.toBeInTheDocument();
    expect(screen.queryByText('HIGH')).not.toBeInTheDocument();
    expect(screen.getByText('MOST PICKED')).toBeInTheDocument();
  });

  // Revealing an empty table is reachable — the host can hit "Reveal all" before anyone plays.
  // The dropdown must not offer to accept a number nobody chose.
  it('refuses to accept an estimate when nobody played a card', () => {
    render(<RevealStage {...hostProps({ votes: {} })} />);
    expect(screen.getByText(/no cards played/i)).toBeInTheDocument();
    expect(screen.queryByText(/split table/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/accept/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
  });

  // A host who chose not to play has no participant record at all, which is not the same as
  // being an observer — and neither is a guest who has just been removed.
  it('gives a viewer with no seat no card hand and no status line', () => {
    render(<RevealStage {...hostProps({ myPeerId: 'host', participants: [] })} />);
    expect(screen.queryByRole('group', { name: /card hand/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/you played/i)).not.toBeInTheDocument();
  });

  // A T-shirt round has no numeric votes at all, so there is no low and no high to report — but
  // there is still a most-picked size, and the reveal has to stand up rather than render tiles
  // with nothing in them.
  it('reveals a non-numeric round with a most-picked size and no range', () => {
    render(<RevealStage {...hostProps({ deck: TSHIRT, votes: { p1: 'M', p2: 'M', p3: 'L' } })} />);
    const tile = screen.getByText('MOST PICKED').parentElement as HTMLElement;
    expect(within(tile).getByText('M')).toBeInTheDocument();
    expect(screen.queryByText('LOW')).not.toBeInTheDocument();
    expect(screen.queryByText('HIGH')).not.toBeInTheDocument();
    expect(screen.queryByText(/estimates run/i)).not.toBeInTheDocument();
  });

  it('offers the most-picked size as the estimate to accept', () => {
    render(<RevealStage {...hostProps({ deck: TSHIRT, votes: { p1: 'L', p2: 'L' } })} />);
    expect(screen.getByLabelText(/accept/i)).toHaveValue('L');
  });

});
