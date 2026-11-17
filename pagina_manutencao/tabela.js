// Tabela "Detalhe por filial": destaque das filiais acima do total e
// ordenação ao clicar no cabeçalho.
//
// Os números da página estão no formato brasileiro (1.854 | 9,9% | R$ 4.051.350,76)
// e são convertidos para número antes de comparar.

(function () {
  const tabela = document.querySelector('.tabela');
  if (!tabela) return;

  const corpo = tabela.tBodies[0];
  const total = tabela.tFoot.rows[0];
  const cabecalhos = Array.from(tabela.querySelectorAll('thead th'));

  // Mantém só dígitos, vírgula e sinal; o resto (R$, %, pontos de milhar,
  // a marcação de destaque) sai antes da conversão
  function paraNumero(texto) {
    const limpo = texto.replace(/[^\d,-]/g, '').replace(',', '.');
    return parseFloat(limpo);
  }

  // ---------- Destaque: filial pior que o total da empresa ----------
  // A comparação é feita com a linha de total da própria tabela. Se os
  // números forem atualizados, o destaque acompanha sem mexer neste arquivo.
  cabecalhos.forEach(function (th, indice) {
    if (!th.querySelector('[data-alerta]')) return;

    const referencia = paraNumero(total.cells[indice].textContent);

    Array.from(corpo.rows).forEach(function (linha) {
      const celula = linha.cells[indice];
      if (paraNumero(celula.textContent) > referencia) {
        celula.classList.add('acima-total');
        celula.insertAdjacentHTML(
          'afterbegin',
          '<span aria-hidden="true">▲ </span><span class="leitor">acima do total: </span>'
        );
      }
    });
  });

  // ---------- Ordenação ----------
  function ordenar(indice, tipo) {
    const th = cabecalhos[indice];
    const atual = th.getAttribute('aria-sort');

    // Primeiro clique numa coluna de número ordena do maior para o menor,
    // porque quem abre a tabela costuma procurar a filial com o maior valor.
    let direcao;
    if (atual === 'none') {
      direcao = tipo === 'numero' ? 'descending' : 'ascending';
    } else {
      direcao = atual === 'ascending' ? 'descending' : 'ascending';
    }

    cabecalhos.forEach(function (outro) {
      outro.setAttribute('aria-sort', 'none');
    });
    th.setAttribute('aria-sort', direcao);

    const linhas = Array.from(corpo.rows);
    linhas.sort(function (a, b) {
      const textoA = a.cells[indice].textContent;
      const textoB = b.cells[indice].textContent;
      const comparacao = tipo === 'numero'
        ? paraNumero(textoA) - paraNumero(textoB)
        : textoA.localeCompare(textoB, 'pt-BR');
      return direcao === 'ascending' ? comparacao : -comparacao;
    });

    linhas.forEach(function (linha) {
      corpo.appendChild(linha);
    });
  }

  cabecalhos.forEach(function (th, indice) {
    const botao = th.querySelector('.ordenar');
    if (!botao) return;
    botao.addEventListener('click', function () {
      ordenar(indice, botao.dataset.tipo);
    });
  });
})();
