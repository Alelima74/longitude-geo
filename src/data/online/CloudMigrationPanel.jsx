import React, { useState } from "react";
import { backupFilename, createLocalBackup, inspectLocalBackup } from "./localBackup.mjs";
import WorkspaceImportPanel from './WorkspaceImportPanel.jsx';

export default function CloudMigrationPanel() {
  const [inventory, setInventory] = useState(null);
  const [message, setMessage] = useState("");
  const inspect = () => {
    try { const backup = createLocalBackup(localStorage); setInventory(inspectLocalBackup(backup)); setMessage("Inventário desta origem atualizado. Nenhum dado foi enviado à nuvem."); }
    catch { setMessage("Não foi possível ler o armazenamento local. Nenhum dado foi alterado."); }
  };
  const download = () => {
    try {
      const now = new Date(), backup = createLocalBackup(localStorage, now);
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = backupFilename(now); link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setInventory(inspectLocalBackup(backup));
      setMessage("Download solicitado. Confira o arquivo salvo. Ele pode conter dados pessoais: guarde em local seguro. Não inclui MDB externo, IndexedDB ou outros navegadores.");
    } catch { setMessage("Falha ao exportar backup. Não inicie a migração."); }
  };
  return <section className="enterprise-page" aria-label="Migração para nuvem">
    <h1>Migração para nuvem</h1>
    <p>A origem local é preservada. Exporte o backup antes de selecionar projetos para envio à nuvem.</p>
    <button type="button" onClick={inspect}>Conferir dados deste navegador</button>{" "}
    <button type="button" onClick={download}>Exportar backup pré-nuvem</button>
    {inventory && <><dl>
      <dt>Clientes encontrados</dt><dd>{inventory.clients}</dd>
      <dt>Imóveis encontrados</dt><dd>{inventory.properties}</dd>
      <dt>Projetos GEO encontrados</dt><dd>{inventory.geoProjects}</dd>
      <dt>Laudos encontrados</dt><dd>{inventory.evaluations}</dd>
    </dl>{inventory.problems.map(problem => <p key={problem} role="alert">{problem}</p>)}</>}
    <p role="status">{message}</p>
    <WorkspaceImportPanel/>
    <p>A contagem do inventário não inclui dados já online ou de outras origens.</p>
  </section>;
}
