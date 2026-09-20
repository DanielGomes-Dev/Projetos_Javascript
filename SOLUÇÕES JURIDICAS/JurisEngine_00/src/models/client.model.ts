import {Schema, model} from 'mongoose';


const clientSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
        },
        document: {
            //CPF
            type: String,
            required: true,
            unique: true,
        },
        email: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true,
        toJSON: {
            // O Mongoose serializa documentos com "_id" (ObjectId) e "__v"
            // (controle interno de versão) por padrão — nomes que vazam
            // detalhe de implementação do banco para a resposta HTTP. Esta
            // transformação troca "_id" por um "id" (string) mais limpo, e
            // remove "__v", em toda resposta JSON deste model.
            transform: (_doc, ret) => {
                ret.id = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    },
)

const Client = model('Client', clientSchema);

export default Client;