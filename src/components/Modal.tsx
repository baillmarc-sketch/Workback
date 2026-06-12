"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

export default function Modal({ title, onClose, children, width = 480 }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="no-print fixed inset-0 z-50 flex items-start justify-center bg-black/25 pt-[10vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[78vh] w-full overflow-y-auto rounded-xl border border-hairline bg-surface shadow-2xl"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h3 className="font-display text-[16px] font-semibold">{title}</h3>
          <button
            className="rounded-md px-2 py-0.5 text-[16px] leading-none text-ink-faint hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
