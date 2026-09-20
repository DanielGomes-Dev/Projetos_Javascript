import { model, Schema } from "mongoose";

const deadLetterJobSchema = new Schema(
  {
    queueName: { type: String, required: true },
    jobId: { type: String, required: true },

    // Nula-vel de propósito — mas repare que, diferente do
    // onDelete: 'SET NULL' da V2 (que era GARANTIDO pelo Postgres se um
    // dia o processo original fosse apagado), aqui não existe nenhum
    // mecanismo do banco cuidando disso. Se um Lawsuit for apagado, um
    // lawsuitId antigo aqui simplesmente continua apontando para um id
    // que não existe mais — o MongoDB não vai limpar isso sozinho.
    // É uma troca real de robustez por simplicidade que vale conhecer:
    // bancos relacionais garantem esse tipo de coisa por baixo; bancos
    // de documento deixam a cargo da aplicação (ou você simplesmente
    // aceita o risco, como fazemos aqui, por ser só um log de erros).
    lawsuitId: { type: Schema.Types.ObjectId, ref: 'Lawsuit', default: null },

    payload: { type: Schema.Types.Mixed, required: true },
    errorMessage: { type: String, required: true },
    attemptsMade: { type: Number, required: true },
    failedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);


/* 

Esse trecho final do seu código faz duas coisas fundamentais no Mongoose: 
**cria índices para otimizar as buscas no banco de dados** e 
**exporta o Model** para que você possa salvar esses erros de fila.

Vamos dividir o código por partes:

### 1. Os Índices (`index`)

```typescript
deadLetterJobSchema.index({ lawsuitId: 1 });
deadLetterJobSchema.index({ queueName: 1 });

```

* **O que é um índice?** Pense nele como o índice remissivo (ou sumário) no final de um livro. 
Em vez de o MongoDB precisar "folhear" todas as linhas da tabela (coleção) 
uma por uma para achar registros que pertencem a um determinado `lawsuitId` ou `queueName`, o índice cria um caminho direto e ordenado.

* **O número `1**`: Significa **ordem ascendente** (crescente, de A a Z ou do menor para o maior).
* **Por que colocar isso aqui?** Como a tabela de *Dead Letter* (registro de jobs que falharam permanentemente) pode crescer bastante com o tempo, buscar logs de erro filtrando por um processo específico (`lawsuitId`) ou por uma fila (`queueName`) seria extremamente lento sem esses índices. Com eles, a busca fica instantânea.

### 2. A criação e exportação do Model

```typescript
const DeadLetterJob = model('DeadLetterJob', deadLetterJobSchema);

export default DeadLetterJob;

```

* **`model('DeadLetterJob', ...)`**: Constrói o modelo do Mongoose baseado no schema que você definiu acima. 
É através dessa variável `DeadLetterJob` que você fará operações no banco (como `DeadLetterJob.create({...})` para salvar um job que deu erro definitivo).

* **`export default DeadLetterJob;`**: Disponibiliza esse model para ser importado e usado em qualquer outro arquivo do seu projeto (por exemplo, dentro do worker, quando um job esgotar todas as tentativas e precisar ser gravado na *Dead Letter Queue*).


*/


deadLetterJobSchema.index({ lawsuitId: 1 });
deadLetterJobSchema.index({ queueName: 1 });

const DeadLetterJob = model('DeadLetterJob', deadLetterJobSchema);

export default DeadLetterJob;
