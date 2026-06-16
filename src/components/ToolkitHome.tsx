"use client";

import { APPS, setApp } from "@/lib/toolkit";
import AccountButton from "./AccountButton";

/** The platform launcher: a card per app, plus a hint that more are coming. */
export default function ToolkitHome() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-semibold tracking-tight">Producer&apos;s Toolkit</h1>
          <p className="mt-1 text-[13px] text-ink-soft">Tools for planning and pricing production.</p>
        </div>
        <div className="shrink-0">
          <AccountButton />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {APPS.map((app) => (
          <button
            key={app.id}
            onClick={() => setApp(app.id)}
            className="group flex h-full flex-col rounded-xl border border-hairline bg-surface p-5 text-left transition-colors hover:border-hairline-strong"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[18px] font-semibold">{app.name}</h2>
              {app.entitlement === "pro" && (
                <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ink-faint uppercase">
                  Pro
                </span>
              )}
            </div>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-ink-soft">{app.blurb}</p>
            <span className="mt-4 text-[12.5px] font-medium text-ink-faint group-hover:text-ink">Open →</span>
          </button>
        ))}

        <div className="flex items-center justify-center rounded-xl border border-dashed border-hairline p-5 text-center text-[12.5px] text-ink-faint">
          More tools coming soon
        </div>
      </div>
    </div>
  );
}
