-- =====================================================================
-- Camada tratada do controle de bônus
--
-- Entrada: tabelas do schema raw (cópia das abas do Excel, sem alteração)
-- Saída:   schema trt
--   trt.bonus   1 linha por bônus, com situação, risco e alertas
--   trt.vendas  1 linha por veículo, com bônus e margem recalculados
--
-- As regras seguem o DECISOES.md. O número de cada decisão aparece
-- nos comentários para facilitar a conferência.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS trt;


-- ---------------------------------------------------------------------
-- trt.bonus
-- Granularidade: 1 linha por bônus (chassi + campanha).
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS trt.vendas;
DROP TABLE IF EXISTS trt.bonus;

CREATE TABLE trt.bonus AS
WITH parametros AS (
    SELECT
        DATE '2026-05-05' AS data_referencia,   -- decisão 3: última movimentação da base
        75                AS limite_sem_resposta -- decisão 4: maior tempo de resposta registrado
),

base AS (
    SELECT
        b.chassi,
        b.filial_id,
        f.filial,
        v.marca,
        b.campanha,
        b.tipo_bonus,
        b.status,
        v.data_venda::date                                  AS data_venda,
        b.data_envio::date                                  AS data_envio,
        b.data_recebimento::date                            AS data_recebimento,
        b.valor_recebido                                    AS valor_recebido_original,
        b.flag_envio_fora_prazo,
        c.valor_bonus                                       AS valor_campanha,
        c.prazo_envio_dias,
        -- prazo_envio_dias vem como bigint do Excel; date + bigint não existe no Postgres
        v.data_venda::date + c.prazo_envio_dias::int        AS prazo_limite_envio,
        c.data_inicio::date                                 AS campanha_inicio,
        c.data_fim::date                                    AS campanha_fim,
        c.filial_id_escopo
    FROM raw.controle_bonus b
    JOIN raw.vendas    v ON v.chassi    = b.chassi
    JOIN raw.campanhas c ON c.campanha  = b.campanha
    JOIN raw.filiais   f ON f.filial_id = b.filial_id
),

regras AS (
    SELECT
        base.*,
        p.data_referencia,

        -- Decisão 1: só bônus aprovado conta como recebido
        CASE WHEN status = 'Aprovado' THEN valor_recebido_original ELSE 0 END
                                                            AS valor_recebido,

        -- Decisão 8: tempos do processo, em dias
        data_envio - data_venda                             AS dias_venda_envio,
        CASE WHEN status IN ('Aprovado', 'Recusado')
             THEN data_recebimento - data_envio END         AS dias_envio_resposta,
        CASE WHEN status = 'Enviado'
             THEN p.data_referencia - data_envio END        AS dias_sem_resposta,

        -- Decisão 4: categorias do valor em risco
        CASE
            WHEN status = 'Pendente' AND prazo_limite_envio < p.data_referencia
                THEN 'Não enviado, prazo vencido'
            WHEN status = 'Enviado' AND data_envio IS NULL
                THEN 'Enviado sem data de envio'
            WHEN status = 'Enviado' AND p.data_referencia - data_envio > p.limite_sem_resposta
                THEN 'Sem retorno da montadora'
            WHEN status = 'Aprovado' AND (valor_recebido_original = 0 OR data_recebimento IS NULL)
                THEN 'Aprovado e não pago'
        END                                                 AS categoria_risco,

        -- Decisão 10: alertas de regra da campanha (não mudam a situação)
        (filial_id_escopo <> 'ALL' AND filial_id_escopo <> filial_id)
                                                            AS alerta_fora_escopo,
        (data_venda NOT BETWEEN campanha_inicio AND campanha_fim)
                                                            AS alerta_fora_vigencia,

        -- Inconsistências de preenchimento (seção 2 do DECISOES.md)
        (status = 'Recusado' AND valor_recebido_original > 0)
                                                            AS alerta_recusado_com_valor,
        (status IN ('Aprovado', 'Enviado', 'Recusado') AND data_envio IS NULL)
            OR (status = 'Recusado' AND data_recebimento IS NULL)
                                                            AS alerta_data_faltando
    FROM base
    CROSS JOIN parametros p
)

SELECT
    regras.*,

    -- Situação de cada bônus: as quatro somam o total lançado
    CASE
        WHEN categoria_risco IS NOT NULL THEN 'Em risco'
        WHEN status = 'Aprovado'         THEN 'Recebido'
        WHEN status = 'Recusado'         THEN 'Recusado'
        ELSE 'Em andamento'
    END                                                     AS situacao,

    -- Decisão 5: bônus sem pagamento usa o valor da campanha
    CASE WHEN categoria_risco IS NOT NULL THEN valor_campanha ELSE 0 END
                                                            AS valor_em_risco,
    CASE
        WHEN categoria_risco IS NULL AND status = 'Aprovado' THEN valor_recebido
        ELSE valor_campanha
    END                                                     AS valor_situacao,

    -- Decisão 10: mesmo veículo aprovado duas vezes no mesmo tipo de bônus
    (status = 'Aprovado'
     AND SUM(CASE WHEN status = 'Aprovado' THEN 1 ELSE 0 END)
         OVER (PARTITION BY chassi, tipo_bonus) > 1)        AS alerta_pagamento_duplo
FROM regras;


-- ---------------------------------------------------------------------
-- trt.vendas
-- Granularidade: 1 linha por veículo.
-- O bônus é agregado por chassi antes de juntar com a venda, para a
-- venda não se repetir uma vez por bônus (seção 1 do DECISOES.md).
-- ---------------------------------------------------------------------
CREATE TABLE trt.vendas AS
WITH bonus_por_veiculo AS (
    SELECT
        chassi,
        COUNT(*)            AS qtd_bonus,
        SUM(valor_recebido) AS bonus_recebido,
        SUM(valor_em_risco) AS bonus_em_risco
    FROM trt.bonus
    GROUP BY chassi
)
SELECT
    v.chassi,
    v.filial_id,
    v.filial,
    v.marca,
    v.vendedor,
    v.data_venda::date                                      AS data_venda,
    v.valor_venda,
    v.custo_bruto_aquisicao,
    v.custo_cortesia,
    v.margem_bruta,
    v.margem_liquida_pre_bonus,
    COALESCE(b.qtd_bonus, 0)                                AS qtd_bonus,
    COALESCE(b.bonus_recebido, 0)                           AS bonus_recebido,
    COALESCE(b.bonus_em_risco, 0)                           AS bonus_em_risco,

    -- Decisão 9: margem recalculada, porque a coluna original tem valores corrompidos
    v.margem_liquida_pre_bonus + COALESCE(b.bonus_recebido, 0)
                                                            AS margem_liquida_pos_bonus,

    -- Colunas originais, mantidas só para comparação
    v.total_bonus_recebido                                  AS total_bonus_recebido_original,
    v.margem_liquida_pos_bonus                              AS margem_liquida_pos_bonus_original,
    (v.total_bonus_recebido > 1000000)                      AS alerta_bonus_corrompido,
    (v.margem_liquida_pos_bonus > 10000000)                 AS alerta_margem_corrompida,

    -- Decisão 11
    (v.valor_venda = 50000)                                 AS alerta_venda_50_mil,

    p.nps,
    p.tempo_atendimento_min,
    p.google_rating,
    p.reclame_aqui_score
FROM raw.vendas v
LEFT JOIN bonus_por_veiculo b ON b.chassi = v.chassi
LEFT JOIN raw.pos_venda     p ON p.chassi = v.chassi;
