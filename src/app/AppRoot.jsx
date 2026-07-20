import React from "react";
import ErrorBoundary from "./ErrorBoundary";
import LegacyWorkspace from "../legacy/LegacyWorkspace";

/**
 * Raiz estável da aplicação.
 * As próximas telas serão extraídas gradualmente do LegacyWorkspace,
 * sem interromper as funcionalidades que já estão em produção.
 */
export default function AppRoot() {
  return (
    <ErrorBoundary>
      <LegacyWorkspace />
    </ErrorBoundary>
  );
}
