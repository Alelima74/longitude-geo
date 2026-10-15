import React, { useState } from 'react';
import { createLocalBackup } from './localBackup.mjs';
import { prepareWorkspaceImport } from './workspaceImport.mjs';
import { cloudWorkspaceEnabled, workspaceRecords } from './workspaceCloud.js';
export default function WorkspaceImportPanel() {
  const [batch,setBatch]=useState(null),[selected,setSelected]=useState([]),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[messages,setMessages]=useState([]);
  const prepare = backup => { setBatch(prepareWorkspaceImport(backup)); setSelected([]); setReviewed(false); setMessages([]); };
  const readFile=async event=>{try{const file=event.target.files?.[0];if(file){if(file.size>50*1024*1024)throw new Error('Arquivo acima de 50 MB: separe os projetos antes de importar.');prepare(JSON.parse(await file.text()));}}catch(error){setMessages([error.message]);}};
  const migrate=async()=>{
    if(!reviewed||busy||!selected.length)return;setBusy(true);setMessages([]);
    const results=[];
    try{
      const existing=new Map();
      for(const kind of new Set(batch.items.filter(item=>selected.includes(item.key)).map(item=>item.kind)))existing.set(kind,new Set((await workspaceRecords(kind).list()).map(row=>String(row.id))));
      for(const item of batch.items.filter(item=>selected.includes(item.key))){
        if(existing.get(item.kind).has(String(item.record.id))){results.push(`${item.title}: já existe na nuvem; versão existente preservada.`);continue;}
        try{await workspaceRecords(item.kind).save({...item.record,...(item.kind==='evaluation'?{cloudReviewConfirmed:true}:{})});existing.get(item.kind).add(String(item.record.id));results.push(`${item.title}: salvo na nuvem.`);}
        catch(error){results.push(`${item.title}: NÃO enviado — ${error.message}`);}
      }
      results.push('Confira os resultados e atualize a base de trabalho e as listas de projetos. A origem e o backup foram preservados.');
    }catch(error){results.push(`Migração interrompida: ${error.message}`);}finally{setMessages(results);setBusy(false);}
  };
  return <section><h2>Levar projetos locais para a mesma conta na nuvem</h2><p>Selecione um backup exportado no navegador onde seus dados estão salvos. Esta etapa contempla projetos GEO, laudos, processos técnicos e a base local de clientes, imóveis e análises. Não transfere arquivos MDB, bases SIGEF volumosas, anexos binários ou os demais cadastros locais antigos.</p>
    <label>Selecionar backup JSON<input disabled={busy} type="file" accept=".json,application/json" onChange={readFile}/></label><button disabled={busy} onClick={()=>{try{prepare(createLocalBackup(localStorage));}catch(error){setMessages([error.message]);}}}>Ler dados deste navegador</button>
    {batch&&<><p>Nenhum item é enviado sem seleção. IDs já existentes são preservados, sem sobrescrita.</p>{batch.items.map(item=><label className="workspace-sync" key={item.key}><input disabled={busy} type="checkbox" checked={selected.includes(item.key)} onChange={e=>setSelected(e.target.checked?[...selected,item.key]:selected.filter(key=>key!==item.key))}/>{item.kind} · {item.title}</label>)}{batch.problems.map((problem,index)=><p role="alert" key={index}>{problem}</p>)}<label className="workspace-sync"><input type="checkbox" disabled={busy} checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>Guardei o backup e conferi os itens selecionados, inclusive eventuais dados demonstrativos dos laudos.</label><button disabled={!cloudWorkspaceEnabled()||busy||!reviewed||!selected.length} onClick={migrate}>{busy?'Enviando...':'Enviar selecionados para minha conta'}</button></>}
    {!cloudWorkspaceEnabled()&&<p>O envio está disponível na versão online após entrar na sua conta.</p>}{messages.map((message,index)=><p role="status" key={index}>{message}</p>)}
  </section>;
}
