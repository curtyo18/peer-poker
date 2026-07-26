import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react';

export const panelClass = 'rounded-2xl border border-border bg-surface p-[18px] sm:p-6';
export const insetClass = 'rounded-xl border border-border bg-surface-2 p-3.5 sm:p-4';
export const feltClass =
  'rounded-[20px] border border-felt-border text-felt-fg shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_24px_50px_-24px_rgba(0,0,0,.6)]';
export const feltGradient = {
  background:
    'radial-gradient(120% 120% at 50% -20%, var(--color-felt-1), var(--color-felt-2) 60%, var(--color-felt-3))',
  // The felt stays dark in both themes, so re-point the accent pair at its always-gold
  // variant for everything inside: light theme's brown accent is unreadable on green.
  '--color-accent': 'var(--color-felt-accent)',
  '--color-accent-fg': 'var(--color-felt-accent-fg)',
} as CSSProperties;
export const fieldClass = 'flex flex-col gap-1.5';
export const labelClass = 'text-sm font-medium text-muted';
// Placeholder colour is owned by the global `::placeholder` rule in index.css; a
// `placeholder:` utility here would override it, so deliberately none is set.
export const inputClass =
  'rounded-[10px] border border-border-strong bg-input-bg px-3.5 py-2.5 text-sm text-fg ' +
  'transition-colors focus-visible:border-accent';
export const monoClass = 'font-mono tracking-[.02em]';

type ButtonVariant = 'primary' | 'secondary' | 'felt' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const buttonBase =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-btn text-accent-fg hover:brightness-105 active:brightness-95',
  secondary:
    'border border-border-strong bg-surface text-fg font-medium hover:border-accent hover:text-accent',
  felt: 'border border-felt-border bg-white/6 text-felt-fg font-medium hover:bg-white/10',
  ghost: 'text-muted font-medium hover:text-fg',
  // A destructive action needs a resting signal, not just a hover one — the border carries the
  // warning at rest and deepens to the full danger colour under the pointer.
  danger:
    'border border-danger-border bg-surface text-danger-text font-medium hover:border-danger-text',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-[18px] py-2.5 text-sm',
};

const accentGlow = {
  boxShadow: '0 8px 20px -8px color-mix(in srgb, var(--color-accent) 60%, transparent)',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      style={variant === 'primary' ? { ...accentGlow, ...style } : style}
      {...props}
    />
  );
}

interface PanelProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function Panel({ className = '', children, ...rest }: PanelProps) {
  return (
    <section className={`${panelClass} ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function Felt({ className = '', children, style, ...rest }: PanelProps) {
  return (
    <div className={`${feltClass} ${className}`} style={{ ...feltGradient, ...style }} {...rest}>
      {children}
    </div>
  );
}

interface KickerProps {
  children: ReactNode;
  className?: string;
  tone?: 'accent' | 'muted';
}

export function Kicker({ children, className = '', tone = 'accent' }: KickerProps) {
  return (
    <span
      className={`block text-[11px] font-semibold uppercase tracking-[.16em] ${
        tone === 'accent' ? 'text-accent' : 'text-muted'
      } ${className}`}
    >
      {children}
    </span>
  );
}

interface DisplayHeadingProps {
  children: ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}

export function DisplayHeading({ children, className = '', as = 'h2' }: DisplayHeadingProps) {
  const Tag = as;
  return <Tag className={`font-display leading-[1.05] tracking-[-.01em] ${className}`}>{children}</Tag>;
}

type BadgeTone = 'accent' | 'success' | 'neutral';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

const badgeTones: Record<BadgeTone, string> = {
  accent: 'bg-accent text-accent-fg border-transparent',
  success: 'bg-success text-success-ink border-transparent',
  neutral: 'border-border text-muted bg-transparent',
};

export function Badge({ children, tone = 'neutral', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

interface StatusDotProps {
  tone?: 'success' | 'accent' | 'muted';
  glow?: boolean;
  className?: string;
}

const dotTones: Record<NonNullable<StatusDotProps['tone']>, string> = {
  success: 'bg-success',
  accent: 'bg-accent',
  muted: 'bg-border',
};

export function StatusDot({ tone = 'success', glow = true, className = '' }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-[7px] w-[7px] flex-none rounded-full ${dotTones[tone]} ${className}`}
      style={glow && tone !== 'muted' ? { boxShadow: `0 0 8px var(--color-${tone})` } : undefined}
    />
  );
}

const avatarPalette = [
  '#2f6b8a',
  '#7a5a3a',
  '#3a7a6a',
  '#6a4a7a',
  '#8a5a3a',
  '#5a6a3a',
  '#4a5a6a',
  '#7a3a5a',
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarPalette[hash % avatarPalette.length];
}

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

// The three dimensions travel together, so they live here rather than being re-derived by every
// caller that wants a small avatar.
const avatarSizes = {
  sm: 'h-[22px] w-[22px] text-[10px]',
  md: 'h-[30px] w-[30px] text-[11px]',
} as const;

interface AvatarProps {
  name: string;
  isSelf?: boolean;
  stacked?: boolean;
  size?: keyof typeof avatarSizes;
  /** Fades the chip for someone the surrounding UI is treating as not-yet-acted. */
  dimmed?: boolean;
  className?: string;
}

export function Avatar({
  name,
  isSelf = false,
  stacked = false,
  size = 'md',
  dimmed = false,
  className = '',
}: AvatarProps) {
  return (
    <span
      className={`grid flex-none place-items-center rounded-full font-bold ${avatarSizes[size]} ${
        stacked ? '-ml-2 border-2 border-surface first:ml-0' : ''
      } ${dimmed ? 'opacity-80' : ''} ${className}`}
      style={{
        background: isSelf ? 'var(--color-accent)' : avatarColor(name),
        // The gold self-chip needs the dark accent ink; the coloured palette chips take white.
        color: isSelf ? 'var(--color-accent-fg)' : 'var(--color-avatar-fg)',
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`${monoClass} ${className}`}>{children}</span>;
}

export function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex-1 rounded-[10px] border border-border bg-surface-2 p-2.5 text-center">
      <div className="font-display text-xl text-fg">{value}</div>
      <Kicker tone="muted">{label}</Kicker>
    </div>
  );
}

interface PlayerPillProps {
  name: string;
  voted: boolean;
  isSelf?: boolean;
  /** A dropped player keeps their seat until the host removes them, so silence has two causes. */
  connected?: boolean;
}

export function PlayerPill({ name, voted, isSelf = false, connected = true }: PlayerPillProps) {
  const status = voted ? 'voted' : connected ? 'still voting' : 'disconnected';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${
        voted
          ? 'border-ready-border bg-ready/10 text-fg-2'
          : 'border-border-strong bg-surface-2 text-muted'
      }`}
    >
      <Avatar name={name} isSelf={isSelf} size="sm" dimmed={!voted} />
      {name}
      <span aria-hidden="true" className={voted ? 'text-ready' : 'text-muted'}>
        {voted ? '✓' : connected ? '···' : '⚠'}
      </span>
      <span className="sr-only">{status}</span>
    </span>
  );
}
