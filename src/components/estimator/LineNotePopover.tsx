"use client";

import { useState } from "react";
import { isCoarsePointer } from "@/lib/device";
import Popover from "../Popover";

/**
 * Edits an internal note/comment on a line item. Local state backs the textarea
 * (no store round-trip lag); changes write through via onSave. Notes are
 * internal — they're not shown in the client PDF or CSV.
 */
export default function LineNotePopover({
  label,
  note,
  anchor,
  onClose,
  onSave,
}: {
  label: string;
  note: string;
  anchor: { left: number; top: number; right: number; bottom: number };
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [text, setText] = useState(note);
  return (
    <Popover anchor={anchor} onClose={onClose} width={260}>
      <div className="flex flex-col gap-2 p-3">
        <div className="text-[11px] font-medium text-ink-faint">Note · {label || "Line item"}</div>
        <textarea
          className="min-h-[72px] w-full resize-y rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint"
          value={text}
          placeholder="Internal note for this line…"
          autoFocus={!isCoarsePointer()}
          onChange={(e) => {
            setText(e.target.value);
            onSave(e.target.value);
          }}
        />
      </div>
    </Popover>
  );
}
