# Fase 7 — Testes Automatizados (Jest)

> Objetivo desta fase: parar de confiar só em testes manuais com `curl` (como fizemos do fim da Fase 3 em diante) e passar a ter uma suíte de testes que roda em segundos, sozinha, e denuncia regressões automaticamente. Vamos usar o **Jest** — o framework de testes mais usado do ecossistema Node/TypeScript — com **ts-jest** (para rodar TypeScript sem build prévio) e **supertest** (para simular requisições HTTP contra a API sem precisar abrir uma porta de verdade).
>
> Como nas Fases 5 e 6, esta fase já foi **implementada no seu projeto real**. Este documento explica o que foi feito e por quê.

---

## 🧠 Dois tipos de teste, dois objetivos diferentes

O TODO desta fase separa **testes unitários** (7.2) de **testes de integração** (7.3) — essa distinção não é burocracia, é uma diferença real de propósito:

| | Teste unitário | Teste de integração |
|---|---|---|
| O que testa | Uma função pura, isolada — sem banco, sem rede, sem I/O | O sistema real, de ponta a ponta: rota HTTP → controller → model → Postgres |
| Velocidade | Milissegundos | Mais lento (envolve I/O de verdade) |
| O que ele prova | "Esta lógica está matematicamente correta" | "As peças se encaixam e produzem o resultado certo" |
| Exemplo neste projeto | O cálculo do dígito verificador de um número CNJ | `POST /api/clients` devolve 201 e persiste no banco |

Um projeto saudável tem **muitos** testes unitários (rápidos, baratos, fáceis de escrever) e **alguns** testes de integração cobrindo os fluxos mais importantes (mais caros, mas pegam problemas que testes unitários nunca veriam — como um middleware na ordem errada, ou uma coluna com o nome trocado numa migration).

---

## 7.1. Configuração do Jest

### O que vamos construir e por quê

Antes de escrever qualquer teste, precisamos resolver três problemas de infraestrutura específicos deste projeto:

1. O código é **TypeScript** — o Jest, puro, só entende JavaScript.
2. O projeto é **ESM** (`"type": "module"`, imports terminando em `.js` apontando para arquivos `.ts` — Fase 1.2) — uma combinação que historicamente dá bastante dor de cabeça com Jest.
3. Os testes de integração precisam de um **banco de dados**, mas rodar contra o banco de **desenvolvimento** seria perigoso (um teste malfeito poderia apagar seus dados reais) e não-determinístico (o resultado de um teste dependeria do que já existia no banco antes dele rodar).

### Passo a passo

**1.** Instale as dependências:

```bash
npm install -D jest ts-jest @types/jest supertest @types/supertest cross-env
```

> - **`jest`** — o test runner: descobre os arquivos de teste, roda cada um, e reporta o resultado.
> - **`ts-jest`** — um *transformer* que ensina o Jest a entender arquivos `.ts` diretamente (transpila cada arquivo na hora, em memória — sem gerar uma pasta `dist/` para os testes).
> - **`@types/jest`** — as definições de tipo das funções globais do Jest (`describe`, `it`, `expect`...), para o TypeScript/seu editor reconhecê-las.
> - **`supertest`** — simula requisições HTTP contra um `Application` do Express **sem abrir uma porta de rede de verdade** — perfeito para testar `src/app.ts` isoladamente.
> - **`cross-env`** — define variáveis de ambiente (`NODE_ENV=test`) de um jeito que funciona **igual** no Windows (cmd/PowerShell) e no Linux/macOS. A sintaxe `NODE_ENV=test comando` que você viria em tutoriais só funciona nativamente em shells Unix — no Windows puro, ela quebra.

**2.** **Resolvendo o problema do ESM**: em vez de lutar contra o modo ESM "nativo" do Jest (que ainda hoje exige flags experimentais como `NODE_OPTIONS=--experimental-vm-modules` e é frágil), vamos fazer o `ts-jest` compilar os testes para **CommonJS** — um formato que o Jest sempre soube rodar sem nenhuma configuração especial. Isso não afeta em nada como o projeto roda de verdade (`npm run dev`/`npm run build` continuam gerando ESM puro, como sempre) — é uma configuração que existe **só** para os testes.

Crie `tsconfig.jest.json` na raiz do projeto:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "rootDir": ".",
    "rewriteRelativeImportExtensions": false,
    "types": ["jest", "node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

Explicando as diferenças em relação ao `tsconfig.json` principal (Fase 1.2):
- **`module: "CommonJS"`** / **`moduleResolution: "Node"`** — sobrescrevem `NodeNext`/`NodeNext` só para os testes, mandando o `ts-jest` gerar `require()` em vez de `import`, que é o que o Jest sabe interceptar nativamente.
- **`rootDir: "."`** — o `tsconfig.json` original restringe a `./src`; como os testes vivem numa pasta `tests/` **fora** de `src/`, precisamos afrouxar essa restrição só aqui.
- **`rewriteRelativeImportExtensions: false`** — essa opção (Fase 1.2) é específica do modo `NodeNext`; desligamos porque não se aplica ao modo CommonJS.
- **`types: ["jest", "node"]`** — diz explicitamente ao TypeScript quais pacotes de tipos globais (de `node_modules/@types`) carregar. Sem isso, mesmo com `@types/jest` instalado, o `ts-jest` pode não reconhecer `describe`, `it`, `expect` etc. como funções globais — e o Jest falha ao rodar com erros `TS2593: Cannot find name 'describe'` / `TS2304: Cannot find name 'expect'` em **todo** arquivo de teste, mesmo que o código dos testes esteja perfeito. Foi exatamente esse erro que apareceu ao rodar `npm test` pela primeira vez neste projeto — por isso já vem corrigido aqui.
- **`include`** — amplia para cobrir `tests/**/*` também, não só `src/**/*`.

**3.** Crie `jest.config.cjs` na raiz do projeto:

```javascript
// jest.config.cjs
//
// Extensão .cjs pelo mesmo motivo de sempre neste projeto: o
// package.json tem "type": "module", e o Jest carrega este arquivo de
// configuração com require() (CommonJS) por baixo dos panos.

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Onde encontrar os testes — mantemos tudo fora de src/, numa pasta
  // tests/ dedicada, espelhando (mas não misturando) a estrutura do
  // código de produção.
  testMatch: ['<rootDir>/tests/**/*.test.ts'],

  // Roda ANTES de qualquer arquivo de teste (e antes de qualquer
  // módulo da aplicação) ser importado. É aqui que garantimos que a
  // aplicação (que faz dotenv.config() internamente, em vários
  // arquivos) vai se conectar ao banco e ao Redis de TESTE, nunca aos
  // de desenvolvimento — ver tests/setup/env.cjs, na próxima seção.
  setupFiles: ['<rootDir>/tests/setup/env.cjs'],

  // O código-fonte usa a sintaxe NodeNext (imports terminando em ".js"
  // mesmo apontando para arquivos ".ts" — Fase 1.2). O ts-jest, rodando
  // com a configuração CommonJS acima, não entende essa reescrita
  // automaticamente. Este mapa diz ao Jest "quando vir um import
  // terminando em .js, procure o arquivo SEM essa extensão" — deixando
  // o próprio Jest resolver para o .ts real, do jeito que ele já sabe fazer.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },

  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  clearMocks: true,
};
```

**4.** **Resolvendo o problema do banco de teste isolado.** O TODO oferece duas opções: SQLite em memória, ou um Postgres `_test` separado. Optamos pelo **Postgres `_test`**, e vale explicar por quê, porque é uma decisão de teste importante:

> ⚠️ **Por que não SQLite em memória, mesmo sendo mais rápido?** O model `DeadLetterJob` (Fase 4) usa `DataTypes.JSONB` — um tipo **específico do Postgres**, sem equivalente direto no SQLite. Além disso, as migrations (Fase 2) já são escritas em SQL/Sequelize voltado a Postgres. Rodar os testes contra um banco **diferente** do de produção significaria testar um sistema **ligeiramente diferente** do que você realmente publica — um teste passando no SQLite não garante que o mesmo código funcione no Postgres real. A regra geral é: **teste contra o mesmo motor de banco que você usa em produção**, sempre que for viável. Aqui é totalmente viável (o Postgres já roda em Docker desde a Fase 1), então não há motivo para abrir mão dessa garantia só por velocidade.

Reaproveitamos a convenção que **já existia desde a Fase 2**: `src/config/config.cjs` já define um bloco `test` que aponta para `${DB_NAME}_test`. Falta só criar esse banco de verdade dentro do container do Postgres (bancos não são criados automaticamente — só o banco listado em `POSTGRES_DB` no `docker-compose.yml` é):

```bash
docker exec -it jurisengine_db psql -U postgres -c "CREATE DATABASE juris_db_test;"
```

E aplicar as migrations nele (usando o novo script `db:migrate:test`, adicionado ao `package.json` nesta fase):

```bash
npm run db:migrate:test
```

**5.** Crie `tests/setup/env.cjs` — o arquivo referenciado em `setupFiles`, acima:

```javascript
// tests/setup/env.cjs
//
// Jest "setupFiles": roda ANTES de qualquer arquivo de teste (e antes
// de qualquer módulo da aplicação) ser importado. É o único lugar
// seguro para preparar variáveis de ambiente que o restante do app
// (config/database.ts, config/redis.ts, etc.) vai ler durante o import
// — se esperássemos até dentro de um arquivo de teste normal, algum
// módulo já teria sido importado (e já teria lido process.env) antes
// de nós conseguirmos mudar qualquer coisa.

process.env.NODE_ENV = 'test';

// Os testes SEMPRE rodam no HOST (fora do Docker), mesmo que o
// Postgres e o Redis estejam containerizados. "db" e "redis" só
// resolvem como hostname DENTRO da rede do docker-compose (Fase 1) —
// do lado de fora, alcançamos os mesmos serviços via localhost, nas
// portas que o docker-compose já expõe (5432 e 6379).
process.env.DB_HOST = 'localhost';
process.env.REDIS_HOST = 'localhost';

// Redireciona a conexão do Sequelize para o banco de TESTE
// (juris_db_test) — o mesmo nome que `src/config/config.cjs` já usa
// para o ambiente "test" desde a Fase 2; reaproveitamos essa convenção
// em vez de inventar uma nova.
//
// Importante: `dotenv.config()` (chamado dentro de database.ts,
// redis.ts, etc.) NUNCA sobrescreve uma variável que já existe em
// process.env. Como este arquivo roda ANTES de qualquer import da
// aplicação, definir DB_NAME aqui garante que o valor lido do .env,
// mais tarde, não vai "vencer" por engano.
process.env.DB_NAME = `${process.env.DB_NAME || 'juris_db'}_test`;
```

> 💡 Repare que este arquivo resolve, de uma vez, um problema que já apareceu antes no guia (Fase 1): "uso `db`/`redis` como hostname dentro do Docker, `localhost` fora dele". Os testes rodam no seu terminal, na sua máquina — **fora** do Docker — então sempre precisam de `localhost`, mesmo que o `.env` do dia a dia (usado pela API dentro do container) esteja configurado com `db`.

**6.** Adicione os scripts de teste ao `package.json` (substituindo o placeholder `"test": "echo \"Error: no test specified\" && exit 1"` que existia desde a Fase 1.1):

```json
{
  "scripts": {
    "test": "cross-env NODE_ENV=test jest --runInBand",
    "test:watch": "cross-env NODE_ENV=test jest --watch --runInBand",
    "test:coverage": "cross-env NODE_ENV=test jest --coverage --runInBand",
    "db:migrate:test": "cross-env NODE_ENV=test sequelize-cli db:migrate"
  }
}
```

> 💡 **Por que `--runInBand`?** Por padrão, o Jest roda arquivos de teste **em paralelo**, em processos separados, para ser mais rápido. Isso é ótimo para testes unitários (sem efeitos colaterais), mas perigoso para testes de integração que compartilham o **mesmo** banco de dados: dois arquivos de teste rodando ao mesmo tempo poderiam se atropelar (um apagando dados que o outro estava usando naquele instante, via `truncateAllTables()` — seção 7.3). `--runInBand` roda tudo sequencialmente, num único processo — mais lento, porém previsível. Num projeto maior, a solução mais sofisticada seria dar a cada arquivo de teste seu próprio schema/transação isolada; para este projeto, sequencial é suficiente e muito mais simples de entender.

Adicione `coverage/` ao `.gitignore` (a pasta que `test:coverage` gera, com o relatório de cobertura):

```gitignore
coverage/
```

### Como confirmar que deu certo

```bash
docker compose up -d db redis
npm run db:migrate:test
npm test
```

Ainda não escrevemos nenhum teste — o Jest deve rodar e reportar `No tests found` (ou similar), sem erros de configuração. Isso já confirma que o `ts-jest`, o `moduleNameMapper` e a conexão com o banco de teste estão funcionando.

---

## 7.2. Testes Unitários

### O que vamos construir e por quê

O TODO pede para testar "regras de validação do número de processo no padrão CNJ" — e aqui esbarramos em algo que vale registrar com honestidade: **essa validação ainda não existia no projeto**. Desde a Fase 3, `createLawsuit` só confere se `cnjNumber` foi enviado (presença), nunca se ele **tem o formato certo** de um número CNJ de verdade.

Isso não é um bug das fases anteriores — é simplesmente que a validação de formato nunca tinha sido necessária até agora. A Fase 7 é o momento natural de escrevê-la, porque "testar uma regra de validação" pressupõe que a regra existe.

### Passo a passo

**1.** Crie `src/utils/cnjNumber.ts`:

```typescript
// src/utils/cnjNumber.ts
//
// Validação do número único de processo no padrão CNJ (Conselho
// Nacional de Justiça, Resolução nº 65/2008) — o mesmo formato usado
// no campo `cnjNumber` das tabelas `lawsuits` desde a Fase 2.
//
// Máscara: NNNNNNN-DD.AAAA.J.TR.OOOO  (20 dígitos no total)
//   NNNNNNN  (7 dígitos) — número sequencial do processo
//   DD       (2 dígitos) — dígito verificador (CALCULADO, não arbitrário)
//   AAAA     (4 dígitos) — ano de ajuizamento
//   J        (1 dígito)  — segmento do Judiciário (ex.: 8 = Justiça Estadual)
//   TR       (2 dígitos) — tribunal
//   OOOO     (4 dígitos) — unidade de origem (vara/comarca)

const CNJ_FORMAT_REGEX = /^(\d{7})-(\d{2})\.(\d{4})\.(\d{1})\.(\d{2})\.(\d{4})$/;

/**
 * Confere SÓ o formato (a máscara) — não confirma se o dígito
 * verificador está matematicamente correto. Útil como primeiro filtro
 * rápido (ex.: numa validação de formulário, antes de gastar
 * processamento com o cálculo do checksum).
 */
export function isValidCnjFormat(cnjNumber: string): boolean {
  return CNJ_FORMAT_REGEX.test(cnjNumber);
}

/**
 * Calcula os dois dígitos verificadores CORRETOS para os demais
 * componentes de um número CNJ, seguindo o algoritmo oficial (Art. 3º
 * da Resolução CNJ nº 65/2008) — uma variação do módulo 97 (o mesmo
 * princípio usado em IBAN e em linhas digitáveis de boleto bancário),
 * que existe para detectar erros de digitação (dígitos trocados,
 * invertidos, etc.) sem precisar consultar nenhum banco de dados.
 *
 * Usamos `BigInt` porque o número formado pela concatenação de todos
 * os componentes chega a ter até 20 dígitos — muito além do limite de
 * precisão segura de um `number` do JavaScript (2^53 ≈ 16 dígitos),
 * que já começaria a arredondar o resultado de forma incorreta.
 */
function calculateCheckDigits(
  sequential: string,
  year: string,
  segment: string,
  court: string,
  originUnit: string
): string {
  // "00" no final, no lugar dos dígitos verificadores reais — é assim
  // que o algoritmo oficial define o número-base sobre o qual o
  // módulo 97 é calculado.
  const base = BigInt(`${sequential}${year}${segment}${court}${originUnit}00`);
  const remainder = base % 97n;
  const checkDigits = (98n - remainder) % 97n;
  return checkDigits.toString().padStart(2, '0');
}

/**
 * Validação COMPLETA: formato + dígito verificador. É esta função que
 * você deveria chamar sempre que precisar confirmar que um número CNJ
 * é genuíno (bate com o algoritmo oficial) — não só "parece" um.
 */
export function isValidCnjNumber(cnjNumber: string): boolean {
  const match = cnjNumber.match(CNJ_FORMAT_REGEX);
  if (!match) return false;

  const [, sequential, providedCheckDigits, year, segment, court, originUnit] = match;
  const expectedCheckDigits = calculateCheckDigits(sequential, year, segment, court, originUnit);

  return providedCheckDigits === expectedCheckDigits;
}
```

> 💡 **Por que dois exports (`isValidCnjFormat` e `isValidCnjNumber`) em vez de um só?** Formato e checksum são preocupações diferentes, e separá-las facilita testar cada uma isoladamente (você vai ver isso já já, nos `describe` separados do teste). Também deixa a API do módulo mais flexível: um formulário de front-end pode querer feedback **instantâneo** de formato enquanto o usuário digita (`isValidCnjFormat`, síncrono e barato), e só validar o checksum completo (`isValidCnjNumber`) no `submit`.

**2.** Crie `tests/unit/cnjNumber.test.ts`:

```typescript
// tests/unit/cnjNumber.test.ts
//
// Teste UNITÁRIO (Fase 7.2): testa `src/utils/cnjNumber.ts` isolado,
// sem tocar banco de dados, sem subir a API — é por isso que ele roda
// em milissegundos, e por isso NÃO precisa do `truncateAllTables()` /
// `closeTestDatabase()` que os testes de integração (Fase 7.3) usam.

import { isValidCnjFormat, isValidCnjNumber } from '../../src/utils/cnjNumber.js';

describe('isValidCnjFormat (só a máscara, sem checar o dígito verificador)', () => {
  it('aceita o formato correto: 7 dígitos, DD, ano, segmento, tribunal, unidade', () => {
    expect(isValidCnjFormat('0001234-72.2024.8.19.0001')).toBe(true);
  });

  it.each([
    ['0001234-72.2024.8.19.001', 'faltando 1 dígito na unidade de origem'],
    ['00012347220248190001', 'sem nenhuma pontuação/máscara'],
    ['abcdefg-72.2024.8.19.0001', 'sequencial não numérico'],
    ['', 'string vazia'],
    ['0001234-72.2024.88.19.0001', 'segmento do judiciário com 2 dígitos em vez de 1'],
  ])('rejeita "%s" (%s)', (invalid) => {
    expect(isValidCnjFormat(invalid)).toBe(false);
  });
});

describe('isValidCnjNumber (formato + dígito verificador, algoritmo oficial)', () => {
  // Estes 4 números foram gerados calculando o dígito verificador de
  // verdade (módulo 97) para dados fictícios — não são números de
  // processos reais, mas SÃO matematicamente válidos segundo o
  // algoritmo do CNJ, o que é exatamente o que este teste verifica.
  it.each([
    '0001234-72.2024.8.19.0001',
    '0007654-27.2023.8.19.0002',
    '0009999-32.2024.8.19.0001',
    '0000001-40.2024.8.19.0001',
  ])('aceita um número com dígito verificador correto: %s', (valid) => {
    expect(isValidCnjNumber(valid)).toBe(true);
  });

  it('rejeita quando o formato está certo mas o dígito verificador está errado', () => {
    // Mesmo número sequencial/ano/segmento/tribunal/origem do primeiro
    // caso acima ('0001234-72...'), mas com "56" no lugar do "72" —
    // um erro de digitação típico que o checksum existe para pegar.
    expect(isValidCnjNumber('0001234-56.2024.8.19.0001')).toBe(false);
  });

  it('rejeita antes mesmo de calcular o dígito, se o formato já estiver errado', () => {
    expect(isValidCnjNumber('numero-completamente-invalido')).toBe(false);
  });
});
```

> 📝 **De onde vieram os números "válidos" usados no teste?** Foram calculados executando o próprio algoritmo (a mesma fórmula de `calculateCheckDigits`) para alguns dados fictícios de sequencial/ano/tribunal — não são números de processos reais, existem só para o teste. Interessante notar: **nenhum** dos números CNJ fictícios usados nos exemplos de `curl` das Fases 3 a 6 deste guia (como `0001234-56.2024.8.19.0001`, usado no seeder da Fase 2) passa nesse checksum — eles foram inventados sem seguir o algoritmo oficial, só para servir de exemplo de formato. Isso é proposital e está tudo bem: veja a nota abaixo sobre por que a Fase 7 não força essa validação na API.

> ⚠️ **Uma decisão consciente: por que este validador NÃO está conectado a `createLawsuit`.** Seria natural imaginar que o próximo passo é substituir a validação de presença em `lawsuit.controller.ts` por `isValidCnjNumber`. Decidimos **não** fazer isso automaticamente nesta fase, por um motivo prático: todos os números CNJ fictícios usados nos exemplos das Fases 3-6 (inclusive no seeder) falhariam nesse checksum, quebrando os comandos `curl` que você já testou manualmente ao longo do guia. Se você quiser ativar a validação estrita agora que sabe como ela funciona, a mudança é de uma linha só:
> ```typescript
> // src/controllers/lawsuit.controller.ts
> import { isValidCnjNumber } from '../utils/cnjNumber.js';
> // ...dentro de createLawsuit, após o check de presença:
> if (!isValidCnjNumber(cnjNumber)) {
>   throw new AppError('Número CNJ inválido (formato ou dígito verificador incorreto).', 422);
> }
> ```
> Se ativar, use daqui pra frente números CNJ **matematicamente válidos** nos seus testes manuais — por exemplo, os mesmos usados no teste acima: `0001234-72.2024.8.19.0001`, `0007654-27.2023.8.19.0002`, `0009999-32.2024.8.19.0001`, `0000001-40.2024.8.19.0001`.

### Como confirmar que deu certo

```bash
npm test -- cnjNumber
```

> `npm test -- <padrão>` repassa `<padrão>` como argumento para o Jest, que roda só os arquivos de teste cujo caminho contém aquele texto — útil para rodar um arquivo específico sem esperar a suíte inteira.

Você deve ver todos os testes de `cnjNumber.test.ts` passando (`PASS`), rodando em poucos milissegundos — nenhum deles toca banco de dados ou rede.

---

## 7.3. Testes de Integração (API)

### O que vamos construir e por quê

Testes de integração confirmam que as peças **se encaixam de verdade**: que uma requisição HTTP realmente vira uma linha no Postgres, que os códigos de status batem com o que a Fase 3 definiu, e que os erros vêm no formato certo (o `errorHandler` da Fase 3.1).

### Passo a passo

**1.** Crie `tests/setup/testDatabase.ts` — um helper reaproveitado por todos os testes de integração:

```typescript
// tests/setup/testDatabase.ts
//
// Helper de apoio para os testes de integração: garante que cada teste
// começa com as tabelas VAZIAS, sem depender da ordem de execução dos
// outros testes, e fecha TODAS as conexões abertas ao importar a
// aplicação (Postgres, Redis, fila BullMQ) ao final da suíte — sem
// isso, o Jest fica "pendurado" esperando o processo terminar, porque
// essas conexões mantêm o event loop vivo.

import { sequelize } from '../../src/models/index.js';
import { redisConnection } from '../../src/config/redis.js';
import { lawsuitSyncQueue } from '../../src/queues/lawsuitSync.queue.js';

/**
 * Apaga todas as linhas de todas as tabelas gerenciadas pelo Sequelize
 * (`cascade: true` faz o Postgres limpar junto quem depende via FK).
 *
 * Preferimos isto a recriar o schema do zero a cada teste
 * (`sequelize.sync({ force: true })`): é bem mais rápido, e o schema
 * já é gerenciado pelas migrations — rodadas uma única vez,
 * manualmente, contra o banco de teste (Fase 7.1: `npm run db:migrate:test`).
 */
export async function truncateAllTables(): Promise<void> {
  const models = Object.values(sequelize.models);
  for (const model of models) {
    await model.destroy({ where: {}, truncate: true, cascade: true, force: true });
  }
}

/**
 * Fecha a conexão do Sequelize, a fila BullMQ e a conexão Redis
 * compartilhada. Chame isto UMA VEZ, num `afterAll`, ao final de cada
 * arquivo de teste que importa `src/app.ts` (que, transitivamente, via
 * o Bull Board — Fase 4.3 — já abre uma conexão Redis e cria a fila,
 * mesmo que o teste em si nunca dispare um job).
 *
 * Nota: `lawsuitSyncQueue.close()` NÃO fecha a conexão Redis
 * subjacente quando ela foi criada FORA do BullMQ (é o nosso caso —
 * `redisConnection`, de config/redis.ts, é compartilhada e "dona" de
 * si mesma). Por isso fechamos as duas coisas separadamente.
 */
export async function closeTestDatabase(): Promise<void> {
  await lawsuitSyncQueue.close();
  await sequelize.close();
  await redisConnection.quit();
}
```

> 💡 **Por que essas conexões existem mesmo num teste que só chama `/api/clients`?** Porque `src/app.ts` importa `admin/bullBoard.ts` (Fase 4.3), que importa `queues/lawsuitSync.queue.ts` (Fase 4.2a), que cria a `Queue` do BullMQ conectada ao Redis **assim que o módulo é carregado** — não só quando alguém de fato usa a fila. É uma consequência direta de como o `import` funciona em JavaScript: importar um arquivo executa TODO o código de nível superior dele, mesmo que você só queira usar uma função específica lá de dentro.

**2.** Crie `tests/integration/clients.test.ts`:

```typescript
// tests/integration/clients.test.ts
//
// Teste de INTEGRAÇÃO (Fase 7.3): usa o `supertest` para simular
// requisições HTTP reais contra `src/app.ts` — sem precisar subir um
// servidor de verdade escutando uma porta (`supertest` conversa
// diretamente com o request handler do Express em memória). As
// requisições atravessam TODAS as camadas reais: rotas, middlewares,
// controllers e o Postgres de teste (juris_db_test) — só o Worker e o
// Socket.IO ficam de fora, porque `app.ts` nunca os importa (é
// exatamente por isso que a Fase 3 manteve `app.ts` e `server.ts`
// separados — ver a Fase 5.1 do guia).

import request from 'supertest';
import app from '../../src/app.js';
import { truncateAllTables, closeTestDatabase } from '../setup/testDatabase.js';

describe('API de Clientes', () => {
  afterEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('POST /api/clients', () => {
    it('cria um cliente com dados válidos e responde 201', async () => {
      const response = await request(app)
        .post('/api/clients')
        .send({ name: 'Maria Teste', document: '111.111.111-11', email: 'maria@example.com' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'Maria Teste',
        document: '111.111.111-11',
        email: 'maria@example.com',
      });
      expect(response.body.id).toEqual(expect.any(String));
    });

    it('responde 422 quando falta o campo obrigatório "document"', async () => {
      const response = await request(app).post('/api/clients').send({ name: 'Sem Documento' });

      expect(response.status).toBe(422);
      expect(response.body.error.message).toMatch(/obrigat/i);
    });

    it('responde 409 ao tentar cadastrar um documento duplicado', async () => {
      await request(app).post('/api/clients').send({ name: 'Cliente 1', document: '222.222.222-22' });

      const response = await request(app)
        .post('/api/clients')
        .send({ name: 'Cliente 2 (mesmo documento)', document: '222.222.222-22' });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/duplicado/i);
    });
  });

  describe('GET /api/clients', () => {
    it('lista clientes com paginação', async () => {
      await request(app).post('/api/clients').send({ name: 'Cliente A', document: 'doc-a' });
      await request(app).post('/api/clients').send({ name: 'Cliente B', document: 'doc-b' });

      const response = await request(app).get('/api/clients').query({ page: 1, limit: 1 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
    });
  });

  describe('GET /api/clients/:id', () => {
    it('responde 404 para um id que não existe', async () => {
      const response = await request(app).get('/api/clients/00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toMatch(/não encontrado/i);
    });
  });
});
```

**3.** Crie `tests/integration/lawsuits.test.ts`:

```typescript
// tests/integration/lawsuits.test.ts
//
// Teste de INTEGRAÇÃO (Fase 7.3) do fluxo de processos (lawsuits) — o
// mesmo espírito de tests/integration/clients.test.ts, cobrindo o
// "caminho feliz" (criar e depois consultar) e os principais caminhos
// de erro.

import request from 'supertest';
import app from '../../src/app.js';
import { truncateAllTables, closeTestDatabase } from '../setup/testDatabase.js';

/**
 * Cria um cliente de apoio via a própria API (em vez de usar o model
 * Sequelize diretamente) — assim o teste também exercita, de
 * propósito, o mesmo caminho que um cliente HTTP real usaria.
 * `document` recebe um valor único por chamada para nunca esbarrar na
 * constraint UNIQUE entre um teste e outro.
 */
async function createTestClient(): Promise<string> {
  const response = await request(app)
    .post('/api/clients')
    .send({ name: 'Cliente de Teste', document: `doc-${Date.now()}-${Math.random()}` });
  return response.body.id as string;
}

describe('API de Processos (Lawsuits)', () => {
  afterEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('POST /api/lawsuits', () => {
    it('vincula um processo a um cliente existente e responde 201', async () => {
      const clientId = await createTestClient();

      const response = await request(app)
        .post('/api/lawsuits')
        .send({ cnjNumber: '0001234-72.2024.8.19.0001', clientId });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        cnjNumber: '0001234-72.2024.8.19.0001',
        clientId,
        status: 'PENDING', // valor padrão definido na migration/model (Fase 2)
      });
    });

    it('responde 422 quando falta "cnjNumber" ou "clientId"', async () => {
      const response = await request(app).post('/api/lawsuits').send({ cnjNumber: '0001234-72.2024.8.19.0001' });

      expect(response.status).toBe(422);
    });

    it('responde 404 quando o cliente informado não existe', async () => {
      const response = await request(app).post('/api/lawsuits').send({
        cnjNumber: '0001234-72.2024.8.19.0001',
        clientId: '00000000-0000-0000-0000-000000000000',
      });

      expect(response.status).toBe(404);
      expect(response.body.error.message).toMatch(/não existe/i);
    });
  });

  describe('GET /api/lawsuits/:id', () => {
    it('retorna o processo com o cliente incluído e a lista de movimentações (vazia)', async () => {
      const clientId = await createTestClient();
      const created = await request(app)
        .post('/api/lawsuits')
        .send({ cnjNumber: '0007654-27.2023.8.19.0002', clientId });

      const response = await request(app).get(`/api/lawsuits/${created.body.id}`);

      expect(response.status).toBe(200);
      expect(response.body.client.id).toBe(clientId);
      // Nenhuma sincronização foi disparada neste teste (não chamamos
      // /batch-import) — por isso o histórico começa vazio.
      expect(response.body.movements).toEqual([]);
    });

    it('responde 404 para um processo que não existe', async () => {
      const response = await request(app).get('/api/lawsuits/00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(404);
    });
  });
});
```

> 💡 **Por que `afterEach` limpa as tabelas em vez de `beforeEach`?** As duas abordagens funcionam, mas `afterEach` tem uma vantagem para depuração: se um teste falhar, os dados que ele deixou no banco continuam lá até o **próximo** teste rodar — dando a você a chance de investigar o estado real do banco (com `psql`, por exemplo) antes que ele seja apagado. Com `beforeEach`, o estado de uma falha já teria sido limpo antes que você conseguisse olhar.

> 💡 **Por que não testamos `/api/lawsuits/batch-import` aqui?** Esse endpoint dispara jobs assíncronos de verdade (Fase 4) — testá-lo de forma determinística exigiria também controlar o Worker (esperar o job processar, ou mockar `fetchTribunalMovements` para não depender do delay/falha aleatórios do simulador). Isso é um teste de integração de **outro nível** (às vezes chamado de teste "end-to-end"), fora do escopo que o TODO desta fase pediu. Se quiser se aprofundar por conta própria: a estratégia mais comum seria mockar `fetchTribunalMovements` com `jest.mock()` para retornar um valor determinístico, chamar o endpoint, e então chamar `await lawsuitSyncWorker.run()` manualmente no teste (em vez de esperar o worker de produção pegar o job sozinho).

### Como confirmar que deu certo

```bash
docker compose up -d db redis
npm run db:migrate:test
npm test
```

Você deve ver os três arquivos de teste passando: `cnjNumber.test.ts`, `clients.test.ts` e `lawsuits.test.ts` — algo como:

```
PASS  tests/unit/cnjNumber.test.ts
PASS  tests/integration/clients.test.ts
PASS  tests/integration/lawsuits.test.ts

Test Suites: 3 passed, 3 total
Tests:       17 passed, 17 total
```

Tente também quebrar alguma coisa de propósito (por exemplo, comente a linha que faz `Client.findByPk(clientId)` dentro de `createLawsuit`) e rode `npm test` de novo — você deve ver o teste correspondente falhar, com uma mensagem clara apontando exatamente o que quebrou. Desfaça a alteração depois.

---

## 📁 Estrutura de pastas e arquivos — o que foi adicionado nesta fase

```
Sistema_Treino/
├── jest.config.cjs              ← NOVO
├── tsconfig.jest.json            ← NOVO
├── package.json                   ← ALTERADO (+scripts test/test:watch/test:coverage/db:migrate:test)
├── .gitignore                      ← ALTERADO (+coverage/)
├── src/
│   └── utils/
│       └── cnjNumber.ts            ← NOVO (Fase 7.2)
└── tests/
    ├── setup/
    │   ├── env.cjs                  ← NOVO (variáveis de ambiente para os testes)
    │   └── testDatabase.ts           ← NOVO (limpar tabelas + fechar conexões)
    ├── unit/
    │   └── cnjNumber.test.ts          ← NOVO (Fase 7.2)
    └── integration/
        ├── clients.test.ts             ← NOVO (Fase 7.3)
        └── lawsuits.test.ts             ← NOVO (Fase 7.3)
```

---

✅ **Fim da Fase 7.** O projeto agora tem uma rede de segurança automatizada: qualquer alteração futura em `cnjNumber.ts`, nos controllers de clientes/processos, ou nos middlewares de erro, é verificada em segundos, sem depender de você lembrar de testar cada endpoint manualmente com `curl` de novo. Os testes de integração também documentam, em código executável, exatamente qual comportamento a API garante — algo que nenhuma documentação escrita à mão consegue manter tão atualizado.
