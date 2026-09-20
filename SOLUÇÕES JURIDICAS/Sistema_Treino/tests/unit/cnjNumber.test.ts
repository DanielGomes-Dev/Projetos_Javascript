// tests/unit/cnjNumber.test.ts
//
// Teste UNITÁRIO (Fase 7.2): testa `src/utils/cnjNumber.ts` isolado,
// sem tocar banco de dados, sem subir a API — é por isso que ele roda
// em milissegundos, e por isso NÃO precisa do `truncateAllTables()` /
// `closeTestDatabase()` que os testes de integração (Fase 7.3) usam.

import { isValidCnjFormat, isValidCnjNumber } from '../../src/utils/cnjNumber.js';

describe('isValidCnjFormat (só a máscara, sem checar o dígito verificador)', () => {
  it('aceita o formato correto: 7 dígitos, DD, ano, segmento, tribunal, unidade', () => {
    expect(isValidCnjFormat('0001234-72.2024.8.19.0001')).toBe(true);
  });

  it.each([
    ['0001234-72.2024.8.19.001', 'faltando 1 dígito na unidade de origem'],
    ['00012347220248190001', 'sem nenhuma pontuação/máscara'],
    ['abcdefg-72.2024.8.19.0001', 'sequencial não numérico'],
    ['', 'string vazia'],
    ['0001234-72.2024.88.19.0001', 'segmento do judiciário com 2 dígitos em vez de 1'],
  ])('rejeita "%s" (%s)', (invalid) => {
    expect(isValidCnjFormat(invalid)).toBe(false);
  });
});

describe('isValidCnjNumber (formato + dígito verificador, algoritmo oficial)', () => {
  // Estes 4 números foram gerados calculando o dígito verificador de
  // verdade (módulo 97) para dados fictícios — não são números de
  // processos reais, mas SÃO matematicamente válidos segundo o
  // algoritmo do CNJ, o que é exatamente o que este teste verifica.
  it.each([
    '0001234-72.2024.8.19.0001',
    '0007654-27.2023.8.19.0002',
    '0009999-32.2024.8.19.0001',
    '0000001-40.2024.8.19.0001',
  ])('aceita um número com dígito verificador correto: %s', (valid) => {
    expect(isValidCnjNumber(valid)).toBe(true);
  });

  it('rejeita quando o formato está certo mas o dígito verificador está errado', () => {
    // Mesmo número sequencial/ano/segmento/tribunal/origem do primeiro
    // caso acima ('0001234-72...'), mas com "56" no lugar do "72" —
    // um erro de digitação típico que o checksum existe para pegar.
    expect(isValidCnjNumber('0001234-56.2024.8.19.0001')).toBe(false);
  });

  it('rejeita antes mesmo de calcular o dígito, se o formato já estiver errado', () => {
    expect(isValidCnjNumber('numero-completamente-invalido')).toBe(false);
  });
});
