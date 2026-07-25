import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JoinScreen } from './JoinScreen';
import { loadName } from '../store/persistence';

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
});
