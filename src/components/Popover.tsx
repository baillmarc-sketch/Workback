"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isNarrowViewport } from "@/lib/device";

interface PopoverProps {
  /** Viewport rect to anchor against */
  anchor: { left: number; top: number; right: number; bottom: number };
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

/**
 * Lightweight anchored popover: fixed-position, flips to stay in the
 * viewport, closes on outside click or Escape. On phone-sized screens it
 * renders as a bottom sheet instead.
 */
export default function Popover({ anchor, onClose, children, width = 296 }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [sheet] = useState(isNarrowViewport);

  useLayoutEffect(() => {
    if (sheet) return;
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const pad = 8;
    let left = anchor.left;
    let top = anchor.bottom + 6;
    if (left + width > window.innerWidth - pad) left = window.innerWidth - width - pad;
    if (left < pad) left = pad;
    if (top + h > window.innerHeight - pad) {
      top = anchor.top - h - 6;
      if (top < pad) top = Math.max(pad, window.innerHeight - h - pad);
    }
    setPos({ left, top });
  }, [anchor, width, sheet]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    // Defer so the click that opened the popover doesn't immediately close it
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey, true);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  if (sheet) {
    return createPortal(
      <div className="no-print fixed inset-0 z-50 bg-black/25">
        <div
          ref={ref}
          role="dialog"
          className="sheet-panel fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-surface pb-[max(env(safe-area-inset-bottom),12px)] shadow-[0_-8px_30px_rgba(0,0,0,0.15)]"
        >
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-hairline-strong" aria-hidden />
          {children}
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      className="no-print fixed z-50 rounded-xl border border-hairline bg-surface shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
      style={{
        width,
        left: pos?.left ?? anchor.left,
        top: pos?.top ?? anchor.bottom + 6,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body
  );
}
