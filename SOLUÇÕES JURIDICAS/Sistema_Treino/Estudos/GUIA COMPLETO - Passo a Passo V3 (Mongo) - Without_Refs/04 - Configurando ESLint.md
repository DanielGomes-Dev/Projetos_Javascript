# 04 — Configurando ESLint

## 🎯 Objetivo

Adicionar verificação automática de estilo/qualidade de código, antes de existir código de verdade para verificar — assim, cada arquivo criado a partir de agora já nasce dentro do padrão, em vez de precisar de uma "faxina" de lint no fim do projeto.

## 📦 Instalar

```bash
npm install -D eslint @eslint/js typescript-eslint globals jiti
```

> - **`eslint`** — o motor de análise estática (encontra padrões problemáticos no código: variáveis não usadas, comparações suspeitas, etc.).
> - **`@eslint/js`** — o conjunto de regras recomendadas para JavaScript puro.
> - **`typescript-eslint`** — ensina o ESLint a entender sintaxe TypeScript e adiciona regras específicas de TS (ex.: tipos não utilizados).
> - **`globals`** — listas prontas de variáveis globais conhecidas (`window`, `process`, etc.), para o ESLint não reclamar de "variável não definida" para coisas que na verdade sempre existem no ambiente.
> - **`jiti`** — o próprio ESLint não sabe executar TypeScript. Como o arquivo de configuração abaixo é `eslint.config.mts` (TypeScript), o ESLint delega a um "loader" a tarefa de transformar esse arquivo em JavaScript antes de executá-lo — e hoje esse loader é o `jiti`. Sem ele instalado, o ESLint falha ao tentar *ler a própria configuração*, com o erro `The 'jiti' library is required for loading TypeScript configuration files.` — antes mesmo de chegar a analisar qualquer arquivo `.ts` do projeto.

## 📝 Código

Crie `eslint.config.mts` na raiz:

```typescript
// eslint.config.mts
//
// Extensão .mts (não .js nem .ts): o "flat config" do ESLint moderno
// aceita configuração escrita em TypeScript diretamente, e .mts deixa
// explícito que este arquivo específico é sempre ESM — independente do
// "type" do package.json.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
]);
```

Adicione o script de lint ao `package.json`:

```json
{
  "scripts": {
    "lint": "eslint src/**/*.ts"
  }
}
```

> 💡 **Por que `globals: globals.browser`, se este é um projeto de backend (Node), não de navegador?** Na prática, o conjunto `browser` inclui a maioria das globais universais (`console`, `fetch`, etc.) que também existem no Node moderno, sem precisar somar dois conjuntos de globais manualmente. Para um projeto backend "por livro", o ideal seria `globals.node` — sinta-se livre para trocar como exercício e observar se algum lint novo aparece.

## ✅ Como confirmar que funcionou

Como `src/` está vazio agora (você apagou o arquivo de teste no passo 03), crie temporariamente um arquivo só para ver o ESLint reclamar de propósito:

```typescript
// src/teste-eslint.ts
const variavelNuncaUsada = 123;
```

```bash
npm run lint
```

Deve reportar um erro/aviso sobre `variavelNuncaUsada` não ser usada. Isso confirma que o ESLint está rodando de verdade (não só "passando" porque não há nada para checar). Apague o arquivo depois.

## 🔧 Commit sugerido

```bash
git add eslint.config.mts package.json package-lock.json
git commit -m "chore: configurar eslint"
```
