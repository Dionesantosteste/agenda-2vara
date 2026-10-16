// Cálculo do prazo (o mesmo do sistema atual): a partir da intimação, contagem regressiva antes de uma
// data (audiência) ou prazo máximo do ECA contado direto da data informada.
// Os avisos vêm com marcação simples (<b>) e o texto variável já escapado.
import type { Ato, Unidade } from './atos.ts';
import { UN_TXT } from './atos.ts';
import type { Calendario } from './calendario.ts';
import { esc, fmt, diaDaSemana, lerData, mesmoDia, somaDias, somaMeses } from './datas.ts';

export type Forma = 'djen' | 'pje' | 'dom' | 'juntada' | 'ciencia';
export type Dobro = '' | 'faz' | 'mp' | 'dp' | 'lit';

export const FORMAS: Record<Forma, { lbl: string; hint: string }> = {
  djen:    { lbl: 'Data da disponibilização', hint: 'Publicação: 1º dia útil seguinte à disponibilização. O prazo começa no 1º dia útil seguinte à publicação (CPC, art. 224, §§ 2º e 3º).' },
  pje:     { lbl: 'Data do envio da intimação', hint: 'A ciência acontece na leitura ou, sem leitura, 10 dias corridos após o envio. O prazo começa no dia útil seguinte à ciência.' },
  dom:     { lbl: 'Data da confirmação do recebimento', hint: 'O prazo começa a correr do 5º dia útil seguinte à confirmação (CPC, art. 231, IX). A confirmação deve ocorrer em até 3 dias úteis do envio (art. 246, § 1º-A).' },
  juntada: { lbl: 'Data da juntada do AR ou do mandado', hint: 'O prazo começa no dia útil seguinte à juntada aos autos (CPC, art. 231, I e II).' },
  ciencia: { lbl: 'Data da ciência', hint: 'Intimação em audiência, por carga ou por comparecimento. O prazo começa no dia útil seguinte (CPC, arts. 224 e 1.003, § 1º).' }
};
export const DOBRO: Record<Exclude<Dobro, ''>, string> = {
  faz: 'Fazenda Pública (art. 183)', mp: 'Ministério Público (art. 180)', dp: 'Defensoria Pública (art. 186)', lit: 'litisconsortes com advogados diferentes (art. 229)'
};

// Número por extenso (para a certidão)
const UNI = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CEN = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
export function extenso(n: number): string {
  if (n < 20) return UNI[n];
  if (n < 100) return DEZ[Math.floor(n / 10)] + (n % 10 ? ' e ' + UNI[n % 10] : '');
  if (n === 100) return 'cem';
  return CEN[Math.floor(n / 100)] + (n % 100 ? ' e ' + extenso(n % 100) : '');
}
export function qtd(n: number, un: Unidade): string { return n + ' (' + extenso(n) + ') ' + UN_TXT[un][n === 1 ? 0 : 1]; }

export type Pedido = { ato?: Ato; n: number; un: Unidade; dir: 'apos' | 'antes'; forma: Forma; d1: string; d2: string; alvo: string; dobro: Dobro };
export type Passo = { d: Date; t: string; s: string; fim?: boolean };
export type Resultado = {
  ok: boolean; erro?: string; passos: Passo[]; avisos: string[]; contados: Date[];
  nFinal?: number; termo?: Date; inicio?: Date; venc?: Date; marco?: boolean; regressivo?: boolean;
};

export function calcular(p: Pedido, cal: Calendario): Resultado {
  const r: Resultado = { passos: [], avisos: [], contados: [], ok: false };
  let n = p.n;
  const ato = p.ato;
  if (!(n > 0)){ r.erro = 'Informe o prazo.'; return r; }

  if (p.dobro && ato && ato.marco) r.avisos.push('Prazo máximo de duração: não existe prazo em dobro.');
  else if (p.dobro && ato && ato.eca && (p.dobro === 'faz' || p.dobro === 'mp')) r.avisos.push('<b>Não dobra:</b> no ECA é proibido prazo em dobro para a Fazenda Pública e o Ministério Público (art. 152, § 2º).');
  else if (p.dobro){
    if (ato && ato.sd) r.avisos.push('<b>Não dobra:</b> este é um prazo próprio (' + esc(ato.art) + '). Mantido em ' + qtd(n, p.un) + '.');
    else if (p.un === 'u' || p.un === 'c'){
      n = n * 2;
      r.avisos.push('<b>Prazo em dobro</b> para ' + DOBRO[p.dobro] + ': ' + qtd(p.n, p.un) + ' passam a ' + qtd(n, p.un) + '.');
      if (p.dobro === 'dp' && ato && ato.eca) r.avisos.push('No ECA, a Defensoria mantém o prazo em dobro, mesmo em dias corridos (STJ, Informativo 870).');
      if (p.dobro === 'lit') r.avisos.push('<b>Atenção:</b> o prazo em dobro dos litisconsortes não vale para processo eletrônico (art. 229, § 2º).');
      if (p.dobro === 'faz' || p.dobro === 'mp' || p.dobro === 'dp') r.avisos.push('A contagem em dobro para ' + (p.dobro === 'faz' ? 'a Fazenda' : p.dobro === 'mp' ? 'o MP' : 'a Defensoria') + ' começa da intimação pessoal (carga, remessa ou meio eletrônico).');
    } else r.avisos.push('Prazo em meses ou anos: o dobro não foi aplicado.');
  }
  r.nFinal = n;

  // ---- prazo máximo do ECA: conta direto da data informada, sem prorrogar ----
  if (ato && ato.marco){
    const m0 = lerData(p.d1);
    if (!m0){ r.erro = 'Informe a ' + (ato.rot || '').toLowerCase() + '.'; return r; }
    const mv = p.un === 'm' ? somaMeses(m0, n) : p.un === 'a' ? somaMeses(m0, n * 12) : somaDias(m0, n);
    if (p.un === 'c') for (let z = 1; z <= n; z++) r.contados.push(somaDias(m0, z));
    r.passos.push({ d: m0, t: ato.rot || '', s: 'Não entra na contagem.' });
    r.passos.push({ d: mv, t: 'Data limite', s: qtd(n, p.un) + '. Prazo máximo: não passa para o dia útil seguinte.', fim: true });
    r.termo = m0; r.venc = mv; r.marco = true; r.ok = true;
    return r;
  }

  // ---- contagem regressiva (antes da audiência) ----
  if (p.dir === 'antes'){
    const alvo = lerData(p.alvo);
    if (!alvo){ r.erro = 'Informe a data da audiência.'; return r; }
    let lim: Date;
    if (p.un === 'u'){
      lim = alvo; for (let i = 0; i < n; i++){ lim = cal.antUtil(lim); r.contados.push(lim); }
    } else if (p.un === 'c'){
      lim = somaDias(alvo, -n); for (let j = 1; j <= n; j++) r.contados.push(somaDias(alvo, -j));
      if (!cal.util(lim)){ const orig = lim; lim = cal.antUtil(lim); r.avisos.push('O limite (' + fmt(orig) + ') caiu em dia sem expediente (' + cal.motivo(orig) + ') e foi antecipado para ' + fmt(lim) + '.'); }
    } else { r.erro = 'Contagem regressiva só em dias.'; return r; }
    r.passos.push({ d: alvo, t: 'Data da audiência', s: 'Não entra na contagem.' });
    r.passos.push({ d: lim, t: 'Último dia para cumprir', s: qtd(n, p.un) + ' antes da audiência.', fim: true });
    r.venc = lim; r.termo = alvo; r.regressivo = true; r.ok = true;
    return r;
  }

  // ---- a partir da intimação: acha o termo inicial (dia que não conta) ----
  const d1 = lerData(p.d1);
  let termo: Date;
  if (!d1){ r.erro = 'Informe a ' + FORMAS[p.forma].lbl.toLowerCase() + '.'; return r; }
  if (p.forma === 'djen'){
    const pub = cal.proxUtil(d1);
    r.passos.push({ d: d1, t: 'Disponibilização no DJEN', s: 'Data em que a intimação aparece no Diário.' });
    r.passos.push({ d: pub, t: 'Publicação', s: '1º dia útil seguinte à disponibilização (art. 224, § 2º).' });
    termo = pub;
  } else if (p.forma === 'pje'){
    const tacita = somaDias(d1, 10), lida = lerData(p.d2);
    let ciencia: Date;
    r.passos.push({ d: d1, t: 'Envio da intimação no sistema', s: '' });
    if (lida && lida >= d1 && lida <= tacita){ ciencia = lida; r.passos.push({ d: lida, t: 'Leitura da intimação', s: 'Ciência na data da consulta.' }); }
    else {
      ciencia = cal.utilOuProx(tacita);
      if (lida) r.avisos.push('A leitura informada é posterior aos 10 dias corridos. Vale a ciência automática.');
      r.passos.push({ d: ciencia, t: 'Ciência automática', s: '10 dias corridos após o envio' + (mesmoDia(ciencia, tacita) ? '.' : '; o 10º dia (' + fmt(tacita) + ') caiu em dia sem expediente e passou para o dia útil seguinte.') });
    }
    termo = ciencia;
  } else if (p.forma === 'dom'){
    termo = cal.somaUteis(d1, 5);
    r.passos.push({ d: d1, t: 'Confirmação do recebimento', s: 'Ciência da citação no Domicílio Judicial Eletrônico.' });
    r.passos.push({ d: termo, t: '5º dia útil após a confirmação', s: 'Marco inicial do prazo (art. 231, IX). Não entra na contagem.' });
  } else if (p.forma === 'juntada'){
    termo = d1; r.passos.push({ d: d1, t: 'Juntada aos autos', s: 'Do AR ou do mandado cumprido (art. 231, I e II).' });
  } else {
    termo = d1; r.passos.push(ato && ato.rotForma ? { d: d1, t: ato.rotForma, s: 'Marco inicial do prazo. Não entra na contagem.' } : { d: d1, t: 'Ciência', s: 'Intimação direta da parte ou do advogado.' });
  }

  let inicio: Date, venc: Date;
  if (p.un === 'u'){
    let x = termo;
    for (let k = 0; k < n; k++){ x = cal.proxUtil(x); r.contados.push(x); }
    inicio = r.contados[0]; venc = x;
  } else if (p.un === 'c'){
    inicio = cal.proxUtil(termo);
    if (ato && ato.eca && cal.cfg.recesso){
      let xe = inicio; r.contados.push(inicio);
      while (r.contados.length < n){ xe = somaDias(xe, 1); if (!cal.emRecesso(xe)) r.contados.push(xe); }
      venc = xe;
    } else {
      for (let q = 0; q < n; q++) r.contados.push(somaDias(inicio, q));
      venc = somaDias(inicio, n - 1);
    }
    if (!cal.util(venc)){ const v0 = venc; venc = cal.proxUtil(venc); r.avisos.push('O último dia (' + fmt(v0) + ') caiu em dia sem expediente (' + cal.motivo(v0) + '). Prorrogado para ' + fmt(venc) + ' (art. 224, § 1º).'); }
    if (ato && ato.eca) r.avisos.push('<b>ECA, dias corridos (art. 152, § 2º):</b> sábados, domingos e feriados contam. Só o início e o fim passam para o dia útil seguinte.' +
      (cal.cfg.recesso ? ' Os dias do recesso (20/12 a 20/01) não foram contados (CPC, art. 220). Confirmem se a vara adota esse entendimento.' : ''));
    else r.avisos.push('<b>Dias corridos:</b> fins de semana, feriados e recesso contam. Só o início e o fim passam para o dia útil seguinte.');
  } else {
    inicio = termo;
    venc = p.un === 'm' ? somaMeses(termo, n) : somaMeses(termo, n * 12);
    if (!cal.util(venc)){ const v1 = venc; venc = cal.proxUtil(venc); r.avisos.push('O último dia (' + fmt(v1) + ') caiu em dia sem expediente (' + cal.motivo(v1) + '). Prorrogado para ' + fmt(venc) + '.'); }
  }
  if (p.un === 'u' || p.un === 'c') r.passos.push({ d: inicio, t: 'Início da contagem (1º dia)', s: 'Primeiro dia útil depois do marco inicial (art. 224, § 3º).' });
  r.passos.push({ d: venc, t: 'Último dia do prazo', s: qtd(n, p.un) + (p.un === 'u' || p.un === 'c' ? '' : ' a partir de ' + fmt(termo) + ' (CC, art. 132, § 3º).'), fim: true });
  r.termo = termo; r.inicio = inicio; r.venc = venc; r.ok = true;
  return r;
}

// Situação do prazo em relação a hoje (a etiqueta colorida do resultado)
export function situacao(r: Resultado, h: Date, cal: Calendario): { cls: string; texto: string } {
  const pl = (n: number, s: string, p: string) => n + ' ' + (n === 1 ? s : p);
  const venc = r.venc!;
  if (r.marco){
    const fc = Math.round((venc.getTime() - h.getTime()) / 864e5);
    return fc < 0 ? { cls: 'danger', texto: 'Prazo máximo ultrapassado há ' + pl(-fc, 'dia', 'dias') } : fc === 0 ? { cls: 'warn', texto: 'Termina hoje' } : { cls: fc <= 15 ? 'warn' : 'ok', texto: 'Faltam ' + pl(fc, 'dia', 'dias') };
  }
  if (r.regressivo){
    const fu = cal.diasUteisEntre(h, venc);
    return venc < h ? { cls: 'danger', texto: 'Data limite já passou' } : mesmoDia(venc, h) ? { cls: 'warn', texto: 'Último dia é hoje' } : { cls: 'ok', texto: 'Faltam ' + fu + ' ' + (fu === 1 ? 'dia útil' : 'dias úteis') };
  }
  if (venc < h){ const ve = cal.diasUteisEntre(venc, h); return { cls: 'danger', texto: 'Prazo encerrado há ' + ve + ' ' + (ve === 1 ? 'dia útil' : 'dias úteis') }; }
  if (mesmoDia(venc, h)) return { cls: 'warn', texto: 'Vence hoje' };
  if (r.inicio && r.inicio > h) return { cls: '', texto: 'Ainda não começou · começa em ' + fmt(r.inicio) };
  const fl = cal.diasUteisEntre(h, venc);
  return { cls: 'ok', texto: 'Em curso · faltam ' + fl + ' ' + (fl === 1 ? 'dia útil' : 'dias úteis') + ' depois de hoje' };
}

export function certidao(p: Pedido, r: Resultado, o: { parte: string; proc: string; decurso: boolean; hoje: Date }): string {
  const parte = o.parte.trim() || 'a parte', proc = o.proc.trim();
  const ato = p.ato ? (p.ato.certNome || p.ato.ato.replace(/:? ?prazo máximo$/i, '')).toLowerCase() : 'manifestação';
  const venc = r.venc!, termo = r.termo!;
  const nos = proc ? ', nos autos ' + proc : '';
  if (r.marco) return 'Certifico que, considerando a ' + (p.ato!.rot || '').toLowerCase() + ' em ' + fmt(termo) + ', o prazo máximo de ' + qtd(r.nFinal!, p.un) + ' (' + p.ato!.art + ') para ' + ato + ' encerra-se em ' + fmt(venc) + ' (' + diaDaSemana(venc) + ')' + nos + '.';
  if (r.regressivo) return 'Certifico que, designada a audiência para ' + fmt(termo) + ', o prazo de ' + qtd(r.nFinal!, p.un) + ' de antecedência para ' + ato + ' encerra-se em ' + fmt(venc) + ' (' + diaDaSemana(venc) + ')' + nos + '.';
  const d1 = lerData(p.d1)!;
  const como: Record<Forma, string> = {
    djen: 'por publicação no Diário de Justiça Eletrônico Nacional disponibilizada em ' + fmt(d1) + ' e considerada publicada em ' + fmt(termo),
    pje: 'por intimação eletrônica expedida em ' + fmt(d1) + ', com ciência em ' + fmt(termo),
    dom: 'por citação no Domicílio Judicial Eletrônico, com confirmação de recebimento em ' + fmt(d1),
    juntada: 'conforme AR/mandado juntado aos autos em ' + fmt(termo),
    ciencia: 'com ciência em ' + fmt(termo)
  };
  const encerra = venc < o.hoje ? 'encerrou-se' : 'encerra-se';
  if (p.ato && p.ato.rotForma && p.forma === 'ciencia'){
    const tc = 'Certifico que, ' + p.ato.cert + ' ' + fmt(termo) + nos + ', o prazo de ' + qtd(r.nFinal!, p.un) + ' para ' + ato + ' teve início em ' + fmt(r.inicio!) + ' e ' + encerra + ' em ' + fmt(venc) + '.';
    return o.decurso ? tc + ' Certifico, ainda, que o prazo decorreu sem manifestação.' : tc;
  }
  let t = 'Certifico que ' + parte + ' foi intimada ' + como[p.forma] + nos + '. ';
  t += 'O prazo de ' + qtd(r.nFinal!, p.un) + ' para ' + ato + ' ' + (r.inicio && (p.un === 'u' || p.un === 'c') ? 'teve início em ' + fmt(r.inicio) + ' e ' : '');
  t += encerra + ' em ' + fmt(venc) + '.';
  if (o.decurso) t += ' Certifico, ainda, que o prazo decorreu sem manifestação.';
  return t;
}
