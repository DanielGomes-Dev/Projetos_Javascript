const mongoose = require('mongoose');

const Student = require('../models/Student');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { calculateAge, calculateScholarshipPercentage } = require('../utils/validators');
const { AppError, badRequest, notFound, conflict, unprocessable } = require('../utils/httpErrors');
const { buildDriver } = require('../queue/enrollmentQueue');

const VALID_STATUSES = Enrollment.STATUSES;
const MAX_PROMOTION_ATTEMPTS = 20;

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.isValidObjectId(value);
}

function ok(data) {
  return { ok: true, data };
}

function fail(error) {
  if (error instanceof AppError) {
    return { ok: false, status: error.status, name: error.name, message: error.message };
  }
  throw error; // erro inesperado (infra, bug): propaga como 500 mesmo.
}

function unwrap(envelope) {
  if (envelope.ok) return envelope.data;
  throw new AppError(envelope.status, envelope.name, envelope.message);
}

async function performCreateEnrollment({ alunoId, cursoId } = {}) {
  try {
    if (!isValidObjectId(alunoId) || !isValidObjectId(cursoId)) {
      throw badRequest('alunoId/cursoId inválido');
    }

    const [aluno, curso] = await Promise.all([
      Student.findById(alunoId),
      Course.findById(cursoId)
    ]);
    if (!aluno) throw notFound('Aluno não encontrado');
    if (!curso) throw notFound('Curso não encontrado');

    if (curso.status !== 'ABERTO') {
      throw unprocessable('Curso encerrado para novas matrículas');
    }

    const idade = calculateAge(aluno.dataNascimento);
    if (idade < curso.idadeMinima) {
      throw unprocessable('Aluno não possui idade mínima exigida pelo curso');
    }

    const matriculaAtiva = await Enrollment.findActiveByAlunoAndCurso(alunoId, cursoId);
    if (matriculaAtiva) {
      throw conflict('Aluno já possui matrícula ativa neste curso');
    }

    const percentualBolsa = calculateScholarshipPercentage(aluno.rendaFamiliar);
    const valorFinal = Math.round(curso.valorMensalidade * (1 - percentualBolsa) * 100) / 100;

    const cursoComVagaReservada = await Course.incrementIfHasCapacity(cursoId);
    const status = cursoComVagaReservada ? 'CONFIRMADA' : 'FILA_ESPERA';

    try {
      const matricula = await Enrollment.createActive({ alunoId, cursoId, status, percentualBolsa, valorFinal });
      return ok(matricula.toObject());
    } catch (error) {

      if (status === 'CONFIRMADA') {
        await Course.decrementIfPositive(cursoId);
      }
      if (error.code === 11000) {

        throw conflict('Aluno já possui matrícula ativa neste curso');
      }
      throw error;
    }
  } catch (error) {
    return fail(error);
  }
}


async function promoteNextOrRelease(cursoId) {
  for (let attempt = 0; attempt < MAX_PROMOTION_ATTEMPTS; attempt += 1) {
    const candidato = await Enrollment.findFirstWaiting(cursoId);
    if (!candidato) {
      await Course.decrementIfPositive(cursoId);
      return null;
    }

    const promovida = await Enrollment.updateStatusIfCurrent(candidato._id, 'FILA_ESPERA', 'CONFIRMADA');
    if (promovida) {
      return promovida;
    }

  }


  await Course.decrementIfPositive(cursoId);
  return null;
}

async function performCancelEnrollment({ id } = {}) {
  try {
    if (!isValidObjectId(id)) {
      throw badRequest('id inválido');
    }

    const matricula = await Enrollment.findById(id);
    if (!matricula) {
      throw notFound('Matrícula não encontrada');
    }

    if (matricula.status === 'CANCELADA') {
      return ok(matricula.toObject());
    }

    const statusAnterior = matricula.status;

    const cancelada = await Enrollment.updateStatusIfCurrent(id, statusAnterior, 'CANCELADA');
    if (!cancelada) {
      const atual = await Enrollment.findById(id);
      return ok(atual.toObject());
    }

    if (statusAnterior === 'CONFIRMADA') {
      await promoteNextOrRelease(matricula.cursoId);
    }


    return ok(cancelada.toObject());
  } catch (error) {
    return fail(error);
  }
}

const queue = buildDriver({
  createEnrollment: performCreateEnrollment,
  cancelEnrollment: performCancelEnrollment
});

async function createEnrollment(payload) {
  const envelope = await queue.enqueue('createEnrollment', payload || {});
  return unwrap(envelope);
}

async function cancelEnrollment(id) {
  const envelope = await queue.enqueue('cancelEnrollment', { id });
  return unwrap(envelope);
}

async function listEnrollments({ cursoId, alunoId, status } = {}) {
  if (status && !VALID_STATUSES.includes(status)) {
    throw badRequest('status inválido');
  }
  if (cursoId && !isValidObjectId(cursoId)) {
    throw badRequest('cursoId inválido');
  }
  if (alunoId && !isValidObjectId(alunoId)) {
    throw badRequest('alunoId inválido');
  }

  const filter = {};
  if (cursoId) filter.cursoId = cursoId;
  if (alunoId) filter.alunoId = alunoId;
  if (status) filter.status = status;

  return Enrollment.find(filter).sort({ createdAt: 1, _id: 1 });
}

async function closeQueue() {
  await queue.close();
}

module.exports = { createEnrollment, listEnrollments, cancelEnrollment, closeQueue };
