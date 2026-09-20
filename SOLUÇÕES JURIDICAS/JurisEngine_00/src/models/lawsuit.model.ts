import { Schema, model } from "mongoose";
import { movementSchema } from "./movement.schema";

const lawsuitSchema = new Schema({
    cnjNumber: {
        type: String,
        required: true,
        unique: true,
    },

    status: { //Tracing queue (ou rastreamento de filas) é o processo de seguir o caminho e o desempenho de uma mensagem ou tarefa enquanto ela passa por uma fila de mensagens (como RabbitMQ, Kafka ou SQS) em sistemas distribuído
        type: String,
        enum: ['PENDING', 'UPDATED'],
        default: 'PENDING',
    },

    clientId: {
        type: Schema.Types.ObjectId,
        ref: 'Client',
        required: true,
    },

    movements: {
        type: [movementSchema],
        default: [],
    }
    },

    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: (_doc, ret) => {
                ret.id = ret._id.toString();
                delete ret._id;
                delete ret.__vd;
                return ret;

            }
        }
    }

);

// Virtual populate: expõe o cliente vinculado sob a chave "client" no
// JSON de resposta (usado no passo 14), sem precisar guardar o cliente
// duplicado dentro do processo — só a referência (clientId) fica salva
// no banco; o Mongoose "junta" o cliente na hora da consulta, quando
// pedido explicitamente com .populate('client').

lawsuitSchema.virtual('client', {
    ref: 'Client',
    localField: 'clientId',
    foreignField: '_id',
    justOne: true,
})

const Lawsuit = model('Lawsuit', lawsuitSchema);

export default Lawsuit;