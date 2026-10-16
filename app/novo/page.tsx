import { Moldura } from '@/componentes/Moldura';
import { SECOES, enderecoDaSecao } from '@/lib/secoes';
import { BotaoTesteAviso } from './BotaoTesteAviso';

// Página de entrada do sistema novo enquanto a migração acontece
export default function Novo(){
  return (
    <Moldura titulo="Sistema novo">
      <header>
        <div>
          <h1>Sistema novo</h1>
          <div className="tagline">Em construção: as seções passam para cá uma de cada vez</div>
        </div>
      </header>
      <section className="panel novo-status" aria-labelledby="novoSecoesTit">
        <div className="panel-head"><h2 id="novoSecoesTit">Seções</h2><span>onde cada uma funciona hoje</span></div>
        <ul className="novo-lista">
          {SECOES.map(s => (
            <li key={s.id}>
              <a href={enderecoDaSecao(s)}>{s.nome}</a>
              <span className={'tag ' + (s.novo ? 'novo-pronta' : 'novo-atual')}>{s.novo ? 'No sistema novo' : 'No sistema atual'}</span>
            </li>
          ))}
        </ul>
        <BotaoTesteAviso />
      </section>
    </Moldura>
  );
}
