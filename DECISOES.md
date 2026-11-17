# Decisões de tratamento e de métricas

Base usada: `controle_de_bonus_case.xlsx`, carregada sem alteração no PostgreSQL (schema `raw`). Todos os números abaixo saem dessas tabelas.

## 1. Estrutura da base

| Tabela | Linhas | Chave | Uma linha é |
| --- | ---: | --- | --- |
| `raw.vendas` | 3.800 | `chassi` (3.800 distintos) | um veículo vendido |
| `raw.pos_venda` | 3.800 | `chassi` (3.800 distintos) | os indicadores de pós-venda de um veículo |
| `raw.campanhas` | 186 | `campanha` (186 distintos) | uma campanha da montadora |
| `raw.controle_bonus` | 7.053 | `chassi` + `campanha` | um bônus de um veículo em uma campanha |
| `raw.filiais` | 6 | `filial_id` | uma filial |

O controle de bônus liga com vendas e pós-venda pelo `chassi` e com campanhas pela `campanha`. Todos os 7.053 bônus encontram a venda e a campanha correspondentes, nenhum se repete (chassi + campanha é único) e a filial do bônus é sempre a mesma da venda.

Cada veículo tem de 1 a 5 bônus:

| Bônus por veículo | Veículos |
| ---: | ---: |
| 1 | 1.721 |
| 2 | 1.097 |
| 3 | 814 |
| 4 | 144 |
| 5 | 24 |

Por isso, se eu juntar vendas com bônus direto, a venda de um veículo com 3 bônus aparece 3 vezes e qualquer soma de valor de venda ou de margem sai inflada. A regra que segui: agregar os bônus por chassi primeiro e só depois juntar com a venda. Indicadores de bônus são calculados por bônus; indicadores de venda e margem, por veículo.

## 2. Inconsistências e tratamento

Não mexi no Excel. As tabelas `raw` são cópia das abas e o tratamento fica numa camada separada, em SQL.

| # | O que encontrei | Quantidade | O que fiz |
| ---: | --- | ---: | --- |
| 1 | `total_bonus_recebido` (aba Vendas) com valores na ordem de 10^16 | 167 veículos | Descartei a coluna e recalculei (decisão 9) |
| 2 | `margem_liquida_pos_bonus` (aba Vendas) com valores na ordem de 10^16 | 602 veículos | Descartei a coluna e recalculei: margem pré-bônus + bônus aprovado do veículo |
| 3 | `total_bonus_recebido` também soma o valor de bônus recusados | 100 veículos, além dos 167 do item 1 | Recalculei o bônus do veículo só com aprovados |
| 4 | Bônus recusado com valor recebido | 117 bônus, R$ 176.485,29 | Não entra no recebido. Fica marcado para checar se houve estorno ou erro de lançamento |
| 5 | Bônus aprovado sem valor e sem data de recebimento | 52 bônus | Entra no risco como "Aprovado e não pago" |
| 6 | Bônus aprovado sem data de envio, mas com valor recebido | 28 bônus | Conta no recebido e fica fora das médias de tempo |
| 7 | Bônus enviado sem data de envio | 13 bônus | Entra no risco como "Enviado sem data de envio" |
| 8 | Bônus recusado sem data de envio | 4 bônus | Marcado e fora das médias de tempo |
| 9 | Bônus recusado sem data de resposta (`data_recebimento`) | 8 bônus | Marcado e fora das médias de tempo |
| 10 | Bônus lançado em filial fora do escopo da campanha | 870 bônus | Mantido, com alerta |
| 11 | Venda fora da vigência da campanha | 1.316 bônus | Mantido, com alerta |
| 12 | Mesmo veículo com duas aprovações do mesmo tipo de bônus | 100 casos em 99 veículos (200 bônus) | Mantido, com alerta de possível pagamento em dobro, que a montadora pode cobrar de volta |
| 13 | Vendas de exatamente R$ 50.000,00, que é o menor valor da base | 142 veículos | Mantido, com alerta de possível valor padrão de sistema |

Também recalculei a `flag_envio_fora_prazo` pela regra "data de envio maior que data da venda + prazo de envio da campanha". O resultado bateu nos 5.718 bônus com data de envio (3.329 no prazo e 2.389 fora), então usei a flag como está.

Situação dos dados por status:

| Status | Total | Com data de envio | Com data de recebimento | Com valor | Valor recebido |
| --- | ---: | ---: | ---: | ---: | ---: |
| Aprovado | 3.379 | 3.351 | 3.327 | 3.327 | R$ 15.473.000,55 |
| Enviado | 1.713 | 1.700 | 0 | 0 | R$ 0,00 |
| Pendente | 1.290 | 0 | 0 | 0 | R$ 0,00 |
| Recusado | 671 | 667 | 663 | 117 | R$ 176.485,29 |

Enviado e Pendente ainda não tiveram resposta, então é normal não terem valor nem data de recebimento. Nos recusados, tratei `data_recebimento` como a data em que a montadora respondeu.

## 3. Decisões das métricas

### Decisão 1: bônus recebido

Somei `valor_recebido` só dos bônus aprovados: R$ 15.473.000,55. O case pede o valor efetivamente recebido, e só bônus aprovado gera pagamento. Deixei de fora os 117 recusados com valor, porque recusa e pagamento não deveriam aparecer juntos.

### Decisão 2: taxa de recusa

Dividi os recusados pelos bônus que já tiveram resposta (aprovados + recusados): 671 ÷ 4.050 = 16,6%.

Os 3.003 bônus pendentes e enviados ainda podem ser recusados. Se eu dividisse pelo total lançado, a taxa cairia para 9,5% (671 ÷ 7.053) e pareceria que a montadora recusa pouco, quando na verdade boa parte nem foi avaliada.

### Decisão 3: data de referência

Usei 05/05/2026, a última data de recebimento da base. Com a data de hoje, todo bônus aberto pareceria parado há mais tempo só porque a base deixou de ser atualizada.

| Data | Primeira | Última |
| --- | --- | --- |
| Venda | 01/01/2025 | 30/12/2025 |
| Envio | 02/01/2025 | 23/02/2026 |
| Recebimento | 14/01/2025 | 05/05/2026 |

### Decisão 4: valor em risco

Considerei em risco o dinheiro que ainda não entrou e já tem sinal de que pode não entrar. São quatro situações:

| Situação | Critério | Bônus | Valor em risco |
| --- | --- | ---: | ---: |
| Sem retorno da montadora | Enviado há mais de 75 dias na data de referência | 1.697 | R$ 8.076.392,15 |
| Não enviado, prazo vencido | Pendente e com data da venda + prazo da campanha antes da data de referência | 1.290 | R$ 5.788.956,93 |
| Aprovado e não pago | Aprovado, com valor zero e sem data de recebimento | 52 | R$ 282.701,99 |
| Enviado sem data de envio | Enviado com a data de envio vazia | 13 | R$ 61.700,16 |
| Total | | 3.052 | R$ 14.209.751,23 |

O limite de 75 dias vem da própria base. É o maior tempo que a montadora já levou para responder, tanto para aprovar quanto para recusar:

| Status | Bônus | Mínimo | Mediana | 90% em até | Máximo |
| --- | ---: | ---: | ---: | ---: | ---: |
| Aprovado | 3.299 | 5 dias | 40 dias | 69 dias | 75 dias |
| Recusado | 659 | 5 dias | 41 dias | 68 dias | 75 dias |

Os 1.700 enviados com data esperam resposta há pelo menos 71 dias. Metade espera há mais de 294 dias e o mais antigo, há 488. Depois de 75 dias, o bônus passou de qualquer tempo de resposta que a montadora já teve.

Os 1.290 pendentes entram todos porque, na data de referência, o prazo de envio de cada um já tinha vencido e nenhum foi enviado.

Ficaram fora do risco:

- os 671 recusados (R$ 3.201.512,66 em valor de campanha), porque a perda já foi confirmada pela montadora. Eles aparecem separados, como "Recusado";
- 3 enviados com 71 a 75 dias de espera (R$ 19.505,23), que ainda estão dentro do maior prazo de resposta e aparecem como "Em andamento".

### Decisão 5: valor usado no risco

Usei o `valor_bonus` da campanha. Bônus que ainda não foi pago tem `valor_recebido` zero, então o valor esperado é o que a campanha definiu.

Com as decisões 1, 4 e 5, cada bônus cai em uma única situação, e as quatro somam o total lançado:

| Situação | Bônus | Valor | Valor usado |
| --- | ---: | ---: | --- |
| Recebido | 3.327 | R$ 15.473.000,55 | valor recebido |
| Em risco | 3.052 | R$ 14.209.751,23 | valor da campanha |
| Recusado | 671 | R$ 3.201.512,66 | valor da campanha |
| Em andamento | 3 | R$ 19.505,23 | valor da campanha |
| Total lançado | 7.053 | R$ 32.903.769,67 | |

## 4. Decisões complementares

### Decisão 6: envio fora do prazo

Dividi os bônus com `flag_envio_fora_prazo = 1` pelos bônus com data de envio: 2.389 ÷ 5.718 = 41,8%. É a mesma regra da página da plataforma, e a flag já foi conferida.

Essa taxa mede a pontualidade de quem enviou. Os 1.290 pendentes também perderam o prazo, mas não têm data de envio, então não entram aqui. Eles aparecem no valor em risco, como "Não enviado, prazo vencido".

### Decisão 7: período dos filtros

O filtro de período usa a data da venda. O bônus nasce da venda, e a aba Vendas cobre 2025 inteiro. Se eu filtrasse pela data de recebimento, misturaria vendas de meses diferentes e perderia os bônus que nunca foram pagos.

### Decisão 8: tempos do processo

| Indicador | Cálculo | Bônus usados |
| --- | --- | --- |
| Venda até envio | dias entre a data da venda e a data de envio | com data de envio |
| Envio até resposta | dias entre a data de envio e a data de recebimento | aprovados e recusados com as duas datas |
| Espera sem resposta | dias entre a data de envio e a data de referência | enviados com data de envio |

Bônus sem a data necessária ficam fora da média daquele indicador.

### Decisão 9: bônus e margem por veículo

O bônus recebido do veículo é a soma de `valor_recebido` dos bônus aprovados daquele chassi. A margem líquida pós-bônus é a `margem_liquida_pre_bonus` mais esse bônus. Mantive as colunas originais na camada tratada só para comparar.

### Decisão 10: alertas de regra da campanha

Não excluí nem mudei a situação dos bônus fora do escopo de filial, fora da vigência ou com aprovação duplicada. Quem define o status é a montadora: se ela aprovou, o dinheiro entrou. Esses casos ficam marcados para o time operacional revisar.

### Decisão 11: vendas de R$ 50.000,00

Mantive. A margem dessas vendas é coerente com o valor, então não tenho como afirmar que estão erradas. Ficam anotadas para validar na origem.

### Decisão 12: peso do bônus na margem

Para responder quem depende demais do bônus, dividi o bônus recebido pela margem líquida pós-bônus, somando por marca ou por filial. Somo os valores antes de dividir, para um veículo de margem alta não pesar igual a um de margem baixa. O filtro de tipo de bônus não muda esse cálculo, porque a margem é do veículo inteiro.

### Decisão 13: pós-venda e recusa

Para ver se o pós-venda tem relação com a recusa, dividi os veículos em 4 faixas de cada indicador (NPS, tempo de atendimento, nota no Google e nota no Reclame Aqui), com cortes nos quartis da base inteira. Os cortes não mudam com o filtro, assim a mesma faixa sempre quer dizer a mesma coisa. Em cada faixa, a taxa de recusa segue a decisão 2. No tempo de atendimento, a pior faixa é a dos atendimentos mais demorados.

Fiz a comparação de dois jeitos: com todos os bônus do veículo e só com o bônus ligado ao próprio indicador (por exemplo, o bônus de NPS pela faixa de NPS). Com poucos bônus por faixa, diferenças de alguns pontos podem ser acaso, então trato o resultado como uma pista para investigar.
