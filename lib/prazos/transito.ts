// Trânsito em julgado: cada parte tem o seu prazo; vale o que termina por último; trânsito no dia seguinte.
import { ATO_POR_ID } from './atos.ts';
import type { Calendario } from './calendario.ts';
import { calcular, type Dobro, type Forma, type Resultado } from './calculo.ts';
import { lerData, somaDias } from './datas.ts';

export type TipoDecisao = 'comum' | 'eca' | 'jec' | 'acordo';
export type TipoParte = 'autor' | 'reu' | 'mp' | 'dp' | 'faz' | 'terceiro';
export type FormaTj = Forma | 'revel';
export type ParteTj = { tipo: TipoParte; forma: FormaTj; data: string };

export const TJ_TIPOS: Record<TipoDecisao, { ato?: string; nome: string; info: string }> = {
  comum: { ato: 'apelacao', nome: 'a sentença', info: '<b>Apelação: 15 dias úteis</b> para cada parte (art. 1.003, § 5º), contados da intimação de cada uma. Fazenda Pública, MP e Defensoria têm prazo em dobro.' },
  eca:   { ato: 'eca_apel', nome: 'a sentença', info: '<b>Apelação no ECA: 10 dias corridos</b> (art. 198, II). Fazenda Pública e MP não têm prazo em dobro (art. 152, § 2º); a Defensoria tem.' },
  jec:   { ato: 'jec_ri', nome: 'a sentença', info: '<b>Recurso inominado: 10 dias úteis</b> (Lei 9.099, art. 42), contados da ciência da sentença.' },
  acordo:{ nome: 'a sentença homologatória', info: 'Quando todas as partes renunciam ao prazo de recurso na homologação do acordo, a sentença <b>transita em julgado na mesma data</b> (art. 999).' }
};
export const TJ_PARTES: [TipoParte, string][] = [['autor', 'Autor'], ['reu', 'Réu'], ['mp', 'Ministério Público'], ['dp', 'Defensoria Pública ou curador especial'], ['faz', 'Fazenda Pública'], ['terceiro', 'Terceiro interessado']];
export const TJ_NOME = Object.fromEntries(TJ_PARTES) as Record<TipoParte, string>;
export const TJ_FORMAS: [FormaTj, string][] = [['djen', 'Publicação no DJEN / Diário'], ['pje', 'Intimação eletrônica no sistema (PJe)'], ['dom', 'Domicílio Judicial Eletrônico'], ['juntada', 'Correios (AR) ou mandado'], ['ciencia', 'Sentença lida em audiência'], ['revel', 'Revel sem advogado (publicação)']];
export const TJ_DATA_LBL: Record<FormaTj, string> = { djen: 'Data da disponibilização', pje: 'Data do envio da intimação', dom: 'Data da confirmação do recebimento', juntada: 'Data da juntada do AR ou do mandado', ciencia: 'Data da audiência', revel: 'Data da disponibilização da sentença' };

export type LinhaTj = Resultado & { parte: ParteTj; un: 'u' | 'c'; nota: string };

export function prazoDaParte(tipo: TipoDecisao, parte: ParteTj, cal: Calendario): LinhaTj {
  const ato = ATO_POR_ID[TJ_TIPOS[tipo].ato!];
  const dobro: Dobro = parte.tipo === 'mp' || parte.tipo === 'dp' || parte.tipo === 'faz' ? parte.tipo : '';
  const res = calcular({ ato, n: ato.n, un: ato.un, dir: 'apos', forma: parte.forma === 'revel' ? 'djen' : parte.forma, d1: parte.data, d2: '', alvo: '', dobro }, cal);
  return Object.assign(res, { parte, un: ato.un as 'u' | 'c', nota: dobro ? (res.nFinal! > ato.n ? 'em dobro' : 'não dobra') : '' });
}

// Prazos das partes que já têm data; o último define o trânsito (dia seguinte)
export function transito(tipo: TipoDecisao, partes: ParteTj[], cal: Calendario){
  const linhas = partes.filter(r => r.data).map(r => prazoDaParte(tipo, r, cal)).filter(r => r.ok);
  if (!linhas.length) return null;
  const maior = linhas.reduce((a, b) => (b.venc! > a.venc! ? b : a));
  return { linhas, maior, transito: somaDias(maior.venc!, 1), faltam: partes.filter(r => !r.data).length };
}

export function dataDoAcordo(s: string){ return lerData(s); }
