'use client';
// Card "Próximos 7 dias" na barra lateral: audiências e perícias marcadas, por dia. Cada dia leva à seção já filtrada.
import { useCallback, useEffect, useState } from 'react';
import { chaveDoDia } from '@/lib/datas';
import { DIAS_AVISO, diasMarcados, hashDoPeriodo, rotuloDoDia, type DiaMarcado } from '@/lib/proximos';
import { supabase } from '@/lib/supabase';

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dois = (n: number) => (n < 10 ? '0' : '') + n;
const diaMes = (d: Date) => dois(d.getDate()) + '/' + dois(d.getMonth() + 1);
const plural = (n: number, um: string, varios: string) => n + ' ' + (n === 1 ? um : varios);

type Bloco = { tipo: 'aud' | 'per'; titulo: string; rota: string; um: string; varios: string; dias: DiaMarcado[] };

export function ProximosDias(){
  const [dados, setDados] = useState<{ aud: DiaMarcado[]; per: DiaMarcado[] } | null>(null);

  const carregar = useCallback(async () => {
    const agora = new Date();
    const [a, p] = await Promise.all([
      supabase().from('audiencias').select('status,data_hora'),
      supabase().from('pericias').select('status,data_pericia')
    ]);
    if (a.error && p.error) return;
    const marcadas = ['agendada', 'intimacoes_feitas', 'pronta'];
    const aud = (a.data || []).filter(r => r.status !== 'Cancelada').map(r => (r.data_hora ? new Date(r.data_hora as string) : null));
    const per = (p.data || []).filter(r => marcadas.includes(r.status as string)).map(r => (r.data_pericia ? new Date(r.data_pericia as string) : null));
    setDados({ aud: diasMarcados(aud, agora), per: diasMarcados(per, agora) });
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 600000);
    const foco = () => { if (!document.hidden) carregar(); };
    document.addEventListener('visibilitychange', foco);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', foco); };
  }, [carregar]);

  if (!dados) return null;
  const hoje = new Date(), fim = new Date(); fim.setDate(fim.getDate() + DIAS_AVISO);
  const total = (d: DiaMarcado[]) => d.reduce((s, x) => s + x.qtd, 0);
  const nA = total(dados.aud), nP = total(dados.per);
  const blocos = ([
    { tipo: 'aud', titulo: 'Audiências', rota: '/novo/audiencias', um: 'audiência', varios: 'audiências', dias: dados.aud },
    { tipo: 'per', titulo: 'Perícias', rota: '/novo/pericias', um: 'perícia', varios: 'perícias', dias: dados.per }
  ] as Bloco[]).filter(b => b.dias.length);
  const periodo = hashDoPeriodo(chaveDoDia(hoje), chaveDoDia(fim));

  return (
    <section className="prox7" aria-labelledby="prox7T">
      <div className="px-head">
        <h2 id="prox7T">Próximos 7 dias</h2>
        {blocos.length > 0 && <span>{plural(nA, 'audiência', 'audiências')} · {plural(nP, 'perícia', 'perícias')}</span>}
      </div>
      {!blocos.length && <div className="px-vazio">Nenhuma audiência nem perícia marcada até {diaMes(fim)}.</div>}
      {blocos.map(b => (
        <div key={b.tipo} className={'px-bloco ' + b.tipo}>
          <h3><a href={b.rota + '#' + periodo} title={'Ver tudo em ' + b.titulo + ' (próximos 7 dias)'}><span>{b.titulo} →</span><span>{total(b.dias)}</span></a></h3>
          <ul>
            {b.dias.map(g => (
              <li key={g.chave}>
                <a className="px-item" href={b.rota + '#' + g.chave} data-u={g.urgencia} title={'Abrir ' + b.titulo + ' de ' + diaMes(g.data)}>
                  <span className="px-chip">{rotuloDoDia(g.n)}</span>
                  <span className="px-dia">{diaMes(g.data)} <span>{SEMANA[g.data.getDay()]}</span></span>
                  <span className="px-qtd" title={plural(g.qtd, b.um, b.varios)}>{g.qtd}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="px-legenda"><span><i style={{ background: 'var(--st-red)' }} />hoje e amanhã</span><span><i style={{ background: 'var(--st-orange)' }} />2 a 3 dias</span><span><i style={{ background: 'var(--st-yellow-line)' }} />4 a 7 dias</span></div>
    </section>
  );
}
