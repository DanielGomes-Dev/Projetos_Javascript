const {
  calculateAge,
  calculateScholarshipPercentage,
  hasAtMostTwoDecimals,
  isValidCpf,
  normalizeCpf,
  isValidEmail,
  normalizeEmail,
  isNonEmptyString
} = require('../../src/utils/validators');

describe('calculateAge', () => {
  it('calcula a idade corretamente antes do aniversário', () => {
    const nascimento = new Date('2000-08-20T00:00:00.000Z');
    const referencia = new Date('2024-08-19T00:00:00.000Z');
    expect(calculateAge(nascimento, referencia)).toBe(23);
  });

  it('já considera a nova idade no dia do aniversário', () => {
    const nascimento = new Date('2000-08-20T00:00:00.000Z');
    const referencia = new Date('2024-08-20T00:00:00.000Z');
    expect(calculateAge(nascimento, referencia)).toBe(24);
  });

  it('calcula a idade corretamente depois do aniversário', () => {
    const nascimento = new Date('2000-08-20T00:00:00.000Z');
    const referencia = new Date('2024-08-21T00:00:00.000Z');
    expect(calculateAge(nascimento, referencia)).toBe(24);
  });

  it('não usa apenas a diferença de anos (nascido em dezembro, referência em janeiro)', () => {
    const nascimento = new Date('2000-12-31T00:00:00.000Z');
    const referencia = new Date('2024-01-01T00:00:00.000Z');
    expect(calculateAge(nascimento, referencia)).toBe(23);
  });
});

describe('calculateScholarshipPercentage', () => {
  it('concede 50% para renda até 2824.00', () => {
    expect(calculateScholarshipPercentage(0)).toBe(0.5);
    expect(calculateScholarshipPercentage(2824.00)).toBe(0.5);
  });

  it('concede 20% para renda entre 2824.01 e 5648.00', () => {
    expect(calculateScholarshipPercentage(2824.01)).toBe(0.2);
    expect(calculateScholarshipPercentage(5648.00)).toBe(0.2);
  });

  it('não concede bolsa para renda a partir de 5648.01', () => {
    expect(calculateScholarshipPercentage(5648.01)).toBe(0);
    expect(calculateScholarshipPercentage(10000)).toBe(0);
  });
});

describe('hasAtMostTwoDecimals', () => {
  it('aceita números com até duas casas decimais', () => {
    expect(hasAtMostTwoDecimals(10)).toBe(true);
    expect(hasAtMostTwoDecimals(10.5)).toBe(true);
    expect(hasAtMostTwoDecimals(10.99)).toBe(true);
  });

  it('rejeita números com mais de duas casas decimais', () => {
    expect(hasAtMostTwoDecimals(10.999)).toBe(false);
  });
});

describe('cpf', () => {
  it('normaliza removendo pontuação e valida 11 dígitos', () => {
    expect(normalizeCpf('123.456.789-00')).toBe('12345678900');
    expect(isValidCpf('123.456.789-00')).toBe(true);
  });

  it('rejeita cpf com menos de 11 dígitos', () => {
    expect(isValidCpf('123')).toBe(false);
  });

  it('rejeita cpf com mais de 11 dígitos', () => {
    expect(isValidCpf('123456789000')).toBe(false);
  });
});

describe('email', () => {
  it('normaliza com trim e lowercase', () => {
    expect(normalizeEmail('  Maria@Example.com ')).toBe('maria@example.com');
  });

  it('valida formato básico', () => {
    expect(isValidEmail('maria@example.com')).toBe(true);
    expect(isValidEmail('invalido')).toBe(false);
  });
});

describe('isNonEmptyString', () => {
  it('rejeita string vazia ou só com espaços', () => {
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString('   ')).toBe(false);
  });

  it('aceita string não vazia', () => {
    expect(isNonEmptyString('Maria')).toBe(true);
  });
});
