# Fase 8 — Documentação e Preparação do Repositório

> Objetivo desta fase: transformar o projeto de "só roda na minha máquina, do meu jeito" em algo que qualquer outra pessoa (ou você mesmo, daqui a 6 meses) consiga entender, rodar e contribuir sem precisar te perguntar nada. É a fase que existe para o repositório, não para o código em si — mas, como você vai ver, o processo de **documentar honestamente** como subir o projeto acabou encontrando um bug real que nenhuma fase anterior tinha pego.
>
> Como nas Fases 5, 6 e 7, esta fase já foi **implementada no seu projeto real**. Este documento explica o que foi feito e por quê.

---

## 8.1 e 8.2. README.md — Arquitetura e Guia de Execução

### O que vamos construir e por quê

Até aqui, a "documentação" do projeto vivia inteira dentro da pasta `Estudos/` — ótima para **aprender** o projeto passo a passo, mas ruim como porta de entrada para alguém (ou você) que só quer saber "como eu subo isso e uso agora". É basicamente a diferença entre um curso completo e a bula de um remédio: os dois têm seu lugar, mas ninguém lê o curso inteiro só para saber a dosagem.

O `README.md` na raiz do projeto resolve isso — é o primeiro (e às vezes único) arquivo que alguém abre ao encontrar o repositório no GitHub.

### O que ele contém

**1. Diagrama de arquitetura** (`mermaid`, renderizado nativamente pelo GitHub): mostra os componentes — API, Worker, Postgres, Redis/BullMQ, Socket.IO — e como o dado flui entre eles.

**2. Diagrama de sequência** de uma sincronização completa: do `POST /api/lawsuits/batch-import` até o evento `lawsuit:updated` chegar no cliente WebSocket, passando pela fila, o Worker e a ponte `QueueEvents`. Isso condensa numa imagem só o que as Fases 4 e 5 explicam em várias páginas de texto.

**3. "Como rodar com um único comando"** — a tabela de endereços (API, Bull Board, Postgres, Redis) e o passo a passo `git clone` → `.env` → `docker compose up --build` → migrations → seed.

**4. Padrão de commits** (ver 8.3, abaixo) — para quem for contribuir saber, sem perguntar, o formato esperado.

> 💡 **Por que Mermaid, e não uma imagem PNG exportada de alguma ferramenta de diagrama?** Porque o GitHub renderiza blocos ` ```mermaid ` nativamente dentro do `README.md` — o diagrama fica **versionado como texto**, então revisar uma mudança de arquitetura no Pull Request mostra um diff de texto legível, em vez de "a imagem mudou, confie em mim". É o mesmo princípio de "documentação como código" que já vimos com as migrations (Fase 2): a fonte da verdade é texto, revisável, no Git.

### O bug real que apareceu ao escrever a seção "como rodar"

Escrever o passo a passo de "suba tudo com `docker compose up --build`" só é honesto se esse comando **realmente** deixar tudo funcional — então, antes de escrever a seção, conferi de novo o `docker-compose.yml` linha a linha contra o que cada serviço realmente precisa.

O serviço `api` estava faltando `REDIS_HOST` e `REDIS_PORT` no bloco `environment:`. Isso não é só um detalhe: `src/app.ts` importa `admin/bullBoard.ts` (Fase 4.3), que importa a fila BullMQ, que abre uma conexão Redis **assim que o módulo carrega** — antes mesmo de qualquer rota ser chamada. Sem `REDIS_HOST` definido, o código cai no fallback de `src/config/redis.ts` (`process.env.REDIS_HOST || 'localhost'`). Dentro do container Docker, `'localhost'` aponta para o **próprio container da API**, não para o serviço `redis` — ou seja, a API nunca conseguia falar com o Redis de dentro do Docker Compose. O serviço `worker` já tinha isso certo (`environment: - REDIS_HOST=redis`); só o `api` estava incompleto.

> 📝 **Nota curiosa:** esse bug já tinha deixado um rastro no próprio `.env` do projeto — havia um comentário `# Corrigir isso pois o host redis quando rodo comando na minha maquina nao funciona` e uma linha `REDIS_HOST` comentada, sinal de uma tentativa anterior de resolver isso editando o `.env` (que não resolve, porque o problema é o `docker-compose.yml` não repassar a variável certa para o container).

**Correção aplicada** em `docker-compose.yml`, no serviço `api`:

```yaml
  api:
    # ...
    env_file:
      - .env
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 3000
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: ${DB_USER:-postgres}
      DB_PASS: ${DB_PASS:-postgres}
      DB_NAME: ${DB_NAME:-juris_db}
      REDIS_HOST: redis
      REDIS_PORT: 6379
```

Duas mudanças: `REDIS_HOST`/`REDIS_PORT` explícitos (apontando para o serviço Docker correto), e `env_file: - .env` adicionado (do mesmo jeito que o `worker` já fazia) para que `ADMIN_USER`/`ADMIN_PASS`/`LAWSUIT_SYNC_CONCURRENCY` cheguem à API também, em vez de silenciosamente caírem nos valores padrão (`admin`/`admin`) do código.

### `.env.example` — outro gap que apareceu na mesma verificação

Todos os guias anteriores (Fase 1 em diante) mencionam um `.env.example` como o "modelo público" de variáveis de ambiente — mas, conferindo o projeto real, esse arquivo nunca chegou a existir. Sem ele, o passo `cp .env.example .env` do README (e dos guias anteriores) quebraria para qualquer pessoa clonando o repositório do zero — que é exatamente o cenário que esta fase existe para cobrir.

Criado `.env.example` na raiz, com todas as variáveis usadas pelo projeto (Fases 1, 4 e 4.3) e comentários explicando a diferença `db`/`redis` (dentro do Docker) vs `localhost` (fora dele) — a mesma distinção que já apareceu várias vezes ao longo do guia.

### Como confirmar que deu certo

```bash
git clone <seu-repositório-em-outra-pasta-temporária>   # simula "outra pessoa clonando"
cd <pasta-clonada>
cp .env.example .env
docker compose up --build
curl http://localhost:3000/health
curl http://localhost:3000/admin/queues  # deve pedir usuário/senha, não travar/quebrar
```

Se isso funcionar numa pasta limpa, clonada do zero — sem nenhum ajuste manual — o `README.md` está dizendo a verdade.

---

## 8.3. Publicação no GitHub — histórico de commits

### O que o TODO pede, e o que isso realmente significa

"Garantir histórico de commits limpos e descritivos no padrão Conventional Commits" tem duas partes bem diferentes: (a) **daqui para frente**, todo commit novo segue o padrão; (b) o que fazer com o histórico que **já existe**, que nem sempre seguiu esse padrão.

### Diagnóstico do histórico atual

```
925e20e fix: estudos
d757f4e add tests
aae67ae feat: Fase 6
6d0bbf5 Fase 5 npm
9f2f203 Fase 5
9ce6df5 feat: adicionando explicacoes
bb278b8 feat: add queue and workers
f6120b4 feat: add db
ca99de7 docker explicacao
689bbdc add Docker
09694c1 initial commit
```

Alguns commits já seguem Conventional Commits (`feat:`, `fix:`); outros são só uma frase solta (`Fase 5`, `add tests`, `docker explicacao`). Isso é absolutamente normal num projeto de estudo em construção — o padrão importa mais **a partir de agora**, quando o projeto passa a ser algo publicável, do que retroativamente.

> ⚠️ **Por que este guia não reescreve o histórico antigo (`git rebase -i`) para "consertar" as mensagens?** Reescrever histórico já commitado é uma operação destrutiva — e, se o repositório já tiver sido enviado a algum lugar (mesmo que só para você mesmo, em outro computador), reescrever localmente gera divergência (`git push --force` seria necessário, o que pode apagar trabalho de quem já tiver puxado aquele histórico). Como neste projeto o repositório **ainda não tinha nenhum remoto configurado** (`git remote -v` não retornou nada) até esta fase, reescrever o histórico até seria tecnicamente seguro agora — mas ainda assim optamos por **não** fazer isso automaticamente: é uma decisão que só você deveria tomar conscientemente, sabendo que está reescrevendo commits que já existem. Se quiser fazer isso à mão antes do primeiro `git push`, o comando é `git rebase -i --root` (edite os `pick` para `reword` nos commits que quiser renomear). Depois do primeiro push, evite — vá só com commits novos, seguindo o padrão.

### Um achado de higiene do repositório: diffs gigantes de nada

Ao rodar `git status` para revisar o que ainda faltava commitar, apareceram ~20 arquivos "modificados" com centenas de linhas de diff cada — mas com o **mesmo número exato de inserções e remoções** em cada arquivo (ex.: `.gitignore` mostrando `5 insertions(+), 5 deletions(-)` para um arquivo de 5 linhas). Isso é a assinatura clássica de um problema de **terminação de linha**: os arquivos foram commitados originalmente com `LF` (padrão Unix/Git), mas em algum momento foram salvos de novo no Windows com `CRLF`, e o Git está vendo isso como "toda linha mudou" — mesmo que o conteúdo, palavra por palavra, seja idêntico.

**Correção**: criado `.gitattributes` na raiz do projeto:

```gitattributes
* text=auto eol=lf
```

Isso instrui o Git a sempre normalizar arquivos de texto para `LF` no repositório, não importa em qual sistema operacional alguém commitou — evitando que isso aconteça de novo no futuro (inclusive se outras pessoas, usando Windows, macOS ou Linux, contribuírem para o projeto).

> 💡 Adicionar o `.gitattributes` **não desfaz** as mudanças de terminação de linha que já existem no seu diretório de trabalho agora. Para aplicá-lo de uma vez aos arquivos já commitados, rode:
> ```bash
> git add .gitattributes
> git commit -m "chore: normalizar terminacao de linha (adicionar .gitattributes)"
> git add --renormalize .
> git commit -m "chore: renormalizar arquivos existentes para LF"
> ```
> O segundo commit deve mostrar um diff bem menor e mais legível (só o que realmente mudou, se algo mudou) — bem diferente do "arquivo inteiro reescrito" que aparecia antes.

### Passo a passo para organizar e publicar

**1.** Confira o que está pendente:

```bash
git status
```

**2.** Adicione o `.gitattributes` primeiro e normalize (bloco acima).

**3.** Adicione e commite as mudanças desta fase, em commits separados e descritivos — é assim, na prática, que "histórico limpo" se parece: cada commit conta **uma** mudança coerente, não "um monte de coisa junta":

```bash
git add README.md .env.example
git commit -m "docs: adicionar README com arquitetura e guia de execucao"

git add docker-compose.yml
git commit -m "fix: enviar REDIS_HOST/REDIS_PORT para o container da api"
```

**4.** Crie o repositório no GitHub (pela interface web, ou `gh repo create` se tiver a GitHub CLI instalada) e conecte-o:

```bash
git remote add origin https://github.com/<seu-usuario>/<seu-repositorio>.git
git branch -M main
git push -u origin main
```

> ⚠️ Antes do primeiro `push`, confira novamente `git status` e `cat .gitignore` — o `.env` (com suas credenciais reais) **nunca** deve aparecer em `git status` como algo para adicionar. Se aparecer, pare e confira o `.gitignore` antes de continuar.

### Como confirmar que deu certo

```bash
git log --oneline -10
```

Os commits mais recentes devem seguir `<tipo>: <descrição>`. No GitHub, abra o repositório publicado e confira que o `README.md` aparece automaticamente na página inicial, com os dois diagramas Mermaid renderizados (não como texto cru dentro de um bloco de código).

---

## 📁 Estrutura de pastas e arquivos — o que foi adicionado/alterado nesta fase

```
Sistema_Treino/
├── README.md              ← NOVO (Fase 8.1/8.2)
├── .env.example            ← NOVO (Fase 8.2)
├── .gitattributes           ← NOVO (Fase 8.3)
└── docker-compose.yml        ← ALTERADO (Fase 8.2 — REDIS_HOST/REDIS_PORT/env_file no serviço api)
```

---

✅ **Fim da Fase 8.** O projeto agora tem uma porta de entrada de verdade: quem chegar até o repositório no GitHub entende, em menos de um minuto de leitura do README, o que o sistema faz, como ele é montado por dentro, e como rodar tudo com um único comando — e esse comando agora **realmente** funciona de ponta a ponta, incluindo a parte de Redis que estava quebrada silenciosamente desde a Fase 4.
