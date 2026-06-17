"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export default function Modal({ title, onClose, children, width = 480 }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Focus trap + restore: move focus into the dialog on open, keep Tab cycling
  // within it, and return focus to the opener on close (accessibility).
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    node?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return e.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      prev?.focus?.();
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="no-print fixed inset-0 z-50 flex items-start justify-center bg-black/25 px-3 pt-[4vh] sm:pt-[10vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="max-h-[88vh] w-full overflow-y-auto rounded-xl border border-hairline bg-surface shadow-2xl outline-none sm:max-h-[78vh]"
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
