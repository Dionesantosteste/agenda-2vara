// Número do processo no padrão CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO (igual ao sistema atual)

export function soDigitos(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '');
}

// Com 20 dígitos, devolve formatado; senão devolve o texto como veio (sem espaços nas pontas)
export function formatarProcesso(v: string | null | undefined): string {
  const d = soDigitos(v);
  if (d.length !== 20) return (v || '').trim();
  return d.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, '$1-$2.$3.$4.$5.$6');
}

// Máscara enquanto se digita: pontos e traço entram sozinhos (até 20 dígitos)
const SEPARADORES: Record<number, string> = { 7: '-', 9: '.', 13: '.', 14: '.', 16: '.' };
export function mascaraCNJ(v: string): string {
  const d = soDigitos(v).slice(0, 20);
  let out = '';
  for (let i = 0; i < d.length; i++){ if (SEPARADORES[i]) out += SEPARADORES[i]; out += d[i]; }
  return out;
}

// O que o campo do processo faz a cada tecla (o mesmo do sistema atual): devolve o novo texto e
// onde fica o cursor. Com letras, deixa como está; apagar só um ponto/traço apaga o número antes dele.
export function digitarCNJ(v: string, cursor: number, anterior: string, tipo: string): { valor: string; cursor: number } {
  if (/[^\d.\-\s\/]/.test(v)) return { valor: v, cursor };
  let digAntes = soDigitos(v.slice(0, cursor)).length;
  let dig = soDigitos(v);
  if (tipo === 'deleteContentBackward' && dig === soDigitos(anterior) && digAntes > 0){
    dig = dig.slice(0, digAntes - 1) + dig.slice(digAntes); digAntes--;
  }
  const novo = mascaraCNJ(dig);
  if (novo === v) return { valor: v, cursor };
  let p = 0, c = 0;
  while (p < novo.length && c < digAntes){ if (/\d/.test(novo[p])) c++; p++; }
  if (c === digAntes && SEPARADORES[c] && p < novo.length && tipo.startsWith('insert')) p++;
  return { valor: novo, cursor: p };
}
