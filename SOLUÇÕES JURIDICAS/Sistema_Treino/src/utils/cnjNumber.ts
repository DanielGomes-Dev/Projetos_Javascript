// src/utils/cnjNumber.ts
//
// Validação do número único de processo no padrão CNJ (Conselho
// Nacional de Justiça, Resolução nº 65/2008) — o mesmo formato usado
// no campo `cnjNumber` das tabelas `lawsuits` desde a Fase 2.
//
// Máscara: NNNNNNN-DD.AAAA.J.TR.OOOO  (20 dígitos no total)
//   NNNNNNN  (7 dígitos) — número sequencial do processo
//   DD       (2 dígitos) — dígito verificador (CALCULADO, não arbitrário)
//   AAAA     (4 dígitos) — ano de ajuizamento
//   J        (1 dígito)  — segmento do Judiciário (ex.: 8 = Justiça Estadual)
//   TR       (2 dígitos) — tribunal
//   OOOO     (4 dígitos) — unidade de origem (vara/comarca)
//
// Este módulo é usado pelos testes UNITÁRIOS da Fase 7.2 — ele não é
// (ainda) chamado por nenhum controller. Veja a nota no guia (Fase 7.2)
// sobre a decisão consciente de NÃO acoplar esta validação ao
// `createLawsuit` por padrão, e como habilitá-la se você quiser.

const CNJ_FORMAT_REGEX = /^(\d{7})-(\d{2})\.(\d{4})\.(\d{1})\.(\d{2})\.(\d{4})$/;

/**
 * Confere SÓ o formato (a máscara) — não confirma se o dígito
 * verificador está matematicamente correto. Útil como primeiro filtro
 * rápido (ex.: numa validação de formulário, antes de gastar
 * processamento com o cálculo do checksum).
 */
export function isValidCnjFormat(cnjNumber: string): boolean {
  return CNJ_FORMAT_REGEX.test(cnjNumber);
}

/**
 * Calcula os dois dígitos verificadores CORRETOS para os demais
 * componentes de um número CNJ, seguindo o algoritmo oficial (Art. 3º
 * da Resolução CNJ nº 65/2008) — uma variação do módulo 97 (o mesmo
 * princípio usado em IBAN e em linhas digitáveis de boleto bancário),
 * que existe para detectar erros de digitação (dígitos trocados,
 * invertidos, etc.) sem precisar consultar nenhum banco de dados.
 *
 * Usamos `BigInt` porque o número formado pela concatenação de todos
 * os componentes chega a ter até 20 dígitos — muito além do limite de
 * precisão segura de um `number` do JavaScript (2^53 ≈ 16 dígitos),
 * que já começaria a arredondar o resultado de forma incorreta.
 */
function calculateCheckDigits(
  sequential: string,
  year: string,
  segment: string,
  court: string,
  originUnit: string
): string {
  // "00" no final, no lugar dos dígitos verificadores reais — é assim
  // que o algoritmo oficial define o número-base sobre o qual o
  // módulo 97 é calculado.
  const base = BigInt(`${sequential}${year}${segment}${court}${originUnit}00`);
  const remainder = base % 97n;
  const checkDigits = (98n - remainder) % 97n;
  return checkDigits.toString().padStart(2, '0');
}

/**
 * Validação COMPLETA: formato + dígito verificador. É esta função que
 * você deveria chamar sempre que precisar confirmar que um número CNJ
 * é genuíno (bate com o algoritmo oficial) — não só "parece" um.
 */
export function isValidCnjNumber(cnjNumber: string): boolean {
  const match = cnjNumber.match(CNJ_FORMAT_REGEX);
  if (!match) return false;

  const [, sequential, providedCheckDigits, year, segment, court, originUnit] = match;
  const expectedCheckDigits = calculateCheckDigits(sequential, year, segment, court, originUnit);

  return providedCheckDigits === expectedCheckDigits;
}
