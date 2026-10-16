// Aparência escolhida por cada pessoa (tema e cor de fundo), guardada no navegador.
// As chaves no navegador são as mesmas do sistema atual, então a escolha vale nos dois.

export type Tema = 'auto' | 'light' | 'dark' | 'contraste';
export type CorAparencia = { id: string; nome: string; fundo: [string, string, string]; col: [string, string, string] };

// Cada cor: [clara, escura (Noturno), viva (Alto contraste)] para o fundo e para as colunas
export const CORES: CorAparencia[] = [
  { id: 'areia',   nome: 'Areia',   fundo: ['#EFE9DC', '#211A10', '#FFB766'], col: ['#F6ECD6', '#2A2417', '#FF9F2E'] },
  { id: 'salvia',  nome: 'Sálvia',  fundo: ['#E2ECE4', '#0F1F15', '#5FD08F'], col: ['#DCEFE2', '#18301F', '#2FBF6E'] },
  { id: 'ceu',     nome: 'Céu',     fundo: ['#E0EBF6', '#0C1A2B', '#6CB8F2'], col: ['#DCEBFA', '#172A40', '#3FA0EB'] },
  { id: 'lavanda', nome: 'Lavanda', fundo: ['#E9E5F3', '#1A1529', '#B39CFF'], col: ['#E7E2F7', '#241F38', '#9775FA'] },
  { id: 'rosa',    nome: 'Rosa',    fundo: ['#F3E4E8', '#25131A', '#FF8FB5'], col: ['#F9E0E6', '#34202A', '#FF6B9D'] },
  { id: 'amarelo', nome: 'Amarelo', fundo: ['#F3EED8', '#211D0B', '#FFD84D'], col: ['#FBF1C7', '#2E2A14', '#FFC800'] },
  { id: 'grafite', nome: 'Grafite', fundo: ['#D9DCE1', '#060708', '#9AA3AE'], col: ['#E6E8EC', '#1D2026', '#7D8794'] }
];

export const CHAVE_TEMA = 'aparTema';
export const CHAVE_FUNDO = 'aparFundo';

export function corPorId(id: string | null | undefined): CorAparencia | null {
  return CORES.find(c => c.id === id) || null;
}

function ler(chave: string): string | null {
  try { return localStorage.getItem(chave); } catch { return null; }
}
function gravar(chave: string, v: string | null){
  try { if (v == null) localStorage.removeItem(chave); else localStorage.setItem(chave, v); } catch { /* navegador sem armazenamento */ }
}

export function temaGuardado(): Tema {
  const t = ler(CHAVE_TEMA);
  return t === 'light' || t === 'dark' || t === 'contraste' ? t : 'auto';
}
export function fundoGuardado(): string {
  return corPorId(ler(CHAVE_FUNDO))?.id || '';
}
export function guardarTema(t: Tema){ gravar(CHAVE_TEMA, t === 'auto' ? null : t); aplicarAparencia(); }
export function guardarFundo(id: string){ gravar(CHAVE_FUNDO, id || null); aplicarAparencia(); }

// Aplica no <html> o tema e o fundo guardados (a mesma regra do script do <head>)
export function aplicarAparencia(){
  const raiz = document.documentElement;
  const tema = temaGuardado(), fundo = corPorId(ler(CHAVE_FUNDO));
  if (tema !== 'auto') raiz.setAttribute('data-theme', tema); else raiz.removeAttribute('data-theme');
  if (fundo){
    raiz.style.setProperty('--fundo-c', fundo.fundo[0]); raiz.style.setProperty('--fundo-e', fundo.fundo[1]); raiz.style.setProperty('--fundo-v', fundo.fundo[2]);
    raiz.setAttribute('data-fundo', fundo.id);
  } else raiz.removeAttribute('data-fundo');
}

// Roda no <head> antes de a página aparecer, para não piscar no tema errado
export const SCRIPT_APARENCIA = `(function(){try{
var C=${JSON.stringify(CORES.map(c => [c.id, c.fundo]))};
var r=document.documentElement,t=localStorage.getItem('${CHAVE_TEMA}'),f=localStorage.getItem('${CHAVE_FUNDO}');
if(t==='light'||t==='dark'||t==='contraste')r.setAttribute('data-theme',t);
for(var i=0;i<C.length;i++)if(C[i][0]===f){r.style.setProperty('--fundo-c',C[i][1][0]);r.style.setProperty('--fundo-e',C[i][1][1]);r.style.setProperty('--fundo-v',C[i][1][2]);r.setAttribute('data-fundo',f);}
}catch(e){}})();`;
