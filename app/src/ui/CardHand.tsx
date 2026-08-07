import { useState } from 'react';
import type { CardValue, Deck } from '../domain/types';
import { PlayingCard } from './PlayingCard';

// The fan's geometry, in the units it was tuned in: 40px between neighbouring cards over a
// half-span of 200px, and 45px of droop on the outermost card. The 11-card Fibonacci deck sits
// exactly at both limits, which is what the `pb-8`/`h-[130px]` box and the 0.72 mobile scale
// were sized against.
const SPREAD_PX = 40;
const FAN_HALF_SPAN_PX = 200;
const FAN_DROOP_PX = 45;

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
  // Rotation already normalises by `center` so the arc spans the same 60° at any deck size; the
  // spread and the droop have to do the same or a deck wider than Fibonacci's 11 grows the fan
  // past the panel (and past a 375px viewport) instead of packing into it. Capped at 40px so
  // decks at or under 11 cards keep the exact geometry these numbers were tuned for.
  const spread = center === 0 ? 0 : Math.min(SPREAD_PX, FAN_HALF_SPAN_PX * 2 / (n - 1));
  const droop = center === 0 ? 0 : FAN_DROOP_PX / center ** 2;

  return (
    // pb-14 reserves room for the fanned cards' downward droop (bottom-anchored + positive
    // translateY), which absolute positioning otherwise excludes from this box's height.
    <div className="pb-8 sm:pb-14" role="group" aria-label="Card hand">
      {/* The fan's per-card offsets are fixed pixel values wide enough to overflow a phone
          viewport; scale the whole arc down on narrow screens instead of recomputing offsets. */}
      <div className="relative mx-auto h-[130px] w-full max-w-[420px] origin-bottom scale-[0.72] sm:h-[150px] sm:scale-100">
        {deck.values.map((value, i) => {
          const offset = i - center;
          const selected = value === myVote;
          const lifted = !disabled && !selected && hovered === value;

          const rotate = selected ? 0 : offset * (center === 0 ? 0 : 30 / center);
          const tx = offset * spread;
          const restY = offset ** 2 * droop;
          const ty = selected ? -16 : lifted ? restY - 18 : restY;

          return (
            <PlayingCard
              key={value}
              as="button"
              face="up"
              value={value}
              selected={selected}
              disabled={disabled}
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
                width: selected ? 58 : 52,
                height: selected ? 82 : 74,
                marginLeft: selected ? -29 : -26,
                transformOrigin: 'bottom center',
                transition: 'transform .16s ease',
                zIndex: selected ? 5 : lifted ? 6 : 1,
                transform: `translateX(${tx}px) rotate(${rotate}deg) translateY(${ty}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
