"use client";

import { useMemo, useRef, useState } from "react";
import Modal from "../Modal";
import { useAuth } from "@/state/auth";
import { recentErrors } from "@/lib/feedback/errorLog";
import { prepareScreenshot, submitFeedback, type FeedbackKind } from "@/lib/feedback/feedback";

const KINDS: { id: FeedbackKind; label: string; hint: string }[] = [
  { id: "bug", label: "Bug", hint: "Something is broken or wrong" },
  { id: "idea", label: "Idea", hint: "A feature or improvement" },
  { id: "praise", label: "Praise", hint: "Something you love" },
  { id: "other", label: "Other", hint: "Anything else" },
];

export default function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const { user, getToken } = useAuth();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [shot, setShot] = useState<string | null>(null);
  const [shotBusy, setShotBusy] = useState(false);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const errCount = useMemo(() => recentErrors().length, []);

  const handleImage = async (file: Blob | null) => {
    if (!file) return;
    setShotBusy(true);
    setError(null);
    try {
      const url = await prepareScreenshot(file);
      if (!url) setError("That image is too large to attach, even after compression.");
      else setShot(url);
    } catch {
      setError("Couldn't read that image.");
    } finally {
      setShotBusy(false);
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) {
      e.preventDefault();
      handleImage(file);
    }
  };

  const submit = async () => {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken().catch(() => null);
      await submitFeedback(
        { kind, message, email: email || null, screenshot: shot, includeDiagnostics, user },
        token
      );
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      setError((e as Error).message || "Couldn't send — check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <Modal title="Send feedback" onClose={onClose} width={460}>
      {done ? (
        <div className="py-8 text-center" role="status">
          <div className="text-[15px] font-semibold">Thank you</div>
          <p className="mt-1 text-[12.5px] text-ink-soft">Your feedback went straight to the team.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3" onPaste={onPaste}>
          <div className="flex gap-1.5" role="group" aria-label="Feedback type">
            {KINDS.map((k) => (
              <button
                key={k.id}
                title={k.hint}
                aria-pressed={kind === k.id}
                className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  kind === k.id
                    ? "border-ink bg-ink text-paper"
                    : "border-hairline text-ink-soft hover:text-ink"
                }`}
                onClick={() => setKind(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>

          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            aria-label="Your feedback"
            placeholder={
              kind === "bug"
                ? "What happened? What did you expect to happen?"
                : "Tell us more…"
            }
            className="w-full resize-y rounded-md border border-hairline bg-surface px-2.5 py-2 text-[13px] outline-none placeholder:text-ink-faint focus:border-ink-faint"
          />

          <div>
            <label className="mb-1 block text-[11.5px] font-medium text-ink-soft" htmlFor="fb-email">
              Email {user ? "" : "(optional)"}
            </label>
            <input
              id="fb-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
              className="w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-ink-faint focus:border-ink-faint"
            />
            {!email && (
              <p className="mt-1 text-[11px] text-ink-faint">Leave your email if you&apos;d like a reply.</p>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11.5px] font-medium text-ink-soft">Screenshot (optional)</span>
              {!shot && (
                <button
                  className="text-[11.5px] font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
                  onClick={() => fileRef.current?.click()}
                  disabled={shotBusy}
                >
                  {shotBusy ? "Processing…" : "Attach image"}
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImage(e.target.files?.[0] ?? null)}
            />
            {shot ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot}
                  alt="Attached screenshot"
                  className="max-h-32 rounded-md border border-hairline"
                />
                <button
                  onClick={() => setShot(null)}
                  aria-label="Remove screenshot"
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-hairline bg-surface text-[13px] leading-none text-ink-soft shadow hover:text-ink"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-hairline px-2.5 py-2 text-[11.5px] text-ink-faint">
                Paste a screenshot (⌘/Ctrl+V) here, or attach an image.
              </div>
            )}
          </div>

          <label className="flex items-start gap-2 text-[11.5px] text-ink-soft">
            <input
              type="checkbox"
              checked={includeDiagnostics}
              onChange={(e) => setIncludeDiagnostics(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Attach technical details — browser, screen size
              {errCount > 0 ? `, and ${errCount} recent error${errCount === 1 ? "" : "s"}` : ""}. Helps
              us debug.
            </span>
          </label>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-danger">{error}</div>
          )}

          <div className="mt-1 flex items-center justify-end gap-2">
            <button
              className="rounded-md px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="rounded-md bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85 disabled:opacity-50"
              disabled={busy || !message.trim()}
              onClick={submit}
            >
              {busy ? "Sending…" : "Send feedback"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
