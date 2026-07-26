import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CardValue, SessionState, Participant, AgendaItem } from '../domain/types';
import { FIBONACCI } from '../domain/decks';
import { reveal, skipItem } from '../domain/hostActions';
import { VotingStage } from './VotingStage';

interface Overrides {
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
    status: 'voting',
    votes: overrides.votes ?? { p1: '5' },
    acceptedEstimate: null,
  };
  const state: SessionState = {
    roomId: 'FROG-42',
    hostPeerId: 'host',
    hostVotes: true,
    deck: FIBONACCI,
    participants: overrides.participants ?? [
      { peerId: 'p1', name: 'Ana', role: 'voter', connected: true },
      { peerId: 'p2', name: 'Ben', role: 'voter', connected: true },
    ],
    items: [item],
    activeItemId: 'i1',
    revealed: false,
  };
  return { state, item, myPeerId: overrides.myPeerId ?? 'p1', onVote: vi.fn() };
}

const hostProps = (overrides: Overrides = {}) => ({
  ...base(overrides),
  role: 'host' as const,
  onMutate: vi.fn(),
});

const guestProps = (overrides: Overrides = {}) => ({
  ...base(overrides),
  role: 'guest' as const,
  terminal: overrides.terminal ?? null,
  onLeave: vi.fn(),
});

describe('VotingStage', () => {
  it('gives the host reveal and skip controls', () => {
    render(<VotingStage {...hostProps()} />);
    expect(screen.getByRole('button', { name: /reveal all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip item/i })).toBeInTheDocument();
  });

  // Rendering the right two buttons is worthless if they are wired to each other's action: a
  // "Reveal all" that ran skipItem would silently bin every vote in the round.
  it('wires reveal and skip to the actions they name', async () => {
    const props = hostProps();
    render(<VotingStage {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /reveal all/i }));
    expect(props.onMutate).toHaveBeenCalledWith(reveal);
    await userEvent.click(screen.getByRole('button', { name: /skip item/i }));
    expect(props.onMutate).toHaveBeenLastCalledWith(skipItem);
  });

  it('counts how many players the host is still waiting on', () => {
    render(<VotingStage {...hostProps({ votes: { p1: '5' } })} />);
    expect(screen.getByText('1 player still deciding.')).toBeInTheDocument();
  });

  // A host who chose not to play has no participant record at all — which is not the same as
  // being an observer, and must not be described as waiting for themselves.
  it('never tells a non-voting host to wait for the host', () => {
    render(<VotingStage {...hostProps({ votes: {}, participants: [], myPeerId: 'host' })} />);
    expect(screen.queryByText(/waiting for the host/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /card hand/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reveal all/i })).toBeInTheDocument();
  });

  it('gives a guest a status note and no host controls', () => {
    render(<VotingStage {...guestProps()} />);
    expect(screen.queryByRole('button', { name: /reveal all/i })).not.toBeInTheDocument();
    expect(screen.getByText(/your card's in/i)).toBeInTheDocument();
  });

  // Scoped to the roster: every voter's name legitimately appears twice on this screen, once in
  // the pill row and once under their played card, so an unscoped getByText is ambiguous.
  it('marks who has voted in the pill row', () => {
    render(<VotingStage {...guestProps({ votes: { p1: '5' } })} />);
    const roster = within(screen.getByRole('list', { name: /who has voted/i }));
    expect(roster.getByText('Ana').closest('li')).toHaveTextContent('voted');
    expect(roster.getByText('Ben').closest('li')).toHaveTextContent('still voting');
  });

  // A face-down card and a dashed slot look alike to a screen reader, so the row says it in words.
  it('says under each played card whether that player has played', () => {
    render(<VotingStage {...guestProps({ votes: { p1: '5' } })} />);
    const played = within(screen.getByRole('list', { name: /cards played/i }));
    expect(played.getByText('Ana').closest('li')).toHaveTextContent('card played');
    expect(played.getByText('Ben').closest('li')).toHaveTextContent('still thinking');
  });

  it('tells a kicked guest they were removed, instead of showing a live-looking room', () => {
    render(<VotingStage {...guestProps({ terminal: 'kicked' })} />);
    expect(screen.getByRole('heading', { name: /removed/i })).toBeInTheDocument();
  });

  // A kick removes the participant, so the viewer has no seat. Saying "you're observing" over the
  // top of "you were removed" is worse than saying nothing about the round at all.
  it('does not describe the round to a guest who no longer has a seat', () => {
    const props = guestProps({ terminal: 'kicked', votes: {} });
    render(
      <VotingStage
        {...props}
        state={{ ...props.state, participants: props.state.participants.slice(1) }}
      />,
    );
    expect(screen.queryByText(/you're observing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/play a card/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /removed/i })).toBeInTheDocument();
  });

  it('flags a seated player who has dropped off, rather than showing them as thinking', () => {
    const props = hostProps({
      votes: {},
      participants: [
        { peerId: 'p1', name: 'Ana', role: 'voter', connected: true },
        { peerId: 'p2', name: 'Ben', role: 'voter', connected: false },
      ],
    });
    render(<VotingStage {...props} />);
    const roster = within(screen.getByRole('list', { name: /who has voted/i }));
    expect(roster.getByText('Ana').closest('li')).toHaveTextContent('still voting');
    expect(roster.getByText('Ben').closest('li')).toHaveTextContent('disconnected');
  });

  it('gives an observer no card hand, just the take-a-seat panel', () => {
    render(
      <VotingStage
        {...guestProps({
          votes: {},
          participants: [
            { peerId: 'p1', name: 'Ana', role: 'observer', connected: true },
            { peerId: 'p2', name: 'Ben', role: 'voter', connected: true },
          ],
        })}
      />,
    );
    expect(screen.queryByRole('group', { name: /card hand/i })).not.toBeInTheDocument();
    expect(screen.getByText(/observing this round/i)).toBeInTheDocument();
  });

  it('does not tell a voter they played when they have not', () => {
    render(<VotingStage {...guestProps({ votes: {} })} />);
    expect(screen.queryByText(/you played/i)).not.toBeInTheDocument();
    expect(screen.getByText(/play a card to join the round/i)).toBeInTheDocument();
  });

  it('votes when a card is clicked', async () => {
    const props = guestProps({ votes: {} });
    render(<VotingStage {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /play 8/i }));
    expect(props.onVote).toHaveBeenCalledWith('8');
  });
});
