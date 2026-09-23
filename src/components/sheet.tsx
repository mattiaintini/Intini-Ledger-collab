"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Foglio modale: dal basso su iPhone, centrato su Mac. Usa <dialog> nativo:
 * focus intrappolato, Esc per chiudere, sfondo attenuato.
 */
export function Sheet({ open, onClose, title, action, children }: { open: boolean; onClose: () => void; title: string; action?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="sheet m-0 mt-auto w-full max-w-none bg-transparent p-0 text-fg backdrop:bg-black/45 md:m-auto md:w-[520px]"
    >
      <div className="max-h-[92dvh] overflow-y-auto rounded-t-[14px] bg-[var(--t-bg)] md:max-h-[88dvh] md:rounded-[14px]">
        <div className="material sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center border-b-[0.5px] border-line px-4 py-3">
          <button type="button" onClick={onClose} className="justify-self-start text-[17px] text-fg active:opacity-60">Annulla</button>
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <span className="justify-self-end">{action}</span>
        </div>
        <div className="p-4 md:p-5">{children}</div>
      </div>
    </dialog>
  );
}
