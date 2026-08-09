export type CardValue = string;

export interface Deck {
  id: string;
  name: string;
  values: CardValue[];
}

export interface Participant {
  peerId: string;
  name: string;
  role: 'voter' | 'observer';
  connected: boolean;
}

export type ItemStatus = 'pending' | 'voting' | 'revealed' | 'accepted';

export interface AgendaItem {
  id: string;
  title: string;
  /** Optional reference link, stored as given with a scheme prefixed if missing. ADR-0003. */
  url?: string;
  status: ItemStatus;
  votes: Record<string, CardValue>;
  acceptedEstimate: CardValue | null;
}

export interface SessionState {
  roomId: string;
  hostPeerId: string;
  deck: Deck;
  participants: Participant[];
  items: AgendaItem[];
  activeItemId: string | null;
  revealed: boolean;
}
