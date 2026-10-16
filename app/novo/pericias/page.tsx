import { Moldura } from '@/componentes/Moldura';
import { Pericias } from '@/componentes/pericias/Pericias';

export default function PaginaPericias(){
  return (
    <Moldura titulo="Perícias" secaoAtual="pericias">
      <Pericias />
    </Moldura>
  );
}
