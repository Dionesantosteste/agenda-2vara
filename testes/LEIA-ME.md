# Testes automáticos

Estes testes abrem o sistema num navegador de verdade (Chromium) e conferem os fluxos principais de
cada seção: Agenda, Audiências, Perícias, Prazos e Organização. Eles são a **rede de segurança da
migração**: os mesmos testes rodam no `index.html` de hoje e no sistema novo, e se passarem nos dois,
o comportamento ficou igual.

## O banco nos testes

Os testes **não usam o Supabase de verdade**. O arquivo `apoio/supabase-falso.js` responde às mesmas
chamadas que o site faz ao Supabase (tabelas e funções `org_*`), seguindo as regras do
`sql/organizacao.sql`. Qualquer outro acesso à internet é bloqueado. Cada teste começa com um banco
vazio e coloca nele só os dados de que precisa.

Um teste falha também quando:
- a página tem algum erro de JavaScript;
- o site chama uma tabela ou função que o simulador não conhece (aí é preciso ensiná-la em
  `apoio/supabase-falso.js`, seguindo o SQL).

## Rodar

```bash
cd testes
npm install
npx playwright install chromium   # só na primeira vez
npm test                          # roda tudo
npm run test:ver                  # roda mostrando o navegador
```

Para testar outro endereço (por exemplo, o sistema novo rodando no computador):

```bash
SITE_URL=http://localhost:3000 npm test
```

No GitHub, os testes rodam sozinhos em cada pull request (aba **Actions**). Quando algum falha, o
relatório fica disponível para download na própria execução.

## Organização das pastas

- `casos/`: os testes, um arquivo por seção.
- `apoio/supabase-falso.js`: o Supabase simulado.
- `apoio/teste.js`: a base de todos os testes (banco novo por teste, bloqueio da internet e uma sessão de login de mentira, já que o site só abre para quem entrou).
- `apoio/org.js`: atalhos da Organização (entrar como pessoa ou gestor, cartões, colunas).
- O site é montado e servido pelo próprio Next.js (`npm run build` e `npm start` na pasta de cima).
