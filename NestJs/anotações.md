- Agendador; para disparo de email

- send grid -> disparo de email;
- nestjs
- post client
- agendador

npm i -g @nestjs/cli

nest new nestjs-mail-schedule

nest g module app/sendgrid
nest g service app/sendgrid
nest g controller app/sendgrid

npm i @nestjs/axios

json to ts
npm install @nestjs/common
npm install @nestjs/core

npm i @nestjs/config -> usar as env
app module -> ConfigModule.forRoot

docker pull postgres -> download postgres
docker run --name postgres -e POSTGRES_PASSWORD=123456789 -p 5432:5432 -d postgres
docker run --name postgrestypeorm -e POSTGRES_PASSWORD=123456789 -p 5432:5432 -d postgres
criar um banco de dados

instalar o npm i @nestjs/typeorm@0.2

npm i pg

7:13

- Syncorinize apenas em dev
- nao usar em prod pode perder dados

entities: [__dirname + '**/*.entity{.js,.ts}']

nest g module app/mail

---

nest-cli -> nao rpecisa se preocupar, gerenciado pelo proprio nest

-- pesquisar o que sao decorators

@Injectable() -> faz com que a classe seja injetavel em outra classe

--no-spec -> nao cria test
--dry-run -> ve onde o arquivo vai ficar

controllers

services

modules

tratamento de erros

dto

validacao

npm i class-validator
npm i class-transformer

npm i @nestjs/mapped-types

app.useGlobalPipes(new ValidationPipe({ whitelist: true })); // tudo q nao for definido no dto vai ser retido

whitelist: habilita a validação baseada em lista branca, permitindo somente os dados especificados nos decoradores de validação.

forbidNonWhitelisted: impede que dados não especificados nos decoradores de validação sejam aceitos.

transform: habilita a transformação automática dos dados de entrada para os tipos de dados especificados nos decoradores de validação.

refatorar o ash separa o produto de orders
