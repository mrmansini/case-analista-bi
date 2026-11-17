# Case Analista de BI Jr. | Controle de Bônus

Entrega de Felipe Mansini Rodrigues para o case de Analista de BI Jr. do Grupo Servopa.

- **Parte 1:** dashboard de controle de bônus de montadora, com visão executiva, visão operacional e análises.
- **Parte 2:** correção dos 8 chamados da página de manutenção, com melhorias e CHANGELOG.
- **Explicação:** `Explicacao_Case_BI_Felipe_Mansini.pdf`, com métricas, regras, tratamento dos dados, resultados e recomendações.

## Versão online

- Página inicial da entrega: https://mrmansini.github.io/case-analista-bi/
- Repositório: https://github.com/mrmansini/case-analista-bi

## Como abrir

Não é preciso instalar nada para ver as páginas. Os dados do dashboard já vão prontos na pasta.

| Página | Arquivo |
| --- | --- |
| Entrada, com links para as duas partes e o PDF | `index.html` |
| Dashboard (Parte 1) | `dashboard/index.html` |
| Página corrigida (Parte 2) | `pagina_manutencao/index.html` |

Basta abrir o arquivo no navegador (duplo clique). Testei no Chrome, no computador e no celular. A página também funciona sem internet, porque a biblioteca de gráficos e a fonte ficam dentro da pasta `dashboard`.

## Estrutura

```
├── index.html                          página de entrada, com links para as duas partes
├── favicon.svg, favicon.png            ícone das páginas na aba do navegador
├── .gitignore
├── README.md
├── DECISOES.md                         regras de tratamento e de cada métrica
├── Explicacao_Case_BI_Felipe_Mansini.pdf
├── requirements.txt                    bibliotecas Python usadas nos scripts
├── dados/
│   └── controle_de_bonus_case.xlsx     base original do case, sem alteração
├── scripts/
│   ├── 01_carga.py                     carrega as abas do Excel no PostgreSQL (schema raw)
│   ├── 02_tratamento.sql               monta a camada tratada (schema trt)
│   ├── 03_validacao.sql                confere os totais da camada tratada
│   ├── 04_exportar.py                  gera os dados do dashboard (dashboard/dados.js)
│   └── 05_base_parte2.py               gera o CSV do botão "Baixar base" da Parte 2
├── dashboard/
│   ├── index.html                      estrutura das três abas
│   ├── style.css                       visual e adaptação para celular
│   ├── app.js                          filtros, cálculos, gráficos e tabelas
│   ├── dados.js                        dados tratados (gerado pelo script 04)
│   ├── img/                            logo
│   ├── lib/                            Chart.js 4.5.1 (licença MIT)
│   └── fontes/                         Poppins (licença SIL Open Font)
└── pagina_manutencao/
    ├── index.html, style.css           página corrigida
    ├── tabela.js                       ordenação e destaque da tabela
    ├── base_controle_de_bonus.csv      base para download (gerada pelo script 05)
    ├── CHAMADOS.txt                    chamados originais
    └── CHANGELOG.md                    o que encontrei e o que fiz em cada chamado
```

## Como os dados foram tratados

O Excel original não foi alterado. O caminho dos dados é este:

1. `01_carga.py` copia as 5 abas do Excel para o PostgreSQL, no schema `raw`, sem mudar nenhum valor.
2. `02_tratamento.sql` monta o schema `trt`, com duas tabelas:
   - `trt.bonus`: uma linha por bônus, com a situação (recebido, em risco, recusado ou em andamento), os tempos do processo e os alertas;
   - `trt.vendas`: uma linha por veículo, com o bônus somado por chassi e a margem recalculada.
3. `03_validacao.sql` confere se os totais batem: quantidade de linhas, valor recebido, valor de venda sem duplicar e a soma das situações. Todas as linhas devem voltar com `t` (verdadeiro) na coluna `confere`.
4. `04_exportar.py` lê a camada tratada e grava o `dados.js` que o dashboard usa.
5. `05_base_parte2.py` grava o CSV da Parte 2 direto do Excel, que é a fonte daquela página.

As regras de cada métrica (valor em risco, taxa de recusa, data de referência e as demais) e o tratamento de cada inconsistência estão explicados no `DECISOES.md`.

## Como rodar os scripts

Só é preciso rodar para refazer o tratamento. As páginas já abrem com os dados prontos.

**1. Instalar as bibliotecas** (Python 3.10 ou mais novo)

```bash
pip install -r requirements.txt
```

**2. Informar a conexão com o PostgreSQL**

Usei um banco PostgreSQL no Neon, mas qualquer PostgreSQL serve. A conexão fica numa variável de ambiente, e não no código, para a senha não ir junto com os arquivos.

```bash
export DATABASE_URL="postgresql+psycopg2://usuario:senha@servidor/case_bonus?sslmode=require"
```

No Windows (PowerShell), o comando é `$env:DATABASE_URL="..."`.

**3. Rodar na ordem**, a partir da pasta raiz do projeto

```bash
python scripts/01_carga.py
psql "postgresql://usuario:senha@servidor/case_bonus?sslmode=require" -f scripts/02_tratamento.sql
psql "postgresql://usuario:senha@servidor/case_bonus?sslmode=require" -f scripts/03_validacao.sql
python scripts/04_exportar.py
python scripts/05_base_parte2.py
```

No `psql`, o endereço começa com `postgresql://`, sem o `+psycopg2`. Os scripts SQL também podem ser rodados em qualquer editor de SQL conectado ao banco, como o editor do próprio Neon. Ao rodar o 02 pela primeira vez, aparecem avisos dizendo que as tabelas `trt.bonus` e `trt.vendas` não existem. Isso é esperado: o script apaga as tabelas antes de criar de novo, e na primeira vez ainda não há o que apagar.

## Ferramentas

- **Tratamento:** Python (pandas, SQLAlchemy) e SQL no PostgreSQL (Neon).
- **Dashboard:** HTML, CSS e JavaScript, com gráficos em Chart.js.
- **Parte 2:** HTML, CSS e JavaScript, sem bibliotecas externas.

Os dados do case são fictícios.
