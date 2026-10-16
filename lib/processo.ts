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
