# 📗 Guia Completo — Construção Incremental do Zero: Backend Express + MongoDB (Matrículas e Bolsas)

> Este guia reconstrói, passo a passo e do zero absoluto, o projeto `Backend-Express-Arquitetura-Arquivo-MongoDB` — um desafio técnico de backend sênior que implementa cadastro de alunos, matrícula em cursos com cálculo de bolsa por renda, controle de capacidade/fila de espera sob concorrência e cancelamento com repescagem. É irmão do guia `GUIA COMPLETO - Passo a Passo V3 (Mongo) - WithRefs`, mas não é uma tradução dele: a stack aqui é **JavaScript puro (CommonJS)**, sem TypeScript e sem ESLint, e o domínio é outro (matrículas, não processos jurídicos) — a ordem e o método de construção é que seguem o mesmo espírito.

## Como este guia é diferente de "ver o código pronto"

O projeto final já existe e está correto — mas ler um projeto pronto não ensina a **tomada de decisão** por trás dele: por que o model de matrícula tem um índice único parcial, por que existe uma fila técnica além dos updates atômicos, por que a idade é calculada por ano/mês/dia e não por diferença de datas. Este guia reconstrói o projeto **na ordem em que as decisões precisaram ser tomadas de verdade**, começando pela infraestrutura mais simples possível (um `Hello World` HTTP sem banco) e terminando na peça mais delicada (concorrência na última vaga de um curso).

## O método: TDD do início ao fim

A partir do capítulo 05 (quando a suíte de testes é configurada), **todo comportamento novo nasce de um teste que falha primeiro**:

1. **🔴 Vermelho** — escreva o teste que descreve o comportamento esperado e rode-o. Ele deve falhar (às vezes nem compila/roda, porque o arquivo ainda não existe — isso também é "vermelho").
2. **🟢 Verde** — escreva o código mínimo necessário para o teste passar. Não mais que isso.
3. **🔧 Refactor** (quando fizer sentido) — com o teste verde te protegendo, limpe a implementação sem mudar o comportamento.

Nenhum endpoint, validação ou regra de negócio deste guia é escrito antes do teste que a exige. Isso é o oposto de "escrever tudo e depois testar" — e é por isso que, ao final, a suíte inteira reflete exatamente as regras de negócio do desafio, nada mais e nada menos.

## Como usar

Siga os arquivos **em ordem numérica**. Cada um pressupõe que todos os anteriores já foram feitos, testados e commitados. Cada capítulo segue a mesma estrutura:

- **🎯 Objetivo** — o que este passo entrega, em uma frase.
- **📦 Instalar** (quando aplicável) — o(s) comando(s) `npm install` exato(s).
- **🔴 Teste (Red)** — o teste escrito primeiro, e a confirmação de que ele falha do jeito esperado.
- **🟢 Código (Green)** — a implementação mínima que faz o teste passar.
- **✅ Como confirmar** — comando (`npm test`, `curl`) e resultado esperado.
- **🔧 Commit sugerido** — o comando `git add`/`git commit` exato para fechar o passo.
- **📚 Documentação Oficial** — links de referência.

## Índice completo

| # | Arquivo | Entrega |
|---|---|---|
| 01 | Iniciando o Projeto | `npm init`, `package.json`, estrutura de pastas `src/`/`tests/` |
| 02 | Git e Padrão de Commits | `git init`, `.gitignore`, Conventional Commits desde o commit zero |
| 03 | Express — Primeiro "Hello World" | `app.js` (sem `.listen`) + `server.js`, rota `/health` mínima |
| 04 | Variáveis de Ambiente com Dotenv | `dotenv`, `.env`/`.env.example`, `PORT` |
| 05 | Jest e Supertest — Testando desde o Primeiro Endpoint | infraestrutura de testes, primeiro teste TDD (`GET /health`, `404`) |
| 06 | Docker — Ambiente de Desenvolvimento | `docker-compose.yml` com MongoDB, healthcheck do container |
| 07 | Mongoose — Conectando ao Banco | conexão real, banco de teste em memória, `/health` reportando o status do banco |
| 08 | Middlewares de Erros | `AppError`, `asyncHandler`, middleware global de erros |
| 09 | Model Course, Seed e `GET /courses` | primeiro model persistido, script de seed idempotente |
| 10 | Funções Puras de Validação | `utils/validators.js` — CPF, e-mail, idade, faixas de bolsa (TDD unitário) |
| 11 | Model Student e Cadastro de Alunos | `POST`/`GET /students`, normalização e unicidade |
| 12 | Docker e Redis | serviço `redis` no compose, preparando a fila técnica |
| 13 | A Fila de Enfileiramento | `queue/connection.js`, `queue/enrollmentQueue.js` — driver Redis/memória |
| 14 | Model Enrollment: Schema e Operações Atômicas | índice único parcial, `findOneAndUpdate` condicionais |
| 15 | `POST /enrollments`: Idade Mínima e Cálculo de Bolsa | primeiro fluxo de matrícula, sem concorrência ainda |
| 16 | Capacidade e Fila de Espera sob Concorrência | a race condition da última vaga, e como ela é evitada |
| 17 | `PATCH /enrollments/:id/cancel`: Cancelamento e Repescagem | compare-and-swap, promoção do primeiro da fila |
| 18 | `GET /enrollments`: Listagem Filtrada | filtros por `cursoId`/`alunoId`/`status` |
| 19 | Encerramento Gracioso e Amarrando Tudo | `server.js` final, fechamento de conexões, `SIGTERM`/`SIGINT` |
| 20 | Cobertura, Documentação e Publicação no GitHub | `test:coverage`, README/SOLUTION, primeiro push |

## Pré-requisitos

- Node.js na versão indicada em `.nvmrc` (este guia usa a série 20/22/24 — `node -v` para conferir);
- Docker Desktop (ou Docker Engine + Compose) — só é usado a partir do capítulo 06, e só para os serviços de banco (a aplicação em si roda direto com `node`/`nodemon`, fora de container, durante todo o guia);
- um editor de código e um cliente HTTP (`curl`, Postman ou similar).

Não é preciso instalar MongoDB ou Redis na sua máquina separadamente — os dois rodam containerizados a partir dos capítulos 06 e 12, e a suíte de testes usa um MongoDB **em memória** (`mongodb-memory-server`) e um driver de fila em memória, então `npm test` funciona mesmo sem Docker rodando.

Pronto? Comece por `01 - Iniciando o Projeto.md`.
