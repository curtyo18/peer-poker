import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CardValue, SessionState, Participant, AgendaItem } from '../domain/types';
import { FIBONACCI } from '../domain/decks';
import { reveal, skipItem } from '../domain/hostActions';
import { playNudgeChime } from '../audio/sound';
import { VotingStage } from './VotingStage';

vi.mock('../audio/sound', () => ({ playNudgeChime: vi.fn() }));

interface Overrides {
  votes?: Record<string, CardValue>;
  participants?: Participant[];
  myPeerId?: string;
  terminal?: 'kicked' | 'ended' | 'unreachable' | 'not-found' | 'no-answer' | null;
  nudgeSignal?: number;
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
  onNudge: vi.fn(),
});

const guestProps = (overrides: Overrides = {}) => ({
  ...base(overrides),
  role: 'guest' as const,
  terminal: overrides.terminal ?? null,
  nudgeSignal: overrides.nudgeSignal ?? 0,
  onLeave: vi.fn(),
});

/**
 * Deliver a nudge the way the app does: as the counter *changing* under a stage that is already
 * mounted and waiting.
 *
 * Mounting straight at `nudgeSignal: 1` is not the same thing and no longer stands in for it — a
 * fresh mount deliberately treats whatever signal it is born with as already spent, because the
 * stage is torn down and rebuilt on every reveal while the counter runs for the whole session.
 */
function nudgeGuest(overrides: Overrides = {}, signal = 1) {
  const view = render(<VotingStage {...guestProps({ ...overrides, nudgeSignal: 0 })} />);
  view.rerender(<VotingStage {...guestProps({ ...overrides, nudgeSignal: signal })} />);
  return view;
}

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

  // A kick closes the guest's connection before the host broadcasts the roster without them, so
  // their last state still seats them. The notice alone is not enough — the round has to go, or
  // they are left with a live-looking hand wired to a connection that is already gone.
  it('replaces the round for a kicked guest rather than sitting under it', () => {
    render(<VotingStage {...guestProps({ terminal: 'kicked', votes: { p1: '5' } })} />);
    expect(screen.getByRole('heading', { name: /removed/i })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /card hand/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/your card's in/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /who has voted/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to start/i })).toBeInTheDocument();
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

describe('VotingStage — nudging the people who have not voted', () => {
  const nudgeButton = () => screen.getByRole('button', { name: /^nudge/i });

  it('offers the host a nudge counting only the seated voters still holding a card', () => {
    render(<VotingStage {...hostProps()} />);
    expect(nudgeButton()).toHaveAccessibleName('Nudge 1 player who has not voted');
    expect(nudgeButton()).toHaveTextContent('Nudge unvoted (1)');
  });

  it('does not count observers among the unvoted', () => {
    render(
      <VotingStage
        {...hostProps({
          votes: { p1: '5' },
          participants: [
            { peerId: 'p1', name: 'Ana', role: 'voter', connected: true },
            { peerId: 'p2', name: 'Ben', role: 'observer', connected: true },
          ],
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: /^nudge/i })).not.toBeInTheDocument();
  });

  it('disappears once everybody has played', () => {
    render(<VotingStage {...hostProps({ votes: { p1: '5', p2: '8' } })} />);
    expect(screen.queryByRole('button', { name: /^nudge/i })).not.toBeInTheDocument();
  });

  it('is never offered to a guest', () => {
    render(<VotingStage {...guestProps({ votes: {} })} />);
    expect(screen.queryByRole('button', { name: /^nudge/i })).not.toBeInTheDocument();
  });

  it('sends the nudge and confirms who it went to', async () => {
    const props = hostProps();
    render(<VotingStage {...props} />);
    await userEvent.click(nudgeButton());

    expect(props.onNudge).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(/nudge sent to the 1 person/i);
  });

  // The guardrail: the confirmation's lifetime is the cooldown, so a host cannot spam-buzz.
  it('refuses a second nudge while the confirmation is still up', async () => {
    const props = hostProps();
    render(<VotingStage {...props} />);
    await userEvent.click(nudgeButton());
    expect(nudgeButton()).toBeDisabled();

    await userEvent.click(nudgeButton());
    expect(props.onNudge).toHaveBeenCalledTimes(1);
  });

  it('prompts a guest who still owes a card', () => {
    nudgeGuest({ votes: {}, myPeerId: 'p2' });
    const prompt = screen.getByText(/the host is waiting on your estimate/i);
    expect(prompt).toBeInTheDocument();
    expect(prompt.closest('[role="status"]')).not.toBeNull();
  });

  it('is ignored by a guest who has already played', () => {
    nudgeGuest({ votes: { p1: '5' }, myPeerId: 'p1' });
    expect(screen.queryByText(/waiting on your estimate/i)).not.toBeInTheDocument();
  });

  it('is ignored by an observer', () => {
    nudgeGuest({
      votes: {},
      myPeerId: 'p2',
      participants: [
        { peerId: 'p1', name: 'Ana', role: 'voter', connected: true },
        { peerId: 'p2', name: 'Ben', role: 'observer', connected: true },
      ],
    });
    expect(screen.queryByText(/waiting on your estimate/i)).not.toBeInTheDocument();
  });

  it('shows no prompt to a guest nobody has nudged', () => {
    render(<VotingStage {...guestProps({ votes: {}, myPeerId: 'p2' })} />);
    expect(screen.queryByText(/waiting on your estimate/i)).not.toBeInTheDocument();
  });
});

// The chime is addressed to exactly the same people as the banner. Whether it is audible at all is
// the sound module's business (see audio/sound.test.ts); what matters here is who it fires for.
describe('VotingStage nudge chime', () => {
  beforeEach(() => {
    vi.mocked(playNudgeChime).mockClear();
  });

  it('sounds for a guest who still owes a card', () => {
    nudgeGuest({ votes: {}, myPeerId: 'p2' });
    expect(playNudgeChime).toHaveBeenCalledTimes(1);
  });

  it('stays quiet for a guest who has already played', () => {
    nudgeGuest({ votes: { p1: '5' }, myPeerId: 'p1' });
    expect(playNudgeChime).not.toHaveBeenCalled();
  });

  it('stays quiet for an observer', () => {
    nudgeGuest({
      votes: {},
      myPeerId: 'p2',
      participants: [
        { peerId: 'p1', name: 'Ana', role: 'voter', connected: true },
        { peerId: 'p2', name: 'Ben', role: 'observer', connected: true },
      ],
    });
    expect(playNudgeChime).not.toHaveBeenCalled();
  });

  it('stays quiet for the host, who is the one doing the nudging', () => {
    render(<VotingStage {...hostProps({ votes: {}, myPeerId: 'host' })} />);
    expect(playNudgeChime).not.toHaveBeenCalled();
  });

  // `owesACard` is a dependency of the effect, so it re-runs the moment the player votes. Without
  // the guard that would chime a second time at someone who has just done what was asked.
  it('does not chime again when the nudged player finally votes', () => {
    const { rerender } = nudgeGuest({ votes: {}, myPeerId: 'p2' });
    expect(playNudgeChime).toHaveBeenCalledTimes(1);

    rerender(<VotingStage {...guestProps({ votes: { p2: '5' }, myPeerId: 'p2', nudgeSignal: 1 })} />);
    expect(playNudgeChime).toHaveBeenCalledTimes(1);
  });

  it('sounds again on a second, more insistent nudge', () => {
    const { rerender } = nudgeGuest({ votes: {}, myPeerId: 'p2' });
    rerender(<VotingStage {...guestProps({ votes: {}, myPeerId: 'p2', nudgeSignal: 2 })} />);
    expect(playNudgeChime).toHaveBeenCalledTimes(2);
  });

  it('stays quiet on a render that carries no nudge at all', () => {
    render(<VotingStage {...guestProps({ votes: {}, myPeerId: 'p2' })} />);
    expect(playNudgeChime).not.toHaveBeenCalled();
  });

  // The regression this guards, and the reason the refs are seeded with the current signal rather
  // than 0: `nudgeSignal` counts up for the whole session, but this component is torn down and
  // rebuilt on every reveal — RoomView swaps in RevealStage and back. A fresh mount that starts
  // counting from zero reads a nudge from three items ago as new, so a single nudge on the first
  // item chimed again at the top of every item after it.
  it('does not chime again when a later agenda item remounts the stage', () => {
    const { unmount } = nudgeGuest({ votes: {}, myPeerId: 'p2' });
    expect(playNudgeChime).toHaveBeenCalledTimes(1);
    unmount();

    render(<VotingStage {...guestProps({ votes: {}, myPeerId: 'p2', nudgeSignal: 1 })} />);
    expect(playNudgeChime).toHaveBeenCalledTimes(1);
  });

  it('shows no prompt on that remount either', () => {
    nudgeGuest({ votes: {}, myPeerId: 'p2' }).unmount();

    render(<VotingStage {...guestProps({ votes: {}, myPeerId: 'p2', nudgeSignal: 1 })} />);
    expect(screen.queryByText(/waiting on your estimate/i)).not.toBeInTheDocument();
  });
});

describe('VotingStage nudge animation', () => {
  // The regression this guards: replaying the animation by remounting with a React `key` threw
  // away the focused card button, so a nudge yanked the keyboard focus of the one person it was
  // addressed to — someone tabbing the deck, deciding. The animation-name parity trick restarts
  // the animation in place instead.
  it('leaves a keyboard user’s focus where they put it', () => {
    const { rerender } = render(
      <VotingStage {...guestProps({ votes: {}, myPeerId: 'p2', nudgeSignal: 0 })} />,
    );
    const card = screen.getByRole('button', { name: 'Play 5' });
    card.focus();
    expect(document.activeElement).toBe(card);

    rerender(<VotingStage {...guestProps({ votes: {}, myPeerId: 'p2', nudgeSignal: 1 })} />);

    // Same element object, not merely another button with the same name: a remount would replace it.
    expect(screen.getByRole('button', { name: 'Play 5' })).toBe(card);
    expect(document.activeElement).toBe(card);
  });

  it('alternates the animation name so a second nudge replays it', () => {
    const { rerender } = nudgeGuest({ votes: {}, myPeerId: 'p2' });
    // Read off the attribute rather than `style.animationName`: jsdom does not expand the
    // `animation` shorthand into its longhands, so the parsed property is empty either way.
    const hand = () => screen.getByRole('group', { name: /card hand/i }).parentElement;
    expect(hand()?.getAttribute('style')).toContain('ppnudge-shake-b');

    rerender(<VotingStage {...guestProps({ votes: {}, myPeerId: 'p2', nudgeSignal: 2 })} />);
    expect(hand()?.getAttribute('style')).toContain('ppnudge-shake-a');
  });
});
