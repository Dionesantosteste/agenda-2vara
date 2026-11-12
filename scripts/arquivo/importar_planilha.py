#!/usr/bin/env python3
"""Gera o SQL de importação da planilha do arquivo (ARQUIVO LOCALIZAÇÃO DAS CAIXAS) para o Supabase.

Uso:
    pip install openpyxl
    python3 scripts/arquivo/importar_planilha.py planilha.xlsx pasta-de-saida/

Gera pasta-de-saida/arquivo_importacao_1.sql, _2.sql, ... para colar no SQL Editor, NA ORDEM.
Os arquivos gerados têm os dados do arquivo da vara: não coloque no repositório.

Como a planilha está organizada (e o que o script entende):
- Blocos em 5 grupos de colunas (A-D, E-I, J-M, N-Q, R-U). Cada bloco começa com um cabeçalho de
  caixa, como "P.5 F.B CX 1320" (prateleira 5, fileira B, caixa 1320), às vezes dividido em duas
  células ("P.5 F.D" e "CX 1408") ou só "caixa 598" (sem prateleira). Embaixo vêm os processos.
- Processo: código numérico (30208) ou numeração antiga (224/87).
- Cor da célula: vermelho = em outra secretaria; amarelo = para desarquivar.
- "CRI"/"CRIME" no cabeçalho = caixa da série criminal (141-CRI é outra caixa, diferente da 141).
- A mesma caixa anotada em dois cabeçalhos vira uma caixa só, com os dois lugares (pendência).

Segurança da importação: cada parte confere se a anterior já rodou e se nada foi importado antes;
se não, para sem gravar nada (dá para rodar de novo sem duplicar).
"""
import collections
import json
import os
import re
import sys
import uuid

import openpyxl

GRUPOS = {'A': 'ABCD', 'E': 'EFGHI', 'J': 'JKLM', 'N': 'NOPQ', 'R': 'RSTU'}
COR = {'FFFF0000': 1, 'FFFFFF00': 2}           # vermelho: outra secretaria; amarelo: para desarquivar
POR_PARTE = 4000                                # processos por arquivo (o SQL Editor aguenta bem)
POR_INSERT = 500
# anotações que não deu para entender: célula -> o que se sabe em volta dela
CONTEXTO = {
    'B319': 'ao lado de “caixa 1085”: será a prateleira 30?',
    'O366': 'ao lado de “caixa 1099”: será a prateleira 31?',
    'R804': 'dentro da caixa 1031',
    'F994': 'cabeçalho sem número de caixa (prateleira 11)',
    'P1081': 'dentro da caixa 1214',
}


def ler(caminho):
    ws = openpyxl.load_workbook(caminho).active
    atual = {g: None for g in GRUPOS}
    pend = {g: None for g in GRUPOS}
    caixas = collections.OrderedDict()   # nome -> {locais: Counter}
    procs, notas = [], []
    for r in range(1, ws.max_row + 1):
        for g, cs in GRUPOS.items():
            for L in cs:
                c = ws[f'{L}{r}']
                v = c.value
                if v is None or (isinstance(v, str) and not v.strip()):
                    continue
                # numeração antiga: 224/87, 1213/1994 (aceita 02//99 e 10--2001)
                if isinstance(v, str) and re.fullmatch(r'\s*\d{1,6}\s*[/-]+\s*\d{2,4}\s*', v):
                    if atual[g]:
                        procs.append((re.sub(r'\s*[/-]+\s*', '/', v.strip()), atual[g], 0))
                    continue
                if isinstance(v, str) and not v.strip().lstrip('=').isdigit():
                    s = ' '.join(v.split())
                    m = re.search(r'P\.?\s*(\d+)\s*F\.?\s*([A-Z])', s, re.I)
                    cx = re.search(r'(?:CX|caixa)\s*\.?\s*(\d+[\w-]*)', s, re.I)
                    if m and not cx:
                        pend[g] = (int(m.group(1)), m.group(2).upper())
                        continue
                    if cx:
                        loc = (int(m.group(1)), m.group(2).upper()) if m else pend[g]
                        pend[g] = None
                        nome = cx.group(1).upper()
                        if re.search(r'CRI', s, re.I) and 'CRI' not in nome:
                            nome = nome.rstrip('-') + '-CRI'
                        nome = re.sub(r'-CRIME$', '-CRI', nome)
                        caixa = caixas.setdefault(nome, {'locais': collections.Counter()})
                        if loc:
                            caixa['locais'][loc] += 1
                        atual[g] = nome
                        continue
                    notas.append((c.coordinate, s))
                    continue
                if atual[g]:
                    fill = c.fill.fgColor.rgb if c.fill and c.fill.fill_type else None
                    procs.append((str(v).lstrip('=').strip(), atual[g], COR.get(fill, 0)))
    # um processo por (código, caixa)
    vistos, unicos = set(), []
    for cod, cx, sit in procs:
        if (cod, cx) in vistos:
            continue
        vistos.add((cod, cx))
        unicos.append((cod, cx, sit))
    return caixas, unicos, notas


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def gerar(caminho, saida):
    caixas, procs, notas = ler(caminho)
    os.makedirs(saida, exist_ok=True)
    ids = {nome: str(uuid.uuid4()) for nome in caixas}
    sec = str(uuid.uuid4())   # caixa "Não informada" da estante Outra Secretaria
    partes = [procs[i:i + POR_PARTE] for i in range(0, len(procs), POR_PARTE)] or [[]]
    feitos = 0
    arquivos = []
    for n, parte in enumerate(partes, 1):
        linhas = [f'-- Importação do arquivo — parte {n} de {len(partes)}. Rode as partes NA ORDEM.',
                  '-- Se algo estiver fora de ordem ou já importado, a parte para sem gravar nada.', 'begin;', 'do $$ begin']
        if n == 1:
            linhas += ["  if exists (select 1 from arquivo_processos) or exists (select 1 from arquivo_caixas) then",
                       "    raise exception 'O arquivo já tem dados: a importação não foi feita de novo (nada foi gravado).';",
                       '  end if;']
        else:
            linhas += [f'  if (select count(*) from arquivo_processos) <> {feitos} then',
                       f"    raise exception 'Rode antes a parte {n - 1} (ou esta parte já foi rodada). Nada foi gravado.';",
                       '  end if;']
        linhas.append('end $$;')
        if n == 1:
            valores = [f"({q(ids[nome])}, {q(nome)}, {q(json.dumps([list(l) for l, _ in c['locais'].most_common()]))}::jsonb, false)"
                       for nome, c in caixas.items()]
            valores.append(f"({q(sec)}, 'Não informada', '[]'::jsonb, true)")
            for i in range(0, len(valores), POR_INSERT):
                linhas.append('insert into arquivo_caixas (id, nome, locais, secretaria) values\n' + ',\n'.join(valores[i:i + POR_INSERT]) + ';')
            if notas:
                linhas.append('insert into arquivo_notas (celula, texto, contexto) values\n' + ',\n'.join(
                    f'({q(cel)}, {q(txt)}, {q(CONTEXTO.get(cel, ""))})' for cel, txt in notas) + '\non conflict (celula) do nothing;')
        valores = []
        for cod, cx, sit in parte:
            if sit == 1:   # em outra secretaria: fica na caixa da secretaria, lembrando de onde veio
                valores.append(f"({q(cod)}, {q(sec)}, {q(ids[cx])}, 1, 'planilha')")
            else:
                valores.append(f"({q(cod)}, {q(ids[cx])}, null, {sit}, 'planilha')")
        for i in range(0, len(valores), POR_INSERT):
            linhas.append('insert into arquivo_processos (codigo, caixa_id, origem_id, situacao, cadastrado_por) values\n' + ',\n'.join(valores[i:i + POR_INSERT]) + ';')
        feitos += len(parte)
        if n == len(partes):
            linhas.append(f"insert into arquivo_movimentos (texto, quem) values ('Importação da planilha: {feitos} processos em {len(caixas)} caixas', 'planilha');")
        linhas.append('commit;')
        arq = os.path.join(saida, f'arquivo_importacao_{n}.sql')
        with open(arq, 'w', encoding='utf-8') as f:
            f.write('\n'.join(linhas) + '\n')
        arquivos.append(arq)
    resumo = {
        'caixas': len(caixas), 'processos': len(procs),
        'caixas_sem_prateleira': sum(1 for c in caixas.values() if not c['locais']),
        'caixas_em_dois_lugares': sum(1 for c in caixas.values() if len(c['locais']) > 1),
        'em_outra_secretaria': sum(1 for p in procs if p[2] == 1),
        'para_desarquivar': sum(1 for p in procs if p[2] == 2),
        'notas': [n[0] for n in notas], 'arquivos': arquivos,
    }
    print(json.dumps(resumo, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    gerar(sys.argv[1], sys.argv[2])
