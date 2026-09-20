'use strict';

// 20260101000004-create-dead-letter-jobs.cjs
//
// Migration da tabela `dead_letter_jobs` (Fase 4.2c). Reconstruída a
// partir de `src/models/deadLetterJob.model.ts` — os nomes de coluna
// aqui (snake_case) são exatamente os que o `field: '...'` de cada
// atributo do model espera, graças ao `underscored: true`.
//
// ⚠️ Este arquivo chegou a existir, por engano, com o conteúdo inteiro
// de `src/workers/lawsuitSync.worker.ts` colado aqui dentro (código
// TypeScript com `import`, que quebra ao rodar `sequelize-cli db:migrate`
// com o erro "Cannot use import statement outside a module"). Este é o
// conteúdo correto da migration — ver a Fase 4.2c do guia para o
// histórico completo desse bug.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('dead_letter_jobs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      queue_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      job_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      // Nullable e com onDelete: 'SET NULL' (diferente de `movements`,
      // que usa CASCADE): mesmo que o processo original seja apagado,
      // queremos manter o registro na DLQ para investigação — só a
      // referência ao processo é que se perde.
      lawsuit_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'lawsuits',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      attempts_made: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      failed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('dead_letter_jobs', ['lawsuit_id']);
    await queryInterface.addIndex('dead_letter_jobs', ['queue_name']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('dead_letter_jobs');
  },
};
