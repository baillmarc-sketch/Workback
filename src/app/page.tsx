"use client";

import App from "@/components/App";
import { ProjectProvider } from "@/state/store";

export default function Page() {
  return (
    <ProjectProvider>
      <App />
    </ProjectProvider>
  );
}
