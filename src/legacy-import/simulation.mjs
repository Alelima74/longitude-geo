import { METRICA_TOPO_PRESET, unmappedFields } from "./presets/metricaTopo.mjs";

export function buildImportSimulation(analysis, mode="SIMULATE") {
  if (!analysis?.tables) throw new Error("Análise do banco legado não disponível.");
  const byName = Object.fromEntries(analysis.tables.map((table)=>[table.name,table]));
  const issueCount = (table, kind) => analysis.issues.filter((issue)=>issue.table===table && (!kind || issue.kind===kind)).reduce((sum,issue)=>sum+issue.count,0);
  const entities = [
    ["Clientes","CadCliente"], ["Organizações / técnicos","CadEmpresa"], ["Imóveis","CadImovel"],
    ["Matrículas","CadMatricula"], ["Proprietários","CadProprietario"], ["Serviços","CadServico"],
  ].map(([label,table])=>({label,table,found:byName[table]?.count||0,review:issueCount(table),ready:Math.max(0,(byName[table]?.count||0)-issueCount(table,"EMPTY")),create:mode==="SIMULATE"?(byName[table]?.count||0):0,update:0}));
  return {
    mode, preset: METRICA_TOPO_PRESET.label, entities,
    totals: { found:entities.reduce((s,x)=>s+x.found,0), ready:entities.reduce((s,x)=>s+x.ready,0), review:analysis.totals.incomplete+analysis.totals.orphanedRelationships, duplicates:analysis.totals.duplicateGroups, errors:0, writes:0 },
    mappings: analysis.tables.map((table)=>({table:table.name,entity:METRICA_TOPO_PRESET.tables[table.name]?.entity||"Sem destino",mapped:Object.entries(METRICA_TOPO_PRESET.tables[table.name]?.fields||{}),unmapped:unmappedFields(table)})),
  };
}
