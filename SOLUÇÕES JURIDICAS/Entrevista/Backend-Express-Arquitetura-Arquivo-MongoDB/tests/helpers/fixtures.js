const Student = require('../../src/models/Student');
const Course = require('../../src/models/Course');

let sequence = 0;

function nextSequence() {
  sequence += 1;
  return sequence;
}

async function createStudent(overrides = {}) {
  const n = nextSequence();
  return Student.create({
    nome: `Aluno Teste ${n}`,
    cpf: String(10000000000 + n).padStart(11, '0'),
    email: `aluno${n}@example.com`,
    dataNascimento: new Date('2000-01-01T00:00:00.000Z'),
    rendaFamiliar: 3000,
    ...overrides
  });
}

async function createCourse(overrides = {}) {
  const n = nextSequence();
  return Course.create({
    nome: `Curso Teste ${n}`,
    codigo: `COD-${n}`,
    idadeMinima: 0,
    capacidadeVagas: 5,
    valorMensalidade: 1000,
    status: 'ABERTO',
    ...overrides
  });
}

module.exports = { createStudent, createCourse };
