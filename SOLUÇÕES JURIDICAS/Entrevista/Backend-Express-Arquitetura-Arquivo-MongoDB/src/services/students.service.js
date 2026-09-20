const Student = require('../models/Student');
const {
  isNonEmptyString,
  normalizeCpf,
  isValidCpf,
  normalizeEmail,
  isValidEmail,
  hasAtMostTwoDecimals
} = require('../utils/validators');
const { badRequest, conflict } = require('../utils/httpErrors');

function parseDataNascimento(dataNascimento) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
    throw badRequest('dataNascimento deve estar no formato YYYY-MM-DD');
  }

  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  const nascimento = new Date(Date.UTC(ano, mes - 1, dia));

  const isDataCivilValida = nascimento.getUTCFullYear() === ano
    && nascimento.getUTCMonth() === mes - 1
    && nascimento.getUTCDate() === dia;
  if (!isDataCivilValida) {
    throw badRequest('dataNascimento inválida');
  }

  const hoje = new Date();
  const hojeUTC = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  if (nascimento > hojeUTC) {
    throw badRequest('dataNascimento não pode estar no futuro');
  }

  return nascimento;
}

async function listStudents() {
  return Student.find().sort({ createdAt: 1 });
}

async function createStudent(payload = {}) {
  const { nome, cpf, email, dataNascimento, rendaFamiliar } = payload;

  if (!isNonEmptyString(nome)
    || !isNonEmptyString(cpf)
    || !isNonEmptyString(email)
    || !isNonEmptyString(dataNascimento)
    || rendaFamiliar === undefined
    || rendaFamiliar === null) {
    throw badRequest('Todos os campos são obrigatórios');
  }

  const nascimento = parseDataNascimento(dataNascimento);

  if (typeof rendaFamiliar !== 'number' || rendaFamiliar < 0 || !hasAtMostTwoDecimals(rendaFamiliar)) {
    throw badRequest('rendaFamiliar deve ser um número maior ou igual a zero, com no máximo duas casas decimais');
  }

  if (!isValidCpf(cpf)) {
    throw badRequest('cpf deve conter exatamente 11 dígitos');
  }
  const cpfNormalizado = normalizeCpf(cpf);

  if (!isValidEmail(email)) {
    throw badRequest('email inválido');
  }
  const emailNormalizado = normalizeEmail(email);

  const [cpfExistente, emailExistente] = await Promise.all([
    Student.findByCpf(cpfNormalizado),
    Student.findByEmail(emailNormalizado)
  ]);
  if (cpfExistente) throw conflict('cpf já cadastrado');
  if (emailExistente) throw conflict('email já cadastrado');

  try {
    return await Student.create({
      nome: nome.trim(),
      cpf: cpfNormalizado,
      email: emailNormalizado,
      dataNascimento: nascimento,
      rendaFamiliar
    });
  } catch (error) {

    if (error.code === 11000) {
      throw conflict('cpf ou email já cadastrado');
    }
    throw error;
  }
}

module.exports = { listStudents, createStudent };
