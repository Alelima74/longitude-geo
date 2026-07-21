import React from "react";
import ErrorBoundary from "./ErrorBoundary";
import LegacyWorkspace from "../legacy/LegacyWorkspace";
import PwaInstallButton from "../components/PwaInstallButton";

export default function AppRoot() {
  return (
    <ErrorBoundary>
      <LegacyWorkspace />
      <PwaInstallButton />
    </ErrorBoundary>
  );
}
