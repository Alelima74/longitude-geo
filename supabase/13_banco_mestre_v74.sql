alter table if exists public.lg_properties add column if not exists cns text, add column if not exists sncr text, add column if not exists perimeter_m numeric, add column if not exists registry_office text, add column if not exists owner_name text, add column if not exists owner_document text;
alter table if exists public.cad_confrontantes add column if not exists rg text, add column if not exists qualificacao text, add column if not exists cartorio text, add column if not exists situacao text default 'Registrada';
create index if not exists idx_lg_clients_document_digits on public.lg_clients ((regexp_replace(coalesce(document,''), '\D','','g')));
create index if not exists idx_lg_properties_name_lower on public.lg_properties ((lower(coalesce(name,''))));
create index if not exists idx_cad_confrontantes_document_digits on public.cad_confrontantes ((regexp_replace(coalesce(documento,''), '\D','','g')));
select 'V74.0 BANCO MESTRE CRIADO COM SUCESSO' as resultado;