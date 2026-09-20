# Desafio Técnico — Backend Sênior II

API de gestão de matrículas e bolsas educacionais utilizando Node.js, Express e MongoDB.

## Objetivo

Este desafio avalia principalmente como você:

- explora e entende um projeto existente;
- transforma requisitos em regras e invariantes;
- organiza responsabilidades de forma proporcional;
- utiliza Express, HTTP e MongoDB;
- identifica riscos de concorrência e consistência;
- escreve e revisa testes;
- explica decisões e trade-offs.

O objetivo não é medir velocidade de digitação, quantidade de arquivos ou conhecimento decorado de padrões arquiteturais.

## Live coding (aproximadamente 40 minutos)

Você poderá consultar internet e documentação, mas não utilizar IA para gerar a solução.

Não existe expectativa de concluir todo o desafio nessa etapa. Faça o que considerar mais relevante no tempo disponível. Concluir todo o escopo não é critério de aprovação.

O ambiente, as dependências, o banco, o seed e os testes iniciais devem ser validados antes de iniciar a contagem dos 40 minutos. Problemas de instalação ou infraestrutura não fazem parte da avaliação e não devem consumir o tempo do candidato.

Durante o live coding, valorizamos:

- entendimento e priorização;
- comunicação do raciocínio;
- fundamentos de backend;
- identificação de riscos e edge cases;
- qualidade das decisões, mesmo que ainda não estejam implementadas.

Escrever menos código com raciocínio correto pode demonstrar mais senioridade do que concluir rapidamente com regras incorretas.

## O que já está pronto

- aplicação Express com JSON e CORS configurados;
- conexão com MongoDB separada da instância Express;
- model de curso;
- Docker Compose com MongoDB;
- seed idempotente com três cursos;
- `GET /health` e `GET /courses`;
- resposta 404 e middleware básico de erros;
- Jest, Supertest e helper de MongoDB em memória;
- testes iniciais de funcionamento.

Você não precisa recriar essa infraestrutura. Pode refatorá-la caso isso ajude sua solução.

## O que deve ser implementado

- cadastro e listagem de alunos;
- matrícula com idade mínima e bolsa;
- controle de capacidade e fila de espera;
- prevenção de matrícula ativa duplicada;
- cancelamento e promoção da fila;
- listagem filtrada de matrículas;
- testes das regras e fluxos principais;
- breve documentação das decisões.

## Contrato HTTP

| Método | Endpoint | Sucesso |
|---|---|---:|
| `GET` | `/health` | `200` quando a API e o banco estão prontos; `503` quando o banco não está disponível |
| `GET` | `/courses` | `200` |
| `POST` | `/students` | `201` |
| `GET` | `/students` | `200` |
| `POST` | `/enrollments` | `201` |
| `GET` | `/enrollments` | `200` |
| `PATCH` | `/enrollments/:id/cancel` | `200` |

Mantenha as respostas de erro em JSON e com formato consistente. O envelope exato fica a seu critério.

## Inicialização

### Pré-requisitos

- Node.js na versão indicada em `.nvmrc`;
- Docker com Docker Compose.

### Comandos

```bash
npm ci
cp .env.example .env  # opcional: a aplicação possui defaults locais
npm run db:up
npm run seed
npm run dev
```

Em outro terminal:

```bash
npm test
```

Comandos úteis:

```bash
npm run test:watch
npm run test:coverage
npm run db:down
```

- API: `http://localhost:3333`
- MongoDB: `mongodb://localhost:27028/desafio_senior`
- Healthcheck: `GET http://localhost:3333/health`
- Cursos: `GET http://localhost:3333/courses`

Os testes utilizam MongoDB em memória e não dependem do Docker. Na primeira instalação, o pacote de testes pode precisar baixar um binário do MongoDB.

## Arquitetura

Organize a aplicação da maneira que considerar adequada para o tamanho do desafio.

Nenhum padrão arquitetural, conjunto de interfaces ou quantidade mínima de camadas é obrigatório. Uma estrutura simples como `route -> controller -> service/use case -> model/repository` é totalmente válida. Também é válido não criar uma camada que você considere overengineering.

Avaliaremos:

- responsabilidades claras;
- regras de negócio localizadas e testáveis;
- acoplamento proporcional;
- legibilidade e facilidade de alteração;
- capacidade de explicar as escolhas.

## Regras de negócio

### 1. Alunos

#### `POST /students`

Payload:

```json
{
  "nome": "Maria Silva",
  "cpf": "123.456.789-00",
  "email": "maria@example.com",
  "dataNascimento": "2000-08-20",
  "rendaFamiliar": 2824.00
}
```

Regras:

- todos os campos são obrigatórios;
- strings vazias não são válidas;
- `dataNascimento` é uma data civil no formato `YYYY-MM-DD` e não pode estar no futuro;
- `rendaFamiliar` deve ser maior ou igual a zero e ter no máximo duas casas decimais;
- normalize o CPF removendo pontuação e exija exatamente 11 dígitos;
- para este desafio, não é necessário implementar o algoritmo oficial dos dígitos verificadores do CPF;
- CPF deve ser único após normalização;
- normalize email com `trim` e comparação case-insensitive;
- email deve possuir formato válido e ser único após normalização.

Retornos esperados:

- `201 Created`: aluno criado;
- `400 Bad Request`: payload inválido;
- `409 Conflict`: CPF ou email duplicado.

#### `GET /students`

Retorna os alunos cadastrados com `200 OK`.

### 2. Matrículas

#### `POST /enrollments`

Payload:

```json
{
  "alunoId": "ID_DO_ALUNO",
  "cursoId": "ID_DO_CURSO"
}
```

Regras gerais:

- aluno e curso devem existir;
- somente cursos com status `ABERTO` aceitam matrícula;
- ObjectId malformado deve retornar `400 Bad Request`;
- recurso inexistente deve retornar `404 Not Found`;
- curso encerrado ou aluno sem idade suficiente deve retornar `422 Unprocessable Entity`;
- um aluno pode ter no máximo uma matrícula ativa (`CONFIRMADA` ou `FILA_ESPERA`) por curso;
- uma nova matrícula após cancelamento é permitida;
- duplicidade ativa deve retornar `409 Conflict`.

#### Idade mínima

A idade deve ser calculada na data da matrícula usando ano, mês e dia do calendário. Não utilize apenas diferença de anos ou divisão da quantidade de dias por 365.

No dia do aniversário, o aluno já possui a nova idade.

#### Bolsa

| Renda familiar | Bolsa | Mensalidade final |
|---|---:|---:|
| até `2824.00` | 50% | 50% do valor do curso |
| de `2824.01` até `5648.00` | 20% | 80% do valor do curso |
| a partir de `5648.01` | 0% | valor integral |

O percentual da bolsa e o valor final da mensalidade devem ser armazenados na matrícula.

#### Capacidade e fila

- se `vagasOcupadas < capacidadeVagas`, crie a matrícula como `CONFIRMADA` e incremente `vagasOcupadas`;
- se o curso estiver lotado, crie como `FILA_ESPERA` sem alterar `vagasOcupadas`;
- `vagasOcupadas` representa somente matrículas confirmadas;
- duas requisições concorrentes não podem fazer `vagasOcupadas` ultrapassar `capacidadeVagas`.

Exemplo: com uma única vaga restante e duas solicitações simultâneas de alunos diferentes, no máximo uma pode terminar `CONFIRMADA`; a outra deve ir para `FILA_ESPERA`, e o contador deve aumentar somente uma vez.

Uma sequência `buscar curso -> verificar vagas -> atualizar curso` pode sofrer race condition. Durante o live coding, perceber e explicar esse risco já é um sinal importante. Na solução, proteja a capacidade com um update condicional atômico ou uma abordagem equivalente.

### 3. Cancelamento e repescagem

#### `PATCH /enrollments/:id/cancel`

- altere a matrícula para `CANCELADA`;
- cancelar uma matrícula em `FILA_ESPERA` não altera `vagasOcupadas` e não promove outra pessoa;
- ao cancelar uma matrícula `CONFIRMADA`, promova a primeira matrícula em espera do mesmo curso;
- a fila deve ser ordenada por `createdAt` crescente e, em caso de empate, `_id` crescente;
- se houver promoção, `vagasOcupadas` permanece igual: uma pessoa saiu e outra ocupou a vaga;
- se não houver fila, decremente `vagasOcupadas` exatamente uma vez;
- chamadas repetidas ou concorrentes não podem repetir decrementos nem promover mais de uma pessoa para a mesma vaga.

Para uma matrícula já cancelada, você pode escolher entre retornar o estado atual com `200 OK` ou retornar `409 Conflict`. Documente a decisão. Em ambos os casos, a operação não pode produzir novos efeitos.

### 4. Listagem de matrículas

#### `GET /enrollments`

Filtros opcionais:

- `cursoId`;
- `alunoId`;
- `status`: `CONFIRMADA`, `FILA_ESPERA` ou `CANCELADA`.

Filtros fazem parte do escopo, mas possuem peso menor que a correção das regras de matrícula, capacidade e cancelamento.

## Concorrência

- reconhecer a race condition da última vaga;
- impedir que a capacidade seja ultrapassada;
- evitar efeitos duplicados no cancelamento;
- explicar como tratou ou trataria duplicidade concorrente;
- documentar limitações relevantes da solução.

Não existe uma abordagem técnica única obrigatória. Escolha uma solução proporcional, explique o que ela garante e reconheça suas limitações.

## Testes

Não existe meta obrigatória de cobertura percentual.

Considere pelo menos os seguintes cenários:

### Unitários

- fronteiras das três faixas de bolsa;
- idade antes, no dia e depois do aniversário;
- regras de transição relevantes, se estiverem isoladas do banco.

### Integração

- cadastro válido e duplicidade de aluno;
- matrícula confirmada;
- matrícula em fila de espera;
- rejeição por idade;
- prevenção de matrícula ativa duplicada;
- cancelamento com promoção;
- cancelamento sem pessoa na fila.

Um teste concorrente provando que a capacidade não é ultrapassada é um diferencial importante.

Durante o live coding, não é esperado escrever essa suíte completa. Um único teste relevante, ou uma boa explicação da estratégia, já fornece sinal.

## Critérios de avaliação

### Live coding

Priorizaremos:

1. raciocínio e comunicação;
2. entendimento das regras e invariantes;
3. fundamentos backend/HTTP/MongoDB;
4. identificação de concorrência e inconsistências;
5. organização e qualidade das decisões;
6. estratégia de testes.

A quantidade de código concluída possui peso baixo.

## Documentação das decisões

Adicione ao README uma seção curta explicando:

1. como organizou as responsabilidades e por quê;
2. como protegeu a capacidade contra requisições concorrentes;
3. como evitou matrículas ativas duplicadas;
4. limitações e trade-offs conhecidos;
5. o que faria diferente em um ambiente de produção.

---

## Decisões da Solução

### 1. Arquitetura (`route -> controller -> service -> model`)

* **Routes/Controllers:** Apenas mapeiam rotas e traduzem requisições/respostas HTTP. O `asyncHandler` centraliza o tratamento de erros.
* **Services:** Concentram toda a regra de negócio e validações, totalmente desacoplados de HTTP.
* **Models:** Schemas do Mongoose que encapsulam operações atômicas diretas no banco.
* **Queue:** Camada opcional com Redis/BullMQ para serializar mutações críticas.

Para isolar responsabilidades, facilitar testes unitários e garantir que mudanças em tecnologia (como frameworks ou banco) não afetem as regras de negócio.

### 2. Proteção contra Concorrência (Dupla Camada)

Updates Atômicos no Mongo: A atribuição de vagas (`Course.incrementIfHasCapacity`) e o cancelamento/promoção (`Enrollment.updateStatusIfCurrent`) garantem consistência atômica por documento, sem *race conditions*.

Fila Técnica (BullMQ): Um worker com `concurrency: 1` serializa as mutações de vagas em nível de aplicação (com fallback automático para memória nos testes sem Docker).

### 3. Prevenção de Matrículas Duplicadas

Validação + Índice Único Parcial: Além da checagem lógica prévia, a collection possui um índice único no campo `activeKey` (ativo apenas para status `CONFIRMADA` ou `FILA_ESPERA`). Corridas simultâneas que bypassam a validação recebem erro `E11000` do banco, convertido em `409 Conflict`.

### 4. Limitações e Trade-offs

A fila usa um único worker global. Para alta escala, o ideal seria particionar as filas por ID de curso.

### 5. O que faria em Produção

Em um cenário de alto volume (ex: lançamento de curso com alta disputa), a fila global única se torna um gargalo, pois serializa operações de cursos completamente distintos. Particionar por curso com locks distribuídos ou filas independentes garante que a alta concorrência em um curso concorrido não paralise o restante da plataforma.

Em um cenário de baixo uso, deixaria apenas os updates atômicos no banco de dados (findOneAndUpdate com condição de capacidade), pois eles já garantem 100% a consistência dos dados de forma nativa e simples, sem adicionar complexidade operacional (como manter Redis rodando ou gerenciar filas). Para baixo volume, a simplicidade vence.


---

## Como rodar

Além dos passos do `README.md`, agora é preciso que o Redis também esteja de pé (já incluso no `docker-compose.yml`):

```bash
npm ci
cp .env.example .env
npm run db:up      # sobe MongoDB e Redis
npm run seed
npm run dev
```

`npm test` continua não dependendo de Docker (nem de Mongo nem de Redis).
