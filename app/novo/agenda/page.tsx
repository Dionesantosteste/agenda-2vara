import { Moldura } from '@/componentes/Moldura';
import { Agenda } from '@/componentes/agenda/Agenda';

export default function PaginaAgenda(){
  return (
    <Moldura titulo="Agenda" secaoAtual="agenda">
      <Agenda />
    </Moldura>
  );
}
