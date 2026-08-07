import { useEffect, useRef, useState } from 'react';
import { Button } from './primitives';

interface ShareBarProps {
  shareLink: string;
  qrDataUrl: string | null;
}

const shareRowClass = 'flex items-center gap-2.5 rounded-xl bg-input-bg px-3.5 py-2.5';
const qrPopoverClass =
  'absolute right-0 top-[calc(100%+8px)] z-20 rounded-[14px] border border-border bg-surface-2 p-4 text-center';

export function ShareBar({ shareLink, qrDataUrl }: ShareBarProps) {
  const [qrOpen, setQrOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dismissed the same way as the table's overflow menu — two popovers a few hundred pixels
  // apart in the same console that disagree about Escape is worse than either rule alone.
  useEffect(() => {
    if (!qrOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setQrOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQrOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [qrOpen]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).catch(() => { /* ignore */ });
  };

  return (
    <div ref={containerRef} className="relative">
      <div className={shareRowClass}>
        <span className="max-w-[220px] truncate font-mono text-xs text-muted">{shareLink}</span>
        <Button variant="primary" size="sm" onClick={handleCopyLink}>
          ⧉ Copy invite link
        </Button>
        {qrDataUrl && (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={qrOpen}
            onClick={() => setQrOpen((v) => !v)}
          >
            QR
          </Button>
        )}
      </div>
      {qrOpen && qrDataUrl && (
        <div className={qrPopoverClass}>
          <div className="rounded-[14px] bg-white p-2.5 shadow-[0_12px_30px_-12px_rgba(0,0,0,.5)]">
            <img src={qrDataUrl} alt="QR code for room link" width={150} height={150} />
          </div>
          <span className="mt-2 block text-xs text-muted">Scan to join on your phone</span>
        </div>
      )}
    </div>
  );
}
