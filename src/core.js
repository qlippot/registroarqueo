/* Matriz estratigráfica: lógica. Sin dependencias. Funciona en navegador y en Node.
   Reglas basadas en Harris (1989), MoLAS (1994), Historic England (2018), Surrey (2010), North Herts (2010)
   y la práctica española de la ficha de UE. Ver la sección de fuentes de la página. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Matriz = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // kind: 'order' = el sujeto es posterior; 'contemp' = a la vez, sin orden; 'identity' = la misma unidad; 'none' = sin implicación
  var RELS = [
    { key: 'cubre', act: 'Cubre', pas: 'Cubierto por', kind: 'order' },
    { key: 'corta', act: 'Corta', pas: 'Cortado por', kind: 'order' },
    { key: 'rellena', act: 'Rellena', pas: 'Rellenado por', kind: 'order' },
    { key: 'apoya', act: 'Se apoya en', pas: 'Se le apoya', kind: 'order', defeasible: true },
    { key: 'une', act: 'Se une a', pas: 'Se une a', kind: 'contemp' },
    { key: 'igual', act: 'Igual a', pas: 'Igual a', kind: 'identity' },
    { key: 'equiv', act: 'Equivalente a', pas: 'Equivalente a', kind: 'contemp' },
    { key: 'incierta', act: 'Relación incierta', pas: 'Relación incierta', kind: 'none' }
  ];
  var REL = {};
  RELS.forEach(function (r) { REL[r.key] = r; r.order = r.kind === 'order'; r.sym = r.kind !== 'order'; });

  var TYPES = ['Depósito', 'Relleno', 'Corte', 'Estructura', 'Arrasamiento', 'Superficie'];
  var TYPE_NOTE = {
    'Depósito': 'Capa, piso, nivelación, derrumbe, vertido',
    'Relleno': 'Depósito dentro de un corte',
    'Corte': 'Interfaz negativa: fosa, zanja, hoyo de poste, tumba, zanja de cimiento o de expolio',
    'Estructura': 'Muro, mampostería, adobe, tapia, elemento de madera',
    'Arrasamiento': 'Interfaz horizontal: nivel al que se arrasó o expolió un muro',
    'Superficie': 'Interfaz de capa o de uso, solo si se numera aparte'
  };
  var TYPE_ALIAS = {
    'deposito': 'Depósito', 'capa': 'Depósito', 'estrato': 'Depósito',
    'relleno': 'Relleno',
    'corte': 'Corte', 'interfaz negativa': 'Corte', 'interfaz': 'Corte', 'fosa': 'Corte', 'zanja': 'Corte',
    'estructura': 'Estructura', 'muro': 'Estructura', 'deposito vertical': 'Estructura', 'uem': 'Estructura', 'mamposteria': 'Estructura',
    'arrasamiento': 'Arrasamiento', 'interfaz de arrasamiento': 'Arrasamiento', 'interfaz horizontal': 'Arrasamiento',
    'superficie': 'Superficie', 'superficie de uso': 'Superficie', 'interfaz de capa': 'Superficie'
  };

  // Qué admite cada tipo como sujeto (act) y como objeto (pas): 'si', 'aviso' o 'no'.
  function defaultRules() {
    function row(act, pas) {
      var keys = ['cubre', 'corta', 'rellena', 'apoya', 'une'];
      var o = { act: {}, pas: {} };
      keys.forEach(function (k, i) { o.act[k] = act[i]; o.pas[k] = pas[i]; });
      ['igual', 'equiv', 'incierta'].forEach(function (k) { o.act[k] = 'si'; o.pas[k] = 'si'; });
      return o;
    }
    //                     cubre    corta   rellena  apoya    une            cubierto cortado  rellenado se le apoya  se une
    return {
      'Depósito':     row(['si',   'no',   'aviso', 'aviso', 'no'],        ['si',    'si',    'no',     'aviso',    'no']),
      'Relleno':      row(['si',   'no',   'si',    'aviso', 'no'],        ['si',    'si',    'no',     'aviso',    'no']),
      'Corte':        row(['no',   'si',   'no',    'no',    'no'],        ['si',    'aviso', 'si',     'no',       'no']),
      'Estructura':   row(['si',   'no',   'aviso', 'si',    'si'],        ['si',    'si',    'no',     'si',       'si']),
      'Arrasamiento': row(['no',   'si',   'no',    'no',    'no'],        ['si',    'aviso', 'aviso',  'no',       'no']),
      'Superficie':   row(['si',   'no',   'no',    'no',    'no'],        ['si',    'si',    'no',     'aviso',    'no'])
    };
  }
  function normRule(v) { return v === true ? 'si' : v === false ? 'no' : (v === 'si' || v === 'aviso' || v === 'no') ? v : 'si'; }

  // Por qué, en las combinaciones que no son "sí". Clave: lado|relación|tipo, o lado|relación|* para todos.
  var WHY = {
    'act|corta|*': 'solo un corte corta.',
    'pas|corta|Corte': 'un corte que corta otro corte. Mejor relacionarlo con su relleno, si queda.',
    'pas|corta|Arrasamiento': 'normalmente se relaciona con lo que cubre el arrasamiento.',
    'pas|rellena|*': 'solo se rellena un corte.',
    'pas|rellena|Arrasamiento': 'si es una zanja de expolio, numérala como Corte.',
    'act|rellena|Depósito': 'si rellena un corte, debería ser Relleno.',
    'act|rellena|Estructura': 'posible si es un cimiento; revísalo.',
    'act|rellena|*': 'ese tipo no rellena.',
    'act|apoya|Depósito': 'un depósito apoyado: válido para un piso contra un muro, según el manual.',
    'act|apoya|Relleno': 'un relleno apoyado: revísalo.',
    'act|apoya|*': 'ese tipo no se apoya.',
    'pas|apoya|*': 'normalmente se apoya en una estructura.',
    'pas|apoya|Corte': 'nada se apoya en un corte.',
    'act|une|*': 'solo se unen estructuras.',
    'pas|une|*': 'solo se unen estructuras.',
    'act|cubre|Corte': 'un corte no cubre; cubre su relleno.',
    'act|cubre|Arrasamiento': 'un arrasamiento no cubre; corta el muro.',
    'act|cubre|*': 'ese tipo no cubre.'
  };
  function why(side, rel, tipo) { return WHY[side + '|' + rel + '|' + tipo] || WHY[side + '|' + rel + '|*'] || ''; }

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9#]+/g, ' ').trim();
  }
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function canonType(t) { var c = clean(t); if (!c) return ''; return TYPE_ALIAS[norm(c)] || c; }

  function parseDepth(s) {
    var m = clean(s).replace(/,/g, '.').match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|a|hasta)\s*(-?\d+(?:\.\d+)?)/i);
    if (!m) return null;
    return { from: parseFloat(m[1]), to: parseFloat(m[2]) };
  }
  function parseNum(s) {
    var m = clean(s).replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }

  // "2, 5?, 6~, UE2:3, n/o": ? = dudosa; ~ = sin implicación temporal (solo para Se apoya)
  function parseRefs(cell, corte) {
    var out = { refs: [], notObserved: false, bad: [] };
    var txt = clean(cell);
    if (!txt) return out;
    txt.split(/[,;]+/).forEach(function (tok) {
      tok = clean(tok);
      if (!tok) return;
      if (/^(n\s*\/\s*o|no\s*obs.*|no observad[oa])$/i.test(tok)) { out.notObserved = true; return; }
      var inferred = false, noOrder = false, m;
      while ((m = tok.match(/[?~]$/))) {
        if (m[0] === '?') inferred = true; else noOrder = true;
        tok = clean(tok.slice(0, -1));
      }
      var c = corte, n = tok;
      m = tok.match(/^(.+?)\s*:\s*(.+)$/);
      if (m) { c = clean(m[1]); n = clean(m[2]); }
      n = n.replace(/^(ue|e)\s*(?=\d)/i, '');
      if (!n || /\s/.test(n)) { out.bad.push(tok); return; }
      out.refs.push({ id: uid(c, n), inferred: inferred, noOrder: noOrder });
    });
    return out;
  }

  function uid(corte, n) { return clean(corte) + ':' + clean(n); }

  var ACTIVE = ['cubre', 'corta', 'rellena', 'apoya', 'une', 'igual', 'equiv', 'incierta'];
  var PASSIVE = { cubierto: 'cubre', cortado: 'corta', rellenado: 'rellena', seLeApoya: 'apoya' };
  var TEXT_FIELDS = ['ubic', 'prof', 'grosor', 'tipo', 'desc', 'color', 'consist', 'comp', 'mat'];

  function emptyRow(corte, n) {
    var r = { corte: corte || '', n: n == null ? '' : String(n) };
    TEXT_FIELDS.concat(ACTIVE).concat(Object.keys(PASSIVE)).forEach(function (k) { r[k] = ''; });
    return r;
  }

  function rowHasData(r) {
    return ACTIVE.concat(Object.keys(PASSIVE)).concat(['prof', 'grosor', 'desc', 'color', 'consist', 'comp', 'mat', 'ubic'])
      .some(function (k) { return clean(r[k]) !== ''; });
  }

  /* ---------- lectura de lo pegado desde la hoja ---------- */

  function parseTSV(text) {
    var rows = [], row = [], cell = '', q = false, i = 0, ch;
    text = String(text).replace(/\r\n?/g, '\n');
    while (i < text.length) {
      ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === '\t') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
      i++;
    }
    row.push(cell);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
  }

  var HEADER_MAP = [
    ['n', ['#', 'n', 'no', 'num', 'numero', 'estrato', 'ue', 'unidad']],
    ['corte', ['corte']],
    ['ubic', ['ubicacion']],
    ['prof', ['profundidad cm', 'profundidad']],
    ['grosor', ['grosor cm', 'grosor']],
    ['tipo', ['tipo']],
    ['cubre', ['cubre']],
    ['cubierto', ['cubierto', 'cubierto por']],
    ['corta', ['corta']],
    ['cortado', ['cortado', 'cortado por']],
    ['rellena', ['rellena']],
    ['rellenado', ['rellenado', 'rellenado por']],
    ['apoya', ['se apoya', 'se apoya en']],
    ['seLeApoya', ['se le apoya']],
    ['une', ['se une', 'se une a']],
    ['igual', ['igual', 'igual a']],
    ['equiv', ['equivalente', 'equivalente a']],
    ['incierta', ['incierta', 'relacion incierta']],
    ['desc', ['descripcion']],
    ['color', ['color']],
    ['consist', ['consistencia']],
    ['comp', ['composicion']],
    ['mat', ['materiales presentes', 'materiales']]
  ];

  function importTable(text) {
    var grid = parseTSV(text);
    var res = { rows: [], error: '', skipped: 0 };
    var h = -1, i, j;
    for (i = 0; i < Math.min(grid.length, 10); i++) {
      var names = grid[i].map(norm);
      if (names.indexOf('corte') >= 0 && names.indexOf('cubre') >= 0) { h = i; break; }
    }
    if (h < 0) {
      res.error = 'No encuentro la fila de títulos. Copia también la fila que dice CORTE, TIPO, Cubre…';
      return res;
    }
    var head = grid[h].map(norm), col = {};
    HEADER_MAP.forEach(function (pair) {
      for (j = 0; j < head.length; j++) {
        if (pair[1].indexOf(head[j]) >= 0 && col[pair[0]] == null) col[pair[0]] = j;
      }
    });
    if (col.n == null) {
      for (j = 0; j < head.length; j++) { if (head[j] === '') { col.n = j; break; } }
    }
    if (col.n == null) { res.error = 'No encuentro la columna con el número del estrato.'; return res; }
    for (i = h + 1; i < grid.length; i++) {
      var g = grid[i], r = emptyRow('', '');
      Object.keys(col).forEach(function (k) { r[k] = clean(g[col[k]]); });
      Object.keys(PASSIVE).concat(ACTIVE).forEach(function (k) { if (/^not found$/i.test(r[k])) r[k] = ''; });
      r.tipo = canonType(r.tipo);
      if (!r.n || !rowHasData(r)) { res.skipped++; continue; }
      res.rows.push(r);
    }
    if (!res.rows.length) res.error = 'Encontré los títulos, pero ninguna fila con datos.';
    return res;
  }

  function exportTable(rows) {
    var head = ['', 'CORTE', 'UBICACIÓN', 'PROFUNDIDAD (CM)', 'GROSOR (CM)', 'TIPO', 'Cubre', 'Corta', 'Rellena',
      'Se apoya', 'Se une', 'Igual a', 'Equivalente', 'Relación incierta', 'DESCRIPCIÓN', 'COLOR', 'CONSISTENCIA', 'COMPOSICIÓN', 'MATERIALES PRESENTES'];
    var keys = ['n', 'corte', 'ubic', 'prof', 'grosor', 'tipo', 'cubre', 'corta', 'rellena', 'apoya', 'une', 'igual', 'equiv', 'incierta',
      'desc', 'color', 'consist', 'comp', 'mat'];
    var lines = [head.join('\t')];
    rows.forEach(function (r) {
      lines.push(keys.map(function (k) { return clean(r[k]).replace(/\t/g, ' '); }).join('\t'));
    });
    return lines.join('\n');
  }

  // Filas guardadas con la versión anterior
  function migrateRow(r) {
    var o = emptyRow(r.corte, r.n);
    Object.keys(o).forEach(function (k) { if (r[k] != null) o[k] = String(r[k]); });
    o.tipo = canonType(o.tipo);
    return o;
  }
  function migrateRules(saved) {
    var base = defaultRules();
    if (!saved || typeof saved !== 'object') return base;
    TYPES.forEach(function (t) {
      if (!saved[t]) return;
      ['act', 'pas'].forEach(function (side) {
        ACTIVE.forEach(function (k) { if (saved[t][side] && saved[t][side][k] != null) base[t][side][k] = normRule(saved[t][side][k]); });
      });
    });
    return base;
  }

  /* ---------- análisis ---------- */

  function analyse(rows, rules) {
    rules = rules || defaultRules();
    var problems = [], units = {}, order = [], edges = [], info = { notObserved: 0, ignored: 0, noOrder: 0, uncertain: 0 };
    function add(sev, code, msg, ids) { problems.push({ sev: sev, code: code, msg: msg, units: ids || [] }); }

    var cortes = {};
    rows.forEach(function (r) { if (clean(r.n) && rowHasData(r)) cortes[clean(r.corte)] = 1; });
    var manyCortes = Object.keys(cortes).length > 1;
    function label(id) {
      var p = id.indexOf(':'), c = id.slice(0, p), n = id.slice(p + 1);
      return manyCortes && c ? c + '·' + n : 'E' + n;
    }

    // 1. unidades
    rows.forEach(function (r, idx) {
      var n = clean(r.n);
      if (!n) { if (rowHasData(r)) add('error', 'sin-numero', 'La fila ' + (idx + 1) + ' tiene datos pero no tiene número.', []); return; }
      if (!rowHasData(r)) { info.ignored++; return; }
      var id = uid(r.corte, n);
      if (units[id]) { add('error', 'duplicada', label(id) + ' aparece dos veces en el mismo corte.', [id]); return; }
      units[id] = {
        id: id, corte: clean(r.corte), n: n, tipo: canonType(r.tipo), depth: parseDepth(r.prof), grosor: parseNum(r.grosor),
        row: r, idx: idx, label: '', out: [], inc: []
      };
      order.push(id);
    });
    order.forEach(function (id) { units[id].label = label(id); });

    // 2. relaciones declaradas
    var seen = {};
    order.forEach(function (id) {
      var u = units[id];
      ACTIVE.forEach(function (k) {
        var p = parseRefs(u.row[k], u.corte);
        if (p.notObserved) info.notObserved++;
        p.bad.forEach(function (t) {
          add('error', 'ilegible', u.label + ', ' + REL[k].act + ': no entiendo "' + t + '".', [id]);
        });
        p.refs.forEach(function (ref) {
          if (ref.id === id) { add('error', 'propia', u.label + ' se relaciona consigo misma (' + REL[k].act + ').', [id]); return; }
          if (!units[ref.id]) {
            add('error', 'no-existe', u.label + ' ' + REL[k].act.toLowerCase() + ' ' + label(ref.id) + ', que no está en la tabla.', [id]);
            return;
          }
          if (ref.noOrder && !REL[k].defeasible) {
            add('aviso', 'tilde', u.label + ', ' + REL[k].act + ': ~ solo vale en «Se apoya».', [id]);
          }
          var a = id, b = ref.id;
          var sig = REL[k].order ? k + '|' + a + '|' + b : k + '|' + (a < b ? a + '|' + b : b + '|' + a);
          if (seen[sig]) {
            if (!ref.inferred) seen[sig].inferred = false;
            if (!ref.noOrder) seen[sig].noOrder = false;
            return;
          }
          var e = { from: a, to: b, rel: k, inferred: ref.inferred, noOrder: !!(ref.noOrder && REL[k].defeasible) };
          seen[sig] = e; edges.push(e);
          units[a].out.push(e); units[b].inc.push(e);
        });
      });
    });
    function givesOrder(e) { return REL[e.rel].order && !e.noOrder; }
    edges.forEach(function (e) {
      if (e.noOrder) info.noOrder++;
      if (e.rel === 'incierta') info.uncertain++;
    });

    // 3. columnas pasivas pegadas: deben coincidir con lo que dice la otra fila
    order.forEach(function (id) {
      var u = units[id];
      Object.keys(PASSIVE).forEach(function (pk) {
        var k = PASSIVE[pk];
        parseRefs(u.row[pk], u.corte).refs.forEach(function (ref) {
          if (!units[ref.id]) {
            add('error', 'no-existe', u.label + ' dice "' + REL[k].pas.toLowerCase() + ' ' + label(ref.id) + '", que no está en la tabla.', [id]);
            return;
          }
          if (!seen[k + '|' + ref.id + '|' + id]) {
            add('error', 'reciprocidad', u.label + ' dice "' + REL[k].pas.toLowerCase() + ' ' + label(ref.id) + '", pero ' +
              label(ref.id) + ' no dice "' + REL[k].act.toLowerCase() + ' ' + u.label + '".', [id, ref.id]);
          }
        });
      });
    });

    // 4. reglas por tipo
    function sevOf(v) { return v === 'no' ? 'error' : v === 'aviso' ? 'aviso' : null; }
    edges.forEach(function (e) {
      var a = units[e.from], b = units[e.to], ra = rules[a.tipo], rb = rules[b.tipo], s, w;
      var verb = REL[e.rel].act.toLowerCase();
      if (ra && (s = sevOf(normRule(ra.act[e.rel])))) {
        w = why('act', e.rel, a.tipo);
        add(s, 'tipo', a.label + ' (' + a.tipo + ') ' + verb + ' ' + b.label + ': ' + (w || 'ese tipo no admite «' + REL[e.rel].act + '».'), [a.id, b.id]);
      }
      var bside = REL[e.rel].sym ? 'act' : 'pas';
      if (rb && (s = sevOf(normRule(rb[bside][e.rel])))) {
        w = why(bside, e.rel, b.tipo);
        add(s, 'tipo', a.label + ' ' + verb + ' ' + b.label + ' (' + b.tipo + '): ' + (w || 'ese tipo no admite «' + REL[e.rel][bside] + '».'), [b.id, a.id]);
      }
      if ((e.rel === 'igual' || e.rel === 'equiv') && a.tipo && b.tipo && a.tipo !== b.tipo) {
        add('aviso', 'tipo-distinto', a.label + ' y ' + b.label + ': «' +
          REL[e.rel].act.toLowerCase() + '» pero de tipos distintos.', [a.id, b.id]);
      }
    });
    order.forEach(function (id) {
      var u = units[id];
      if (!u.tipo) add('aviso', 'sin-tipo', u.label + ' no tiene tipo.', [id]);
      else if (!rules[u.tipo]) add('aviso', 'tipo-desconocido', u.label + ' tiene un tipo sin reglas: "' + u.tipo + '".', [id]);
    });

    // 5. Igual a: la misma unidad, comparten casilla
    var parent = {};
    order.forEach(function (id) { parent[id] = id; });
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    edges.forEach(function (e) { if (REL[e.rel].kind === 'identity') parent[find(e.from)] = find(e.to); });
    var classes = {}, classOrder = [];
    order.forEach(function (id) {
      var c = find(id);
      if (!classes[c]) { classes[c] = { id: c, members: [], out: {}, inc: {}, bad: false }; classOrder.push(c); }
      classes[c].members.push(id);
    });
    function clsLabel(c) { return classes[c].members.map(function (m) { return units[m].label; }).join(' = '); }

    // 6. orden entre clases
    var cedges = {};
    edges.forEach(function (e) {
      if (!givesOrder(e)) return;
      var a = find(e.from), b = find(e.to);
      if (a === b) {
        add('error', 'contradiccion', units[e.from].label + ' y ' + units[e.to].label +
          ' son «igual a» y además ' + units[e.from].label + ' ' + REL[e.rel].act.toLowerCase() + ' ' + units[e.to].label + '.',
          [e.from, e.to]);
        return;
      }
      var key = a + '>' + b;
      if (!cedges[key]) cedges[key] = { from: a, to: b, inferred: true, src: [] };
      if (!e.inferred) cedges[key].inferred = false;
      cedges[key].src.push(e);
    });
    var clist = Object.keys(cedges).map(function (k) { return cedges[k]; });
    clist.forEach(function (e) { classes[e.from].out[e.to] = e; classes[e.to].inc[e.from] = e; });

    // 7. bucles (componentes fuertemente conexas, Tarjan)
    var index = 0, stack = [], onStack = {}, idx = {}, low = {}, sccOf = {}, sccs = [];
    function strong(v) {
      idx[v] = low[v] = index++; stack.push(v); onStack[v] = true;
      Object.keys(classes[v].out).forEach(function (w) {
        if (idx[w] == null) { strong(w); low[v] = Math.min(low[v], low[w]); }
        else if (onStack[w]) low[v] = Math.min(low[v], idx[w]);
      });
      if (low[v] === idx[v]) {
        var comp = [], w;
        do { w = stack.pop(); onStack[w] = false; comp.push(w); sccOf[w] = sccs.length; } while (w !== v);
        sccs.push(comp);
      }
    }
    classOrder.forEach(function (c) { if (idx[c] == null) strong(c); });
    sccs.forEach(function (comp) {
      if (comp.length < 2) return;
      var inComp = {};
      comp.forEach(function (c) { inComp[c] = true; classes[c].bad = true; });
      var start = comp[0], path = [start], seenC = {}, cur = start, guard = 0;
      seenC[start] = true;
      while (guard++ < 1000) {
        var nexts = Object.keys(classes[cur].out).filter(function (w) { return inComp[w]; });
        var nx = nexts.filter(function (w) { return w === start; })[0] ||
          nexts.filter(function (w) { return !seenC[w]; })[0] || nexts[0];
        path.push(nx);
        if (nx === start) break;
        if (seenC[nx]) { path = path.slice(path.indexOf(nx)); break; }
        seenC[nx] = true; cur = nx;
      }
      var ids = [], viaApoya = false;
      comp.forEach(function (c) {
        ids = ids.concat(classes[c].members);
        Object.keys(classes[c].out).forEach(function (w) {
          if (inComp[w]) classes[c].out[w].src.forEach(function (e) { if (e.rel === 'apoya') viaApoya = true; });
        });
      });
      add('error', 'bucle', 'Bucle: ' + path.map(clsLabel).join(' → ') + '.' +
        (viaApoya ? ' Pasa por un «se apoya»: si no implica orden, márcalo con ~.' : ''), ids);
    });

    // 8. grafo sin bucles
    var dag = clist.filter(function (e) { return sccOf[e.from] !== sccOf[e.to]; });
    var succ = {}, pred = {};
    classOrder.forEach(function (c) { succ[c] = []; pred[c] = []; });
    dag.forEach(function (e) { succ[e.from].push(e.to); pred[e.to].push(e.from); });
    function reaches(a, b, skipDirect) {
      var st = succ[a].filter(function (w) { return !(skipDirect && w === b); }), vis = {};
      while (st.length) {
        var v = st.pop();
        if (v === b) return true;
        if (vis[v]) continue;
        vis[v] = true;
        succ[v].forEach(function (w) { st.push(w); });
      }
      return false;
    }

    // 9. relaciones redundantes (reducción transitiva)
    var reduced = [], redundant = [];
    dag.forEach(function (e) { (reaches(e.from, e.to, true) ? redundant : reduced).push(e); });
    var redundantNonFill = redundant.filter(function (e) { return !e.src.every(function (s) { return s.rel === 'rellena'; }); });
    if (redundant.length) {
      var fillOnly = redundant.length - redundantNonFill.length;
      add('info', 'redundante', redundant.length + (redundant.length === 1 ? ' relación se deduce de otras y no se dibuja' : ' relaciones se deducen de otras y no se dibujan') +
        (fillOnly ? ' (' + fillOnly + ' de rellenos superiores, lo normal)' : '') +
        (redundantNonFill.length ? ': ' + redundantNonFill.slice(0, 6).map(function (e) { return clsLabel(e.from) + ' sobre ' + clsLabel(e.to); }).join('; ') + (redundantNonFill.length > 6 ? '…' : '') : '') + '.', []);
    }

    // 10. vínculos sin orden: Se une y Equivalente a. Si hay un camino de orden entre los dos, es contradictorio.
    var links = [], linkSeen = {};
    edges.forEach(function (e) {
      if (REL[e.rel].kind !== 'contemp') return;
      var a = find(e.from), b = find(e.to);
      if (a === b) return;
      var key = e.rel + '|' + (a < b ? a + '|' + b : b + '|' + a);
      if (linkSeen[key]) return;
      linkSeen[key] = true;
      links.push({ a: a, b: b, rel: e.rel, inferred: e.inferred });
      if (!classes[a].bad && !classes[b].bad && (reaches(a, b) || reaches(b, a))) {
        var later = reaches(a, b) ? a : b, earlier = later === a ? b : a;
        add('error', 'contemporaneas', units[e.from].label + ' y ' + units[e.to].label + ': «' + REL[e.rel].act.toLowerCase() + '», pero la secuencia pone ' +
          clsLabel(later) + ' después de ' + clsLabel(earlier) + '.', [e.from, e.to]);
      }
    });

    // 11. rellenos y cortes
    order.forEach(function (id) {
      var u = units[id];
      if (u.tipo !== 'Relleno') return;
      var tg = {};
      u.out.forEach(function (e) { if (e.rel === 'rellena') tg[e.to] = 1; });
      var n = Object.keys(tg).length;
      if (!n) add('aviso', 'relleno-sin-corte', u.label + ' es Relleno pero no dice qué corte rellena.', [id]);
      else if (n > 1) add('aviso', 'relleno-varios', u.label + ' rellena ' + n + ' cortes (' + Object.keys(tg).map(label).join(', ') + ').', [id]);
    });
    order.forEach(function (id) {
      var u = units[id], fills = {};
      u.inc.forEach(function (e) { if (e.rel === 'rellena') fills[find(e.from)] = 1; });
      var f = Object.keys(fills);
      if (f.length < 2) return;
      var loose = [];
      for (var i = 0; i < f.length; i++) for (var j = i + 1; j < f.length; j++) {
        if (classes[f[i]].bad || classes[f[j]].bad) continue;
        if (!reaches(f[i], f[j]) && !reaches(f[j], f[i])) loose.push(clsLabel(f[i]) + ' y ' + clsLabel(f[j]));
      }
      if (loose.length) add('aviso', 'rellenos-sin-orden', 'Rellenos de ' + u.label + ' sin orden entre sí: ' + loose.slice(0, 4).join('; ') +
        (loose.length > 4 ? '…' : '') + '. Falta «Cubre» entre ellos.', [id]);
    });

    // 12. profundidad: solo entre depósitos horizontales en contacto directo y en el mismo corte
    edges.forEach(function (e) {
      if (e.rel !== 'cubre') return;
      var a = units[e.from], b = units[e.to];
      if (a.tipo !== 'Depósito' || b.tipo !== 'Depósito') return;
      if (a.corte !== b.corte || !a.depth || !b.depth) return;
      if (a.depth.from >= b.depth.to) {
        add('error', 'profundidad', a.label + ' cubre a ' + b.label + ', pero empieza a ' + a.depth.from + ' cm y ' +
          b.label + ' termina a ' + b.depth.to + ' cm.', [a.id, b.id]);
      } else if (a.depth.from > b.depth.from) {
        add('aviso', 'profundidad', a.label + ' cubre a ' + b.label + ', pero empieza más abajo (' + a.depth.from + ' cm frente a ' +
          b.depth.from + ' cm). ¿Inclinado?', [a.id, b.id]);
      }
    });
    order.forEach(function (id) {
      var u = units[id];
      if (u.depth && u.depth.to < u.depth.from) add('error', 'profundidad', u.label + ': la profundidad final es menor que la inicial.', [id]);
      if (u.depth && u.grosor != null && Math.abs((u.depth.to - u.depth.from) - u.grosor) > 0.5) {
        add('aviso', 'grosor', u.label + ': el grosor anotado es ' + u.grosor + ' cm y la profundidad da ' + (u.depth.to - u.depth.from) + ' cm.', [id]);
      }
    });

    // 13. sin relaciones de orden
    var linked = {};
    links.forEach(function (l) { linked[l.a] = 1; linked[l.b] = 1; });
    var anyRel = {};
    edges.forEach(function (e) { anyRel[e.from] = 1; anyRel[e.to] = 1; });
    var lonely = classOrder.filter(function (c) { return !succ[c].length && !pred[c].length && !classes[c].bad; });
    lonely.forEach(function (c) {
      var some = classes[c].members.some(function (m) { return anyRel[m]; });
      if (!some) add('aviso', 'suelta', clsLabel(c) + ' no tiene ninguna relación.', classes[c].members);
      else add('aviso', 'sin-orden', clsLabel(c) + ' no tiene ninguna relación de orden.', classes[c].members);
    });
    if (info.notObserved) add('info', 'no-observado', info.notObserved + (info.notObserved === 1 ? ' casilla marcada' : ' casillas marcadas') + ' como no observada (n/o).', []);
    if (info.noOrder) add('info', 'apoyo-sin-orden', info.noOrder + ' «se apoya» con ~, sin orden.', []);
    if (info.uncertain) add('info', 'incierta', info.uncertain + (info.uncertain === 1 ? ' relación incierta, sin dibujar.' : ' relaciones inciertas, sin dibujar.'), []);

    var sevRank = { error: 0, aviso: 1, info: 2 };
    problems.sort(function (a, b) { return sevRank[a.sev] - sevRank[b.sev]; });

    return {
      units: units, order: order, edges: edges, classes: classes, classOrder: classOrder,
      reduced: reduced, redundant: redundant, succ: succ, pred: pred, lonely: lonely, links: links, problems: problems,
      counts: {
        units: order.length, relations: edges.length,
        errors: problems.filter(function (p) { return p.sev === 'error'; }).length,
        warnings: problems.filter(function (p) { return p.sev === 'aviso'; }).length
      },
      clsLabel: clsLabel, classOf: find, label: label
    };
  }

  /* ---------- dibujo: capas, de lo más reciente arriba a lo más antiguo abajo ---------- */

  function layout(A, opt) {
    opt = opt || {};
    var BW = opt.boxW || 74, BH = opt.boxH || 34, GX = opt.gapX || 22, GY = opt.gapY || 46, PAD = 18;
    var lonely = {};
    A.lonely.forEach(function (c) { lonely[c] = true; });
    var nodes = A.classOrder.filter(function (c) { return !lonely[c]; });
    var layer = {}, memo = {};
    function depthOf(c) {
      if (memo[c] != null) return memo[c];
      var d = 0;
      A.pred[c].forEach(function (p) { d = Math.max(d, depthOf(p) + 1); });
      memo[c] = d; return d;
    }
    nodes.forEach(function (c) { layer[c] = depthOf(c); });
    // una unidad sin nada encima baja hasta justo encima de lo que cubre
    function minSucc(c) { var m = Infinity; A.succ[c].forEach(function (w) { if (layer[w] != null) m = Math.min(m, layer[w]); }); return m; }
    nodes.forEach(function (c) { if (!A.pred[c].length && A.succ[c].length) layer[c] = Math.max(layer[c], minSucc(c) - 1); });
    // las unidas y las equivalentes, a la misma altura cuando el orden lo permite
    for (var it = 0; it < 4; it++) {
      A.links.forEach(function (lk) {
        if (layer[lk.a] == null || layer[lk.b] == null || layer[lk.a] === layer[lk.b]) return;
        var hi = layer[lk.a] < layer[lk.b] ? lk.a : lk.b, lo = hi === lk.a ? lk.b : lk.a;
        if (minSucc(hi) > layer[lo]) layer[hi] = layer[lo];
      });
    }
    var maxL = 0;
    nodes.forEach(function (c) { maxL = Math.max(maxL, layer[c]); });

    var width = {};
    nodes.forEach(function (c) { width[c] = Math.max(BW, 18 + A.clsLabel(c).length * 8.2); });

    var layers = [], i;
    for (i = 0; i <= maxL; i++) layers.push([]);
    nodes.forEach(function (c) { layers[layer[c]].push(c); });
    var up = {}, down = {}, chains = [], dn = 0;
    function link(a, b) { (down[a] = down[a] || []).push(b); (up[b] = up[b] || []).push(a); }
    A.reduced.forEach(function (e) {
      var chain = [e.from], l;
      for (l = layer[e.from] + 1; l < layer[e.to]; l++) {
        var d = '~' + (dn++);
        layer[d] = l; width[d] = 6; layers[l].push(d); chain.push(d);
      }
      chain.push(e.to);
      for (l = 0; l < chain.length - 1; l++) link(chain[l], chain[l + 1]);
      chains.push({ edge: e, chain: chain });
    });
    // los vínculos sin orden también acercan las cajas
    var side = {};
    A.links.forEach(function (lk) {
      if (lonely[lk.a] || lonely[lk.b]) return;
      (side[lk.a] = side[lk.a] || []).push(lk.b); (side[lk.b] = side[lk.b] || []).push(lk.a);
    });

    var pos = {};
    layers.forEach(function (L) { L.forEach(function (c, k) { pos[c] = k; }); });
    function sweep(L, nb) {
      var keyed = L.map(function (c, k) {
        var ns = (nb[c] || []).concat(side[c] || []);
        var b = ns.length ? ns.reduce(function (s, x) { return s + pos[x]; }, 0) / ns.length : pos[c];
        return { c: c, b: b, k: k };
      });
      keyed.sort(function (x, y) { return x.b - y.b || x.k - y.k; });
      keyed.forEach(function (o, k) { L[k] = o.c; pos[o.c] = k; });
    }
    for (var pass = 0; pass < 6; pass++) {
      for (i = 1; i < layers.length; i++) sweep(layers[i], up);
      for (i = layers.length - 2; i >= 0; i--) sweep(layers[i], down);
    }

    var X = {}, Y = {}, totalW;
    var rowW = layers.map(function (L) {
      return L.reduce(function (s, c) { return s + width[c]; }, 0) + GX * Math.max(0, L.length - 1);
    });
    totalW = Math.max.apply(null, rowW.concat([BW]));
    layers.forEach(function (L, li) {
      var x = PAD + (totalW - rowW[li]) / 2;
      L.forEach(function (c) { X[c] = x + width[c] / 2; Y[c] = PAD + li * (BH + GY); x += width[c] + GX; });
    });
    for (pass = 0; pass < 4; pass++) {
      layers.forEach(function (L) {
        L.forEach(function (c, k) {
          var ns = (up[c] || []).concat(down[c] || []);
          if (!ns.length) return;
          var want = ns.reduce(function (s, x) { return s + X[x]; }, 0) / ns.length;
          var lo = k > 0 ? X[L[k - 1]] + width[L[k - 1]] / 2 + GX + width[c] / 2 : PAD + width[c] / 2;
          var hi = k < L.length - 1 ? X[L[k + 1]] - width[L[k + 1]] / 2 - GX - width[c] / 2 : PAD + totalW - width[c] / 2;
          if (lo <= hi) X[c] = Math.min(hi, Math.max(lo, want));
        });
      });
    }

    var boxes = nodes.map(function (c) {
      return {
        id: c, members: A.classes[c].members, label: A.clsLabel(c), bad: A.classes[c].bad,
        x: X[c] - width[c] / 2, y: Y[c], w: width[c], h: BH, cx: X[c]
      };
    });
    var paths = chains.map(function (ch) {
      var pts = [], k;
      for (k = 0; k < ch.chain.length; k++) {
        var c = ch.chain[k];
        if (k === 0) pts.push([X[c], Y[c] + BH]);
        else if (k === ch.chain.length - 1) pts.push([X[c], Y[c]]);
        else { pts.push([X[c], Y[c]]); pts.push([X[c], Y[c] + BH]); }
      }
      var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
      for (k = 1; k < pts.length; k++) {
        var p = pts[k - 1], q = pts[k];
        if (Math.abs(p[0] - q[0]) < 0.5) d += ' L' + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
        else {
          var my = ((p[1] + q[1]) / 2).toFixed(1);
          d += ' L' + p[0].toFixed(1) + ' ' + my + ' L' + q[0].toFixed(1) + ' ' + my + ' L' + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
        }
      }
      return { d: d, from: ch.edge.from, to: ch.edge.to, inferred: ch.edge.inferred };
    });

    var mainH = nodes.length ? PAD + (maxL + 1) * BH + maxL * GY : 0;
    var loose = [], lx = PAD, ly = mainH + (nodes.length ? 44 : PAD + 14);
    var looseW = Math.max(totalW, 300);
    A.lonely.forEach(function (c) {
      var w = Math.max(BW, 18 + A.clsLabel(c).length * 8.2);
      if (lx + w > PAD + looseW && lx > PAD) { lx = PAD; ly += BH + 12; }
      loose.push({ id: c, members: A.classes[c].members, label: A.clsLabel(c), bad: false, loose: true, x: lx, y: ly, w: w, h: BH, cx: lx + w / 2 });
      lx += w + 12;
    });
    var all = boxes.concat(loose), byId = {};
    all.forEach(function (b) { byId[b.id] = b; });

    // líneas de vínculo: de borde a borde, en la mitad de la altura
    var linkPaths = A.links.map(function (lk) {
      var a = byId[lk.a], b = byId[lk.b];
      if (!a || !b) return null;
      var l = a.cx <= b.cx ? a : b, r = l === a ? b : a, d;
      var ay = l.y + l.h / 2, by = r.y + r.h / 2;
      if (r.x >= l.x + l.w) d = 'M' + (l.x + l.w).toFixed(1) + ' ' + ay.toFixed(1) + ' L' + r.x.toFixed(1) + ' ' + by.toFixed(1);
      else {
        var t = a.y <= b.y ? a : b, u = t === a ? b : a;
        d = 'M' + t.cx.toFixed(1) + ' ' + (t.y + t.h).toFixed(1) + ' L' + u.cx.toFixed(1) + ' ' + u.y.toFixed(1);
      }
      return { d: d, a: lk.a, b: lk.b, rel: lk.rel, inferred: lk.inferred };
    }).filter(Boolean);

    var H = loose.length ? ly + BH + PAD : mainH + PAD;
    var W = Math.max(totalW, loose.length ? looseW : 0) + PAD * 2;
    return { boxes: all, paths: paths, links: linkPaths, width: W, height: Math.max(H, 60), looseY: loose.length ? (mainH + (nodes.length ? 30 : PAD)) : null, layers: maxL + 1 };
  }

  function around(A, c) {
    function walk(start, nb) {
      var out = {}, st = nb[start].slice();
      while (st.length) { var v = st.pop(); if (out[v]) continue; out[v] = true; nb[v].forEach(function (w) { st.push(w); }); }
      return Object.keys(out);
    }
    return { later: walk(c, A.pred), earlier: walk(c, A.succ) };
  }

  return {
    RELS: RELS, REL: REL, TYPES: TYPES, TYPE_NOTE: TYPE_NOTE, ACTIVE: ACTIVE, PASSIVE: PASSIVE, defaultRules: defaultRules, normRule: normRule, why: why,
    emptyRow: emptyRow, rowHasData: rowHasData, parseRefs: parseRefs, parseDepth: parseDepth, canonType: canonType,
    importTable: importTable, exportTable: exportTable, migrateRow: migrateRow, migrateRules: migrateRules,
    analyse: analyse, layout: layout, around: around, uid: uid, norm: norm
  };
});
