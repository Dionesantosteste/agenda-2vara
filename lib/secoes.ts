// As seções do portal. "novo" diz se a seção já foi migrada para o sistema novo;
// enquanto não foi, o menu leva para ela no sistema atual (/#secao).
export type Secao = { id: string; nome: string; novo: boolean };

export const SECOES: Secao[] = [
  { id: 'agenda', nome: 'Agenda', novo: true },
  { id: 'audiencias', nome: 'Audiências', novo: true },
  { id: 'pericias', nome: 'Perícias', novo: true },
  { id: 'prazos', nome: 'Prazos', novo: true },
  { id: 'organizacao', nome: 'Organização', novo: false }
];

export function enderecoDaSecao(s: Secao): string {
  return s.novo ? '/novo/' + s.id : '/#' + s.id;
}
