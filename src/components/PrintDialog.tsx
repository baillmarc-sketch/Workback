"use client";

import { useStore } from "@/state/store";
import Modal from "./Modal";

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-hairline px-3 py-2.5 hover:bg-paper">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="block text-[11.5px] text-ink-soft">{hint}</span>
      </span>
    </label>
  );
}

export default function PrintDialog({ onClose }: { onClose: () => void }) {
  const { project, patch } = useStore();
  if (!project) return null;

  // Close first so the modal unmounts before the browser's print dialog
  // captures the page.
  const print = () => {
    onClose();
    requestAnimationFrame(() => window.print());
  };

  return (
    <Modal title="Print / PDF options" onClose={onClose} width={420}>
      <div className="flex flex-col gap-2.5">
        <Toggle
          checked={project.showLegend}
          onChange={(v) => patch((p) => ({ ...p, showLegend: v }))}
          label="Category legend"
          hint="Show the color key on every page."
        />
        <Toggle
          checked={!!project.printNotes}
          onChange={(v) => patch((p) => ({ ...p, printNotes: v || undefined }))}
          label="Project notes"
          hint="Include the notes block beneath the header."
        />
        <Toggle
          checked={!!project.printGrayscale}
          onChange={(v) => patch((p) => ({ ...p, printGrayscale: v || undefined }))}
          label="Grayscale"
          hint="Drop category colors — ink-friendly."
        />
        <p className="px-0.5 text-[11.5px] text-ink-faint">
          Conflict warnings are never printed, and long event titles wrap onto two lines.
        </p>
        <div className="mt-1 flex justify-end gap-2">
          <button
            className="rounded-md border border-hairline px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
            onClick={print}
          >
            Print / Save PDF
          </button>
        </div>
      </div>
    </Modal>
  );
}
