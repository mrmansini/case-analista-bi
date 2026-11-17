-- =====================================================================
-- Conferência da camada tratada contra a base original
-- Cada linha compara o valor esperado (calculado no raw) com o obtido
-- no trt. A coluna "confere" tem que ser true em todas.
-- =====================================================================

WITH checagens AS (
    SELECT 'Linhas de bônus' AS verificacao,
           (SELECT COUNT(*) FROM raw.controle_bonus)::numeric AS esperado,
           (SELECT COUNT(*) FROM trt.bonus)::numeric          AS obtido
    UNION ALL
    SELECT 'Linhas de vendas',
           (SELECT COUNT(*) FROM raw.vendas),
           (SELECT COUNT(*) FROM trt.vendas)
    UNION ALL
    SELECT 'Recebido (aprovados)',
           (SELECT ROUND(SUM(valor_recebido)::numeric, 2) FROM raw.controle_bonus WHERE status = 'Aprovado'),
           (SELECT ROUND(SUM(valor_recebido)::numeric, 2) FROM trt.bonus)
    UNION ALL
    SELECT 'Bônus somado por veículo = recebido',
           (SELECT ROUND(SUM(valor_recebido)::numeric, 2) FROM trt.bonus),
           (SELECT ROUND(SUM(bonus_recebido)::numeric, 2) FROM trt.vendas)
    UNION ALL
    SELECT 'Valor de venda não duplicou',
           (SELECT ROUND(SUM(valor_venda)::numeric, 2) FROM raw.vendas),
           (SELECT ROUND(SUM(valor_venda)::numeric, 2) FROM trt.vendas)
    UNION ALL
    SELECT 'Flag fora do prazo = regra recalculada',
           (SELECT SUM(flag_envio_fora_prazo) FROM trt.bonus WHERE data_envio IS NOT NULL),
           (SELECT COUNT(*) FROM trt.bonus WHERE data_envio > prazo_limite_envio)
    UNION ALL
    SELECT 'Situações somam o total de bônus',
           (SELECT COUNT(*) FROM trt.bonus),
           (SELECT SUM(qtd) FROM (SELECT situacao, COUNT(*) AS qtd FROM trt.bonus GROUP BY situacao) s)
)
SELECT verificacao, esperado, obtido, esperado = obtido AS confere
FROM checagens;


-- Resumo por situação (tem que bater com a decisão 5 do DECISOES.md)
SELECT
    situacao,
    COUNT(*)                                AS bonus,
    ROUND(SUM(valor_situacao)::numeric, 2)  AS valor
FROM trt.bonus
GROUP BY situacao
ORDER BY valor DESC;


-- Risco por categoria (tem que bater com a decisão 4 do DECISOES.md)
SELECT
    categoria_risco,
    COUNT(*)                                AS bonus,
    ROUND(SUM(valor_em_risco)::numeric, 2)  AS valor_em_risco
FROM trt.bonus
WHERE categoria_risco IS NOT NULL
GROUP BY categoria_risco
ORDER BY valor_em_risco DESC;
