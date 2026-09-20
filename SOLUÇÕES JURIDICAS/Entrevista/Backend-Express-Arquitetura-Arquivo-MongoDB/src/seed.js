require('dotenv').config();
const mongoose = require('mongoose');
const Course = require('./models/Course');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27028/desafio_senior';

const initialCourses = [
  {
    nome: 'Introdução ao Direito Digital e Proteção de Dados',
    codigo: 'DIR-DIG-01',
    descricao: 'Fundamentos de LGPD, segurança da informação e compliance digital.',
    idadeMinima: 18,
    capacidadeVagas: 2, // Vagas pequenas propositalmente para facilitar testes de fila de espera!
    valorMensalidade: 600.00,
    status: 'ABERTO'
  },
  {
    nome: 'Lógica de Programação e Algoritmos com JavaScript',
    codigo: 'DEV-LOG-01',
    descricao: 'Introdução à computação, estruturas de dados e algoritmos.',
    idadeMinima: 16,
    capacidadeVagas: 5,
    valorMensalidade: 450.00,
    status: 'ABERTO'
  },
  {
    nome: 'Especialização em Arquitetura de Software e Microsserviços',
    codigo: 'ARQ-SEN-01',
    descricao: 'Princípios de design, integração entre serviços e evolução de sistemas.',
    idadeMinima: 21,
    capacidadeVagas: 1, // Capacidade 1 para teste rápido de lotação e repescagem
    valorMensalidade: 1200.00,
    status: 'ABERTO'
  }
];

async function seed() {
  try {
    console.log('Conectando ao MongoDB para executar seed...');
    await mongoose.connect(MONGO_URI);

    await Course.init();

    console.log('Criando ou atualizando cursos iniciais...');
    await Course.bulkWrite(initialCourses.map(course => ({
      updateOne: {
        filter: { codigo: course.codigo },
        update: {
          $set: course,
          $setOnInsert: { vagasOcupadas: 0 }
        },
        upsert: true
      }
    })));

    console.log('✅ Seed executado com sucesso! Cursos disponíveis:');
    const courses = await Course.find();
    console.table(courses.map(c => ({
      Codigo: c.codigo,
      Nome: c.nome,
      IdadeMin: c.idadeMinima,
      Vagas: `${c.vagasOcupadas}/${c.capacidadeVagas}`,
      Mensalidade: `R$ ${c.valorMensalidade.toFixed(2)}`
    })));
  } catch (error) {
    console.error('❌ Erro ao executar seed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();
