"use client";

import Modal from "./Modal";

/**
 * Shared confirmation dialog for destructive/consequential actions, so the admin
 * (and the rest of the app) stops mixing one-click destructs with native
 * `confirm()` — both broke the design language. Render it when a pending action
 * exists; Confirm runs the callback then closes.
 */
export interface ConfirmOptions {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  /** Red confirm button for irreversible actions (delete/purge/remove). */
  danger?: boolean;
}

export default function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onClose,
}: ConfirmOptions & { onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} width={400}>
      <div className="flex flex-col gap-4">
        <div className="text-[13px] leading-relaxed text-ink-soft">{body}</div>
        <div className="flex justify-end gap-2">
          <button
            className="rounded-md border border-hairline px-3 py-1.5 text-[12.5px] font-medium hover:bg-paper"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85 ${
              danger ? "bg-danger" : "bg-ink"
            }`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
