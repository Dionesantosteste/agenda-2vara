'use client';
// Peças comuns das abas de Prazos: calendário do período, etiquetas do ato e texto com <b>.
import type { Ato } from '@/lib/prazos/atos';
import type { Calendario } from '@/lib/prazos/calendario';
import type { Resultado } from '@/lib/prazos/calculo';
import { D, MESES, chave, mesmoDia } from '@/lib/prazos/datas';

// Texto com marcação simples (<b>) que vem das regras; o que é variável já vem escapado
export function Rico({ html, como = 'span', className, id }: { html: string; como?: 'span' | 'div' | 'li'; className?: string; id?: string }){
  const Tag = como;
  return <Tag id={id} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function TagsDoAto({ a }: { a: Ato }){
  return (
    <>
      {a.eca && <> <span className="tag e">ECA</span></>}
      {a.marco && <> <span className="tag e">prazo máximo</span></>}
      {a.un === 'c' && <> <span className="tag c">corridos</span></>}
      {a.sd && <> <span className="tag a">sem dobro</span></>}
      {a.eca && !a.marco && <> <span className="tag a">sem dobro p/ Fazenda e MP</span></>}
    </>
  );
}

// Meses do período, com os dias contados numerados
export function CalendarioMeses({ a0, a1, r, hoje, cal }: { a0: Date; a1: Date; r: Resultado; hoje: Date; cal: Calendario }){
  const cont: Record<string, number> = {};
  r.contados.forEach((d, i) => { cont[chave(d)] = r.regressivo ? r.contados.length - i : i + 1; });
  const meses: { y: number; m: number }[] = [];
  for (let y = a0.getFullYear(), m = a0.getMonth(); y < a1.getFullYear() || (y === a1.getFullYear() && m <= a1.getMonth()); ){
    meses.push({ y, m });
    m++; if (m > 11){ m = 0; y++; }
  }
  return (
    <div className="cals">
      {meses.map(({ y, m }) => {
        const first = D(y, m, 1), dim = new Date(y, m + 1, 0).getDate();
        const semanas: (Date | null)[][] = [[]];
        for (let b = 0; b < first.getDay(); b++) semanas[0].push(null);
        for (let dia = 1; dia <= dim; dia++){
          const d = D(y, m, dia);
          semanas[semanas.length - 1].push(d);
          if (d.getDay() === 6 && dia < dim) semanas.push([]);
        }
        return (
          <div className="cal" key={y + '-' + m}>
            <h4>{MESES[m].charAt(0).toUpperCase() + MESES[m].slice(1)} de {y}</h4>
            <table>
              <thead><tr><th>D</th><th>S</th><th>T</th><th>Q</th><th>Q</th><th>S</th><th>S</th></tr></thead>
              <tbody>
                {semanas.map((sem, i) => (
                  <tr key={i}>
                    {sem.map((d, j) => {
                      if (!d) return <td key={j}></td>;
                      const k = chave(d), mo = cal.motivo(d), cls: string[] = [];
                      let tit = mo || '';
                      if (mo) cls.push('nu');
                      if (cont[k]) cls.push('ct');
                      if (mesmoDia(d, r.termo)){ cls.push('tm'); tit = (r.regressivo ? 'Audiência' : 'Marco inicial') + (mo ? ' · ' + mo : ''); }
                      if (mesmoDia(d, r.venc)) cls.push('vc');
                      if (mesmoDia(d, hoje)) cls.push('hj');
                      return <td key={j} className={cls.join(' ')} title={tit || undefined}>{d.getDate()}{cont[k] ? <i>{cont[k]}</i> : null}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// Número do processo formatado enquanto se digita (NNNNNNN-DD.AAAA.J.TR.OOOO)
export function mascaraProcesso(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 20), cortes = [7, 9, 13, 14, 16], seps = ['-', '.', '.', '.', '.'];
  let o = '';
  for (let i = 0; i < d.length; i++){ const c = cortes.indexOf(i); if (c >= 0) o += seps[c]; o += d[i]; }
  return o;
}

export function copiar(texto: string, el: HTMLTextAreaElement | null, avisar: (m: string) => void){
  const seleciona = () => { el?.select(); avisar('Texto selecionado: use Ctrl+C'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(() => avisar('Texto copiado'), seleciona);
  else seleciona();
}
