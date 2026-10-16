'use client';
// Calendário de dias úteis da vara (feriados, suspensões e recesso), o da seção Prazos.
// Fica no Supabase (tabela prazos_config), uma linha por item ("recesso", "opc.<id>", "extra.<id>"),
// e vale para toda a equipe. Sem a tabela, as mudanças ficam só neste navegador.
// Também é o calendário do prazo do laudo em Perícias.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendario, configDasLinhas, configPadrao, type ConfigCalendario } from '@/lib/prazos/calendario';
import { supabase } from '@/lib/supabase';
import { useAviso } from '@/componentes/Avisos';

export type ErroCalendario = { message?: string; code?: string } | null;

function lerLocal(): ConfigCalendario {
  const cfg = configPadrao();
  try {
    const salvo = JSON.parse(localStorage.getItem('prazosCfg') || 'null');
    if (salvo) Object.assign(cfg, salvo);
  } catch { /* sem armazenamento local */ }
  return cfg;
}
function gravarLocal(cfg: ConfigCalendario){
  try { localStorage.setItem('prazosCfg', JSON.stringify(cfg)); } catch { /* sem armazenamento local */ }
}

// Só use em componentes que aparecem depois de carregar no navegador (lê o armazenamento local)
export function useCalendario(){
  const avisar = useAviso();
  const [cfg, setCfg] = useState<ConfigCalendario>(lerLocal);
  const [erro, setErro] = useState<ErroCalendario>(null);
  const cal = useMemo(() => new Calendario(cfg), [cfg]);

  const carregar = useCallback(async () => {
    const res = await supabase().from('prazos_config').select('chave, valor');
    setErro(res.error || null);
    if (!res.error) setCfg(configDasLinhas(res.data || []));
  }, []);
  useEffect(() => {
    carregar();
    const canal = supabase().channel('prazos-config')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prazos_config' }, () => { carregar(); })
      .subscribe();
    return () => { supabase().removeChannel(canal); };
  }, [carregar]);

  // Grava um item do calendário; sem valor, apaga o item
  async function mudar(novo: ConfigCalendario, chave: string, valor?: unknown){
    setCfg(novo);
    let falha = erro;
    if (!falha){
      const res = valor === undefined
        ? await supabase().from('prazos_config').delete().eq('chave', chave)
        : await supabase().from('prazos_config').upsert({ chave, valor, updated_at: new Date().toISOString() });
      if (res.error){ falha = res.error; setErro(res.error); avisar('Não foi possível salvar o calendário: ' + res.error.message); }
    }
    if (falha) gravarLocal(novo);
  }

  return { cfg, cal, erro, mudar };
}
