// Idade da parte e o que ela muda no processo (o mesmo do sistema atual)
import { D, somaMeses } from './datas.ts';

export type Idade = { a: number; m: number; d: number };

export function idade(nasc: Date, ref: Date): Idade {
  let y = ref.getFullYear() - nasc.getFullYear(), m = ref.getMonth() - nasc.getMonth(), d = ref.getDate() - nasc.getDate();
  if (d < 0){ m--; d += new Date(ref.getFullYear(), ref.getMonth(), 0).getDate(); }
  if (m < 0){ y--; m += 12; }
  return { a: y, m, d };
}
// 29/02 vira 01/03 em ano não bissexto
export function aniversario(nasc: Date, anos: number): Date { return somaMeses(nasc, anos * 12); }

export function faixa(a: number): { t: string; c: string } {
  if (a < 12) return { t: 'Criança · absolutamente incapaz', c: 'danger' };
  if (a < 16) return { t: 'Adolescente · absolutamente incapaz', c: 'danger' };
  if (a < 18) return { t: 'Adolescente · relativamente incapaz', c: 'warn' };
  if (a < 60) return { t: 'Maior e capaz', c: 'ok' };
  if (a < 80) return { t: 'Pessoa idosa · prioridade', c: '' };
  return { t: 'Pessoa idosa · prioridade especial (80+)', c: '' };
}

// Efeitos no processo (com marcação simples <b>)
export function efeitos(a: number): string[] {
  const e: string[] = [];
  if (a < 16){
    e.push('Age no processo <b>representada</b> pelos pais, tutor ou curador (CC, art. 3º; CPC, art. 71).');
    e.push('A prescrição <b>não corre</b> contra ela (CC, art. 198, I).');
  } else if (a < 18){
    e.push('Age no processo <b>assistida</b> pelos pais, tutor ou curador (CC, art. 4º, I; CPC, art. 71).');
    e.push('A prescrição já corre (só não corre contra absolutamente incapaz).');
  }
  if (a < 18){
    e.push('<b>Intimar o Ministério Público</b> para intervir como fiscal da ordem jurídica (CPC, art. 178, II).');
    e.push('Processos de guarda, tutela, adoção ou medida de proteção seguem os prazos do ECA, em dias corridos (art. 152, § 2º).');
    e.push('Se houver emancipação (CC, art. 5º), a incapacidade cessa: confira a certidão de nascimento.');
  }
  if (a >= 60) e.push('Tem <b>prioridade de tramitação</b> (CPC, art. 1.048, I; Estatuto da Pessoa Idosa, art. 71). Anote na capa e no sistema.');
  if (a >= 80) e.push('Tem <b>prioridade especial</b> sobre os demais idosos (Estatuto da Pessoa Idosa, art. 71, § 5º).');
  if (a >= 18 && a < 60) e.push('Plenamente capaz para os atos da vida civil. Sem prioridade por idade.');
  return e;
}

export const MARCOS: [number, string][] = [[12, 'Adolescente'], [16, 'Relativamente capaz'], [18, 'Maioridade'], [21, 'Fim de medida do ECA'], [60, 'Pessoa idosa'], [80, 'Prioridade especial']];

export type LinhaLote =
  | { tipo: 'sem-data'; nome: string }
  | { tipo: 'futuro'; nome: string; nasc: Date }
  | { tipo: 'ok'; nome: string; nasc: Date; idade: Idade; faixa: { t: string; c: string }; maior: Date };

// "Maria Souza; 12/05/2011" ou "João Lima 03/09/2008", uma pessoa por linha
export function lerLote(texto: string, ref: Date): LinhaLote[] {
  return texto.split(/\n/).map(s => s.trim()).filter(Boolean).map(l => {
    const m = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(l);
    const nome = l.replace(m ? m[0] : '', '').replace(/[;,\t\-–]+\s*$/, '').replace(/^\s*[;,\t]+/, '').trim() || '(sem nome)';
    if (!m) return { tipo: 'sem-data', nome };
    let ano = +m[3]; if (ano < 100) ano += ano > (ref.getFullYear() % 100) ? 1900 : 2000;
    const n = D(ano, +m[2] - 1, +m[1]);
    if (n > ref) return { tipo: 'futuro', nome, nasc: n };
    const i = idade(n, ref);
    return { tipo: 'ok', nome, nasc: n, idade: i, faixa: faixa(i.a), maior: aniversario(n, 18) };
  });
}
