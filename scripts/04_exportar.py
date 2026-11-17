"""
Exporta a camada tratada (trt.bonus e trt.vendas) para o dashboard.

Gera dashboard/dados.js com duas listas:
- bonus: uma linha por bônus (trt.bonus);
- veiculos: uma linha por veículo (trt.vendas), com margem e pós-venda.
A página aplica os filtros no navegador em cima desses dados.

O arquivo é .js, e não .json, para o index.html abrir direto do disco:
o navegador bloqueia a leitura de um .json local sem servidor, mas
carrega um .js normalmente pela tag <script>.

A conexão vem da variável de ambiente DATABASE_URL.
"""
import json
import os
from datetime import date
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "dashboard" / "dados.js"

CONSULTA = """
SELECT
    chassi,
    filial,
    marca,
    campanha,
    tipo_bonus,
    status,
    situacao,
    categoria_risco,
    TO_CHAR(data_venda, 'YYYY-MM')        AS mes_venda,
    data_venda,
    data_envio,
    prazo_limite_envio,
    prazo_envio_dias,
    flag_envio_fora_prazo,
    dias_venda_envio,
    dias_envio_resposta,
    dias_sem_resposta,
    ROUND(valor_recebido::numeric, 2)     AS valor_recebido,
    ROUND(valor_em_risco::numeric, 2)     AS valor_em_risco,
    ROUND(valor_situacao::numeric, 2)     AS valor_situacao,
    alerta_fora_escopo,
    alerta_fora_vigencia,
    alerta_pagamento_duplo,
    alerta_recusado_com_valor,
    alerta_data_faltando,
    data_referencia
FROM trt.bonus
ORDER BY data_venda, chassi, campanha
"""


# Margem e pós-venda ficam por veículo. O bônus já vem somado por chassi
# em trt.vendas, então a venda não se repete uma vez por bônus.
CONSULTA_VEICULOS = """
SELECT
    chassi,
    filial,
    marca,
    TO_CHAR(data_venda, 'YYYY-MM')                  AS mes_venda,
    ROUND(valor_venda::numeric, 2)                  AS valor_venda,
    ROUND(margem_liquida_pre_bonus::numeric, 2)     AS margem_pre,
    ROUND(bonus_recebido::numeric, 2)               AS bonus_recebido,
    ROUND(margem_liquida_pos_bonus::numeric, 2)     AS margem_pos,
    nps,
    tempo_atendimento_min,
    google_rating,
    reclame_aqui_score
FROM trt.vendas
ORDER BY data_venda, chassi
"""


COLUNAS_INTEIRAS = [
    "prazo_envio_dias",
    "flag_envio_fora_prazo",
    "dias_venda_envio",
    "dias_envio_resposta",
    "dias_sem_resposta",
]


def para_json(valor):
    """Converte o que o pandas devolve em algo que o JSON aceita."""
    if valor is None or valor is pd.NA or valor is pd.NaT:
        return None
    if isinstance(valor, float) and pd.isna(valor):
        return None
    if hasattr(valor, "isoformat"):      # datas viram texto AAAA-MM-DD
        return valor.isoformat()[:10]
    if hasattr(valor, "item"):           # tipos do numpy viram tipos do Python
        return valor.item()
    return valor


def main():
    engine = create_engine(os.environ["DATABASE_URL"])
    df = pd.read_sql(CONSULTA, engine)

    # Colunas inteiras com vazios chegam como decimal (12.0); Int64 mantém inteiro e aceita vazio
    df[COLUNAS_INTEIRAS] = df[COLUNAS_INTEIRAS].astype("Int64")

    data_referencia = para_json(df["data_referencia"].iloc[0])
    df = df.drop(columns="data_referencia")

    linhas = [
        {coluna: para_json(valor) for coluna, valor in registro.items()}
        for registro in df.to_dict(orient="records")
    ]

    veiculos_df = pd.read_sql(CONSULTA_VEICULOS, engine)
    veiculos = [
        {coluna: para_json(valor) for coluna, valor in registro.items()}
        for registro in veiculos_df.to_dict(orient="records")
    ]

    dados = {
        "data_referencia": data_referencia,
        "gerado_em": date.today().isoformat(),
        "bonus": linhas,
        "veiculos": veiculos,
    }

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(
        "// Gerado por scripts/04_exportar.py a partir de trt.bonus. Não editar à mão.\n"
        "window.DADOS = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )

    recebido = sum(l["valor_recebido"] for l in linhas)
    risco = sum(l["valor_em_risco"] for l in linhas)
    print(f"{len(linhas)} bônus e {len(veiculos)} veículos exportados para {DESTINO.relative_to(RAIZ)}")
    print(f"Recebido: {recebido:,.2f} | Em risco: {risco:,.2f}")
    print(f"Tamanho: {DESTINO.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
