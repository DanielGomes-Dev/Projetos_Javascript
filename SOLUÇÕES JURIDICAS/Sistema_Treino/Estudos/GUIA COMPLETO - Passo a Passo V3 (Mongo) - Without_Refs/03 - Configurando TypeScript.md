# 03 — Configurando TypeScript

## 🎯 Objetivo

Adicionar TypeScript ao projeto e confirmar que um arquivo `.ts` roda de ponta a ponta (compila e executa), antes de escrever qualquer código de verdade.

## 📦 Instalar

```bash
npm install -D typescript @types/node tsx
```

> - **`typescript`** — o compilador (`tsc`), que traduz `.ts` para `.js`.
> - **`@types/node`** — as definições de tipo das APIs nativas do Node (`process`, `fs`, etc.), para o TypeScript entender o que essas funções esperam/retornam.
> - **`tsx`** — executa arquivos `.ts` **diretamente**, sem gerar `.js` antes (compila em memória, na hora). Usado durante o desenvolvimento; `tsc` continua existindo para gerar o build de produção (você vai ver isso a partir do passo 07/28).

## 📝 Código

Crie `tsconfig.json` na raiz:

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,

    "esModuleInterop": true,
    "skipLibCheck": true,

    "forceConsistentCasingInFileNames": true,
    "rewriteRelativeImportExtensions": true,
    "erasableSyntaxOnly": true
  },
  "include": ["src/**/*"]
}
```

Explicando as opções menos óbvias:
- **`module`/`moduleResolution: "NodeNext"`** — o modo do TypeScript feito especificamente para combinar com `"type": "module"` do `package.json` (passo 01). Ele exige que todo `import` relativo termine com `.js` (mesmo importando um arquivo `.ts` — o compilador entende que, depois de compilado, o arquivo vai se chamar `.js`).
- **`rewriteRelativeImportExtensions: true`** — permite que você escreva `import './foo.ts'` durante o desenvolvimento (mais natural) e o compilador reescreve para `.js` automaticamente na hora de gerar o `dist/`.
- **`rootDir: "./src"`** — todo o código-fonte vive dentro de `src/` (você vai criar essa pasta no próximo passo). Isso mantém a raiz do projeto livre de código, só com configuração.
- **`strict: false`** — deliberadamente mais permissivo, para focar o aprendizado na arquitetura do projeto em vez de lutar contra o sistema de tipos o tempo todo. Sinta-se livre para trocar por `true` depois de terminar o guia, como exercício.

Crie a pasta `src/` com um arquivo de teste temporário, só para confirmar que a engrenagem funciona:

```typescript
// src/teste-typescript.ts
const mensagem: string = 'TypeScript configurado com sucesso!';
console.log(mensagem);
```

Adicione um script temporário ao `package.json` (você vai substituir por scripts de verdade no passo 05):

```json
{
  "scripts": {
    "dev": "tsx watch src/teste-typescript.ts"
  }
}
```

## ✅ Como confirmar que funcionou

```bash
npm run dev
```

Deve imprimir `TypeScript configurado com sucesso!` no terminal, sem erros. Pressione `Ctrl+C` para parar (o `watch` do `tsx` mantém o processo rodando, reiniciando a cada mudança de arquivo — útil a partir de agora).

Depois, apague `src/teste-typescript.ts` — ele cumpriu seu papel de confirmação e não faz parte do projeto real.

## 🔧 Commit sugerido

```bash
git add tsconfig.json package.json package-lock.json
git commit -m "chore: configurar typescript"
```
