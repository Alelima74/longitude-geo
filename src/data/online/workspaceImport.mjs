import { assertCloudProject } from './workspaceRecordAdapter.mjs';
export function prepareWorkspaceImport(backup) {
  if (backup?.format !== 'longitude-pre-cloud' || backup.version !== 1 || !backup.records || typeof backup.records !== 'object') throw new Error('Selecione um backup pré-nuvem do Longitude.');
  const items = [], problems = [];
  const sources = [
    ['longitude_geo_registry_projects_v1', 'geo'],
    ['longitude_geo_evaluation_projects_v1', 'evaluation'],
    ['longitude_geo_technical_processes_v73', 'technical'],
  ];
  for (const [key, kind] of sources) {
    if (!(key in backup.records)) continue;
    let rows;
    try { rows = JSON.parse(backup.records[key]); if (!Array.isArray(rows)) throw new Error(); }
    catch { problems.push(`Coleção inválida preservada no backup: ${key}`); continue; }
    for (const row of rows) {
      try {
        assertCloudProject(row);
        const { cloudRevision, onlineRevision, ...record } = row;
        items.push({ key: `${kind}:${row.id}`, kind, record, title: row.property?.name || row.propertyName || row.projectName || row.name || row.id });
      } catch (error) { problems.push(`${kind}: ${row?.id || 'sem ID'} — ${error.message}`); }
    }
  }
  const root = backup.records.longitude_geo_mvp_v8_corrigido;
  if (root) {
    try {
      const data = JSON.parse(root);
      if (!['clientes','imoveis','analises'].every(key => Array.isArray(data[key]))) throw new Error();
      if (['clientes','imoveis','analises'].some(key => data[key].length)) items.push({ key:'workspace:main', kind:'workspace', record:{id:'main',data}, title:'Base local: clientes, imóveis e análises territoriais' });
    } catch { problems.push('Base de trabalho inválida: preserve o backup original para revisão.'); }
  }
  return { items, problems };
}
