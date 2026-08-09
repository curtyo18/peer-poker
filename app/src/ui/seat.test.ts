import { describe, it, expect, vi, beforeEach } from 'vitest';
import { changeSeat, otherSeat } from './seat';

const host = { handleMessage: vi.fn(), broadcast: vi.fn() };
const guest = { changeRole: vi.fn() };
vi.mock('../net/live', () => ({
  getHost: () => host,
  getGuest: () => guest,
}));

beforeEach(() => {
  host.handleMessage.mockClear();
  guest.changeRole.mockClear();
});

describe('changeSeat', () => {
  it('routes a host through their own inbound path, so the room is told too', () => {
    changeSeat('observer', true, 'HOST');
    expect(host.handleMessage).toHaveBeenCalledWith('HOST', { type: 'changeRole', role: 'observer' });
    expect(guest.changeRole).not.toHaveBeenCalled();
  });

  it('sends a guest seat change over their connection to the host', () => {
    changeSeat('voter', false, 'p1');
    expect(guest.changeRole).toHaveBeenCalledWith('voter');
    expect(host.handleMessage).not.toHaveBeenCalled();
  });

  it('addresses the intent to the peer it was given, not the room', () => {
    changeSeat('observer', true, 'SOMEONE-ELSE');
    expect(host.handleMessage).toHaveBeenCalledWith(
      'SOMEONE-ELSE', { type: 'changeRole', role: 'observer' },
    );
  });
});

describe('otherSeat', () => {
  it('swaps a seat for the other one', () => {
    expect(otherSeat('voter')).toBe('observer');
    expect(otherSeat('observer')).toBe('voter');
  });
});
