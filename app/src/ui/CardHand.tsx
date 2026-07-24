import type { CardValue, Deck } from '../domain/types';

const cardClass =
  'rounded border border-border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const selectedClass = 'bg-accent text-bg';
const unselectedClass = 'bg-muted text-fg hover:text-accent';

interface CardHandProps {
  deck: Deck;
  myVote: CardValue | undefined;
  disabled: boolean;
  onVote: (v: CardValue) => void;
}

export function CardHand({ deck, myVote, disabled, onVote }: CardHandProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Card hand">
      {deck.values.map((value) => (
        <button
          key={value}
          type="button"
          className={`${cardClass} ${value === myVote ? selectedClass : unselectedClass}`}
          disabled={disabled}
          aria-pressed={value === myVote}
          onClick={() => onVote(value)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
