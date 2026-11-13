// Painel do Assistente: animação de abrir/fechar no estilo "gênio" do macOS (aproximação: o painel
// sai do botão flutuante e volta para ele, afinando como um funil) e largura ajustável arrastando a
// borda esquerda. Usado pelos dois sistemas: o atual (public/legado.html) e o novo (BotaoAssistente).
// Quem pede menos movimento (prefers-reduced-motion) abre e fecha sem animação.
(function(){
  var CHAVE = 'astLargura', MIN = 360, PASSO = 24;

  function semMovimento(){
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function celular(){ return window.innerWidth <= 600; }
  function maximo(){ return Math.max(MIN, Math.min(Math.round(window.innerWidth * 0.8), window.innerWidth - 80)); }
  function limita(l){ return Math.max(MIN, Math.min(maximo(), Math.round(l))); }

  // Ponto de onde o painel sai (o centro do botão), relativo ao próprio painel
  function origem(gaveta, ponto){
    var r = gaveta.getBoundingClientRect();
    var x = ponto ? ponto.x : window.innerWidth - 44, y = ponto ? ponto.y : window.innerHeight - 44;
    return (x - r.left) + 'px ' + (y - r.top) + 'px';
  }
  // Centro do botão; guarde antes de esconder o botão
  function pontoDo(fab){
    if (!fab) return null;
    var r = fab.getBoundingClientRect();
    if (!r.width) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  var QUADROS = [
    { transform: 'scale(.06, .1)', opacity: 0, clipPath: 'polygon(42% 0%, 58% 0%, 100% 100%, 0% 100%)' },
    { transform: 'scale(.55, .7)', opacity: 1, clipPath: 'polygon(22% 0%, 78% 0%, 100% 100%, 0% 100%)', offset: .45 },
    { transform: 'scale(1, 1)', opacity: 1, clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' }
  ];

  function abrir(gaveta, ponto){
    aplicarLargura(gaveta);
    if (semMovimento() || !gaveta.animate) return;
    gaveta.style.transformOrigin = origem(gaveta, ponto);
    gaveta.animate(QUADROS, { duration: 460, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  }

  // Devolve uma promessa: quem chama esconde o painel quando a animação termina
  function fechar(gaveta, ponto){
    if (semMovimento() || !gaveta.animate || gaveta.hidden) return Promise.resolve();
    gaveta.style.transformOrigin = origem(gaveta, ponto);
    var a = gaveta.animate(QUADROS.slice().reverse().map(function(q, i){
      var c = {}; for (var k in q) c[k] = q[k];
      if (c.offset !== undefined) c.offset = 1 - c.offset;
      return c;
    }), { duration: 420, easing: 'cubic-bezier(.45, 0, .6, 1)', fill: 'forwards' });
    return a.finished.then(function(){ a.cancel(); }, function(){});
  }

  // ---- largura: arrastar a borda esquerda (fica guardada no navegador) ----
  function lerLargura(){ try { var v = Number(localStorage.getItem(CHAVE)); return v > 0 ? v : 0; } catch (e) { return 0; } }
  function gravarLargura(v){ try { if (v) localStorage.setItem(CHAVE, String(v)); else localStorage.removeItem(CHAVE); } catch (e) {} }
  function aplicarLargura(gaveta){
    var v = lerLargura();
    gaveta.style.width = v && !celular() ? limita(v) + 'px' : '';
    var alca = gaveta.querySelector('.ast-alca');
    if (alca){
      var atual = Math.round(gaveta.getBoundingClientRect().width) || 460;
      alca.setAttribute('aria-valuenow', String(atual));
      alca.setAttribute('aria-valuemin', String(MIN));
      alca.setAttribute('aria-valuemax', String(maximo()));
    }
  }
  function mudarLargura(gaveta, l){
    var v = limita(l);
    gaveta.style.width = v + 'px';
    gravarLargura(v);
    var alca = gaveta.querySelector('.ast-alca');
    if (alca) alca.setAttribute('aria-valuenow', String(v));
  }

  // Liga a alça uma vez; devolve uma função que desliga (para o React)
  function ligarAlca(gaveta, alca){
    var arrastando = false;
    function move(e){ if (arrastando) mudarLargura(gaveta, window.innerWidth - e.clientX); }
    function solta(){
      if (!arrastando) return;
      arrastando = false;
      gaveta.classList.remove('ast-arrastando');
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', solta);
      document.removeEventListener('pointercancel', solta);
    }
    function pega(e){
      if (celular() || e.button !== 0) return;
      e.preventDefault();
      arrastando = true;
      // o quadro do Assistente "engoliria" o mouse: fica sem receber cliques enquanto arrasta
      gaveta.classList.add('ast-arrastando');
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', solta);
      document.addEventListener('pointercancel', solta);
    }
    function tecla(e){
      var l = gaveta.getBoundingClientRect().width;
      if (e.key === 'ArrowLeft'){ e.preventDefault(); mudarLargura(gaveta, l + PASSO); }
      else if (e.key === 'ArrowRight'){ e.preventDefault(); mudarLargura(gaveta, l - PASSO); }
      else if (e.key === 'Home'){ e.preventDefault(); padrao(); }
    }
    function padrao(){ gravarLargura(0); gaveta.style.width = ''; aplicarLargura(gaveta); }
    alca.addEventListener('pointerdown', pega);
    alca.addEventListener('keydown', tecla);
    alca.addEventListener('dblclick', padrao);
    return function(){
      solta();
      alca.removeEventListener('pointerdown', pega);
      alca.removeEventListener('keydown', tecla);
      alca.removeEventListener('dblclick', padrao);
    };
  }

  window.AssistenteGaveta = { abrir: abrir, fechar: fechar, pontoDo: pontoDo, ligarAlca: ligarAlca, aplicarLargura: aplicarLargura };
})();
