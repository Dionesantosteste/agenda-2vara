import { Moldura } from '@/componentes/Moldura';
import { Audiencias } from '@/componentes/audiencias/Audiencias';

export default function PaginaAudiencias(){
  return (
    <Moldura titulo="Audiências" secaoAtual="audiencias">
      <Audiencias />
    </Moldura>
  );
}
