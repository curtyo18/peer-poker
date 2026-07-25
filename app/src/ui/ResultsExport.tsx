import { useState } from 'react';
import type { SessionState } from '../domain/types';
import { Button, Panel, SectionHeading } from './primitives';

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

  return (
    <Panel>
      <SectionHeading
        title="Results & export"
        action={
          <Button variant="danger" size="sm" onClick={onEnd}>
            End session
          </Button>
        }
      />

      {!showResults && (
        <Button variant="secondary" size="sm" onClick={() => setShowResults(true)}>
          Show results ({rows.length})
        </Button>
      )}

      {showResults && (
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted">No estimates accepted yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm text-fg">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium">Estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{r.title}</td>
                      <td className="px-3 py-2 font-display text-accent">{r.estimate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              Copy
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownloadCsv}>
              Download CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownloadJson}>
              Download JSON
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
