# syntax=docker/dockerfile:1
# A linha acima ativa os recursos do Docker BuildKit (o motor de build moderno do Docker).
# Garante que o Docker use sempre a versão 1.x mais recente da sintaxe do Dockerfile.

# ---------- Base: dependências compartilhadas ----------

# Cria a primeira etapa do build e a batiza de "base".
# Usa a imagem oficial do Node.js na versão 22. 
# O sufixo "-alpine" significa que ela usa o Alpine Linux, uma distribuição super leve e enxuta, o que deixa a imagem final muito menor.
FROM node:22-alpine AS base

# Define o diretório de trabalho dentro do container. 
# Todos os próximos comandos (RUN, COPY, CMD) vão acontecer dentro da pasta "/app".
WORKDIR /app

# Copia os arquivos "package.json" e "package-lock.json" da sua máquina para dentro da pasta "/app" do container.
# Fazemos isso ANTES de copiar o resto do código para aproveitar o sistema de "cache" do Docker (explicado abaixo).
COPY package*.json ./


# ---------- Dev: usada pelo docker-compose no dia a dia ----------

# Cria uma nova etapa chamada "dev" que herda tudo o que foi feito na etapa "base" acima.
FROM base AS dev

# Define uma variável de ambiente dizendo ao Node e a outras bibliotecas que estamos em modo de desenvolvimento.
ENV NODE_ENV=development

# Instala as dependências do projeto.
# O "npm ci" (Clean Install) é parecido com o "npm install", mas ele é mais rápido e rigoroso: 
# ele apaga a pasta node_modules (se existir) e instala as versões EXATAS que estão no package-lock.json.
RUN npm ci

# Copia o restante dos arquivos do seu projeto (código-fonte) para dentro do container.
COPY . .

# Sinaliza que este container vai se comunicar através da porta 3000.
# Importante: Isso serve mais como documentação. Para acessar a porta de fora, você ainda precisa mapeá-la no docker-compose ou no comando docker run (ex: -p 3000:3000).
EXPOSE 3000

# Define o comando padrão que será executado quando o container for iniciado.
# Vai rodar o script "dev" configurado no seu package.json (geralmente inicia um servidor com live-reload, como nodemon, vite ou node --watch).
CMD ["npm", "run", "dev"]