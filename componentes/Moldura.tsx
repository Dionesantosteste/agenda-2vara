'use client';
// Moldura do portal: menu lateral, barra de cima no celular e área principal (igual ao sistema atual)
import { useEffect, useState, type ReactNode } from 'react';
import { SECOES, enderecoDaSecao } from '@/lib/secoes';
import { dataPorExtenso } from '@/lib/datas';
import { Aparencia } from './Aparencia';
import { IconeMenu, IconeSecao } from './Icones';

export function Moldura({ titulo, secaoAtual, children }: { titulo: string; secaoAtual?: string; children: ReactNode }){
  const [menuAberto, setMenuAberto] = useState(false);
  const [hoje, setHoje] = useState('');
  useEffect(() => {
    const atualiza = () => setHoje(dataPorExtenso());
    atualiza();
    const t = setInterval(atualiza, 60000);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuAberto(false); };
    document.addEventListener('keydown', esc);
    return () => { clearInterval(t); document.removeEventListener('keydown', esc); };
  }, []);

  return (
    <div className={'shell' + (menuAberto ? ' nav-open' : '')} id="shell">
      <aside className="sidebar" id="sidebar" aria-label="Menu do portal">
        <div className="brand">
          <span className="brand-logo"><img src="/brasao/menu.svg" alt="Brasão da 2ª Vara" className="brasao" /></span>
          <span className="brand-txt">
            <span className="brand-name">2ª Vara</span>
            <span className="brand-sub">Portal da secretaria</span>
          </span>
        </div>
        <nav className="nav" aria-label="Seções">
          <div className="nav-label">Seções</div>
          {SECOES.map(s => (
            <a key={s.id} className="nav-item" href={enderecoDaSecao(s)} data-route={s.id} aria-current={secaoAtual === s.id ? 'page' : undefined}>
              <IconeSecao id={s.id} />
              <span>{s.nome}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <strong id="todayLong">{hoje}</strong>
          <Aparencia />
        </div>
      </aside>
      <button type="button" className="scrim" id="scrim" aria-label="Fechar menu" tabIndex={-1} onClick={() => setMenuAberto(false)} />

      <div className="main-col">
        <div className="topbar">
          <button type="button" className="icon-btn" id="navToggle" aria-label="Abrir menu" aria-controls="sidebar" aria-expanded={menuAberto} onClick={() => setMenuAberto(!menuAberto)}>
            <IconeMenu />
          </button>
          <img src="/brasao/topo.svg" alt="" aria-hidden="true" className="topbar-logo" />
          <span className="topbar-title" id="topbarTitle">{titulo}</span>
        </div>
        <main className="main">
          <div className="wrap">{children}</div>
        </main>
      </div>
    </div>
  );
}
