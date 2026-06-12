"use client";

import { useRef, useState } from "react";
import {
  decodeShareCode,
  downloadFile,
  encodeShareCode,
  exportJson,
  importJson,
  SHARE_CODE_WARN_BYTES,
} from "@/lib/share";
import { saveProject } from "@/lib/storage";
import type { Project } from "@/lib/types";
import { useStore } from "@/state/store";
import Modal from "./Modal";

const btnCls =
  "rounded-md border border-hairline px-3 py-1.5 text-[12.5px] font-medium hover:bg-paper";

export default function ShareDialog({ onClose }: { onClose: () => void }) {
  const { project, open } = useStore();
  const [copied, setCopied] = useState(false);
  const [loadCode, setLoadCode] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!project) return null;

  const code = encodeShareCode(project);
  const tooBig = code.length > SHARE_CODE_WARN_BYTES;

  const openImported = (p: Project) => {
    saveProject(p);
    open(p);
    onClose();
  };

  return (
    <Modal title="Share & export" onClose={onClose} width={500}>
      <div className="flex flex-col gap-5">
        <section>
          <h4 className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
            Share code
          </h4>
          <p className="mb-2 text-[12px] text-ink-soft">
            A compact code anyone can paste into Workback Builder to open this exact project. No
            server involved.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              className="min-w-0 flex-1 rounded-md border border-hairline bg-paper px-2 py-1.5 font-mono text-[11px] text-ink-soft"
              value={code}
              onFocus={(e) => e.target.select()}
            />
            <button
              className="shrink-0 rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                } catch {
                  // clipboard API unavailable — input stays selectable
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied ✓" : "Copy share code"}
            </button>
          </div>
          <div className="mt-1 text-[11px] text-ink-faint">
            {(code.length / 1024).toFixed(1)} KB compressed
            {tooBig && (
              <span className="ml-1 font-medium text-danger">
                — too large for practical copy/paste; use JSON export below instead.
              </span>
            )}
          </div>
        </section>

        <section>
          <h4 className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
            Load from code
          </h4>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-hairline bg-paper px-2 py-1.5 font-mono text-[11px] outline-none focus:border-ink-faint"
              placeholder="Paste a share code…"
              value={loadCode}
              onChange={(e) => {
                setLoadCode(e.target.value);
                setError("");
              }}
            />
            <button
              className={btnCls + " shrink-0 disabled:opacity-40"}
              disabled={!loadCode.trim()}
              onClick={() => {
                try {
                  openImported(decodeShareCode(loadCode));
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Invalid share code.");
                }
              }}
            >
              Load
            </button>
          </div>
          {error && <div className="mt-1 text-[12px] text-danger">{error}</div>}
        </section>

        <section className="border-t border-hairline pt-4">
          <h4 className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
            Project file
          </h4>
          <div className="flex gap-2">
            <button
              className={btnCls}
              onClick={() =>
                downloadFile(
                  `${project.title.replace(/[^\w\- ]+/g, "").trim() || "workback"}.workback.json`,
                  exportJson(project)
                )
              }
            >
              Export JSON
            </button>
            <button className={btnCls} onClick={() => fileRef.current?.click()}>
              Import JSON…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  openImported(importJson(await f.text()));
                } catch {
                  setError("That file isn't a valid Workback project.");
                }
                e.target.value = "";
              }}
            />
          </div>
        </section>
      </div>
    </Modal>
  );
}
