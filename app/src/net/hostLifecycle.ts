import type Peer from 'peerjs';

/**
 * Where a host's link to the signalling broker stands.
 *
 * This is deliberately *not* the same thing as "the room works". Established WebRTC data
 * channels are direct peer-to-peer and keep running with the broker gone; what a lost broker
 * costs is reachability — nobody new can join until it comes back.
 */
export type BrokerStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

/** A peer error we cannot recover from by waiting. */
export type BrokerFailure = 'id-taken' | 'rejected';

export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 30000;
export const RECONNECT_MAX_ATTEMPTS = 6;

/** 1s, 2s, 4s, 8s, 16s, then held at the cap. */
export function reconnectDelay(attempt: number): number {
  return Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
}

// Errors that mean "this peer is never going to work", as opposed to "the broker is having a
// moment". Anything not listed is treated as transient and left to the backoff.
const FATAL_ERRORS: Record<string, BrokerFailure> = {
  'unavailable-id': 'id-taken',
  'invalid-id': 'rejected',
  'invalid-key': 'rejected',
  'ssl-unavailable': 'rejected',
  'browser-incompatible': 'rejected',
};

interface PeerError {
  type?: string;
  message?: string;
}

interface HostLifecycleOptions {
  peer: Peer;
  /** Room code or id, for the console trail only. */
  label: string;
  onStatus: (status: BrokerStatus) => void;
  onFailure: (kind: BrokerFailure, detail: PeerError) => void;
}

export interface HostLifecycle {
  /** Reconnect now and reset the backoff — for a user-initiated retry. */
  retry: () => void;
  /** Stop reconnecting and drop the listeners. */
  cancel: () => void;
}

/**
 * Own the whole lifecycle of a host peer: reconnect with backoff when the broker drops us,
 * classify errors, and report a status the UI can render.
 *
 * The previous version of this lived inline in `App.tsx`, once per host entry point, and
 * reconnected immediately and forever on every `disconnected`. That is a tight loop against a
 * shared free service — plausibly a *cause* of continued refusal rather than only a symptom.
 */
export function attachHostLifecycle(
  { peer, label, onStatus, onFailure }: HostLifecycleOptions,
): HostLifecycle {
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const reconnect = () => {
    timer = null;
    if (cancelled || peer.destroyed) return;
    // Something else already brought it back; nothing to do.
    if (!peer.disconnected) {
      onStatus('online');
      return;
    }
    try {
      peer.reconnect();
    } catch {
      // Only a destroyed peer throws here, and a destroyed peer is not coming back.
      onStatus('offline');
    }
  };

  const schedule = () => {
    if (cancelled || peer.destroyed) return;
    // A pending attempt already covers this; re-arming on every event is how the old loop span.
    if (timer !== null) return;
    if (attempts >= RECONNECT_MAX_ATTEMPTS) {
      console.warn('[peerpoker] gave up reconnecting to the signalling broker', { label, attempts });
      onStatus('offline');
      return;
    }
    const delay = reconnectDelay(attempts);
    attempts += 1;
    console.warn('[peerpoker] lost the signalling broker — retrying', { label, attempt: attempts, delay });
    onStatus('reconnecting');
    timer = setTimeout(reconnect, delay);
  };

  const handleOpen = () => {
    attempts = 0;
    clearTimer();
    onStatus('online');
  };

  const handleDisconnected = () => schedule();

  const handleClose = () => {
    clearTimer();
    onStatus('offline');
  };

  const handleError = (err: unknown) => {
    const { type, message } = (err ?? {}) as PeerError;
    const fatal = type ? FATAL_ERRORS[type] : undefined;
    if (fatal) {
      console.error('[peerpoker] host peer rejected', { label, type, message });
      clearTimer();
      onFailure(fatal, { type, message });
      return;
    }
    // Transient: 'network', 'socket-error', 'socket-closed', 'server-error'. PeerJS usually
    // emits 'disconnected' alongside these, but not always, so back off from here too — the
    // pending-timer guard in schedule() keeps the two from compounding into a double retry.
    console.warn('[peerpoker] host peer error', { label, type, message });
    schedule();
  };

  peer.on('open', handleOpen);
  peer.on('disconnected', handleDisconnected);
  peer.on('close', handleClose);
  peer.on('error', handleError);

  return {
    retry: () => {
      if (cancelled) return;
      attempts = 0;
      clearTimer();
      onStatus('reconnecting');
      reconnect();
    },
    cancel: () => {
      cancelled = true;
      clearTimer();
      peer.off('open', handleOpen);
      peer.off('disconnected', handleDisconnected);
      peer.off('close', handleClose);
      peer.off('error', handleError);
    },
  };
}
