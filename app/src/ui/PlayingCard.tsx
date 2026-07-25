import type { CSSProperties, ReactNode } from 'react';

type CardFace = 'up' | 'down' | 'slot';
type CardSize = 'sm' | 'md' | 'lg';

const sizes: Record<CardSize, { w: number; h: number; radius: number; font: number }> = {
  sm: { w: 38, h: 52, radius: 8, font: 16 },
  md: { w: 62, h: 88, radius: 10, font: 20 },
  lg: { w: 82, h: 116, radius: 12, font: 32 },
};

const backStripes = 'repeating-linear-gradient(45deg, #b98f3c, #b98f3c 6px, #a97f34 6px, #a97f34 12px)';
const selectedFaceGradient = 'linear-gradient(180deg, #fff7e4, var(--color-card))';

interface PlayingCardProps {
  value?: string;
  face: CardFace;
  size?: CardSize;
  selected?: boolean;
  highlighted?: boolean;
  animateDelay?: number;
  as?: 'div' | 'button';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  ariaPressed?: boolean;
  caption?: ReactNode;
  showCorner?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function PlayingCard({
  value,
  face,
  size = 'md',
  selected = false,
  highlighted = false,
  animateDelay,
  as = 'div',
  onClick,
  disabled,
  className = '',
  style,
  ariaLabel,
  ariaPressed,
  caption,
  showCorner = false,
  onMouseEnter,
  onMouseLeave,
}: PlayingCardProps) {
  const dims = sizes[size];

  const baseStyle: CSSProperties = {
    width: dims.w,
    height: dims.h,
    borderRadius: dims.radius,
    fontSize: dims.font,
    position: 'relative',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'var(--font-display)',
    ...style,
  };

  if (face === 'up') {
    baseStyle.background = selected ? selectedFaceGradient : 'var(--color-card)';
    baseStyle.color = 'var(--color-card-ink)';
    baseStyle.border = highlighted || selected ? '2px solid var(--color-accent)' : '1px solid var(--color-card-edge)';
    baseStyle.boxShadow =
      highlighted || selected
        ? '0 16px 30px -10px rgba(0,0,0,.55), 0 0 0 5px color-mix(in srgb, var(--color-accent) 16%, transparent)'
        : '0 10px 22px -8px rgba(0,0,0,.5)';
  } else if (face === 'down') {
    baseStyle.background = backStripes;
    baseStyle.color = 'var(--color-accent-fg)';
    baseStyle.border = '2px solid var(--color-accent)';
    baseStyle.boxShadow = '0 10px 20px -8px rgba(0,0,0,.5)';
  } else {
    baseStyle.background = 'var(--color-felt-panel)';
    baseStyle.color = 'var(--color-felt-muted)';
    baseStyle.border = '2px dashed var(--color-felt-border)';
  }

  if (animateDelay !== undefined) {
    baseStyle.animation = `flip 0.5s ${animateDelay}s cubic-bezier(0.22, 1, 0.36, 1) both`;
  }

  const content = (
    <>
      {showCorner && face === 'up' && value && (
        <span className="absolute top-[7px] left-[9px] text-[13px] font-display">{value}</span>
      )}
      <span className="pointer-events-none">{face === 'down' ? '' : face === 'slot' ? '…' : value}</span>
      {caption && (
        <span className="absolute bottom-[6px] left-0 right-0 text-center text-[9px] font-sans font-bold uppercase tracking-[.14em] text-accent">
          {caption}
        </span>
      )}
    </>
  );

  if (as === 'button') {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onMouseEnter}
        onBlur={onMouseLeave}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        className={`cursor-pointer disabled:cursor-not-allowed ${className}`}
        style={baseStyle}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} style={baseStyle} aria-label={ariaLabel}>
      {content}
    </div>
  );
}
