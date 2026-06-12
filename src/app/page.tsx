"use client";

import App from "@/components/App";
import { AuthProvider } from "@/state/auth";
import { ProjectProvider } from "@/state/store";

export default function Page() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <App />
      </ProjectProvider>
    </AuthProvider>
  );
}
