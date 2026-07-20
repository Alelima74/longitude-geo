# Longitude Geo V69 Cloud — configuração prática

## 1. Criar o Supabase
1. Crie um projeto no Supabase.
2. Abra **SQL Editor** e execute `supabase/01_setup_cloud.sql`.
3. Em **Authentication > Users**, crie seu usuário.
4. No usuário, adicione em `app_metadata`: `{"role":"admin"}`. A chave de administrador nunca deve ficar no navegador.

## 2. Configurar localmente
Crie `.env` na raiz:
```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICAVEL
```
Execute:
```
npm install
npm run build
npm run dev
```

## 3. Configurar no Vercel
No projeto: Settings > Environment Variables. Cadastre as duas variáveis acima para Production, Preview e Development. Faça novo deployment.

## 4. Manutenção semanal
1. Entre em **Consulta UTM / Nuvem**.
2. Faça login administrativo.
3. Selecione SIGEF, CAR ou INTERMAT, UF, data e ZIP.
4. Clique **Enviar, processar e ativar base**.
5. A versão anterior permanece ativa até a importação nova terminar.

## 5. Consulta por coordenada
1. Informe Este, Norte, fuso/zona e hemisfério.
2. Clique **Consultar SIGEF, CAR e INTERMAT**.
3. O sistema converte UTM para latitude/longitude e consulta o PostGIS.
4. A tabela e o mapa mostram todas as feições ativas que contêm o ponto.

## Limite técnico
O processamento no navegador é adequado para ZIPs estaduais moderados. Bases muito grandes podem exigir, numa próxima versão, um worker dedicado. O desenho desta versão já separa a nuvem da base local e permite acesso por qualquer dispositivo.
