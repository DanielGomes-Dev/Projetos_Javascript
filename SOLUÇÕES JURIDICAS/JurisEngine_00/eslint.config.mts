// eslint.config.mts
//
// Extensão .mts (não .js nem .ts): o "flat config" do ESLint moderno
// aceita configuração escrita em TypeScript diretamente, e .mts deixa
// explícito que este arquivo específico é sempre ESM — independente do
// "type" do package.json.

// Importa as regras base e recomendadas para JavaScript do próprio ESLint
import js from "@eslint/js"; 
// Importa variáveis globais comuns (ex: 'window', 'document' do navegador, ou 'process' do Node)
import globals from "globals"; 
// Importa o ferramental do TypeScript para o ESLint (parser, regras recomendadas, etc.)
import tseslint from "typescript-eslint"; 
// Importa a função utilitária para tipar a configuração (ajuda com autocompletar no seu editor de código)
import { defineConfig } from "eslint/config"; 

// Exporta a configuração final em formato de array, que é o padrão do Flat Config
export default defineConfig([
  {
    // Define para quais arquivos este bloco de regras será aplicado (todos os arquivos JS e TS)
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], 
    
    // Registra o plugin base do JavaScript
    plugins: { js }, 
    
    // Estende as regras recomendadas do JavaScript (ajuda a pegar erros comuns de JS)
    extends: ["js/recommended"], 
    
    // Configurações de linguagem, como quais variáveis globais o ESLint deve ignorar/reconhecer
    languageOptions: { 
      // globals.browser avisa ao ESLint que estamos no navegador, então ele não vai
      // reclamar se você usar 'window', 'document', 'fetch', etc.
      globals: globals.browser 
    },
  },
  // Adiciona todo o pacote de regras recomendadas especificamente para TypeScript
  // (faz validações de tipos e boas práticas do TS)
  tseslint.configs.recommended, 
]);