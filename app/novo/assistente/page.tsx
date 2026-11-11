import { Moldura } from '@/componentes/Moldura';
import { Assistente } from '@/componentes/assistente/Assistente';

export default function PaginaAssistente(){
  return (
    <Moldura titulo="Assistente" secaoAtual="assistente">
      <Assistente />
    </Moldura>
  );
}
