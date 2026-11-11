/* Status Comenzi - interfata */
(function () {
  'use strict';
  var SC = window.SC, L = SC.L, ST = SC.ST, esc = SC.esc;
  function $(id) { return document.getElementById(id); }

  var RH = 30, CAP = 34;
  var stare = {
    tab: 'comenzi',
    f: { q: '', cl: '', st: {}, neinc: false, colData: 'dl', dela: '', panala: '' },
    sort: { k: 'n', dir: 1 },
    fc: {},                 // filtre pe coloane, ca in Excel: cheie coloana -> Set de valori afisate permise
    lista: [], numarStatus: {}, primaData: true, murdar: false, opriri: [], utilizatori: [], pornit: false
  };

  /* ================= utilitare UI ================= */
  function toast(msg, tip) {
    var d = document.createElement('div');
    d.className = 'toast' + (tip ? ' ' + tip : '');
    d.textContent = msg;
    $('toasturi').appendChild(d);
    setTimeout(function () { d.remove(); }, tip === 'rau' ? 9000 : 4500);
  }
  function arataEroare(e) {
    if (!(e && e.prietenos)) console.error(e);
    toast(e && e.prietenos ? e.message : 'Eroare: ' + (e && e.message ? e.message : e), 'rau');
  }
  /* Fereastra modala. Se inchide doar din butoane sau din X (nu la click in afara).
     butoane: [{t, cls, v, fn(radacina) -> valoare | false (ramane deschisa) | Promise}] */
  function modal(opt) {
    return new Promise(function (rezolva) {
      var fundal = document.createElement('div');
      fundal.className = 'fundal';
      fundal.innerHTML = '<div class="fereastra' + (opt.lat ? ' lata' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="sus"><h3>' + esc(opt.titlu || '') + '</h3><button class="x" aria-label="Închide">×</button></div>' +
        '<div class="mijloc">' + (opt.html || '') + '</div><div class="jos"></div></div>';
      var jos = fundal.querySelector('.jos'), rad = fundal.querySelector('.mijloc'), ocupat = false;
      function inchide(v) { fundal.remove(); rezolva(v); }
      fundal.querySelector('.x').onclick = function () { if (!ocupat) inchide(null); };
      (opt.butoane || [{ t: 'Închide', v: null }]).forEach(function (b) {
        var el = document.createElement('button');
        el.className = 'btn ' + (b.cls || ''); el.textContent = b.t; el.type = 'button';
        el.onclick = function () {
          if (ocupat) return;
          if (!b.fn) return inchide(b.v);
          ocupat = true;
          Promise.resolve().then(function () { return b.fn(rad); }).then(function (r) {
            ocupat = false;
            if (r !== false) inchide(r === undefined ? b.v : r);
          }, function (e) { ocupat = false; arataEroare(e); });
        };
        jos.appendChild(el);
      });
      document.body.appendChild(fundal);
      if (opt.laDeschidere) opt.laDeschidere(rad);
      var primul = rad.querySelector('input:not([readonly]):not([type=checkbox]), select:not(:disabled), textarea:not([readonly])');
      if (primul) primul.focus(); else jos.lastChild.focus();
    });
  }
  function confirma(mesaj, optiuni) {
    optiuni = optiuni || {};
    return modal({
      titlu: optiuni.titlu || 'Confirmare', html: '<pre class="msg">' + esc(mesaj) + '</pre>',
      butoane: [{ t: optiuni.nu || 'Nu', v: false }, { t: optiuni.da || 'Da', v: true, cls: 'pri' }]
    }).then(function (v) { return v === true; });
  }
  function alerta(mesaj, titlu) {
    return modal({ titlu: titlu || 'Status Comenzi', html: '<pre class="msg">' + esc(mesaj) + '</pre>', butoane: [{ t: 'OK', v: true, cls: 'pri' }] });
  }
  function alegeFisier() {
    return new Promise(function (ok) {
      var inp = $('fisier'); inp.value = '';
      inp.onchange = function () { if (inp.files && inp.files[0]) ok(inp.files[0]); };
      inp.click();
    });
  }
  function citesteFisier(f) { return f.arrayBuffer().then(function (b) { return L.citesteExcel(new Uint8Array(b)); }); }
  function poate() { var u = SC.store.user; return !!u && (u.rol === 'admin' || u.rol === 'operator'); }
  function eAdmin() { var u = SC.store.user; return !!u && u.rol === 'admin'; }
  function rol() { return SC.store.user ? SC.store.user.rol : ''; }
  /* Administrator + Operator date: tot ce tine de comenzi, adrese, importuri (poate()).
     Incarcari: doar confirmarea incarcarii.  Transport: doar Nr AUTO. */
  function poateIncarca() { return rol() === 'admin' || rol() === 'incarcari'; }
  function nCom(n) { return n === 1 ? '1 comandă' : n + ' comenzi'; }
  function stampila() { var d = new Date(); return SC.p2(d.getDate()) + '.' + SC.p2(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + SC.oraAcum(); }

  /* ================= autentificare ================= */
  var modBootstrap = false, listaNume = [];
  function arataLogin(mesaj) {
    opresteTot();
    $('aplicatie').classList.add('ascuns'); $('ecranLogin').classList.remove('ascuns');
    $('loginEroare').textContent = mesaj || ''; $('loginPin').value = '';
    $('loginText').textContent = 'Se încarcă…';
    SC.store.citesteNume().then(function (r) {
      modBootstrap = !r.setup; listaNume = r.lista || [];
      $('campNumeSel').classList.toggle('ascuns', modBootstrap);
      $('campNumeNou').classList.toggle('ascuns', !modBootstrap);
      if (modBootstrap) {
        $('loginText').textContent = 'Prima pornire: creează contul de administrator (numele tău și un PIN de 6 cifre).';
        $('loginBtn').textContent = 'Creează administratorul';
      } else {
        $('loginText').textContent = SC.store.mod === 'demo' ? 'Mod demonstrație — datele rămân doar în acest browser.' : 'Alege numele și introdu PIN-ul.';
        $('loginBtn').textContent = 'Intră';
        var sel = $('loginNume'), vechi = null;
        try { vechi = localStorage.getItem('sc-ultimul-nume'); } catch (e) { /* ignor */ }
        sel.innerHTML = listaNume.slice().sort(function (a, b) { return a.n.localeCompare(b.n, 'ro'); }).map(function (x) {
          return '<option value="' + esc(x.e) + '"' + (x.n === vechi ? ' selected' : '') + '>' + esc(x.n) + '</option>';
        }).join('');
      }
    }, function (e) {
      $('loginText').textContent = '';
      $('loginEroare').textContent = 'Nu pot citi lista de utilizatori (' + (e.message || e) + '). Verifică regulile Firestore și conexiunea.';
    });
  }
  $('formLogin').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var pin = $('loginPin').value.trim(), p;
    $('loginEroare').textContent = '';
    if (!/^\d{6}$/.test(pin)) { $('loginEroare').textContent = 'PIN-ul are exact 6 cifre.'; return; }
    $('loginBtn').disabled = true;
    if (modBootstrap) {
      var nume = $('loginNumeNou').value.trim();
      if (nume.length < 2) { $('loginEroare').textContent = 'Scrie numele.'; $('loginBtn').disabled = false; return; }
      p = SC.store.bootstrap(nume, pin);
    } else {
      var sel = $('loginNume');
      try { localStorage.setItem('sc-ultimul-nume', sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : ''); } catch (e) { /* ignor */ }
      p = SC.store.login(sel.value, pin);
    }
    p.then(function () { $('loginBtn').disabled = false; }, function (e) {
      $('loginBtn').disabled = false;
      $('loginEroare').textContent = e && e.prietenos ? e.message : 'Autentificare eșuată: ' + (e && e.message ? e.message : e);
    });
  });
  SC.onAuth = function (user, mesaj) { if (user) porneste(); else arataLogin(mesaj); };
  SC.onEroareSync = function (e) {
    $('sync').classList.add('rau'); $('syncText').textContent = 'eroare de sincronizare';
    var b = $('banda'); b.className = 'rau'; b.textContent = e && e.message ? e.message : String(e);
  };

  /* ================= pornire / urmarire ================= */
  function opresteTot() {
    stare.opriri.forEach(function (f) { try { f(); } catch (e) { /* ignor */ } });
    stare.opriri = []; stare.pornit = false;
    L.golesteCache();
  }
  function urmaresteComenzile() {
    var prag = Date.now() - SC.ZILE_RECENTE * 86400000;
    stare.opriri.push(SC.store.urmaresteComenzi(prag, function (lista) {
      L.aplicaGrupe(lista);
      marcheazaSync();
      redeseneaza();
      if (stare.primaData && SC.comenzi.length) { stare.primaData = false; stare.laFinal = true; }
      mergiLaFinal();
    }));
  }
  function mergiLaFinal() {
    if (!stare.laFinal || stare.tab !== 'comenzi') return;
    stare.laFinal = false;
    var t = $('tabel'); t.scrollTop = t.scrollHeight; deseneazaRanduri();
  }
  function porneste() {
    if (stare.pornit) return;
    stare.pornit = true; stare.primaData = true;
    var u = SC.store.user;
    $('ecranLogin').classList.add('ascuns'); $('aplicatie').classList.remove('ascuns');
    $('cine').textContent = u.nume + ' · ' + (SC.ROLURI[u.rol] || u.rol);
    $('tabAdmin').classList.toggle('ascuns', !eAdmin());
    var doarInc = u.rol === 'incarcari';
    document.querySelector('.tab[data-tab=comenzi]').classList.toggle('ascuns', doarInc);
    document.querySelector('.tab[data-tab=adrese]').classList.toggle('ascuns', doarInc);
    Array.prototype.forEach.call(document.querySelectorAll('.doarEdit'), function (el) { el.classList.toggle('ascuns', !poate()); });
    var b = $('banda');
    if (SC.store.mod === 'demo') { b.className = ''; b.textContent = 'Mod demonstrație: datele se păstrează doar în acest browser. Pentru lucrul în echipă completează config.js cu proiectul Firebase.'; }
    else b.className = 'ascuns';
    deseneazaCap();
    stare.opriri.push(SC.store.urmaresteDoc('meta', 'config', function (d) {
      SC.config = Object.assign({}, SC.CONFIG_IMPLICIT, d || {});
      umpleClienti();
      if (stare.tab === 'admin') deseneazaAdmin();
    }));
    stare.opriri.push(SC.store.urmaresteColectie('adrese', function (docs) {
      L.seteazaAdrese(docs);
      if (stare.tab === 'adrese') deseneazaAdrese();
    }));
    stare.opriri.push(SC.store.urmaresteDela('extra', SC.ziPlus(SC.azi(), -(SC.ZILE_EXTRA + 7)), function (docs) {
      L.seteazaExtra(docs);
      if (stare.tab === 'incarcari') deseneazaIncarcari();
      if (stare.tab === 'kpi') deseneazaKpi();
    }));
    if (eAdmin()) {
      stare.opriri.push(SC.store.urmaresteColectie('utilizatori', function (docs) {
        stare.utilizatori = docs;
        if (stare.tab === 'admin') deseneazaAdmin();
      }));
    }
    urmaresteComenzile();
    arataTab(doarInc ? 'incarcari' : 'comenzi');
  }
  function marcheazaSync() {
    $('sync').classList.remove('rau');
    $('syncText').textContent = 'actualizat ' + SC.oraAcum();
    if (SC.store.mod !== 'demo') $('banda').className = 'ascuns';
  }
  function umpleClienti() {
    var opt = SC.config.clienti.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    var v1 = $('fClient').value, v2 = $('adrClient').value;
    $('fClient').innerHTML = '<option value="">Toți clienții</option>' + opt; $('fClient').value = v1;
    $('adrClient').innerHTML = '<option value="">Toți clienții</option>' + opt; $('adrClient').value = v2;
  }
  function arataTab(t) {
    stare.tab = t;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) { b.classList.toggle('activ', b.dataset.tab === t); });
    ['comenzi', 'incarcari', 'kpi', 'adrese', 'admin'].forEach(function (x) { $('pag-' + x).classList.toggle('ascuns', x !== t); });
    if (t === 'comenzi') { redeseneaza(); mergiLaFinal(); }
    else if (t === 'incarcari') deseneazaIncarcari();
    else if (t === 'kpi') deseneazaKpi();
    else if (t === 'adrese') deseneazaAdrese();
    else if (t === 'admin') deseneazaAdmin();
  }
  $('taburi').addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b) arataTab(b.dataset.tab); });
  $('btnIesire').onclick = function () { SC.store.logout(); };
  $('btnPin').onclick = function () {
    modal({
      titlu: 'Schimbă PIN', html: '<label class="camp"><span>PIN nou (6 cifre)</span><input type="password" id="pinNou" inputmode="numeric" maxlength="6"></label>',
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Salvează', cls: 'pri', fn: function (r) {
          var p = r.querySelector('#pinNou').value.trim();
          if (!/^\d{6}$/.test(p)) { toast('PIN-ul are exact 6 cifre.', 'rau'); return false; }
          return SC.store.schimbaPin(p).then(function () { toast('PIN schimbat.', 'bun'); });
        }
      }]
    });
  };

  /* ================= COMENZI: lista ================= */
  function fan(o) {
    if (!o._h) {
      o._h = SC.normText([o.n, o.cl, o.nc, o.cc, o.de, o.ad, o.or, o.ju, o.na, o.nt, o.ob, o.co, o.im].join(' '));
    }
    return o._h;
  }
  var GOALE = '(Goale)';
  function valAfisata(o, c) { var v = SC.fmtCelula(o, c); return v === '' ? GOALE : v; }
  /* filtrele de sus (cautare, client, date, neincarcate) */
  function treceSus(o, cuv) {
    var f = stare.f;
    if (f.cl && o.cl !== f.cl) return false;
    if (f.neinc && !(o.st === ST.TER && o.inc !== 'DA')) return false;
    if (f.dela || f.panala) {
      var v = o[f.colData] || '';
      if (!v || (f.dela && v < f.dela) || (f.panala && v > f.panala)) return false;
    }
    if (cuv.length) { var h = fan(o); for (var i = 0; i < cuv.length; i++) if (h.indexOf(cuv[i]) < 0) return false; }
    return true;
  }
  /* filtrele de pe coloane; exceptCol = coloana al carei filtru se ignora (pentru lista de valori a acelei coloane) */
  function treceColoane(o, exceptCol) {
    for (var k in stare.fc) {
      if (k === exceptCol) continue;
      if (!stare.fc[k].has(valAfisata(o, SC.COL[k]))) return false;
    }
    return true;
  }
  function calculeazaLista() {
    var f = stare.f, cuv = SC.normText(f.q).split(' ').filter(Boolean), num = {}, areSt = Object.keys(f.st).length > 0;
    var baza = SC.comenzi.filter(function (o) {
      if (!treceSus(o, cuv) || !treceColoane(o, null)) return false;
      num[o.st] = (num[o.st] || 0) + 1;
      return true;
    });
    stare.numarStatus = num;
    var l = areSt ? baza.filter(function (o) { return f.st[o.st]; }) : baza;
    var k = stare.sort.k, dir = stare.sort.dir;
    if (!(k === 'n' && dir === 1)) {
      l = l.slice().sort(function (a, b) {
        var x = a[k], y = b[k];
        if (x == null || x === '') return (y == null || y === '') ? a.n - b.n : 1;
        if (y == null || y === '') return -1;
        var r = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y), 'ro', { numeric: true });
        return (r || (a.n - b.n)) * dir;
      });
    }
    stare.lista = l;
  }
  function deseneazaCap() {
    var cols = SC.COLS, latime = 0;
    $('cap').innerHTML = cols.map(function (c) {
      latime += c.w;
      var s = stare.sort.k === c.k ? (stare.sort.dir === 1 ? ' ▲' : ' ▼') : '';
      return '<div data-k="' + c.k + '"><span class="et" title="Sortează după ' + esc(c.t) + '">' + esc(c.t) + s + '</span>' +
        '<button type="button" class="fb' + (stare.fc[c.k] ? ' activ' : '') + '" data-f="' + c.k + '" aria-label="Filtru pe coloana ' + esc(c.t) + '" title="Filtrează ' + esc(c.t) + '">▾</button></div>';
    }).join('');
    $('tabel').style.setProperty('--cols', cols.map(function (c) { return c.w + 'px'; }).join(' '));
    $('tabel').style.setProperty('--latime', latime + 'px');
  }
  function deseneazaCipuri() {
    var f = stare.f;
    $('fStatus').innerHTML = SC.STATUSURI.map(function (s) {
      return '<button class="cip' + (f.st[s] ? ' activ' : '') + '" data-st="' + esc(s) + '">' + esc(s) + '<b>' + (stare.numarStatus[s] || 0) + '</b></button>';
    }).join('');
  }
  function optiuniStatus(st) {
    var l = SC.STATUSURI.slice();
    if (st && l.indexOf(st) < 0) l.unshift(st);
    return l.map(function (s) { return '<option' + (s === st ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
  }
  function randHtml(o, i) {
    var cls = 'rand', edit = poate();
    if (o.st === ST.ANU) cls += ' anulata'; else if (o.st === ST.SELF) cls += ' selfpick';
    else if (SC.esteEDI(o) && SC.esteDeschisa(o)) cls += ' edi';
    var h = '<div class="' + cls + '" data-n="' + o.n + '" style="top:' + (i * RH) + 'px">';
    for (var j = 0; j < SC.COLS.length; j++) {
      var c = SC.COLS[j], v = SC.fmtCelula(o, c), cc = '';
      if (c.typ === 'num' || c.typ === 'int') cc = 'nr';
      if (c.k === 'st') {
        cc = o.st === ST.LUC ? 'st-lucru' : (o.st === ST.TER ? 'st-term' : '');
        h += '<div class="' + cc + '">' + (edit ? '<select class="stSel" aria-label="Status comanda ' + esc(o.nc) + '">' + optiuniStatus(o.st) + '</select>' : esc(v)) + '</div>';
        continue;
      }
      if (c.k === 'im' && SC.esteEDI(o)) cc = 'imp-edi';
      if (c.k === 'ju' && o.jd) cc = 'jd';
      if (c.k === 'inc' && o.inc === 'DA') cc = 'da';
      if (c.k === 'na' && rol() === 'transport' && o.inc !== 'DA') cc = 'ed';
      var titlu = (c.typ === 'txt' && v.length > 14) ? ' title="' + esc(v) + '"' : '';
      /* comenzi mai vechi la care paletii reali nu sunt FPP + Pick: semnalate, se corecteaza din FPP / Pick */
      if (c.k === 'pr' && SC.esteNum(o.fpp) && SC.esteNum(o.pk) && SC.esteNum(o.pr) && o.fpp + o.pk !== o.pr) {
        cc += ' nepotrivit'; titlu = ' title="FPP ' + o.fpp + ' + Pick ' + o.pk + ' = ' + (o.fpp + o.pk) + ', dar paleți reali = ' + o.pr + '. Apasă pe FPP sau Pick și salvează."';
      }
      h += '<div' + (cc ? ' class="' + cc + '"' : '') + (c.k === 'na' || c.k === 'fpp' || c.k === 'pk' || c.k === 'am' ? ' data-k="' + c.k + '"' : '') + titlu + '>' + esc(v) + '</div>';
    }
    return h + '</div>';
  }
  function deseneazaRanduri() {
    var cont = $('tabel'), corp = $('corp'), N = stare.lista.length;
    corp.style.height = (N * RH) + 'px';
    var sus = cont.scrollTop - CAP;
    var prim = Math.max(0, Math.floor(sus / RH) - 12), ultim = Math.min(N, prim + Math.ceil(cont.clientHeight / RH) + 26);
    var h = '';
    for (var i = prim; i < ultim; i++) h += randHtml(stare.lista[i], i);
    corp.innerHTML = h;
    var gol = $('gol');
    gol.classList.toggle('ascuns', N > 0);
    if (!N) {
      gol.textContent = SC.comenzi.length ? 'Nicio comandă nu corespunde filtrelor.' :
        'Nu există comenzi încărcate. Adaugă o comandă, importă un borderou sau (administrator) fă migrarea din Excel.';
    }
  }
  function redeseneaza() {
    if (stare.tab === 'incarcari') { deseneazaIncarcari(); }
    if (stare.tab === 'kpi') { deseneazaKpi(); }
    if (stare.tab !== 'comenzi') return;
    var a = document.activeElement;
    if (a && a.classList && a.classList.contains('stSel')) { stare.murdar = true; return; }
    stare.murdar = false;
    calculeazaLista(); deseneazaCipuri(); deseneazaRanduri();
    var tot = SC.comenzi.length;
    var nf = Object.keys(stare.fc).length;
    $('numarare').textContent = (stare.lista.length === tot ? tot + ' comenzi' : stare.lista.length + ' din ' + tot + ' comenzi încărcate') +
      (nf ? ' · ' + nf + (nf === 1 ? ' filtru pe coloană' : ' filtre pe coloane') : '');
  }
  var rafCerut = false;
  $('tabel').addEventListener('scroll', function () {
    if (rafCerut) return;
    rafCerut = true;
    requestAnimationFrame(function () {
      rafCerut = false;
      var a = document.activeElement;
      if (a && a.classList && a.classList.contains('stSel')) return;
      deseneazaRanduri();
    });
  });
  window.addEventListener('resize', function () { if (stare.pornit && stare.tab === 'comenzi') deseneazaRanduri(); });
  $('cap').addEventListener('click', function (e) {
    var fb = e.target.closest('.fb');
    if (fb) { deschideFiltru(fb.dataset.f, fb); return; }
    var d = e.target.closest('[data-k]'); if (!d) return;
    if (stare.sort.k === d.dataset.k) stare.sort.dir = -stare.sort.dir; else stare.sort = { k: d.dataset.k, dir: 1 };
    deseneazaCap(); redeseneaza();
  });
  $('corp').addEventListener('change', function (e) {
    var s = e.target.closest('.stSel'); if (!s) return;
    var o = SC.dupaNr[+s.closest('.rand').dataset.n];
    s.blur();
    if (o) schimbaStatus(o, s.value).catch(arataEroare).then(function () { stare.murdar = false; redeseneaza(); });
  });
  $('corp').addEventListener('focusout', function () { setTimeout(function () { if (stare.murdar) redeseneaza(); }, 0); });
  $('corp').addEventListener('click', function (e) {
    if (e.target.closest('.stSel')) return;
    var r = e.target.closest('.rand'); if (!r) return;
    var o = SC.dupaNr[+r.dataset.n]; if (!o) return;
    if (rol() === 'transport' && e.target.closest('[data-k=na]')) editeazaNrAuto(o);
    else if (poate() && o.st !== ST.ANU && e.target.closest('[data-k=fpp],[data-k=pk]')) editeazaFppPick(o);
    else if (poate() && (o.st === ST.TER || o.st === ST.SELF) && e.target.closest('[data-k=am]')) editeazaAmprente(o);
    else deschideComanda(o);
  });

  /* ---- filtru pe coloana, ca in Excel: sortare, cautare in valori, bife ---- */
  var popFiltru = null;
  function inchideFiltru() {
    if (!popFiltru) return;
    popFiltru.remove(); popFiltru = null;
    document.removeEventListener('pointerdown', afaraFiltru, true);
    document.removeEventListener('keydown', tastaFiltru, true);
  }
  function afaraFiltru(e) { if (popFiltru && !popFiltru.contains(e.target) && !e.target.closest('.fb')) inchideFiltru(); }
  function tastaFiltru(e) { if (e.key === 'Escape') inchideFiltru(); }
  function deschideFiltru(k, buton) {
    var eraAcelasi = popFiltru && popFiltru.dataset.k === k;
    inchideFiltru();
    if (eraAcelasi) return;
    var c = SC.COL[k], cuvSus = SC.normText(stare.f.q).split(' ').filter(Boolean), areSt = Object.keys(stare.f.st).length > 0;
    var numeric = c.typ === 'num' || c.typ === 'int', cuOrdine = numeric || c.typ === 'date' || c.typ === 'dt';
    /* valorile distincte, tinand cont de toate celelalte filtre (ca in Excel) */
    var harta = new Map();
    SC.comenzi.forEach(function (o) {
      if (!treceSus(o, cuvSus) || !treceColoane(o, k) || (areSt && k !== 'st' && !stare.f.st[o.st])) return;
      var d = valAfisata(o, c), x = harta.get(d);
      if (x) x.n++; else harta.set(d, { d: d, r: o[k], n: 1, h: SC.normText(d) });
    });
    var vals = Array.from(harta.values()).sort(function (a, b) {
      if (a.d === GOALE) return 1; if (b.d === GOALE) return -1;
      if (typeof a.r === 'number' && typeof b.r === 'number') return a.r - b.r;
      return String(a.r).localeCompare(String(b.r), 'ro', { numeric: true });
    });
    var activ = stare.fc[k], sel = new Set();
    vals.forEach(function (v) { if (!activ || activ.has(v.d)) sel.add(v.d); });
    var MAX = 400, cautare = '';

    var p = document.createElement('div');
    p.className = 'popfiltru'; p.dataset.k = k;
    p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Filtru pe coloana ' + c.t);
    p.innerHTML = '<div class="pf-titlu">' + esc(c.t) + '</div>' +
      '<div class="pf-sort"><button type="button" class="btn mic" data-s="1">' + (cuOrdine ? 'Sortează crescător' : 'Sortează A → Z') + '</button>' +
      '<button type="button" class="btn mic" data-s="-1">' + (cuOrdine ? 'Sortează descrescător' : 'Sortează Z → A') + '</button></div>' +
      '<input type="search" class="pf-cauta" placeholder="Caută în ' + esc(c.t) + '…" aria-label="Caută în valorile coloanei">' +
      '<label class="bifa pf-tot"><input type="checkbox"> <span>(Selectează tot)</span></label>' +
      '<div class="pf-lista"></div><div class="mic pf-nota"></div>' +
      '<div class="pf-jos"><button type="button" class="btn mic" data-a="sterge"' + (activ ? '' : ' disabled') + '>Șterge filtrul</button><span style="flex:1"></span>' +
      '<button type="button" class="btn mic" data-a="renunta">Renunță</button><button type="button" class="btn mic pri" data-a="ok">OK</button></div>';
    var lista = p.querySelector('.pf-lista'), tot = p.querySelector('.pf-tot input'), nota = p.querySelector('.pf-nota'), inp = p.querySelector('.pf-cauta');
    function potrivite() {
      var cuv = SC.normText(cautare).split(' ').filter(Boolean);
      return cuv.length ? vals.filter(function (v) { return cuv.every(function (w) { return v.h.indexOf(w) >= 0; }); }) : vals;
    }
    function deseneaza() {
      var m = potrivite(), h = '';
      m.slice(0, MAX).forEach(function (v) {
        h += '<label class="bifa"><input type="checkbox" data-v="' + esc(v.d) + '"' + (sel.has(v.d) ? ' checked' : '') + '> <span class="pf-v">' + esc(v.d) + '</span><span class="mic">' + v.n + '</span></label>';
      });
      lista.innerHTML = h || '<div class="mic" style="padding:8px">Nicio valoare nu corespunde căutării.</div>';
      var bifate = m.filter(function (v) { return sel.has(v.d); }).length;
      tot.checked = m.length > 0 && bifate === m.length; tot.indeterminate = bifate > 0 && bifate < m.length;
      p.querySelector('.pf-tot span').textContent = cautare ? '(Selectează toate rezultatele căutării)' : '(Selectează tot)';
      nota.textContent = m.length + (m.length === 1 ? ' valoare' : ' valori') + (m.length > MAX ? ' — afișate primele ' + MAX + '; folosește căutarea' : '');
    }
    inp.addEventListener('input', function () {
      var inainte = cautare; cautare = inp.value;
      /* ca in Excel: la prima tastare raman bifate doar rezultatele cautarii */
      if (!inainte && cautare) { sel = new Set(); potrivite().forEach(function (v) { sel.add(v.d); }); }
      else if (cautare) { sel = new Set(); potrivite().forEach(function (v) { sel.add(v.d); }); }
      else { sel = new Set(); vals.forEach(function (v) { if (!activ || activ.has(v.d)) sel.add(v.d); }); }
      deseneaza();
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); aplica(); } });
    tot.addEventListener('change', function () {
      potrivite().forEach(function (v) { if (tot.checked) sel.add(v.d); else sel.delete(v.d); });
      deseneaza();
    });
    lista.addEventListener('change', function (e) {
      var cb = e.target.closest('[data-v]'); if (!cb) return;
      if (cb.checked) sel.add(cb.dataset.v); else sel.delete(cb.dataset.v);
      var m = potrivite(), bifate = m.filter(function (v) { return sel.has(v.d); }).length;
      tot.checked = bifate === m.length; tot.indeterminate = bifate > 0 && bifate < m.length;
    });
    function aplica() {
      var alese = potrivite().filter(function (v) { return sel.has(v.d); }).map(function (v) { return v.d; });
      if (!alese.length) { toast('Bifează cel puțin o valoare.', 'rau'); return; }
      if (!cautare && alese.length === vals.length) delete stare.fc[k]; else stare.fc[k] = new Set(alese);
      inchideFiltru(); deseneazaCap(); $('tabel').scrollTop = 0; redeseneaza();
    }
    p.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.s) { stare.sort = { k: k, dir: +b.dataset.s }; inchideFiltru(); deseneazaCap(); redeseneaza(); }
      else if (b.dataset.a === 'ok') aplica();
      else if (b.dataset.a === 'renunta') inchideFiltru();
      else if (b.dataset.a === 'sterge') { delete stare.fc[k]; inchideFiltru(); deseneazaCap(); redeseneaza(); }
    });
    document.body.appendChild(p);
    var r = buton.getBoundingClientRect(), lat = p.offsetWidth;
    p.style.left = Math.max(6, Math.min(r.right - 24, window.innerWidth - lat - 6)) + 'px';
    p.style.top = (r.bottom + 4) + 'px';
    p.style.maxHeight = Math.max(260, window.innerHeight - r.bottom - 14) + 'px';
    popFiltru = p; deseneaza(); inp.focus();
    document.addEventListener('pointerdown', afaraFiltru, true);
    document.addEventListener('keydown', tastaFiltru, true);
  }
  $('tabel').addEventListener('scroll', function () { if (popFiltru) inchideFiltru(); }, { passive: true });

  /* filtre */
  var tCauta = null;
  $('fCauta').addEventListener('input', function () {
    clearTimeout(tCauta);
    var v = this.value;
    tCauta = setTimeout(function () { stare.f.q = v; $('tabel').scrollTop = 0; redeseneaza(); }, 180);
  });
  $('fClient').onchange = function () { stare.f.cl = this.value; redeseneaza(); };
  $('fNeinc').onchange = function () { stare.f.neinc = this.checked; redeseneaza(); };
  $('fColData').onchange = function () { stare.f.colData = this.value; redeseneaza(); };
  $('fDela').onchange = function () { stare.f.dela = this.value; redeseneaza(); };
  $('fPanala').onchange = function () { stare.f.panala = this.value; redeseneaza(); };
  $('fStatus').addEventListener('click', function (e) {
    var b = e.target.closest('.cip'); if (!b) return;
    var s = b.dataset.st;
    if (stare.f.st[s]) delete stare.f.st[s]; else stare.f.st[s] = 1;
    redeseneaza();
  });
  $('btnReset').onclick = function () {
    stare.f = { q: '', cl: '', st: {}, neinc: false, colData: stare.f.colData, dela: '', panala: '' };
    $('fCauta').value = ''; $('fClient').value = ''; $('fNeinc').checked = false; $('fDela').value = ''; $('fPanala').value = '';
    stare.fc = {}; deseneazaCap();
    redeseneaza();
  };
  $('fScop').onchange = function () {
    $('zonaIstoric').classList.toggle('ascuns', this.value !== 'istoric');
    if (this.value === 'istoric' && !$('iDela').value) { $('iPanala').value = SC.azi(); $('iDela').value = SC.ziPlus(SC.azi(), -30); }
  };
  $('btnIstoric').onclick = function () {
    var a = $('iDela').value, b = $('iPanala').value;
    if (!a || !b || a > b) { toast('Alege perioada (de la – până la).', 'rau'); return; }
    var btn = this; btn.disabled = true;
    /* grupele se cauta dupa momentul introducerii comenzilor; marja de 3 zile acopera grupele care trec peste capatul perioadei */
    SC.store.cautaGrupe(SC.msDin(SC.ziPlus(a, -3), '00:00'), SC.msDin(SC.ziPlus(b, 4), '00:00')).then(function (grupe) {
      btn.disabled = false;
      var noi = grupe.filter(function (d) { return !SC.grupe[d.id] || (SC.grupe[d.id].upd || 0) <= (d.data.upd || 0); });
      L.aplicaGrupe(noi);
      toast('Istoric încărcat: ' + grupe.length + ' grupe de comenzi din perioada aleasă.', 'bun');
      redeseneaza();
    }, function (e) { btn.disabled = false; arataEroare(e); });
  };
  /* export: ce se vede in lista, sau toate comenzile dintr-o anumita zi (cautate in toata baza de date) */
  var TIP_ZI = {
    dl: { t: 'Livrare solicitată', f: [-40, 4] }, dc: { t: 'Data comandă', f: [-5, 14] }, dp: { t: 'Data pregătire', f: [-40, 4] },
    di: { t: 'Data încărcare', f: [-55, 4] }, ct: { t: 'Data introducerii în registru', f: [-4, 4] }
  };
  function ziuaComenzii(o, tip) {
    if (tip === 'ct') return o.ct ? SC.ymd(new Date(o.ct)) : '';
    return String(o[tip] || '').slice(0, 10);
  }
  $('btnExport').onclick = function () {
    var html = '<label class="bifa"><input type="radio" name="exTip" value="lista" checked> Ce se vede acum în listă, cu filtrele aplicate (' + nCom(stare.lista.length) + ')</label>' +
      '<label class="bifa"><input type="radio" name="exTip" value="zi"> Toate comenzile dintr-o zi</label>' +
      '<div class="grila" style="margin-left:24px"><label class="camp"><span>Ziua</span><input type="date" id="exZi" value="' + SC.azi() + '"></label>' +
      '<label class="camp"><span>După</span><select id="exDupa">' + Object.keys(TIP_ZI).map(function (k) { return '<option value="' + k + '"' + (k === stare.f.colData ? ' selected' : '') + '>' + TIP_ZI[k].t + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="mic" style="margin-left:24px">Exportul pe zi caută în toată baza de date, nu doar în comenzile încărcate, și ignoră filtrele din listă.</div>';
    modal({
      titlu: 'Export Excel', html: html,
      laDeschidere: function (rad) {
        function peZi() { rad.querySelector('[value=zi]').checked = true; }
        rad.querySelector('#exZi').addEventListener('focus', peZi); rad.querySelector('#exDupa').addEventListener('focus', peZi);
      },
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Exportă', cls: 'pri', fn: function (rad) {
          if (rad.querySelector('[value=lista]').checked) {
            if (!stare.lista.length) { toast('Nu există comenzi de exportat.', 'rau'); return false; }
            L.exportExcel(stare.lista, 'Status Comenzi ' + SC.azi() + '.xlsx');
            return;
          }
          var zi = rad.querySelector('#exZi').value, tip = rad.querySelector('#exDupa').value, fer = TIP_ZI[tip].f;
          if (!zi) { toast('Alege ziua.', 'rau'); return false; }
          return SC.store.cautaGrupe(SC.msDin(SC.ziPlus(zi, fer[0]), '00:00'), SC.msDin(SC.ziPlus(zi, fer[1]), '00:00')).then(function (grupe) {
            L.aplicaGrupe(grupe.filter(function (d) { return !SC.grupe[d.id] || (SC.grupe[d.id].upd || 0) <= (d.data.upd || 0); }));
            var l = SC.comenzi.filter(function (o) { return ziuaComenzii(o, tip) === zi; });
            redeseneaza();
            if (!l.length) { toast('Nicio comandă cu ' + TIP_ZI[tip].t.toLowerCase() + ' = ' + SC.fmtDataLunga(zi) + '.', 'rau'); return false; }
            L.exportExcel(l, 'Comenzi ' + SC.fmtDataLunga(zi) + ' (' + TIP_ZI[tip].t + ').xlsx');
            toast('Exportate ' + nCom(l.length) + ' din ' + SC.fmtDataLunga(zi) + '.', 'bun');
          });
        }
      }]
    });
  };

  /* ================= COMENZI: statusuri ================= */
  function cereDateTerminare(o, st) {
    var cfg = SC.config, auto = L.greutateAuto(o), eKandia = SC.normText(o.cl) === SC.normText(cfg.clientGreutateAuto);
    var est = SC.esteNum(o.pe) ? o.pe : null;
    var html = '<div class="nota">' + esc(o.cl) + ' · comanda <b>' + esc(o.nc) + '</b><br>' + esc(o.de || '') +
      (est != null ? '<br>Paleți estimați: <b>' + SC.fmtNum(est, 'num') + '</b>' : '') +
      (SC.esteNum(o.g) ? ' · Greutate: <b>' + SC.fmtNum(o.g, 'num') + ' kg</b>' : '') + '</div>' +
      '<div class="grila">' +
      '<label class="camp"><span>FPP (paleți full)</span><input type="text" id="tFpp" inputmode="numeric" value="' + (SC.esteNum(o.fpp) ? o.fpp : '') + '"></label>' +
      '<label class="camp"><span>Pick (paleți din picking)</span><input type="text" id="tPk" inputmode="numeric" value="' + (SC.esteNum(o.pk) ? o.pk : '') + '"></label>' +
      '<label class="camp"><span>Paleți reali (FPP + Pick)</span><input type="text" id="tPr" readonly tabindex="-1" value=""></label>' +
      '<label class="camp"><span>Amprente paleți</span><input type="text" id="tAm" inputmode="numeric" value="' + (SC.esteNum(o.am) ? o.am : '') + '"></label>' +
      (auto ? '' : '<label class="camp"><span>Greutate finală (kg)</span><input type="text" id="tGf" inputmode="decimal" value="' + (SC.esteNum(o.gf) ? String(o.gf).replace('.', ',') : '') + '"></label>') +
      '</div>' +
      (auto ? '<div class="mic">Greutatea finală se calculează automat: greutate + paleți reali × ' + cfg.kgPalet + ' kg.</div>' :
        (eKandia ? '<div class="nota atentie">Comanda este ' + esc(cfg.clientGreutateAuto) + ', dar Greutatea lipsește, deci greutatea finală se introduce manual.</div>' :
          '<div class="mic">Zecimalele se scriu cu virgulă (ex. 2135,45).</div>')) +
      '<div class="mic">FPP și Pick se confirmă la închiderea comenzii. Paleții reali sunt mereu FPP + Pick. Amprentele pornesc de la aceeași sumă și pot fi corectate.</div>';
    function intreg(v, nume) {
      var n = SC.parseNum(v);
      if (n == null) { toast(nume + ': „' + v + '” nu este un număr.', 'rau'); return null; }
      if (n < 0) { toast(nume + ' nu poate fi negativ.', 'rau'); return null; }
      if (n !== Math.floor(n)) { toast(nume + ': introdu un număr întreg.', 'rau'); return null; }
      return n;
    }
    return modal({
      titlu: st === ST.SELF ? 'Ridicare client — date pregătire' : 'Terminare comandă', html: html,
      laDeschidere: function (rad) {
        var iPr = rad.querySelector('#tPr'), iF = rad.querySelector('#tFpp'), iP = rad.querySelector('#tPk'), iA = rad.querySelector('#tAm');
        var atins = SC.esteNum(o.pk);
        /* amprentele urmeaza suma pana cand sunt scrise de mana (sau daca erau deja diferite de paletii reali) */
        var amAtins = SC.esteNum(o.am) && o.am !== o.pr;
        function total() {
          var f = SC.parseNum(iF.value.trim()), p = SC.parseNum(iP.value.trim());
          var s = f != null && p != null ? f + p : null;
          iPr.value = s == null ? '' : s;
          if (!amAtins) iA.value = s == null ? '' : s;
        }
        iF.addEventListener('input', function () {
          if (!atins) { var p = SC.pickPropus(SC.parseNum(iF.value.trim()), o.pe, null); if (p != null) iP.value = p; }
          total();
        });
        iP.addEventListener('input', function () { atins = true; total(); });
        iA.addEventListener('input', function () { amAtins = true; });
        total();
      },
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Confirmă', cls: 'pri', fn: function (r) {
          var fpp = citesteIntreg(r.querySelector('#tFpp').value, 'FPP', true); if (fpp == null) return false;
          var pk = citesteIntreg(r.querySelector('#tPk').value, 'Pick', true); if (pk == null) return false;
          var pr = fpp + pk;
          var am = intreg(r.querySelector('#tAm').value.trim(), 'Amprente'); if (am == null) return false;
          var gf = null, pasi = Promise.resolve(true);
          if (!auto) {
            gf = SC.parseNum(r.querySelector('#tGf').value.trim());
            if (gf == null || gf < 0) { toast('Greutatea finală nu este un număr valid.', 'rau'); return false; }
          }
          if (est != null) {
            var rot = Math.ceil(est);
            if (Math.abs(pr - rot) > cfg.tolerantaPaleti) {
              pasi = pasi.then(function (ok) {
                return ok && confirma('Pentru comanda ' + o.nc + ' estimarea este ' + SC.fmtNum(est, 'num') + ' paleți (aprox. ' + rot + ').\nFPP ' + fpp + ' + Pick ' + pk + ' = ' + pr + ' paleți reali. Este corect?');
              });
            }
          }
          if (am > pr) {
            pasi = pasi.then(function (ok) {
              return ok && confirma('Ai introdus ' + am + ' amprente la ' + pr + ' paleți reali.\nAmprentele sunt de obicei cel mult egale cu paleții. Este corect?');
            });
          }
          if (!auto && SC.esteNum(o.g) && o.g > 0 && gf > o.g * cfg.factorGreutate) {
            pasi = pasi.then(function (ok) {
              return ok && confirma('Greutatea finală introdusă (' + SC.fmtNum(gf, 'num') + ' kg) este de peste ' + cfg.factorGreutate +
                ' ori mai mare decât greutatea din comandă (' + SC.fmtNum(o.g, 'num') + ' kg).\nZecimalele se introduc cu virgulă (ex. 2135,454). Este corectă valoarea?');
            });
          }
          return pasi.then(function (ok) { return ok ? { pr: pr, am: am, gf: gf, fpp: fpp, pk: pk } : false; });
        }
      }]
    });
  }
  function schimbaStatus(o, stNou) {
    var vechi = o.st, nc = o.nc, n = o.n;
    if (stNou === vechi) return Promise.resolve();
    var p;
    if (stNou === ST.TER) p = cereDateTerminare(o, stNou);
    else if (stNou === ST.SELF) {
      p = confirma('Comanda ' + nc + ' se ridică de către client?').then(function (ok) { return ok ? cereDateTerminare(o, stNou) : null; });
    } else if (stNou === ST.ANU) {
      p = confirma('Ești sigur că vrei să anulezi comanda ' + nc + '?\n\nToate datele comenzii se șterg; rămân Nr Crt, clientul, numărul de comandă și eticheta de import.').then(function (ok) { return ok ? {} : null; });
    } else p = Promise.resolve({});
    return p.then(function (date) {
      if (!date) return;
      return L.modifica([{
        n: n, fn: function (x) {
          if (x.st !== vechi) throw L.eroare('Statusul comenzii ' + nc + ' a fost schimbat între timp de un coleg (acum: ' + x.st + '). Verifică și repetă.');
          L.aplicaStatus(x, stNou, date);
        }
      }], nc + ': ' + vechi + ' → ' + stNou).then(function () { toast('Comanda ' + nc + ': ' + stNou, 'bun'); });
    });
  }

  /* ================= COMENZI: formular ================= */
  var CAMPURI_FORM = ['cl', 'nc', 'cc', 'dc', 'dl', 'de', 'ad', 'or', 'ju', 'g', 'ca', 'pe', 'fpp', 'pk', 'gf', 'pr', 'am', 'dp', 'op', 'na', 'nt', 'dtr', 'inc', 'di', 'ob', 'co', 'sc', 'te', 'se', 'so', 're'];
  var CAMPURI_NOI = ['cl', 'nc', 'cc', 'dc', 'dl', 'de', 'ad', 'or', 'ju', 'g', 'ca', 'pe', 'fpp', 'pk', 'na', 'ob', 'co'];
  var LATE = { de: 1, ad: 1, ob: 1, co: 1 };
  function campHtml(k, val, editabil) {
    var c = SC.COL[k], v = val == null ? '' : val, ro = editabil ? '' : ' readonly', inp;
    if (k === 'cl') {
      var l = SC.config.clienti.slice(); if (v && l.indexOf(v) < 0) l.unshift(v);
      inp = '<select data-k="cl"' + (editabil ? '' : ' disabled') + '><option value=""></option>' +
        l.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>';
    } else if (k === 'inc') {
      inp = '<select data-k="inc"' + (editabil ? '' : ' disabled') + '>' + ['', 'DA', 'NU'].map(function (x) {
        return '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>';
      }).join('') + '</select>';
    } else if (c.typ === 'date' && (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v))) {
      inp = '<input type="date" data-k="' + k + '" value="' + esc(v) + '"' + ro + '>';
    } else if (c.typ === 'num' || c.typ === 'int') {
      inp = '<input type="text" inputmode="decimal" data-k="' + k + '" value="' + esc(SC.esteNum(v) ? String(v).replace('.', ',') : v) + '"' + ro + '>';
    } else {
      inp = '<input type="text" data-k="' + k + '" value="' + esc(v) + '"' + ro + '>';
    }
    return '<label class="camp' + (LATE[k] ? ' lat2' : '') + '"><span>' + esc(c.t) + '</span>' + inp + '</label>';
  }
  function citesteCampuri(rad) {
    var val = {}, greseala = null;
    Array.prototype.forEach.call(rad.querySelectorAll('[data-k]'), function (el) {
      var k = el.dataset.k, c = SC.COL[k], v = String(el.value || '').trim();
      if ((c.typ === 'num' || c.typ === 'int') && v !== '') {
        var n = SC.parseNum(v);
        if (n == null) { if (!el.readOnly && el.value !== el.defaultValue) greseala = c.t + ': „' + v + '” nu este un număr.'; }
        else v = n;
      }
      if (k === 'na' || k === 'cl') v = String(v).toUpperCase();
      val[k] = v;
    });
    if (greseala) { toast(greseala, 'rau'); return null; }
    return val;
  }
  /* la schimbarea codului de client: Destinatar / Adresa / Oras / Judet din Adrese (dupa Client + Cod) */
  function leagaCodClient(rad) {
    var inF = rad.querySelector('[data-k=fpp]'), inP = rad.querySelector('[data-k=pk]');
    if (inF && inP && !inF.readOnly && !inP.readOnly) {
      inF.addEventListener('input', function () {
        function nr(k) { var el = rad.querySelector('[data-k=' + k + ']'); return el ? SC.parseNum(el.value.trim()) : null; }
        var p = SC.pickPropus(SC.parseNum(inF.value.trim()), nr('pe'), nr('pr'));
        if (p != null) inP.value = p;
      });
    }
    var cod = rad.querySelector('[data-k=cc]'); if (!cod || cod.readOnly) return;
    cod.addEventListener('change', function () {
      var cl = rad.querySelector('[data-k=cl]').value, v = cod.value.trim();
      if (!v) return;
      if (!cl) { toast('Alege întâi clientul, apoi codul — același cod există la mai mulți clienți.', 'rau'); return; }
      var a = L.adresaDupaCod(cl, v);
      if (!a) { toast('Codul „' + v + '” nu există în Adrese pentru clientul ' + cl + '.', 'rau'); return; }
      [['de', a.nume], ['ad', a.str], ['or', a.loc], ['ju', a.jud]].forEach(function (p) {
        var el = rad.querySelector('[data-k=' + p[0] + ']');
        if (el && !el.readOnly) el.value = p[1] || '';
      });
    });
  }
  function verificaDublura(nc, cl, exceptN) {
    return L.cautaComenzi([nc]).then(function (rez) {
      var l = (rez[SC.cheieComanda(nc)] || []).filter(function (x) { return x.n !== exceptN && (!cl || !x.cl || x.cl === cl); });
      if (!l.length) return true;
      var x = l[0];
      return confirma('Comanda ' + nc + (cl ? ' (' + cl + ')' : '') + ' există deja: Nr Crt ' + x.n + ', status ' + x.st + '.\n\nPăstrezi totuși comanda și aici?');
    });
  }
  /* FPP (paleti full) si Pick (paleti din picking), direct din lista. La completarea FPP, Pick se propune singur. */
  function leagaFppPick(inFpp, inPk, estimare, paletiReali) {
    inFpp.addEventListener('input', function () {
      var f = SC.parseNum(inFpp.value.trim()), p = SC.pickPropus(f, estimare, typeof paletiReali === 'function' ? paletiReali() : paletiReali);
      if (p != null) inPk.value = p;
    });
  }
  function citesteIntreg(v, nume, obligatoriu) {
    v = String(v).trim();
    if (v === '') { if (obligatoriu) { toast(nume + ': completează valoarea (0 dacă nu sunt).', 'rau'); return null; } return ''; }
    var n = SC.parseNum(v);
    if (n == null || n < 0 || n !== Math.floor(n)) { toast(nume + ': „' + v + '” nu este un număr întreg valid.', 'rau'); return null; }
    return n;
  }
  function editeazaFppPick(o) {
    var n = o.n, gata = o.st === ST.TER || o.st === ST.SELF;
    modal({
      titlu: 'FPP și Pick — comanda ' + o.nc,
      html: '<div class="nota">' + esc(o.cl) + ' · ' + esc(o.de || '') + '<br>Paleți estimați: <b>' + (SC.esteNum(o.pe) ? SC.fmtNum(o.pe, 'num') : '—') + '</b>' +
        (SC.esteNum(o.pr) ? ' · Paleți reali: <b>' + SC.fmtNum(o.pr, 'int') + '</b>' : '') + '</div>' +
        '<div class="grila"><label class="camp"><span>FPP (paleți full)</span><input type="text" inputmode="numeric" id="fppNou" value="' + (SC.esteNum(o.fpp) ? o.fpp : '') + '"></label>' +
        '<label class="camp"><span>Pick (paleți din picking)</span><input type="text" inputmode="numeric" id="pkNou" value="' + (SC.esteNum(o.pk) ? o.pk : '') + '"></label></div>' +
        (gata ? '<div class="nota" id="fpTot"></div><div class="mic">Comanda este pregătită: paleții reali se refac din FPP + Pick. Amprentele urmează suma doar dacă nu au fost modificate separat.</div>' :
          '<div class="mic">Când scrii FPP, Pick se calculează singur: estimarea rotunjită în sus − FPP. Îl poți corecta înainte de salvare.</div>'),
      laDeschidere: function (rad) {
        var iF = rad.querySelector('#fppNou'), iP = rad.querySelector('#pkNou');
        if (!gata) return leagaFppPick(iF, iP, o.pe, null);
        function total() {
          var f = SC.parseNum(iF.value.trim()), p = SC.parseNum(iP.value.trim());
          rad.querySelector('#fpTot').innerHTML = 'Paleți reali după salvare: <b>' + (f != null && p != null ? f + p : '—') + '</b>' + (SC.esteNum(o.pr) ? ' (acum: ' + SC.fmtNum(o.pr, 'int') + ')' : '');
        }
        iF.addEventListener('input', total); iP.addEventListener('input', total); total();
      },
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Salvează', cls: 'pri', fn: function (rad) {
          var f = citesteIntreg(rad.querySelector('#fppNou').value, 'FPP', gata); if (f == null) return false;
          var p = citesteIntreg(rad.querySelector('#pkNou').value, 'Pick', gata); if (p == null) return false;
          return L.modifica([{ n: n, fn: function (x) { if (f === '') delete x.fpp; else x.fpp = f; if (p === '') delete x.pk; else x.pk = p; L.sincPaleti(x); } }])
            .then(function () { toast('FPP / Pick salvate pentru comanda ' + o.nc + '.', 'bun'); redeseneaza(); });
        }
      }]
    });
  }
  /* amprentele se pot corecta separat de paletii reali (Operator date din lista, Incarcari la confirmarea incarcarii) */
  function editeazaAmprente(o) {
    var n = o.n;
    modal({
      titlu: 'Amprente — comanda ' + o.nc,
      html: '<div class="nota">' + esc(o.cl) + ' · ' + esc(o.de || '') + '<br>FPP <b>' + (SC.esteNum(o.fpp) ? o.fpp : '—') + '</b> + Pick <b>' + (SC.esteNum(o.pk) ? o.pk : '—') +
        '</b> = paleți reali <b>' + (SC.esteNum(o.pr) ? SC.fmtNum(o.pr, 'int') : '—') + '</b></div>' +
        '<label class="camp"><span>Amprente paleți</span><input type="text" inputmode="numeric" id="amNou" value="' + (SC.esteNum(o.am) ? o.am : '') + '"></label>',
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Salvează', cls: 'pri', fn: function (rad) {
          var a = citesteIntreg(rad.querySelector('#amNou').value, 'Amprente', true); if (a == null) return false;
          if (a === o.am) return null;
          return L.modifica([{ n: n, fn: function (x) { x.am = a; } }]).then(function () { toast('Amprente salvate pentru comanda ' + o.nc + '.', 'bun'); redeseneaza(); });
        }
      }]
    });
  }
  /* rolul Transport: singura modificare permisa este Nr AUTO, direct din lista */
  function editeazaNrAuto(o) {
    if (o.inc === 'DA') { toast('Comanda ' + o.nc + ' este deja încărcată; numărul auto nu mai poate fi schimbat.', 'rau'); return; }
    var n = o.n;
    modal({
      titlu: 'Nr AUTO — comanda ' + o.nc,
      html: '<div class="nota">' + esc(o.cl) + ' · ' + esc(o.de || '') + '</div><label class="camp"><span>Nr AUTO</span><input type="text" id="naNou" value="' + esc(o.na || '') + '" maxlength="20"></label>',
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Salvează', cls: 'pri', fn: function (rad) {
          var v = rad.querySelector('#naNou').value.trim().toUpperCase();
          if (v === String(o.na || '')) return null;
          return L.modifica([{
            n: n, fn: function (x) {
              if (x.inc === 'DA') throw L.eroare('Comanda ' + x.nc + ' a fost încărcată între timp; numărul auto nu mai poate fi schimbat.');
              if (v) x.na = v; else delete x.na;
            }
          }]).then(function () { toast('Nr AUTO salvat pentru comanda ' + o.nc + '.', 'bun'); redeseneaza(); });
        }
      }]
    });
  }
  function deschideComanda(o) {
    var r = rol(), n = o.n;
    function editabil(k) {
      if (r === 'admin') return true;
      if (r === 'operator') return !SC.CAMPURI_INCARCARE[k];
      if (r === 'transport') return k === 'na' && o.inc !== 'DA';
      return false;
    }
    var edit = CAMPURI_FORM.some(editabil);
    var html = '<div class="nota">Nr Crt <b>' + o.n + '</b> · Status <b>' + esc(o.st) + '</b> · Import: ' + esc(o.im || '—') +
      (o.cu ? '<br><span class="mic">Introdusă de ' + esc(o.cu) + (o.uu ? ' · ultima modificare: ' + esc(o.uu) + ', ' + esc(SC.fmtDT(SC.ymd(new Date(o.ut)) + ' ' + SC.p2(new Date(o.ut).getHours()) + ':' + SC.p2(new Date(o.ut).getMinutes()))) : '') + '</span>' : '') +
      (o.ar ? '<br><span class="mic">Comandă arhivată (terminată, fără confirmare de încărcare).</span>' : '') + '</div><div class="grila">';
    CAMPURI_FORM.forEach(function (k) {
      html += campHtml(k, o[k], editabil(k));
    });
    html += '</div>' + (r === 'operator' ? '<div class="mic">Statusul se schimbă din lista de comenzi, iar câmpurile de încărcare din tabul Încărcări. Fiecare modificare rămâne în jurnal, cu valoarea veche și cea nouă.</div>' :
      (r === 'transport' ? '<div class="mic">Poți modifica doar Nr AUTO, cât timp comanda nu este încărcată.</div>' : ''));
    var butoane = [{ t: 'Închide', v: null }];
    if (edit) {
      butoane.push({
        t: 'Salvează', cls: 'pri', fn: function (rad) {
          var val = citesteCampuri(rad); if (!val) return false;
          var schimbari = {};
          Object.keys(val).forEach(function (k) {
            var vechi = o[k] == null ? '' : o[k];
            if (String(val[k]) !== String(vechi)) schimbari[k] = val[k];
          });
          var chei = Object.keys(schimbari);
          if (!chei.length) return null;
          if ('nc' in schimbari && !schimbari.nc) { toast('Numărul de comandă nu poate fi șters. Pentru renunțare folosește statusul Anulata.', 'rau'); return false; }
          if (schimbari.inc && o.st !== ST.TER) { toast('O comandă poate fi marcată ca încărcată doar dacă are statusul Terminata.', 'rau'); return false; }
          if ((o.st === ST.TER || o.st === ST.SELF) && SC.esteNum(val.fpp) && SC.esteNum(val.pk) && !('fpp' in schimbari) && !('pk' in schimbari) && 'pr' in schimbari && val.pr !== val.fpp + val.pk) {
            toast('Paleții reali sunt FPP + Pick (' + val.fpp + ' + ' + val.pk + ' = ' + (val.fpp + val.pk) + '). Modifică FPP sau Pick.', 'rau'); return false;
          }
          var pas = ('nc' in schimbari || 'cl' in schimbari) ? verificaDublura(val.nc, val.cl, n) : Promise.resolve(true);
          return pas.then(function (ok) {
            if (!ok) return false;
            return L.modifica([{
              n: n, fn: function (x) {
                chei.forEach(function (k) {
                  if (!editabil(k)) throw L.eroare('Nu ai drept de modificare pe câmpul „' + SC.COL[k].t + '”.');
                  if (r === 'transport' && x.inc === 'DA') throw L.eroare('Comanda a fost încărcată între timp; numărul auto nu mai poate fi schimbat.');
                  if (schimbari[k] === '') delete x[k]; else x[k] = schimbari[k];
                  if (k === 'ju') delete x.jd;
                  if (k === 'inc' && schimbari[k] === 'DA' && !x.di) x.di = SC.dtAcum();
                });
                if ('fpp' in schimbari || 'pk' in schimbari) L.sincPaleti(x);
              }
            }], o.nc + ': modificat ' + chei.map(function (k) { return SC.COL[k].t; }).join(', ')).then(function () { toast('Comanda ' + o.nc + ' a fost salvată.', 'bun'); redeseneaza(); });
          });
        }
      });
    }
    return modal({ titlu: 'Comanda ' + o.nc + (o.cl ? ' — ' + o.cl : ''), html: html, lat: true, butoane: butoane, laDeschidere: leagaCodClient });
  }
  $('btnNoua').onclick = function () {
    var html = '<div class="grila">' + CAMPURI_NOI.map(function (k) { return campHtml(k, '', true); }).join('') + '</div>' +
      '<div class="mic">Comanda primește statusul Initiata, următorul Nr Crt și eticheta „MANUAL: data ora”. Cu Cod Client completat, destinatarul și adresa vin din Adrese.</div>';
    modal({
      titlu: 'Comandă nouă', html: html, lat: true, laDeschidere: leagaCodClient,
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Adaugă comanda', cls: 'pri', fn: function (rad) {
          var val = citesteCampuri(rad); if (!val) return false;
          if (!val.cl) { toast('Alege clientul.', 'rau'); return false; }
          if (!val.nc) { toast('Scrie numărul de comandă.', 'rau'); return false; }
          return verificaDublura(val.nc, val.cl, -1).then(function (ok) {
            if (!ok) return false;
            val.st = ST.INI; val.im = 'MANUAL: ' + stampila();
            return L.creeaza([val], 'Comandă nouă ' + val.cl + ' ' + val.nc).then(function (nr) {
              toast('Comanda ' + val.nc + ' a fost adăugată cu Nr Crt ' + nr[0] + '.', 'bun');
              redeseneaza(); $('tabel').scrollTop = $('tabel').scrollHeight;
            });
          });
        }
      }]
    });
  };

  /* ================= import borderou Kandia ================= */
  function listaHtml(linii, max) {
    var l = linii.slice(0, max || 15).map(function (x) { return '<div style="padding:3px 8px">' + esc(x) + '</div>'; }).join('');
    return '<div class="lista-mica">' + l + (linii.length > (max || 15) ? '<div style="padding:3px 8px">… încă ' + (linii.length - (max || 15)) + '</div>' : '') + '</div>';
  }
  $('btnBorderou').onclick = function () {
    var fisier, b, client = SC.config.clientGreutateAuto || 'KANDIA';
    alegeFisier().then(function (f) {
      fisier = f;
      if (!/\.xlsx$/i.test(f.name)) throw L.eroare('Borderoul trebuie să fie un fișier .xlsx: ' + f.name);
      return citesteFisier(f);
    }).then(function (wb) {
      b = L.parseBorderou(wb, fisier.name, fisier.lastModified);
      return SC.store.citesteDoc('meta', 'importuri');
    }).then(function (imp) {
      var deja = imp && (imp.l || []).filter(function (x) { return x.f === fisier.name; })[0];
      if (!deja) return true;
      return confirma('Fișierul „' + fisier.name + '” a mai fost importat (' + deja.t + ', ' + deja.u + ').\nComenzile existente vor fi oricum sărite. Continui?');
    }).then(function (ok) {
      if (!ok) return null;
      return L.cautaComenzi(b.randuri.map(function (r) { return r.nc; }));
    }).then(function (exist) {
      if (!exist) return;
      var noi = [], dubluri = [], vazute = {}, dupaOras = 0, faraJudet = [];
      b.randuri.forEach(function (r) {
        var k = SC.cheieComanda(r.nc);
        if ((exist[k] && exist[k].length) || vazute[k]) {
          dubluri.push(r.nc + (exist[k] && exist[k].length ? ' (Nr Crt ' + exist[k][0].n + ')' : ' (de două ori în borderou)'));
          return;
        }
        vazute[k] = 1;
        var o = { cl: client, st: ST.INI, im: b.eticheta, nc: r.nc, dc: r.dc, dl: r.dl, de: r.de, ad: r.ad, or: r.or, g: r.g, ca: r.ca, pe: r.pe, ob: r.ob };
        var a = L.adresaDupaNume(client, r.de, r.ad, r.or);
        if (a && a.jud) o.ju = a.jud;
        else {
          var j = L.judetDupaLocalitate(r.or);
          if (j) { o.ju = j; o.jd = 1; dupaOras++; } else faraJudet.push(o);
        }
        noi.push(o);
      });
      var html = '<div class="nota">Borderou (' + b.tip + '): <b>' + esc(fisier.name) + '</b><br>Eticheta de import: <b>' + esc(b.eticheta) + '</b></div>' +
        '<div><b>Comenzi noi: ' + noi.length + '</b></div>';
      if (dubluri.length) html += '<div>Comenzi sărite (existau deja): ' + dubluri.length + '</div>' + listaHtml(dubluri);
      if (b.ramase) html += '<div class="nota atentie">Atenție: după ultima comandă citită mai sunt ' + b.ramase + ' rânduri completate în borderou care nu au fost preluate (coloana A nu este un număr de comandă). Verifică fișierul.</div>';
      if (b.adreseCorectate) html += '<div class="mic">' + b.adreseCorectate + ' adrese transformate de Excel în dată au fost refăcute ca text (ex. „22 Decembrie 1989”).</div>';
      if (dupaOras) html += '<div class="mic">Județ completat după oraș (destinatar negăsit în Adrese): ' + dupaOras + ' — apare cu roșu în listă.</div>';
      if (faraJudet.length) {
        html += '<div class="nota atentie">Nu am găsit județul pentru ' + nCom(faraJudet.length) + '. Completează-l aici sau lasă gol:</div><div class="lista-mica"><table class="simplu">' +
          faraJudet.map(function (o, i) {
            return '<tr><td>' + esc(o.nc) + '</td><td>' + esc(o.de) + '<br><span class="mic">' + esc(o.ad) + ' · ' + esc(o.or) + '</span></td><td><input type="text" data-j="' + i + '" placeholder="Județ" style="width:120px"></td></tr>';
          }).join('') + '</table></div>';
      }
      if (!noi.length) return alerta('Borderou (' + b.tip + '): ' + fisier.name + '\n\nNicio comandă nouă — toate cele ' + dubluri.length + ' există deja.');
      return modal({
        titlu: 'Import borderou', html: html, lat: true,
        butoane: [{ t: 'Renunță', v: null }, {
          t: 'Importă ' + nCom(noi.length), cls: 'pri', fn: function (rad) {
            Array.prototype.forEach.call(rad.querySelectorAll('[data-j]'), function (el) {
              var v = el.value.trim(); if (v) faraJudet[+el.dataset.j].ju = v;
            });
            return L.creeaza(noi, 'Import borderou ' + fisier.name + ': ' + noi.length + ' comenzi').then(function (nr) {
              return SC.store.tx(function (t) {
                return t.get('meta', 'importuri').then(function (d) {
                  d = d || { l: [] };
                  d.l.push({ f: fisier.name, t: stampila(), u: SC.store.user.nume, k: noi.length });
                  if (d.l.length > 300) d.l = d.l.slice(-300);
                  t.set('meta', 'importuri', d);
                });
              }).then(function () {
                toast('Importate ' + noi.length + ' comenzi (Nr Crt ' + nr[0] + '–' + nr[nr.length - 1] + ').', 'bun');
                redeseneaza(); $('tabel').scrollTop = $('tabel').scrollHeight;
              });
            });
          }
        }]
      });
    }).catch(arataEroare);
  };

  /* ================= import din Excel cu antetele registrului ================= */
  $('btnImportExcel').onclick = function () {
    var fisier, p;
    alegeFisier().then(function (f) { fisier = f; return citesteFisier(f); }).then(function (wb) {
      p = L.parseRegistru(wb);
      if (!p.comenzi.length) throw L.eroare('Fișierul nu conține comenzi (coloana „Nr. Comanda” este goală).');
      return L.cautaComenzi(p.comenzi.map(function (o) { return o.nc; }));
    }).then(function (exist) {
      var noi = [], sarite = 0, vazute = {};
      p.comenzi.forEach(function (o) {
        var k = SC.cheieComanda(o.nc) + '|' + (o.cl || '');
        var are = (exist[SC.cheieComanda(o.nc)] || []).some(function (x) { return !o.cl || !x.cl || x.cl === o.cl; });
        if (are || vazute[k]) { sarite++; return; }
        vazute[k] = 1;
        var c = JSON.parse(JSON.stringify(o));
        delete c.n;
        if (!c.im) c.im = 'MANUAL: ' + stampila();
        if (c.cc && c.cl) {
          var a = L.adresaDupaCod(c.cl, c.cc);
          if (a) { if (!c.de) c.de = a.nume; if (!c.ad) c.ad = a.str; if (!c.or) c.or = a.loc; if (!c.ju) c.ju = a.jud; }
        }
        noi.push(c);
      });
      var html = '<div class="nota">Fișier: <b>' + esc(fisier.name) + '</b> (foaia „' + esc(p.foaie) + '”)</div>' +
        '<div><b>Comenzi noi: ' + noi.length + '</b> · sărite (există deja la același client): ' + sarite + '</div>' +
        (p.lipsa.length ? '<div class="mic">Coloane care lipsesc din fișier (rămân goale): ' + esc(p.lipsa.join(', ')) + '</div>' : '') +
        '<div class="mic">Coloanele se potrivesc după numele din antet (rândul 1), ca în registrul Excel. Comenzile primesc Nr Crt noi; statusul gol devine Initiata.</div>';
      if (!noi.length) return alerta('Nicio comandă nouă în „' + fisier.name + '” — toate cele ' + sarite + ' există deja.');
      return modal({
        titlu: 'Import din Excel', html: html,
        butoane: [{ t: 'Renunță', v: null }, {
          t: 'Importă ' + nCom(noi.length), cls: 'pri', fn: function () {
            return L.creeaza(noi, 'Import Excel ' + fisier.name + ': ' + noi.length + ' comenzi').then(function () {
              toast('Importate ' + noi.length + ' comenzi.', 'bun'); redeseneaza(); $('tabel').scrollTop = $('tabel').scrollHeight;
            });
          }
        }]
      });
    }).catch(arataEroare);
  };

  /* ================= ÎNCĂRCĂRI ================= */
  var FARA_DATA = '(fără dată)';
  var incDate = {};          // datele bifate in filtrul de date (gol = toate)
  function poateExtra() { return poate() || poateIncarca(); }
  /* o linie doar din transport, in forma unei comenzi (pentru liste, incarcare si borderou) */
  function caComanda(x) {
    return { extra: true, _zi: x._zi, _k: x._k, n: '', cl: x.cl || '', nc: x.ref, de: x.de || '', or: x.or || '', ju: x.ju || '', na: x.na || '', nt: x.nt || '', dtr: x.dtr || '',
      so: x.so, re: x.re, pr: x.pr, am: x.am, gf: x.gf, ca: x.ca, ob: x.ob, inc: x.inc, di: x.di, sc: x.sc, te: x.te, se: x.se, st: ST.TER };
  }
  function dataDin(o) { return o.dtr ? String(o.dtr).slice(0, 10) : ''; }
  /* toate camioanele: comenzile din registru cu Nr AUTO + liniile doar din transport */
  function toateCamioanele() {
    var g = {};
    /* cu numar de transport: un camion = un transport. Fara: acelasi numar auto se desparte pe zile,
       ca incarcarile vechi ale camionului sa nu se amestece cu ce e de incarcat acum. */
    function pune(o) {
      var na = SC.normNrAuto(o.na);
      var k = o.nt ? o.nt + '|' + na : '|' + na + '|' + (dataDin(o) || (o.inc === 'DA' ? String(o.di || '').slice(0, 10) : ''));
      (g[k] = g[k] || { cheie: k, na: o.na || '', nt: o.nt || '', toate: [] }).toate.push(o);
    }
    /* "0" in Nr AUTO vine din istoricul Excel si nu este un camion */
    SC.comenzi.forEach(function (o) { if (!o.na || o.ar || o.st === ST.ANU || !SC.normNrAuto(o.na).replace(/0/g, '')) return; pune(o); });
    SC.extra.forEach(function (x) { if (x.na || x.nt) pune(caComanda(x)); });
    return Object.keys(g).map(function (k) {
      var x = g[k], d = '';
      x.deIncarcat = x.toate.filter(function (o) { return o.st === ST.TER && o.inc !== 'DA'; });
      x.inLucru = x.toate.filter(function (o) { return !o.extra && SC.esteDeschisa(o); });
      x.incarcate = x.toate.filter(function (o) { return o.inc === 'DA'; });
      x.doarTransport = x.toate.filter(function (o) { return o.extra; });
      var nrPeZi = {};
      x.toate.forEach(function (o) { var z = dataDin(o); if (z) nrPeZi[z] = (nrPeZi[z] || 0) + 1; });
      d = Object.keys(nrPeZi).sort(function (a, b) { return nrPeZi[b] - nrPeZi[a] || (a < b ? 1 : -1); })[0] || '';
      if (!d && !x.deIncarcat.length && !x.inLucru.length) x.incarcate.forEach(function (o) { var z = String(o.di || '').slice(0, 10); if (z > d) d = z; });
      x.data = d;
      return x;
    });
  }
  function incFiltre() {
    return { q: SC.normNrAuto($('incCauta').value), siInc: $('incAzi').checked, areDate: Object.keys(incDate).length > 0 };
  }
  var camioaneAfisate = {}, extraAfisate = [];
  function deseneazaIncarcari() {
    var f = incFiltre(), edit = poateIncarca(), toate = toateCamioanele();
    /* camioanele de interes: cu ceva de incarcat / in lucru, plus cele incarcate daca s-a cerut */
    var deInteres = toate.filter(function (x) { return x.deIncarcat.length || x.inLucru.length || (f.siInc && x.incarcate.length); });
    /* filtrul de date: un buton pe fiecare data, se pot bifa mai multe */
    var peData = {};
    deInteres.forEach(function (x) { var d = x.data || FARA_DATA; peData[d] = (peData[d] || 0) + 1; });
    Object.keys(incDate).forEach(function (d) { if (!peData[d]) peData[d] = 0; });
    var date = Object.keys(peData).sort(function (a, b) { return a === FARA_DATA ? 1 : (b === FARA_DATA ? -1 : (a < b ? 1 : -1)); });
    deseneazaCalendar(peData, deInteres.length, f.areDate);

    var l = (f.q ? toate.filter(function (x) { return SC.normNrAuto(x.na).indexOf(f.q) >= 0 || SC.normNrAuto(x.nt).indexOf(f.q) >= 0; })
      : deInteres.filter(function (x) { return !f.areDate || incDate[x.data || FARA_DATA]; }))
      .sort(function (a, b) { return (a.data || '9') < (b.data || '9') ? -1 : ((a.data || '9') > (b.data || '9') ? 1 : a.na.localeCompare(b.na)); });
    camioaneAfisate = {};
    var zileAlese = Object.keys(incDate).sort().map(function (d) { return d === FARA_DATA ? 'fără dată' : SC.fmtDataLunga(d); });
    $('incTitlu').textContent = (f.q ? 'căutare „' + $('incCauta').value.trim() + '”' : (zileAlese.length ? zileAlese.join(', ') : 'toate datele')) + ' · ' + l.length + (l.length === 1 ? ' camion' : ' camioane');
    var h;
    if (!l.length) {
      h = '<div class="mic" style="padding:10px">Niciun camion pentru filtrele alese. Data încărcării vine din fișierul de transport (TMS): dacă ziua căutată lipsește, importă fișierul la zi.</div>';
    } else {
      h = '<table class="simplu"><tr><th>Data</th><th>Nr AUTO</th><th>Nr transport</th><th>De încărcat</th><th>În lucru</th><th>Doar transport</th><th>Început încărcare</th><th>Încărcat</th><th class="nr">Paleți reali</th><th class="nr">Amprente</th><th class="nr">Greutate finală</th><th></th></tr>';
      l.slice(0, 300).forEach(function (x, i) {
        camioaneAfisate[i] = x;
        var baza = x.deIncarcat.length ? x.deIncarcat : x.incarcate;
        var info = L.infoCamion(x), sfarsit = '';
        x.incarcate.forEach(function (o) { if (o.di && String(o.di) > sfarsit) sfarsit = String(o.di); });
        var durata = info && info.bt && sfarsit.length > 10 && sfarsit >= info.bt ? Math.round((SC.msDin(sfarsit.slice(0, 10), sfarsit.slice(11, 16)) - SC.msDin(info.bt.slice(0, 10), info.bt.slice(11, 16))) / 60000) : null;
        function oraScurta(dt) { return dt ? (dt.slice(0, 10) === SC.azi() ? dt.slice(11, 16) : SC.fmtDT(dt)) : ''; }
        h += '<tr><td>' + esc(x.data ? SC.fmtDataLunga(x.data) : '—') + '</td><td><b>' + esc(x.na) + '</b></td><td>' + esc(x.nt) + '</td><td>' +
          (x.deIncarcat.length ? '<span class="eticheta asteapta">' + nCom(x.deIncarcat.length) + '</span>' : (x.incarcate.length ? '<span class="eticheta ok">încărcat (' + x.incarcate.length + ')</span>' : '—')) +
          '</td><td>' + (x.inLucru.length || '') + '</td><td>' + (x.doarTransport.length || '') + '</td><td' + (info && info.bt ? ' title="Borderou tipărit de ' + esc(info.bu || '') + (info.bn > 1 ? '; retipărit de ' + (info.bn - 1) + ' ori, ultima dată ' + esc(SC.fmtDT(info.bl)) : '') + '"' : '') + '>' +
          (info && info.bt ? esc(oraScurta(info.bt)) + (info.bn > 1 ? ' <span class="mic">×' + info.bn + '</span>' : '') : '') + '</td><td>' +
          (sfarsit ? esc(oraScurta(sfarsit)) + (durata != null ? ' <span class="mic">(' + durata + ' min)</span>' : '') : '') + '</td><td class="nr">' + SC.fmtNum(suma(baza, 'pr'), 'int') + '</td><td class="nr">' + SC.fmtNum(suma(baza, 'am'), 'int') +
          '</td><td class="nr">' + SC.fmtNum(suma(baza, 'gf'), 'num') + '</td><td style="white-space:nowrap">' +
          (edit && x.deIncarcat.length ? '<button class="btn mic pri" data-inc="' + i + '">Încarcă</button> ' : '') +
          '<button class="btn mic" data-print="' + i + '">Borderou</button></td></tr>';
      });
      h += '</table>' + (l.length > 300 ? '<div class="mic" style="padding:8px">Afișate primele 300 din ' + l.length + ' camioane — restrânge cu filtrul de date sau cu căutarea.</div>' : '');
    }
    $('incLista').innerHTML = h;
    $('incNrCam').textContent = l.length;

    /* rubrica separata: liniile din TMS care nu exista in registrul de comenzi */
    var ex = SC.extra.filter(function (x) {
      if (f.q) return SC.normNrAuto(x.na).indexOf(f.q) >= 0 || SC.normNrAuto(x.nt).indexOf(f.q) >= 0 || SC.normNrAuto(x.ref).indexOf(f.q) >= 0;
      if (!f.siInc && x.inc === 'DA') return false;
      return !f.areDate || incDate[x.dtr || FARA_DATA];
    }).sort(function (a, b) { return (a.dtr || '9') < (b.dtr || '9') ? -1 : ((a.dtr || '9') > (b.dtr || '9') ? 1 : String(a.na).localeCompare(String(b.na))); });
    extraAfisate = ex.slice(0, 400);
    $('incNrExtra').textContent = ex.length;
    $('incExtraNumar').textContent = '· ' + ex.length + (ex.length === 1 ? ' linie' : ' linii') + (ex.length > 400 ? ' (afișate primele 400)' : '');
    $('incExtra').innerHTML = !ex.length ? '<div class="mic" style="padding:10px">Nicio linie doar din transport pentru filtrele alese.</div>' :
      '<table class="simplu"><tr><th>Data</th><th>Nr AUTO</th><th>Nr transport</th><th>Client</th><th>Referință</th><th>Destinatar</th><th>Localitate</th><th class="nr">Paleți</th><th class="nr">Amprente</th><th class="nr">Greutate</th><th>Încărcată</th></tr>' +
      extraAfisate.map(function (x, i) {
        return '<tr' + (poateExtra() ? ' class="clic"' : '') + ' data-x="' + i + '"><td>' + esc(x.dtr ? SC.fmtDataLunga(x.dtr) : '—') + '</td><td><b>' + esc(x.na || '') + '</b></td><td>' + esc(x.nt || '') + '</td><td>' + esc(x.cl || '') +
          '</td><td>' + esc(x.ref) + '</td><td>' + esc(x.de || '') + '</td><td>' + esc(x.or || '') + '</td><td class="nr"' + (x.prm ? ' title="Corectat manual (în TMS: ' + esc(SC.fmtNum(x.un, 'int')) + ')"' : '') + '>' + SC.fmtNum(x.pr, 'int') + (x.prm ? ' ✎' : '') + '</td><td class="nr">' + SC.fmtNum(x.am, 'int') + '</td><td class="nr">' + SC.fmtNum(x.gf, 'num') +
          '</td><td>' + (x.inc === 'DA' ? '<span class="eticheta ok">DA ' + esc(SC.fmtDT(x.di)) + '</span>' : '') + '</td></tr>';
      }).join('') + '</table>';
  }
  function suma(l, k) { return l.reduce(function (s, o) { return s + (SC.esteNum(o[k]) ? o[k] : 0); }, 0); }
  /* in dreapta se vede o singura lista odata, pe toata inaltimea: camioanele sau liniile doar din transport */
  $('incVedere').addEventListener('click', function (e) {
    var b = e.target.closest('.cip'); if (!b) return;
    Array.prototype.forEach.call(this.querySelectorAll('.cip'), function (x) { x.classList.toggle('activ', x === b); });
    $('cardCam').classList.toggle('ascuns', b.dataset.v !== 'cam');
    $('cardExtra').classList.toggle('ascuns', b.dataset.v !== 'extra');
  });
  $('incCauta').addEventListener('input', deseneazaIncarcari);
  $('incAzi').onchange = deseneazaIncarcari;
  /* ---- filtrul de date ca un calendar lunar: fiecare zi arata cate camioane are; se pot bifa mai multe zile ---- */
  var LUNI_CAL = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
  var incLuna = null;        // luna afisata, "YYYY-MM"
  function deseneazaCalendar(peData, total, areDate) {
    var azi = SC.azi();
    if (!incLuna) {
      /* la prima afisare: luna curenta daca are camioane, altfel luna celei mai recente zile cu camioane */
      var zile = Object.keys(peData).filter(function (d) { return d !== FARA_DATA; }).sort();
      incLuna = (peData[azi] || !zile.length) ? azi.slice(0, 7) : zile[zile.length - 1].slice(0, 7);
    }
    var an = +incLuna.slice(0, 4), luna = +incLuna.slice(5, 7);
    var prima = new Date(an, luna - 1, 1), nrZile = new Date(an, luna, 0).getDate(), decalaj = (prima.getDay() + 6) % 7;   // luni = prima coloana
    var h = '<div class="cal"><div class="cal-sus"><button type="button" class="btn mic" data-luna="-1" aria-label="Luna anterioară">‹</button>' +
      '<b>' + LUNI_CAL[luna - 1] + ' ' + an + '</b><button type="button" class="btn mic" data-luna="1" aria-label="Luna următoare">›</button></div><div class="cal-grila">' +
      ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].map(function (z) { return '<div class="cal-cap">' + z + '</div>'; }).join('');
    for (var g = 0; g < decalaj; g++) h += '<div></div>';
    for (var zi = 1; zi <= nrZile; zi++) {
      var d = incLuna + '-' + SC.p2(zi), n = peData[d] || 0;
      h += '<button type="button" class="zi' + (n ? ' are' : '') + (incDate[d] ? ' activ' : '') + (d === azi ? ' azi' : '') + '" data-d="' + d + '"' + (n || incDate[d] ? '' : ' disabled') +
        ' aria-label="' + zi + ' ' + LUNI_CAL[luna - 1] + (n ? ', ' + n + ' camioane' : ', fără camioane') + '"' + (incDate[d] ? ' aria-pressed="true"' : '') + '><span>' + zi + '</span>' + (n ? '<i>' + n + '</i>' : '') + '</button>';
    }
    var alese = Object.keys(incDate).filter(function (x) { return x !== FARA_DATA; }).sort();
    h += '</div></div><div class="cal-lateral"><button type="button" class="cip' + (areDate ? '' : ' activ') + '" data-d="">Toate datele<b>' + total + '</b></button>' +
      '<button type="button" class="cip" data-azi="1">Azi<b>' + (peData[azi] || 0) + '</b></button>' +
      (peData[FARA_DATA] ? '<button type="button" class="cip' + (incDate[FARA_DATA] ? ' activ' : '') + '" data-d="' + FARA_DATA + '">Fără dată<b>' + peData[FARA_DATA] + '</b></button>' : '') +
      (alese.length ? '' : '<div class="mic">Apasă pe o zi; poți alege mai multe. Cifra de sub zi = câte camioane are.</div>') + '</div>';
    $('incDate').innerHTML = h;
  }
  $('incDate').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.luna) {
      var an = +incLuna.slice(0, 4), luna = +incLuna.slice(5, 7) + (+b.dataset.luna);
      if (luna < 1) { luna = 12; an--; } else if (luna > 12) { luna = 1; an++; }
      incLuna = an + '-' + SC.p2(luna);
    } else if (b.dataset.azi) {
      incDate = {}; incDate[SC.azi()] = 1; incLuna = SC.azi().slice(0, 7);
    } else {
      var d = b.dataset.d;
      if (!d) incDate = {}; else if (incDate[d]) delete incDate[d]; else incDate[d] = 1;
    }
    deseneazaIncarcari();
  });
  $('incLista').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.inc != null) incarcaCamion(camioaneAfisate[+b.dataset.inc]);
    else if (b.dataset.print != null) tiparesteCamion(camioaneAfisate[+b.dataset.print]);
  });
  $('incExtra').addEventListener('click', function (e) {
    var r = e.target.closest('tr.clic'); if (r) editeazaExtra(extraAfisate[+r.dataset.x]);
  });
  /* paletii / amprentele / greutatea pentru o linie doar din transport (nu au comanda in registru, deci se completeaza aici) */
  function editeazaExtra(x) {
    function camp(k, t) { var v = x[k]; return '<label class="camp"><span>' + t + '</span><input type="text" inputmode="decimal" data-e="' + k + '" value="' + esc(SC.esteNum(v) ? String(v).replace('.', ',') : (v || '')) + '"></label>'; }
    modal({
      titlu: 'Linie doar din transport — ' + x.ref, lat: true,
      html: '<div class="nota">' + esc(x.cl || '') + ' · ' + esc(x.de || '') + '<br>Nr AUTO <b>' + esc(x.na || '—') + '</b>' + (x.nt ? ' · transport <b>' + esc(x.nt) + '</b>' : '') + (x.dtr ? ' · ' + esc(SC.fmtDataLunga(x.dtr)) : '') +
        ((x.un != null || x.ma != null) ? '<br>În TMS: ' + (x.un != null ? '<b>' + SC.fmtNum(x.un, 'int') + '</b> unități' : '') + (x.ma != null ? ' · <b>' + SC.fmtNum(x.ma, 'num') + '</b> kg' : '') : '') +
        '<br><span class="mic">Linia vine din fișierul TMS și nu există în registrul de comenzi. Apare în borderoul camionului. Paleții și greutatea sunt preluate din TMS; dacă le corectezi aici, importurile următoare păstrează corecția.</span></div>' +
        '<div class="grila">' + camp('pr', 'Paleți reali') + camp('am', 'Amprente') + camp('gf', 'Greutate finală (kg)') + camp('ca', 'Cartoane') +
        '<label class="camp lat2"><span>Observații</span><input type="text" data-e="ob" value="' + esc(x.ob || '') + '"></label></div>',
      butoane: [{ t: 'Închide', v: null }, {
        t: 'Salvează', cls: 'pri', fn: function (rad) {
          var val = {}, rau = null;
          Array.prototype.forEach.call(rad.querySelectorAll('[data-e]'), function (el) {
            var k = el.dataset.e, v = el.value.trim();
            if (k !== 'ob' && v !== '') { var n = SC.parseNum(v); if (n == null || n < 0) rau = '„' + v + '” nu este un număr valid.'; else v = n; }
            val[k] = v;
          });
          if (rau) { toast(rau, 'rau'); return false; }
          return L.modificaExtra([{
            zi: x._zi, k: x._k, fn: function (l) {
              Object.keys(val).forEach(function (k) {
                var inainte = l[k] == null ? '' : l[k];
                if (String(inainte) === String(val[k])) return;
                if (val[k] === '') delete l[k]; else l[k] = val[k];
                if (k === 'pr') l.prm = 1;          /* corectat de mana: urmatorul import TMS nu il mai suprascrie */
                if (k === 'gf') l.gfm = 1;
              });
            }
          }])
            .then(function () { toast('Linie salvată.', 'bun'); });
        }
      }]
    });
  }
  function incarcaCamion(x) {
    var l = x.deIncarcat;
    var html = '<div class="nota">Camion <b>' + esc(x.na) + '</b>' + (x.nt ? ' · transport <b>' + esc(x.nt) + '</b>' : '') + (x.data ? ' · ' + esc(SC.fmtDataLunga(x.data)) : '') + '</div>' +
      '<div class="lista-mica"><table class="simplu"><tr><th></th><th>Comandă</th><th>Destinatar</th><th class="nr">Paleți</th><th class="nr">Amprente</th></tr>' +
      l.map(function (o, i) {
        return '<tr><td><input type="checkbox" data-i="' + i + '" checked aria-label="Încarcă ' + esc(o.nc) + '"></td><td>' + esc(o.cl) + ' ' + esc(o.nc) +
          (o.extra ? ' <span class="eticheta asteapta">doar transport</span>' : '') + '</td><td>' + esc(o.de || '') + '</td><td class="nr">' +
          SC.fmtNum(o.pr, 'int') + '</td><td class="nr"><input type="text" inputmode="numeric" data-am="' + i + '" value="' + (SC.esteNum(o.am) ? o.am : '') + '" style="width:64px;text-align:right" aria-label="Amprente ' + esc(o.nc) + '"></td></tr>';
      }).join('') + '</table></div><div class="mic">Amprentele pot fi corectate aici, pe fiecare linie, înainte de confirmare.</div>' +
      (x.inLucru.length ? '<div class="nota atentie">' + x.inLucru.length + ' comenzi cu acest număr auto nu sunt încă Terminata și nu pot fi încărcate: ' + esc(x.inLucru.map(function (o) { return o.nc; }).join(', ')) + '</div>' : '') +
      '<div class="grila"><label class="camp"><span>Stare camion</span><select id="iStare"><option>OK</option><option>NOK</option></select></label>' +
      '<label class="camp"><span>Temperatură</span><input type="text" id="iTemp" inputmode="decimal"></label>' +
      '<label class="camp"><span>Semnătură (nume)</span><input type="text" id="iSemn" value="' + esc(SC.store.user.nume) + '"></label></div>' +
      '<div class="mic">Liniile debifate rămân neîncărcate și pot pleca cu alt camion.</div>';
    modal({
      titlu: 'Confirmare încărcare', html: html, lat: true,
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Confirmă încărcarea', cls: 'pri', fn: function (rad) {
          var bife = Array.prototype.filter.call(rad.querySelectorAll('[data-i]'), function (c) { return c.checked; });
          if (!bife.length) { toast('Bifează cel puțin o linie.', 'rau'); return false; }
          var alese = [], amNoi = [], gresit = false;
          bife.forEach(function (c) {
            var o = l[+c.dataset.i], a = citesteIntreg(rad.querySelector('[data-am="' + c.dataset.i + '"]').value, 'Amprente ' + o.nc);
            if (a == null) gresit = true;
            alese.push(o); amNoi.push(a);
          });
          if (gresit) return false;
          alese.forEach(function (o, i) { o._am = amNoi[i]; });
          var stareC = rad.querySelector('#iStare').value, temp = rad.querySelector('#iTemp').value.trim(), semn = rad.querySelector('#iSemn').value.trim();
          if (!semn) { toast('Completează semnătura (numele celui care confirmă).', 'rau'); return false; }
          var acum = SC.dtAcum(), reg = alese.filter(function (o) { return !o.extra; }), ext = alese.filter(function (o) { return o.extra; });
          var text = 'Încărcare ' + x.na + (x.nt ? ' / transport ' + x.nt : '') + ': ' + alese.length + ' linii, camion ' + stareC;
          function pune(o) { o.inc = 'DA'; o.di = acum; o.sc = stareC; o.te = temp; o.se = semn; }
          var p = reg.length ? L.modifica(reg.map(function (c) {
            return { n: c.n, fn: function (o) { if (o.st !== ST.TER) throw L.eroare('Comanda ' + o.nc + ' nu mai are statusul Terminata (acum: ' + o.st + ').'); pune(o); if (c._am !== '') o.am = c._am; } };
          }), text) : Promise.resolve();
          return p.then(function () {
            if (!ext.length) return;
            return L.modificaExtra(ext.map(function (c) { return { zi: c._zi, k: c._k, fn: function (o) { pune(o); if (c._am !== '') o.am = c._am; } }; }), reg.length ? null : text);
          }).then(function () {
            toast('Camion ' + x.na + ': ' + alese.length + (alese.length === 1 ? ' linie încărcată.' : ' linii încărcate.'), 'bun');
            $('incAzi').checked = true; deseneazaIncarcari();
          });
        }
      }]
    });
  }
  /* Borderoul camionului: toate comenzile lui, indiferent de status. La cele neterminate
     paletii reali, amprentele si greutatea finala raman goale (se vad doar paletii estimati). */
  function tiparesteCamion(x) {
    var l = x.toate.slice().sort(function (a, b) { return (a.extra ? 1 : 0) - (b.extra ? 1 : 0) || (a.n || 0) - (b.n || 0); });
    function gata(o) { return o.extra || o.st === ST.TER || o.st === ST.SELF; }
    function val(o, k) {
      if (k === 'pe') return o.extra ? o.pr : o.pe;                       /* la liniile doar din transport estimarea = unitatile din TMS */
      if ((k === 'pr' || k === 'am' || k === 'gf') && !gata(o)) return '';
      return o[k];
    }
    var cols = [['cl', 'Client'], ['nc', 'Nr. Comandă'], ['dl', 'Livrare'], ['de', 'Destinatar'], ['or', 'Oraș'], ['ju', 'Județ'], ['ca', 'Cartoane'], ['pe', 'Paleți estimați'], ['pr', 'Paleți reali'], ['am', 'Amprente'], ['gf', 'Greutate finală']];
    var NUMERICE = { ca: 1, pe: 1, pr: 1, am: 1, gf: 1 };
    function tot(k) { return l.reduce(function (s, o) { var v = val(o, k); return s + (SC.esteNum(v) ? v : 0); }, 0); }
    var neterminate = l.filter(function (o) { return !gata(o); }).length;
    function fppPick(f, p) {
      if (!SC.esteNum(f) && !SC.esteNum(p)) return '';
      return '<div class="fp">' + (SC.esteNum(f) ? 'FPP ' + f : '') + (SC.esteNum(f) && SC.esteNum(p) ? ' · ' : '') + (SC.esteNum(p) ? 'Pick ' + p : '') + '</div>';
    }
    var reg = l.filter(function (o) { return !o.extra; }), areF = reg.some(function (o) { return SC.esteNum(o.fpp); }), areP = reg.some(function (o) { return SC.esteNum(o.pk); });
    var h = '<h1>Borderou de încărcare</h1><div>Nr AUTO: <b>' + esc(x.na) + '</b>' + (x.nt ? ' · Nr transport: <b>' + esc(x.nt) + '</b>' : '') + (x.data ? ' · Data: <b>' + esc(SC.fmtDataLunga(x.data)) + '</b>' : '') +
      (l[0] && l[0].so ? ' · Șofer: ' + esc(l[0].so) : '') + '<!--inceput--> · Tipărit: ' + esc(stampila()) + '</div><table><tr>' +
      cols.map(function (c) { return '<th' + (NUMERICE[c[0]] ? ' class="nr"' : '') + '>' + c[1] + '</th>'; }).join('') + '</tr>';
    l.forEach(function (o) {
      h += '<tr>' + cols.map(function (c) {
        var col = SC.COL[c[0]], v = val(o, c[0]), tmp = {}; tmp[c[0]] = v;
        var text = esc(SC.fmtCelula(tmp, col));
        /* in coloana de paleti estimati apar si FPP / Pick, pe al doilea rand */
        if (c[0] === 'pe' && !o.extra) text += fppPick(o.fpp, o.pk);
        return '<td' + (NUMERICE[c[0]] ? ' class="nr"' : '') + '>' + text + '</td>';
      }).join('') + '</tr>';
    });
    var incarcat = l.filter(function (o) { return o.inc === 'DA'; })[0] || {};
    h += '<tr><th colspan="6">TOTAL (' + l.length + (l.length === 1 ? ' linie' : ' linii') + (neterminate ? ', din care ' + neterminate + (neterminate === 1 ? ' nepregătită' : ' nepregătite') : '') + ')</th><th class="nr">' + SC.fmtNum(tot('ca'), 'int') +
      '</th><th class="nr">' + SC.fmtNum(tot('pe'), 'num') + fppPick(areF ? suma(reg, 'fpp') : null, areP ? suma(reg, 'pk') : null) + '</th><th class="nr">' + SC.fmtNum(tot('pr'), 'int') + '</th><th class="nr">' + SC.fmtNum(tot('am'), 'int') + '</th><th class="nr">' + SC.fmtNum(tot('gf'), 'num') + '</th></tr></table>' +
      '<div class="semnaturi"><div>Stare camion: ' + esc(incarcat.sc || '________') + ' · Temperatură: ' + esc(incarcat.te || '________') + '</div><div>Semnătură depozit: ' + esc(incarcat.se || '________________') + '</div><div>Semnătură șofer: ________________</div></div>';
    /* ora la care s-a tiparit borderoul = inceputul incarcarii; se inregistreaza automat (Administrator / Incarcari) */
    function tipareste(info) {
      $('tiparire').innerHTML = h.replace('<!--inceput-->', info && info.bt ? ' · Început încărcare: <b>' + esc(SC.fmtDT(info.bt).replace(/^(\d\d\.\d\d)\.(\d\d) /, '$1.20$2 ')) + '</b>' : '');
      window.print();
      if (stare.tab === 'incarcari') deseneazaIncarcari();
    }
    if (!poateIncarca()) return tipareste(L.infoCamion(x));
    L.marcheazaBorderou(x).then(tipareste, function (e) {
      toast('Borderoul se tipărește, dar ora de început nu a putut fi înregistrată: ' + (e && e.message ? e.message : e), 'rau');
      tipareste(L.infoCamion(x));
    });
  }
  $('btnTransport').onclick = function () {
    var fisier, p;
    alegeFisier().then(function (f) { fisier = f; toast('Se citește fișierul…'); return new Promise(function (ok) { setTimeout(ok, 50); }).then(function () { return citesteFisier(f); }); }).then(function (wb) {
      p = L.parseTransport(wb);
      if (!p.randuri.length) throw L.eroare('Fișierul nu conține rânduri cu ReferintaClient și Masina.');
      /* In TMS data de incarcare este pe fiecare linie, iar o comanda mutata pe alt camion isi pastreaza data veche.
         Data camionului = data cea mai frecventa dintre liniile transportului (la egalitate, cea mai recenta);
         toate liniile transportului o primesc pe aceasta. */
      var peTr = {};
      p.randuri.forEach(function (r) { if (r.nt && r.dtr) { var m = (peTr[r.nt] = peTr[r.nt] || {}); m[r.dtr] = (m[r.dtr] || 0) + 1; } });
      p.randuri.forEach(function (r) {
        var m = r.nt && peTr[r.nt]; if (!m) return;
        r.dtr = Object.keys(m).sort(function (a, b) { return m[b] - m[a] || (a < b ? 1 : -1); })[0];
      });
      /* fisierul TMS este cumulativ: se proceseaza doar transporturile din ultimele zile (si cele fara data) */
      var prag0 = SC.ziPlus(SC.azi(), -SC.ZILE_EXTRA);
      p.recente = p.randuri.filter(function (r) { return !r.dtr || r.dtr >= prag0; });
      p.vechi = p.randuri.length - p.recente.length;
      /* referintele din TMS au uneori puncte la sfarsit ("AV000071254..") - se potrivesc fara ele */
      p.recente.forEach(function (r) { r.refCurat = String(r.ref).replace(/[.,;:\s]+$/, ''); });
      return L.cautaComenzi(p.recente.map(function (r) { return r.refCurat; }));
    }).then(function (exist) {
      var noi = [], schimbate = [], neschimbate = 0, dejaInc = 0, vazute = {}, perZi = {}, nrExtra = 0, preaVechi = p.vechi;
      var prag = SC.ziPlus(SC.azi(), -SC.ZILE_EXTRA);
      p.recente.forEach(function (r) {
        var k = SC.cheieComanda(r.refCurat);
        var l = (exist[k] || []).filter(function (o) { return o.st !== ST.ANU && !o.tr; });
        if (r.cl && l.length > 1) { var pc = l.filter(function (o) { return SC.normText(r.cl).indexOf(SC.normText(o.cl)) >= 0; }); if (pc.length) l = pc; }
        if (!l.length) {
          /* nu exista in registru -> rubrica separata "doar din transport" (doar transporturile recente) */
          var zi = L.ziExtra(r); (perZi[zi] = perZi[zi] || []);
          if (!perZi[zi].some(function (y) { return L.cheieExtra(y) === L.cheieExtra(r); })) { perZi[zi].push(r); nrExtra++; }
          return;
        }
        vazute[k] = { r: r, l: l };      /* aceeasi referinta pe mai multe transporturi: ramane ultimul (cel mai recent) */
      });
      Object.keys(vazute).forEach(function (k) {
        var r = vazute[k].r, l = vazute[k].l;
        var libere = l.filter(function (o) { return o.inc !== 'DA'; });
        if (!libere.length) { dejaInc++; return; }
        var o = libere[libere.length - 1];
        var acelasiAuto = SC.normNrAuto(o.na) === SC.normNrAuto(r.na);
        if (acelasiAuto && (o.nt || '') === (r.nt || '') && (!r.dtr || (o.dtr || '') === r.dtr)) { neschimbate++; return; }
        if (o.na && !acelasiAuto) schimbate.push({ o: o, r: r }); else noi.push({ o: o, r: r });
      });
      /* zilele deja existente in rubrica separata, din fereastra importului, se recalculeaza si ele (liniile disparute se scot) */
      SC.extra.forEach(function (x) { if (x._zi === 'fara-data' || x._zi >= prag) perZi[x._zi] = perZi[x._zi] || []; });
      var existente = {}; SC.extra.forEach(function (x) { existente[x._zi + '|' + x._k] = 1; });
      var extraNoi = 0; Object.keys(perZi).forEach(function (zi) { perZi[zi].forEach(function (r) { if (!existente[zi + '|' + L.cheieExtra(r)]) extraNoi++; }); });

      var html = '<div class="nota">Fișier: <b>' + esc(fisier.name) + '</b> (foaia „' + esc(p.foaie) + '”, ' + p.randuri.length + ' rânduri)' +
        '<br>Data încărcării: ' + (p.colData ? 'coloana „<b>' + esc(p.colData) + '</b>”' : '<b>nu am găsit o coloană de dată</b> — camioanele vor apărea „fără dată”') + '</div>' +
        '<div><b>Comenzi din registru</b> — Nr AUTO de completat sau actualizat: <b>' + noi.length + '</b> · de schimbat: <b>' + schimbate.length + '</b> · neschimbate: ' + neschimbate + ' · deja încărcate (sărite): ' + dejaInc + '</div>';
      if (schimbate.length) html += '<div class="mic">Numere auto care se schimbă (fișierul de transport are prioritate):</div>' + listaHtml(schimbate.map(function (x) { return x.o.nc + ': ' + x.o.na + ' → ' + x.r.na; }));
      html += '<div><b>Linii care nu există în registru</b> — merg în rubrica separată „Doar din transport” din tabul Încărcări: <b>' + nrExtra + '</b> (din care noi: ' + extraNoi + ')</div>' +
        (preaVechi ? '<div class="mic">Rânduri din fișier cu transport mai vechi de ' + SC.ZILE_EXTRA + ' zile, ignorate: ' + preaVechi + '.</div>' : '') +
        '<div class="mic">Aceste linii nu intră în registrul de comenzi; apar doar la camionul lor și în borderou.</div>';
      if (!noi.length && !schimbate.length && !extraNoi && !nrExtra) return alerta('Nimic de actualizat din „' + fisier.name + '”.');
      return modal({
        titlu: 'Import fișier transport', html: html, lat: true,
        butoane: [{ t: 'Renunță', v: null }, {
          t: 'Aplică', cls: 'pri', fn: function () {
            var toate = noi.concat(schimbate), i = 0;
            function parte() {
              if (i >= toate.length) return Promise.resolve();
              var bucata = toate.slice(i, i + 100); i += 100;
              $('syncText').textContent = 'transport ' + Math.min(i, toate.length) + '/' + toate.length;
              return L.modifica(bucata.map(function (x) {
                return {
                  n: x.o.n, fn: function (o) {
                    if (o.inc === 'DA') return;
                    o.na = x.r.na; if (x.r.nt) o.nt = x.r.nt; if (x.r.so) o.so = x.r.so; if (x.r.re) o.re = x.r.re; if (x.r.dtr) o.dtr = x.r.dtr;
                  }
                };
              }), 'Import transport ' + fisier.name + ': Nr AUTO pe ' + bucata.length + ' comenzi').then(parte);
            }
            return parte().then(function () { return L.importaExtra(perZi, fisier.name); }).then(function (st) {
              marcheazaSync();
              toast('Transport: ' + toate.length + ' comenzi actualizate; linii doar din transport: ' + st.noi + ' noi, ' + st.actualizate + ' actualizate, ' + st.scoase + ' scoase.', 'bun');
              redeseneaza();
            });
          }
        }]
      });
    }).catch(arataEroare);
  };

  /* ================= KPI ================= */
  /* Totul se calculeaza din ce este deja in memorie (comenzile active si recente + liniile din TMS):
     tabul nu face nicio citire in plus din baza de date. */
  var kpiZi = null;          // 'YYYY-MM-DD' = ziua de incarcare; '' = tot ce este neincarcat, indiferent de zi
  var kpiCamioane = [];
  function kGata(o) { return !!o.extra || o.st === ST.TER || o.st === ST.SELF; }
  /* paletii unei comenzi: reali daca e pregatita, altfel estimarea rotunjita in sus */
  function kPal(o) { return kGata(o) ? (SC.esteNum(o.pr) ? o.pr : 0) : (SC.esteNum(o.pe) ? Math.ceil(o.pe) : 0); }
  function kPick(o) {
    if (SC.esteNum(o.pk)) return o.pk;
    return !kGata(o) && SC.esteNum(o.fpp) ? SC.pickPropus(o.fpp, o.pe, null) : null;
  }
  function kGreu(o) { var v = kGata(o) && SC.esteNum(o.gf) ? o.gf : o.g; return SC.esteNum(v) ? v : 0; }
  function kAduna(l) {
    var s = { n: 0, gata: 0, deschise: 0, inc: 0, pal: 0, palReali: 0, palEst: 0, palInc: 0, palDeInc: 0, palRam: 0, fppRam: 0, pkRam: 0, faraRam: 0, extraRam: 0,
      fpp: 0, pk: 0, pkFacut: 0, pkDeFacut: 0, nExtra: 0, am: 0, kg: 0, kgRam: 0, st: {}, estSum: 0, realSum: 0, nEst: 0 };
    l.forEach(function (o) {
      var g = kGata(o), p = kPal(o), inc = o.inc === 'DA', f = SC.esteNum(o.fpp) ? o.fpp : null, k = kPick(o);
      s.n++; s.pal += p; s.kg += kGreu(o);
      if (g) { s.gata++; s.palReali += p; if (SC.esteNum(o.am)) s.am += o.am; } else { s.deschise++; s.palEst += p; }
      if (o.extra) s.nExtra++; else {
        s.st[o.st] = (s.st[o.st] || 0) + 1;
        if (f != null) s.fpp += f;
        if (k != null) { s.pk += k; if (g) s.pkFacut += k; else s.pkDeFacut += k; }
        if (g && SC.esteNum(o.pe) && SC.esteNum(o.pr)) { s.estSum += o.pe; s.realSum += o.pr; s.nEst++; }
      }
      if (inc) { s.inc++; s.palInc += p; return; }
      s.palRam += p; s.kgRam += kGreu(o);
      if (g && o.st !== ST.SELF) s.palDeInc += p;
      if (o.extra) s.extraRam += p;
      else if (f == null && k == null) s.faraRam += p;
      else { s.fppRam += f || 0; s.pkRam += k || 0; }
    });
    return s;
  }
  function kStare(x) {
    var info = L.infoCamion(x), total = x.toate.length, inc = x.incarcate.length, gata = x.toate.filter(kGata).length;
    if (total && inc === total) return ['Încărcat', 'ok', 4];
    if (inc || (info && info.bt)) return ['În încărcare', 'lucru', 3];
    if (gata === total) return ['Gata de încărcat', 'asteapta', 2];
    if (gata || x.toate.some(function (o) { return o.st === ST.LUC; })) return ['În pregătire', 'gri', 1];
    return ['În așteptare', 'gri', 0];
  }
  function nr(v) { return SC.fmtNum(v, 'int') || '0'; }
  function proc(a, b) { return b ? Math.round(a * 100 / b) : 0; }
  function deseneazaKpi() {
    var azi = SC.azi(), client = $('kpiClient').value;
    var opt = '<option value="">Toți clienții</option>' + SC.config.clienti.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    if ($('kpiClient').dataset.opt !== opt) { $('kpiClient').innerHTML = opt; $('kpiClient').dataset.opt = opt; $('kpiClient').value = client; }
    var toate = toateCamioanele();
    if (client) {
      toate = toate.map(function (x) {
        var c = Object.assign({}, x);
        ['toate', 'deIncarcat', 'inLucru', 'incarcate', 'doarTransport'].forEach(function (k) { c[k] = x[k].filter(function (o) { return o.cl === client; }); });
        return c;
      }).filter(function (x) { return x.toate.length; });
    }
    var peZi = {}, neinc = 0;
    toate.forEach(function (x) {
      if (x.data) peZi[x.data] = (peZi[x.data] || 0) + 1;
      if (x.deIncarcat.length || x.inLucru.length) neinc++;
    });
    if (kpiZi == null) {
      /* la prima deschidere: azi daca are camioane, altfel prima zi viitoare cu camioane, altfel azi */
      var viitoare = Object.keys(peZi).filter(function (d) { return d >= azi; }).sort();
      kpiZi = peZi[azi] ? azi : (viitoare[0] || azi);
    }
    $('kpiData').value = kpiZi;
    $('kpiOra').textContent = 'actualizat ' + SC.oraAcum() + ' · se reface singur la fiecare modificare';
    var zile = Object.keys(peZi).filter(function (d) { return d >= SC.ziPlus(azi, -2); }).sort().slice(0, 9);
    if (kpiZi && zile.indexOf(kpiZi) < 0) { zile.push(kpiZi); zile.sort(); }
    $('kpiZile').innerHTML = zile.map(function (d) {
      return '<button type="button" class="cip' + (d === kpiZi ? ' activ' : '') + '" data-d="' + d + '">' + (d === azi ? 'Azi' : (d === SC.ziPlus(azi, 1) ? 'Mâine' : esc(SC.fmtDataLunga(d)))) + '<b>' + (peZi[d] || 0) + '</b></button>';
    }).join('') + '<button type="button" class="cip' + (kpiZi === '' ? ' activ' : '') + '" data-d="">Tot ce e neîncărcat<b>' + neinc + '</b></button>';

    var cam = kpiZi === '' ? toate.filter(function (x) { return x.deIncarcat.length || x.inLucru.length; }) : toate.filter(function (x) { return x.data === kpiZi; });
    var comenzi = [];
    cam.forEach(function (x) { x.k = kAduna(x.toate); x.stare = kStare(x); comenzi = comenzi.concat(x.toate); });
    var s = kAduna(comenzi), h = '';
    /* comenzile active care nu au inca un camion */
    var fara = SC.comenzi.filter(function (o) {
      return !o.ar && SC.esteActiva(o) && (!o.na || !SC.normNrAuto(o.na).replace(/0/g, '')) && (!client || o.cl === client);
    }), sf = kAduna(fara);
    var faraPanaLa = kpiZi ? fara.filter(function (o) { return o.dl && String(o.dl).slice(0, 10) <= kpiZi; }) : fara;

    if (!cam.length) {
      h += '<div class="card"><div class="mic">Niciun camion ' + (kpiZi ? 'cu data de încărcare ' + esc(SC.fmtDataLunga(kpiZi)) : 'neîncărcat') + (client ? ' pentru ' + esc(client) : '') +
        '. Data de încărcare vine din fișierul de transport (TMS): dacă ziua lipsește, importă fișierul la zi din tabul Încărcări.</div></div>';
    } else {
      var st = [0, 0, 0, 0, 0];
      cam.forEach(function (x) { st[x.stare[2]]++; });
      var durate = [];
      cam.forEach(function (x) {
        var info = L.infoCamion(x), sf2 = '';
        x.incarcate.forEach(function (o) { if (o.di && String(o.di) > sf2) sf2 = String(o.di); });
        x.inceput = info && info.bt ? info.bt : ''; x.sfarsit = x.stare[2] === 4 ? sf2 : '';
        x.durata = x.inceput && x.sfarsit.length > 10 && x.sfarsit >= x.inceput ? Math.round((SC.msDin(x.sfarsit.slice(0, 10), x.sfarsit.slice(11, 16)) - SC.msDin(x.inceput.slice(0, 10), x.inceput.slice(11, 16))) / 60000) : null;
        if (x.durata != null) durate.push(x.durata);
      });
      var medie = durate.length ? Math.round(durate.reduce(function (a, b) { return a + b; }, 0) / durate.length) : null;
      var abatere = s.estSum ? Math.round((s.realSum - s.estSum) * 1000 / s.estSum) / 10 : null;
      function tile(t, v, sub, accent) { return '<div class="kpi' + (accent ? ' accent' : '') + '"><div class="t">' + t + '</div><div class="v">' + v + '</div><div class="s">' + sub + '</div></div>'; }
      h += '<div class="kpi-grila">' +
        tile('Paleți de încărcat', nr(s.palRam), '<b>' + nr(s.palDeInc) + '</b> reali, gata de încărcat · <b>~' + nr(s.palEst) + '</b> estimați, în pregătire<br>deja încărcați: <b>' + nr(s.palInc) + '</b> din ' + nr(s.pal), true) +
        tile('FPP (paleți full)', nr(s.fppRam), 'de încărcat · total pe zi: <b>' + nr(s.fpp) + '</b>') +
        tile('Pick (paleți din picking)', nr(s.pkRam), 'de încărcat · făcuți: <b>' + nr(s.pkFacut) + '</b> · de făcut: <b>' + nr(s.pkDeFacut) + '</b>') +
        tile('Camioane', cam.length, 'încărcate <b>' + st[4] + '</b> · în încărcare <b>' + st[3] + '</b> · gata <b>' + st[2] + '</b><br>în pregătire <b>' + st[1] + '</b> · în așteptare <b>' + st[0] + '</b>') +
        tile('Comenzi', s.n, [ST.INI, ST.LUC, ST.TER, ST.SELF].filter(function (k) { return s.st[k]; }).map(function (k) { return esc(k) + ' <b>' + s.st[k] + '</b>'; }).join(' · ') +
          (s.nExtra ? '<br>doar din transport <b>' + s.nExtra + '</b>' : '')) +
        tile('Greutate de încărcat', SC.fmtNum(Math.round(s.kgRam), 'int') + ' <small>kg</small>', 'total pe zi: <b>' + SC.fmtNum(Math.round(s.kg), 'int') + ' kg</b> · amprente (pregătite): <b>' + nr(s.am) + '</b>') +
        tile('Durată medie de încărcare', medie == null ? '—' : medie + ' <small>min</small>', durate.length ? 'pe ' + durate.length + (durate.length === 1 ? ' camion încărcat' : ' camioane încărcate') + ' · de la tipărirea borderoului la confirmare' : 'apare după primul camion încărcat cu borderou tipărit') +
        tile('Estimare față de real', abatere == null ? '—' : (abatere > 0 ? '+' : '') + String(abatere).replace('.', ',') + ' <small>%</small>', s.nEst ? 'estimat <b>' + SC.fmtNum(s.estSum, 'num') + '</b> · real <b>' + nr(s.realSum) + '</b> paleți, pe ' + s.nEst + ' comenzi pregătite' : 'apare după prima comandă pregătită') +
        '</div>';
      /* din ce sunt facuti paletii ramasi + cat s-a pregatit / incarcat */
      var totRam = s.fppRam + s.pkRam + s.faraRam + s.extraRam || 1;
      function seg(cls, v) { return v ? '<i class="' + cls + '" style="width:' + (v * 100 / totRam) + '%"></i>' : ''; }
      function linie(nume, a, b, cls) { return '<div>' + nume + '</div><div class="bara-p" role="img" aria-label="' + nume + ': ' + proc(a, b) + '%"><i class="' + cls + '" style="width:' + proc(a, b) + '%"></i></div><div class="dr"><b>' + proc(a, b) + '%</b> · ' + nr(a) + ' / ' + nr(b) + '</div>'; }
      h += '<div class="kpi-doua"><div class="card"><h2>Paleții de încărcat, pe tipuri</h2>' +
        '<div class="bara-p" style="height:18px" role="img" aria-label="FPP ' + s.fppRam + ', Pick ' + s.pkRam + ', fără FPP/Pick ' + s.faraRam + ', doar din transport ' + s.extraRam + '">' + seg('c-fpp', s.fppRam) + seg('c-pick', s.pkRam) + seg('c-fara', s.faraRam) + seg('c-extra', s.extraRam) + '</div>' +
        '<div class="legenda"><span style="--c:var(--navy)">FPP <b>' + nr(s.fppRam) + '</b></span><span style="--c:#e08a00">Pick <b>' + nr(s.pkRam) + '</b></span>' +
        '<span style="--c:#9aa3b5">fără FPP / Pick completat <b>' + nr(s.faraRam) + '</b></span><span style="--c:#7b61c9">doar din transport <b>' + nr(s.extraRam) + '</b></span></div>' +
        '<div class="progres" style="margin-top:14px">' + linie('Pregătire (paleți)', s.palReali, s.pal, 'c-ok') + linie('Picking (paleți)', s.pkFacut, s.pk, 'c-pick') + linie('Încărcare (paleți)', s.palInc, s.pal, 'c-fpp') + linie('Camioane încărcate', st[4], cam.length, 'c-fpp') + '</div></div>';
      /* pe clienti */
      var peCl = {};
      comenzi.forEach(function (o) { (peCl[o.cl || '—'] = peCl[o.cl || '—'] || []).push(o); });
      h += '<div class="card"><h2>Pe clienți</h2><div class="derulare-x"><table class="simplu"><tr><th>Client</th><th class="nr">Comenzi</th><th class="nr">Paleți</th><th class="nr">FPP</th><th class="nr">Pick</th><th class="nr">Încărcați</th></tr>' +
        Object.keys(peCl).sort(function (a, b) { return kAduna(peCl[b]).pal - kAduna(peCl[a]).pal; }).map(function (c) {
          var k = kAduna(peCl[c]);
          return '<tr><td><b>' + esc(c) + '</b></td><td class="nr">' + k.n + '</td><td class="nr">' + nr(k.pal) + '</td><td class="nr">' + nr(k.fpp) + '</td><td class="nr">' + nr(k.pk) + '</td><td class="nr">' + nr(k.palInc) + '</td></tr>';
        }).join('') + '</table></div></div></div>';
      /* fiecare camion */
      var maxPal = Math.max.apply(null, cam.map(function (x) { return x.k.pal; }).concat([1]));
      cam.sort(function (a, b) { return a.stare[2] - b.stare[2] || (a.data || '9').localeCompare(b.data || '9') || b.k.pal - a.k.pal; });
      kpiCamioane = cam;
      function ora(dt) { return dt ? (dt.slice(0, 10) === azi ? dt.slice(11, 16) : SC.fmtDT(dt)) : ''; }
      h += '<div class="card"><h2>Camioane <span class="inc-sub">' + cam.length + (cam.length === 1 ? ' camion' : ' camioane') + ' · ' + nr(s.pal) + ' paleți</span></h2>' +
        '<p>Paleții sunt reali la comenzile pregătite și estimați (rotunjiți în sus, porțiunea hașurată) la cele nepregătite. Apasă pe un camion ca să îl deschizi în Încărcări.</p>' +
        '<div class="derulare-x"><table class="simplu"><tr>' + (kpiZi === '' ? '<th>Data</th>' : '') + '<th>Nr AUTO</th><th>Nr transport</th><th>Stare</th><th class="nr">Comenzi gata</th><th class="nr">Paleți</th><th style="width:16%"></th>' +
        '<th class="nr">FPP</th><th class="nr">Pick</th><th class="nr">Amprente</th><th class="nr">Greutate</th><th>Început încărcare</th><th>Încărcat</th></tr>' +
        cam.map(function (x, i) {
          var k = x.k;
          return '<tr class="clic" data-cam="' + i + '">' + (kpiZi === '' ? '<td>' + esc(x.data ? SC.fmtDataLunga(x.data) : '—') + '</td>' : '') + '<td><b>' + esc(x.na || '—') + '</b></td><td>' + esc(x.nt) + '</td><td><span class="eticheta ' + x.stare[1] + '">' + x.stare[0] + '</span></td>' +
            '<td class="nr">' + k.gata + ' / ' + k.n + '</td><td class="nr"><b>' + nr(k.pal) + '</b>' + (k.palEst ? ' <span class="mic">(~' + nr(k.palEst) + ' est.)</span>' : '') + '</td>' +
            '<td><div class="bara-p" role="img" aria-label="' + k.palReali + ' reali, ' + k.palEst + ' estimați"><i class="c-fpp" style="width:' + (k.palReali * 100 / maxPal) + '%"></i><i class="c-est" style="width:' + (k.palEst * 100 / maxPal) + '%"></i></div></td>' +
            '<td class="nr">' + nr(k.fpp) + '</td><td class="nr">' + nr(k.pk) + '</td><td class="nr">' + (k.am ? nr(k.am) : '') + '</td><td class="nr">' + SC.fmtNum(Math.round(k.kg), 'int') + '</td>' +
            '<td>' + esc(ora(x.inceput)) + '</td><td>' + (x.sfarsit ? esc(ora(x.sfarsit)) + (x.durata != null ? ' <span class="mic">(' + x.durata + ' min)</span>' : '') : '') + '</td></tr>';
        }).join('') +
        '<tr><th colspan="' + (kpiZi === '' ? 4 : 3) + '">Total</th><th class="nr">' + s.gata + ' / ' + s.n + '</th><th class="nr">' + nr(s.pal) + '</th><th></th><th class="nr">' + nr(s.fpp) + '</th><th class="nr">' + nr(s.pk) + '</th><th class="nr">' + nr(s.am) + '</th><th class="nr">' + SC.fmtNum(Math.round(s.kg), 'int') + '</th><th colspan="2"></th></tr></table></div></div>';
    }
    h += '<div class="card"><h2>Comenzi active fără camion alocat</h2><p>Comenzi deschise sau terminate și neîncărcate care nu au încă Nr AUTO, deci nu apar la niciun camion.</p>' +
      (fara.length ? '<div class="kpi-grila">' +
        '<div class="kpi"><div class="t">Comenzi</div><div class="v">' + sf.n + '</div><div class="s">' + [ST.INI, ST.LUC, ST.TER].filter(function (k) { return sf.st[k]; }).map(function (k) { return esc(k) + ' <b>' + sf.st[k] + '</b>'; }).join(' · ') + '</div></div>' +
        '<div class="kpi"><div class="t">Paleți</div><div class="v">' + nr(sf.pal) + '</div><div class="s">reali <b>' + nr(sf.palReali) + '</b> · estimați <b>~' + nr(sf.palEst) + '</b></div></div>' +
        '<div class="kpi"><div class="t">FPP / Pick</div><div class="v">' + nr(sf.fpp) + ' <small>/</small> ' + nr(sf.pk) + '</div><div class="s">picking de făcut: <b>' + nr(sf.pkDeFacut) + '</b></div></div>' +
        (kpiZi ? '<div class="kpi"><div class="t">Cu livrare până la ' + esc(SC.fmtData(kpiZi)) + '</div><div class="v">' + faraPanaLa.length + '</div><div class="s"><b>' + nr(kAduna(faraPanaLa).pal) + '</b> paleți · au nevoie de camion</div></div>' : '') +
        '</div>' : '<div class="mic">Toate comenzile active au camion alocat.</div>') + '</div>' +
      '<div class="mic">Cifrele se calculează din comenzile active și din cele recente aflate deja în aplicație; pentru zile mai vechi de câteva zile, camioanele deja încărcate pot lipsi.</div>';
    $('kpiCorp').innerHTML = h;
  }
  function kpiMuta(zile) { kpiZi = SC.ziPlus(kpiZi || SC.azi(), zile); deseneazaKpi(); }
  $('kpiPrev').onclick = function () { kpiMuta(-1); };
  $('kpiNext').onclick = function () { kpiMuta(1); };
  $('kpiData').onchange = function () { if (this.value) { kpiZi = this.value; deseneazaKpi(); } };
  $('kpiClient').onchange = deseneazaKpi;
  $('kpiZile').addEventListener('click', function (e) { var b = e.target.closest('.cip'); if (!b) return; kpiZi = b.dataset.d; deseneazaKpi(); });
  $('kpiCorp').addEventListener('click', function (e) {
    var r = e.target.closest('[data-cam]'); if (!r) return;
    var x = kpiCamioane[+r.dataset.cam]; if (!x) return;
    $('incCauta').value = x.nt || x.na; arataTab('incarcari');
  });

  /* ================= ADRESE ================= */
  var adreseAfisate = [];
  function deseneazaAdrese() {
    var cuv = SC.normText($('adrCauta').value).split(' ').filter(Boolean), cl = $('adrClient').value;
    var l = SC.adrese.filter(function (a) {
      if (cl && a.cl !== cl) return false;
      if (!cuv.length) return true;
      var h = SC.normText([a.cl, a.cod, a.nume, a.str, a.loc, a.jud].join(' '));
      return cuv.every(function (c) { return h.indexOf(c) >= 0; });
    });
    adreseAfisate = l.slice(0, 400);
    $('adrNumar').textContent = l.length + ' adrese' + (l.length > 400 ? ' (afișate primele 400 — restrânge căutarea)' : '');
    $('adrLista').innerHTML = '<table class="simplu"><tr><th>Client</th><th>Cod</th><th>Nume</th><th>Stradă</th><th>Localitate</th><th>Județ</th></tr>' +
      adreseAfisate.map(function (a, i) {
        return '<tr class="clic" data-i="' + i + '"><td>' + esc(a.cl) + '</td><td>' + esc(a.cod) + '</td><td>' + esc(a.nume) + '</td><td>' + esc(a.str) + '</td><td>' + esc(a.loc) + '</td><td>' + esc(a.jud) + '</td></tr>';
      }).join('') + '</table>';
  }
  var tAdr = null;
  $('adrCauta').addEventListener('input', function () { clearTimeout(tAdr); tAdr = setTimeout(deseneazaAdrese, 180); });
  $('adrClient').onchange = deseneazaAdrese;
  function formAdresa(a) {
    var nou = !a; a = a || {};
    var edit = poate();
    function c(k, t, lat) { return '<label class="camp' + (lat ? ' lat2' : '') + '"><span>' + t + '</span><input type="text" data-a="' + k + '" value="' + esc(a[k] || '') + '"' + (edit ? '' : ' readonly') + '></label>'; }
    var html = '<div class="grila"><label class="camp"><span>Client</span><select data-a="cl"' + (edit ? '' : ' disabled') + '>' +
      SC.config.clienti.concat(a.cl && SC.config.clienti.indexOf(a.cl) < 0 ? [a.cl] : []).map(function (x) { return '<option' + (x === a.cl ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') +
      '</select></label>' + c('cod', 'Cod') + c('nume', 'Nume', 1) + c('str', 'Stradă', 1) + c('loc', 'Localitate') + c('jud', 'Județ') + '</div>';
    var butoane = [{ t: 'Închide', v: null }];
    function citeste(rad) {
      var r = { id: a.id, _c: a._c };
      Array.prototype.forEach.call(rad.querySelectorAll('[data-a]'), function (el) { r[el.dataset.a] = el.value.trim(); });
      return r;
    }
    if (edit && !nou) butoane.push({
      t: 'Șterge', cls: 'rosu', fn: function (rad) {
        return confirma('Ștergi adresa „' + a.nume + '”?').then(function (ok) { return ok ? L.salveazaAdresa(citeste(rad), true).then(function () { toast('Adresă ștearsă.'); }) : false; });
      }
    });
    if (edit) butoane.push({
      t: 'Salvează', cls: 'pri', fn: function (rad) {
        var r = citeste(rad);
        if (!r.nume) { toast('Completează numele.', 'rau'); return false; }
        if (r.cod) {
          var ex = L.adresaDupaCod(r.cl, r.cod);
          if (ex && ex.id !== r.id) { toast('Codul ' + r.cod + ' există deja la ' + r.cl + ': ' + ex.nume, 'rau'); return false; }
        }
        return L.salveazaAdresa(r).then(function () { toast('Adresă salvată.', 'bun'); });
      }
    });
    modal({ titlu: nou ? 'Adresă nouă' : 'Adresă', html: html, lat: true, butoane: butoane });
  }
  $('btnAdresaNoua').onclick = function () { formAdresa(null); };
  $('adrLista').addEventListener('click', function (e) { var r = e.target.closest('tr.clic'); if (r) formAdresa(adreseAfisate[+r.dataset.i]); });

  /* ================= ADMINISTRARE ================= */
  function candidatiArhivare(zile) {
    var prag = SC.ziPlus(SC.azi(), -zile);
    return SC.comenzi.filter(function (o) { return !o.ar && o.st === ST.TER && o.inc !== 'DA' && (!o.dp || String(o.dp) < prag); });
  }
  function deseneazaAdmin() {
    if (!eAdmin()) { $('pag-admin').innerHTML = ''; return; }
    var a = document.activeElement;
    if (a && $('pag-admin').contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;   // nu stricam ce se tasteaza
    var h = '<div class="card"><h2>Utilizatori</h2><p>Fiecare coleg intră cu numele lui și un PIN de 6 cifre. PIN-ul uitat se rezolvă dezactivând contul și creând unul nou cu același nume.<br>' +
      '<b>Administrator</b>: toate drepturile. <b>Operator date</b>: comenzi (adaugă, modifică, statusuri), importuri borderou / Excel / fișier TMS, adrese. ' +
      '<b>Încărcări</b>: doar tabul Încărcări (confirmă camioane, tipărește borderoul). <b>Transport</b>: vede comenzile și poate modifica doar Nr AUTO.</p>' +
      '<div class="derulare-x"><table class="simplu"><tr><th>Nume</th><th>Rol</th><th>Stare</th><th></th></tr>' +
      stare.utilizatori.map(function (d) {
        var u = d.data, eu = d.id === SC.store.user.uid;
        return '<tr><td>' + esc(u.nume) + (eu ? ' (tu)' : '') + '</td><td><select data-rol="' + d.id + '"' + (eu ? ' disabled' : '') + '>' +
          Object.keys(SC.ROLURI).map(function (r) { return '<option value="' + r + '"' + (r === u.rol ? ' selected' : '') + '>' + SC.ROLURI[r] + '</option>'; }).join('') +
          '</select></td><td>' + (u.activ ? '<span class="eticheta ok">activ</span>' : '<span class="eticheta asteapta">dezactivat</span>') + '</td><td>' +
          (eu ? '' : '<button class="btn mic" data-activ="' + d.id + '">' + (u.activ ? 'Dezactivează' : 'Activează') + '</button>') + '</td></tr>';
      }).join('') + '</table></div>' +
      '<div class="rand-form" style="margin-top:10px"><label class="camp"><span>Nume</span><input type="text" id="uNume" maxlength="40"></label>' +
      '<label class="camp"><span>PIN (6 cifre)</span><input type="text" id="uPin" inputmode="numeric" maxlength="6" style="width:110px"></label>' +
      '<label class="camp"><span>Rol</span><select id="uRol">' + ['operator', 'incarcari', 'transport', 'admin'].map(function (x) { return '<option value="' + x + '">' + SC.ROLURI[x] + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn pri" id="uAdauga">Adaugă utilizator</button></div></div>';

    h += '<div class="card"><h2>Clienți și reguli</h2><p>Lista de clienți din formulare și regula de greutate finală automată (greutate + paleți reali × kg/palet).</p>' +
      '<div class="rand-form"><label class="camp" style="flex:1;min-width:260px"><span>Clienți (separați prin virgulă)</span><input type="text" id="cClienti" value="' + esc(SC.config.clienti.join(', ')) + '"></label>' +
      '<label class="camp"><span>Client cu greutate automată</span><input type="text" id="cAuto" value="' + esc(SC.config.clientGreutateAuto) + '" style="width:150px"></label>' +
      '<label class="camp"><span>Kg / palet</span><input type="text" id="cKg" value="' + esc(SC.config.kgPalet) + '" style="width:80px"></label>' +
      '<label class="camp"><span>Toleranță paleți (±)</span><input type="text" id="cTol" value="' + esc(SC.config.tolerantaPaleti) + '" style="width:80px"></label>' +
      '<button class="btn pri" id="cSalveaza">Salvează</button></div></div>';

    var cand = candidatiArhivare(14).length;
    h += '<div class="card"><h2>Arhivare comenzi neîncărcate</h2><p>Comenzile Terminata fără confirmare de încărcare rămân „active” și se încarcă la fiecare deschidere a aplicației. Arhivarea le scoate din lista activă (rămân în istoric, neschimbate).</p>' +
      '<div class="rand-form"><label class="camp"><span>Mai vechi de (zile)</span><input type="text" id="aZile" value="14" style="width:80px"></label>' +
      '<button class="btn" id="aArhiveaza">Arhivează</button><span class="mic">Acum: ' + cand + ' comenzi mai vechi de 14 zile.</span></div></div>';

    var deCuratat = SC.comenzi.filter(function (o) { return o.tr; }).length;
    if (deCuratat) {
      h += '<div class="card"><h2>Curățare: linii din transport ajunse în registru</h2><p>În registrul de comenzi sunt <b>' + deCuratat + '</b> rânduri adăugate dintr-un import mai vechi al fișierului de transport (eticheta „TRANSPORT: …”). ' +
        'Le poți scoate de aici; la următorul import al fișierului TMS, liniile recente apar în rubrica separată „Doar din transport”.</p>' +
        '<div class="rand-form"><button class="btn rosu" id="xCurata">Scoate cele ' + deCuratat + ' rânduri din registru</button></div></div>';
    }
    h += '<div class="card"><h2>Migrare din Excel</h2><p>Încarcă registrul „Status Comenzi” (.xlsm): toate comenzile, cu Nr Crt păstrat, și foaia Adrese. <b>Înlocuiește tot ce există</b> în aplicație — se folosește la pornire și, dacă e nevoie, încă o dată în ziua trecerii de pe Excel.</p>' +
      '<div class="rand-form"><button class="btn" id="mMigrare">Alege fișierul și migrează…</button></div></div>';

    h += '<div class="card"><h2>Jurnal de modificări</h2><p>Fiecare modificare, cu cine a făcut-o, valoarea veche și cea nouă. Alege ziua; opțional caută un număr de comandă sau un nume.</p><div class="rand-form"><input type="date" id="jZi" value="' + SC.azi() + '" aria-label="Ziua">' +
      '<input type="search" id="jFiltru" placeholder="Comandă, utilizator, câmp…" aria-label="Caută în jurnal">' +
      '<button class="btn" id="jArata">Arată</button><span class="mic" id="jNumar"></span></div><div id="jLista" style="margin-top:10px"></div></div>';

    h += '<div class="card"><h2>Despre consum (plan gratuit Firebase)</h2><p>Comenzile sunt păstrate în grupe de ' + SC.MARIME_GRUPA + ', iar aplicația urmărește în timp real doar grupele cu comenzi active și pe cele recente. ' +
      'Acum sunt încărcate ' + Object.keys(SC.grupe).length + ' grupe (' + SC.comenzi.length + ' comenzi). Consumul real se vede în consola Firebase → Firestore → Usage.</p></div>';
    $('pag-admin').innerHTML = h;
  }
  function schimbaUtilizator(uid, fn) {
    return SC.store.tx(function (t) {
      return Promise.all([t.get('utilizatori', uid), t.get('public', 'nume')]).then(function (r) {
        var u = r[0], p = r[1] || { lista: [] };
        if (!u) throw L.eroare('Utilizatorul nu mai există.');
        fn(u);
        p.lista = (p.lista || []).filter(function (x) { return x.e !== u.email; });
        if (u.activ) p.lista.push({ n: u.nume, e: u.email });
        t.set('utilizatori', uid, u); t.set('public', 'nume', p);
        t.log('Utilizator ' + u.nume + ': ' + SC.ROLURI[u.rol] + ', ' + (u.activ ? 'activ' : 'dezactivat'));
      });
    });
  }
  $('pag-admin').addEventListener('change', function (e) {
    var s = e.target.closest('[data-rol]');
    if (s) { var v = s.value; schimbaUtilizator(s.dataset.rol, function (u) { u.rol = v; }).then(function () { toast('Rol schimbat.', 'bun'); }, arataEroare); }
  });
  $('pag-admin').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.activ) {
      schimbaUtilizator(b.dataset.activ, function (u) { u.activ = !u.activ; }).then(function () { toast('Utilizator actualizat.', 'bun'); }, arataEroare);
    } else if (b.id === 'uAdauga') {
      var nume = $('uNume').value.trim(), pin = $('uPin').value.trim(), rol = $('uRol').value;
      if (nume.length < 2) return toast('Scrie numele.', 'rau');
      if (!/^\d{6}$/.test(pin)) return toast('PIN-ul are exact 6 cifre.', 'rau');
      if (stare.utilizatori.some(function (d) { return d.data.activ && SC.normText(d.data.nume) === SC.normText(nume); })) return toast('Există deja un utilizator activ cu acest nume.', 'rau');
      b.disabled = true;
      SC.store.creeazaUtilizator(nume, pin, rol).then(function () {
        b.disabled = false; $('uNume').value = ''; $('uPin').value = ''; toast('Utilizator adăugat: ' + nume, 'bun'); deseneazaAdmin();
      }, function (er) { b.disabled = false; arataEroare(er); });
    } else if (b.id === 'cSalveaza') {
      var clienti = $('cClienti').value.split(',').map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
      var kg = SC.parseNum($('cKg').value), tol = SC.parseNum($('cTol').value);
      if (!clienti.length || kg == null || tol == null) return toast('Verifică valorile.', 'rau');
      var cfg = Object.assign({}, SC.config, { clienti: clienti, clientGreutateAuto: $('cAuto').value.trim().toUpperCase(), kgPalet: kg, tolerantaPaleti: tol });
      SC.store.tx(function (t) { t.set('meta', 'config', cfg); t.log('Configurare: clienți / reguli modificate'); }).then(function () { toast('Salvat.', 'bun'); }, arataEroare);
    } else if (b.id === 'aArhiveaza') {
      var zile = SC.parseNum($('aZile').value);
      if (zile == null || zile < 1) return toast('Numărul de zile nu este valid.', 'rau');
      var l = candidatiArhivare(zile);
      if (!l.length) return toast('Nu există comenzi Terminata neîncărcate mai vechi de ' + zile + ' zile.');
      confirma(l.length + ' comenzi Terminata fără confirmare de încărcare, pregătite acum mai mult de ' + zile + ' zile, vor fi arhivate.\nDatele lor nu se schimbă. Continui?').then(function (ok) {
        if (!ok) return;
        var i = 0;
        function parte() {
          if (i >= l.length) return Promise.resolve();
          var buc = l.slice(i, i + 150); i += 150;
          return L.modifica(buc.map(function (o) { return { n: o.n, fn: function (x) { if (x.st === ST.TER && x.inc !== 'DA') x.ar = 1; } }; }), 'Arhivare: ' + buc.length + ' comenzi neîncărcate', { faraDetalii: true }).then(parte);
        }
        return parte().then(function () { toast('Arhivate ' + l.length + ' comenzi.', 'bun'); deseneazaAdmin(); });
      }).catch(arataEroare);
    } else if (b.id === 'xCurata') {
      var deSters = SC.comenzi.filter(function (o) { return o.tr; }).map(function (o) { return o.n; });
      confirma(deSters.length + ' rânduri adăugate din fișierul de transport vor fi șterse din registrul de comenzi.\nComenzile venite din borderou, Excel sau introduse manual nu sunt atinse. Continui?').then(function (ok) {
        if (!ok) return;
        b.disabled = true; toast('Curățare în curs…');
        return L.sterge(deSters, 'Curățare: scoase din registru liniile adăugate din transport').then(function () {
          /* daca randurile sterse erau ultimele numere alocate, contorul Nr Crt revine la ultima comanda reala */
          return SC.store.tx(function (t) {
            return t.get('meta', 'contor').then(function (c) {
              var ultim = (c && c.ultim) || 0, maxRamas = SC.comenzi.length ? SC.comenzi[SC.comenzi.length - 1].n : 0;
              var peste = deSters.filter(function (n) { return n > maxRamas; }).length;
              if (maxRamas > 0 && maxRamas < ultim && peste === ultim - maxRamas) { t.set('meta', 'contor', { ultim: maxRamas }); return maxRamas; }
              return ultim;
            });
          });
        }).then(function (ultim) { toast('Scoase ' + deSters.length + ' rânduri. Următorul Nr Crt: ' + (ultim + 1) + '.', 'bun'); deseneazaAdmin(); redeseneaza(); });
      }).catch(arataEroare);
    } else if (b.id === 'mMigrare') {
      migrare();
    } else if (b.id === 'jArata') {
      var zi = $('jZi').value, cuv = SC.normText($('jFiltru').value).split(' ').filter(Boolean);
      SC.store.citesteInterval('jurnal', zi + '_', zi + '_\uf8ff').then(function (docs) {
        var e2 = [];
        docs.forEach(function (d) { if (d.data && d.data.e) e2 = e2.concat(d.data.e); });
        var randuri = e2.map(function (x) { var p = x.split('|'); return { t: +p[0], u: p[1], x: p.slice(2).join('|') }; }).sort(function (a2, b2) { return b2.t - a2.t; });
        var total = randuri.length;
        if (cuv.length) randuri = randuri.filter(function (r2) { var h2 = SC.normText(r2.u + ' ' + r2.x); return cuv.every(function (c) { return h2.indexOf(c) >= 0; }); });
        $('jNumar').textContent = total ? randuri.length + ' din ' + total + ' înregistrări' : '';
        if (!randuri.length) { $('jLista').innerHTML = '<div class="mic">' + (total ? 'Nicio înregistrare nu corespunde căutării.' : 'Nicio modificare înregistrată în ' + esc(SC.fmtDataLunga(zi)) + '.') + '</div>'; return; }
        var totalFiltrat = randuri.length; randuri = randuri.slice(0, 1500);
        if (totalFiltrat > 1500) $('jNumar').textContent += ' — afișate primele 1500, restrânge cu căutarea';
        $('jLista').innerHTML = '<div class="lista-mica" style="max-height:420px"><table class="simplu"><tr><th>Ora</th><th>Cine</th><th>Ce</th></tr>' +
          randuri.map(function (r) { var dt = new Date(r.t); return '<tr><td>' + SC.p2(dt.getHours()) + ':' + SC.p2(dt.getMinutes()) + ':' + SC.p2(dt.getSeconds()) + '</td><td>' + esc(r.u) + '</td><td>' + esc(r.x) + '</td></tr>'; }).join('') + '</table></div>';
      }, arataEroare);
    }
  });
  function migrare() {
    var fisier, p, m;
    alegeFisier().then(function (f) {
      fisier = f; toast('Se citește fișierul… (câteva secunde)');
      return new Promise(function (ok) { setTimeout(ok, 50); }).then(function () { return citesteFisier(f); });
    }).then(function (wb) {
      p = L.parseRegistru(wb);
      if (!p.comenzi.length) throw L.eroare('Fișierul nu conține comenzi.');
      m = L.construiesteMigrare(p.comenzi, 7);
      var s = m.stat;
      var html = '<div class="nota">Fișier: <b>' + esc(fisier.name) + '</b></div>' +
        '<table class="simplu"><tr><td>Comenzi</td><td class="nr"><b>' + s.total + '</b></td></tr>' +
        SC.STATUSURI.map(function (st) { return '<tr><td>&nbsp;&nbsp;' + st + '</td><td class="nr">' + (s.peStatus[st] || 0) + '</td></tr>'; }).join('') +
        '<tr><td>Ultimul Nr Crt</td><td class="nr">' + s.ultimNr + '</td></tr>' +
        '<tr><td>Comenzi active (deschise sau în așteptarea încărcării)</td><td class="nr">' + s.active + '</td></tr>' +
        '<tr><td>Terminata fără încărcare, mai vechi de 7 zile → arhivate</td><td class="nr">' + s.arhivate + '</td></tr>' +
        '<tr><td>Adrese</td><td class="nr">' + p.adrese.length + '</td></tr>' +
        '<tr><td>Documente de scris în baza de date</td><td class="nr">' + (s.grupe + Math.ceil(p.adrese.length / 400) + 1) + '</td></tr></table>' +
        (s.renumerotate.length ? '<div class="nota atentie">' + s.renumerotate.length + ' comenzi aveau Nr Crt dublat sau lipsă și primesc numere noi la sfârșit:</div>' +
          listaHtml(s.renumerotate.map(function (x) { return x.nc + ': Nr Crt ' + (x.vechi == null ? '—' : x.vechi) + ' → ' + x.nou; })) : '') +
        (p.adreseCorectate ? '<div class="mic">' + p.adreseCorectate + ' adrese transformate de Excel în dată au fost refăcute ca text.</div>' : '') +
        (p.lipsa.length ? '<div class="mic">Coloane care lipsesc din fișier: ' + esc(p.lipsa.join(', ')) + '</div>' : '') +
        '<div class="nota atentie">Migrarea <b>șterge și înlocuiește</b> toate comenzile' + (p.adrese.length ? ' și adresele' : '') + ' din aplicație.</div>';
      return modal({ titlu: 'Migrare din Excel', html: html, lat: true, butoane: [{ t: 'Renunță', v: null }, { t: 'Migrează', cls: 'pri', v: true }] });
    }).then(function (ok) {
      if (!ok) return;
      opresteUrmarireaComenzilor();
      toast('Migrare în curs… nu închide pagina.');
      return SC.store.stergeColectie('comenzi').then(function () {
        return SC.store.setMulte('comenzi', m.docs, function (a, b) { $('syncText').textContent = 'migrare ' + a + '/' + b; });
      }).then(function () {
        if (!p.adrese.length) return;
        return SC.store.stergeColectie('adrese').then(function () { return SC.store.setMulte('adrese', L.adreseInDocumente(p.adrese)); });
      }).then(function () {
        return SC.store.tx(function (t) {
          t.set('meta', 'contor', { ultim: m.contor });
          t.log('Migrare din ' + fisier.name + ': ' + m.stat.total + ' comenzi, ' + p.adrese.length + ' adrese');
        });
      }).then(function () {
        L.golesteCache(); stare.primaData = true;
        repornesteUrmarireaComenzilor();
        return alerta('Migrare terminată.\n\nComenzi: ' + m.stat.total + '\nUltimul Nr Crt: ' + m.stat.ultimNr + '\nAdrese: ' + p.adrese.length);
      }, function (e) { repornesteUrmarireaComenzilor(); throw e; });
    }).catch(arataEroare);
  }
  /* la migrare oprim doar urmarirea comenzilor (restul raman) si o repornim dupa */
  function opresteUrmarireaComenzilor() {
    stare.opriri.forEach(function (f) { try { f(); } catch (e) { /* ignor */ } });
    stare.opriri = []; stare.pornit = false;
  }
  function repornesteUrmarireaComenzilor() {
    var tab = stare.tab;
    porneste();
    arataTab(tab);
  }

  /* ================= start ================= */
  window.addEventListener('afterprint', function () { $('tiparire').innerHTML = ''; });
  SC.creeazaStore();
  SC.store.init().catch(function (e) {
    console.error(e);
    $('ecranLogin').classList.remove('ascuns');
    $('loginText').textContent = '';
    $('loginEroare').textContent = 'Aplicația nu a putut porni: ' + (e && e.message ? e.message : e) + '. Verifică internetul și config.js.';
  });
  SC._test = { stare: stare, schimbaStatus: schimbaStatus, redeseneaza: redeseneaza };
})();
