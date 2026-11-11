/* Status Comenzi - regulile registrului (portate din VBA): grupe, Nr Crt, statusuri, adrese, importuri */
(function () {
  'use strict';
  var SC = window.SC, ST = SC.ST;
  var L = SC.L = {};

  SC.grupe = {};        // id grupa -> document
  SC.comenzi = [];      // toate comenzile incarcate, sortate dupa Nr Crt
  SC.dupaNr = {};       // Nr Crt -> comanda
  SC.config = JSON.parse(JSON.stringify(SC.CONFIG_IMPLICIT));
  SC.adrese = [];       // [{id, cl, cod, nume, str, loc, jud, _c}]
  SC.extra = [];        // liniile din fisierul de transport care nu exista in registru: [{ref, cl, de, na, nt, dtr, ..., _zi, _k}]
  var adrNorm = null;   // cache normalizat pentru cautari

  /* ---------- grupe ---------- */
  L.curata = function (o) {
    Object.keys(o).forEach(function (k) { if (o[k] == null || o[k] === '') delete o[k]; });
    return o;
  };
  L.recalc = function (g) {
    var act = 0, chei = {}, cmin = 0, cmax = 0, n0 = 0, timpi = [];
    Object.keys(g.o).forEach(function (n) {
      var o = g.o[n];
      if (SC.esteActiva(o)) act++;
      var k = SC.cheieComanda(o.nc); if (k) chei[k] = 1;
      var ct = o.ct || 0;
      if (ct) { timpi.push(ct); if (!cmin || ct < cmin) cmin = ct; if (ct > cmax) cmax = ct; }
      if (!n0 || +n < n0) n0 = +n;
    });
    /* cmed = momentul median al introducerii comenzilor din grupa: dupa el se cauta istoricul pe perioada
       (cmax poate fi tras in sus de o singura comanda reintrodusa mai tarziu) */
    timpi.sort(function (a, b) { return a - b; });
    g.act = act; g.k = Object.keys(chei); g.cmin = cmin; g.cmax = cmax; g.cmed = timpi.length ? timpi[Math.floor(timpi.length / 2)] : 0; g.n0 = n0; g.upd = Date.now();
    return g;
  };
  L.aplicaGrupe = function (lista) {
    if (!lista || !lista.length) return false;
    lista.forEach(function (d) { SC.grupe[d.id] = d.data; });
    var toate = [], idx = {};
    Object.keys(SC.grupe).forEach(function (id) {
      var o = SC.grupe[id].o || {};
      Object.keys(o).forEach(function (n) { var c = o[n]; c.n = +n; toate.push(c); idx[+n] = c; });
    });
    toate.sort(function (a, b) { return a.n - b.n; });
    SC.comenzi = toate; SC.dupaNr = idx;
    return true;
  };
  L.golesteCache = function () { SC.grupe = {}; SC.comenzi = []; SC.dupaNr = {}; };

  /* Modifica una sau mai multe comenzi existente intr-o singura tranzactie.
     modificari: [{n, fn(o)}]; fn poate arunca eroare (tranzactia se anuleaza). */
  var FARA_JURNAL = { ut: 1, uu: 1, ct: 1, cu: 1, n: 1, _h: 1, jd: 1, tr: 1, prm: 1, gfm: 1, _zi: 1, _k: 1 };
  function scurt(v) { var s = String(v); return s.length > 60 ? s.slice(0, 57) + '…' : s; }
  /* "Camp: vechi → nou; ..." pentru jurnal; '' daca nu s-a schimbat nimic */
  L.diferente = function (a, b) {
    var chei = {}, parti = [];
    Object.keys(a).concat(Object.keys(b)).forEach(function (k) { if (!FARA_JURNAL[k]) chei[k] = 1; });
    Object.keys(chei).forEach(function (k) {
      var x = a[k] == null ? '' : a[k], y = b[k] == null ? '' : b[k];
      if (String(x) === String(y)) return;
      var nume = SC.COL[k] ? SC.COL[k].t : (k === 'ar' ? 'Arhivată' : k);
      parti.push(nume + ': ' + (x === '' ? '(gol)' : scurt(x)) + ' → ' + (y === '' ? '(gol)' : scurt(y)));
    });
    return parti.join('; ');
  };
  /* optiuni: faraDetalii = in jurnal intra doar textul de ansamblu (operatii in masa fara interes pe comanda) */
  L.modifica = function (modificari, textJurnal, opt) {
    opt = opt || {};
    var ids = {}, user = SC.store.user ? SC.store.user.nume : '?';
    modificari.forEach(function (m) { ids[SC.idGrupa(m.n)] = 1; });
    var listaId = Object.keys(ids);
    return SC.store.tx(function (t) {
      return Promise.all(listaId.map(function (id) { return t.get('comenzi', id); })).then(function (docs) {
        var g = {}, linii = [];
        listaId.forEach(function (id, i) { g[id] = docs[i]; });
        modificari.forEach(function (m) {
          var gr = g[SC.idGrupa(m.n)], o = gr && gr.o && gr.o[m.n];
          if (!o) throw eroare('Comanda cu Nr Crt ' + m.n + ' nu mai există în baza de date.');
          var inainte = JSON.parse(JSON.stringify(o));
          o.n = m.n;
          m.fn(o);
          delete o.n;
          L.curata(o);
          var d = L.diferente(inainte, o);
          if (d) {
            o.ut = Date.now(); o.uu = user;
            if (!opt.faraDetalii) linii.push(((o.cl || inainte.cl || '') + ' ' + (o.nc || inainte.nc || '')).trim() + ' (Nr Crt ' + m.n + ') — ' + d);
          }
        });
        var rez = listaId.map(function (id) { L.recalc(g[id]); t.set('comenzi', id, g[id]); return { id: id, data: g[id] }; });
        /* fiecare modificare ramane in jurnal cu valoarea veche si cea noua */
        if (textJurnal && (modificari.length > 1 || opt.faraDetalii)) t.log(textJurnal);
        linii.forEach(function (x) { t.log(x); });
        return rez;
      });
    }).then(function (rez) { L.aplicaGrupe(rez); return rez; });
  };

  /* Adauga comenzi noi; Nr Crt se aloca dintr-un contor unic (fara dubluri intre colegi). */
  L.creeaza = function (comenziNoi, textJurnal) {
    var PAS = 250, parti = [], total = [];
    for (var i = 0; i < comenziNoi.length; i += PAS) parti.push(comenziNoi.slice(i, i + PAS));
    var user = SC.store.user ? SC.store.user.nume : '?';
    function unPas(idx) {
      if (idx >= parti.length) return Promise.resolve(total);
      var parte = parti[idx];
      return SC.store.tx(function (t) {
        return t.get('meta', 'contor').then(function (c) {
          var ultim = (c && c.ultim) || 0, numere = [], ids = {};
          parte.forEach(function (_, j) { var n = ultim + 1 + j; numere.push(n); ids[SC.idGrupa(n)] = 1; });
          var listaId = Object.keys(ids);
          return Promise.all(listaId.map(function (id) { return t.get('comenzi', id); })).then(function (docs) {
            var g = {}, acum = Date.now();
            listaId.forEach(function (id, k) { g[id] = docs[k] || { o: {} }; });
            parte.forEach(function (src, j) {
              var o = L.curata(JSON.parse(JSON.stringify(src)));
              delete o.n;
              o.ct = acum; o.cu = user;
              g[SC.idGrupa(numere[j])].o[numere[j]] = o;
            });
            var rez = listaId.map(function (id) { L.recalc(g[id]); t.set('comenzi', id, g[id]); return { id: id, data: g[id] }; });
            t.set('meta', 'contor', { ultim: ultim + parte.length });
            if (textJurnal) t.log(textJurnal + ' (Nr Crt ' + numere[0] + (numere.length > 1 ? '–' + numere[numere.length - 1] : '') + ')');
            return { rez: rez, numere: numere };
          });
        });
      }).then(function (r) { L.aplicaGrupe(r.rez); total = total.concat(r.numere); return unPas(idx + 1); });
    }
    return unPas(0);
  };

  /* Sterge definitiv comenzi din registru (folosit doar la curatarea liniilor adaugate gresit din transport). */
  L.sterge = function (numere, textJurnal) {
    var i = 0;
    function pas() {
      if (i >= numere.length) return Promise.resolve();
      var buc = numere.slice(i, i + 150), ids = {}; i += 150;
      buc.forEach(function (n) { ids[SC.idGrupa(n)] = 1; });
      var listaId = Object.keys(ids);
      return SC.store.tx(function (t) {
        return Promise.all(listaId.map(function (id) { return t.get('comenzi', id); })).then(function (docs) {
          var g = {};
          listaId.forEach(function (id, j) { g[id] = docs[j] || { o: {} }; });
          buc.forEach(function (n) { delete g[SC.idGrupa(n)].o[n]; });
          var rez = listaId.map(function (id) { L.recalc(g[id]); t.set('comenzi', id, g[id]); return { id: id, data: g[id] }; });
          t.log(textJurnal + ' (' + buc.length + ' rânduri, Nr Crt ' + buc[0] + '–' + buc[buc.length - 1] + ')');
          return rez;
        });
      }).then(function (rez) { L.aplicaGrupe(rez); return pas(); });
    }
    return pas();
  };

  /* Cauta in toata baza de date (nu doar in ce e incarcat) comenzile cu numerele date.
     Intoarce {cheie: [comenzi]} */
  L.cautaComenzi = function (numere) {
    var rez = {}, deCautat = [];
    numere.forEach(function (nr) {
      var k = SC.cheieComanda(nr);
      if (k && !rez[k]) { rez[k] = []; deCautat.push(k); }
    });
    /* ce se gaseste deja in comenzile incarcate nu se mai cauta in baza de date (economie de citiri) */
    var inCache = {};
    SC.comenzi.forEach(function (o) { var k = SC.cheieComanda(o.nc); if (rez[k]) inCache[k] = 1; });
    deCautat = deCautat.filter(function (k) { return !inCache[k]; });
    return (deCautat.length ? SC.store.cautaChei(deCautat) : Promise.resolve([])).then(function (grupe) {
      /* grupele gasite sunt mai proaspete decat cache-ul doar daca nu sunt urmarite in timp real */
      var noi = grupe.filter(function (d) { return !SC.grupe[d.id] || (SC.grupe[d.id].upd || 0) < (d.data.upd || 0); });
      L.aplicaGrupe(noi);
      SC.comenzi.forEach(function (o) {
        var k = SC.cheieComanda(o.nc);
        if (rez[k]) rez[k].push(o);
      });
      return rez;
    });
  };

  function eroare(msg) { var e = new Error(msg); e.prietenos = true; return e; }
  L.eroare = eroare;

  /* Regula: la o comanda pregatita (Terminata / Self-Pick) paletii reali = FPP + Pick.
     Amprentele urmeaza suma cat timp nu au fost modificate separat (erau egale cu paletii reali sau goale). */
  L.sincPaleti = function (x) {
    if (x.st !== ST.TER && x.st !== ST.SELF) return false;
    if (!SC.esteNum(x.fpp) || !SC.esteNum(x.pk)) return false;
    var nou = x.fpp + x.pk, vechi = x.pr;
    if (nou === vechi) return false;
    var urmeaza = !SC.esteNum(x.am) || x.am === vechi;
    x.pr = nou;
    if (urmeaza) x.am = nou;
    if (L.greutateAuto(x)) x.gf = SC.rotunjeste(x.g + nou * SC.config.kgPalet);
    return true;
  };

  /* ---------- statusuri ---------- */
  /* Aplica un status pe comanda (in tranzactie). date = {pr, am, gf} pentru Terminata / Self-Pick. */
  L.aplicaStatus = function (o, st, date) {
    var cfg = SC.config;
    if (st === ST.INI || st === ST.LUC) {
      delete o.dp; delete o.op;
    } else if (st === ST.TER || st === ST.SELF) {
      var auto = SC.normText(o.cl) === SC.normText(cfg.clientGreutateAuto) && SC.esteNum(o.g);
      o.pr = date.pr; o.am = date.am;
      if (date.fpp != null) o.fpp = date.fpp;
      if (date.pk != null) o.pk = date.pk;
      if (auto) {
        o.gf = SC.rotunjeste(o.g + date.pr * cfg.kgPalet);
      } else {
        o.gf = date.gf;
        if (SC.gol(o.g)) o.g = date.gf;
      }
      o.dp = SC.azi(); o.op = SC.oraAcum();
      if (st === ST.SELF) o.co = 'RIDICARE CLIENT';
    } else if (st === ST.ANU) {
      SC.CAMPURI_ANULARE.forEach(function (k) { delete o[k]; });
      o.co = 'COMANDA ANULATA';
      o.dp = SC.azi(); o.op = SC.oraAcum();
    }
    o.st = st;
  };
  /* greutatea finala se calculeaza automat? (KANDIA cu Greutate numerica) */
  L.greutateAuto = function (o) {
    return SC.normText(o.cl) === SC.normText(SC.config.clientGreutateAuto) && SC.esteNum(o.g);
  };

  /* ---------- Adrese ---------- */
  function normCod(v) {
    var s = SC.normText(v);
    if (/^\d+(\.0+)?$/.test(s)) s = s.replace(/\.0+$/, '').replace(/^0+(?=\d)/, '');
    return s;
  }
  L.seteazaAdrese = function (docs) {
    var l = [];
    docs.forEach(function (d) { (d.data.r || []).forEach(function (r) { r._c = d.id; l.push(r); }); });
    SC.adrese = l; adrNorm = null;
  };
  function norm() {
    if (adrNorm) return adrNorm;
    adrNorm = SC.adrese.map(function (a) {
      return {
        a: a, cl: SC.normText(a.cl), cod: normCod(a.cod), nume: SC.normText(a.nume), str: SC.normText(a.str),
        loc: SC.normText(a.loc), jud: String(a.jud || '').trim(), locN: SC.normLoc(a.loc), strN: SC.normLoc(a.str),
        judN: SC.normLoc(a.jud)
      };
    });
    return adrNorm;
  }
  L.adresaDupaCod = function (client, cod) {
    var c = normCod(cod), cl = SC.normText(client);
    if (!c) return null;
    var l = norm();
    for (var i = 0; i < l.length; i++) if (l[i].cl === cl && l[i].cod === c) return l[i].a;
    return null;
  };
  /* nume + strada; apoi nume + localitate; apoi doar nume, daca e unic */
  L.adresaDupaNume = function (client, nume, strada, localitate) {
    var cl = SC.normText(client), nN = SC.normText(nume), nS = SC.normText(strada), nL = SC.normText(localitate);
    if (!nN) return null;
    var l = norm(), pLoc = null, pNume = null, nr = 0;
    for (var i = 0; i < l.length; i++) {
      var r = l[i];
      if (r.cl !== cl || r.nume !== nN) continue;
      nr++; pNume = r.a;
      if (nS && r.str === nS) return r.a;
      if (nL && !pLoc && r.loc === nL) pLoc = r.a;
    }
    return pLoc || (nr === 1 ? pNume : null);
  };
  L.judetDupaLocalitate = function (localitate) {
    var nLoc = SC.normLoc(localitate);
    if (!nLoc) return '';
    var l = norm(), exact = {}, partial = {}, inAdr = {};
    for (var i = 0; i < l.length; i++) {
      var r = l[i];
      if (!r.jud) continue;
      if (r.judN === nLoc) return r.jud;
      if ((nLoc.slice(0, 6) === 'sector' || nLoc.indexOf('bucuresti') >= 0) && r.judN === 'bucuresti') return r.jud;
      if (r.locN) {
        if (r.locN === nLoc) exact[r.jud] = (exact[r.jud] || 0) + 1;
        else if (nLoc.length >= 4 && (r.locN.indexOf(nLoc) >= 0 || nLoc.indexOf(r.locN) >= 0)) partial[r.jud] = (partial[r.jud] || 0) + 1;
      }
      if (nLoc.length >= 4 && r.strN.indexOf(nLoc) >= 0) inAdr[r.jud] = (inAdr[r.jud] || 0) + 1;
    }
    function top(m) { var b = '', mx = 0; Object.keys(m).forEach(function (k) { if (m[k] > mx) { mx = m[k]; b = k; } }); return b; }
    return top(exact) || top(partial) || top(inAdr);
  };
  var MARIME_ADRESE = 400;
  /* salveaza (adauga / modifica / sterge) un rand din Adrese */
  L.salveazaAdresa = function (rand, sterge) {
    var chunk = rand._c, date = { id: rand.id || SC.idScurt(), cl: rand.cl || '', cod: rand.cod || '', nume: rand.nume || '',
      str: rand.str || '', loc: rand.loc || '', jud: rand.jud || '' };
    if (!chunk) {
      var numar = {}, max = -1;
      SC.adrese.forEach(function (a) { numar[a._c] = (numar[a._c] || 0) + 1; });
      Object.keys(numar).forEach(function (c) { var i = +c.slice(1); if (i > max) max = i; });
      chunk = (max >= 0 && numar['a' + ('000' + max).slice(-3)] < MARIME_ADRESE) ? 'a' + ('000' + max).slice(-3) : 'a' + ('000' + (max + 1)).slice(-3);
    }
    return SC.store.tx(function (t) {
      return t.get('adrese', chunk).then(function (d) {
        d = d || { r: [] };
        var i = d.r.findIndex(function (x) { return x.id === date.id; }), detalii = '';
        if (!sterge && i >= 0) {
          var NUME = { cl: 'Client', cod: 'Cod', nume: 'Nume', str: 'Stradă', loc: 'Localitate', jud: 'Județ' }, v = d.r[i], p = [];
          Object.keys(NUME).forEach(function (k) { if (String(v[k] || '') !== String(date[k] || '')) p.push(NUME[k] + ': ' + (v[k] || '(gol)') + ' → ' + (date[k] || '(gol)')); });
          detalii = p.length ? ' — ' + p.join('; ') : '';
        }
        if (sterge) { if (i >= 0) d.r.splice(i, 1); }
        else if (i >= 0) d.r[i] = date; else d.r.push(date);
        t.set('adrese', chunk, d);
        t.log('Adrese: ' + (sterge ? 'șters' : (i >= 0 ? 'modificat' : 'adăugat')) + ' ' + date.cl + ' / ' + date.nume + detalii);
      });
    });
  };
  L.adreseInDocumente = function (randuri) {
    var docs = [];
    for (var i = 0; i < randuri.length; i += MARIME_ADRESE) {
      docs.push({ id: 'a' + ('000' + (i / MARIME_ADRESE)).slice(-3), data: { r: randuri.slice(i, i + MARIME_ADRESE) } });
    }
    return docs;
  };

  /* ---------- citire Excel (SheetJS) ---------- */
  function cel(ws, r, c) { return ws[XLSX.utils.encode_cell({ r: r, c: c })]; }
  function eData(c) { return c && c.t === 'n' && c.z && XLSX.SSF.is_date(String(c.z)); }
  function vText(c) {
    if (!c || c.v == null) return '';
    if (c.t === 'n') {
      if (eData(c)) { var s = SC.serialExcel(c.v); return SC.fmtDataLunga(s.ymd) + (s.areOra ? ' ' + s.hm : ''); }
      return String(c.v);
    }
    if (c.t === 'b') return c.v ? 'DA' : 'NU';
    if (c.t === 'e') return '';
    return String(c.v).replace(/ /g, ' ').trim();
  }
  /* adresa: o strada de tip "22 Decembrie 1989" ajunge in Excel ca data - o refacem ca text */
  function vAdresa(c, stat) {
    if (c && c.t === 'n' && (eData(c) || (Number.isInteger(c.v) && c.v > 20000 && c.v < 60000))) {
      if (stat) stat.adreseCorectate = (stat.adreseCorectate || 0) + 1;
      return SC.dataCaAdresa(SC.serialExcel(c.v).ymd);
    }
    return vText(c);
  }
  function vData(c) {
    if (!c || c.v == null) return '';
    if (c.t === 'n') return (c.v > 1 && c.v < 110000) ? SC.serialExcel(c.v).ymd : String(c.v);
    var s = String(c.v).trim();
    return SC.dataDinText(s) || s;
  }
  function vDataOra(c) {
    if (!c || c.v == null) return '';
    if (c.t === 'n') { var s = SC.serialExcel(c.v); return s.ymd + (s.areOra ? ' ' + s.hm : ''); }
    var t = String(c.v).trim(), d = SC.dataDinText(t);
    if (!d) return t;
    var m = /(\d{1,2})[:.](\d{2})\s*$/.exec(t.slice(10));
    return d + (m ? ' ' + SC.p2(+m[1]) + ':' + m[2] : '');
  }
  function vOra(c) {
    if (!c || c.v == null) return '';
    if (c.t === 'n') return SC.serialExcel(c.v).hm;
    return String(c.v).trim();
  }
  function vNum(c) {
    if (!c || c.v == null) return '';
    if (c.t === 'n') return SC.rotunjeste(c.v, 6);
    var s = String(c.v).trim();
    if (s === '') return '';
    var n = SC.parseNum(s);
    return n == null ? s : n;
  }
  function vDupaTip(c, col, stat) {
    switch (col.typ) {
      case 'int': case 'num': return vNum(c);
      case 'date': return vData(c);
      case 'dt': return vDataOra(c);
      case 'time': return vOra(c);
      default: return col.k === 'ad' ? vAdresa(c, stat) : vText(c);
    }
  }
  function zona(ws) { return XLSX.utils.decode_range(ws['!ref'] || 'A1:A1'); }
  L.citesteExcel = function (buffer) { return XLSX.read(buffer, { type: 'array', cellNF: true, cellDates: false }); };

  /* data ("10.09.2026") si ora ("16.00") dintr-un text care contine "ora" (ExtrageDataOra) */
  L.extrageDataOra = function (text) {
    var s = String(text || '').trim().replace(/\.xlsx$/i, ''), rez = { data: '', ora: '' };
    var p = s.toLowerCase().indexOf(' ora ');
    if (p >= 0) p += 1; else p = s.toLowerCase().indexOf('ora');
    if (p < 0) return rez;
    var stanga = s.slice(0, p).trim(), dreapta = s.slice(p + 3).trim();
    var cifre = (dreapta.split(' ')[0] || '').replace(/\D/g, '');
    if (cifre.length === 4) rez.ora = cifre.slice(0, 2) + '.' + cifre.slice(2);
    else if (cifre.length === 3) rez.ora = '0' + cifre.slice(0, 1) + '.' + cifre.slice(1);
    else return rez;
    var ultim = stanga.split(' ').pop() || '';
    cifre = ultim.replace(/\D/g, '');
    if (cifre.length > 8) cifre = cifre.slice(0, 8);
    if (cifre.length === 8) rez.data = cifre.slice(0, 2) + '.' + cifre.slice(2, 4) + '.' + cifre.slice(4);
    else if (cifre.length === 6) rez.data = cifre.slice(0, 2) + '.' + cifre.slice(2, 4) + '.20' + cifre.slice(4);
    else rez.data = ultim;
    return rez;
  };

  /* Borderou Kandia: foaia 1, antet pe randul 2 ("Document" = comenzi, "Nr. aviz" = materiale), date de la randul 3 */
  L.parseBorderou = function (wb, numeFisier, modificatLa) {
    var ws = wb.Sheets[wb.SheetNames[0]], z = zona(ws), stat = {};
    var a2 = SC.normAntet(vText(cel(ws, 1, 0))), tip, prefix;
    if (a2 === 'document') { tip = 'comenzi'; prefix = 'EDI: '; }
    else if (a2 === 'nr. aviz') { tip = 'materiale'; prefix = 'EDI MAT: '; }
    else throw eroare('Fișierul nu arată ca un borderou: în celula A2 mă așteptam la „Document” sau „Nr. aviz”, am găsit „' + vText(cel(ws, 1, 0)) + '”.');

    var randuri = [], r = 2, ultimaCol = Math.max(z.e.c, 8);
    for (; r <= z.e.r; r++) {
      var a = vText(cel(ws, r, 0));
      if (a === '' || a.indexOf('*') >= 0 || /^total/i.test(a)) break;
      if (tip === 'comenzi' && !/^\d+$/.test(a)) break;
      var obs = [];
      for (var c = 9; c <= ultimaCol; c++) { var tx = vText(cel(ws, r, c)); if (tx && tx !== '-') obs.push(tx); }
      randuri.push({
        nc: a, dc: vData(cel(ws, r, 1)), dl: vData(cel(ws, r, 2)), de: vText(cel(ws, r, 3)), ad: vAdresa(cel(ws, r, 4), stat),
        or: vText(cel(ws, r, 5)), g: vNum(cel(ws, r, 6)), ca: vNum(cel(ws, r, 7)), pe: vNum(cel(ws, r, 8)), ob: obs.join(' | ')
      });
    }
    /* randuri care arata a comanda dupa punctul de oprire (in Excel se pierdeau fara avertisment) */
    var ramase = 0;
    for (var r2 = r + 1; r2 <= z.e.r; r2++) {
      var a3 = vText(cel(ws, r2, 0));
      if (a3 && a3.indexOf('*') < 0 && !/^total/i.test(a3) && vText(cel(ws, r2, 3))) ramase++;
    }
    if (!randuri.length) throw eroare('Borderoul nu conține nicio comandă.');

    var d = L.extrageDataOra(numeFisier);
    if (!d.ora) {
      for (var c2 = 0; c2 <= ultimaCol && !d.ora; c2++) d = L.extrageDataOra(vText(cel(ws, 1, c2)));
    }
    if (!d.ora) {
      var m = new Date(modificatLa || Date.now());
      d = { data: SC.p2(m.getDate()) + '.' + SC.p2(m.getMonth() + 1) + '.' + m.getFullYear(), ora: SC.p2(m.getHours()) + '.' + SC.p2(m.getMinutes()) };
    }
    return { tip: tip, eticheta: prefix + d.data + ' ' + d.ora, randuri: randuri, ramase: ramase, adreseCorectate: stat.adreseCorectate || 0 };
  };

  /* Fisier cu aceleasi antete ca registrul (Status Comenzi.xlsm sau un extras din el) */
  L.parseRegistru = function (wb) {
    var numeFoaie = wb.SheetNames.indexOf('Sheet1') >= 0 ? 'Sheet1' : wb.SheetNames[0];
    var ws = wb.Sheets[numeFoaie], z = zona(ws), stat = {}, harta = {}, lipsa = [];
    var toate = SC.COLS.concat(SC.COLS_INC);
    for (var c = 0; c <= z.e.c; c++) {
      var h = SC.normAntet(vText(cel(ws, 0, c)));
      if (!h) continue;
      toate.forEach(function (col) { if (SC.normAntet(col.x) === h && harta[col.k] == null) harta[col.k] = c; });
    }
    if (harta.nc == null) throw eroare('Fișierul nu are coloana „Nr. Comanda” pe rândul 1 al foii „' + numeFoaie + '”.');
    SC.COLS.forEach(function (col) { if (harta[col.k] == null && col.k !== 'nt' && col.k !== 'fpp' && col.k !== 'pk') lipsa.push(col.x); });
    var comenzi = [];
    for (var r = 1; r <= z.e.r; r++) {
      var nc = vText(cel(ws, r, harta.nc));
      if (!nc) continue;
      var o = {};
      Object.keys(harta).forEach(function (k) {
        var v = vDupaTip(cel(ws, r, harta[k]), SC.COL[k], stat);
        if (v !== '' && v != null) o[k] = v;
      });
      o.nc = nc;
      o.st = SC.statusCanonic(o.st || ST.INI);
      if (o.inc) o.inc = /^da/i.test(String(o.inc)) ? 'DA' : String(o.inc).toUpperCase();
      if (o.cl) o.cl = String(o.cl).toUpperCase().trim();
      comenzi.push(o);
    }
    /* foaia Adrese, daca exista */
    var adrese = [], wsA = wb.Sheets['Adrese'];
    if (wsA) {
      var za = zona(wsA), ha = {};
      for (var ca = 0; ca <= za.e.c; ca++) {
        var t = SC.normText(vText(cel(wsA, 0, ca)));
        if (t === 'client') ha.cl = ca; else if (t === 'cod') ha.cod = ca; else if (t === 'nume 1') ha.nume = ca;
        else if (t.slice(0, 5) === 'strad') ha.str = ca; else if (t === 'localitate') ha.loc = ca; else if (t === 'judet') ha.jud = ca;
      }
      if (ha.nume != null) {
        for (var ra = 1; ra <= za.e.r; ra++) {
          var nume = vText(cel(wsA, ra, ha.nume));
          if (!nume) continue;
          adrese.push({
            id: SC.idScurt(), cl: ha.cl != null ? vText(cel(wsA, ra, ha.cl)).toUpperCase() : '', cod: ha.cod != null ? vText(cel(wsA, ra, ha.cod)) : '',
            nume: nume, str: ha.str != null ? vAdresa(cel(wsA, ra, ha.str)) : '', loc: ha.loc != null ? vText(cel(wsA, ra, ha.loc)) : '',
            jud: ha.jud != null ? vText(cel(wsA, ra, ha.jud)) : ''
          });
        }
      }
    }
    return { foaie: numeFoaie, comenzi: comenzi, adrese: adrese, lipsa: lipsa, adreseCorectate: stat.adreseCorectate || 0 };
  };

  /* momentul crearii unei comenzi din istoric: din eticheta de import, altfel data comenzii / pregatirii */
  function momentCreare(o) {
    var m = /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2})[.:](\d{2})/.exec(String(o.im || ''));
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
    var d = /^\d{4}-\d{2}-\d{2}/.test(o.dc || '') && o.dc >= '2020-01-01' ? o.dc : (/^\d{4}-\d{2}-\d{2}/.test(o.dp || '') ? o.dp : '');
    return d ? SC.msDin(d, '12:00') : 0;
  }
  /* Construieste documentele pentru migrarea initiala. zileActive = cat timp in urma o comanda
     Terminata si neincarcata mai este considerata "in asteptarea incarcarii". */
  L.construiesteMigrare = function (comenzi, zileActive) {
    var folosite = {}, faraNr = [], max = 0, stat = { total: comenzi.length, renumerotate: [], arhivate: 0, active: 0, peStatus: {} };
    var prag = SC.ziPlus(SC.azi(), -zileActive);
    comenzi.forEach(function (o) {
      var n = SC.esteNum(o.n) && Number.isInteger(o.n) && o.n > 0 ? o.n : 0;
      if (n && !folosite[n]) { folosite[n] = o; if (n > max) max = n; }
      else faraNr.push({ o: o, vechi: o.n });
    });
    faraNr.forEach(function (x) { max++; folosite[max] = x.o; stat.renumerotate.push({ nc: x.o.nc, vechi: x.vechi, nou: max }); });
    var g = {}, ultimCt = 0;
    Object.keys(folosite).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) {
      var o = JSON.parse(JSON.stringify(folosite[n]));
      delete o.n;
      o.ct = momentCreare(o) || ultimCt || Date.now();
      ultimCt = o.ct;
      if (o.st === ST.TER && o.inc !== 'DA' && (!o.dp || String(o.dp) < prag)) { o.ar = 1; stat.arhivate++; }
      if (SC.esteActiva(o)) stat.active++;
      stat.peStatus[o.st] = (stat.peStatus[o.st] || 0) + 1;
      var id = SC.idGrupa(n);
      (g[id] = g[id] || { o: {} }).o[n] = L.curata(o);
    });
    var docs = Object.keys(g).sort().map(function (id) { return { id: id, data: L.recalc(g[id]) }; });
    stat.grupe = docs.length; stat.ultimNr = max;
    return { docs: docs, contor: max, stat: stat };
  };

  /* Export TMS "Status Livrari TRANSPORT": ReferintaClient = nr comanda, Masina = nr auto, NumarTransport ... */
  L.parseTransport = function (wb) {
    var nume = wb.SheetNames.indexOf('Sheet') >= 0 ? 'Sheet' : wb.SheetNames[wb.SheetNames.length > 1 ? 1 : 0];
    var ws = wb.Sheets[nume], z = zona(ws), rAntet = -1, h = {};
    function cheie(v) { return SC.normText(v).replace(/[^a-z0-9]/g, ''); }
    for (var r = 0; r <= Math.min(z.e.r, 20) && rAntet < 0; r++) {
      for (var c = 0; c <= z.e.c; c++) if (cheie(vText(cel(ws, r, c))) === 'referintaclient') { rAntet = r; break; }
    }
    if (rAntet < 0) throw eroare('Nu găsesc coloana „ReferintaClient” în foaia „' + nume + '”. Acesta este exportul „Status Livrari TRANSPORT”?');
    for (var c2 = 0; c2 <= z.e.c; c2++) {
      var k = cheie(vText(cel(ws, rAntet, c2)));
      if (k === 'referintaclient') h.ref = c2; else if (k === 'masina' || k === 'nrauto') h.na = c2;
      else if (k === 'numartransport' || k === 'nrtransport') h.nt = c2; else if (k === 'sofer') h.so = c2;
      else if (k === 'remorca') h.re = c2; else if (k === 'client' || k === 'numeclient') h.cl = c2;
      else if (k === 'destinatar' || k === 'beneficiar' || k === 'numedestinatar') h.de = c2;
      else if (k === 'localitatebeneficiar') h.or = c2; else if (k === 'judetbeneficiar') h.ju = c2;
      else if (k === 'unitatitotale') h.un = c2; else if (k === 'masatotala') h.ma = c2;
      else if (k === 'dataestimataincarcare') h.dtr = c2;      /* ziua in care se incarca masina */
      else if (k === 'datatransport') h.dtr2 = c2;             /* momentul crearii transportului - rezerva */
    }
    if (h.dtr == null) { h.dtr = h.dtr2; h.dtr2 = null; }
    var numeColData = h.dtr != null ? vText(cel(ws, rAntet, h.dtr)) : '';
    function ziua(c) { if (c == null) return ''; var dv = vData(cel(ws, r2, c)); return /^\d{4}-\d{2}-\d{2}$/.test(dv) && dv >= '2020-01-01' ? dv : ''; }
    if (h.na == null) throw eroare('Nu găsesc coloana „Masina” în foaia „' + nume + '”.');
    var randuri = [];
    var r2;
    for (r2 = rAntet + 1; r2 <= z.e.r; r2++) {
      var ref = vText(cel(ws, r2, h.ref));
      if (!ref) continue;
      var x = { ref: ref, na: vText(cel(ws, r2, h.na)).toUpperCase() };
      ['nt', 'so', 're', 'cl', 'de', 'or', 'ju'].forEach(function (kk) { if (h[kk] != null) x[kk] = vText(cel(ws, r2, h[kk])); });
      ['un', 'ma'].forEach(function (kk) { if (h[kk] != null) { var nv = vNum(cel(ws, r2, h[kk])); if (SC.esteNum(nv)) x[kk] = SC.rotunjeste(nv, 2); } });
      x.dtr = ziua(h.dtr) || ziua(h.dtr2);
      if (x.na || x.nt) randuri.push(x);
    }
    return { foaie: nume, randuri: randuri, areClient: h.cl != null, colData: numeColData };
  };

  /* ---------- linii doar din transport (nu sunt in registrul de comenzi) ----------
     Colectia "extra": un document pe zi de transport (sau "fara-data"), cu liniile intr-o harta. */
  L.seteazaExtra = function (docs) {
    var l = [];
    docs.forEach(function (d) {
      var m = d.data.l || {};
      Object.keys(m).forEach(function (k) { var x = m[k]; x._zi = d.id; x._k = k; l.push(x); });
    });
    SC.extra = l;
    /* pe acelasi document al zilei se tine si evidenta camioanelor: cand s-a tiparit borderoul = cand a inceput incarcarea */
    var cam = {};
    docs.forEach(function (d) { var c = d.data.c || {}; Object.keys(c).forEach(function (k) { cam[d.id + '|' + k] = c[k]; }); });
    SC.camInfo = cam;
  };
  SC.camInfo = {};
  L.cheieCamion = function (x) { return String(x.cheie || '').replace(/[.\/\[\]*`~]/g, '_') || '_'; };
  L.infoCamion = function (x) { return SC.camInfo[(x.data || 'fara-data') + '|' + L.cheieCamion(x)] || null; };
  /* La tiparirea borderoului: prima tiparire = inceputul incarcarii (ramane fixa), plus ultima tiparire si numarul de tipariri. */
  L.marcheazaBorderou = function (x) {
    var zi = x.data || 'fara-data', k = L.cheieCamion(x), user = SC.store.user ? SC.store.user.nume : '?';
    return SC.store.tx(function (t) {
      return t.get('extra', zi).then(function (d) {
        d = d || { l: {} };
        d.c = d.c || {};
        var e = d.c[k] || {}, acum = SC.dtAcum(), prima = !e.bt;
        if (prima) { e.bt = acum; e.bu = user; }
        e.bl = acum; e.bn = (e.bn || 0) + 1;
        d.c[k] = e; d.upd = Date.now();
        t.set('extra', zi, d);
        t.log((prima ? 'Început încărcare (borderou tipărit): ' : 'Borderou retipărit (a ' + e.bn + '-a oară): ') + x.na + (x.nt ? ' / transport ' + x.nt : ''));
        return e;
      });
    });
  };
  L.cheieExtra = function (r) {
    return (SC.cheieComanda(r.ref) + '~' + (r.nt || SC.normNrAuto(r.na))).replace(/[.\/\[\]*`]/g, '_');
  };
  L.ziExtra = function (r) { return r.dtr || 'fara-data'; };
  /* perZi: {zi: [linii din fisier care nu exista in registru]}. Liniile deja incarcate nu se ating;
     cele care au disparut din fisier (sau au aparut intre timp in registru) se scot, daca nu sunt incarcate. */
  L.importaExtra = function (perZi, numeFisier) {
    var zile = Object.keys(perZi).sort(), stat = { noi: 0, actualizate: 0, scoase: 0 }, i = 0;
    function pas() {
      if (i >= zile.length) return Promise.resolve();
      var zi = zile[i++];
      return SC.store.tx(function (t) {
        return t.get('extra', zi).then(function (d) {
          var vechi = (d && d.l) || {}, nou = {}, s = { noi: 0, actualizate: 0, scoase: 0 };
          perZi[zi].forEach(function (r) {
            var k = L.cheieExtra(r), v = vechi[k];
            if (v && v.inc === 'DA') { nou[k] = v; return; }
            var x = v ? JSON.parse(JSON.stringify(v)) : {};
            ['ref', 'cl', 'de', 'or', 'ju', 'na', 'nt', 'so', 're', 'dtr', 'un', 'ma'].forEach(function (f) { if (r[f] != null && r[f] !== '') x[f] = r[f]; });
            /* paletii si greutatea vin din TMS (UnitatiTotale, MasaTotala), cat timp nu au fost corectate de mana (prm / gfm) */
            if (!x.prm && x.un != null) x.pr = x.un;
            if (!x.gfm && x.ma != null) x.gf = x.ma;
            if (!v) s.noi++; else if (JSON.stringify(v) !== JSON.stringify(x)) s.actualizate++;
            nou[k] = x;
          });
          Object.keys(vechi).forEach(function (k) {
            if (nou[k]) return;
            if (vechi[k].inc === 'DA') nou[k] = vechi[k]; else s.scoase++;
          });
          if (s.noi || s.actualizate || s.scoase) t.set('extra', zi, { l: nou, c: (d && d.c) || {}, upd: Date.now() });
          return s;
        });
      }).then(function (s) { stat.noi += s.noi; stat.actualizate += s.actualizate; stat.scoase += s.scoase; return pas(); });
    }
    return pas().then(function () {
      if (!(stat.noi || stat.actualizate || stat.scoase)) return stat;
      return SC.store.tx(function (t) {
        t.log('Import transport ' + numeFisier + ': linii doar din transport — ' + stat.noi + ' noi, ' + stat.actualizate + ' actualizate, ' + stat.scoase + ' scoase');
      }).then(function () { return stat; });
    });
  };
  /* modificari pe linii doar din transport: [{zi, k, fn(linie)}] */
  L.modificaExtra = function (modificari, textJurnal) {
    var ids = {}, user = SC.store.user ? SC.store.user.nume : '?';
    modificari.forEach(function (m) { ids[m.zi] = 1; });
    var listaId = Object.keys(ids);
    return SC.store.tx(function (t) {
      return Promise.all(listaId.map(function (id) { return t.get('extra', id); })).then(function (docs) {
        var g = {}, linii = [];
        listaId.forEach(function (id, i) { g[id] = docs[i]; });
        modificari.forEach(function (m) {
          var x = g[m.zi] && g[m.zi].l && g[m.zi].l[m.k];
          if (!x) throw eroare('Linia de transport nu mai există (fișierul TMS a fost reimportat între timp). Reîncarcă lista.');
          var inainte = JSON.parse(JSON.stringify(x));
          m.fn(x);
          L.curata(x);
          var d = L.diferente(inainte, x);
          if (d) { x.ut = Date.now(); x.uu = user; linii.push('Doar transport ' + ((x.cl || '') + ' ' + (x.ref || '')).trim() + ' (' + (x.na || x.nt || '') + ') — ' + d); }
        });
        listaId.forEach(function (id) { g[id].upd = Date.now(); t.set('extra', id, g[id]); });
        if (textJurnal && modificari.length > 1) t.log(textJurnal);
        linii.forEach(function (x) { t.log(x); });
      });
    });
  };

  /* ---------- export ---------- */
  L.exportExcel = function (comenzi, numeFisier) {
    var cols = SC.COLS.concat(SC.COLS_INC);
    var aoa = [cols.map(function (c) { return c.x; })];
    comenzi.forEach(function (o) {
      aoa.push(cols.map(function (c) {
        var v = o[c.k];
        if (v == null || v === '') return null;
        if (c.typ === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return SC.fmtDataLunga(v);
        if (c.typ === 'dt') return SC.fmtDataLunga(String(v).slice(0, 10)) + String(v).slice(10);
        if (c.k === 'nc' && /^[1-9]\d{0,14}$/.test(v)) return +v;
        return v;
      }));
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = cols.map(function (c) { return { wch: Math.max(10, Math.round((c.w || 90) / 7)) }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comenzi');
    XLSX.writeFile(wb, numeFisier);
  };
})();
