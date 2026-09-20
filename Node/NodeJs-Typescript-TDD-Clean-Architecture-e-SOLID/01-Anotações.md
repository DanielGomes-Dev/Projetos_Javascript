- Git Atalhos
- git config --list
  -- system-> maquina toda;
  -- global -> meu usuario pra qualquer projeto
  -- local apenas para o projeto

- git config --global core.editor code -> altera com qual editor vai abrir a edicao do git
- git config --global --edit

[alias]
s = !git status -s
c = !git commit -m
l = !git log --oneline --pretty=format:'%C(blue)%h%C(red)%d %C(white)%s - %C(cyan)%cn, %C(green)%cr'

- convencional commit

types other than fix: and feat: are allowed, for example @commitlint/config-conventional (based on the Angular convention) recommends
build:, chore:, ci:, docs:, style:, refactor:, perf:, test:, and others.

- git-commit-msg-linter -> respeitar o convencional commit
  -0 cria um hook para validar nossa msg
- \<type>: \<description>

- git init

- npm i -D typescript @types/node -> instalando typecript;

<https://node.green/>

tsconfig -> gerar um arquivo js a partir do ts

- esNext

- standardjs -> <https://standardjs.com/>
- esLint

- <https://www.npmjs.com/package/eslint-config-standard-with-typescript>

- .eslintrc.json
- "strict": true,

- husky -> adicionar hooks antes de commits ou pushs

- npm i -D lint-staged -> roda scripts em apenas arquivos modificados

- npm i -D jest @types/jest ts-jest

## Arquitetura API

## SignUpController -> Presentaion

- Express -> criar rotas
- MongoDb -> banco de dados
- BCrypt -> criptografar senha
- Validator -> validar email

- Desacoplar controller do express

- Dependency Inversion

- Adapter

ExpressRouteAdapter

- Criar interfaces no controller

- o Adapter implementa e converte para o express;

- Presentation Layer

  - SignUpController
  - Controller

- Express Router tem que funcionar para todos controllers

## Validator - Utils

- EmailValidatorAdapter
- Criar um adaptador
- interface Email Validator -> SignUpcontroller

## Domain

- Protocolos e Interface
- AddAccount
  - Data Layer
  - Implementações da Regra de Negocio
  - Db Add Account
  - Interface BCrypt
  - Adapter BCrypt -> infra -> extends InterfaceBCrypt

## Data

AddUserRepor -> Precisa de Alguem que saiba inserir no db;

## Main Layer -> Criar instancias

- Adpter
- Composite -> Main Layer;

<https://finder-up.slack.com/files/U02LQUC55GR/F04KMF48WQ2/image.png>
file:///media/daniel/Estudos/Cursos/Programa%C3%A7%C3%A3o/JavaScript/Nodejs/NodeJs,%20Typescript,%20TDD,%20Clean%20Architecture%20e%20SOLID/3.%20SignUp%20API%20-%20Presentation%20Layer/1.1%20signup-diagram.pdf

- Lint Staged -> Não ta funcionando
- Remover linha de git add;

- jest --clearCache

- Bug em biblioteca - eslint-config-standard-with-typescript -> await -> verssao 16 -> usar versão 11; 11.0.1

npm-check -> verifica todas as dependencias e de forma interativa mostra quais a gente que ou nao atualizar
