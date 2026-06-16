"use client";

import Toolkit from "@/components/Toolkit";
import { AuthProvider } from "@/state/auth";

export default function Page() {
  return (
    <AuthProvider>
      <Toolkit />
    </AuthProvider>
  );
}
