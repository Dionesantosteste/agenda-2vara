'use client';
// Aba "Calcular prazo": dados do prazo à esquerda, resultado, calendário e certidão à direita.
import { useEffect, useRef, useState } from 'react';
import { ATOS, ATO_POR_ID, UN_TXT, type Unidade } from '@/lib/prazos/atos';
import type { Calendario } from '@/lib/prazos/calendario';
import { FORMAS, calcular, certidao, qtd, situacao, type Dobro, type Forma, type Pedido } from '@/lib/prazos/calculo';
import { chave, diaDaSemana, fmt, hoje, somaDias } from '@/lib/prazos/datas';
import { useAviso } from '@/componentes/Avisos';
import { CalendarioMeses, Rico, TagsDoAto, copiar, mascaraProcesso } from './comum';

// Opções do select de atos, agrupadas como na tabela
const GRUPOS: { g: string; atos: typeof ATOS }[] = [];
for (const a of ATOS){
  if (!GRUPOS.length || GRUPOS[GRUPOS.length - 1].g !== a.g) GRUPOS.push({ g: a.g, atos: [] });
  GRUPOS[GRUPOS.length - 1].atos.push(a);
}
const rotuloDoAto = (a: (typeof ATOS)[number]) => a.ato + ' · ' + a.n + ' ' + (a.un === 'u' ? 'úteis' : a.un === 'c' ? 'corridos' : UN_TXT[a.un][a.n === 1 ? 0 : 1]);

export type EscolhaDeAto = { id: string; vez: number } | null;

export function AbaCalcular({ cal, escolha }: { cal: Calendario; escolha: EscolhaDeAto }){
  const avisar = useAviso();
  const inicial = ATO_POR_ID.apelacao;
  const [atoId, setAtoId] = useState('apelacao');
  const [n, setN] = useState(String(inicial.n));
  const [un, setUn] = useState<Unidade>(inicial.un);
  const [dir, setDir] = useState<'apos' | 'antes'>(inicial.dir || 'apos');
  const [forma, setForma] = useState<Forma>(inicial.forma || 'djen');
  const formaFixa = useRef(!!inicial.forma);
  const [d1, setD1] = useState(() => chave(hoje()));
  const [d2, setD2] = useState('');
  const [alvo, setAlvo] = useState('');
  const [dobro, setDobro] = useState<Dobro>('');
  const [parte, setParte] = useState('');
  const [proc, setProc] = useState('');
  const [decurso, setDecurso] = useState(false);
  // Depois de editado à mão, o texto não é refeito sozinho; avisa se os dados mudaram
  const [cert, setCert] = useState<{ base: string; texto: string } | null>(null);
  const certRef = useRef<HTMLTextAreaElement>(null);

  function aplicarAto(id: string){
    const a = ATO_POR_ID[id];
    setAtoId(id);
    if (!a) return;
    setN(String(a.n)); setUn(a.un); setDir(a.dir || 'apos');
    if (a.forma){ setForma(a.forma); formaFixa.current = true; }
    else if (formaFixa.current){ setForma('djen'); formaFixa.current = false; }
  }
  // "Calcular" na tabela de prazos
  useEffect(() => { if (escolha) aplicarAto(escolha.id); }, [escolha]); // eslint-disable-line react-hooks/exhaustive-deps

  const a = ATO_POR_ID[atoId], marco = !!(a && a.marco);
  const rotuloData = marco ? a.rot : a && a.rotForma && forma === a.forma ? a.rotForma : FORMAS[forma].lbl;
  const p: Pedido = { ato: a, n: parseInt(n, 10), un, dir, forma, d1, d2, alvo, dobro };
  const r = calcular(p, cal);
  const h = hoje();

  let resultado;
  if (!r.ok) resultado = <><h2>Resultado</h2><p className="muted" style={{ margin: 0 }}>{r.erro || 'Preencha os dados.'}</p></>;
  else {
    const venc = r.venc!, st = situacao(r, h, cal);
    const a0 = r.regressivo ? venc : r.termo!, a1 = r.regressivo ? r.termo! : venc;
    const nMeses = (a1.getFullYear() - a0.getFullYear()) * 12 + a1.getMonth() - a0.getMonth() + 1;
    const pulados: string[] = [];
    if (nMeses <= 6) for (let d = somaDias(a0, 1); d < a1; d = somaDias(d, 1)){ const mo = cal.motivo(d); if (mo && mo !== 'Sábado' && mo !== 'Domingo') pulados.push(fmt(d).slice(0, 5) + ' ' + mo); }
    const gerado = certidao(p, r, { parte, proc, decurso, hoje: h });
    resultado = (
      <>
        <div className="venc"><span className="lbl">{r.marco ? 'Data limite' : r.regressivo ? 'Cumprir até' : 'Vence em'}</span><span className="data">{fmt(venc)}</span><span className="dow">{diaDaSemana(venc)}</span></div>
        <div className="chips"><span className={st.cls ? 'chip ' + st.cls : 'chip'}>{st.texto}</span><span className="chip">{qtd(r.nFinal!, un)}</span></div>
        <ol className="steps">
          {r.passos.map((s, i) => (
            <li key={i} className={s.fim ? 'fim' : undefined}>
              <span className="d">{fmt(s.d)}<small>{diaDaSemana(s.d)}</small></span>
              <span className="t"><b>{s.t}</b>{s.s ? <span>{s.s}</span> : null}</span>
            </li>
          ))}
        </ol>
        {r.avisos.length > 0 && <div className="avisos">{r.avisos.map((t, i) => <Rico key={i} como="div" className="aviso" html={t} />)}</div>}
        {nMeses <= 6 && <>
          <h3>Calendário da contagem</h3>
          <CalendarioMeses a0={a0} a1={a1} r={r} hoje={h} cal={cal} />
          <div className="legenda">
            <span><i className="sw tm"></i>{r.regressivo ? 'Audiência' : r.marco ? 'Data de início (não conta)' : 'Marco inicial (não conta)'}</span>
            <span><i className="sw ct"></i>Dia contado</span>
            <span><i className="sw vc"></i>{r.regressivo ? 'Data limite' : 'Vencimento'}</span>
            <span><i className="sw nu"></i>Sem expediente</span>
            <span><i className="sw hj"></i>Hoje</span>
          </div>
          {pulados.length > 0 && <div className="pulados"><b>Feriados e suspensões no período:</b> {pulados.join(' · ')}</div>}
        </>}
        <h3>Texto para certidão</h3>
        <div className="field">
          <label htmlFor="pzPCert" className="flabel" style={{ position: 'absolute', left: -9999 }}>Texto da certidão</label>
          <textarea id="pzPCert" className="cert" rows={5} ref={certRef} value={cert ? cert.texto : gerado}
            onChange={e => setCert({ base: cert ? cert.base : gerado, texto: e.target.value })} />
        </div>
        <div className="aviso" id="pzPCertAviso" hidden={!cert}>
          <span id="pzPCertMsg">{cert && cert.base !== gerado
            ? <><b>Os dados do prazo mudaram depois que você editou o texto.</b> Confira as datas ou refaça o texto.</>
            : 'Texto editado à mão: ele não muda sozinho quando os dados mudam.'}</span>
          {' '}<button type="button" className="btn sm" id="pzPRefazer" onClick={() => setCert(null)}>Refazer o texto</button>
        </div>
        <div className="acts">
          <button type="button" className="btn primary sm" id="pzPCopiar" onClick={() => copiar(cert ? cert.texto : gerado, certRef.current, avisar)}>Copiar texto</button>
          {!r.regressivo && !r.marco && <label className="ck" style={{ fontSize: 13 }}><input type="checkbox" id="pzPDecurso" checked={decurso} onChange={e => setDecurso(e.target.checked)} /> Prazo decorrido sem manifestação</label>}
        </div>
      </>
    );
  }

  return (
    <div className="grid2">
      <form className="panel" id="pzFPrazo" autoComplete="off" onSubmit={e => e.preventDefault()}>
        <h2>Dados do prazo</h2>
        <div className="field">
          <label htmlFor="pzPAto">Ato</label>
          <select id="pzPAto" value={atoId} onChange={e => aplicarAto(e.target.value)}>
            {GRUPOS.map(g => (
              <optgroup key={g.g} label={g.g}>
                {g.atos.map(x => <option key={x.id} value={x.id}>{rotuloDoAto(x)}</option>)}
              </optgroup>
            ))}
            <optgroup label="Outro"><option value="">Outro prazo (digitar)</option></optgroup>
          </select>
        </div>
        <div className="ato-info" id="pzPAtoInfo" hidden={!a}>{a && <><b>{a.art}.</b> {a.ini}<TagsDoAto a={a} /></>}</div>
        <div className="row r3">
          <div className="field"><label htmlFor="pzPN">Prazo</label><input id="pzPN" type="number" min={1} max={999} value={n} inputMode="numeric" onChange={e => setN(e.target.value)} /></div>
          <div className="field"><label htmlFor="pzPUn">Contagem</label>
            <select id="pzPUn" value={un} onChange={e => setUn(e.target.value as Unidade)}>
              <option value="u">dias úteis</option>
              <option value="c">dias corridos</option>
              <option value="m">meses</option>
              <option value="a">anos</option>
            </select>
          </div>
        </div>
        <div className="field">
          <span className="flabel" id="pzPDirLbl">Contar</span>
          <div className="seg" role="group" aria-labelledby="pzPDirLbl">
            <button type="button" id="pzPDirApos" data-dir="apos" aria-pressed={dir === 'apos'} onClick={() => setDir('apos')}>A partir da intimação</button>
            <button type="button" id="pzPDirAntes" data-dir="antes" aria-pressed={dir === 'antes'} onClick={() => setDir('antes')}>Antes de uma data</button>
          </div>
        </div>

        <div id="pzBoxApos" className="panel" style={{ padding: 0, border: 0, boxShadow: 'none', gap: 12 }} hidden={dir !== 'apos'}>
          <div className="field" id="pzBoxForma" hidden={marco}>
            <label htmlFor="pzPForma">Como a parte tomou ciência</label>
            <select id="pzPForma" value={forma} onChange={e => setForma(e.target.value as Forma)}>
              <option value="djen">Publicação no DJEN / Diário</option>
              <option value="pje">Intimação eletrônica no sistema (PJe)</option>
              <option value="dom">Citação pelo Domicílio Judicial Eletrônico</option>
              <option value="juntada">Correios (AR) ou mandado: juntada aos autos</option>
              <option value="ciencia">Ciência direta (audiência, carga, comparecimento)</option>
            </select>
          </div>
          <div className="field"><label htmlFor="pzPData1" id="pzPData1Lbl">{rotuloData}</label><input id="pzPData1" type="date" value={d1} onChange={e => setD1(e.target.value)} /></div>
          <div className="field" id="pzBoxLeitura" hidden={marco || forma !== 'pje'}><label htmlFor="pzPData2">Data da leitura (se houve)</label><input id="pzPData2" type="date" value={d2} onChange={e => setD2(e.target.value)} />
            <span className="field-hint">Sem leitura, a ciência é automática 10 dias corridos após o envio (Lei 11.419/2006, art. 5º, § 3º).</span></div>
          <span className="field-hint" id="pzPFormaHint">{marco ? 'Prazo máximo em dias corridos, contado da data informada.' : FORMAS[forma].hint}</span>
        </div>
        <div id="pzBoxAntes" hidden={dir !== 'antes'}>
          <div className="field"><label htmlFor="pzPAlvo">Data da audiência (ou do ato)</label><input id="pzPAlvo" type="date" value={alvo} onChange={e => setAlvo(e.target.value)} />
            <span className="field-hint">Contagem regressiva: o dia da audiência não conta. O resultado é o último dia para cumprir.</span></div>
        </div>

        <div className="field">
          <label htmlFor="pzPDobro">Prazo em dobro</label>
          <select id="pzPDobro" value={dobro} onChange={e => setDobro(e.target.value as Dobro)}>
            <option value="">Não</option>
            <option value="faz">Fazenda Pública (art. 183)</option>
            <option value="mp">Ministério Público (art. 180)</option>
            <option value="dp">Defensoria Pública ou núcleo de prática jurídica (art. 186)</option>
            <option value="lit">Litisconsortes com advogados de escritórios diferentes (art. 229)</option>
          </select>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="pzPParte">Parte (para a certidão)</label><input id="pzPParte" placeholder="Ex.: parte ré" maxLength={120} value={parte} onChange={e => setParte(e.target.value)} /></div>
          <div className="field"><label htmlFor="pzPProc">Processo</label><input id="pzPProc" placeholder="0000000-00.0000.8.11.0000" maxLength={25} style={{ fontFamily: 'var(--font-data)', fontSize: 14 }} value={proc} onChange={e => setProc(mascaraProcesso(e.target.value))} /></div>
        </div>
      </form>

      <div className="panel" id="pzPRes" aria-live="polite">{resultado}</div>
    </div>
  );
}
