function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeCpf(cpf) {
  return String(cpf).replace(/\D/g, '');
}

function isValidCpf(cpf) {
  if (typeof cpf !== 'string') return false;
  return normalizeCpf(cpf).length === 11;
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return EMAIL_REGEX.test(normalizeEmail(email));
}

function hasAtMostTwoDecimals(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return Math.round(value * 100) / 100 === value;
}


function calculateAge(birthDate, referenceDate = new Date()) {
  const birth = new Date(birthDate);
  const ref = new Date(referenceDate);

  let age = ref.getUTCFullYear() - birth.getUTCFullYear();

  const aniversarioAindaNaoChegou = ref.getUTCMonth() < birth.getUTCMonth()
    || (ref.getUTCMonth() === birth.getUTCMonth() && ref.getUTCDate() < birth.getUTCDate());

  if (aniversarioAindaNaoChegou) {
    age -= 1;
  }

  return age;
}

function calculateScholarshipPercentage(rendaFamiliar) {
  if (rendaFamiliar <= 2824.00) return 0.5;
  if (rendaFamiliar <= 5648.00) return 0.2;
  return 0;
}

module.exports = {
  isNonEmptyString,
  normalizeCpf,
  isValidCpf,
  normalizeEmail,
  isValidEmail,
  hasAtMostTwoDecimals,
  calculateAge,
  calculateScholarshipPercentage
};
