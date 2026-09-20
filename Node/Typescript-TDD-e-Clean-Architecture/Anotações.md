Promixa Aula 03

# BDD Specs - Behavior Driven Development (BDD)

## Narrativa 1

```
Como um cliente online
Quero que o sistema me mostre minhas compras
Para eu poder controlar minhas despesas
```

## Cenarios

```
Dado que o cliente tem conexão com a internet
Quando o cliente solicitar para carregar suas compras
então o sistema deve exibir suas compras vindo de uma API
E substituir os dados do cache com os dados mais atuais

```

## Narrativa 2

```
Como um cliente offline
quero que o sistema me mostre minhas ultimas compras gravadas
Para eu poder ver minhas despesas mesmo sem ter internet
```

## Cenários

```
Dado que o cliente não tem conexão com a internet
    E exista algum dado gravado no cache
    E os dados do cache forem mais novos que 3 dias
Quando o cliente solicitar para carregar suas compras
    Então o sistema deve exibir suas compras vindas do cache

Dados que o cliente não tem conexão com a internet
    E exista algum dado gravado no cache
    E os dados do cache forem mais velhos ou iguais a 3 dias
Quando o cliente solicitar para carregar suas compras
    Então o sistema deve exibir uma mensagem de erro

Dado que o cliente não tem conexão com a internet
    E o cache esteja vazio
Quando o cliente solicitar para carregar suas compras
Então o sistema deve exibir uma mensagem de erro
```

# Carregar Compras do Cache

> ## Caso de Sucesso

- Sistema executa o comando "Carregar Compras"
- Sistema carrega os dados do Cache
- Sistema valida se o Cache tem menos de 3 dias
- Sistema cria uma lista de compras a partir dos dados do Cache
- Sistema retorna a lista de compras

> ## Exceção - Cache Expirado

- Sistema limpa o Cache
- Sistema retorna erro

> ## Exceção - Cache Vazio

- Sistema Retorna Erro

# Gravar Compras no Cache

> ## Caso de sucesso

- Sistema executa o comando "Salvar Compras"
- Sistema faz um encoding nos dados a serem gravados
- Sistema cria data um data para ser armazenada no Cache
- Sistema limpa os dados do Cache Atual
- Sistema Atualiza os novos dados no Cache
- Sistema não retorna nenhum error
