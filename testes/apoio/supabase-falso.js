// Supabase simulado para os testes. Responde no nível da rede (as mesmas chamadas HTTP que o
// site faz ao Supabase), então serve tanto para o index.html de hoje quanto para o sistema novo.
// Nada sai para o Supabase de verdade: o que não for tratado aqui é bloqueado.
//
// - /rest/v1/<tabela>   imita o PostgREST: select, filtros, order, insert, update, upsert, delete
// - /rest/v1/rpc/<fn>   chama a função de mesmo nome em ORG (abaixo), que segue as regras do
//                       sql/organizacao.sql. Função não simulada vira erro e falha o teste.
const crypto = require('crypto');

const TZ = 'America/Cuiaba';
const PIN_GESTOR = '123456';

// "Hoje" no horário da vara (AAAA-MM-DD), como org_hoje() no banco
function hojeVara(d = new Date()){
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function diaVara(iso){ return iso ? hojeVara(new Date(iso)) : null; }
function segundaDe(dia){
  const [a, m, d] = dia.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}
function somaDias(dia, n){
  const [a, m, d] = dia.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
const agora = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const copia = x => JSON.parse(JSON.stringify(x));

// Valores padrão das colunas (como os "default" do SQL)
const PADROES = {
  contacts: () => ({ id: uuid(), name: '', phones: [], emails: [], category: '', created_at: agora() }),
  categories: () => ({ id: uuid(), name: '' }),
  audiencias: () => ({ id: uuid(), processo: '', tipo: '', status: 'A cumprir', observacoes: '', conferida_em: null, created_at: agora(), updated_at: agora() }),
  audiencias_tipos: () => ({ id: uuid(), nome: '', created_at: agora() }),
  pericias: () => ({ id: uuid(), processo: '', autor: '', perito: '', especialidade: '', status: 'nao_agendada', data_pericia: null, local: '',
    realizada_em: null, laudo_em: null, observacoes: '', conferida_em: null, created_at: agora(), updated_at: agora() }),
  pericias_andamentos: () => ({ id: uuid(), texto: '', created_at: agora() }),
  peritos: () => ({ id: uuid(), especialidade: '', telefone: '', email: '', observacoes: '', created_at: agora(), updated_at: agora() }),
  prazos_config: () => ({ valor: {}, updated_at: agora() })
};
const CHAVE = { prazos_config: 'chave' };   // chave primária quando não é "id"

// ---------- filtros do PostgREST ----------
function valorFiltro(v){
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}
function casa(linha, col, expr){
  const i = expr.indexOf('.');
  let op = expr.slice(0, i), val = expr.slice(i + 1), neg = false;
  if (op === 'not'){ neg = true; const j = val.indexOf('.'); op = val.slice(0, j); val = val.slice(j + 1); }
  const x = linha[col];
  let r;
  switch (op){
    case 'eq': r = String(x) === String(valorFiltro(val)) || (x === null && val === 'null'); break;
    case 'neq': r = String(x) !== String(valorFiltro(val)); break;
    case 'gt': r = x > val; break;
    case 'gte': r = x >= val; break;
    case 'lt': r = x < val; break;
    case 'lte': r = x <= val; break;
    case 'is': r = val === 'null' ? x === null || x === undefined : x === valorFiltro(val); break;
    case 'in': r = val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')).includes(String(x)); break;
    case 'like': case 'ilike': {
      const re = new RegExp('^' + val.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*') + '$', op === 'ilike' ? 'i' : '');
      r = re.test(String(x ?? '')); break;
    }
    default: throw new Error('Filtro não simulado: ' + op);
  }
  return neg ? !r : r;
}
const RESERVADOS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
function filtra(linhas, params){
  let out = linhas;
  for (const [col, expr] of params){
    if (RESERVADOS.has(col)) continue;
    out = out.filter(l => casa(l, col, expr));
  }
  return out;
}
function ordena(linhas, order){
  if (!order) return linhas;
  const regras = order.split(',').map(s => { const p = s.split('.'); return { col: p[0], desc: p[1] === 'desc' }; });
  return linhas.slice().sort((a, b) => {
    for (const r of regras){
      const x = a[r.col], y = b[r.col];
      if (x === y) continue;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const c = typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : x < y ? -1 : 1;
      return r.desc ? -c : c;
    }
    return 0;
  });
}
function projeta(linhas, select){
  if (!select || select.trim() === '*') return linhas.map(copia);
  const cols = select.split(',').map(s => s.trim()).filter(Boolean);
  return linhas.map(l => { const o = {}; cols.forEach(c => { o[c] = l[c] === undefined ? null : copia(l[c]); }); return o; });
}

class SupabaseFalso {
  constructor(){
    this.tabelas = {};
    Object.keys(PADROES).forEach(t => { this.tabelas[t] = []; });
    this.org = novaOrg();
    this.chamadas = [];        // [{ tipo: 'rest'|'rpc', metodo, alvo, corpo }]
    this.naoSimuladas = [];    // funções ou tabelas que o site pediu e o simulador não conhece
  }

  // Coloca linhas numa tabela já com os valores padrão
  semear(tabela, linhas){
    const fab = PADROES[tabela];
    if (!fab) throw new Error('Tabela não simulada: ' + tabela);
    linhas.forEach(l => this.tabelas[tabela].push(Object.assign(fab(), l)));
    return this;
  }

  async tratar(route){
    const req = route.request();
    const url = new URL(req.url());
    const m = url.pathname.match(/^\/rest\/v1\/(rpc\/)?([a-z0-9_]+)$/i);
    if (!m){ await route.abort(); return; }   // auth, realtime, storage: nada disso é usado nos testes
    const corpo = req.postData() ? JSON.parse(req.postData()) : null;
    if (m[1]){
      this.chamadas.push({ tipo: 'rpc', metodo: req.method(), alvo: m[2], corpo });
      const fn = ORG_FUNCOES[m[2]];
      if (!fn){
        this.naoSimuladas.push('rpc ' + m[2]);
        await route.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Função não simulada nos testes: ' + m[2] } });
        return;
      }
      const res = fn(this.org, corpo || {});
      await route.fulfill({ status: 200, json: res });
      return;
    }
    this.chamadas.push({ tipo: 'rest', metodo: req.method(), alvo: m[2] + url.search, corpo });
    await this.rest(route, req, url, m[2], corpo);
  }

  async rest(route, req, url, tabela, corpo){
    const lista = this.tabelas[tabela];
    if (!lista){
      this.naoSimuladas.push('tabela ' + tabela);
      await route.fulfill({ status: 404, json: { code: 'PGRST205', message: "Could not find the table 'public." + tabela + "' in the schema cache" } });
      return;
    }
    const params = [...url.searchParams.entries()];
    const sp = url.searchParams;
    const h = req.headers();
    const prefer = h['prefer'] || '';
    const umSo = (h['accept'] || '').includes('vnd.pgrst.object');
    const devolve = /return=representation/.test(prefer);
    const responde = async (linhas, status) => {
      const corpoResp = projeta(linhas, sp.get('select'));
      if (umSo) return route.fulfill({ status, json: corpoResp[0] || null });
      return route.fulfill({ status, json: corpoResp });
    };
    const metodo = req.method();
    if (metodo === 'GET' || metodo === 'HEAD'){
      let linhas = ordena(filtra(lista, params), sp.get('order'));
      const total = linhas.length;
      const off = Number(sp.get('offset') || 0), lim = sp.get('limit') ? Number(sp.get('limit')) : undefined;
      linhas = linhas.slice(off, lim === undefined ? undefined : off + lim);
      const headers = { 'access-control-expose-headers': 'content-range', 'content-range': (linhas.length ? off + '-' + (off + linhas.length - 1) : '*') + '/' + (/count=/.test(prefer) ? total : '*') };
      if (metodo === 'HEAD') return route.fulfill({ status: 200, headers, body: '' });
      return route.fulfill({ status: 200, headers, json: umSo ? (projeta(linhas, sp.get('select'))[0] || null) : projeta(linhas, sp.get('select')) });
    }
    if (metodo === 'POST'){
      const novos = Array.isArray(corpo) ? corpo : [corpo];
      const upsert = /resolution=merge-duplicates/.test(prefer);
      const chave = sp.get('on_conflict') || CHAVE[tabela] || 'id';
      const gravados = novos.map(n => {
        const existente = upsert && n[chave] !== undefined ? lista.find(l => l[chave] === n[chave]) : null;
        if (existente){ Object.assign(existente, n); return existente; }
        const linha = Object.assign(PADROES[tabela](), n);
        lista.push(linha);
        return linha;
      });
      if (devolve) return responde(gravados, 201);
      return route.fulfill({ status: 201, body: '' });
    }
    if (metodo === 'PATCH'){
      const alvos = filtra(lista, params);
      alvos.forEach(l => Object.assign(l, corpo));
      if (devolve) return responde(alvos, 200);
      return route.fulfill({ status: 204, body: '' });
    }
    if (metodo === 'DELETE'){
      const alvos = filtra(lista, params);
      this.tabelas[tabela] = lista.filter(l => !alvos.includes(l));
      if (devolve) return responde(alvos, 200);
      return route.fulfill({ status: 204, body: '' });
    }
    await route.fulfill({ status: 405, json: { message: 'Método não simulado: ' + metodo } });
  }
}

// =====================================================================================
// Organização: o mesmo comportamento das funções org_* do sql/organizacao.sql
// =====================================================================================
function novaOrg(){
  return { pin: PIN_GESTOR, pessoas: [], tarefas: [], notas: [], lembretes: [], rotinas: [], etiquetas: [], colunas: [], anotacoes: [],
    modelos: [], aniversarios: [], estrelas: [], bichos: [], txt_modelos: [], txt_categorias: [], txt_meus: [], txt_cidade: '' };
}
function tarefaPadrao(){
  return { id: uuid(), titulo: '', prazo: null, urgente: false, responsavel: '', processo: '', feita_em: null, created_at: agora(), updated_at: agora(),
    etapa: 'afazer', etiquetas: [], posicao: null, checklist: [], arquivada_em: null, prioridade: 'normal', do_gestor: false, conclusao: null,
    conferencia: null, conf_hist: [], dono: null, ordem_lista: null, aparece_em: null, modelo_texto: null, enviada_por: null, recado_gestor: null, enviada_em: null };
}
function notaPadrao(){ return { id: uuid(), texto: '', cor: 'amarelo', fixada: false, titulo: '', dono: null, created_at: agora(), updated_at: agora() }; }
function lembretePadrao(){ return { id: uuid(), texto: '', data: hojeVara(), hora: null, processo: '', feito_em: null, dono: null, created_at: agora(), updated_at: agora() }; }

// Pessoas e tarefas para os testes da Organização
function semearOrg(org, { pessoas = [], tarefas = [], notas = [], estrelas = [], bichos = [] } = {}){
  pessoas.forEach(p => org.pessoas.push(Object.assign({ id: uuid(), nome: '', ativo: true, bicho_quadro: null, created_at: agora() }, p)));
  tarefas.forEach(t => org.tarefas.push(Object.assign(tarefaPadrao(), t)));
  notas.forEach(n => org.notas.push(Object.assign(notaPadrao(), n)));
  estrelas.forEach(e => org.estrelas.push(Object.assign({ created_at: agora() }, e)));
  bichos.forEach(b => org.bichos.push(Object.assign({ created_at: agora() }, b)));
}

function acesso(org, a){
  const gestor = a.p_pin !== null && a.p_pin !== undefined;
  const dono = a.p_pessoa || null;
  let st;
  if (gestor){
    st = a.p_pin === org.pin ? 'ok' : 'senha';
    if (st === 'ok' && dono && !org.pessoas.some(p => p.id === dono)) st = 'sem_pessoa';
  } else if (!dono) st = 'senha';
  else st = org.pessoas.some(p => p.id === dono && p.ativo) ? 'ok' : 'sem_pessoa';
  return { st, dono, gestor };
}
const doDono = (lista, dono) => lista.filter(x => (x.dono || null) === (dono || null));
const erro = message => ({ status: 'erro', message });

// Gatilho org_tarefas_estrela: 10 concluídas no mesmo dia (horário da vara) = 1 estrela, até 5 por semana
function confereEstrela(org, t, antes){
  const hoje = hojeVara();
  if (!t.dono || !t.feita_em || diaVara(t.feita_em) !== hoje || t.feita_em > agora()) return;
  if (antes === t.feita_em) return;
  if (org.estrelas.some(e => e.dono === t.dono && e.dia === hoje)) return;
  const seg = segundaDe(hoje), fim = somaDias(seg, 7);
  if (org.estrelas.filter(e => e.dono === t.dono && e.dia >= seg && e.dia < fim).length >= 5) return;
  const n = org.tarefas.filter(x => x.dono === t.dono && x.feita_em && diaVara(x.feita_em) === hoje).length;
  if (n >= 10) org.estrelas.push({ dono: t.dono, dia: hoje, created_at: agora() });
}
function resumoEstrelas(org, dono){
  if (!dono) return null;
  const hoje = hojeVara(), seg = segundaDe(hoje);
  const p = org.pessoas.find(x => x.id === dono);
  return {
    total: org.estrelas.filter(e => e.dono === dono).length,
    semana: org.estrelas.filter(e => e.dono === dono && e.dia >= seg).length,
    hoje: org.estrelas.some(e => e.dono === dono && e.dia === hoje),
    bichos: org.bichos.filter(b => b.dono === dono).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(b => b.tipo),
    no_quadro: p ? (p.bicho_quadro ?? null) : null
  };
}
function assinatura(org, dono, gestor){
  const ts = org.tarefas.filter(t => gestor || ((t.dono || null) === (dono || null) && (!t.aparece_em || t.aparece_em <= hojeVara())));
  const ns = doDono(org.notas, dono);
  const max = l => l.reduce((m, x) => x.updated_at > m ? x.updated_at : m, '');
  return ts.length + '|' + max(ts) + '|' + ns.length + '|' + max(ns) + '|' + hojeVara();
}

const ORG_FUNCOES = {
  org_pessoas_publico(org){
    return { status: 'ok', pessoas: org.pessoas.filter(p => p.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(p => ({ id: p.id, nome: p.nome })) };
  },
  org_aniversariantes_mes(org){
    const mes = Number(hojeVara().slice(5, 7));
    return { status: 'ok', aniversariantes: org.aniversarios.filter(a => a.mes === mes) };
  },
  org_carregar(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    const hoje = hojeVara();
    const tarefas = org.tarefas.filter(t => (t.dono || null) === ac.dono && (ac.gestor || !t.aparece_em || t.aparece_em <= hoje))
      .sort((x, y) => (x.prazo || '9999').localeCompare(y.prazo || '9999') || x.created_at.localeCompare(y.created_at));
    const ids = new Set(tarefas.map(t => t.id));
    const pessoa = org.pessoas.find(p => p.id === ac.dono);
    const res = {
      status: 'ok', gestor: ac.gestor,
      pessoa: pessoa ? { id: pessoa.id, nome: pessoa.nome } : null,
      estrelas: resumoEstrelas(org, ac.dono),
      notas: copia(doDono(org.notas, ac.dono)), tarefas: copia(tarefas),
      lembretes: copia(doDono(org.lembretes, ac.dono)),
      rotinas: ac.gestor ? copia(org.rotinas) : [],
      etiquetas: copia(doDono(org.etiquetas, ac.dono)), colunas: copia(doDono(org.colunas, ac.dono)),
      anotacoes: copia(org.anotacoes.filter(x => ids.has(x.tarefa_id))),
      modelos: copia(doDono(org.modelos, ac.dono)),
      ordem: true, checklist: true, arquivar_livre: true, equipe: true, conferencia: true, agenda: true, nota_titulo: true, ordem_lista: true, lote: true, enviar_gestor: true,
      aniversarios: ac.gestor ? copia(org.aniversarios) : null,
      assinatura: assinatura(org, ac.dono, ac.gestor),
      txt_modelos: copia(org.txt_modelos), txt_categorias: copia(org.txt_categorias),
      txt_meus: copia(org.txt_meus.find(x => (x.dono || null) === ac.dono) || null), txt_cidade: org.txt_cidade
    };
    if (ac.gestor){
      res.pessoas = org.pessoas.map(p => ({ id: p.id, nome: p.nome, ativo: p.ativo })).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
      res.equipe_conferir = org.tarefas.filter(t => t.dono && t.conferencia === 'enviada' && !t.arquivada_em).length;
    }
    if (ac.gestor && (a.p_equipe ?? 2) > 0){
      res.equipe_completa = (a.p_equipe ?? 2) >= 2;
      res.equipe_tarefas = copia(org.tarefas.filter(t => t.dono && (t.do_gestor || t.conferencia) && !t.arquivada_em));
      res.equipe_colunas = org.colunas.filter(c => c.dono).map(c => ({ dono: c.dono, chave: c.chave, nome: c.nome }));
      res.equipe_modelos = copia(org.modelos.filter(m => !m.dono));
    }
    return res;
  },
  org_novidades(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    const hoje = hojeVara();
    return {
      status: 'ok', assinatura: assinatura(org, ac.dono, ac.gestor),
      urgentes: org.tarefas.filter(t => (t.dono || null) === ac.dono && t.do_gestor && t.prioridade === 'urgente' && t.etapa !== 'feito' && !t.arquivada_em && (!t.aparece_em || t.aparece_em <= hoje))
        .map(t => ({ id: t.id, titulo: t.titulo })),
      conferir: ac.gestor ? org.tarefas.filter(t => t.dono && t.conferencia === 'enviada' && !t.arquivada_em).map(t => ({ id: t.id, titulo: t.titulo, dono: t.dono })) : null,
      enviadas: ac.gestor ? org.tarefas.filter(t => !t.dono && t.enviada_por && t.etapa !== 'feito' && !t.arquivada_em).map(t => ({ id: t.id, titulo: t.titulo, de: t.enviada_por })) : null
    };
  },
  org_salvar_tarefa(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    const pr = ['baixa', 'normal', 'alta', 'urgente'].includes(a.p_prioridade) ? a.p_prioridade : null;
    if (!a.p_id){
      const t = Object.assign(tarefaPadrao(), {
        dono: ac.dono, do_gestor: ac.gestor && !!ac.dono, titulo: a.p_titulo || '', prazo: a.p_prazo || null,
        prioridade: pr || 'normal', urgente: (pr || 'normal') === 'urgente', responsavel: a.p_responsavel || '', processo: a.p_processo || '',
        feita_em: a.p_feita_em || null, etapa: a.p_etapa || 'afazer'
      });
      org.tarefas.push(t);
      confereEstrela(org, t, null);
      return { status: 'ok', id: t.id };
    }
    const t = org.tarefas.find(x => x.id === a.p_id && (x.dono || null) === ac.dono);
    if (!ac.gestor && t && a.p_etapa && t.conferencia === 'enviada' && t.etapa !== a.p_etapa)
      return erro('Esta tarefa está em conferência com o gestor. Espere a resposta ou cancele o envio.');
    if (!t) return erro('Esta tarefa não existe mais.');
    const antes = t.feita_em;
    const etapa = a.p_etapa || t.etapa;
    if (t.conferencia === 'enviada' && etapa === 'feito') t.conferencia = 'aprovada';
    if (a.p_etapa && a.p_etapa !== t.etapa) t.posicao = null;
    Object.assign(t, {
      titulo: a.p_titulo ?? t.titulo, prazo: a.p_prazo ?? null, prioridade: pr || t.prioridade, urgente: (pr || t.prioridade) === 'urgente',
      responsavel: a.p_responsavel ?? t.responsavel, processo: a.p_processo ?? t.processo, feita_em: a.p_feita_em ?? null, etapa, updated_at: agora()
    });
    confereEstrela(org, t, antes);
    return { status: 'ok', id: t.id };
  },
  org_excluir_tarefa(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    if (!ac.gestor && org.tarefas.some(t => t.id === a.p_id && t.dono === ac.dono && t.do_gestor))
      return erro('Tarefa mandada pelo gestor não pode ser excluída. Se ela não for mais necessária, fale com o gestor.');
    org.tarefas = org.tarefas.filter(t => !(t.id === a.p_id && (t.dono || null) === ac.dono));
    return { status: 'ok' };
  },
  org_conferencia(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    const t = ac.dono ? org.tarefas.find(x => x.id === a.p_id && x.dono === ac.dono) : null;
    if (!t) return erro('Esta tarefa não existe mais.');
    const txt = (a.p_texto || '').trim().slice(0, 1000);
    let novo;
    if (a.p_acao === 'enviar'){
      if (t.conferencia === 'enviada') return erro('Esta tarefa já está em conferência.');
      if (t.etapa === 'feito' || t.arquivada_em) return erro('Tarefa concluída ou arquivada não vai para conferência.');
      novo = 'enviada';
    } else if (a.p_acao === 'cancelar'){
      if (t.conferencia !== 'enviada') return erro('Esta tarefa não está em conferência.');
      novo = null;
    } else if (a.p_acao === 'aprovar' || a.p_acao === 'devolver'){
      if (!ac.gestor) return erro('Só o gestor confere as tarefas.');
      if (t.conferencia !== 'enviada') return erro('Esta tarefa não está esperando conferência.');
      if (a.p_acao === 'devolver' && !txt) return erro('Escreva o motivo da devolução.');
      novo = a.p_acao === 'aprovar' ? 'aprovada' : 'devolvida';
    } else return erro('Ação desconhecida.');
    t.conferencia = novo;
    t.conf_hist.push({ a: novo || 'cancelada', em: agora(), t: txt });
    t.updated_at = agora();
    return { status: 'ok', conferencia: novo };
  },
  org_concluir_tarefa(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    if (!ac.gestor && org.tarefas.some(t => t.id === a.p_id && t.conferencia === 'enviada'))
      return erro('Esta tarefa está em conferência com o gestor. Espere a resposta ou cancele o envio.');
    const t = org.tarefas.find(x => x.id === a.p_id && (x.dono || null) === ac.dono);
    if (!t) return erro('Esta tarefa não existe mais.');
    const c = a.p_conclusao && typeof a.p_conclusao === 'object' ? a.p_conclusao : {};
    const antes = t.feita_em;
    Object.assign(t, { etapa: 'feito', feita_em: t.feita_em || agora(), posicao: null, updated_at: agora(), conclusao: {
      horas: /^\d{1,3}$/.test(String(c.horas)) ? Number(c.horas) : 0,
      minutos: /^\d{1,2}$/.test(String(c.minutos)) ? Math.min(Number(c.minutos), 59) : 0,
      conformidade: ['sim', 'parcialmente', 'nao'].includes(c.conformidade) ? c.conformidade : 'sim',
      dificuldade: String(c.dificuldade) === 'true', dificuldade_desc: String(c.dificuldade_desc || '').trim().slice(0, 1000),
      precisa_acao: String(c.precisa_acao) === 'true', em: agora() } });
    confereEstrela(org, t, antes);
    return { status: 'ok' };
  },
  org_enviar_ao_gestor(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    if (ac.gestor || !ac.dono) return erro('Só a pessoa da equipe manda tarefa do quadro dela para o gestor.');
    const rec = (a.p_recado || '').trim().slice(0, 1000);
    if (!rec) return erro('Escreva um recado para o gestor saber o que precisa.');
    const t = org.tarefas.find(x => x.id === a.p_id && x.dono === ac.dono);
    if (!t) return erro('Esta tarefa não existe mais.');
    if (t.do_gestor) return erro('Tarefa mandada pelo gestor volta para ele só pela conferência.');
    if (t.etapa === 'feito' || t.arquivada_em) return erro('Tarefa concluída ou arquivada não pode ser mandada para o gestor.');
    if (t.conferencia === 'enviada') return erro('Esta tarefa está em conferência com o gestor. Espere a resposta ou cancele o envio.');
    Object.assign(t, { dono: null, do_gestor: false, etapa: 'afazer', feita_em: null, posicao: null, ordem_lista: null, etiquetas: [], aparece_em: null,
      enviada_por: ac.dono, recado_gestor: rec, enviada_em: agora(), updated_at: agora() });
    return { status: 'ok' };
  },
  org_enviar_tarefa(org, a){
    if (a.p_pin !== org.pin) return { status: 'senha' };
    if (!org.pessoas.some(p => p.id === a.p_destino)) return erro('Esta pessoa não está mais cadastrada.');
    const t = org.tarefas.find(x => x.id === a.p_id && !x.dono);
    if (t) Object.assign(t, { dono: a.p_destino, do_gestor: true, etapa: 'afazer', feita_em: null, posicao: null, etiquetas: [], conclusao: null,
      enviada_por: null, recado_gestor: null, enviada_em: null, updated_at: agora() });
    return { status: 'ok', n: t ? 1 : 0 };
  },
  org_processo_em_uso(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    return { status: 'ok', tarefas: [] };
  },
  org_processos_em_uso(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    return { status: 'ok', tarefas: [] };
  },
  org_salvar_nota(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    const cor = ['amarelo', 'verde', 'rosa', 'azul'].includes(a.p_cor) ? a.p_cor : 'amarelo';
    if (!a.p_id){
      const n = Object.assign(notaPadrao(), { dono: ac.dono, texto: a.p_texto || '', cor, fixada: !!a.p_fixada });
      org.notas.push(n);
      return { status: 'ok', id: n.id };
    }
    const n = org.notas.find(x => x.id === a.p_id && (x.dono || null) === ac.dono);
    if (!n) return erro('Esta nota não existe mais.');
    Object.assign(n, { texto: a.p_texto ?? n.texto, cor, fixada: !!a.p_fixada, updated_at: agora() });
    return { status: 'ok', id: n.id };
  },
  org_titulo_nota(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    const n = org.notas.find(x => x.id === a.p_id && (x.dono || null) === ac.dono);
    if (n){ n.titulo = (a.p_titulo || '').trim(); n.updated_at = agora(); }
    return { status: 'ok' };
  },
  org_excluir_nota(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    org.notas = org.notas.filter(n => !(n.id === a.p_id && (n.dono || null) === ac.dono));
    return { status: 'ok' };
  },
  org_salvar_lembrete(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    if (!a.p_id){
      const l = Object.assign(lembretePadrao(), { dono: ac.dono, texto: a.p_texto || '', data: a.p_data || hojeVara(), hora: a.p_hora || null, processo: a.p_processo || '', feito_em: a.p_feito_em || null });
      org.lembretes.push(l);
      return { status: 'ok', id: l.id };
    }
    const l = org.lembretes.find(x => x.id === a.p_id && (x.dono || null) === ac.dono);
    if (!l) return erro('Este lembrete não existe mais.');
    Object.assign(l, { texto: a.p_texto ?? l.texto, data: a.p_data ?? l.data, hora: a.p_hora ?? null, processo: a.p_processo ?? l.processo, feito_em: a.p_feito_em ?? null, updated_at: agora() });
    return { status: 'ok', id: l.id };
  },
  org_excluir_lembrete(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    org.lembretes = org.lembretes.filter(l => !(l.id === a.p_id && (l.dono || null) === ac.dono));
    return { status: 'ok' };
  },
  org_escolher_bicho(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    if (ac.gestor || !ac.dono) return erro('Só a própria pessoa escolhe o bichinho dela.');
    if (!['gato', 'cachorro', 'raposa', 'leoa'].includes(a.p_tipo)) return erro('Bichinho desconhecido.');
    const total = org.estrelas.filter(e => e.dono === ac.dono).length;
    const vagas = [3, 55, 75, 100].filter(x => total >= x).length;
    if (org.bichos.filter(b => b.dono === ac.dono).length >= vagas) return erro('Ainda faltam estrelas para um novo bichinho.');
    if (!org.bichos.some(b => b.dono === ac.dono && b.tipo === a.p_tipo)) org.bichos.push({ dono: ac.dono, tipo: a.p_tipo, created_at: agora() });
    org.pessoas.find(p => p.id === ac.dono).bicho_quadro = a.p_tipo;
    return { status: 'ok' };
  },
  org_bicho_no_quadro(org, a){
    const ac = acesso(org, a);
    if (ac.st !== 'ok') return { status: ac.st };
    if (ac.gestor || !ac.dono) return erro('Só a própria pessoa muda o bichinho do quadro dela.');
    if (a.p_tipo && !org.bichos.some(b => b.dono === ac.dono && b.tipo === a.p_tipo)) return erro('Esse bichinho ainda não é seu.');
    org.pessoas.find(p => p.id === ac.dono).bicho_quadro = a.p_tipo || '';
    return { status: 'ok' };
  }
};

module.exports = { SupabaseFalso, semearOrg, hojeVara, segundaDe, somaDias, PIN_GESTOR };
