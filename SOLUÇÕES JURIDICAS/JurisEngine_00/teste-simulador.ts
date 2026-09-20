// teste-simulador.ts (temporário, na raiz)
import { fetchTribunalMovements } from './src/workers/tribunalApi.simulator.js';

fetchTribunalMovements('0001234-56.2024.8.19.0001')
  .then((m) => console.log('Sucesso:', m))
  .catch((e) => console.error('Falha simulada:', e.message));