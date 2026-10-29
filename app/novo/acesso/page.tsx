import { Moldura } from '@/componentes/Moldura';
import { Acessos } from '@/componentes/acesso/Acessos';

export default function PaginaAcesso(){
  return (
    <Moldura titulo="Acessos" secaoAtual="acesso">
      <Acessos />
    </Moldura>
  );
}
