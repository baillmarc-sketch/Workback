"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import {
  approveAccessRequest,
  dismissAccessRequest,
  listAccessRequests,
  type AccessRequest,
} from "@/lib/admin/requests";
import { logAudit } from "@/lib/admin/audit";
import ConfirmDialog from "../ConfirmDialog";

/** Pending self-service access requests. Approve grants Estimator (and clears
    the request); Dismiss declines without granting. Both are logged. */
export default function RequestsSection({ onCount }: { onCount?: (n: number) => void }) {
  const { user, getToken } = useAuth();
  const [requests, setRequests] = useState<AccessRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dismissAsk, setDismissAsk] = useState<AccessRequest | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const list = await listAccessRequests(token);
      setRequests(list);
      onCount?.(list.length);
    } catch (e) {
      setError((e as Error).message || "Could not load requests");
    }
  }, [getToken, onCount]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = useCallback(
    async (req: AccessRequest, approve: boolean) => {
      setBusy(req.uid);
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in");
        if (approve) {
          await approveAccessRequest(token, req.uid);
          if (user) await logAudit(token, user, "grant_estimator", req.email, "via request");
        } else {
          await dismissAccessRequest(token, req.uid);
          if (user) await logAudit(token, user, "dismiss_request", req.email);
        }
        setRequests((cur) => {
          const next = cur?.filter((r) => r.uid !== req.uid) ?? null;
          onCount?.(next?.length ?? 0);
          return next;
        });
      } catch (e) {
        setError((e as Error).message || "Action failed");
      } finally {
        setBusy(null);
      }
    },
    [getToken, user, onCount]
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-ink-soft">
        People who signed in and asked for access. Approving grants the Estimator to that account
        immediately.
      </p>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-danger">{error}</div>}

      {requests === null ? (
        <div className="py-10 text-center text-[12.5px] text-ink-faint">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="py-6 text-center text-[12.5px] text-ink-faint">No pending requests.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
          {requests.map((r) => (
            <div
              key={r.uid}
              className="flex items-start gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{r.name || r.email}</div>
                {r.name && <div className="truncate text-[11.5px] text-ink-soft">{r.email}</div>}
                {r.message && (
                  <div className="mt-1 text-[11.5px] text-ink-soft italic">“{r.message}”</div>
                )}
                {r.createdAt > 0 && (
                  <div className="mt-0.5 text-[11px] text-ink-faint">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  className="rounded-md bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-paper hover:opacity-85 disabled:opacity-50"
                  disabled={busy === r.uid}
                  onClick={() => resolve(r, true)}
                >
                  {busy === r.uid ? "…" : "Approve"}
                </button>
                <button
                  className="rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger disabled:opacity-50"
                  disabled={busy === r.uid}
                  onClick={() => setDismissAsk(r)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dismissAsk && (
        <ConfirmDialog
          title="Dismiss request"
          danger
          confirmLabel="Dismiss"
          body={
            <>
              Dismiss the access request from <strong>{dismissAsk.email}</strong> without granting
              it? They can request again later.
            </>
          }
          onConfirm={() => resolve(dismissAsk, false)}
          onClose={() => setDismissAsk(null)}
        />
      )}
    </div>
  );
}
