'use client';
// Botão "Aparência" do rodapé do menu: tema e cor de fundo (as mesmas opções do sistema atual)
import { useEffect, useState, type CSSProperties } from 'react';
import { CORES, fundoGuardado, guardarFundo, guardarTema, temaGuardado, type Tema } from '@/lib/aparencia';
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
  useEffect(() => { if (aberto){ setTema(temaGuardado()); setFundo(fundoGuardado()); } }, [aberto]);

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
      </div>
    </>
  );
}
