"""
Gera a base que o link "Baixar base (CSV)" da página da Parte 2 entrega.

Lê a aba Controle_de_Bonus do Excel, que é a fonte dos números da página,
e grava pagina_manutencao/base_controle_de_bonus.csv.

O CSV sai no formato que o Excel em português abre sem ajuste:
separador ";", decimal com vírgula e duas casas, datas em DD/MM/AAAA e
codificação UTF-8 com BOM (para os acentos aparecerem certos).
"""
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
EXCEL = RAIZ / "dados" / "controle_de_bonus_case.xlsx"
DESTINO = RAIZ / "pagina_manutencao" / "base_controle_de_bonus.csv"


def main():
    base = pd.read_excel(EXCEL, sheet_name="Controle_de_Bonus")

    base.to_csv(
        DESTINO,
        sep=";",
        decimal=",",
        float_format="%.2f",
        date_format="%d/%m/%Y",
        index=False,
        encoding="utf-8-sig",
    )

    aprovados = base["Status"] == "Aprovado"
    recebido = base.loc[aprovados, "Valor_recebido"].sum()
    print(f"{len(base)} linhas gravadas em {DESTINO.relative_to(RAIZ)}")
    print(f"Conferência: valor recebido dos aprovados = {recebido:,.2f}")


if __name__ == "__main__":
    main()
