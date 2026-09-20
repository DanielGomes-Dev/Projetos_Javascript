# 01 — Iniciando o Projeto

## 🎯 Objetivo

Criar a pasta do projeto e o `package.json` — o "documento de identidade" de qualquer projeto Node: nome, versão, scripts, dependências.

## Passo a passo

**1.** Crie e entre na pasta do projeto:

```bash
mkdir Sistema_Treino
cd Sistema_Treino
```

**2.** Confirme sua versão do Node (precisa ser 22 ou superior):

```bash
node -v
```

**3.** Inicialize o `package.json`:

```bash
npm init -y
```

Isso cria um `package.json` com valores padrão. Abra-o e ajuste manualmente para:

```json
{
  "name": "sistema_treino",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "module"
}
```

> 💡 **O que é `"type": "module"`, e por que definir isso já no primeiro passo?** Node.js suporta dois sistemas de módulos: **CommonJS** (`require()`/`module.exports` — o padrão histórico do Node) e **ESM** — *ECMAScript Modules* (`import`/`export` — o padrão oficial do JavaScript moderno, o mesmo usado no navegador). `"type": "module"` diz ao Node "todo arquivo `.js` deste projeto é ESM por padrão". Escolhemos ESM porque é o padrão do JavaScript moderno, e porque o TypeScript (próximo passo) gera código mais previsível em cima de ESM.
>
> Essa decisão, tomada agora, tem uma consequência que vai aparecer mais adiante neste guia: qualquer arquivo de **configuração** de uma ferramenta que só entenda CommonJS (`jest.config`, `ecosystem.config` do PM2) vai precisar da extensão `.cjs` em vez de `.js`, para "escapar" da regra ESM só naquele arquivo específico. Você vai ver isso a partir do passo 27.
>
> 💡 **Diferença em relação à V2 (que usava PostgreSQL/Sequelize):** lá, o primeiro arquivo `.cjs` aparecia já no passo 09, porque o `sequelize-cli` (uma ferramenta de linha de comando externa) exigia um arquivo de configuração em CommonJS puro. O MongoDB, com o Mongoose (que você vai conhecer no passo 09 desta V3), não tem uma CLI externa equivalente — toda a configuração do banco vive dentro do próprio código TypeScript da aplicação. Isso significa que este projeto passa bem mais tempo "só em TypeScript/ESM", sem nenhum arquivo `.cjs`, até o PM2 entrar em cena.

## ✅ Como confirmar que funcionou

```bash
cat package.json
```

Deve mostrar o conteúdo acima, com `"type": "module"` presente.

## 🔧 Commit sugerido

Ainda não existe repositório Git — isso é o próximo passo (`02`). Não commite ainda.

## 📚 Documentação Oficial

- **Node.js** — instalação, versões e API nativa: https://nodejs.org/en/docs
- **npm — `package.json`** (referência completa de todos os campos): https://docs.npmjs.com/cli/v11/configuring-npm/package-json
- **npm — comando `init`**: https://docs.npmjs.com/cli/v11/commands/npm-init
- **Node.js — ESM (`"type": "module"`, `import`/`export`)**: https://nodejs.org/api/esm.html
