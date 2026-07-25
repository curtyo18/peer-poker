import { useState } from 'react';
import type { CardValue, Deck } from '../domain/types';
import { PlayingCard } from './PlayingCard';

interface CardHandProps {
  deck: Deck;
  myVote: CardValue | undefined;
  disabled: boolean;
  onVote: (v: CardValue) => void;
}

export function CardHand({ deck, myVote, disabled, onVote }: CardHandProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const n = deck.values.length;
  const center = (n - 1) / 2;

  return (
    <div
      className="relative mx-auto h-[220px] w-full max-w-[460px] sm:h-[250px]"
      role="group"
      aria-label="Card hand"
    >
      {deck.values.map((value, i) => {
        const offset = i - center;
        const selected = value === myVote;
        const lifted = !disabled && !selected && hovered === value;

        const rotate = selected ? 0 : offset * 5.5;
        const tx = offset * 42;
        const restY = Math.abs(offset) ** 1.4 * 6.5;
        const ty = selected ? -30 : lifted ? restY - 18 : restY;

        return (
          <PlayingCard
            key={value}
            as="button"
            face="up"
            value={value}
            selected={selected}
            disabled={disabled}
            showCorner
            caption={selected ? 'Your pick' : undefined}
            ariaLabel={`Play ${value}`}
            ariaPressed={selected}
            onClick={() => onVote(value)}
            onMouseEnter={() => setHovered(value)}
            onMouseLeave={() => setHovered((h) => (h === value ? null : h))}
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 0,
              width: selected ? 84 : 78,
              height: selected ? 120 : 112,
              marginLeft: selected ? -42 : -39,
              transformOrigin: 'bottom center',
              transition: 'transform .16s ease',
              zIndex: selected ? 5 : lifted ? 6 : 1,
              transform: `translateX(${tx}px) rotate(${rotate}deg) translateY(${ty}px)`,
            }}
          />
        );
      })}
    </div>
  );
}
