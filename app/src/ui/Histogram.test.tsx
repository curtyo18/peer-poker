import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Histogram } from './Histogram';
import { FIBONACCI } from '../domain/decks';

const deck = FIBONACCI.values;

// The bars are aria-hidden, so their colours are asserted through the DOM directly. That is the
// one thing about this component a user reads and a role query cannot reach.
function barClasses(container: HTMLElement): (string | null)[] {
  const [bars] = Array.from(container.querySelectorAll('div[aria-hidden="true"]'));
  return Array.from(bars.children).map((col) => col.firstElementChild?.getAttribute('class') ?? null);
}

describe('Histogram', () => {
  it('draws one column per deck value, whether or not it was voted for', () => {
    const { container } = render(
      <Histogram deck={deck} counts={{ '5': 2 }} mode={['5']} outlier={null} />,
    );
    expect(barClasses(container)).toHaveLength(deck.length);
  });

  it('gives an unvoted value a baseline rather than a zero-height bar', () => {
    const { container } = render(
      <Histogram deck={deck} counts={{ '5': 2 }} mode={['5']} outlier={null} />,
    );
    const unvoted = barClasses(container)[deck.indexOf('1')];
    expect(unvoted).toContain('bg-border');
  });

  it('paints the mode gold and the outlier rust', () => {
    const { container } = render(
      <Histogram deck={deck} counts={{ '3': 3, '21': 1 }} mode={['3']} outlier="21" />,
    );
    const classes = barClasses(container);
    expect(classes[deck.indexOf('3')]).toContain('bg-accent-btn');
    expect(classes[deck.indexOf('21')]).toContain('bg-outlier');
  });

  // A two-way tie makes both values the mode. Rust on a joint-tallest bar tells the room to
  // distrust a value half of them chose, while the axis label beneath it stays gold.
  it('never paints a mode value as the outlier, even when it is both', () => {
    const { container } = render(
      <Histogram deck={deck} counts={{ '2': 2, '13': 2 }} mode={['2', '13']} outlier="13" />,
    );
    const classes = barClasses(container);
    expect(classes[deck.indexOf('13')]).toContain('bg-accent-btn');
    expect(classes[deck.indexOf('13')]).not.toContain('bg-outlier');
  });

  it('scales bars against the tallest drawn bar, ignoring votes outside the deck', () => {
    const { container } = render(
      <Histogram deck={deck} counts={{ '5': 1, '100': 9 }} mode={['100']} outlier={null} />,
    );
    const bar = barClasses(container)[deck.indexOf('5')];
    expect(bar).toContain('rounded-t-[4px]');
    // 1 of a peak of 1 — full height, not a ninth of a bar the chart never draws.
    const el = container.querySelectorAll('div[aria-hidden="true"]')[0].children[deck.indexOf('5')];
    expect((el.firstElementChild as HTMLElement).style.height).toBe('56px');
  });

  it('says in words what the colours say, since colour is the only other signal', () => {
    render(<Histogram deck={deck} counts={{ '3': 3, '21': 1 }} mode={['3']} outlier="21" />);
    expect(
      screen.getByText('3 votes for 3, 1 vote for 21. Most picked: 3. Furthest from the suggestion: 21.'),
    ).toBeInTheDocument();
  });

  it('says so when nobody voted', () => {
    render(<Histogram deck={deck} counts={{}} mode={[]} outlier={null} />);
    expect(screen.getByText('Nobody voted.')).toBeInTheDocument();
  });

  // Read on its own the axis is a bare run of numbers with nothing tying it to the bars, so both
  // the bars and the axis are hidden and the summary is the whole accessible story.
  it('keeps the bars and the axis out of the accessibility tree', () => {
    const { container } = render(
      <Histogram deck={deck} counts={{ '5': 1 }} mode={['5']} outlier={null} />,
    );
    const axisLabel = screen.getByText('☕');
    expect(axisLabel.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });
});
