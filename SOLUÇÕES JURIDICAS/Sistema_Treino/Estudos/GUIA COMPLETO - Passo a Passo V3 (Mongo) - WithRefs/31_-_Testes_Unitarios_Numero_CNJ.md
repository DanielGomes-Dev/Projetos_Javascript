# 31 — Testes Unitários: Número CNJ

## 🎯 Objetivo

Escrever o primeiro teste automatizado do projeto — e, para isso, primeiro escrever a regra que ele testa: um validador completo do número de processo no padrão CNJ, algo que o projeto nunca teve até agora (desde o passo 14, `createLawsuit` só confere se `cnjNumber` foi enviado, nunca se ele **tem o formato certo**).

## 📝 Código

Crie `src/utils/cnjNumber.ts`:

```typescript
// src/utils/cnjNumber.ts
//
// Validação do número único de processo no padrão CNJ (Resolução CNJ
// nº 65/2008). Máscara: NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos):
//   NNNNNNN sequencial · DD dígito verificador (calculado) · AAAA ano
//   · J segmento do judiciário · TR tribunal · OOOO unidade de origem

const CNJ_FORMAT_REGEX = /^(\d{7})-(\d{2})\.(\d{4})\.(\d{1})\.(\d{2})\.(\d{4})$/;

/** Confere só o formato (a máscara), sem checar o dígito verificador. */
export function isValidCnjFormat(cnjNumber: string): boolean {
  return CNJ_FORMAT_REGEX.test(cnjNumber);
}

/**
 * Calcula os dois dígitos verificadores corretos, seguindo o algoritmo
 * oficial (módulo 97 — o mesmo princípio usado em IBAN e boletos).
 * Usamos BigInt porque o número concatenado chega a 20 dígitos, muito
 * além da precisão segura de um `number` do JavaScript (2^53).
 */
function calculateCheckDigits(
  sequential: string,
  year: string,
  segment: string,
  court: string,
  originUnit: string
): string {
  const base = BigInt(`${sequential}${year}${segment}${court}${originUnit}00`);
  const remainder = base % 97n;
  const checkDigits = (98n - remainder) % 97n;
  return checkDigits.toString().padStart(2, '0');
}

/** Validação COMPLETA: formato + dígito verificador. */
export function isValidCnjNumber(cnjNumber: string): boolean {
  const match = cnjNumber.match(CNJ_FORMAT_REGEX);
  if (!match) return false;

  const [, sequential, providedCheckDigits, year, segment, court, originUnit] = match;
  const expectedCheckDigits = calculateCheckDigits(sequential, year, segment, court, originUnit);

  return providedCheckDigits === expectedCheckDigits;
}
```

> ⚠️ **Este validador não está conectado a `createLawsuit` (passo 14) — de propósito.** Todos os números CNJ fictícios usados nos exemplos de `curl` deste guia (inclusive no seed, passo 16) foram inventados sem seguir o algoritmo oficial — eles falhariam nesse checksum. Conectar a validação agora quebraria todos os comandos que você já testou manualmente. Se quiser ativar, a mudança é uma linha em `createLawsuit`: `if (!isValidCnjNumber(cnjNumber)) throw new AppError('Número CNJ inválido.', 422);` — e use daí em diante os números matematicamente válidos do teste abaixo.

Crie `tests/unit/cnjNumber.test.ts`:

```typescript
// tests/unit/cnjNumber.test.ts
//
// Teste UNITÁRIO: testa cnjNumber.ts isolado, sem banco, sem API — por
// isso roda em milissegundos e não usa nenhum helper de banco de teste.

import { isValidCnjFormat, isValidCnjNumber } from '../../src/utils/cnjNumber.js';

describe('isValidCnjFormat (só a máscara)', () => {
  it('aceita o formato correto', () => {
    expect(isValidCnjFormat('0001234-72.2024.8.19.0001')).toBe(true);
  });

  it.each([
    ['0001234-72.2024.8.19.001', 'faltando 1 dígito na unidade de origem'],
    ['00012347220248190001', 'sem nenhuma pontuação/máscara'],
    ['abcdefg-72.2024.8.19.0001', 'sequencial não numérico'],
    ['', 'string vazia'],
  ])('rejeita "%s" (%s)', (invalid) => {
    expect(isValidCnjFormat(invalid)).toBe(false);
  });
});

describe('isValidCnjNumber (formato + dígito verificador)', () => {
  // Números calculados de verdade via módulo 97 — matematicamente
  // válidos, embora não sejam processos reais.
  it.each([
    '0001234-72.2024.8.19.0001',
    '0007654-27.2023.8.19.0002',
    '0009999-32.2024.8.19.0001',
    '0000001-40.2024.8.19.0001',
  ])('aceita um número com dígito verificador correto: %s', (valid) => {
    expect(isValidCnjNumber(valid)).toBe(true);
  });

  it('rejeita quando o dígito verificador está errado', () => {
    expect(isValidCnjNumber('0001234-56.2024.8.19.0001')).toBe(false);
  });

  it('rejeita antes mesmo de calcular o dígito, se o formato já estiver errado', () => {
    expect(isValidCnjNumber('numero-completamente-invalido')).toBe(false);
  });
});
```

## ✅ Como confirmar que funcionou

```bash
npm test -- cnjNumber
```

Deve reportar todos os testes `PASS`, rodando em poucos milissegundos.

## 🔧 Commit sugerido

```bash
git add src/utils/cnjNumber.ts
git commit -m "feat: adicionar validador de numero cnj"

git add tests/unit/cnjNumber.test.ts
git commit -m "test: adicionar testes unitarios do validador cnj"
```

## 📚 Documentação Oficial

- **Jest — `describe`/`it`/`it.each`**: https://jestjs.io/docs/api#describename-fn
- **Jest — `expect`**: https://jestjs.io/docs/expect
- **MDN — `BigInt`**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt
- **CNJ — Resolução nº 65/2008 (Numeração Única)**: https://atos.cnj.jus.br/atos/detalhar/119
