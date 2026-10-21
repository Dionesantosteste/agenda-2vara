import { Moldura } from '@/componentes/Moldura';
import { Organizacao } from '@/componentes/organizacao/Organizacao';

export default function PaginaOrganizacao(){
  return (
    <Moldura titulo="Organização" secaoAtual="organizacao" largura="wide">
      <Organizacao />
    </Moldura>
  );
}
