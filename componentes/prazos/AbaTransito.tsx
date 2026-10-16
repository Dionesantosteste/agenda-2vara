'use client';
// Aba "Trânsito em julgado": prazo de recurso de cada parte; vale o último; trânsito no dia seguinte.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Calendario } from '@/lib/prazos/calendario';
import { qtd } from '@/lib/prazos/calculo';
import { chave, diaDaSemana, fmt, hoje, lerData, mesmoDia, plural, somaMeses } from '@/lib/prazos/datas';
import { TJ_DATA_LBL, TJ_FORMAS, TJ_NOME, TJ_PARTES, TJ_TIPOS, transito, type FormaTj, type ParteTj, type TipoDecisao, type TipoParte } from '@/lib/prazos/transito';
import { useAviso } from '@/componentes/Avisos';
import { CalendarioMeses, Rico, copiar, mascaraProcesso } from './comum';

const Vazio = ({ texto }: { texto: string }) => <><h2>Resultado</h2><p className="muted" style={{ margin: 0 }}>{texto}</p></>;

export function AbaTransito({ cal }: { cal: Calendario }){
  const avisar = useAviso();
  const [tipo, setTipo] = useState<TipoDecisao>('comum');
  const [ed, setEd] = useState('nao');
  const [acordo, setAcordo] = useState(() => chave(hoje()));
  const [partes, setPartes] = useState<ParteTj[]>([{ tipo: 'autor', forma: 'djen', data: '' }, { tipo: 'reu', forma: 'djen', data: '' }]);
  const [proc, setProc] = useState('');
  const [focar, setFocar] = useState<number | null>(null);
  const certRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focar === null) return;
    document.getElementById('pzTjT' + focar)?.focus();
    setFocar(null);
  }, [focar]);

  const mudarParte = (i: number, campo: Partial<ParteTj>) => setPartes(ps => ps.map((p, j) => (j === i ? { ...p, ...campo } : p)));
  function acrescentar(){
    const ult = partes[partes.length - 1] || { forma: 'djen' as FormaTj, data: '' };
    const usados = partes.map(r => r.tipo);
    const livre = TJ_PARTES.find(x => !usados.includes(x[0]));
    setPartes([...partes, { tipo: livre ? livre[0] : 'terceiro', forma: ult.forma, data: ult.data }]);
    setFocar(partes.length);
  }

  const T = TJ_TIPOS[tipo], h = hoje(), pr = proc.trim();
  let corpo: ReactNode = null, cert = '', dataTransito: Date | null = null;

  if (tipo === 'acordo'){
    dataTransito = lerData(acordo);
    if (dataTransito){
      corpo = <>
        <div className="venc"><span className="lbl">Trânsito em julgado em</span><span className="data">{fmt(dataTransito)}</span><span className="dow">{diaDaSemana(dataTransito)}, a própria data da homologação</span></div>
        <div className="aviso">Confira se a renúncia ao prazo de recurso é de <b>todas</b> as partes. Se uma delas não renunciou, use &quot;Sentença&quot; e conte o prazo dela.</div>
      </>;
      cert = 'Certifico que, homologado o acordo em ' + fmt(dataTransito) + (pr ? ' nos autos ' + pr : '') + ', as partes renunciaram ao prazo recursal (CPC, art. 999), tendo a sentença transitado em julgado em ' + fmt(dataTransito) + '.';
    }
  } else {
    const t = transito(tipo, partes, cal);
    if (t){
      const { linhas, maior, faltam } = t, venc = maior.venc!;
      dataTransito = t.transito;
      const podeCertificar = h >= dataTransito;
      const ultimos = linhas.filter(r => mesmoDia(r.venc, venc));
      const av: string[] = [];
      if (podeCertificar) av.push('Antes de certificar, confira no processo se <b>nenhuma parte recorreu</b> nem pediu algo que suspenda o prazo.');
      if (ed === 'sim') av.push('Com embargos de declaração, a conta vale a partir da intimação da decisão que julgou os embargos (art. 1.026).');
      if (partes.some(r => r.tipo === 'faz')) av.push('<b>Fazenda Pública vencida:</b> a sentença só transita depois da remessa necessária ao Tribunal (art. 496), salvo nos valores do § 3º e nos casos do § 4º.');
      if (partes.some(r => r.forma === 'revel')) av.push('<b>Revel sem advogado:</b> o prazo corre da publicação da sentença no Diário, sem intimação pessoal (art. 346).');
      if (partes.some(r => r.forma === 'pje')) av.push('Intimação no PJe sem leitura: considerei a ciência automática 10 dias corridos após o envio. Se houve leitura antes, calcule essa parte na aba Calcular prazo.');
      const termo = maior.termo!;
      const nMeses = (venc.getFullYear() - termo.getFullYear()) * 12 + venc.getMonth() - termo.getMonth() + 1;
      const nomes = ultimos.map(r => TJ_NOME[r.parte.tipo]);
      corpo = <>
        <div className="venc"><span className="lbl">{podeCertificar ? 'Transitou em julgado em' : 'Transitará em julgado em'}</span><span className="data">{fmt(dataTransito)}</span><span className="dow">{diaDaSemana(dataTransito)}, se nenhuma parte recorrer</span></div>
        <div className="chips">{faltam ? <span className="chip danger">Falta a data de {plural(faltam, 'parte', 'partes')}</span>
          : podeCertificar ? <span className="chip ok">Prazos encerrados: já pode certificar</span>
          : <span className="chip warn">Ainda corre prazo até {fmt(venc)}: não certificar antes de {fmt(dataTransito)}</span>}</div>
        <p style={{ margin: 0, lineHeight: 1.55 }}>O último prazo termina em <b>{fmt(venc)}</b> ({diaDaSemana(venc)}), para {nomes.map((nome, i) => (
          <span key={i}>{i === 0 ? '' : i === nomes.length - 1 ? ' e ' : ', '}<b>{nome}</b></span>
        ))}. O trânsito é o dia seguinte.</p>
        <div className="tbl-wrap"><table className="tb" style={{ minWidth: 0 }}>
          <thead><tr><th>Parte</th><th>Intimação</th><th>Prazo</th><th>Último dia</th></tr></thead>
          <tbody>{linhas.map((r, i) => {
            const ult = mesmoDia(r.venc, venc);
            return (
              <tr key={i} className={ult ? 'longo' : undefined}>
                <td>{TJ_NOME[r.parte.tipo]}{ult && <> <span className="tag a">último prazo</span></>}</td>
                <td className="n">{fmt(r.termo!)}</td>
                <td>{qtd(r.nFinal!, r.un)}{r.nota && <> <span className="obs">{r.nota}</span></>}</td>
                <td className="n">{fmt(r.venc!)}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
        <p className="muted" style={{ margin: '-6px 0 0' }}>Na coluna Intimação: a data que marca o início (publicação, ciência ou juntada). O prazo começa no dia útil seguinte.</p>
        {av.length > 0 && <div className="avisos">{av.map((x, i) => <Rico key={i} como="div" className="aviso" html={x} />)}</div>}
        {nMeses <= 4 && <>
          <h3>Calendário do prazo mais longo ({TJ_NOME[maior.parte.tipo]})</h3>
          <CalendarioMeses a0={termo} a1={dataTransito} r={maior} hoje={h} cal={cal} />
          <div className="legenda"><span><i className="sw tm"></i>Intimação (não conta)</span><span><i className="sw ct"></i>Dia contado</span><span><i className="sw vc"></i>Último dia</span><span><i className="sw nu"></i>Sem expediente</span><span><i className="sw hj"></i>Hoje</span></div>
        </>}
      </>;
      cert = 'Certifico que ' + T.nome + (pr ? ' proferida nos autos ' + pr : '') + ' transitou em julgado em ' + fmt(dataTransito) + ', tendo decorrido sem interposição de recurso o prazo recursal das partes, cujo último dia foi ' + fmt(venc) + '.';
    }
  }

  let resultado: ReactNode;
  if (!dataTransito) resultado = <Vazio texto={tipo === 'acordo' ? 'Informe a data da homologação do acordo.' : 'Informe a data da intimação de pelo menos uma parte.'} />;
  else resultado = <>
    {corpo}
    <h3>Texto para certidão</h3>
    <div className="field">
      <label htmlFor="pzTjCert" className="flabel" style={{ position: 'absolute', left: -9999 }}>Texto da certidão</label>
      <textarea id="pzTjCert" className="cert" rows={4} ref={certRef} key={cert} defaultValue={cert} />
    </div>
    <div className="acts"><button type="button" className="btn primary sm" id="pzTjCopiar" onClick={() => copiar(certRef.current ? certRef.current.value : cert, certRef.current, avisar)}>Copiar texto</button></div>
    <h3>Depois do trânsito</h3>
    <ul className="depois">
      <li>Certifique o trânsito nos autos.</li>
      <li>O cumprimento de sentença depende de pedido do credor (art. 513, § 1º). Intimado o devedor, corre o prazo de 15 dias úteis para pagar (art. 523).</li>
      {tipo === 'jec' ? <li>No Juizado não cabe ação rescisória (Lei 9.099, art. 59).</li>
        : <li>Prazo para ação rescisória: até <b>{fmt(cal.utilOuProx(somaMeses(dataTransito, 24)))}</b> (2 anos do trânsito, art. 975).</li>}
    </ul>
  </>;

  return (
    <>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2>Como funciona</h2>
        <ul className="tj-intro">
          <li><b>Cada parte tem o seu prazo</b>O prazo para recorrer começa quando cada parte é intimada. Se as intimações foram em dias diferentes, os prazos terminam em dias diferentes.</li>
          <li><b>Vale o prazo que termina por último</b>Enquanto alguma parte ainda pode recorrer, a sentença não transitou. Por isso cadastre todas as partes.</li>
          <li><b>Trânsito: dia seguinte</b>Sem recurso, a sentença transita em julgado no dia seguinte ao último dia do prazo mais longo.</li>
        </ul>
      </div>
      <div className="grid2">
        <form className="panel" id="fTj" autoComplete="off" onSubmit={e => e.preventDefault()}>
          <h2>1. O que foi decidido</h2>
          <div className="field">
            <label htmlFor="pzTjTipo">Tipo de decisão</label>
            <select id="pzTjTipo" value={tipo} onChange={e => setTipo(e.target.value as TipoDecisao)}>
              <option value="comum">Sentença (procedimento comum, família, execução)</option>
              <option value="eca">Sentença no ECA (infância e juventude)</option>
              <option value="jec">Sentença do Juizado Especial Cível</option>
              <option value="acordo">Acordo homologado com renúncia ao prazo de recurso</option>
            </select>
          </div>
          <Rico como="div" className="ato-info" id="pzTjTipoInfo" html={T.info} />
          <div className="field" id="pzTjEdBox" hidden={tipo === 'acordo'}>
            <label htmlFor="pzTjEd">Houve embargos de declaração?</label>
            <select id="pzTjEd" value={ed} onChange={e => setEd(e.target.value)}>
              <option value="nao">Não</option>
              <option value="sim">Sim, e já foram julgados</option>
            </select>
            <span className="field-hint" id="pzTjEdHint" hidden={ed !== 'sim'}>Os embargos interrompem o prazo (art. 1.026). Nas datas abaixo, informe a intimação da decisão que julgou os embargos, não a da sentença.</span>
          </div>

          <div id="pzTjAcordoBox" hidden={tipo !== 'acordo'}>
            <div className="field"><label htmlFor="pzTjAcordoData">Data da homologação do acordo</label><input id="pzTjAcordoData" type="date" value={acordo} onChange={e => setAcordo(e.target.value)} />
              <span className="field-hint">Use só se a renúncia ao prazo de recurso de todas as partes consta do termo de audiência ou de petição.</span></div>
          </div>

          <div id="pzTjPartesBox" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} hidden={tipo === 'acordo'}>
            <h2>2. Intimação de cada parte</h2>
            <span className="field-hint" style={{ marginTop: -6 }}>Uma linha por parte. Quando o advogado das duas partes foi intimado na mesma publicação, a data é a mesma.</span>
            <div className="tj-partes" id="pzTjPartes">
              {partes.map((pt, i) => (
                <div className="tj-parte" data-i={i} key={i}>
                  <div className="field tj-tipo"><label htmlFor={'pzTjT' + i}>Parte</label>
                    <select id={'pzTjT' + i} data-k="tipo" value={pt.tipo} onChange={e => mudarParte(i, { tipo: e.target.value as TipoParte })}>
                      {TJ_PARTES.map(x => <option key={x[0]} value={x[0]}>{x[1]}</option>)}
                    </select></div>
                  {partes.length > 1 && <button type="button" className="x" data-rm={i} aria-label="Remover parte" onClick={() => setPartes(partes.filter((_, j) => j !== i))}>×</button>}
                  <div className="field tj-forma"><label htmlFor={'pzTjF' + i}>Como foi intimada</label>
                    <select id={'pzTjF' + i} data-k="forma" value={pt.forma} onChange={e => mudarParte(i, { forma: e.target.value as FormaTj })}>
                      {TJ_FORMAS.map(x => <option key={x[0]} value={x[0]}>{x[1]}</option>)}
                    </select></div>
                  <div className="field tj-data"><label htmlFor={'pzTjD' + i} id={'pzTjDL' + i}>{TJ_DATA_LBL[pt.forma]}</label>
                    <input id={'pzTjD' + i} type="date" data-k="data" value={pt.data} onChange={e => mudarParte(i, { data: e.target.value })} /></div>
                </div>
              ))}
            </div>
            <div className="acts"><button type="button" className="btn sm" id="pzTjAdd" onClick={acrescentar}>+ Acrescentar parte</button></div>
          </div>

          <h2>3. Para a certidão</h2>
          <div className="field"><label htmlFor="pzTjProc">Processo (opcional)</label><input id="pzTjProc" placeholder="0000000-00.0000.8.11.0000" maxLength={25} style={{ fontFamily: 'var(--font-data)', fontSize: 14 }} value={proc} onChange={e => setProc(mascaraProcesso(e.target.value))} /></div>
        </form>
        <div className="panel" id="pzTjRes" aria-live="polite">{resultado}</div>
      </div>
    </>
  );
}
