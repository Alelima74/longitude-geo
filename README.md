# Longitude Geo Intelligence — V67 Enterprise

## O que é esta versão

A V67 Enterprise é uma versão de estabilização.

Ela parte da V64, que era a última base segura, e remove riscos introduzidos nas versões posteriores, como servidor local e GNSS ativo.

## Objetivo

Voltar o sistema a abrir normalmente e preparar uma estrutura profissional para evolução comercial.

## Atualização recomendada

Use atualização limpa, para não misturar arquivos antigos.

### Opção 1 — automática

Extraia o ZIP e execute:

```cmd
ATUALIZAR_LIMPO_V67.bat
```

### Opção 2 — manual

```cmd
set DEST=D:\COMPARTILHAMENTO\longitude-geo-mvp-v14\longitude-geo-mvp-v14

rmdir /S /Q "%DEST%\src"
rmdir /S /Q "%DEST%\public"
rmdir /S /Q "%DEST%\dist"

xcopy D:\COMPARTILHAMENTO\longitude-geo-v67-enterprise\longitude-geo-v67-enterprise\* "%DEST%\" /E /Y /I

cd /d "%DEST%"
npm install
npm run build
npm run dev
```

## Observação

Não use `npm run bases`. Esta versão não usa servidor local.

## GNSS

O GNSS Engine fica reservado em `src/components/GNSS`, mas não está ativo nesta versão para evitar tela preta.

A reintrodução recomendada é na V70, como componente isolado e testado.
