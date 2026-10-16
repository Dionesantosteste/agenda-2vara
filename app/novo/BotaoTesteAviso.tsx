'use client';
import { useAviso } from '@/componentes/Avisos';

export function BotaoTesteAviso(){
  const avisar = useAviso();
  return <button type="button" className="btn" id="novoTesteAviso" onClick={() => avisar('Aviso de teste do sistema novo')}>Testar aviso</button>;
}
