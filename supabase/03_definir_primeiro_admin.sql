-- TROQUE O E-MAIL ABAIXO PELO E-MAIL QUE VOCÊ CRIARÁ NO SUPABASE AUTH.
-- Execute uma única vez depois de criar o usuário.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'SEU_EMAIL_AQUI';

select email, raw_app_meta_data
from auth.users
where email = 'SEU_EMAIL_AQUI';
