# 10 — Funções Puras de Validação

## 🎯 Objetivo

Antes de criar o model de aluno (capítulo 11) ou a regra de matrícula (capítulo 15), escrever as funções de validação e cálculo que essas camadas vão usar — isoladas do banco e do HTTP de propósito, porque são as peças mais fáceis (e mais baratas) de testar exaustivamente. Nenhuma dependência de Mongoose, Express ou banco de teste nesta suíte: ela roda em milissegundos.

## 🔴 Teste (Red)

Crie `tests/unit/validators.test.js` com a especificação completa, **antes** de qualquer implementação existir:

```javascript
// tests/unit/validators.test.js
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
```

Rode `npm test`: falha imediatamente com `Cannot find module '../../src/utils/validators'` — nem chega a executar as expectativas.

> 💡 **Por que escrever a especificação inteira de uma vez, em vez de uma função por vez?** Normalmente o ciclo TDD é bem mais curto — um teste, uma implementação mínima, repita. Aqui, como todas as funções são independentes umas das outras (nenhuma chama a outra) e o domínio já está bem definido pelas regras de bolsa/idade do desafio, escrever a especificação completa primeiro serve como um "contrato" documentado do módulo inteiro antes de qualquer linha de implementação. Nada impede fazer função-a-função se preferir um ciclo mais granular — o importante é que o teste sempre precede o código, não a ordem exata em que os testes são escritos.

## 🟢 Código (Green)

Crie `src/utils/validators.js`:

```javascript
// src/utils/validators.js
/**
 * Funções puras de validação e cálculo usadas pelas regras de negócio.
 * Ficam isoladas do banco e do HTTP de propósito: são as peças mais fáceis
 * de testar isoladamente (ver tests/unit/validators.test.js).
 */

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeCpf(cpf) {
  return String(cpf).replace(/\D/g, '');
}

// Para este desafio não é necessário validar os dígitos verificadores do
// CPF: apenas normalizar e exigir exatamente 11 dígitos.
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

/**
 * Idade em anos completos na data de referência (por padrão, agora),
 * usando ano/mês/dia do calendário. No dia do aniversário o aluno já
 * possui a nova idade.
 */
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

/**
 * Percentual de bolsa conforme a faixa de renda familiar.
 * até 2824.00 -> 50% | 2824.01 a 5648.00 -> 20% | a partir de 5648.01 -> 0%
 */
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
```

> 💡 **Por que `calculateAge` usa `getUTCFullYear`/`getUTCMonth`/`getUTCDate`, em vez dos equivalentes locais (`getFullYear`, etc.)?** Datas de nascimento, neste projeto, chegam e são armazenadas como datas civis "puras" (ano-mês-dia), sem hora — e são interpretadas em UTC desde a criação do dado (isso fica explícito no capítulo 11, quando `dataNascimento` é convertida a partir de uma string `YYYY-MM-DD`). Usar os métodos `UTC` consistentemente em todo o cálculo evita que o resultado mude dependendo do fuso horário configurado na máquina onde o código roda — um bug sutil e realista se a API rodar num servidor em UTC mas for testada num notebook em outro fuso.
>
> ⚠️ **Por que não bastava `ref.getUTCFullYear() - birth.getUTCFullYear()`?** Esse cálculo ingênuo erra sempre que a data de referência ainda não "passou" pelo mês/dia do nascimento naquele ano — por isso o teste de nascimento em dezembro/referência em janeiro existe: sem o ajuste de `-1`, o teste acusaria 24 anos em vez dos 23 corretos. É exatamente o tipo de caso de borda que só aparece com um teste dedicado a ele — dificilmente seria notado só olhando o código.
>
> 💡 **`hasAtMostTwoDecimals` usa `Math.round(value * 100) / 100 === value`, não uma verificação de string.** Multiplicar por 100, arredondar, dividir de volta e comparar com o valor original é uma forma comum de checar "no máximo duas casas decimais" em ponto flutuante sem cair nas armadilhas clássicas de comparação direta de decimais (`0.1 + 0.2 !== 0.3`) — funciona aqui porque estamos comparando o valor consigo mesmo depois de uma operação determinística, não comparando dois valores calculados independentemente.

## ✅ Como confirmar que funcionou

```bash
npm test -- validators
```

Todos os testes de `tests/unit/validators.test.js` devem passar — e devem rodar quase instantaneamente (sem banco, sem HTTP envolvidos).

## 🔧 Commit sugerido

```bash
git add tests/unit/validators.test.js
git commit -m "test: adicionar testes unitarios das funcoes de validacao"

git add src/utils/validators.js
git commit -m "feat: adicionar funcoes puras de validacao de aluno e bolsa"
```

## 📚 Documentação Oficial

- **Jest — `describe`/`it`**: https://jestjs.io/docs/api#describename-fn
- **MDN — `Date.prototype.getUTCFullYear()` e métodos UTC**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
- **MDN — precisão de ponto flutuante em JavaScript**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number#precisao_de_ponto_flutuante
