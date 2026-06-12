"use client";

import { useState } from "react";
import { useAuth } from "@/state/auth";
import Popover from "./Popover";

/** Sign-in button / signed-in avatar with the account popover */
export default function AccountButton() {
  const { user, ready, signIn, signOutUser } = useAuth();
  const [anchor, setAnchor] = useState<{ left: number; top: number; right: number; bottom: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (!ready) return null;

  if (!user) {
    return (
      <div className="mt-1.5 flex shrink-0 flex-col items-end">
        <button
          className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink disabled:opacity-50"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(false);
            try {
              await signIn();
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error && <span className="mt-1 text-[10.5px] text-danger">Sign-in failed — try again</span>}
      </div>
    );
  }

  const initial = (user.name || user.email || "?").slice(0, 1).toUpperCase();

  return (
    <>
      <button
        className="mt-1 h-7 w-7 shrink-0 overflow-hidden rounded-full border border-hairline bg-surface"
        title={user.email ?? "Account"}
        aria-label="Account"
        onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setAnchor({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
        }}
      >
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[12px] font-semibold text-ink-soft">
            {initial}
          </span>
        )}
      </button>

      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} width={232}>
          <div className="flex flex-col gap-2 p-3.5">
            <div className="min-w-0">
              {user.name && <div className="truncate text-[13px] font-semibold">{user.name}</div>}
              <div className="truncate text-[11.5px] text-ink-soft">{user.email}</div>
            </div>
            <div className="text-[11.5px] leading-relaxed text-ink-faint">
              Your projects sync to this account across devices.
            </div>
            <button
              className="self-start rounded-md border border-hairline px-2.5 py-1.5 text-[12px] font-medium hover:bg-paper"
              onClick={async () => {
                await signOutUser();
                setAnchor(null);
              }}
            >
              Sign out
            </button>
          </div>
        </Popover>
      )}
    </>
  );
}
