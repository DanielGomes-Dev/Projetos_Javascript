import type {Request, Response} from 'express';
import { AppError } from '../middlewares/AppError';
import { Client } from '../models';

interface CreateClientBody {
    name?: string;
    document?: string;
    email?: string | null;
}


export async function createClient(req: Request<unknown, unknown, CreateClientBody>, res: Response){
    const {name, document, email} = req.body;

    if(!name || !document){
        throw new AppError('Os Campos "name" e "Document" são obrigatorios', 422);
    }
    console.log(name, document, email);
    const client = await Client.create({name, document, email: email ?? null});

    return res.status(201).json(client);

}

export async function listClients(req: Request, res: Response){
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limite) || 10));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        Client.find().sort({createAt: -1}).skip(skip).limit(limit),
        Client.countDocuments(),
    ])


    return res.status(200).json({
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total/limit)
        }
    })
}


export async function getClientById(req: Request<{id: string}>,res: Response){
    const client = await Client.findById(req.params.id);

    if(!client){
        throw new AppError('Client não encontrado.', 404);
    }

    return res.status(200).json(client);
}