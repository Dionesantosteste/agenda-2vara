// Foco no primeiro campo de uma janela que acabou de abrir, um instante depois (dá tempo de ela
// aparecer). Se nesse instante a pessoa já clicou em outro campo da mesma janela, deixa onde está:
// senão o que ela digita cai no campo errado (ex.: a observação ia para o processo).
export function focarDepois(alvo: () => HTMLElement | null | undefined, ms = 30){
  setTimeout(() => {
    const el = alvo();
    if (!el) return;
    const ativo = document.activeElement as HTMLElement | null;
    const janela = el.closest('dialog, form');
    if (ativo && ativo !== el && janela && janela.contains(ativo) && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName)) return;
    el.focus();
  }, ms);
}
