'use client';
// Botão "Aparência" do rodapé do menu: tema e cor de fundo (as mesmas opções do sistema atual)
import { useEffect, useState, type CSSProperties } from 'react';
import { CORES, epocaDeNatal, fundoGuardado, guardarFundo, guardarNatal, guardarNeve, guardarTema, natalGuardado, neveGuardada, temaGuardado, type Tema } from '@/lib/aparencia';
import { IconeAparencia } from './Icones';

const TEMAS: { id: Tema; nome: string; dica?: string }[] = [
  { id: 'auto', nome: 'Automático', dica: 'Segue o aparelho: claro de dia, noturno quando o sistema está escuro' },
  { id: 'light', nome: 'Claro' },
  { id: 'contraste', nome: 'Alto contraste' },
  { id: 'dark', nome: 'Noturno' }
];

export function Aparencia(){
  const [aberto, setAberto] = useState(false);
  const [tema, setTema] = useState<Tema>('auto');
  const [fundo, setFundo] = useState('');
  const [natal, setNatal] = useState(true);
  const [neve, setNeve] = useState(true);
  const [epoca, setEpoca] = useState(false);
  useEffect(() => {
    if (aberto){ setTema(temaGuardado()); setFundo(fundoGuardado()); setNatal(natalGuardado()); setNeve(neveGuardada()); setEpoca(epocaDeNatal()); }
  }, [aberto]);

  return (
    <>
      <button type="button" className="apar-btn" id="aparBtn" aria-expanded={aberto} aria-controls="aparPainel" onClick={() => setAberto(!aberto)}>
        <IconeAparencia /> Aparência
      </button>
      <div className="apar-painel" id="aparPainel" hidden={!aberto}>
        <span className="apar-lbl" id="aparTemaLbl">Tema</span>
        <div className="apar-seg" id="aparTema" role="group" aria-labelledby="aparTemaLbl">
          {TEMAS.map(t => (
            <button key={t.id} type="button" data-tema={t.id} aria-pressed={tema === t.id} title={t.dica}
              onClick={() => { guardarTema(t.id); setTema(t.id); }}>{t.nome}</button>
          ))}
        </div>
        <span className="apar-lbl" id="aparFundoLbl">Fundo da página</span>
        <div className="cor-sws" id="aparFundo" role="group" aria-labelledby="aparFundoLbl">
          <button type="button" className="cor-sw padrao" data-cor-id="" aria-pressed={!fundo} title="Padrão do tema" aria-label="Padrão do tema"
            onClick={() => { guardarFundo(''); setFundo(''); }} />
          {CORES.map(c => (
            <button key={c.id} type="button" className="cor-sw" data-cor="" data-cor-id={c.id} aria-pressed={fundo === c.id} title={c.nome} aria-label={c.nome}
              style={{ '--cor-c': c.fundo[0], '--cor-e': c.fundo[1], '--cor-v': c.fundo[2] } as CSSProperties}
              onClick={() => { guardarFundo(c.id); setFundo(c.id); }} />
          ))}
        </div>
        {/* a escolha do Natal só aparece na época (15/11 a 06/01) */}
        <div className="apar-natal" id="aparNatalBox" hidden={!epoca}>
          <span className="apar-lbl" id="aparNatalLbl">Natal</span>
          <div className="apar-seg" id="aparNatal" role="group" aria-labelledby="aparNatalLbl">
            <button type="button" data-natal="sim" aria-pressed={natal} title="Gorro nos bichinhos e árvore de Natal no quadro, até 6 de janeiro"
              onClick={() => { guardarNatal(true); setNatal(true); }}>Enfeites</button>
            <button type="button" data-natal="nao" aria-pressed={!natal} onClick={() => { guardarNatal(false); setNatal(false); }}>Sem enfeites</button>
          </div>
          <span className="apar-lbl" id="aparNeveLbl">Neve no topo</span>
          <div className="apar-seg" id="aparNeve" role="group" aria-labelledby="aparNeveLbl">
            <button type="button" data-neve="sim" aria-pressed={neve} disabled={!natal} onClick={() => { guardarNeve(true); setNeve(true); }}>Ligada</button>
            <button type="button" data-neve="nao" aria-pressed={!neve} disabled={!natal} onClick={() => { guardarNeve(false); setNeve(false); }}>Desligada</button>
          </div>
        </div>
      </div>
    </>
  );
}
