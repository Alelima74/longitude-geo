# Longitude Geo V69.1 — Cloud Importer

## Ordem obrigatória

1. No Supabase SQL Editor, execute `supabase/02_cloud_importer_admin.sql`.
2. No Supabase, abra **Authentication → Users** e crie seu usuário de acesso.
3. Abra `supabase/03_definir_primeiro_admin.sql`, troque `SEU_EMAIL_AQUI` pelo e-mail criado e execute no SQL Editor.
4. Saia e entre novamente no sistema para o token receber o perfil `admin`.
5. Copie a URL e a chave publicável em **Project Settings/API Keys**.
6. Crie `.env.local` na pasta oficial do projeto:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
```

7. No Vercel, cadastre as mesmas duas variáveis.
8. Execute `npm install`, `npm run build` e `npm run dev`.

## Limite desta versão

O ZIP é processado no navegador do notebook administrador. No plano gratuito, o arquivo original está limitado a 50 MB. Para arquivos nacionais muito grandes, será necessário o processador servidor da próxima versão. Esta limitação foi mantida explícita para evitar prometer um upload que o plano atual não suporta.
