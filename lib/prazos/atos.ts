// Tabela de prazos da vara cível (a mesma do sistema atual).
// un: u = dias úteis, c = corridos, m = meses, a = anos. dir: "antes" = contagem regressiva (audiência).
// sd = prazo próprio (não dobra); eca = prazo do ECA; marco = prazo máximo contado direto da data informada.

export type Unidade = 'u' | 'c' | 'm' | 'a';
export type Ato = {
  g: string; id: string; ato: string; n: number; un: Unidade; art: string; ini: string;
  dir?: 'antes'; sd?: boolean; eca?: boolean; marco?: boolean; rot?: string;
  forma?: 'ciencia'; rotForma?: string; cert?: string; certNome?: string;
};

export const ATOS: Ato[] = [
  {"g": "Respostas e manifestações", "id": "contestacao", "ato": "Contestação (procedimento comum)", "n": 15, "un": "u", "art": "art. 335", "ini": "Da audiência de conciliação (ou da última sessão), do protocolo do pedido de cancelamento da audiência pelo réu ou, se não houver audiência, da forma de citação (art. 231)."},
  {"g": "Respostas e manifestações", "id": "contest_fam", "ato": "Contestação em ação de família", "n": 15, "un": "u", "art": "arts. 335 e 697", "ini": "Da audiência de mediação e conciliação, quando não houver acordo."},
  {"g": "Respostas e manifestações", "id": "replica", "ato": "Réplica", "n": 15, "un": "u", "art": "arts. 350 e 351", "ini": "Da intimação para se manifestar sobre a contestação."},
  {"g": "Respostas e manifestações", "id": "reconv", "ato": "Contestação à reconvenção", "n": 15, "un": "u", "art": "art. 343, § 1º", "ini": "Da intimação do autor, na pessoa do advogado."},
  {"g": "Respostas e manifestações", "id": "emenda", "ato": "Emenda ou complemento da inicial", "n": 15, "un": "u", "art": "art. 321", "ini": "Da intimação do autor."},
  {"g": "Respostas e manifestações", "id": "custas", "ato": "Recolhimento das custas iniciais", "n": 15, "un": "u", "art": "art. 290", "ini": "Da intimação, sob pena de cancelamento da distribuição."},
  {"g": "Respostas e manifestações", "id": "docs", "ato": "Manifestação sobre documentos juntados", "n": 15, "un": "u", "art": "art. 437, § 1º", "ini": "Da intimação."},
  {"g": "Respostas e manifestações", "id": "generico", "ato": "Prazo sem previsão legal nem fixado pelo juiz", "n": 5, "un": "u", "art": "art. 218, § 3º", "ini": "Da intimação."},
  {"g": "Respostas e manifestações", "id": "suspeicao", "ato": "Arguição de impedimento ou suspeição", "n": 15, "un": "u", "art": "art. 146", "ini": "Do conhecimento do fato."},
  {"g": "Respostas e manifestações", "id": "mp_fiscal", "ato": "Ministério Público como fiscal da ordem jurídica", "n": 30, "un": "u", "art": "art. 178", "sd": true, "ini": "Da intimação. Prazo próprio do MP, não dobra."},
  {"g": "Respostas e manifestações", "id": "emb_terc", "ato": "Contestação em embargos de terceiro", "n": 15, "un": "u", "art": "art. 679", "ini": "Da citação."},
  {"g": "Respostas e manifestações", "id": "monit", "ato": "Monitória: pagamento ou embargos", "n": 15, "un": "u", "art": "arts. 701 e 702", "ini": "Da citação (art. 231)."},

  {"g": "Tutelas provisórias", "id": "aditamento", "ato": "Aditamento da inicial (tutela antecipada antecedente)", "n": 15, "un": "u", "art": "art. 303, § 1º, I", "ini": "Da intimação da concessão da tutela, ou prazo maior fixado pelo juiz."},
  {"g": "Tutelas provisórias", "id": "cautelar_cont", "ato": "Contestação em tutela cautelar antecedente", "n": 5, "un": "u", "art": "art. 306", "ini": "Da citação."},
  {"g": "Tutelas provisórias", "id": "cautelar_princ", "ato": "Pedido principal após efetivar a cautelar", "n": 30, "un": "c", "art": "art. 308", "ini": "Da efetivação da tutela cautelar. O STJ considera prazo decadencial, contado em dias corridos."},

  {"g": "Provas e perícia", "id": "quesitos", "ato": "Quesitos e assistente técnico", "n": 15, "un": "u", "art": "art. 465, § 1º", "ini": "Da intimação da nomeação do perito."},
  {"g": "Provas e perícia", "id": "escusa", "ato": "Escusa ou impedimento do perito", "n": 15, "un": "u", "art": "art. 157, § 1º", "ini": "Da intimação, da suspeição ou do impedimento supervenientes."},
  {"g": "Provas e perícia", "id": "laudo_manif", "ato": "Manifestação sobre o laudo", "n": 15, "un": "u", "art": "art. 477, § 1º", "ini": "Da intimação da juntada do laudo."},
  {"g": "Provas e perícia", "id": "saneamento", "ato": "Pedido de esclarecimento ou ajuste do saneamento", "n": 5, "un": "u", "art": "art. 357, § 1º", "ini": "Da intimação da decisão de saneamento."},
  {"g": "Provas e perícia", "id": "rol", "ato": "Rol de testemunhas", "n": 15, "un": "u", "art": "art. 357, § 4º", "ini": "Prazo comum fixado pelo juiz, de até 15 dias. Confira a decisão."},

  {"g": "Audiência de conciliação (CEJUSC)", "id": "cej_design", "ato": "Designar a audiência de conciliação ou mediação", "n": 30, "un": "u", "dir": "antes", "art": "art. 334", "ini": "A audiência deve ser marcada com pelo menos 30 dias de antecedência. O resultado é a data limite do despacho que designa."},
  {"g": "Audiência de conciliação (CEJUSC)", "id": "cit_334", "ato": "Citação antes da audiência de conciliação", "n": 20, "un": "u", "dir": "antes", "art": "art. 334", "ini": "O réu deve ser citado com pelo menos 20 dias de antecedência da audiência."},
  {"g": "Audiência de conciliação (CEJUSC)", "id": "cej_fam", "ato": "Citação antes da mediação em ação de família", "n": 15, "un": "u", "dir": "antes", "art": "art. 695, § 2º", "ini": "O réu deve ser citado com pelo menos 15 dias de antecedência da audiência."},
  {"g": "Audiência de conciliação (CEJUSC)", "id": "desint_334", "ato": "Petição do réu sem interesse na conciliação", "n": 10, "un": "u", "dir": "antes", "art": "art. 334, § 5º", "ini": "Protocolo com 10 dias de antecedência, contados da data da audiência. A audiência só é cancelada se as duas partes não quiserem (art. 334, § 4º, I)."},
  {"g": "Audiência de conciliação (CEJUSC)", "id": "cej_contest", "ato": "Contestação depois da audiência sem acordo", "n": 15, "un": "u", "forma": "ciencia", "rotForma": "Data da audiência (ou da última sessão)", "cert": "realizada a audiência de conciliação sem acordo em", "certNome": "contestação", "art": "art. 335, I", "ini": "Conta da audiência de conciliação ou mediação, ou da última sessão, quando não houver acordo ou uma parte faltar."},
  {"g": "Audiência de conciliação (CEJUSC)", "id": "cej_contest_canc", "ato": "Contestação depois do pedido de cancelamento da audiência", "n": 15, "un": "u", "forma": "ciencia", "rotForma": "Data do protocolo do pedido do réu", "cert": "protocolado pelo réu o pedido de cancelamento da audiência em", "certNome": "contestação", "art": "art. 335, II", "ini": "Conta do protocolo do pedido de cancelamento feito pelo réu, quando as duas partes não querem a audiência."},
  {"g": "Audiência de conciliação (CEJUSC)", "id": "cej_sessoes", "ato": "Novas sessões de conciliação: prazo máximo", "certNome": "realização de novas sessões de conciliação", "n": 2, "un": "m", "marco": true, "rot": "Data da primeira sessão", "art": "art. 334, § 2º", "ini": "As sessões seguintes, quando necessárias para o acordo, não podem passar de 2 meses da primeira."},
  {"g": "Audiência de conciliação (CEJUSC)", "id": "cej_mediacao", "ato": "Conclusão da mediação judicial", "n": 60, "un": "c", "marco": true, "rot": "Data da primeira sessão", "art": "Lei 13.140/2015, art. 28", "ini": "A mediação deve terminar em até 60 dias, salvo se as partes pedirem a prorrogação de comum acordo."},

  {"g": "Antes da audiência de instrução (contagem regressiva)", "id": "laudo_aij", "ato": "Laudo pericial antes da audiência de instrução", "n": 20, "un": "u", "dir": "antes", "art": "art. 477", "ini": "O laudo deve ser protocolado pelo menos 20 dias antes da audiência."},
  {"g": "Antes da audiência de instrução (contagem regressiva)", "id": "ar_test", "ato": "Juntada do AR da intimação da testemunha", "n": 3, "un": "u", "dir": "antes", "art": "art. 455, § 1º", "ini": "O advogado junta a cópia da carta e o AR pelo menos 3 dias antes da audiência."},

  {"g": "Recursos", "id": "apelacao", "ato": "Apelação", "n": 15, "un": "u", "art": "arts. 1.003, § 5º, e 1.009", "ini": "Da intimação da sentença (art. 1.003). Se a sentença for lida em audiência, da própria audiência."},
  {"g": "Recursos", "id": "contrarraz_ap", "ato": "Contrarrazões de apelação", "n": 15, "un": "u", "art": "art. 1.010, § 1º", "ini": "Da intimação do apelado."},
  {"g": "Recursos", "id": "ed", "ato": "Embargos de declaração", "n": 5, "un": "u", "art": "art. 1.023", "ini": "Da intimação da decisão. Interrompem o prazo dos demais recursos (art. 1.026)."},
  {"g": "Recursos", "id": "ed_contra", "ato": "Contrarrazões aos embargos de declaração", "n": 5, "un": "u", "art": "art. 1.023, § 2º", "ini": "Da intimação, quando o acolhimento puder modificar a decisão."},
  {"g": "Recursos", "id": "agravo", "ato": "Agravo de instrumento", "n": 15, "un": "u", "art": "arts. 1.003, § 5º, e 1.015", "ini": "Da intimação da decisão interlocutória."},
  {"g": "Recursos", "id": "agravo_resp", "ato": "Resposta ao agravo de instrumento", "n": 15, "un": "u", "art": "art. 1.019, II", "ini": "Da intimação do agravado."},
  {"g": "Recursos", "id": "agr_interno", "ato": "Agravo interno", "n": 15, "un": "u", "art": "arts. 1.003, § 5º, e 1.021", "ini": "Da intimação da decisão monocrática do relator."},
  {"g": "Recursos", "id": "resp", "ato": "Recurso especial ou extraordinário", "n": 15, "un": "u", "art": "art. 1.003, § 5º", "ini": "Da intimação do acórdão."},

  {"g": "Cumprimento de sentença e execução", "id": "pagto_523", "ato": "Pagamento voluntário (cumprimento de sentença)", "n": 15, "un": "u", "art": "art. 523", "ini": "Da intimação do devedor (art. 513, § 2º). Depois dele, multa de 10% e honorários de 10%."},
  {"g": "Cumprimento de sentença e execução", "id": "impug_525", "ato": "Impugnação ao cumprimento de sentença", "n": 15, "un": "u", "art": "art. 525", "ini": "Começa no dia seguinte ao fim do prazo de pagamento do art. 523, sem nova intimação."},
  {"g": "Cumprimento de sentença e execução", "id": "impug_535", "ato": "Impugnação da Fazenda Pública ao cumprimento", "n": 30, "un": "u", "art": "art. 535", "sd": true, "ini": "Da intimação da Fazenda. Prazo próprio, não dobra."},
  {"g": "Cumprimento de sentença e execução", "id": "alimentos", "ato": "Alimentos: pagar, provar que pagou ou justificar", "n": 3, "un": "u", "art": "arts. 528 e 911", "ini": "Da intimação (cumprimento) ou da citação (execução de título extrajudicial)."},
  {"g": "Cumprimento de sentença e execução", "id": "pagto_829", "ato": "Execução de título extrajudicial: pagamento", "n": 3, "un": "u", "art": "art. 829", "ini": "Da citação. Se pagar em 3 dias, os honorários caem pela metade (art. 827, § 1º)."},
  {"g": "Cumprimento de sentença e execução", "id": "emb_exec", "ato": "Embargos à execução", "n": 15, "un": "u", "art": "art. 915", "sd": true, "ini": "Da juntada do mandado ou do AR da citação (art. 231). Não dobra para litisconsortes (art. 915, § 3º)."},
  {"g": "Cumprimento de sentença e execução", "id": "emb_exec_faz", "ato": "Embargos à execução pela Fazenda Pública", "n": 30, "un": "u", "art": "art. 910", "sd": true, "ini": "Da citação. Prazo próprio, não dobra."},
  {"g": "Cumprimento de sentença e execução", "id": "penhora", "ato": "Impugnação por fato posterior ou à penhora", "n": 15, "un": "u", "art": "arts. 525, § 11, e 917, § 1º", "ini": "Da ciência do fato ou da intimação do ato."},

  {"g": "Inventário", "id": "prim_decl", "ato": "Primeiras declarações", "n": 20, "un": "u", "art": "art. 620", "ini": "Da data em que o inventariante prestou compromisso."},
  {"g": "Inventário", "id": "manif_decl", "ato": "Manifestação sobre as primeiras declarações", "n": 15, "un": "u", "art": "art. 627", "ini": "Da citação ou intimação das partes, prazo comum."},

  {"g": "Infância (ECA): procedimentos", "id": "eca_dpf", "ato": "Resposta na destituição ou suspensão do poder familiar", "n": 10, "un": "c", "eca": true, "art": "ECA, arts. 158 e 169", "ini": "Da citação. Vale também para guarda, tutela e adoção sem o consentimento dos pais (art. 169)."},
  {"g": "Infância (ECA): procedimentos", "id": "eca_arrep", "ato": "Arrependimento após a entrega voluntária", "n": 10, "un": "c", "eca": true, "art": "ECA, art. 166, § 5º", "ini": "Da sentença que extingue o poder familiar."},
  {"g": "Infância (ECA): procedimentos", "id": "eca_hab", "ato": "Manifestação do MP na habilitação para adoção", "n": 5, "un": "c", "eca": true, "art": "ECA, art. 197-B", "ini": "Da vista dos autos ao Ministério Público."},
  {"g": "Infância (ECA): procedimentos", "id": "eca_infadm", "ato": "Defesa em infração administrativa", "n": 10, "un": "c", "eca": true, "art": "ECA, art. 195", "ini": "Da intimação do auto de infração."},
  {"g": "Infância (ECA): procedimentos", "id": "eca_entid", "ato": "Resposta na apuração de irregularidade em entidade", "n": 10, "un": "c", "eca": true, "art": "ECA, art. 192", "ini": "Da citação do dirigente da entidade."},

  {"g": "Infância (ECA): recursos", "id": "eca_apel", "ato": "Apelação (ECA)", "n": 10, "un": "c", "eca": true, "art": "ECA, art. 198, II", "ini": "Da intimação da sentença. Todos os recursos do ECA têm 10 dias, menos os embargos de declaração."},
  {"g": "Infância (ECA): recursos", "id": "eca_agr", "ato": "Agravo de instrumento (ECA)", "n": 10, "un": "c", "eca": true, "art": "ECA, art. 198, II", "ini": "Da intimação da decisão."},
  {"g": "Infância (ECA): recursos", "id": "eca_contra", "ato": "Contrarrazões (ECA)", "n": 10, "un": "c", "eca": true, "art": "ECA, art. 198, II", "ini": "Da intimação do recorrido."},
  {"g": "Infância (ECA): recursos", "id": "eca_ed", "ato": "Embargos de declaração (ECA)", "n": 5, "un": "c", "eca": true, "art": "ECA, art. 198, II; CPC, art. 1.023", "ini": "Da intimação. O prazo é o do CPC, contado em dias corridos."},

  {"g": "Infância (ECA): prazos máximos", "id": "eca_reav", "ato": "Reavaliação da criança ou do adolescente acolhido", "n": 3, "un": "m", "eca": true, "marco": true, "rot": "Data do acolhimento ou da última reavaliação", "art": "ECA, art. 19, § 1º", "ini": "A situação deve ser reavaliada no máximo a cada 3 meses."},
  {"g": "Infância (ECA): prazos máximos", "id": "eca_acolh", "ato": "Permanência máxima no acolhimento", "n": 18, "un": "m", "eca": true, "marco": true, "rot": "Data do acolhimento", "art": "ECA, art. 19, § 2º", "ini": "Salvo necessidade comprovada e fundamentada pelo juiz."},
  {"g": "Infância (ECA): prazos máximos", "id": "eca_famext", "ato": "Busca da família extensa (entrega voluntária)", "n": 90, "un": "c", "eca": true, "marco": true, "rot": "Data do início da busca", "art": "ECA, art. 19-A, § 3º", "ini": "Prorrogável uma vez por igual período."},
  {"g": "Infância (ECA): prazos máximos", "id": "eca_estagio", "ato": "Estágio de convivência na adoção", "n": 90, "un": "c", "eca": true, "marco": true, "rot": "Data do início do estágio", "art": "ECA, art. 46", "ini": "Prazo máximo, prorrogável uma vez por até igual período, por decisão fundamentada."},
  {"g": "Infância (ECA): prazos máximos", "id": "eca_concl_dpf", "ato": "Conclusão da destituição do poder familiar", "n": 120, "un": "c", "eca": true, "marco": true, "rot": "Data do ajuizamento", "art": "ECA, art. 163", "ini": "Prazo máximo para concluir o procedimento."},
  {"g": "Infância (ECA): prazos máximos", "id": "eca_concl_ado", "ato": "Conclusão da ação de adoção", "n": 120, "un": "c", "eca": true, "marco": true, "rot": "Data do ajuizamento", "art": "ECA, art. 47, § 10", "ini": "Prorrogável uma vez por igual período, por decisão fundamentada."},

  {"g": "Infância (ECA): ato infracional", "id": "eca_intprov", "ato": "Internação provisória: prazo máximo", "certNome": "conclusão do procedimento com o adolescente internado provisoriamente", "n": 45, "un": "c", "eca": true, "marco": true, "rot": "Data da internação provisória", "art": "ECA, arts. 108 e 183", "ini": "Prazo improrrogável para concluir o procedimento com o adolescente internado."},
  {"g": "Infância (ECA): ato infracional", "id": "eca_defprev", "ato": "Defesa prévia", "n": 3, "un": "c", "eca": true, "art": "ECA, art. 186, § 3º", "ini": "Da audiência de apresentação."},
  {"g": "Infância (ECA): ato infracional", "id": "eca_reavmse", "ato": "Reavaliação da internação ou semiliberdade", "n": 6, "un": "m", "eca": true, "marco": true, "rot": "Data do início da medida ou da última reavaliação", "art": "ECA, art. 121, § 2º", "ini": "Reavaliação no máximo a cada 6 meses."},
  {"g": "Infância (ECA): ato infracional", "id": "eca_intmax", "ato": "Internação: prazo máximo", "certNome": "cumprimento da internação", "n": 3, "un": "a", "eca": true, "marco": true, "rot": "Data do início da internação", "art": "ECA, art. 121, § 3º", "ini": "A liberação é obrigatória aos 21 anos (art. 121, § 5º). Confira na aba Idade."},

  {"g": "Juizado Especial Cível (Lei 9.099/1995)", "id": "jec_ri", "ato": "Recurso inominado", "n": 10, "un": "u", "art": "Lei 9.099, arts. 12-A e 42", "ini": "Da ciência da sentença."},
  {"g": "Juizado Especial Cível (Lei 9.099/1995)", "id": "jec_contra", "ato": "Contrarrazões ao recurso inominado", "n": 10, "un": "u", "art": "Lei 9.099, art. 42, § 2º", "ini": "Da intimação do recorrido."},
  {"g": "Juizado Especial Cível (Lei 9.099/1995)", "id": "jec_ed", "ato": "Embargos de declaração no Juizado", "n": 5, "un": "u", "art": "Lei 9.099, art. 49", "ini": "Da ciência da decisão."},

  {"g": "Prazos longos", "id": "rescisoria", "ato": "Ação rescisória", "n": 2, "un": "a", "art": "art. 975", "ini": "Do trânsito em julgado da última decisão. Se terminar em dia sem expediente, vai para o primeiro dia útil seguinte (art. 975, § 1º)."}
];

export const ATO_POR_ID: Record<string, Ato> = Object.fromEntries(ATOS.map(a => [a.id, a]));
export const UN_TXT: Record<Unidade, [string, string]> = { u: ['dia útil', 'dias úteis'], c: ['dia corrido', 'dias corridos'], m: ['mês', 'meses'], a: ['ano', 'anos'] };
