import { useState } from 'react';
import type { SessionState } from '../domain/types';

const sectionClass = 'rounded-lg border border-border bg-muted p-4 space-y-3';
const buttonClass =
  'rounded border border-border bg-bg px-3 py-1.5 text-sm text-fg hover:text-accent transition-colors';
const tableClass = 'w-full text-sm text-fg';

interface ResultsExportProps {
  state: SessionState;
  onEnd: () => void;
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsExport({ state, onEnd }: ResultsExportProps) {
  const [showResults, setShowResults] = useState(false);
  const accepted = state.items.filter((i) => i.acceptedEstimate !== null);

  const rows = accepted.map((i) => ({ title: i.title || '(untitled)', estimate: i.acceptedEstimate as string }));

  const handleCopy = () => {
    const text = rows.map((r) => `${r.title}\t${r.estimate}`).join('\n');
    navigator.clipboard.writeText(text).catch(() => { /* ignore */ });
  };

  const handleDownloadCsv = () => {
    const csv = ['title,estimate', ...rows.map((r) => `"${r.title.replace(/"/g, '""')}",${r.estimate}`)].join('\n');
    downloadBlob(csv, 'text/csv', 'peerpoker-results.csv');
  };

  const handleDownloadJson = () => {
    downloadBlob(JSON.stringify(rows, null, 2), 'application/json', 'peerpoker-results.json');
  };

  const handleEnd = () => {
    onEnd();
  };

  return (
    <section className={sectionClass}>
      <h2 className="text-lg font-semibold">End &amp; export</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => setShowResults(true)}>
          Show results
        </button>
        <button type="button" className={buttonClass} onClick={handleEnd}>
          End session
        </button>
      </div>

      {showResults && (
        <div className="space-y-2">
          <table className={tableClass}>
            <thead>
              <tr className="text-left">
                <th>Item</th>
                <th>Estimate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.title}</td>
                  <td>{r.estimate}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={handleCopy}>
              Copy
            </button>
            <button type="button" className={buttonClass} onClick={handleDownloadCsv}>
              Download CSV
            </button>
            <button type="button" className={buttonClass} onClick={handleDownloadJson}>
              Download JSON
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
