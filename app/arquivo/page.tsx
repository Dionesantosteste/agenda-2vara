import type { Metadata } from 'next';
import { Arquivo } from '@/componentes/arquivo/Arquivo';
import { BotaoAssistente } from '@/componentes/assistente/BotaoAssistente';
import './arquivo.css';

export const metadata: Metadata = { title: 'Arquivo · Portal da 2ª Vara' };

// Página própria do Arquivo (processos físicos): fica fora da moldura do portal, com a lateral
// do arquivo e o botão "Voltar ao portal". Só abre para quem entrou (o Porteiro cuida disso).
export default function PaginaArquivo(){
  return (
    <>
      <Arquivo />
      <BotaoAssistente />
    </>
  );
}
