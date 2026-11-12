// Leitura da capa do processo por foto (Arquivo > Cadastrar), com o Claude Sonnet 5.5.
// Só funciona para quem está logado e só se a chave ANTHROPIC_API_KEY estiver nas variáveis da
// Vercel; sem a chave responde 503 e o cadastro continua normal, digitando (veja o LEIA-ME).
// A foto chega reduzida pelo navegador, é usada só para esta leitura e não fica guardada.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODELO = 'claude-sonnet-5-5';
const TAMANHO_MAX = 6_000_000;           // caracteres em base64 (~4,5 MB de foto)
const POR_HORA = 120;                    // leituras por pessoa por hora (proteção contra gasto sem querer)
const tipos = ['image/jpeg', 'image/png', 'image/webp'] as const;
type Tipo = typeof tipos[number];

const PROMPT = 'Você está lendo a FOTO DA CAPA de um processo judicial físico arquivado no Tribunal de Justiça de Mato Grosso (2ª Vara). ' +
  'Extraia os campos pedidos. "codigo" é o código numérico curto do sistema antigo (campo "Código", em geral 3 a 6 dígitos), só os dígitos. ' +
  '"numero" é a numeração do processo: a única do CNJ (NNNNNNN-DD.AAAA.8.11.OOOO) ou a antiga (ex.: 224/1987), como está na capa. ' +
  '"partes": nomes das partes como aparecem (autor/requerente primeiro). "ano": ano de distribuição/autuação, 4 dígitos. ' +
  'Campo ilegível ou ausente = texto vazio (lista vazia em "partes"); nunca invente. Em "observacao", diga em poucas palavras o que ficou duvidoso (ou deixe vazio).';

const ESQUEMA = {
  type: 'object',
  properties: {
    codigo: { type: 'string' },
    numero: { type: 'string' },
    classe: { type: 'string' },
    partes: { type: 'array', items: { type: 'string' } },
    ano: { type: 'string' },
    confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
    observacao: { type: 'string' }
  },
  required: ['codigo', 'numero', 'classe', 'partes', 'ano', 'confianca', 'observacao'],
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
  if (!chave) return erro('A leitura por foto ainda não foi configurada (falta a chave da Anthropic na Vercel). Preencha os campos.', 503);

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return erro('Entre no sistema para continuar.', 401);
  const { data: quem, error: semLogin } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }).auth.getUser(token);
  if (semLogin || !quem.user) return erro('Sua sessão venceu. Entre de novo.', 401);
  if (passouDoLimite(quem.user.id)) return erro('Muitas leituras na última hora. Espere um pouco ou preencha os campos.', 429);

  let corpo: { imagem?: unknown; tipo?: unknown };
  try { corpo = await req.json(); } catch (e){ return erro('Foto inválida.', 400); }
  const imagem = typeof corpo.imagem === 'string' ? corpo.imagem : '';
  const tipo: Tipo = tipos.includes(corpo.tipo as Tipo) ? corpo.tipo as Tipo : 'image/jpeg';
  if (!imagem || imagem.length > TAMANHO_MAX || !/^[A-Za-z0-9+/=]+$/.test(imagem)) return erro('Foto inválida ou grande demais.', 400);

  const client = new Anthropic({ apiKey: chave, maxRetries: 2, timeout: 55_000 });
  try {
    const r = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: tipo, data: imagem } },
        { type: 'text', text: PROMPT }
      ] }]
    });
    if (r.stop_reason === 'refusal') return erro('A IA não leu esta foto. Preencha os campos.', 422);
    const texto = r.content.find(b => b.type === 'text');
    if (!texto || texto.type !== 'text') return erro('Não consegui ler a capa. Tente outra foto ou preencha os campos.', 502);
    let leitura: unknown;
    try { leitura = JSON.parse(texto.text); } catch (e){ return erro('A leitura veio fora do formato. Toque em “Ler de novo”.', 502); }
    return NextResponse.json({ leitura, modelo: r.model });
  } catch (e){
    if (e instanceof Anthropic.RateLimitError) return erro('Muitas leituras ao mesmo tempo. Espere um pouco e tente de novo.', 429);
    if (e instanceof Anthropic.AuthenticationError) return erro('A chave da Anthropic configurada na Vercel não foi aceita. Avise o administrador.', 503);
    if (e instanceof Anthropic.BadRequestError) return erro('A foto não pôde ser lida. Tire outra, mais de perto e sem reflexo.', 400);
    if (e instanceof Anthropic.APIError) return erro('O serviço de leitura está com problema agora (' + e.status + '). Preencha os campos.', 502);
    return erro('Não consegui falar com o serviço de leitura. Tente de novo.', 502);
  }
}
