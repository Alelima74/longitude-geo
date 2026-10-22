import React from "react";
import ErrorBoundary from "./ErrorBoundary";
import LegacyWorkspace from "../legacy/LegacyWorkspace";
import PwaInstallButton from "../components/PwaInstallButton";
import WorkspaceAuthGate from "../data/online/WorkspaceAuthGate.jsx";

export default function AppRoot() {
  return (
    <ErrorBoundary>
      <WorkspaceAuthGate><LegacyWorkspace /></WorkspaceAuthGate>
      <PwaInstallButton />
    </ErrorBoundary>
  );
}
