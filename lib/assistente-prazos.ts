// Ferramentas de prazo do Assistente: a IA consulta a Tabela de prazos e calcula o vencimento
// com a MESMA conta e o MESMO calendário da seção Prazos (feriados, suspensões e recesso da vara).
// Assim a IA não conta dias "de cabeça".
import { normalizar } from './agenda.ts';
import { ATOS, ATO_POR_ID, UN_TXT, type Ato, type Unidade } from './prazos/atos.ts';
import { calcular, DOBRO, FORMAS, type Dobro, type Forma } from './prazos/calculo.ts';
import type { Calendario } from './prazos/calendario.ts';
import { diaDaSemana, fmt } from './prazos/datas.ts';
import { palavras } from './assistente.ts';

const UNIDADES: Record<string, Unidade> = { uteis: 'u', corridos: 'c', meses: 'm', anos: 'a' };
const semMarcas = (s: string) => s.replace(/<[^>]+>/g, '');

// Atos da Tabela de prazos que combinam com a busca (id, ato, prazo, artigo e de quando conta)
export function buscarAtos(termo: string, limite = 6): Ato[] {
  const ps = palavras(termo);
  if (!ps.length) return [];
  return ATOS
    .map(a => {
      const nome = normalizar(a.ato + ' ' + a.g), resto = normalizar(a.art + ' ' + a.ini + ' ' + a.id);
      let n = 0;
      for (const p of ps) n += nome.includes(p) ? 2 : resto.includes(p) ? 1 : 0;
      return { a, n };
    })
    .filter(x => x.n > 0)
    .sort((x, y) => y.n - x.n)
    .slice(0, limite)
    .map(x => x.a);
}

export function atosEmTexto(atos: Ato[]): string {
  if (!atos.length) return 'Nenhum ato da Tabela de prazos combina com a busca.';
  return atos.map(a => '- ' + a.ato + ' [id: ' + a.id + ']: ' + a.n + ' ' + UN_TXT[a.un][a.n === 1 ? 0 : 1]
    + ' (' + a.art + ')' + (a.dir === 'antes' ? ', contado para trás a partir da audiência' : '') + (a.sd ? ', prazo próprio (não dobra)' : '')
    + '. Conta: ' + a.ini).join('\n');
}

export type EntradaPrazo = {
  ato_id: string;        // id da Tabela de prazos (opcional: vazio usa dias e unidade)
  dias: number;          // quantidade (vale quando não há ato_id)
  unidade: string;       // uteis, corridos, meses ou anos
  forma: string;         // djen, pje, dom, juntada ou ciencia
  data: string;          // AAAA-MM-DD: disponibilização, envio, confirmação, juntada ou ciência (ou a audiência, se o ato conta para trás)
  data_leitura: string;  // AAAA-MM-DD, só no PJe, se a intimação foi lida antes dos 10 dias
  dobro: string;         // vazio, faz, mp, dp ou lit
};

// Calcula e devolve o passo a passo em texto, para a IA explicar ao gestor
export function calcularPrazoIA(e: EntradaPrazo, cal: Calendario): string {
  const ato = e.ato_id ? ATO_POR_ID[e.ato_id] : undefined;
  if (e.ato_id && !ato) return 'Ato não encontrado na Tabela de prazos: ' + e.ato_id + '. Use buscar_prazo_tabela para achar o id, ou informe dias e unidade.';
  const un = ato ? ato.un : UNIDADES[e.unidade];
  const n = ato ? ato.n : Math.round(Number(e.dias));
  if (!un) return 'Unidade inválida: use uteis, corridos, meses ou anos.';
  if (!(n > 0) || n > 3650) return 'Informe a quantidade de dias (ou o ato da tabela).';
  const forma: Forma = ato?.forma || ((e.forma in FORMAS ? e.forma : 'ciencia') as Forma);
  const dobro = (e.dobro in DOBRO ? e.dobro : '') as Dobro;
  const regressivo = ato?.dir === 'antes';
  const r = calcular({ ato, n, un, dir: regressivo ? 'antes' : 'apos', forma, d1: e.data, d2: e.data_leitura, alvo: regressivo ? e.data : '', dobro }, cal);
  if (!r.ok) return 'Não deu para calcular: ' + (r.erro || 'confira as datas (formato AAAA-MM-DD).');
  const linhas = [
    (ato ? ato.ato + ' (' + ato.art + ')' : 'Prazo') + ': ' + (r.nFinal ?? n) + ' ' + UN_TXT[un][(r.nFinal ?? n) === 1 ? 0 : 1]
      + (regressivo ? ', contado para trás' : '') + (regressivo ? '' : '. Forma da intimação: ' + FORMAS[forma].lbl.toLowerCase() + '.'),
    ...r.passos.map(p => (p.fim ? '>> ' : '- ') + fmt(p.d) + ' (' + diaDaSemana(p.d) + '): ' + p.t + (p.s ? '. ' + p.s : '')),
    ...r.avisos.map(a => 'Aviso: ' + semMarcas(a))
  ];
  if (r.venc) linhas.push('Vencimento: ' + fmt(r.venc) + ' (' + diaDaSemana(r.venc) + ').');
  linhas.push('Calculado com o calendário da vara (seção Prazos). Para a certidão de decurso, a seção Prazos também gera o texto.');
  return linhas.join('\n');
}
