# 01 — Iniciando o Projeto

## 🎯 Objetivo

Criar a pasta do projeto, o `package.json` e a estrutura de diretórios que todo o resto do guia vai preencher aos poucos. Nada de código de verdade ainda — só a fundação.

## Passo a passo

**1.** Crie e entre na pasta do projeto:

```bash
mkdir backend-matriculas
cd backend-matriculas
```

**2.** Confirme sua versão do Node instalada:

```bash
node -v
```

Registre a versão mínima suportada num arquivo `.nvmrc` na raiz (ajuste para a sua versão real):

```
20
```

> 💡 **Para que serve o `.nvmrc`?** Se você (ou outra pessoa) usa o `nvm` (Node Version Manager), rodar `nvm use` dentro da pasta do projeto troca automaticamente para a versão declarada aqui — evita o clássico "funciona na minha máquina" causado por versões de Node diferentes.

**3.** Inicialize o `package.json`:

```bash
npm init -y
```

Abra o arquivo gerado e ajuste manualmente para:

```json
{
  "name": "backend-matriculas",
  "version": "1.0.0",
  "description": "Backend Express + MongoDB para matrículas e bolsas",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "keywords": ["nodejs", "express", "mongodb", "mongoose", "backend"],
  "author": "",
  "license": "ISC",
  "engines": {
    "node": ">=20"
  }
}
```

> 💡 **Por que este projeto usa CommonJS (`require`/`module.exports`), e não ESM (`import`/`export`)?** Diferente de outros guias que optam por `"type": "module"`, aqui ficamos no padrão histórico do Node — mais simples de combinar com Jest sem nenhuma configuração extra (não é preciso `moduleNameMapper`, `ts-jest`, nem se preocupar com extensão `.js` em imports relativos). Para o tamanho e objetivo deste projeto, CommonJS remove uma camada inteira de configuração sem custo real.
>
> 💡 **Por que `main` já aponta para `src/server.js`, que ainda não existe?** É só uma declaração de intenção — o campo `main` do `package.json` não é validado por `npm init`, e o arquivo vai existir a partir do capítulo 03. Adiantar essa decisão agora evita ter que voltar aqui depois.

**4.** Crie a estrutura de pastas que o projeto vai usar (vazias por enquanto, exceto por um `.gitkeep` se sua ferramenta não versionar pastas vazias):

```bash
mkdir -p src/models src/controllers src/services src/routes src/utils src/queue
mkdir -p tests/unit tests/helpers
```

Isso reflete a arquitetura em camadas que o projeto inteiro vai seguir:

```
route -> controller -> service -> model
```

- **`routes/`** só declara os caminhos HTTP e aponta para o controller certo.
- **`controllers/`** são finos: leem `req.body`/`req.params`/`req.query`, chamam o service, e traduzem o retorno em status HTTP.
- **`services/`** concentram as regras de negócio — a camada testável sem precisar subir um servidor HTTP.
- **`models/`** carregam o schema Mongoose e os métodos de acesso ao banco que precisam ser atômicos.
- **`utils/`** guarda funções puras (validação, erros tipados) reaproveitadas por várias camadas.
- **`queue/`** guarda a fila técnica introduzida no capítulo 13.

> 💡 **Por que decidir essa estrutura agora, com pastas vazias, em vez de criar cada pasta "quando precisar"?** Duas razões práticas: primeiro, ter a árvore visível desde o início ajuda a enxergar o tamanho do projeto de cara. Segundo — e mais importante — é mais fácil de acompanhar num guia sequencial: cada capítulo daqui em diante diz exatamente em qual pasta cada arquivo novo entra, sem ambiguidade.

## ✅ Como confirmar que funcionou

```bash
cat package.json
find src tests -type d
```

Deve mostrar o `package.json` acima e as sete pastas criadas.

## 🔧 Commit sugerido

Ainda não existe repositório Git — isso é o próximo passo (capítulo 02). Não commite ainda.

## 📚 Documentação Oficial

- **Node.js** — instalação e documentação geral: https://nodejs.org/en/docs
- **npm — `package.json`** (referência completa de todos os campos): https://docs.npmjs.com/cli/v11/configuring-npm/package-json
- **npm — comando `init`**: https://docs.npmjs.com/cli/v11/commands/npm-init
- **Node.js — CommonJS (`require`/`module.exports`)**: https://nodejs.org/api/modules.html
