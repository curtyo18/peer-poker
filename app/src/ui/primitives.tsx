import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react';

export const panelClass = 'rounded-2xl border border-border bg-surface p-4 sm:p-[18px]';
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
export const inputClass =
  'rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-muted/70 transition-colors focus-visible:border-accent';

type ButtonVariant = 'primary' | 'secondary' | 'felt' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const buttonBase =
  'inline-flex items-center justify-center gap-1.5 rounded-[9px] font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-105 active:brightness-95',
  secondary: 'border border-border bg-surface text-fg font-medium hover:border-accent hover:text-accent',
  felt: 'border border-felt-border bg-white/6 text-felt-fg font-medium hover:bg-white/10',
  ghost: 'text-muted font-medium hover:text-fg',
  danger:
    'border border-border bg-surface text-muted font-medium hover:border-alert-border hover:text-alert-fg hover:bg-alert-bg',
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

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  action?: ReactNode;
}

export function SectionHeading({ eyebrow, title, action }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        {eyebrow && <Kicker className="mb-0.5">{eyebrow}</Kicker>}
        <h2 className="text-sm font-semibold tracking-wide text-fg">{title}</h2>
      </div>
      {action}
    </div>
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
  '#7a5b3a',
  '#3f6b58',
  '#5a4a6b',
  '#6b4a4a',
  '#3a5a6b',
  '#6b5a3a',
  '#4a6b52',
  '#5b4a6b',
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

interface AvatarProps {
  name: string;
  isSelf?: boolean;
  stacked?: boolean;
  className?: string;
}

export function Avatar({ name, isSelf = false, stacked = false, className = '' }: AvatarProps) {
  return (
    <span
      className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-[11px] font-bold ${
        stacked ? '-ml-2 border-2 border-felt-2 first:ml-0' : ''
      } ${className}`}
      style={{
        background: isSelf ? 'var(--color-accent)' : avatarColor(name),
        // The gold self-chip needs the dark accent ink; the muted palette chips take cream.
        color: isSelf ? 'var(--color-accent-fg)' : 'var(--color-felt-fg)',
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
