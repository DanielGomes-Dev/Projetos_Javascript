import mongoose from "../config/database";
import { Client, Lawsuit } from "../models";

async function seed(){
    await mongoose.connection.asPromise(); // espera a conexão abrir antes de limpar/inserir

    await Client.deleteMany({});
    await Lawsuit.deleteMany({});

    const maria = await Client.create({
        name: 'Maria Oliveira',
        document: '123.456.789-00',
        email: 'maria.oliveira@example.com',
    });

    const alfa = await Client.create({
        name: 'Construtora Alfa Ltda',
        document: '12.345.678/0001-90',
        email: 'contato@alfaconstrutora.example.com',
    });

    await Lawsuit.create({
        cnjNumber: '0001234-56.2024.8.19.0001',
        status: 'UPDATED',
        clientId: maria._id,
        movements: [
        { description: 'Citação enviada à parte ré.', date: new Date('2024-03-10') },
        { description: 'Juntada de contestação.', date: new Date('2024-04-02') },
        ],
    });

    await Lawsuit.create({
        cnjNumber: '0007654-32.2023.8.19.0002',
        status: 'PENDING',
        clientId: alfa._id,
        movements: [{ description: 'Processo distribuído.', date: new Date('2023-11-20') }],
    })

    console.log('Seed concluído: 2 clientes, 2 processos.');
    await mongoose.disconnect();
}


seed().catch((err:unknown)=>{
    console.error('Falha ao rodar o seed: ', err);
    process.exit(1);
})