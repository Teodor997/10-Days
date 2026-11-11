/* Status Comenzi - utilitare comune (constante, normalizari, date, numere) */
(function () {
  'use strict';
  var SC = window.SC = window.SC || {};

  SC.VERSIUNE = '2.4';
  SC.ST = { INI: 'Initiata', LUC: 'In lucru', TER: 'Terminata', ANU: 'Anulata', SELF: 'Self-Pick' };
  SC.STATUSURI = [SC.ST.INI, SC.ST.LUC, SC.ST.TER, SC.ST.SELF, SC.ST.ANU];
  SC.ROLURI = { admin: 'Administrator', operator: 'Operator date', incarcari: 'Încărcări', transport: 'Transport' };
  /* campurile care tin de confirmarea incarcarii (le completeaza doar Administrator / Incarcari) */
  SC.CAMPURI_INCARCARE = { inc: 1, di: 1, sc: 1, te: 1, se: 1 };
  SC.MARIME_GRUPA = 25;            // comenzi per document Firestore
  SC.ZILE_RECENTE = 2;             // grupele create in ultimele N zile se urmaresc in timp real
  SC.CONFIG_IMPLICIT = {
    clienti: ['KANDIA', 'ROSHEN', 'PODRAVKA', 'IMERSIA', 'NATURA', 'NICHE BRANDS'],
    clientGreutateAuto: 'KANDIA',  // greutate finala = greutate + paleti reali * kgPalet
    kgPalet: 20,
    tolerantaPaleti: 1,
    factorGreutate: 5
  };

  /* Coloanele registrului, in ordinea din Excel.
     k = cheia scurta din baza de date, x = antetul din Excel, typ = tipul valorii */
  SC.COLS = [
    { k: 'n',  x: 'Nr Crt', t: 'Nr Crt', w: 76, typ: 'int' },
    { k: 'cl', x: 'Client', t: 'Client', w: 104, typ: 'txt' },
    { k: 'st', x: 'Status', t: 'Status', w: 112, typ: 'txt' },
    { k: 'nc', x: 'Nr. Comanda', t: 'Nr. Comandă', w: 116, typ: 'txt' },
    { k: 'cc', x: 'Cod Client', t: 'Cod Client', w: 112, typ: 'txt' },
    { k: 'dc', x: 'Data Comanda', t: 'Data Comandă', w: 84, typ: 'date' },
    { k: 'dl', x: 'Data Livrare Solicitata', t: 'Livrare solicitată', w: 84, typ: 'date' },
    { k: 'de', x: 'Destinatar', t: 'Destinatar', w: 240, typ: 'txt' },
    { k: 'ad', x: 'Adresa', t: 'Adresă', w: 220, typ: 'txt' },
    { k: 'or', x: 'Oras', t: 'Oraș', w: 120, typ: 'txt' },
    { k: 'ju', x: 'Judet', t: 'Județ', w: 104, typ: 'txt' },
    { k: 'g',  x: 'Greutate', t: 'Greutate', w: 84, typ: 'num' },
    { k: 'ca', x: 'Cartoane', t: 'Cartoane', w: 72, typ: 'int' },
    { k: 'pe', x: 'Nr.Paleti Estimati', t: 'Paleți estimați', w: 76, typ: 'num' },
    { k: 'fpp', x: 'FPP', t: 'FPP', w: 58, typ: 'int' },      /* paleti full (intregi) ai comenzii */
    { k: 'pk', x: 'Pick', t: 'Pick', w: 58, typ: 'int' },      /* paleti care se fac din picking */
    { k: 'gf', x: 'Greutate finala', t: 'Greutate finală', w: 88, typ: 'num' },
    { k: 'pr', x: 'Numarul de paleti reali', t: 'Paleți reali', w: 66, typ: 'int' },
    { k: 'am', x: 'Amprente Paleti', t: 'Amprente', w: 72, typ: 'int' },
    { k: 'dp', x: 'Data pregatire', t: 'Data pregătire', w: 84, typ: 'date' },
    { k: 'op', x: 'Ora pregatire', t: 'Ora pregătire', w: 64, typ: 'time' },
    { k: 'ob', x: 'Observatii', t: 'Observații', w: 180, typ: 'txt' },
    { k: 'co', x: 'Comentarii', t: 'Comentarii', w: 180, typ: 'txt' },
    { k: 'inc', x: 'Incarcata', t: 'Încărcată', w: 70, typ: 'txt' },
    { k: 'di', x: 'Data incarcare', t: 'Data încărcare', w: 112, typ: 'dt' },
    { k: 'na', x: 'Nr AUTO', t: 'Nr AUTO', w: 100, typ: 'txt' },
    { k: 'nt', x: 'Numar Transport', t: 'Nr transport', w: 100, typ: 'txt' },
    { k: 'im', x: 'Import', t: 'Import', w: 168, typ: 'txt' }
  ];
  /* coloane proprii incarcarii (in Excel erau doar in "Status Incarcari") */
  SC.COLS_INC = [
    { k: 'dtr', x: 'Data Transport', t: 'Data transport', typ: 'date' },
    { k: 'sc', x: 'Stare Camion', t: 'Stare camion', typ: 'txt' },
    { k: 'te', x: 'Temperatura', t: 'Temperatură', typ: 'txt' },
    { k: 'se', x: 'Semnatura', t: 'Semnătură', typ: 'txt' },
    { k: 'so', x: 'Sofer', t: 'Șofer', typ: 'txt' },
    { k: 're', x: 'Remorca', t: 'Remorcă', typ: 'txt' }
  ];
  SC.COL = {};
  SC.COLS.concat(SC.COLS_INC).forEach(function (c) { SC.COL[c.k] = c; });
  /* coloanele care raman mereu editabile, ca in Excel (Status se schimba doar prin lista de statusuri) */
  SC.MEREU_EDITABILE = { na: 1, ob: 1, co: 1, nt: 1 };
  /* campurile care se sterg la anulare: tot ce tine de comanda, in afara de Nr Crt, Client, Status, Nr. Comanda, Import */
  SC.ZILE_EXTRA = 14;              // liniile doar din transport mai vechi de atat nu se mai preiau din fisierul TMS
  SC.CAMPURI_ANULARE = ['fpp', 'pk', 'dtr', 'cc', 'dc', 'dl', 'de', 'ad', 'or', 'ju', 'jd', 'g', 'ca', 'pe', 'gf', 'pr', 'am', 'dp', 'op',
    'ob', 'co', 'inc', 'di', 'na', 'nt', 'sc', 'te', 'se', 'so', 're'];

  /* ---------- text ---------- */
  SC.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  };
  SC.gol = function (v) { return v == null || String(v).trim() === ''; };
  /* litere mici, fara spatii in plus / randuri noi (NormalizeazaAntet din VBA) */
  SC.normAntet = function (v) {
    return String(v == null ? '' : v).toLowerCase().replace(/[\r\n\t ]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  };
  /* + fara diacritice (NormalizeazaText) */
  SC.normText = function (v) {
    return SC.normAntet(v).normalize('NFD').replace(/[̀-ͯ]/g, '');
  };
  /* localitate comparabila (NormalizeazaLocalitate) */
  SC.normLoc = function (v) {
    var s = SC.normText(v).replace(/[-.,\/]/g, ' ').replace(/ {2,}/g, ' ').trim();
    if (s.slice(0, 6) === 'sector') s = 'sector';
    return s.replace(/ tr /g, ' turnu ');
  };
  /* cheie de comanda toleranta: majuscule, fara spatii, fara zerouri in fata la numere (CheieComanda) */
  SC.cheieComanda = function (v) {
    var s = String(v == null ? '' : v).toUpperCase().replace(/[\s ]+/g, '');
    if (/^\d+$/.test(s)) s = s.replace(/^0+(?=\d)/, '');
    return s;
  };
  SC.normNrAuto = function (s) { return String(s == null ? '' : s).toUpperCase().replace(/[\s\-.]/g, ''); };
  SC.statusCanonic = function (v) {
    var t = SC.normAntet(v);
    if (t === 'initiata') return SC.ST.INI;
    if (t === 'in lucru') return SC.ST.LUC;
    if (t === 'terminata') return SC.ST.TER;
    if (t === 'anulata') return SC.ST.ANU;
    if (t === 'self-pick' || t === 'self pick' || t === 'selfpick' || t === 'ridicare client' ||
        t === 'ridica reprez kandia' || t === 'ridica repr kandia') return SC.ST.SELF;
    return String(v == null ? '' : v).trim();
  };
  SC.esteEDI = function (o) { return String(o.im || '').slice(0, 3).toUpperCase() === 'EDI'; };
  SC.esteDeschisa = function (o) { return o.st === SC.ST.INI || o.st === SC.ST.LUC; };
  /* comanda "activa" = inca se lucreaza cu ea: deschisa sau terminata dar neincarcata (si nearhivata) */
  SC.esteActiva = function (o) {
    if (o.ar) return false;
    return SC.esteDeschisa(o) || (o.st === SC.ST.TER && o.inc !== 'DA');
  };

  /* ---------- numere ---------- */
  /* "2135,454" / "2.135,45" / "2135.45" -> numar; null daca nu e numar */
  SC.parseNum = function (v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v == null ? '' : v).replace(/[\s ]/g, '');
    if (s === '') return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    return parseFloat(s);
  };
  SC.esteNum = function (v) { return typeof v === 'number' && isFinite(v); };
  var nf2 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nf0 = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });
  SC.fmtNum = function (v, typ) {
    if (v == null || v === '') return '';
    if (!SC.esteNum(v)) return String(v);
    return typ === 'int' ? (Math.round(v) === v ? nf0.format(v) : nf2.format(v)) : nf2.format(v);
  };
  SC.rotunjeste = function (v, zec) { var p = Math.pow(10, zec == null ? 3 : zec); return Math.round(v * p) / p; };

  /* ---------- date ---------- */
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  SC.p2 = p2;
  SC.ymd = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  SC.azi = function () { return SC.ymd(new Date()); };
  SC.oraAcum = function () { var d = new Date(); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  SC.dtAcum = function () { return SC.azi() + ' ' + SC.oraAcum(); };
  SC.ziPlus = function (ymd, zile) {
    var a = ymd.split('-'), d = new Date(+a[0], +a[1] - 1, +a[2] + zile);
    return SC.ymd(d);
  };
  /* numar serial Excel -> {ymd, hm} (calcul fara fus orar) */
  SC.serialExcel = function (n) {
    var zile = Math.floor(n + 1e-9), frac = n - zile;
    var d = new Date(Date.UTC(1899, 11, 30) + zile * 86400000);
    var min = Math.round(frac * 1440);
    if (min >= 1440) min = 1439;
    return {
      ymd: d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()),
      hm: p2(Math.floor(min / 60)) + ':' + p2(min % 60), areOra: frac > 1e-6
    };
  };
  /* text "11.09.2026" / "11/09/26" / "11-09-2026 08:00" -> "2026-09-11"; '' daca nu e data (ConvertesteData) */
  SC.dataDinText = function (v) {
    var s = String(v == null ? '' : v).replace(/ /g, '').trim();
    if (!s) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    if (s.indexOf(' ') > 0) s = s.slice(0, s.indexOf(' '));
    var a = s.replace(/[\/\-]/g, '.').split('.');
    if (a.length !== 3 || !a.every(function (x) { return /^\d+$/.test(x); })) return '';
    var zi = +a[0], luna = +a[1], an = +a[2];
    if (an < 100) an += 2000;
    if (zi < 1 || zi > 31 || luna < 1 || luna > 12 || an < 2000 || an > 2100) return '';
    return an + '-' + p2(luna) + '-' + p2(zi);
  };
  /* "2026-09-11" -> "11.09.26" */
  SC.fmtData = function (v) {
    if (!v) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    return m ? m[3] + '.' + m[2] + '.' + m[1].slice(2) : String(v);
  };
  SC.fmtDataLunga = function (v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
    return m ? m[3] + '.' + m[2] + '.' + m[1] : String(v || '');
  };
  /* "2026-09-11 16:24" -> "11.09.26 16:24" */
  SC.fmtDT = function (v) {
    if (!v) return '';
    var s = String(v);
    return SC.fmtData(s.slice(0, 10)) + (s.length > 10 ? s.slice(10, 16) : '');
  };
  SC.msDin = function (ymd, hm) {
    var a = String(ymd || '').split('-'); if (a.length !== 3) return 0;
    var b = String(hm || '00:00').split(':');
    return new Date(+a[0], +a[1] - 1, +a[2], +b[0] || 0, +b[1] || 0).getTime();
  };
  var LUNI = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie',
    'Octombrie', 'Noiembrie', 'Decembrie'];
  /* o adresa de tip "22 Decembrie 1989" pe care Excel a transformat-o in data */
  SC.dataCaAdresa = function (ymd) {
    var a = ymd.split('-');
    return (+a[2]) + ' ' + LUNI[+a[1] - 1] + ' ' + a[0];
  };
  SC.fmtCelula = function (o, c) {
    var v = o[c.k];
    if (v == null || v === '') return '';
    if (c.typ === 'date') return SC.fmtData(v);
    if (c.typ === 'dt') return SC.fmtDT(v);
    if (c.typ === 'num' || c.typ === 'int') return c.k === 'n' ? String(v) : SC.fmtNum(v, c.typ);
    return String(v);
  };
  /* jurnalul de modificari: un document pe ora */
  SC.idJurnal = function () { return SC.azi() + '_' + p2(new Date().getHours()); };
  /* Paletii de pick propusi: pana la terminare = estimarea rotunjita in sus - FPP;
     dupa terminare (exista paleti reali) = paleti reali - FPP. null daca nu se poate calcula. */
  SC.pickPropus = function (fpp, estimare, paletiReali) {
    if (!SC.esteNum(fpp)) return null;
    var baza = SC.esteNum(paletiReali) ? paletiReali : (SC.esteNum(estimare) ? Math.ceil(estimare) : null);
    return baza == null ? null : Math.max(0, Math.round(baza - fpp));
  };
  SC.idScurt = function () { return Math.random().toString(36).slice(2, 10); };
  SC.slug = function (s) {
    return SC.normText(s).replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'user';
  };
  SC.idGrupa = function (n) {
    var i = Math.floor((n - 1) / SC.MARIME_GRUPA);
    return 'g' + ('000000' + i).slice(-6);
  };
})();
