Aqui está um **TODO list passo a passo, hiperdetalhado** e organizado por fases, para você guiar o desenvolvimento do projeto **JurisEngine**.

Cada fase foca em validar e demonstrar uma das habilidades exigidas na descrição da vaga.

---

## 📋 TODO - JurisEngine: Motor Jurídico Assíncrono

### **Fase 1: Configuração do Ambiente e Infraestrutura Base**

* [X] **1.1. Inicialização do Projeto**
* [X] Executar `npm init -y`.
* [X] Configurar `.gitignore` (omitindo `node_modules`, `.env`, logs).
* [X] Criar arquivo `.env.example` com variáveis de ambiente do banco de dados, porta e secrets.


* [X] **1.2. Qualidade de Código (ESLint e Formatação)**
* [X] Instalar e configurar ESLint (`npx eslint --init`).
* [X] Definir regras de estilo padrão (ex: `airbnb-base` ou `standard`).
* [X] Adicionar script `"lint": "eslint src/**/*.js"` no `package.json`.


* [X] **1.3. Containerização Inicial (Docker & Docker Compose)**
* [X] Criar `Dockerfile` multi-stage para ambiente Node.js.
* [X] Criar `docker-compose.yml` subindo:
* [X] Serviço de banco de dados **PostgreSQL**.
* [X] Serviço da **aplicação Node.js**.


* [X] Testar persistência de dados com volumes do Docker.


---

### **Fase 2: Banco de Dados Relacional e ORM (Sequelize + PostgreSQL)**

* [X] **2.1. Configuração do Sequelize**
* [X] Instalar `sequelize`, `pg`, `pg-hstore` e `sequelize-cli`.
* [X] Criar estrutura de configuração do banco (`src/config/database.js`).


* [X] **2.2. Criação das Migrations (Modelagem Relacional)**
* [X] Migration `clients` (id UUID, name, document/CPF_CNPJ, email).
* [X] Migration `lawsuits` (id UUID, cnj_number UNIQUE, status, client_id FK).
* [X] Migration `movements` (id UUID, lawsuit_id FK, description, date).


* [X] **2.3. Modelos e Relacionamentos**
* [X] Criar Model `Client` (HasMany `Lawsuit`).
* [X] Criar Model `Lawsuit` (BelongsTo `Client`, HasMany `Movement`).
* [X] Criar Model `Movement` (BelongsTo `Lawsuit`).


* [X] **2.4. Seeders para Teste**
* [X] Criar seeder com dados fictícios de clientes e processos judiciais para testes locais.



---

### **Fase 3: API REST e Camada de Controladores**

* [X] **3.1. Estruturação do Express/Fastify**
* [X] Configurar servidor base com middlewares para JSON e tratamento global de erros.


* [X] **3.2. Endpoints de Clientes**
* [X] `POST /api/clients` - Cadastrar cliente.
* [X] `GET /api/clients` - Listar clientes com paginação.


* [X] **3.3. Endpoints de Processos (Lawsuits)**
* [X] `POST /api/lawsuits` - Vincular um número CNJ a um cliente.
* [X] `GET /api/lawsuits/:id` - Buscar detalhes do processo e histórico de movimentações.
* [X] `POST /api/lawsuits/batch-import` - Endpoint para disparar importação em lote (aciona a fase de Workers).



---

### **Fase 4: Processamento Assíncrono, Jobs e Workers**

* [X] **4.1. Arquitetura da Fila/Worker**
* [X] Escolher abordagem de filas (ex: BullMQ / Redis, ou tabela de Jobs em banco com rotina de busca de pendências).


* [X] **4.2. Implementação do Worker Jurídico**
* [X] Criar `src/workers/lawsuitSync.worker.js` responsável por consumir filas/jobs de varredura.
* [X] Simular integração com API externa de Tribunais/Diário Oficial (com retry logic e delay artificial).
* [X] Salvar as novas movimentações capturadas na tabela `movements`.
* [X] Atualizar o status do processo para `UPDATED`.


* [X] **4.3. Tratamento de Erros e Falhas em Workers**
* [X] Implementar logs de erros e sistema de dead-letter queue (DLQ) / retentativa em caso de falha na integração externa.



---

### **Fase 5: Comunicação em Tempo Real (WebSockets)**

* [ ] **5.1. Instalação e Configuração do Socket.IO**
* [ ] Integrar `socket.io` ao servidor HTTP principal (`src/websocket/socket.js`).


* [ ] **5.2. Regra de Negócio de Salas (Rooms)**
* [ ] Permitir que clientes do Socket se conectem e entrem em salas específicas por CNJ do processo (`socket.join(cnjNumber)`).


* [ ] **5.3. Integração Worker -> WebSocket**
* [ ] Fazer com que o **Worker**, ao capturar uma nova movimentação do tribunal, emita um evento via WebSocket diretamente para a sala correspondente do processo em tempo real.



---

### **Fase 6: Gerenciamento de Processos Concorrentes (PM2)**

* [ ] **6.1. Configuração do Ecosystem File**
* [ ] Criar `ecosystem.config.js`.


* [ ] **6.2. Multi-processos e Cluster Mode**
* [ ] Configurar a API REST para rodar em modo `cluster` (dividindo a carga entre os núcleos da CPU).
* [ ] Configurar os **Workers** para rodarem como processos independentes (`fork mode`) gerenciados pelo PM2.


* [ ] **6.3. Scripts de Produção**
* [ ] Adicionar script `"prod": "pm2-runtime start ecosystem.config.js"` para execução dentro do Docker.



---

### **Fase 7: Testes Automatizados (Jest)**

* [ ] **7.1. Configuração do Jest**
* [ ] Instalar `jest` e `supertest`.
* [ ] Configurar ambiente de teste (`jest.config.js`) isolando banco de dados de teste (SQLite em memória ou Postgres_test).


* [ ] **7.2. Testes Unitários**
* [ ] Testar regras de validação do número de processo no padrão CNJ.


* [ ] **7.3. Testes de Integração (API)**
* [ ] Testar fluxo completo de criação de cliente e processo via rotas HTTP.
* [ ] Validar códigos de status HTTP e payloads de erro.



---

### **Fase 8: Documentação e Preparação do Repositório**

* [ ] **8.1. Documentação da Arquitetura**
* [ ] Escrever no `README.md` os diagramas do fluxo de dados (API -> Worker -> WebSocket -> Cliente).


* [ ] **8.2. Guia de Execução do Projeto**
* [ ] Passo a passo claro de como subir o projeto com um único comando: `docker compose up --build`.


* [ ] **8.3. Publicação no GitHub**
* [ ] Garantir histórico de commits limpos e descritivos no padrão Conventional Commits (`feat:`, `fix:`, `docs:`).








- npm init @eslint/config
- npm install -D jiti 

- package.json
```
    "scripts": {
        "lint": "eslint src/**/*.js"
    }
```


- npm install -D typescript
- npm install -D @types/node

- npm install express
- npm install -D @types/express

- npm install dotenv


- tsconfig
```

    {
    "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "lib": ["ES2022"],
        "outDir": "./dist",
        "rootDir": "./src",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true
    },
    "include": ["src/**/*"]
    }

```


- npm install -D tsx
- npm install -D rimraf

- package.json
```
    "scripts": {
        "start": "node src/server.js",
        "dev": "node --watch src/server.js",
        "lint": "eslint src/**/*.js"
    }
```



