import type { NextConfig } from 'next';

// Enquanto a migração não termina, o endereço principal continua mostrando o sistema atual
// (public/legado.html), sem mudar o endereço que aparece no navegador. A base nova fica em /novo.
const config: NextConfig = {
  async rewrites(){
    return {
      beforeFiles: [
        { source: '/', destination: '/legado.html' },
        { source: '/index.html', destination: '/legado.html' }
      ],
      afterFiles: [],
      fallback: []
    };
  }
};

export default config;
