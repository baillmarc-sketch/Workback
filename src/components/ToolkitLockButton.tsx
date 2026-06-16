"use client";

import { useState } from "react";
import { isToolkitUnlocked, setApp, tryUnlockToolkit } from "@/lib/toolkit";
import Popover from "./Popover";

type Anchor = { left: number; top: number; right: number; bottom: number };

/**
 * A discreet button pinned to the bottom of the Workback view. When the toolkit
 * is locked it reads "Locked: Toolkit" and asks for a password; the right
 * password reveals the app launcher. Once unlocked it's a quick link in.
 */
export default function ToolkitLockButton() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const unlocked = isToolkitUnlocked();

  const openLauncher = () => setApp("home");

  return (
    <>
      <div className="no-print fixed inset-x-0 bottom-3 z-30 flex justify-center">
        <button
          className="rounded-full border border-hairline bg-surface/80 px-3 py-1 text-[11px] font-medium text-ink-faint backdrop-blur-sm transition-colors hover:text-ink-soft"
          onClick={(e) => {
            if (unlocked) {
              openLauncher();
              return;
            }
            const r = e.currentTarget.getBoundingClientRect();
            setError(false);
            setPw("");
            setAnchor({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
          }}
        >
          {unlocked ? "✦ Toolkit" : "🔒 Locked: Toolkit"}
        </button>
      </div>

      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} width={236}>
          <form
            className="flex flex-col gap-2 p-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (tryUnlockToolkit(pw)) {
                setAnchor(null);
                openLauncher();
              } else {
                setError(true);
              }
            }}
          >
            <label className="text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
              Toolkit password
            </label>
            <input
              type="password"
              className="w-full rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint"
              value={pw}
              autoFocus
              placeholder="Enter password"
              onChange={(e) => {
                setPw(e.target.value);
                setError(false);
              }}
            />
            {error && <span className="text-[11px] text-danger">Wrong password</span>}
            <button
              type="submit"
              className="self-start rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
            >
              Unlock
            </button>
          </form>
        </Popover>
      )}
    </>
  );
}
