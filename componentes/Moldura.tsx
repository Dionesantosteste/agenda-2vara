'use client';
// Moldura do portal: menu lateral, barra de cima no celular e área principal (igual ao sistema atual)
import { useEffect, useState, type ReactNode } from 'react';
import { SECOES, enderecoDaSecao } from '@/lib/secoes';
import { dataPorExtenso } from '@/lib/datas';
import { Aparencia } from './Aparencia';
import { Neve } from './Neve';
import { useSessao } from './Porteiro';
import { ProximosDias } from './ProximosDias';
import { IconeMenu, IconeSecao } from './Icones';
import { BotaoAssistente } from './assistente/BotaoAssistente';

// largura: "medio" (Prazos) ou "wide" (Organização), como no sistema atual
export function Moldura({ titulo, secaoAtual, largura, children }: { titulo: string; secaoAtual?: string; largura?: 'medio' | 'wide'; children: ReactNode }){
  const [menuAberto, setMenuAberto] = useState(false);
  const [hoje, setHoje] = useState('');
  const { email, admin, sair } = useSessao();
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
          {/* Arquivo de processos físicos: página própria, com o botão "Voltar ao portal" */}
          <a className="nav-item" href="/arquivo" id="navArquivo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4" /><path d="M12 11v10" /></svg>
            <span>Arquivo</span>
          </a>
        </nav>
        <ProximosDias />
        <div className="sidebar-foot">
          <strong id="todayLong">{hoje}</strong>
          <Aparencia />
          {admin && <a className="apar-btn" id="acessosLink" href="/novo/acesso" aria-current={secaoAtual === 'acesso' ? 'page' : undefined}>Acessos</a>}
          <button type="button" className="apar-btn" id="sairBtn" title={email ? 'Conta: ' + email : undefined} onClick={sair}>Sair</button>
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
          <Neve />
          <div className={largura ? 'wrap ' + largura : 'wrap'}>{children}</div>
        </main>
        {/* Assistente (IA) do gestor: acompanha em todas as telas */}
        <BotaoAssistente />
      </div>
    </div>
  );
}
