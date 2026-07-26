import { useEffect, useRef, useState } from 'react';

/**
 * The machinery behind a row-anchored `⋯` overflow menu in a list: one menu open at a time across
 * the whole list, dismissed by a click outside it or by Escape, with somewhere for focus to land
 * afterwards.
 *
 * That last part is the reason this is a hook rather than a copied `useState`. Almost every menu
 * action unmounts the button that fired it — and often the row anchoring it too — which drops
 * focus to `<body>` and forces a keyboard user to tab in from the top of the document again. The
 * `containerRef` is a `tabIndex={-1}` catcher for exactly that, and `close()` is the only way to
 * shut the menu so no call site can forget it.
 */
export function useRowMenu() {
  const [openId, setOpenId] = useState<string | null>(null);
  // Scoped to the open menu's anchor, not to the whole list: a menu tall enough to overlap the
  // rows beneath it would otherwise swallow clicks on them without ever closing.
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openId === null) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenId(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpenId(null);
      containerRef.current?.focus();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openId]);

  return {
    openId,
    /** Attach to the element wrapping both the trigger and the panel, on the open row only. */
    menuRef,
    containerRef,
    toggle: (id: string) => setOpenId((cur) => (cur === id ? null : id)),
    close: () => {
      setOpenId(null);
      containerRef.current?.focus();
    },
  };
}

export const menuTriggerClass =
  'rounded-lg border border-border px-2.5 py-1.5 text-muted transition-colors hover:text-fg';

// The panel takes `surface` and its items hover to `surface-2` — the inverse of the rows it
// floats over, so a menu reads as a sheet above the list rather than a hole in it.
export const menuPanelClass =
  'absolute right-0 top-[calc(100%+6px)] z-20 min-w-[170px] rounded-[10px] border border-border ' +
  'bg-surface p-1.5 shadow-[0_16px_40px_-8px_rgba(0,0,0,.5)]';

export const menuItemClass =
  'w-full rounded-[7px] px-3 py-2 text-left text-[13.5px] text-fg transition-colors ' +
  'hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40';

export const menuItemDangerClass =
  'w-full rounded-[7px] px-3 py-2 text-left text-[13.5px] text-danger-text transition-colors ' +
  'hover:bg-surface-2';
