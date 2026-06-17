"use client";

import { useState } from "react";
import AccountButton from "../AccountButton";
import { setApp } from "@/lib/toolkit";
import UsersSection from "./UsersSection";
import InvitesSection from "./InvitesSection";
import TeamsSection from "./TeamsSection";

type Section = "users" | "invites" | "teams";

/** Admin page shell: a sub-nav over the Users / Invites / Teams sections. */
export default function AdminApp() {
  const [section, setSection] = useState<Section>("users");

  const navBtn = (id: Section, label: string) => (
    <button
      className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
        section === id ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
      }`}
      onClick={() => setSection(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold">Admin</h1>
          <p className="text-[12px] text-ink-faint">Manage access, users, and teams.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
            onClick={() => setApp("workback")}
          >
            ← Workback
          </button>
          <AccountButton />
        </div>
      </header>

      <div className="mb-4 flex items-center gap-1 border-b border-hairline pb-2" role="tablist">
        {navBtn("users", "Users")}
        {navBtn("invites", "Invites")}
        {navBtn("teams", "Teams")}
      </div>

      {section === "users" && <UsersSection />}
      {section === "invites" && <InvitesSection />}
      {section === "teams" && <TeamsSection />}
    </div>
  );
}
