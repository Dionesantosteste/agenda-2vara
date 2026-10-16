'use client';
// Seção Prazos do sistema novo: as cinco abas e o calendário de dias úteis da vara (useCalendario).
import { useEffect, useState } from 'react';
import { useCalendario } from '@/componentes/useCalendario';
import { AbaCalcular, type EscolhaDeAto } from './AbaCalcular';
import { AbaTransito } from './AbaTransito';
import { AbaIdade } from './AbaIdade';
import { AbaTabela } from './AbaTabela';
import { AbaFeriados } from './AbaFeriados';

const ABAS = [
  ['prazo', 'Calcular prazo'], ['transito', 'Trânsito em julgado'], ['idade', 'Idade'], ['tabela', 'Tabela de prazos'], ['feriados', 'Feriados e suspensões']
] as const;
type Aba = (typeof ABAS)[number][0];

export function Prazos(){
  // A tela depende de hoje e do navegador: só aparece depois de carregar no navegador
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return (
    <section id="view-prazos" aria-labelledby="pzTitle">
      <header>
        <div>
          <h1 id="pzTitle">Prazos</h1>
          <div className="tagline">Contagem em dias úteis (CPC, art. 219), sem fins de semana, feriados e recesso de 20/12 a 20/01</div>
        </div>
      </header>
      {pronto && <Corpo />}
      <p className="fontes">Base: CPC, arts. 180, 183, 186, 219 a 231 e 1.003; Lei 11.419/2006, art. 5º; Resolução CNJ 455/2022 (DJEN e Domicílio Judicial Eletrônico, com a redação da Res. 569/2024);
        Código Civil, arts. 3º, 4º e 132; ECA, arts. 2º, 19, 46, 47, 121, 152, 158, 163, 166 e 198; Estatuto da Pessoa Idosa, art. 71.
        Material de apoio: <a href="https://www.tjmg.jus.br/data/files/D4/44/4E/4A/FB82B91042A101B99128CCA8/Protocolo%20DJEN%20e%20Domicilio%20Judicial%20Eletronico%20_externos_%20-%20Ago%2025.pdf" target="_blank" rel="noopener">TJMG, protocolo DJEN e Domicílio</a>,
        {' '}<a href="https://portal.trt12.jus.br/domiciliojudicialeletronico" target="_blank" rel="noopener">TRT-12, Domicílio Judicial Eletrônico</a>,
        {' '}<a href="https://juris.damasio.com.br/jurisprudencia/julgado/870/aplicacao-do-prazo-em-dobro-da-defensoria-publica-nos-procedimentos-do-eca" target="_blank" rel="noopener">STJ, Informativo 870 (Defensoria no ECA)</a>.
        O cálculo é uma ajuda: a certidão continua sendo responsabilidade de quem confere.</p>
    </section>
  );
}

function Corpo(){
  const [aba, setAba] = useState<Aba>(() => {
    try { const a = localStorage.getItem('prazosAba'); if (ABAS.some(x => x[0] === a)) return a as Aba; } catch { /* sem armazenamento local */ }
    return 'prazo';
  });
  const { cfg, cal, erro, mudar } = useCalendario();
  const [escolha, setEscolha] = useState<EscolhaDeAto>(null);

  function irAba(a: Aba){
    setAba(a);
    try { localStorage.setItem('prazosAba', a); } catch { /* sem armazenamento local */ }
    window.scrollTo(0, 0);
  }

  return (
    <>
      <div className="abas" role="tablist" aria-label="Ferramentas de prazo">
        {ABAS.map(([id, nome]) => (
          <button key={id} type="button" className="aba" role="tab" id={'pztab-' + id} data-aba={id} aria-selected={aba === id} onClick={() => irAba(id)}>{nome}</button>
        ))}
      </div>
      <section id="pzv-prazo" role="tabpanel" aria-labelledby="pztab-prazo" hidden={aba !== 'prazo'}>
        <AbaCalcular cal={cal} escolha={escolha} />
      </section>
      <section id="pzv-transito" role="tabpanel" aria-labelledby="pztab-transito" hidden={aba !== 'transito'}>
        <AbaTransito cal={cal} />
      </section>
      <section id="pzv-idade" role="tabpanel" aria-labelledby="pztab-idade" hidden={aba !== 'idade'}>
        <AbaIdade />
      </section>
      <section id="pzv-tabela" role="tabpanel" aria-labelledby="pztab-tabela" hidden={aba !== 'tabela'}>
        <AbaTabela calcular={id => { setEscolha(e => ({ id, vez: (e ? e.vez : 0) + 1 })); irAba('prazo'); }} />
      </section>
      <section id="pzv-feriados" role="tabpanel" aria-labelledby="pztab-feriados" hidden={aba !== 'feriados'}>
        <AbaFeriados cfg={cfg} cal={cal} erro={erro} mudar={mudar} />
      </section>
    </>
  );
}
