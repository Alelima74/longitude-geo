import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceRecordAdapter, assertCloudProject } from '../src/data/online/workspaceRecordAdapter.mjs';
import { prepareWorkspaceImport } from '../src/data/online/workspaceImport.mjs';
import { createGeoRegistryProject } from '../src/modules/geoRegistry/geoRegistryModel.mjs';
import { applySaveAcknowledgement } from '../src/data/online/saveAcknowledgement.mjs';

test('confirmação de envio preserva edições novas e não aplica revisão a outro projeto',()=>{
  const submitted={id:'a',text:'Enviado',cloudRevision:1}, stored={...submitted,cloudRevision:2};
  assert.equal(applySaveAcknowledgement(submitted,submitted,stored),stored);
  const edited={...submitted,text:'Editado durante envio'};
  assert.deepEqual(applySaveAcknowledgement(edited,submitted,stored),{...edited,cloudRevision:2});
  const another={id:'b',text:'Outro projeto'};
  assert.equal(applySaveAcknowledgement(another,submitted,stored),another);
  assert.equal(applySaveAcknowledgement(null,submitted,stored),null);
});

test('dois aparelhos carregam snapshot integral e edição obsoleta falha sem sobrescrever',async()=>{
  let row=null;
  const request=async(url,options)=>{
    if(!options)return row&&!row.archived?[structuredClone(row)]:[];
    const body=JSON.parse(options.body);
    if(options.method==='POST'){if(row){const error=new Error('duplicate');error.status=409;throw error;}row={local_id:body.local_id,payload:body.payload,revision:1,updated_at:'data'};return [structuredClone(row)];}
    const revision=Number(new URL(`https://test.local${url}`).searchParams.get('revision').slice(3));
    if(revision!==row.revision)return [];
    row={...row,...body,revision:row.revision+1};return [structuredClone(row)];
  };
  const device=()=>createWorkspaceRecordAdapter({request,session:()=>({user:{id:'owner'}}),kind:'geo'});
  const saved=await device().save({id:'local-a',vertices:[{code:'V1'}],documentEdits:{request:'Texto manual'}});
  const second=(await device().list())[0];assert.deepEqual(second,saved);
  await device().save({...saved,documentEdits:{request:'Nova edição'}});
  await assert.rejects(device().save({...second,documentEdits:{request:'Obsoleta'}}),/outro aparelho/);
  assert.equal(row.payload.documentEdits.request,'Nova edição');
  await assert.rejects(device().save({id:'local-a'}),/outro aparelho/);
});
test('falha remota é propagada, sessão ausente não consulta e demonstrações são bloqueadas',async()=>{
  const offline=createWorkspaceRecordAdapter({request:async()=>{throw new Error('Sem rede');},session:()=>({user:{id:'owner'}}),kind:'geo'});
  await assert.rejects(offline.save({id:'real'}),/Sem rede/);
  const anonymous=createWorkspaceRecordAdapter({request:()=>assert.fail('Consulta indevida'),session:()=>null,kind:'geo'});
  await assert.rejects(anonymous.list(),/login/);
  for(const marker of [{isDemo:true},{sampleData:true},{status:'DEMO'}]) assert.throws(()=>assertCloudProject({id:'x',...marker}),/Demonstrações/);
});
test('laudo sem revisão explícita não é enviado e exclusão exige revisão',async()=>{
  const adapter=createWorkspaceRecordAdapter({request:()=>assert.fail('Escrita indevida'),session:()=>({user:{id:'owner'}}),kind:'evaluation'});
  await assert.rejects(adapter.save({id:'real'}),/confirmação de revisão/);
  await assert.rejects(adapter.archive('real'),/Atualize/);
});
test('hidratação GEO preserva revisão e marcação de demonstração',()=>{
  const project=createGeoRegistryProject({id:'geo-a',cloudRevision:3,sampleData:true});
  assert.equal(createGeoRegistryProject(project).cloudRevision,3);assert.equal(project.sampleData,true);
});
test('importação preserva IDs e origem, ignora demos e retira revisões de outro ambiente',()=>{
  const backup={format:'longitude-pre-cloud',version:1,records:{longitude_geo_registry_projects_v1:JSON.stringify([{id:'real',cloudRevision:8,property:{name:'Nome original'}},{id:'demo',sampleData:true}])}};
  const before=JSON.stringify(backup), result=prepareWorkspaceImport(backup);
  assert.equal(result.items.length,1);assert.equal(result.items[0].record.id,'real');assert.equal(result.items[0].record.cloudRevision,undefined);assert.equal(result.problems.length,1);assert.equal(JSON.stringify(backup),before);
});
