// O Assistente sozinho, sem o menu do portal: é o que abre no painel do botão flutuante da
// Organização (tela do gestor), dentro de um quadro (iframe). Usa a mesma senha da aba.
import { Assistente } from '@/componentes/assistente/Assistente';

export default function PainelAssistente(){
  return (
    <main className="ast-painel">
      <Assistente embutido />
    </main>
  );
}
