"""
Carrega as abas do Excel do case no PostgreSQL, sem nenhuma transformação.
Cada aba vira uma tabela no schema raw. O tratamento fica todo em SQL.

A conexão vem da variável de ambiente DATABASE_URL, para a senha não ficar no código.
"""
import os
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

RAIZ = Path(__file__).resolve().parent.parent
EXCEL = RAIZ / "dados" / "controle_de_bonus_case.xlsx"
CONEXAO = os.environ["DATABASE_URL"]

ABAS = {
    "Vendas": "vendas",
    "Campanhas": "campanhas",
    "Controle_de_Bonus": "controle_bonus",
    "Pos_Venda": "pos_venda",
    "dim_filiais": "filiais",
}

engine = create_engine(CONEXAO)

with engine.begin() as con:
    con.execute(text("CREATE SCHEMA IF NOT EXISTS raw"))

for aba, tabela in ABAS.items():
    df = pd.read_excel(EXCEL, sheet_name=aba)
    df = df.dropna(axis=1, how="all")             # remove colunas totalmente vazias
    df.columns = [c.lower() for c in df.columns]  # minúsculas: evita aspas no SQL
    df.to_sql(tabela, engine, schema="raw", if_exists="replace", index=False)
    print(f"raw.{tabela}: {len(df)} linhas, {len(df.columns)} colunas")