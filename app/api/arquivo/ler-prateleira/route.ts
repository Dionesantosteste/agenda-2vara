// Leitura da foto de uma prateleira (Arquivo > Prateleiras > Conferir por foto), com o Claude Sonnet 5.5.
// Devolve as caixas fileira por fileira, de CIMA para BAIXO como aparecem na foto; a tela converte
// para as letras da vara (A = fileira de baixo). Mesmas regras da leitura da capa: só para quem está
// logado, só com a chave ANTHROPIC_API_KEY na Vercel (sem ela responde 503), e a foto não fica guardada.
// O navegador manda a foto inteira e, para as etiquetas pequenas, a metade de cima e a de baixo ampliadas.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODELO = 'claude-sonnet-5-5';
const TAMANHO_MAX = 4_300_000;           // total em base64 das fotos (a Vercel aceita até ~4,5 MB por pedido)
const POR_HORA = 40;                     // leituras por pessoa por hora (proteção contra gasto sem querer)
const tipos = ['image/jpeg', 'image/png', 'image/webp'] as const;
type Tipo = typeof tipos[number];

const PROMPT = 'Você está lendo a FOTO DE UMA ESTANTE de aço do arquivo de processos físicos da 2ª Vara (Tribunal de Justiça de Mato Grosso). ' +
  'Cada caixa-arquivo tem uma etiqueta com o número da caixa (ex.: "2ª VARA ARQUIVO CAIXA 1204" -> "1204"; "CAIXA 562" -> "562"). ' +
  'A 1ª imagem é a estante inteira; quando houver mais duas, são a METADE DE CIMA e a METADE DE BAIXO da mesma foto, ampliadas (com um pedaço repetido no meio): ' +
  'use a 1ª para contar os níveis e a posição de cada caixa, e as ampliadas para ler os números. Não conte duas vezes uma caixa que aparece em duas imagens. ' +
  'Leia SÓ a estante principal da foto (a que aparece inteira, em geral no centro); ignore as caixas de estantes vizinhas cortadas nas bordas. ' +
  'Liste os níveis de CIMA para BAIXO: se houver caixas apoiadas em cima da estante, esse é o primeiro nível; depois cada prateleira até a de baixo. ' +
  'Inclua TODAS as prateleiras da estante, mesmo uma prateleira vazia (com a lista de caixas vazia): a contagem das prateleiras define as letras. ' +
  'Em cada nível, as caixas da ESQUERDA para a DIREITA, na ordem exata em que estão. ' +
  '"nome": o número da caixa como está na etiqueta, sem a palavra "caixa" (ex.: "1204"). Se a etiqueta tiver letras no código, mantenha como está (ex.: "CX163CR1"). ' +
  'Palavras extras da etiqueta (ex.: "Crime", "Elástico", "Arquivo provisório", "Termos temporários") vão em "observacao", não no nome. ' +
  'Se houver número riscado ou escrito à mão diferente do impresso, use o da etiqueta principal, marque legivel = "duvida" e explique em "observacao". ' +
  'Etiqueta coberta, borrada ou ilegível: legivel = "duvida"; se não der para ler nada, nome vazio. Nunca invente números. ' +
  '"etiqueta_estante": o número da plaquinha da estante, se aparecer (ex.: "24"); senão vazio. ' +
  'Em "observacao" geral, diga em poucas palavras o que ficou duvidoso (ou deixe vazio).';

const ESQUEMA = {
  type: 'object',
  properties: {
    etiqueta_estante: { type: 'string' },
    niveis: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          caixas: {
            type: 'array',
            items: {
              type: 'object',
              properties: { nome: { type: 'string' }, legivel: { type: 'string', enum: ['sim', 'duvida'] }, observacao: { type: 'string' } },
              required: ['nome', 'legivel', 'observacao'],
              additionalProperties: false
            }
          }
        },
        required: ['caixas'],
        additionalProperties: false
      }
    },
    observacao: { type: 'string' }
  },
  required: ['etiqueta_estante', 'niveis', 'observacao'],
  additionalProperties: false
};

// contagem simples por pessoa (vale para cada instância do servidor; o limite de gasto mensal
// fica no painel da Anthropic)
const usos = new Map<string, number[]>();
function passouDoLimite(id: string){
  const agora = Date.now(), l = (usos.get(id) || []).filter(t => agora - t < 3_600_000);
  l.push(agora); usos.set(id, l);
  return l.length > POR_HORA;
}

const erro = (msg: string, status: number) => NextResponse.json({ erro: msg }, { status });

export async function POST(req: Request){
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) return erro('A leitura por foto ainda não foi configurada (falta a chave da Anthropic na Vercel). Anote as caixas pela tela Conferir ou arrastando.', 503);

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return erro('Entre no sistema para continuar.', 401);
  const { data: quem, error: semLogin } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }).auth.getUser(token);
  if (semLogin || !quem.user) return erro('Sua sessão venceu. Entre de novo.', 401);
  if (passouDoLimite('prat:' + quem.user.id)) return erro('Muitas leituras na última hora. Espere um pouco.', 429);

  let corpo: { imagem?: unknown; imagens?: unknown; tipo?: unknown };
  try { corpo = await req.json(); } catch (e){ return erro('Foto inválida.', 400); }
  const imagens = Array.isArray(corpo.imagens) ? corpo.imagens : [corpo.imagem];
  const tipo: Tipo = tipos.includes(corpo.tipo as Tipo) ? corpo.tipo as Tipo : 'image/jpeg';
  const total = imagens.reduce((n: number, x) => n + (typeof x === 'string' ? x.length : 0), 0);
  if (!imagens.length || imagens.length > 3 || total > TAMANHO_MAX || !imagens.every(x => typeof x === 'string' && x && /^[A-Za-z0-9+/=]+$/.test(x)))
    return erro('Foto inválida ou grande demais.', 400);

  const client = new Anthropic({ apiKey: chave, maxRetries: 2, timeout: 55_000 });
  try {
    const r = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA } },
      messages: [{ role: 'user', content: [
        ...(imagens as string[]).map(data => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: tipo, data } })),
        { type: 'text', text: PROMPT }
      ] }]
    });
    if (r.stop_reason === 'refusal') return erro('A IA não leu esta foto. Tire outra.', 422);
    const texto = r.content.find(b => b.type === 'text');
    if (!texto || texto.type !== 'text') return erro('Não consegui ler a foto. Tire outra, de frente e com a estante inteira.', 502);
    let leitura: unknown;
    try { leitura = JSON.parse(texto.text); } catch (e){ return erro('A leitura veio fora do formato. Toque em “Ler de novo”.', 502); }
    return NextResponse.json({ leitura, modelo: r.model });
  } catch (e){
    if (e instanceof Anthropic.RateLimitError) return erro('Muitas leituras ao mesmo tempo. Espere um pouco e tente de novo.', 429);
    if (e instanceof Anthropic.AuthenticationError) return erro('A chave da Anthropic configurada na Vercel não foi aceita. Avise o administrador.', 503);
    if (e instanceof Anthropic.BadRequestError) return erro('A foto não pôde ser lida. Tire outra, de frente e sem reflexo.', 400);
    if (e instanceof Anthropic.APIError) return erro('O serviço de leitura está com problema agora (' + e.status + '). Tente mais tarde.', 502);
    return erro('Não consegui falar com o serviço de leitura. Tente de novo.', 502);
  }
}
