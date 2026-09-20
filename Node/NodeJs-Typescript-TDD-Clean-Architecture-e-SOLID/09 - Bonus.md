#

## Aula  1

- Testando a conexão com o MongoDb

## Aula 2

- Logger

#### Decorator

- Ao inves de injetar em todas as classes, usar um decorator

- Decorator -> instancia de um objeto rapper -> englobar;
  - injetar a classe que eu quero decorar -> do mesmo tipo que estou implementando
  - chamar o metodo dentro do decorator sendo possivel fazer algo a mais
  - main decorators -> log.ts
  - decorar um decorator

```
  class LogControllerDecorator implements Controller {

    private readonly controller: Controller

      constructor(controller: Controller){
        this.controller = controller
      }

      async handle (httpRequest: HttpRequest): Promise\<HttpReponse>{
        const httpResponse = await this.controller.handle(httpRequest)
        retur httpResponse;
      }
  }
```

## Aula 03 - Adicionando Log

- decorator recebe uma função e retornar o resultado dela tipo um getter/setter
- Criando Log Caso o controller retorne um server error
- logar o stack do erro

## Aula 04 - Refatorando Testes

- Quanto menor e explicativo o teste melhor;

## Aula 5 - 5. Persistindo Log de Erro no MongoDb

## 6. Criando Tag e fazendo Push para o GitHub
