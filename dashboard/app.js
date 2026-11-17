/* =========================================================
   Controle de Bônus | Dealer Servopa

   Lê window.DADOS (gerado por scripts/04_exportar.py), aplica os
   filtros e desenha as três abas.

    1. Dados e configuração
    2. Formatação
    3. Filtros
    4. Cálculos
    5. Componentes (gráficos, botão de informação, estado vazio)
    6. Visão executiva
    7. Visão operacional
    8. Análises
    9. Abas e inicialização
   ========================================================= */
(function () {
  'use strict';

  // ---------------------------------------------------------
  // 1. Dados e configuração
  // ---------------------------------------------------------
  const BONUS = window.DADOS.bonus;
  const VEICULOS = window.DADOS.veiculos;
  const POR_CHASSI = new Map(VEICULOS.map((v) => [v.chassi, v]));
  const DATA_REFERENCIA = window.DADOS.data_referencia;
  const $ = (id) => document.getElementById(id);

  const CORES = {
    marinho: '#14294b',
    marinhoClaro: '#8a9ab5',
    recebido: '#1f7a55',
    risco: '#c27200',
    recusado: '#b3261e',
    andamento: '#3f6fb0',
  };

  const SITUACOES = [
    { nome: 'Recebido', cor: CORES.recebido, texto: 'aprovados e pagos' },
    { nome: 'Em risco', cor: CORES.risco, texto: 'parados com sinal de perda' },
    { nome: 'Recusado', cor: CORES.recusado, texto: 'perda confirmada' },
    { nome: 'Em andamento', cor: CORES.andamento, texto: 'abertos dentro do prazo' },
  ];

  // Situações do risco, da mais grave à mais leve, com a ação para cada uma
  const RISCOS = [
    { nome: 'Sem retorno da montadora', curto: 'Sem retorno', cor: '#8a5000', fundo: '#f3e3cc', texto: '#5c3500', acao: 'Cobrar a resposta da montadora, começando pelos mais antigos.' },
    { nome: 'Não enviado, prazo vencido', curto: 'Não enviado', cor: '#c27200', fundo: '#fbecd6', texto: '#6b3f00', acao: 'Enviar e negociar exceção de prazo; dar baixa no que não tiver chance.' },
    { nome: 'Aprovado e não pago', curto: 'Não pago', cor: '#e09a2f', fundo: '#fdf1dd', texto: '#6b4500', acao: 'Cobrar o crédito: a montadora já aprovou, é o dinheiro mais rápido.' },
    { nome: 'Enviado sem data de envio', curto: 'Sem data', cor: '#efc77f', fundo: '#fdf6e6', texto: '#6b5200', acao: 'Corrigir o cadastro para conseguir comprovar e cobrar.' },
  ];

  const LIMITE_SEM_RESPOSTA = 75; // decisão 4 do DECISOES.md

  const MESES = [...new Set(BONUS.map((b) => b.mes_venda))].sort();
  const FILIAIS = [...new Set(BONUS.map((b) => b.filial))].sort();
  const MARCAS = [...new Set(BONUS.map((b) => b.marca))].sort();
  const TIPOS = [...new Set(BONUS.map((b) => b.tipo_bonus))].sort();

  // ---------------------------------------------------------
  // 2. Formatação (padrão brasileiro)
  // ---------------------------------------------------------
  const fmtInteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtUmaCasa = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtDuasCasas = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const inteiro = (n) => fmtInteiro.format(n);
  const moeda = (n) => fmtMoeda.format(n);
  const pct = (n) => (Number.isFinite(n) ? fmtUmaCasa.format(n * 100) + '%' : 'sem dados');

  function moedaCurta(n) {
    if (Math.abs(n) >= 1e6) return 'R$ ' + fmtDuasCasas.format(n / 1e6) + ' mi';
    if (Math.abs(n) >= 1e3) return 'R$ ' + fmtInteiro.format(n / 1e3) + ' mil';
    return moeda(n);
  }

  function nomeMes(mes) {
    const [ano, m] = mes.split('-');
    return `${NOMES_MES[Number(m) - 1]}/${ano.slice(2)}`;
  }

  function dataBR(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  function diasEntre(inicio, fim) {
    return Math.round((new Date(fim) - new Date(inicio)) / 86400000);
  }

  function esc(texto) {
    return String(texto).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ---------------------------------------------------------
  // 3. Filtros
  // ---------------------------------------------------------
  function preencherFiltros() {
    const opcoesMes = MESES.map((m) => `<option value="${m}">${nomeMes(m)}</option>`).join('');
    $('filtro-de').innerHTML = opcoesMes;
    $('filtro-ate').innerHTML = opcoesMes;
    $('filtro-de').value = MESES[0];
    $('filtro-ate').value = MESES[MESES.length - 1];

    const opcoes = (lista) => lista.map((v) => `<option value="${esc(v)}">${esc(v.replace('Servopa ', ''))}</option>`).join('');
    $('filtro-filial').insertAdjacentHTML('beforeend', opcoes(FILIAIS));
    $('filtro-marca').insertAdjacentHTML('beforeend', opcoes(MARCAS));
    $('filtro-tipo').insertAdjacentHTML('beforeend', opcoes(TIPOS));
    $('detalhe-situacao').insertAdjacentHTML('beforeend', opcoes(RISCOS.map((r) => r.nome)));
  }

  function lerFiltros() {
    let de = $('filtro-de').value;
    let ate = $('filtro-ate').value;
    // Se o período vier invertido, troca em vez de zerar a tela
    if (de > ate) {
      [de, ate] = [ate, de];
      $('filtro-de').value = de;
      $('filtro-ate').value = ate;
    }
    return {
      de,
      ate,
      filial: $('filtro-filial').value,
      marca: $('filtro-marca').value,
      tipo: $('filtro-tipo').value,
    };
  }

  function filtrar() {
    const f = lerFiltros();
    return BONUS.filter((b) =>
      b.mes_venda >= f.de && b.mes_venda <= f.ate
      && (!f.filial || b.filial === f.filial)
      && (!f.marca || b.marca === f.marca)
      && (!f.tipo || b.tipo_bonus === f.tipo));
  }

  // Margem e pós-venda são do veículo: o filtro de tipo de bônus não se aplica
  function filtrarVeiculos() {
    const f = lerFiltros();
    return VEICULOS.filter((v) =>
      v.mes_venda >= f.de && v.mes_venda <= f.ate
      && (!f.filial || v.filial === f.filial)
      && (!f.marca || v.marca === f.marca));
  }

  // ---------------------------------------------------------
  // 4. Cálculos
  // ---------------------------------------------------------
  const soma = (lista, campo) => lista.reduce((total, item) => total + (item[campo] || 0), 0);
  const media = (valores) => (valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : NaN);

  function agrupar(lista, campo) {
    const grupos = new Map();
    lista.forEach((item) => {
      const chave = item[campo];
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(item);
    });
    return grupos;
  }

  // Indicadores de um conjunto de bônus (regras do DECISOES.md)
  function indicadores(lista) {
    const decididos = lista.filter((b) => b.status === 'Aprovado' || b.status === 'Recusado');
    const recusados = decididos.filter((b) => b.status === 'Recusado');
    const enviados = lista.filter((b) => b.data_envio);
    const emRisco = lista.filter((b) => b.situacao === 'Em risco');
    return {
      qtd: lista.length,
      recebido: soma(lista, 'valor_recebido'),
      qtdRecebido: lista.filter((b) => b.situacao === 'Recebido').length,
      lancado: soma(lista, 'valor_situacao'),
      risco: soma(emRisco, 'valor_em_risco'),
      qtdRisco: emRisco.length,
      riscoPorSituacao: RISCOS.map((r) => soma(emRisco.filter((b) => b.categoria_risco === r.nome), 'valor_em_risco')),
      decididos: decididos.length,
      recusados: recusados.length,
      taxaRecusa: decididos.length ? recusados.length / decididos.length : NaN,
      enviados: enviados.length,
      foraPrazo: soma(enviados, 'flag_envio_fora_prazo'),
      taxaForaPrazo: enviados.length ? soma(enviados, 'flag_envio_fora_prazo') / enviados.length : NaN,
    };
  }

  // ---------------------------------------------------------
  // 5. Componentes
  // ---------------------------------------------------------

  // Botão de informação (i). Abre com mouse, Tab e toque.
  let contadorInfo = 0;
  function criarInfo(span) {
    const id = `info-${++contadorInfo}`;
    const texto = span.dataset.info;
    span.innerHTML = `
      <button type="button" class="info__botao" aria-describedby="${id}" aria-label="O que significa">i</button>
      <span class="info__texto" role="tooltip" id="${id}">${esc(texto)}</span>`;
  }

  function prepararInfos(raiz) {
    raiz.querySelectorAll('.info[data-info]').forEach((span) => {
      if (!span.querySelector('.info__botao')) criarInfo(span);
    });
  }

  function info(texto) {
    return `<span class="info" data-info="${esc(texto)}"></span>`;
  }

  document.addEventListener('click', (evento) => {
    const botao = evento.target.closest('.info__botao');
    document.querySelectorAll('.info--aberto').forEach((aberto) => {
      if (!botao || aberto !== botao.parentElement) aberto.classList.remove('info--aberto');
    });
    if (botao) botao.parentElement.classList.toggle('info--aberto');
  });

  // Antes de abrir, decide o lado: na metade direita da tela, a caixa abre para a esquerda
  function posicionarInfo(evento) {
    const caixa = evento.target.closest && evento.target.closest('.info');
    if (!caixa) return;
    const posicao = caixa.getBoundingClientRect().left;
    caixa.classList.toggle('info--direita', posicao > window.innerWidth / 2);
  }
  document.addEventListener('mouseover', posicionarInfo);
  document.addEventListener('focusin', posicionarInfo);

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      document.querySelectorAll('.info--aberto').forEach((aberto) => aberto.classList.remove('info--aberto'));
    }
  });

  function vazio(alvo, texto) {
    alvo.innerHTML = `<p class="vazio">${esc(texto || 'Nenhum bônus com os filtros escolhidos. Ajuste ou limpe os filtros.')}</p>`;
  }

  // Gráficos (Chart.js). Cada gráfico é criado uma vez e atualizado nos filtros.
  const graficos = {};

  if (window.Chart) {
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#4f5f78';
    Chart.defaults.animation = false;
  }

  function desenharGrafico(id, configuracao, descricao) {
    const canvas = $(id);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', descricao);
    if (!window.Chart) {
      vazio(canvas.parentElement, 'Não foi possível carregar a biblioteca de gráficos. Verifique a conexão com a internet.');
      return;
    }
    if (graficos[id]) {
      graficos[id].data = configuracao.data;
      graficos[id].options = configuracao.options;
      graficos[id].update();
    } else {
      graficos[id] = new Chart(canvas, configuracao);
    }
  }

  // Barras horizontais com uma ou mais séries empilhadas
  function barrasHorizontais(rotulos, series, formatoValor) {
    return {
      type: 'bar',
      data: {
        labels: rotulos,
        datasets: series.map((s) => ({
          label: s.nome,
          data: s.valores,
          backgroundColor: s.cores || s.cor,
          borderRadius: 3,
          barPercentage: 0.75,
        })),
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: series.length > 1, position: 'top', align: 'start', labels: { boxWidth: 10, boxHeight: 10 } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatoValor(ctx.parsed.x)}` } },
        },
        scales: {
          x: { stacked: true, beginAtZero: true, grid: { color: '#edf0f5' }, ticks: { callback: (v) => formatoValor(v, true) } },
          y: { stacked: true, grid: { display: false } },
        },
      },
    };
  }

  const emMilhoes = (v, curto) => (curto ? fmtUmaCasa.format(v / 1e6) : moeda(v));

  // ---------------------------------------------------------
  // 6. Visão executiva
  // ---------------------------------------------------------
  function desenharKpis(ind) {
    const cards = [
      {
        nome: 'Bônus recebido', valor: moedaCurta(ind.recebido), classe: '',
        detalhe: `${inteiro(ind.qtdRecebido)} bônus aprovados e pagos`,
        info: 'Soma do valor recebido dos bônus com status Aprovado. Valores lançados em bônus recusados ficam de fora.',
      },
      {
        nome: 'Valor em risco', valor: moedaCurta(ind.risco), classe: 'kpi--risco',
        detalhe: `${inteiro(ind.qtdRisco)} bônus com sinal de perda`,
        info: `Valor de campanha dos bônus que ainda não viraram dinheiro: enviados há mais de ${LIMITE_SEM_RESPOSTA} dias sem resposta, pendentes com prazo vencido, aprovados não pagos e enviados sem data. Calculado em ${dataBR(DATA_REFERENCIA)}.`,
      },
      {
        nome: 'Taxa de recusa', valor: pct(ind.taxaRecusa), classe: 'kpi--alerta',
        detalhe: `${inteiro(ind.recusados)} de ${inteiro(ind.decididos)} bônus com resposta`,
        info: 'Recusados divididos pelos bônus que já tiveram resposta (aprovados + recusados). Bônus ainda em aberto ficam de fora, porque ainda podem ser recusados.',
      },
      {
        nome: 'Envio fora do prazo', valor: pct(ind.taxaForaPrazo), classe: '',
        detalhe: `${inteiro(ind.foraPrazo)} de ${inteiro(ind.enviados)} bônus enviados`,
        info: 'Bônus enviados depois de data da venda + prazo da campanha, divididos pelos bônus com data de envio. Pendentes não entram aqui: aparecem no valor em risco.',
      },
    ];
    $('kpis').innerHTML = cards.map((c) => `
      <div class="kpi ${c.classe}">
        <p class="kpi__nome">${esc(c.nome)} ${info(c.info)}</p>
        <p class="kpi__valor">${esc(c.valor)}</p>
        <p class="kpi__detalhe">${esc(c.detalhe)}</p>
      </div>`).join('');
  }

  function desenharRegua(lista) {
    const partes = SITUACOES.map((s) => {
      const itens = lista.filter((b) => b.situacao === s.nome);
      return { ...s, valor: soma(itens, 'valor_situacao'), qtd: itens.length };
    });
    const total = partes.reduce((t, p) => t + p.valor, 0);
    $('regua-total').textContent = moeda(total);
    $('regua').setAttribute('aria-label', partes.map((p) => `${p.nome}: ${moedaCurta(p.valor)}`).join('; '));
    $('regua').innerHTML = partes.filter((p) => p.valor > 0)
      .map((p) => `<span style="flex-grow:${p.valor};background:${p.cor}" title="${esc(p.nome)}: ${moeda(p.valor)}"></span>`)
      .join('');
    $('regua-legenda').innerHTML = partes.map((p) => `
      <li style="--cor:${p.cor}">
        ${esc(p.nome)}
        <strong>${esc(moedaCurta(p.valor))}</strong>
        <small>${pct(total ? p.valor / total : NaN)} do lançado, ${inteiro(p.qtd)} bônus ${esc(p.texto)}</small>
      </li>`).join('');
  }

  function desenharRecebidoPorMes(lista) {
    const f = lerFiltros();
    const meses = MESES.filter((m) => m >= f.de && m <= f.ate);
    const grupos = agrupar(lista, 'mes_venda');
    const valores = meses.map((m) => soma(grupos.get(m) || [], 'valor_recebido'));
    desenharGrafico('grafico-mes', {
      type: 'bar',
      data: {
        labels: meses.map(nomeMes),
        datasets: [{ label: 'Recebido', data: valores, backgroundColor: CORES.recebido, borderRadius: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `Recebido: ${moeda(ctx.parsed.y)}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true, grid: { color: '#edf0f5' }, ticks: { callback: (v) => fmtUmaCasa.format(v / 1e6) } },
        },
      },
    }, `Recebido por mês: ${meses.map((m, i) => `${nomeMes(m)} ${moedaCurta(valores[i])}`).join(', ')}`);
  }

  function desenharRecebidoERisco(lista, campo, idGrafico) {
    const linhas = [...agrupar(lista, campo).entries()]
      .map(([chave, itens]) => ({
        nome: chave.replace('Servopa ', ''),
        recebido: soma(itens, 'valor_recebido'),
        risco: soma(itens, 'valor_em_risco'),
      }))
      .sort((a, b) => b.recebido - a.recebido);
    desenharGrafico(idGrafico, barrasHorizontais(
      linhas.map((l) => l.nome),
      [
        { nome: 'Recebido', valores: linhas.map((l) => l.recebido), cor: CORES.recebido },
        { nome: 'Em risco', valores: linhas.map((l) => l.risco), cor: CORES.risco },
      ],
      emMilhoes,
    ), linhas.map((l) => `${l.nome}: recebido ${moedaCurta(l.recebido)}, em risco ${moedaCurta(l.risco)}`).join('; '));
  }

  function desenharListaRisco(ind) {
    if (!ind.risco) return vazio($('lista-risco'), 'Nenhum bônus em risco com os filtros escolhidos.');
    $('lista-risco').innerHTML = RISCOS.map((r, i) => `
      <li>
        <span class="acoes-risco__nome" style="--cor:${r.cor}">${esc(r.nome)}</span>
        <span class="acoes-risco__valor">${esc(moedaCurta(ind.riscoPorSituacao[i]))}</span>
        <span class="acoes-risco__acao">${pct(ind.riscoPorSituacao[i] / ind.risco)} do risco. ${esc(r.acao)}</span>
      </li>`).join('');
  }

  // Frases do card "Ações prioritárias", calculadas sobre os bônus filtrados
  function desenharInsights(lista, ind) {
    const itens = [];

    if (ind.risco > 0) {
      const maior = ind.riscoPorSituacao.indexOf(Math.max(...ind.riscoPorSituacao));
      itens.push({
        titulo: `${pct(ind.riscoPorSituacao[maior] / ind.risco)} do risco é "${RISCOS[maior].nome.toLowerCase()}"`,
        texto: `São ${moedaCurta(ind.riscoPorSituacao[maior])}. ${RISCOS[maior].acao}`,
      });

      const porFilial = [...agrupar(lista, 'filial').entries()]
        .map(([nome, itensFilial]) => ({ nome, risco: soma(itensFilial, 'valor_em_risco') }))
        .sort((a, b) => b.risco - a.risco);
      if (porFilial.length > 1) {
        itens.push({
          titulo: `${porFilial[0].nome.replace('Servopa ', '')} concentra ${pct(porFilial[0].risco / ind.risco)} do risco`,
          texto: `${moedaCurta(porFilial[0].risco)} parados. É a filial para começar a cobrança; o ranking completo está na visão operacional.`,
        });
      }
    }

    const porMarca = [...agrupar(lista, 'marca').entries()]
      .map(([nome, itensMarca]) => ({ nome, ...indicadores(itensMarca) }))
      .filter((m) => m.enviados >= 30)
      .sort((a, b) => b.taxaForaPrazo - a.taxaForaPrazo);
    if (porMarca.length > 1) {
      itens.push({
        titulo: `${porMarca[0].nome} envia ${pct(porMarca[0].taxaForaPrazo)} dos bônus fora do prazo`,
        texto: `A média do filtro é ${pct(ind.taxaForaPrazo)}. Vale rever com o time da marca a rotina de envio.`,
      });
    }

    const naoPago = ind.riscoPorSituacao[2];
    if (naoPago > 0) {
      itens.push({
        titulo: `${moedaCurta(naoPago)} aprovados e ainda não pagos`,
        texto: 'A montadora já aceitou esses bônus. Cobrar o crédito é o dinheiro mais rápido de recuperar.',
      });
    }

    if (!itens.length) return vazio($('insights'));
    $('insights').innerHTML = itens.map((i) => `<li><strong>${esc(i.titulo)}</strong><p>${esc(i.texto)}</p></li>`).join('');
  }

  function desenharExecutiva(lista) {
    const ind = indicadores(lista);
    desenharKpis(ind);
    desenharRegua(lista);
    desenharRecebidoPorMes(lista);
    desenharRecebidoERisco(lista, 'marca', 'grafico-marca');
    desenharRecebidoERisco(lista, 'filial', 'grafico-filial');
    desenharListaRisco(ind);
    desenharInsights(lista, ind);
  }

  // ---------------------------------------------------------
  // 7. Visão operacional
  // ---------------------------------------------------------
  function desenharEtapas(lista, ind) {
    const enviados = lista.filter((b) => b.dias_venda_envio !== null);
    const respondidos = lista.filter((b) => b.dias_envio_resposta !== null);
    const aguardando = lista.filter((b) => b.dias_sem_resposta !== null);
    const etapas = [
      {
        nome: 'Envio fora do prazo',
        valor: pct(ind.taxaForaPrazo),
        detalhe: `${inteiro(ind.foraPrazo)} de ${inteiro(ind.enviados)} bônus enviados passaram do prazo da campanha`,
        info: 'Envio depois de data da venda + prazo da campanha.',
      },
      {
        nome: 'Da venda até o envio',
        valor: enviados.length ? `${inteiro(media(enviados.map((b) => b.dias_venda_envio)))} dias` : 'sem dados',
        detalhe: enviados.length ? `em média, para um prazo médio de ${inteiro(media(enviados.map((b) => b.prazo_envio_dias)))} dias` : '',
        info: 'Dias entre a data da venda e a data de envio do bônus à montadora.',
      },
      {
        nome: 'Do envio até a resposta',
        valor: respondidos.length ? `${inteiro(media(respondidos.map((b) => b.dias_envio_resposta)))} dias` : 'sem dados',
        detalhe: `em média nos respondidos. ${inteiro(aguardando.length)} bônus ainda sem resposta`,
        info: 'Dias entre o envio e a data de recebimento, nos bônus aprovados e recusados.',
      },
    ];
    $('etapas').innerHTML = etapas.map((e) => `
      <div class="etapa">
        <p class="etapa__nome">${esc(e.nome)} ${info(e.info)}</p>
        <p class="etapa__valor">${esc(e.valor)}</p>
        <p class="etapa__detalhe">${esc(e.detalhe)}</p>
      </div>`).join('');
  }

  function desenharForaDoPrazo(lista, ind) {
    const linhas = [...agrupar(lista, 'marca').entries()]
      .map(([nome, itens]) => ({ nome, ...indicadores(itens) }))
      .filter((l) => l.enviados > 0)
      .sort((a, b) => b.taxaForaPrazo - a.taxaForaPrazo);
    $('sub-prazo').textContent = `Média do filtro: ${pct(ind.taxaForaPrazo)}`;
    const config = barrasHorizontais(
      linhas.map((l) => l.nome),
      [{
        nome: 'Fora do prazo',
        valores: linhas.map((l) => l.taxaForaPrazo),
        cores: linhas.map((l) => (l.taxaForaPrazo > ind.taxaForaPrazo ? CORES.marinho : CORES.marinhoClaro)),
      }],
      (v) => pct(v),
    );
    config.options.scales.x.ticks.callback = (v) => `${Math.round(v * 100)}%`;
    desenharGrafico('grafico-prazo', config,
      linhas.map((l) => `${l.nome}: ${pct(l.taxaForaPrazo)}`).join('; '));
  }

  function desenharEspera(lista) {
    const esperas = lista.filter((b) => b.dias_sem_resposta !== null).map((b) => b.dias_sem_resposta);
    const faixas = [
      { nome: `Até ${LIMITE_SEM_RESPOSTA} dias`, de: 0, ate: LIMITE_SEM_RESPOSTA, cor: CORES.andamento },
      { nome: `${LIMITE_SEM_RESPOSTA + 1} a 180 dias`, de: LIMITE_SEM_RESPOSTA + 1, ate: 180, cor: CORES.risco },
      { nome: '181 a 365 dias', de: 181, ate: 365, cor: CORES.risco },
      { nome: 'Mais de 1 ano', de: 366, ate: Infinity, cor: '#8a5000' },
    ].map((f) => ({ ...f, qtd: esperas.filter((d) => d >= f.de && d <= f.ate).length }));

    desenharGrafico('grafico-espera', {
      type: 'bar',
      data: {
        labels: faixas.map((f) => f.nome),
        datasets: [{ label: 'Bônus', data: faixas.map((f) => f.qtd), backgroundColor: faixas.map((f) => f.cor), borderRadius: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${inteiro(ctx.parsed.y)} bônus` } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: '#edf0f5' }, ticks: { callback: (v) => inteiro(v) } },
        },
      },
    }, faixas.map((f) => `${f.nome}: ${inteiro(f.qtd)} bônus`).join('; '));
  }

  // Ordenação das tabelas ao clicar no cabeçalho. Cada tabela guarda a
  // coluna e o sentido escolhidos, que continuam valendo quando os filtros mudam.
  const ordem = {
    ranking: { chave: 'risco', direcao: 'descending' },
    detalhe: { chave: 'valor_em_risco', direcao: 'descending' },
    tipos: { chave: 'recebido', direcao: 'descending' },
    margem: { chave: 'peso', direcao: 'descending' },
  };

  const semValor = (v) => v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v));

  // Valores vazios vão sempre para o fim, nos dois sentidos
  function ordenarLinhas(linhas, tabela) {
    const { chave, direcao } = ordem[tabela];
    return linhas.sort((a, b) => {
      const va = a[chave];
      const vb = b[chave];
      if (semValor(va) || semValor(vb)) return semValor(va) - semValor(vb);
      const comparacao = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR');
      return direcao === 'ascending' ? comparacao : -comparacao;
    });
  }

  // Cabeçalho clicável. "tipo" define o primeiro clique: texto em ordem
  // alfabética, número do maior para o menor.
  function cabecalho(tabela, chave, texto, tipo, classe = '') {
    const { chave: atual, direcao } = ordem[tabela];
    return `<th scope="col" class="${classe}" aria-sort="${atual === chave ? direcao : 'none'}">`
      + `<button type="button" class="ordenar" data-tabela="${tabela}" data-chave="${chave}" data-tipo="${tipo}">${texto}</button></th>`;
  }

  // Ranking de risco por filial, marca ou campanha
  let rankingPor = 'filial';
  const CAMPO_RANKING = { filial: 'filial', marca: 'marca', campanha: 'campanha' };
  const LIMITE_CAMPANHAS = 15;

  function desenharRanking(lista) {
    const campo = CAMPO_RANKING[rankingPor];
    const riscoTotal = soma(lista, 'valor_em_risco');
    let linhas = [...agrupar(lista, campo).entries()]
      .map(([nome, itens]) => ({ nome, itens, ...indicadores(itens) }))
      .filter((l) => l.risco > 0)
      .sort((a, b) => b.risco - a.risco)
      // A posição (#) é sempre a do valor em risco, mesmo com outra ordenação
      .map((l, i) => ({ ...l, posicao: i + 1, participacao: l.risco / riscoTotal }));
    const totalLinhas = linhas.length;
    if (rankingPor === 'campanha') linhas = linhas.slice(0, LIMITE_CAMPANHAS);
    ordenarLinhas(linhas, 'ranking');

    const tabela = $('tabela-ranking');
    if (!linhas.length) return vazio(tabela, 'Nenhum bônus em risco com os filtros escolhidos.');

    const titulo = { filial: 'Filial', marca: 'Marca', campanha: 'Campanha' }[rankingPor];
    const nome = (l) => {
      if (rankingPor !== 'campanha') return esc(l.nome.replace('Servopa ', ''));
      const exemplo = l.itens[0];
      return `${esc(l.nome)}<span class="tabela__sub">${esc(exemplo.marca)}, ${esc(exemplo.tipo_bonus)}</span>`;
    };
    const composicao = (l) => `<span class="composicao" title="${esc(RISCOS.map((r, i) => `${r.nome}: ${moeda(l.riscoPorSituacao[i])}`).join(' | '))}">${
      RISCOS.map((r, i) => (l.riscoPorSituacao[i] > 0 ? `<span style="width:${(l.riscoPorSituacao[i] / l.risco) * 100}%;background:${r.cor}"></span>` : '')).join('')
    }</span>`;

    tabela.innerHTML = `
      ${rankingPor === 'campanha' ? `<caption class="card__sub" style="caption-side:bottom;text-align:left">As ${linhas.length} campanhas com maior risco, de ${totalLinhas} com valor em risco.</caption>` : ''}
      <thead><tr>
        ${cabecalho('ranking', 'posicao', '#', 'texto', 'centro')}
        ${cabecalho('ranking', 'nome', titulo, 'texto')}
        ${cabecalho('ranking', 'risco', 'Valor em risco', 'numero', 'num')}
        ${cabecalho('ranking', 'participacao', '% do risco', 'numero', 'centro')}
        ${cabecalho('ranking', 'qtdRisco', 'Bônus em risco', 'numero', 'centro')}
        <th scope="col" class="centro">Situação do risco</th>
        ${cabecalho('ranking', 'taxaRecusa', 'Recusa', 'numero', 'centro')}
        ${cabecalho('ranking', 'taxaForaPrazo', 'Fora do prazo', 'numero', 'centro')}
      </tr></thead>
      <tbody>${linhas.map((l) => `
        <tr>
          <td class="centro">${l.posicao}</td>
          <th scope="row">${nome(l)}</th>
          <td class="num"><strong>${moeda(l.risco)}</strong></td>
          <td class="centro">${pct(l.participacao)}</td>
          <td class="centro">${inteiro(l.qtdRisco)}</td>
          <td class="centro">${composicao(l)}</td>
          <td class="centro">${pct(l.taxaRecusa)}</td>
          <td class="centro">${pct(l.taxaForaPrazo)}</td>
        </tr>`).join('')}
      </tbody>`;
    $('legenda-ranking').innerHTML = RISCOS.map((r) => `<li style="--cor:${r.cor}">${esc(r.nome)}</li>`).join('');
  }

  // Detalhe: bônus em risco, um a um
  const detalhe = { linhas: [], pagina: 0, porPagina: 20 };

  // Dias desde que o bônus deveria ter andado
  function diasParado(b) {
    if (b.categoria_risco === 'Não enviado, prazo vencido') return diasEntre(b.prazo_limite_envio, DATA_REFERENCIA);
    if (b.categoria_risco === 'Sem retorno da montadora') return b.dias_sem_resposta;
    if (b.categoria_risco === 'Aprovado e não pago' && b.data_envio) return diasEntre(b.data_envio, DATA_REFERENCIA);
    return null;
  }

  function filtrarDetalhe(lista) {
    const busca = $('detalhe-busca').value.trim().toUpperCase();
    const situacao = $('detalhe-situacao').value;
    detalhe.linhas = lista
      .filter((b) => b.situacao === 'Em risco')
      .filter((b) => !situacao || b.categoria_risco === situacao)
      .filter((b) => !busca || b.chassi.toUpperCase().includes(busca) || b.campanha.toUpperCase().includes(busca))
      .map((b) => ({ ...b, parado: diasParado(b), gravidade: RISCOS.findIndex((r) => r.nome === b.categoria_risco) }))
      .sort((a, b) => b.valor_em_risco - a.valor_em_risco || (b.parado || 0) - (a.parado || 0));
    // Ordem padrão acima; a escolhida no cabeçalho vem por cima e mantém a padrão nos empates
    ordenarLinhas(detalhe.linhas, 'detalhe');
    detalhe.pagina = 0;
  }

  function desenharDetalhe() {
    const linhas = detalhe.linhas;
    const tabela = $('tabela-detalhe');
    $('detalhe-total').textContent = `${inteiro(linhas.length)} bônus, ${moeda(soma(linhas, 'valor_em_risco'))}`;
    if (!linhas.length) {
      vazio(tabela, 'Nenhum bônus em risco com essa busca.');
      $('paginacao').innerHTML = '';
      return;
    }
    const inicio = detalhe.pagina * detalhe.porPagina;
    const pagina = linhas.slice(inicio, inicio + detalhe.porPagina);
    // Selo com o nome curto da situação; o nome completo aparece ao passar o mouse
    const selo = (nome) => {
      const r = RISCOS.find((x) => x.nome === nome);
      return `<span class="selo" style="--cor-fundo:${r.fundo};--cor-texto:${r.texto}" title="${esc(r.nome)}">${esc(r.curto)}</span>`;
    };
    tabela.innerHTML = `
      <thead><tr>
        ${cabecalho('detalhe', 'chassi', 'Chassi', 'texto')}
        ${cabecalho('detalhe', 'filial', 'Filial', 'texto')}
        ${cabecalho('detalhe', 'marca', 'Marca', 'texto', 'centro')}
        ${cabecalho('detalhe', 'campanha', 'Campanha', 'texto')}
        ${cabecalho('detalhe', 'gravidade', 'Situação', 'texto', 'centro')}
        ${cabecalho('detalhe', 'data_venda', 'Venda', 'numero', 'centro')}
        ${cabecalho('detalhe', 'prazo_limite_envio', 'Prazo de envio', 'numero', 'centro')}
        ${cabecalho('detalhe', 'data_envio', 'Envio', 'numero', 'centro')}
        ${cabecalho('detalhe', 'parado', 'Dias parado', 'numero', 'centro')}
        ${cabecalho('detalhe', 'valor_em_risco', 'Valor em risco', 'numero', 'num')}
      </tr></thead>
      <tbody>${pagina.map((b) => `
        <tr>
          <td>${esc(b.chassi)}</td>
          <td>${esc(b.filial.replace('Servopa ', ''))}</td>
          <td class="centro">${esc(b.marca)}</td>
          <td>${esc(b.campanha)}<span class="tabela__sub">${esc(b.tipo_bonus)}</span></td>
          <td class="centro">${selo(b.categoria_risco)}</td>
          <td class="centro">${dataBR(b.data_venda)}</td>
          <td class="centro">${dataBR(b.prazo_limite_envio)}</td>
          <td class="centro">${b.data_envio ? dataBR(b.data_envio) : 'sem data'}</td>
          <td class="centro">${b.parado === null ? '' : inteiro(b.parado)}</td>
          <td class="num"><strong>${moeda(b.valor_em_risco)}</strong></td>
        </tr>`).join('')}
      </tbody>`;

    const paginas = Math.ceil(linhas.length / detalhe.porPagina);
    $('paginacao').innerHTML = `
      <button type="button" data-pagina="-1" ${detalhe.pagina === 0 ? 'disabled' : ''}>Anterior</button>
      <span>Página ${detalhe.pagina + 1} de ${paginas}</span>
      <button type="button" data-pagina="1" ${detalhe.pagina >= paginas - 1 ? 'disabled' : ''}>Próxima</button>`;
  }

  // CSV com ";" e BOM, para o Excel em português abrir com acentos e colunas certas
  function baixarCsv() {
    const cabecalho = ['Chassi', 'Filial', 'Marca', 'Campanha', 'Tipo de bônus', 'Status', 'Situação do risco',
      'Data da venda', 'Prazo de envio', 'Data de envio', 'Dias parado', 'Valor em risco'];
    const linhas = detalhe.linhas.map((b) => [
      b.chassi, b.filial, b.marca, b.campanha, b.tipo_bonus, b.status, b.categoria_risco,
      dataBR(b.data_venda), dataBR(b.prazo_limite_envio), dataBR(b.data_envio),
      b.parado === null ? '' : b.parado, fmtDuasCasas.format(b.valor_em_risco),
    ]);
    const texto = [cabecalho, ...linhas]
      .map((linha) => linha.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const arquivo = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(arquivo);
    link.download = `bonus_em_risco_${DATA_REFERENCIA}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  // Alertas de qualidade da base (decisões 10 e 11 do DECISOES.md)
  function desenharAlertas(lista) {
    const tabela = $('tabela-alertas');
    if (!lista.length) return vazio(tabela);
    const veiculosDe = (itens) => new Set(itens.map((b) => b.chassi)).size;
    const venda50mil = new Set(filtrarVeiculos().filter((v) => v.valor_venda === 50000).map((v) => v.chassi));
    const alertas = [
      { nome: 'Mesmo tipo de bônus aprovado duas vezes no veículo', itens: lista.filter((b) => b.alerta_pagamento_duplo),
        motivo: 'A montadora pode cobrar de volta um dos pagamentos.' },
      { nome: 'Bônus recusado com valor recebido', itens: lista.filter((b) => b.alerta_recusado_com_valor),
        motivo: 'Recusa e pagamento juntos: conferir se houve estorno ou erro de lançamento. O valor não entra no recebido.' },
      { nome: 'Filial fora do escopo da campanha', itens: lista.filter((b) => b.alerta_fora_escopo),
        motivo: 'A campanha não vale para essa filial. Pode ser exceção acordada ou lançamento errado.' },
      { nome: 'Venda fora da vigência da campanha', itens: lista.filter((b) => b.alerta_fora_vigencia),
        motivo: 'O veículo foi vendido fora do período da campanha.' },
      { nome: 'Data de envio ou de resposta faltando', itens: lista.filter((b) => b.alerta_data_faltando),
        motivo: 'Sem a data não dá para comprovar o envio nem medir o tempo do processo.' },
      { nome: 'Venda de exatamente R$ 50.000,00', itens: lista.filter((b) => venda50mil.has(b.chassi)),
        motivo: 'É o menor valor da base e se repete muito. Pode ser valor padrão do sistema.' },
    ];
    tabela.innerHTML = `
      <thead><tr>
        <th scope="col">O que conferir</th>
        <th scope="col" class="centro">Bônus</th>
        <th scope="col" class="centro">Veículos</th>
        <th scope="col">Por que importa</th>
      </tr></thead>
      <tbody>${alertas.map((a) => `
        <tr>
          <th scope="row">${esc(a.nome)}</th>
          <td class="centro">${inteiro(a.itens.length)}</td>
          <td class="centro">${inteiro(veiculosDe(a.itens))}</td>
          <td>${esc(a.motivo)}</td>
        </tr>`).join('')}
      </tbody>`;
  }

  function desenharOperacional(lista) {
    const ind = indicadores(lista);
    desenharEtapas(lista, ind);
    desenharForaDoPrazo(lista, ind);
    desenharEspera(lista);
    desenharRanking(lista);
    filtrarDetalhe(lista);
    desenharDetalhe();
    desenharAlertas(lista);
  }

  // ---------------------------------------------------------
  // 8. Análises
  // ---------------------------------------------------------
  function desenharTipos(lista) {
    const linhas = [...agrupar(lista, 'tipo_bonus').entries()]
      .map(([nome, itens]) => ({ nome, ...indicadores(itens) }))
      .map((l) => ({ ...l, retorno: l.recebido / l.lancado }));
    ordenarLinhas(linhas, 'tipos');
    const tabela = $('tabela-tipos');
    if (!linhas.length) return vazio(tabela);
    const maior = Math.max(...linhas.map((l) => l.recebido / l.lancado));
    tabela.innerHTML = `
      <thead><tr>
        ${cabecalho('tipos', 'nome', 'Tipo de bônus', 'texto')}
        ${cabecalho('tipos', 'qtd', 'Bônus lançados', 'numero', 'centro')}
        ${cabecalho('tipos', 'recebido', 'Recebido', 'numero', 'num')}
        ${cabecalho('tipos', 'retorno', 'Retorno', 'numero', 'centro')}
        ${cabecalho('tipos', 'taxaRecusa', 'Taxa de recusa', 'numero', 'centro')}
        ${cabecalho('tipos', 'risco', 'Em risco', 'numero', 'num')}
      </tr></thead>
      <tbody>${linhas.map((l) => {
        const retorno = l.retorno;
        return `
        <tr>
          <th scope="row">${esc(l.nome)}</th>
          <td class="centro">${inteiro(l.qtd)}</td>
          <td class="num"><strong>${moeda(l.recebido)}</strong></td>
          <td class="centro">
            <span class="barra-tabela">
              <span class="barra-tabela__trilho"><span style="width:${(retorno / maior) * 100}%"></span></span>
              <span class="num">${pct(retorno)}</span>
            </span>
          </td>
          <td class="centro">${pct(l.taxaRecusa)}</td>
          <td class="num">${moeda(l.risco)}</td>
        </tr>`;
      }).join('')}
      </tbody>`;
  }

  function desenharCampanhas(lista) {
    const linhas = [...agrupar(lista.filter((b) => b.situacao === 'Recebido'), 'campanha').entries()]
      .map(([nome, itens]) => ({ nome: `${nome} ${itens[0].marca}`, valor: soma(itens, 'valor_recebido') }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
    desenharGrafico('grafico-campanhas', barrasHorizontais(
      linhas.map((l) => l.nome),
      [{ nome: 'Recebido', valores: linhas.map((l) => l.valor), cor: CORES.recebido }],
      (v, curto) => (curto ? inteiro(v / 1e3) : moeda(v)),
    ), linhas.map((l) => `${l.nome}: ${moedaCurta(l.valor)}`).join('; '));
  }

  // Interpola entre dois tons para o mapa de calor
  function tom(t) {
    const de = [238, 242, 248];
    const ate = [20, 41, 75];
    return `rgb(${de.map((v, i) => Math.round(v + (ate[i] - v) * t)).join(',')})`;
  }

  function desenharMapaRecusa(lista) {
    const tabela = $('mapa-recusa');
    const decididos = lista.filter((b) => b.status === 'Aprovado' || b.status === 'Recusado');
    if (!decididos.length) return vazio(tabela);
    const filiais = [...new Set(decididos.map((b) => b.filial))].sort();
    const marcas = [...new Set(decididos.map((b) => b.marca))].sort();

    const taxa = (itens) => ({
      n: itens.length,
      recusados: itens.filter((b) => b.status === 'Recusado').length,
      get valor() { return this.n ? this.recusados / this.n : NaN; },
    });
    const celulas = filiais.map((f) => marcas.map((m) => taxa(decididos.filter((b) => b.filial === f && b.marca === m))));
    const validas = celulas.flat().filter((c) => c.n >= 10).map((c) => c.valor);
    const min = Math.min(...validas);
    const max = Math.max(...validas);

    const celula = (c, total) => {
      if (c.n < 10) return `<td title="Menos de 10 bônus decididos"></td>`;
      const t = max === min ? 0.5 : (c.valor - min) / (max - min);
      const fundo = total ? 'var(--realce)' : tom(0.1 + t * 0.9);
      const cor = !total && t > 0.45 ? '#fff' : 'var(--texto)';
      return `<td class="${total ? 'calor__total' : ''}" style="background:${fundo};color:${cor}" title="${inteiro(c.recusados)} de ${inteiro(c.n)} decididos">${fmtUmaCasa.format(c.valor * 100)}</td>`;
    };

    tabela.innerHTML = `
      <thead><tr>
        <th scope="col"><span class="sr-only">Filial</span></th>
        ${marcas.map((m) => `<th scope="col">${esc(m)}</th>`).join('')}
        <th scope="col">Total</th>
      </tr></thead>
      <tbody>
        ${filiais.map((f, i) => `
          <tr>
            <th scope="row">${esc(f.replace('Servopa ', ''))}</th>
            ${celulas[i].map((c) => celula(c, false)).join('')}
            ${celula(taxa(decididos.filter((b) => b.filial === f)), true)}
          </tr>`).join('')}
        <tr>
          <th scope="row">Total</th>
          ${marcas.map((m) => celula(taxa(decididos.filter((b) => b.marca === m)), true)).join('')}
          ${celula(taxa(decididos), true)}
        </tr>
      </tbody>`;
  }

  // Peso do bônus na margem, por marca ou filial
  let margemPor = 'marca';

  function resumoMargem(nome, itens) {
    const pre = soma(itens, 'margem_pre');
    const bonus = soma(itens, 'bonus_recebido');
    const pos = soma(itens, 'margem_pos');
    const venda = soma(itens, 'valor_venda');
    return {
      nome, qtd: itens.length, pre, bonus, pos,
      margemVendaPre: pre / venda,
      margemVendaPos: pos / venda,
      peso: bonus / pos,
    };
  }

  function desenharMargem(veiculos) {
    const tabela = $('tabela-margem');
    if (!veiculos.length) return vazio(tabela);
    const linhas = [...agrupar(veiculos, margemPor).entries()].map(([nome, itens]) => resumoMargem(nome, itens));
    ordenarLinhas(linhas, 'margem');
    const total = resumoMargem('Total', veiculos);
    const maior = Math.max(...linhas.map((l) => l.peso));
    const titulo = { marca: 'Marca', filial: 'Filial' }[margemPor];
    const peso = (l) => `
      <span class="barra-tabela">
        <span class="barra-tabela__trilho"><span style="width:${(l.peso / maior) * 100}%;background:var(--marinho)"></span></span>
        <span class="num">${pct(l.peso)}</span>
      </span>`;
    const linha = (l, celula) => `
      <tr>
        <${celula} scope="row">${esc(l.nome.replace('Servopa ', ''))}</${celula}>
        <td class="centro">${inteiro(l.qtd)}</td>
        <td class="num">${moeda(l.bonus)}</td>
        <td class="centro">${pct(l.margemVendaPre)}</td>
        <td class="centro">${pct(l.margemVendaPos)}</td>
        <td class="centro">${peso(l)}</td>
      </tr>`;

    tabela.innerHTML = `
      <thead><tr>
        ${cabecalho('margem', 'nome', titulo, 'texto')}
        ${cabecalho('margem', 'qtd', 'Veículos', 'numero', 'centro')}
        ${cabecalho('margem', 'bonus', 'Bônus recebido', 'numero', 'num')}
        ${cabecalho('margem', 'margemVendaPre', 'Margem sem bônus', 'numero', 'centro')}
        ${cabecalho('margem', 'margemVendaPos', 'Margem com bônus', 'numero', 'centro')}
        ${cabecalho('margem', 'peso', 'Peso do bônus na margem', 'numero', 'centro')}
      </tr></thead>
      <tbody>${linhas.map((l) => linha(l, 'th')).join('')}</tbody>
      <tfoot class="tabela__total">${linha(total, 'th')}</tfoot>`;
  }

  // Pós-venda x recusa. As faixas são os quartis do indicador na base
  // inteira, assim o corte não muda quando o filtro muda.
  const INDICADORES_POS_VENDA = [
    { campo: 'nps', nome: 'NPS', tipo: 'Pós Venda NPS', maiorMelhor: true, unidade: '' },
    { campo: 'tempo_atendimento_min', nome: 'Tempo de atendimento', tipo: 'Pós Venda Tempo Atendimento', maiorMelhor: false, unidade: ' min' },
    { campo: 'google_rating', nome: 'Nota no Google', tipo: 'Pós Venda Google', maiorMelhor: true, unidade: '' },
    { campo: 'reclame_aqui_score', nome: 'Nota no Reclame Aqui', tipo: 'Pós Venda Reclame Aqui', maiorMelhor: true, unidade: '' },
  ].map((ind) => {
    const valores = VEICULOS.map((v) => v[ind.campo]).filter((v) => v !== null).sort((a, b) => a - b);
    const cortes = [0.25, 0.5, 0.75].map((q) => valores[Math.floor(valores.length * q)]);
    const faixaDe = (valor) => cortes.filter((c) => valor > c).length; // 0 = menores valores
    const limites = [0, 1, 2, 3].map((f) => {
      const daFaixa = valores.filter((v) => faixaDe(v) === f);
      return [daFaixa[0], daFaixa[daFaixa.length - 1]];
    });
    // Ordem de exibição: da pior para a melhor faixa
    const ordemFaixas = ind.maiorMelhor ? [0, 1, 2, 3] : [3, 2, 1, 0];
    return { ...ind, faixaDe, limites, ordemFaixas };
  });

  // Taxa de recusa de um conjunto de bônus, separada pelas 4 faixas do indicador
  function recusaPorFaixa(ind, bonus) {
    const faixas = [[], [], [], []];
    bonus.forEach((b) => {
      const valor = POR_CHASSI.get(b.chassi)?.[ind.campo];
      if (valor !== null && valor !== undefined) faixas[ind.faixaDe(valor)].push(b);
    });
    const taxa = (f) => (f.length ? f.filter((b) => b.status === 'Recusado').length / f.length : NaN);
    const pior = faixas[ind.ordemFaixas[0]];
    const melhor = faixas[ind.ordemFaixas[3]];
    return {
      pior: taxa(pior), qtdPior: pior.length, limitesPior: ind.limites[ind.ordemFaixas[0]],
      melhor: taxa(melhor), qtdMelhor: melhor.length, limitesMelhor: ind.limites[ind.ordemFaixas[3]],
      diferenca: (taxa(pior) - taxa(melhor)) * 100,
    };
  }

  function desenharPosVenda(lista) {
    const tabela = $('tabela-posvenda');
    const decididos = lista.filter((b) => b.status === 'Aprovado' || b.status === 'Recusado');
    if (!decididos.length) {
      $('nota-posvenda').textContent = '';
      return vazio(tabela);
    }
    const numero = (v) => (Number.isInteger(v) ? inteiro(v) : fmtUmaCasa.format(v));
    const faixa = ([de, ate], unidade) => (de === ate ? numero(de) : `${numero(de)} a ${numero(ate)}`) + unidade;
    const pontos = (d) => (Number.isFinite(d) ? `${d > 0 ? '+' : ''}${fmtUmaCasa.format(d)} p.p.` : 'sem dados');

    tabela.innerHTML = `
      <thead><tr>
        <th scope="col">Bônus</th>
        <th scope="col" class="centro">Recusa na pior faixa</th>
        <th scope="col" class="centro">Recusa na melhor faixa</th>
        <th scope="col" class="centro">Diferença</th>
      </tr></thead>
      <tbody>${INDICADORES_POS_VENDA.map((ind) => {
        const r = recusaPorFaixa(ind, decididos.filter((b) => b.tipo_bonus === ind.tipo));
        return `
        <tr>
          <th scope="row">${esc(ind.tipo)}</th>
          <td class="centro" title="${inteiro(r.qtdPior)} bônus decididos">${pct(r.pior)}<span class="tabela__sub">${esc(ind.nome)} ${faixa(r.limitesPior, ind.unidade)}</span></td>
          <td class="centro" title="${inteiro(r.qtdMelhor)} bônus decididos">${pct(r.melhor)}<span class="tabela__sub">${esc(ind.nome)} ${faixa(r.limitesMelhor, ind.unidade)}</span></td>
          <td class="centro">${pontos(r.diferenca)}</td>
        </tr>`;
      }).join('')}
      </tbody>`;

    // Conferência com todos os bônus do veículo, não só o de pós-venda
    const geral = INDICADORES_POS_VENDA.map((ind) => recusaPorFaixa(ind, decididos).diferenca).filter(Number.isFinite);
    const maior = geral.length ? Math.max(...geral.map(Math.abs)) : NaN;
    $('nota-posvenda').textContent = Number.isFinite(maior)
      ? `Considerando todos os bônus do veículo, a diferença de recusa entre a pior e a melhor faixa fica em até ${fmtUmaCasa.format(maior)} pontos nos quatro indicadores. Com poucos bônus por faixa, diferenças de alguns pontos podem ser acaso.`
      : '';
  }

  function desenharAnalises(lista) {
    desenharTipos(lista);
    desenharCampanhas(lista);
    desenharMapaRecusa(lista);
    desenharMargem(filtrarVeiculos());
    desenharPosVenda(lista);
  }

  // ---------------------------------------------------------
  // 9. Abas e inicialização
  // ---------------------------------------------------------
  const abas = Array.from(document.querySelectorAll('[role="tab"]'));

  function ativarAba(aba, focar) {
    abas.forEach((a) => {
      const ativa = a === aba;
      a.setAttribute('aria-selected', String(ativa));
      a.tabIndex = ativa ? 0 : -1;
      $(a.getAttribute('aria-controls')).hidden = !ativa;
    });
    if (focar) aba.focus();
    // Gráficos criados em aba escondida precisam recalcular o tamanho ao aparecer
    Object.values(graficos).forEach((g) => g.resize());
  }

  abas.forEach((aba, i) => {
    aba.addEventListener('click', () => ativarAba(aba));
    aba.addEventListener('keydown', (evento) => {
      const destino = {
        ArrowRight: abas[(i + 1) % abas.length],
        ArrowLeft: abas[(i - 1 + abas.length) % abas.length],
        Home: abas[0],
        End: abas[abas.length - 1],
      }[evento.key];
      if (destino) {
        evento.preventDefault();
        ativarAba(destino, true);
      }
    });
  });

  function atualizar() {
    const lista = filtrar();
    const veiculos = new Set(lista.map((b) => b.chassi)).size;
    $('filtro-resumo').textContent = `${inteiro(lista.length)} bônus de ${inteiro(veiculos)} veículos`;
    desenharExecutiva(lista);
    desenharOperacional(lista);
    desenharAnalises(lista);
    prepararInfos(document);
  }

  function iniciar() {
    preencherFiltros();
    $('referencia').innerHTML = `Vendas de ${nomeMes(MESES[0])} a ${nomeMes(MESES[MESES.length - 1])}<br>Risco calculado em <strong>${dataBR(DATA_REFERENCIA)}</strong>`;

    ['filtro-de', 'filtro-ate', 'filtro-filial', 'filtro-marca', 'filtro-tipo']
      .forEach((id) => $(id).addEventListener('change', atualizar));

    $('filtro-limpar').addEventListener('click', () => {
      $('filtro-de').value = MESES[0];
      $('filtro-ate').value = MESES[MESES.length - 1];
      ['filtro-filial', 'filtro-marca', 'filtro-tipo'].forEach((id) => { $(id).value = ''; });
      atualizar();
    });

    document.querySelectorAll('[data-ranking]').forEach((botao) => {
      botao.addEventListener('click', () => {
        rankingPor = botao.dataset.ranking;
        document.querySelectorAll('[data-ranking]').forEach((b) => b.setAttribute('aria-pressed', String(b === botao)));
        desenharRanking(filtrar());
      });
    });

    document.querySelectorAll('[data-margem]').forEach((botao) => {
      botao.addEventListener('click', () => {
        margemPor = botao.dataset.margem;
        document.querySelectorAll('[data-margem]').forEach((b) => b.setAttribute('aria-pressed', String(b === botao)));
        desenharMargem(filtrarVeiculos());
      });
    });

    const redesenharDetalhe = () => { filtrarDetalhe(filtrar()); desenharDetalhe(); };
    $('detalhe-busca').addEventListener('input', redesenharDetalhe);
    $('detalhe-situacao').addEventListener('change', redesenharDetalhe);
    $('paginacao').addEventListener('click', (evento) => {
      const botao = evento.target.closest('[data-pagina]');
      if (!botao) return;
      detalhe.pagina += Number(botao.dataset.pagina);
      desenharDetalhe();
    });
    $('baixar-csv').addEventListener('click', baixarCsv);

    // Clique no cabeçalho: mesma coluna inverte o sentido, outra coluna começa
    // pelo sentido do tipo. Depois de redesenhar, o foco volta para o mesmo botão.
    const redesenharTabela = {
      ranking: () => desenharRanking(filtrar()),
      detalhe: () => { ordenarLinhas(detalhe.linhas, 'detalhe'); detalhe.pagina = 0; desenharDetalhe(); },
      tipos: () => desenharTipos(filtrar()),
      margem: () => desenharMargem(filtrarVeiculos()),
    };
    document.addEventListener('click', (evento) => {
      const botao = evento.target.closest('.ordenar');
      if (!botao) return;
      const { tabela, chave, tipo } = botao.dataset;
      const atual = ordem[tabela];
      if (atual.chave === chave) {
        atual.direcao = atual.direcao === 'ascending' ? 'descending' : 'ascending';
      } else {
        atual.chave = chave;
        atual.direcao = tipo === 'texto' ? 'ascending' : 'descending';
      }
      redesenharTabela[tabela]();
      const novo = document.querySelector(`.ordenar[data-tabela="${tabela}"][data-chave="${chave}"]`);
      if (novo) novo.focus();
    });

    atualizar();
  }

  iniciar();
})();
