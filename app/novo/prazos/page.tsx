import { Moldura } from '@/componentes/Moldura';
import { Prazos } from '@/componentes/prazos/Prazos';

export default function PaginaPrazos(){
  return (
    <Moldura titulo="Prazos" secaoAtual="prazos" largura="medio">
      <Prazos />
    </Moldura>
  );
}
