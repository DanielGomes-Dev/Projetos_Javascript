## O que pode cair

Com base no que a vaga pede e no anúncio do desafio, dá pra montar um bom palpite do que vai cair. Vamos por partes:

## O que já sabemos com certeza
- **Stack**: Express + MongoDB, em JavaScript puro (não TypeScript, já que não mencionaram).
- **Foco da avaliação**: raciocínio, organização do código e decisões de arquitetura — não é sobre "terminar tudo", é sobre como você pensa e estrutura.
- **Execução em containers**: Docker Compose vai subir a aplicação e o Mongo, então provavelmente vão te dar (ou pedir que você monte) um `docker-compose.yml` com um serviço Node + um serviço MongoDB.
- **Sem IA, mas com docs oficiais liberadas** — ou seja, esperam fluência real com Express e Mongoose/driver nativo do Mongo.

## O que é provável, olhando a descrição da vaga
A vaga enfatiza fortemente:
- APIs e serviços backend (CRUD é o mínimo esperado)
- Processamento assíncrono, jobs, workers, rotinas em background
- Integrações com serviços externos
- Boas práticas de arquitetura e código de fácil manutenção
- Investigar falhas / comportamento inesperado

Então o desafio deve ser algo como: **construir uma API REST simples com Express + MongoDB**, provavelmente um CRUD de uma entidade (ex: "processos", "clientes", "documentos" — algo com pegada jurídica, já que a empresa é do setor), e a partir daí eles observam:

- Como você organiza as camadas (rotas → controllers → services → repository/model)
- Se você separa responsabilidades ou deixa tudo na rota
- Tratamento de erros e validação de entrada
- Uso correto do Mongoose (schemas, índices, queries)
- Talvez peçam para adicionar algo incremental no meio do teste (ex: "agora adicione paginação", "agora adicione um endpoint que dispara um job assíncrono") para ver como você reage a mudança de requisito ao vivo — isso é comum em testes desse formato.

Dado que "processamento assíncrono, jobs, workers" aparece tanto nos requisitos principais, não seria surpresa se pedissem algo simples tipo: endpoint dispara uma tarefa em background (mesmo que simulada com `setTimeout`/fila simples) só para ver se você sabe separar isso do fluxo síncrono da API.

## Recomendação de preparo
Vale garantir que no dia você tenha:
- Um `docker-compose.yml` de referência mental (Node + Mongo) pronto na cabeça, caso precise montar do zero
- Confiança criando um CRUD Express + Mongoose rápido, com validação (ex: `express-validator` ou validação manual) e tratamento de erro centralizado (middleware de erro)
- Uma estrutura de pastas padrão (routes/controllers/services/models) que você já domina, para não perder tempo "pensando em arquitetura" durante a prova — é melhor ter um esqueleto mental pronto e focar em explicar as decisões enquanto codifica

Quer que eu monte um esqueleto de projeto (Express + MongoDB + Docker Compose) pra você treinar antes do dia?

