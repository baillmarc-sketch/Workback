"use client";

import Toolkit from "@/components/Toolkit";
import { AuthProvider } from "@/state/auth";
import { AccessProvider } from "@/state/access";

export default function Page() {
  return (
    <AuthProvider>
      <AccessProvider>
        <Toolkit />
      </AccessProvider>
    </AuthProvider>
  );
}
