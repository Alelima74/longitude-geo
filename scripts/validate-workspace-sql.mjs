// Banco PostgreSQL descartável em memória. Nunca conecta ao Supabase.
// Preparação: npm install --prefix tmp/workspace-db-validation --no-save --no-package-lock @electric-sql/pglite
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tmp/workspace-db-validation/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite();
const ownerA='00000000-0000-4000-8000-000000000001', ownerB='00000000-0000-4000-8000-000000000002';
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${ownerA}'),('${ownerB}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261015160000_workspace_records.sql',import.meta.url),'utf8'));
  const actor = async id => { await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`); };
  await actor(ownerA);
  await db.query("insert into public.longitude_workspace_records(kind,local_id,payload) values ('geo','project-a','{\"property\":{\"name\":\"Teste local\"}}')");
  assert.equal((await db.query('select * from public.longitude_workspace_records')).rows.length,1);
  assert.equal((await db.query("update public.longitude_workspace_records set payload='{\"edited\":true}' where local_id='project-a' and revision=1 returning revision")).rows[0].revision,2);
  assert.equal((await db.query("update public.longitude_workspace_records set payload='{}' where local_id='project-a' and revision=1 returning revision")).rows.length,0,'edição obsoleta não sobrescreve');
  await assert.rejects(db.query(`update public.longitude_workspace_records set owner_id='${ownerB}' where local_id='project-a'`), /permission denied/);
  await assert.rejects(db.query("delete from public.longitude_workspace_records where local_id='project-a'"), /permission denied/);
  await actor(ownerB);
  assert.equal((await db.query('select * from public.longitude_workspace_records')).rows.length,0,'outro usuário não lê');
  assert.equal((await db.query("update public.longitude_workspace_records set payload='{}' where local_id='project-a' returning *")).rows.length,0,'outro usuário não altera');
  await assert.rejects(db.query(`insert into public.longitude_workspace_records(owner_id,kind,local_id,payload) values ('${ownerA}','geo','forged','{}')`), /permission denied/);
  await db.query("insert into public.longitude_workspace_records(kind,local_id,payload) values ('geo','project-a','{}')");
  assert.equal((await db.query('select * from public.longitude_workspace_records')).rows[0].owner_id,ownerB,'mesmo ID é isolado por usuário');
  await actor(ownerA);
  const archive=(await db.query("update public.longitude_workspace_records set archived=true where local_id='project-a' and revision=2 returning *")).rows[0];
  assert.equal(archive.archived,true); assert.equal(archive.revision,3); assert.equal(archive.payload.edited,true);
  await db.exec('reset role; set role anon;');
  await assert.rejects(db.query('select * from public.longitude_workspace_records'),/permission denied/);
  await assert.rejects(db.query("insert into public.longitude_workspace_records(kind,local_id,payload) values ('geo','anon','{}')"),/permission denied/);
  console.log('PostgreSQL: migration, RLS de dois usuários, negação anônima, identidade, revisão e arquivamento aprovados. Nenhum acesso remoto.');
} finally { await db.close(); }
