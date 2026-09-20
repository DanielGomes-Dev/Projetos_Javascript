'use strict';
const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const client1Id = randomUUID();
    const client2Id = randomUUID();
    const lawsuit1Id = randomUUID();
    const lawsuit2Id = randomUUID();

    await queryInterface.bulkInsert('clients', [
      {
        id: client1Id,
        name: 'Maria Oliveira',
        document: '123.456.789-00',
        email: 'maria.oliveira@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: client2Id,
        name: 'Construtora Alfa Ltda',
        document: '12.345.678/0001-90',
        email: 'contato@alfaconstrutora.example.com',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await queryInterface.bulkInsert('lawsuits', [
      {
        id: lawsuit1Id,
        cnj_number: '0001234-56.2024.8.19.0001',
        status: 'ACTIVE',
        client_id: client1Id,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: lawsuit2Id,
        cnj_number: '0007654-32.2023.8.19.0002',
        status: 'PENDING',
        client_id: client2Id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    await queryInterface.bulkInsert('movements', [
      {
        id: randomUUID(),
        lawsuit_id: lawsuit1Id,
        description: 'Citação enviada à parte ré.',
        date: new Date('2024-03-10'),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: randomUUID(),
        lawsuit_id: lawsuit1Id,
        description: 'Juntada de contestação.',
        date: new Date('2024-04-02'),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: randomUUID(),
        lawsuit_id: lawsuit2Id,
        description: 'Processo distribuído.',
        date: new Date('2023-11-20'),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('movements', null, {});
    await queryInterface.bulkDelete('lawsuits', null, {});
    await queryInterface.bulkDelete('clients', null, {});
  },
};
