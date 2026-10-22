export function downloadWorkspaceCopy(record, kind) {
  const keys={geo:'longitude_geo_registry_projects_v1',evaluation:'longitude_geo_evaluation_projects_v1',technical:'longitude_geo_technical_processes_v73',workspace:'longitude_geo_mvp_v8_corrigido'};
  if(!keys[kind])throw new Error('Tipo de cópia inválido.');
  const backup={format:'longitude-pre-cloud',version:1,createdAt:new Date().toISOString(),records:{[keys[kind]]:JSON.stringify(kind==='workspace'?record.data:[record])},excludedKeys:[]};
  const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`longitude-copia-${kind}-${Date.now()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
