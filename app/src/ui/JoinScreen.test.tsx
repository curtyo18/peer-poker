import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JoinScreen } from './JoinScreen';
import { loadName } from '../store/persistence';

// The primary button is the one carrying the accent fill; `primitives` gives it to `variant="primary"`
// only, so it is how these tests tell "leads with" from "also offers".
const primaryClass = 'bg-accent-btn';

describe('JoinScreen', () => {
  // The first-time variant writes the name to localStorage, which outlives a render.
  afterEach(() => localStorage.clear());

  it('confirms a remembered name instead of asking for one', () => {
    render(<JoinScreen roomCode="FROG-42" storedName="Curt" onJoin={vi.fn()} />);
    expect(screen.getByText('Curt')).toBeInTheDocument();
    expect(screen.queryByLabelText(/what should we call you/i)).not.toBeInTheDocument();
  });

  it('asks for a name when the device has none', () => {
    render(<JoinScreen roomCode="FROG-42" storedName="" onJoin={vi.fn()} />);
    expect(screen.getByLabelText(/what should we call you/i)).toBeInTheDocument();
  });

  it('switches to the name field when the guest says it is not them', async () => {
    render(<JoinScreen roomCode="FROG-42" storedName="Curt" onJoin={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /not you/i }));
    expect(screen.getByLabelText(/what should we call you/i)).toBeInTheDocument();
  });

  it('joins as an observer without seating the guest', async () => {
    const onJoin = vi.fn();
    render(<JoinScreen roomCode="FROG-42" storedName="Curt" onJoin={onJoin} />);
    await userEvent.click(screen.getByRole('button', { name: /join as observer/i }));
    expect(onJoin).toHaveBeenCalledWith({ roomCode: 'FROG-42', name: 'Curt', role: 'observer' });
  });

  it('remembers a first-time name on this device and joins with it trimmed', async () => {
    const onJoin = vi.fn();
    render(<JoinScreen roomCode="FROG-42" storedName="" onJoin={onJoin} />);
    await userEvent.type(screen.getByLabelText(/what should we call you/i), '  Dana  ');
    await userEvent.click(screen.getByRole('button', { name: /join room/i }));
    expect(onJoin).toHaveBeenCalledWith({ roomCode: 'FROG-42', name: 'Dana', role: 'voter' });
    expect(loadName()).toBe('Dana');
  });

  it('submits the name field on Enter', async () => {
    const onJoin = vi.fn();
    render(<JoinScreen roomCode="FROG-42" storedName="" onJoin={onJoin} />);
    await userEvent.type(screen.getByLabelText(/what should we call you/i), 'Dana{Enter}');
    expect(onJoin).toHaveBeenCalledWith({ roomCode: 'FROG-42', name: 'Dana', role: 'voter' });
  });

  it('refuses to join on a blank name', async () => {
    const onJoin = vi.fn();
    render(<JoinScreen roomCode="FROG-42" storedName="" onJoin={onJoin} />);
    await userEvent.type(screen.getByLabelText(/what should we call you/i), '   {Enter}');
    expect(onJoin).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /join room/i })).toBeDisabled();
  });

  it('offers Join as the primary action and Observe alongside it', () => {
    localStorage.setItem('poker.seatPref', 'voter');
    render(<JoinScreen roomCode="FROG-42" storedName="Ana" onJoin={vi.fn()} />);
    expect(screen.getByRole('button', { name: /join room/i })).toHaveClass(primaryClass);
    expect(screen.getByRole('button', { name: /join as observer/i })).toBeInTheDocument();
  });

  it('does not promote Observe to primary when the stored preference is observer', async () => {
    localStorage.setItem('poker.seatPref', 'observer');
    const onJoin = vi.fn();
    render(<JoinScreen roomCode="FROG-42" storedName="Ana" onJoin={onJoin} />);
    const primary = screen.getByRole('button', { name: /join room/i });
    expect(primary).toHaveClass(primaryClass);
    expect(screen.getByRole('button', { name: /join as observer/i })).not.toHaveClass(primaryClass);
    await userEvent.click(primary);
    expect(onJoin).toHaveBeenCalledWith({ roomCode: 'FROG-42', name: 'Ana', role: 'voter' });
  });

  it('leads a first-time guest with Join even when the stored preference is observer', async () => {
    localStorage.setItem('poker.seatPref', 'observer');
    const onJoin = vi.fn();
    render(<JoinScreen roomCode="FROG-42" storedName="" onJoin={onJoin} />);
    expect(screen.getByRole('button', { name: /join room/i })).toHaveClass(primaryClass);
    expect(screen.getByRole('button', { name: /^observe/i })).not.toHaveClass(primaryClass);
    await userEvent.type(screen.getByLabelText(/what should we call you/i), 'Dana{Enter}');
    expect(onJoin).toHaveBeenCalledWith({ roomCode: 'FROG-42', name: 'Dana', role: 'voter' });
  });

  it('hints that the guest observed last time without changing the primary action', () => {
    localStorage.setItem('poker.seatPref', 'observer');
    render(<JoinScreen roomCode="FROG-42" storedName="Ana" onJoin={vi.fn()} />);
    expect(screen.getByText(/observed last time/i)).toBeInTheDocument();
  });

  it('shows no observed-last-time hint when the stored preference is voter', () => {
    localStorage.setItem('poker.seatPref', 'voter');
    render(<JoinScreen roomCode="FROG-42" storedName="Ana" onJoin={vi.fn()} />);
    expect(screen.queryByText(/observed last time/i)).not.toBeInTheDocument();
  });

  it('remembers the seat chosen on join', async () => {
    localStorage.setItem('poker.seatPref', 'voter');
    render(<JoinScreen roomCode="FROG-42" storedName="Ana" onJoin={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /join as observer/i }));
    expect(localStorage.getItem('poker.seatPref')).toBe('observer');
  });

  it('remembers the seat a first-time guest picks', async () => {
    render(<JoinScreen roomCode="FROG-42" storedName="" onJoin={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/what should we call you/i), 'Bo');
    await userEvent.click(screen.getByRole('button', { name: /^observe/i }));
    expect(localStorage.getItem('poker.seatPref')).toBe('observer');
  });
});
