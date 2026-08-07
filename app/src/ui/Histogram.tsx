import type { CardValue } from '../domain/types';

interface HistogramProps {
  deck: CardValue[];
  counts: Record<CardValue, number>;
  mode: CardValue[];
  outlier: CardValue | null;
}

// Deep enough to distinguish a peak from a lone vote at a glance, tall enough not to compete
// with the reveal card above it.
const BAR_AREA_PX = 56;
const BASELINE_PX = 2;

function plural(n: number, value: CardValue) {
  return `${n} ${n === 1 ? 'vote' : 'votes'} for ${value}`;
}

// One bar per deck value, not per voted value — an unvoted card still marks its place on the
// axis, so the row reads as the whole deck's shape rather than just the votes that landed.
export function Histogram({ deck, counts, mode, outlier }: HistogramProps) {
  // Scaled against the tallest bar that is actually drawn. Ranging over every key in `counts`
  // would let a vote for a card outside this deck shrink every visible bar against something
  // the chart never shows.
  const peak = Math.max(1, ...deck.map((v) => counts[v] ?? 0));

  const populated = deck.filter((v) => (counts[v] ?? 0) > 0);
  // Colour is the only thing that marks the mode and the outlier, so the summary has to say
  // both out loud or the two channels are not telling the same story.
  const summary = populated.length
    ? [
        `${populated.map((v) => plural(counts[v], v)).join(', ')}.`,
        mode.length > 0 ? `Most picked: ${mode.join(' or ')}.` : '',
        outlier !== null ? `Furthest from the suggestion: ${outlier}.` : '',
      ]
        .filter(Boolean)
        .join(' ')
    : 'Nobody voted.';

  return (
    <div className="mt-4">
      <div aria-hidden="true" className="flex items-end gap-2" style={{ height: BAR_AREA_PX }}>
        {deck.map((v) => {
          const count = counts[v] ?? 0;
          // Mode wins over outlier: a value half the table picked cannot also be shown as the
          // one to distrust. On a two-way tie both are the mode, and rust would land on a
          // full-height bar while the axis label beneath it stayed gold.
          const colorClass = mode.includes(v)
            ? 'bg-accent-btn'
            : outlier === v
              ? 'bg-outlier'
              : 'bg-accent/60';
          return (
            <div key={v} className="flex-1 self-end">
              {count > 0 ? (
                <div
                  className={`w-full rounded-t-[4px] ${colorClass}`}
                  style={{ height: `${(count / peak) * BAR_AREA_PX}px` }}
                />
              ) : (
                <div className="w-full bg-border" style={{ height: BASELINE_PX }} />
              )}
            </div>
          );
        })}
      </div>
      {/* Hidden from assistive tech: read on its own the axis is a bare run of numbers with
          nothing tying them to the bars above. The summary below is the accessible equivalent. */}
      <div aria-hidden="true" className="mt-1.5 flex gap-2 font-mono">
        {deck.map((v) => (
          <span
            key={v}
            // min-w-0: a flex item floors at min-content by default, and a label with no break
            // opportunity ('0.5') is wider than its column on a phone. The bars above hold no
            // text and shrink freely, so without this the axis outgrows the bar row and every
            // label drifts off the bar it names.
            className={`min-w-0 flex-1 text-center text-[11px] ${mode.includes(v) ? 'text-accent' : 'text-muted-2'}`}
          >
            {v}
          </span>
        ))}
      </div>
      <span className="sr-only">{summary}</span>
    </div>
  );
}
