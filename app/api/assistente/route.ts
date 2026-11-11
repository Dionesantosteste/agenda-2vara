// Assistente do gestor: conversa com a IA (Claude, da Anthropic) sobre a rotina da secretaria.
// - Só o gestor: precisa do login do site E da senha de 6 dígitos da Organização (conferida no banco).
// - A IA consulta as rotinas de secretaria e os modelos de texto pelas ferramentas abaixo.
// - Para salvar, a IA só PROPÕE (rotina ou modelo de texto); quem salva é o gestor, pelo botão na tela.
// A chave ANTHROPIC_API_KEY fica só no servidor (variáveis de ambiente da Vercel; veja o LEIA-ME).
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase';
import { mensagemDoStatus } from '@/lib/organizacao';
import { diaDaVara } from '@/lib/datas';
import {
  buscarModelos, buscarRotinas, lerPropostaModelo, lerPropostaRotina, rotinaEmTexto,
  type ModeloTexto, type Proposta, type Rotina
} from '@/lib/assistente';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Modelo padrão: Claude Sonnet 5.5 (bom em redação jurídica, custo moderado).
// Para gastar menos, defina ASSISTENTE_MODELO=claude-haiku-5-5 na Vercel.
const MODELO = process.env.ASSISTENTE_MODELO || 'claude-sonnet-5-5';
// Modelos que aceitam o "plano B" do servidor quando recusam um pedido por engano
const COM_RESERVA = /^claude-(sonnet-5-5|opus-5|opus-5-5|fable-5)/;
const MAX_VOLTAS = 8;              // idas e vindas com ferramentas por pergunta
const MAX_HISTORICO = 600_000;     // tamanho máximo da conversa guardada (caracteres)

// Fica sempre igual (sem data nem dados que mudam), para o cache da Anthropic funcionar
const SISTEMA = `Você é o Assistente da secretaria da 2ª Vara, usado pelo gestor (chefe de secretaria).
Responda sempre em português do Brasil, de forma direta e prática.

O que você faz:
1. Pesquisar a rotina da secretaria: o que fazer em cada fase do processo (ex.: "processo de INSS após a decisão").
   Antes de responder sobre rotina, use a ferramenta buscar_rotinas. Se houver rotina cadastrada, siga-a e diga que veio do cadastro da vara.
   Se não houver, responda com base no CPC e na prática forense, deixe claro que é uma sugestão geral (não é a rotina cadastrada) e ofereça salvá-la.
2. Explicar movimentação processual (atos ordinatórios, intimações, prazos, conclusão, arquivamento etc.), citando o dispositivo legal quando souber.
   Para contagem exata de prazo, lembre que o portal tem a seção Prazos, que considera os feriados da vara.
3. Redigir certidões, atos ordinatórios, despachos-padrão, ofícios e outros textos de secretaria.
   Antes de redigir, use buscar_modelos_texto para ver se a vara já tem um modelo parecido e siga o estilo dele.
   Escreva em linguagem formal de secretaria judicial, sem inventar fatos: o que você não souber (nº do processo, nomes, datas, ID de documentos), deixe como campo entre chaves duplas, por exemplo {{processo}}, {{autor}}, {{reu}}, {{data}}, {{id_documento}}.
   Use a cidade e a data informadas na mensagem do gestor quando o texto pedir local e data.
4. Salvar, quando o gestor pedir (ou aceitar a sua oferta):
   - uma rotina de secretaria: chame propor_rotina com título, assunto, quando se aplica e os passos em ordem;
   - um modelo de texto: chame propor_modelo_texto com nome, categoria e o texto (com os campos {{...}}).
   Essas ferramentas só mostram a proposta na tela; quem confirma é o gestor, no botão Salvar. Depois de chamar, diga em uma linha que a proposta está na tela para conferir e salvar.

Cuidados:
- Nunca invente número de processo, nome de parte, data, valor, artigo de lei ou jurisprudência. Se não tiver certeza de um dispositivo legal, diga que é preciso conferir.
- Evite repetir CPF, endereço ou dados de saúde que não sejam necessários ao texto pedido.
- Textos para o processo saem prontos para copiar, sem comentários no meio; observações vão depois do texto, separadas.
- Seja breve nas explicações; use listas numeradas para passo a passo.`;

const FERRAMENTAS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'buscar_rotinas',
    description: 'Busca nas rotinas de secretaria cadastradas pela vara (passo a passo por assunto e fase do processo). Use palavras-chave, ex.: "INSS decisão implantação". Termo vazio lista as primeiras rotinas.',
    strict: true,
    input_schema: { type: 'object', properties: { termo: { type: 'string', description: 'Palavras-chave da busca' } }, required: ['termo'], additionalProperties: false }
  },
  {
    name: 'buscar_modelos_texto',
    description: 'Busca na biblioteca de modelos de texto da vara (certidões, atos ordinatórios, ofícios...). Devolve id, nome, categoria e o começo do texto.',
    strict: true,
    input_schema: { type: 'object', properties: { termo: { type: 'string', description: 'Palavras-chave da busca' } }, required: ['termo'], additionalProperties: false }
  },
  {
    name: 'ler_modelo_texto',
    description: 'Lê o texto completo de um modelo da biblioteca, pelo id devolvido em buscar_modelos_texto.',
    strict: true,
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false }
  },
  {
    name: 'propor_rotina',
    description: 'Mostra ao gestor uma rotina de secretaria pronta para ele conferir e salvar. Não salva sozinha.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Ex.: "Após a decisão que concede o benefício"' },
        assunto: { type: 'string', description: 'Ex.: "INSS", "Execução", "Alvará"' },
        quando: { type: 'string', description: 'O que dispara a rotina' },
        passos: { type: 'array', items: { type: 'string' }, description: 'Passos em ordem, um por item' },
        observacoes: { type: 'string', description: 'Cuidados e observações (pode ser vazio)' }
      },
      required: ['titulo', 'assunto', 'quando', 'passos', 'observacoes'],
      additionalProperties: false
    }
  },
  {
    name: 'propor_modelo_texto',
    description: 'Mostra ao gestor um modelo de texto (certidão, ato, ofício...) para ele conferir e salvar na biblioteca. Não salva sozinho.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Ex.: "Certidão de decurso de prazo"' },
        categoria: { type: 'string', description: 'Ex.: "Certidões", "Atos ordinatórios", "Ofícios"' },
        texto: { type: 'string', description: 'O texto, com campos entre chaves duplas: {{processo}}, {{autor}}...' }
      },
      required: ['nome', 'categoria', 'texto'],
      additionalProperties: false
    }
  }
];

type Dados = { rotinas: Rotina[]; modelos: ModeloTexto[]; cidade: string };

function resposta(msg: string, status: number){ return NextResponse.json({ erro: msg }, { status }); }

function executar(nome: string, entrada: Record<string, unknown>, dados: Dados, propostas: Proposta[]): { texto: string; erro?: boolean } {
  const termo = typeof entrada.termo === 'string' ? entrada.termo : '';
  switch (nome){
    case 'buscar_rotinas': {
      const achadas = buscarRotinas(dados.rotinas, termo);
      if (!achadas.length) return { texto: dados.rotinas.length ? 'Nenhuma rotina cadastrada combina com "' + termo + '".' : 'A vara ainda não cadastrou nenhuma rotina.' };
      return { texto: achadas.map(rotinaEmTexto).join('\n\n---\n\n') };
    }
    case 'buscar_modelos_texto': {
      const achados = buscarModelos(dados.modelos, termo);
      if (!achados.length) return { texto: 'Nenhum modelo de texto combina com "' + termo + '".' };
      return { texto: JSON.stringify(achados.map(m => ({ id: m.id, nome: m.nome, categoria: m.categoria, inicio: m.texto.slice(0, 300) }))) };
    }
    case 'ler_modelo_texto': {
      const m = dados.modelos.find(x => x.id === entrada.id);
      return m ? { texto: m.nome + ' (' + m.categoria + ')\n\n' + m.texto } : { texto: 'Modelo não encontrado.', erro: true };
    }
    case 'propor_rotina': {
      const p = lerPropostaRotina(entrada);
      if (!p) return { texto: 'Faltou o título ou os passos da rotina.', erro: true };
      propostas.push(p);
      return { texto: 'A proposta de rotina está na tela; o gestor confere e decide se salva. Ainda não foi salva.' };
    }
    case 'propor_modelo_texto': {
      const p = lerPropostaModelo(entrada);
      if (!p) return { texto: 'Faltou o nome ou o texto do modelo.', erro: true };
      propostas.push(p);
      return { texto: 'A proposta de modelo está na tela; o gestor confere e decide se salva. Ainda não foi salva.' };
    }
    default:
      return { texto: 'Ferramenta desconhecida: ' + nome, erro: true };
  }
}

export async function POST(req: Request){
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return resposta('Entre no sistema para continuar.', 401);
  if (!process.env.ANTHROPIC_API_KEY) return resposta('O servidor ainda não tem a chave da IA (ANTHROPIC_API_KEY). Veja o LEIA-ME, passo "Assistente".', 500);

  const corpo = await req.json().catch(() => null) as { pin?: unknown; historico?: unknown; mensagem?: unknown } | null;
  const pin = typeof corpo?.pin === 'string' ? corpo.pin : '';
  const mensagem = typeof corpo?.mensagem === 'string' ? corpo.mensagem.trim().slice(0, 20000) : '';
  const historico = Array.isArray(corpo?.historico) ? corpo!.historico as Anthropic.Beta.BetaMessageParam[] : [];
  if (!mensagem) return resposta('Escreva a sua pergunta.', 400);
  if (JSON.stringify(historico).length > MAX_HISTORICO) return resposta('A conversa ficou muito longa. Clique em "Nova conversa" para continuar.', 413);

  // Confere o login e a senha do gestor, e já traz as rotinas e os modelos
  const banco = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + token } }
  });
  const res = await banco.rpc('ast_dados', { p_pin: pin || null });
  if (res.error){
    return /PGRST202|ast_dados|function/i.test((res.error.code || '') + ' ' + res.error.message)
      ? resposta('Falta instalar o Assistente no Supabase: rode o arquivo sql/assistente.sql (veja o LEIA-ME).', 500)
      : /JWT|token/i.test(res.error.message) ? resposta('Sua sessão venceu. Entre de novo.', 401)
      : resposta('Erro no banco de dados: ' + res.error.message, 500);
  }
  const r = res.data as { status: string; rotinas?: Rotina[]; modelos?: ModeloTexto[]; cidade?: string };
  if (r.status !== 'ok') return NextResponse.json({ erro: mensagemDoStatus(r.status, false) || 'Entre de novo como gestor.', senha: true }, { status: 403 });
  const dados: Dados = { rotinas: r.rotinas || [], modelos: r.modelos || [], cidade: r.cidade || '' };

  // A data e a cidade vão na mensagem (não nas instruções), para não quebrar o cache
  const contexto = '[Hoje: ' + diaDaVara().split('-').reverse().join('/') + (dados.cidade ? '. Cidade dos documentos: ' + dados.cidade : '') + ']\n\n';
  const mensagens: Anthropic.Beta.BetaMessageParam[] = [...historico, { role: 'user', content: contexto + mensagem }];
  const inicio = mensagens.length;
  const propostas: Proposta[] = [];
  const cliente = new Anthropic();
  const reserva = COM_RESERVA.test(MODELO);

  try {
    for (let volta = 0; volta < MAX_VOLTAS; volta++){
      const msg = await cliente.beta.messages.create({
        model: MODELO,
        max_tokens: 16000,
        system: SISTEMA,
        tools: FERRAMENTAS,
        messages: mensagens,
        cache_control: { type: 'ephemeral' },
        output_config: { effort: 'medium' },
        ...(reserva ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {})
      });
      mensagens.push({ role: 'assistant', content: msg.content });

      if (msg.stop_reason === 'refusal'){
        // a conversa recusada não é guardada: o gestor reformula e segue
        return NextResponse.json({ historico, resposta: 'Não consegui atender a este pedido. Tente reformular, sem dados pessoais desnecessários.', propostas: [] });
      }
      if (msg.stop_reason === 'pause_turn') continue;
      if (msg.stop_reason !== 'tool_use') break;

      const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const b of msg.content){
        if (b.type !== 'tool_use') continue;
        const saida = executar(b.name, (b.input || {}) as Record<string, unknown>, dados, propostas);
        resultados.push({ type: 'tool_result', tool_use_id: b.id, content: saida.texto, ...(saida.erro ? { is_error: true } : {}) });
      }
      mensagens.push({ role: 'user', content: resultados });
    }
  } catch (e){
    if (e instanceof Anthropic.AuthenticationError) return resposta('A chave da IA (ANTHROPIC_API_KEY) não foi aceita. Confira na Vercel.', 500);
    if (e instanceof Anthropic.RateLimitError) return resposta('A IA está com muitos pedidos agora. Espere um minuto e tente de novo.', 429);
    if (e instanceof Anthropic.BadRequestError) return resposta('A IA não aceitou a conversa (' + e.message + '). Clique em "Nova conversa" e tente de novo.', 400);
    if (e instanceof Anthropic.APIError) return resposta('A IA não respondeu (erro ' + e.status + '). Tente de novo em instantes.', 502);
    return resposta('Não consegui falar com a IA. Confira a internet e tente de novo.', 502);
  }

  // Termina sempre com a resposta da IA; se parou no meio das ferramentas, avisa
  const ultima = mensagens[mensagens.length - 1];
  if (ultima.role === 'user'){
    mensagens.push({ role: 'assistant', content: 'Parei aqui para não demorar demais. Peça para eu continuar, se precisar.' });
  }
  const texto = mensagens.slice(inicio)
    .filter(m => m.role === 'assistant')
    .flatMap(m => typeof m.content === 'string' ? [m.content] : m.content.flatMap(b => (b.type === 'text' && b.text.trim() ? [b.text.trim()] : [])))
    .join('\n\n');

  return NextResponse.json({ historico: mensagens, resposta: texto || 'Pronto.', propostas });
}
