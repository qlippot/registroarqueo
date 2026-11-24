const M = require('../src/core.js');
const assert = require('assert');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok', name); }
function row(corte, num, o) { return Object.assign(M.emptyRow(corte, num), o); }
const codes = (A, sev) => A.problems.filter(p => !sev || p.sev === sev).map(p => p.code);
const D = 'Depósito', R = 'Relleno', C = 'Corte', S = 'Estructura';

t("the user's two cortes load clean", () => {
  const rows = [
    row('UE1', 1, { prof: '0-130', grosor: '130', tipo: D, cubre: '2', desc: 'Relleno #1.' }),
    row('UE1', 2, { prof: '130-150', grosor: '20', tipo: D, cubierto: '1', desc: 'Tierra.' }),
    row('UE1', 3, { tipo: D }),
  ];
  const A = M.analyse(rows);
  assert.strictEqual(A.counts.units, 2);
  assert.deepStrictEqual(A.problems, []);
  const L = M.layout(A);
  assert.ok(L.boxes.find(b => b.label === 'E1').y < L.boxes.find(b => b.label === 'E2').y);
});

t('refs: several, dudosa, sin orden, other corte, n/o', () => {
  const p = M.parseRefs('2, 5?, 6~, 7?~, UE2:3 ; n/o', 'UE1');
  assert.deepStrictEqual(p.refs.map(r => [r.id, r.inferred, r.noOrder]),
    [['UE1:2', false, false], ['UE1:5', true, false], ['UE1:6', false, true], ['UE1:7', true, true], ['UE2:3', false, false]]);
  assert.strictEqual(p.notObserved, true);
});

t('type aliases', () => {
  assert.strictEqual(M.canonType('Depósito vertical'), 'Estructura');
  assert.strictEqual(M.canonType('muro'), 'Estructura');
  assert.strictEqual(M.canonType('deposito'), 'Depósito');
  assert.strictEqual(M.canonType('Interfaz negativa'), 'Corte');
});

t('loop reported; mentions ~ when it runs through an abutment', () => {
  const rows = [
    row('A', 1, { tipo: D, cubre: '2' }), row('A', 2, { tipo: S, apoya: '3' }), row('A', 3, { tipo: S, cubre: '1' }),
  ];
  const A = M.analyse(rows);
  const b = A.problems.find(p => p.code === 'bucle');
  assert.ok(b && /~/.test(b.msg));
  rows[1].apoya = '3~';
  const A2 = M.analyse(rows);
  assert.ok(!codes(A2).includes('bucle'));
  assert.ok(codes(A2).includes('apoyo-sin-orden'));
});

t('reciprocity', () => {
  const rows = [row('A', 1, { tipo: D, cubre: '2' }), row('A', 2, { tipo: D, cubierto: '1, 3' }), row('A', 3, { tipo: D, cubre: '4' }), row('A', 4, { tipo: D, desc: 'x' })];
  const r = M.analyse(rows).problems.filter(p => p.code === 'reciprocidad');
  assert.strictEqual(r.length, 1);
});

t('type rules from the sources', () => {
  const rows = [
    row('A', 1, { tipo: D, corta: '2' }),           // a deposit cannot cut: error
    row('A', 2, { tipo: D, desc: 'x' }),
    row('A', 3, { tipo: R, rellena: '2' }),          // fills something that is not a cut: error
    row('A', 4, { tipo: C, corta: '2, 5' }),         // cut cuts cut: warning
    row('A', 5, { tipo: C, corta: '2' }),
    row('A', 6, { tipo: R, rellena: '4', cubre: '7' }), // fine
    row('A', 7, { tipo: R, rellena: '4' }),
    row('A', 8, { tipo: D, une: '2' }),              // une between deposits: error both sides
    row('A', 9, { tipo: D, apoya: '10' }),           // deposit abuts: warning
    row('A', 10, { tipo: S, cubre: '2' }),
  ];
  const A = M.analyse(rows);
  const tp = A.problems.filter(p => p.code === 'tipo');
  const err = tp.filter(p => p.sev === 'error').map(p => p.msg);
  const warn = tp.filter(p => p.sev === 'aviso').map(p => p.msg);
  assert.ok(err.some(m => /solo un corte corta/.test(m)), 'deposit cuts');
  assert.ok(err.some(m => /solo se rellena un corte/.test(m)), 'fills non-cut');
  assert.ok(warn.some(m => /corta otro corte/.test(m)), 'cut cuts cut');
  assert.strictEqual(err.filter(m => /solo se unen estructuras/.test(m)).length, 2);
  assert.ok(warn.some(m => /un depósito apoyado/.test(m)), 'deposit abuts');
  assert.ok(!codes(A).includes('rellenos-sin-orden'));
});

t('fills: missing target, several targets, unordered fills of one cut', () => {
  const rows = [
    row('A', 1, { tipo: C, corta: '9' }), row('A', 2, { tipo: C, corta: '9' }),
    row('A', 3, { tipo: R, rellena: '1' }), row('A', 4, { tipo: R, rellena: '1' }),
    row('A', 5, { tipo: R, rellena: '1, 2' }), row('A', 6, { tipo: R, cubre: '3' }),
    row('A', 9, { tipo: D, desc: 'base' }),
  ];
  const c = codes(M.analyse(rows));
  ['relleno-sin-corte', 'relleno-varios', 'rellenos-sin-orden'].forEach(k => assert.ok(c.includes(k), k));
});

t('upper fill relation to its cut is redundant, not an error', () => {
  const rows = [row('A', 1, { tipo: C, corta: '4' }), row('A', 2, { tipo: R, rellena: '1' }), row('A', 3, { tipo: R, rellena: '1', cubre: '2' }), row('A', 4, { tipo: D, desc: 'x' })];
  const A = M.analyse(rows);
  assert.strictEqual(A.counts.errors, 0);
  assert.strictEqual(A.redundant.length, 1);
  assert.ok(A.problems.find(p => p.code === 'redundante').msg.includes('rellenos superiores'));
});

t('depth check only between deposits in the same corte', () => {
  const rows = [
    row('A', 1, { tipo: D, prof: '150-180', cubre: '2' }), row('A', 2, { tipo: D, prof: '0-150' }),
    row('A', 3, { tipo: R, prof: '150-180', cubre: '4', rellena: '5' }), row('A', 4, { tipo: R, prof: '0-150', rellena: '5' }), row('A', 5, { tipo: C, corta: '2' }),
    row('A', 6, { tipo: S, prof: '150-180', cubre: '7' }), row('A', 7, { tipo: D, prof: '0-150' }),
  ];
  const dp = M.analyse(rows).problems.filter(p => p.code === 'profundidad');
  assert.strictEqual(dp.length, 1);
  assert.deepStrictEqual(dp[0].units, ['A:1', 'A:2']);
});

t('Igual a merges; Equivalente a and Se une link without merging', () => {
  const rows = [
    row('A', 1, { tipo: D, cubre: '2' }), row('A', 2, { tipo: D, igual: 'B:2' }),
    row('B', 1, { tipo: D, cubre: '2', equiv: 'A:1' }), row('B', 2, { tipo: D, cubre: '3' }), row('B', 3, { tipo: D, desc: 'base' }),
  ];
  const A = M.analyse(rows);
  assert.strictEqual(A.counts.errors, 0);
  const L = M.layout(A);
  assert.ok(L.boxes.some(b => b.label === 'A·2 = B·2'));
  assert.ok(L.boxes.some(b => b.label === 'A·1') && L.boxes.some(b => b.label === 'B·1'));
  assert.strictEqual(L.links.length, 1);
});

t('equivalent or bonded units that the sequence orders are a contradiction', () => {
  const A = M.analyse([row('A', 1, { tipo: D, cubre: '2', equiv: '3' }), row('A', 2, { tipo: D, cubre: '3' }), row('A', 3, { tipo: D, desc: 'x' })]);
  assert.ok(codes(A, 'error').includes('contemporaneas'));
  const B = M.analyse([row('A', 1, { tipo: S, apoya: '2', une: '2' }), row('A', 2, { tipo: S, cubre: '3' }), row('A', 3, { tipo: D, desc: 'x' })]);
  assert.ok(codes(B, 'error').includes('contemporaneas'));
  const Cq = M.analyse([row('A', 1, { tipo: D, cubre: '2', igual: '2' }), row('A', 2, { tipo: D, desc: 'x' })]);
  assert.ok(codes(Cq, 'error').includes('contradiccion'));
});

t('three-level rules can be edited; old boolean rules migrate', () => {
  const rows = [row('A', 1, { tipo: D, corta: '2' }), row('A', 2, { tipo: D, desc: 'x' })];
  const rules = M.defaultRules(); rules['Depósito'].act.corta = 'aviso';
  const p = M.analyse(rows, rules).problems.filter(x => x.code === 'tipo');
  assert.strictEqual(p.length, 1); assert.strictEqual(p[0].sev, 'aviso');
  const mig = M.migrateRules({ 'Depósito': { act: { corta: true }, pas: {} } });
  assert.strictEqual(mig['Depósito'].act.corta, 'si');
  assert.strictEqual(mig['Corte'].act.corta, 'si');
  assert.strictEqual(M.migrateRow({ corte: 'A', n: 1, tipo: 'Depósito vertical', cubre: '2' }).tipo, 'Estructura');
});

t('paste from the sheet', () => {
  const head = ['', 'CORTE', 'UBICACIÓN', 'PROFUNDIDAD (CM):', 'GROSOR (CM):', 'TIPO', '', 'Cubre', 'Cubierto', 'Corta', 'Cortado', 'Rellena',
    'Rellenado', 'Se apoya', 'Se le apoya', 'Se une', 'Equivalente', 'RELACIONES:', 'DESCRIPCIÓN', 'COLOR:', 'CONSISTENCIA:', 'COMPOSICIÓN:', 'MATERIALES PRESENTES:', 'Texto'];
  const r1 = ['1', 'UE1', '', '0-130', '130', 'Depósito', '', '2', '', '', '', '', '', '', '', '', '', 'Cubre: 2', 'Relleno #1.', 'amarillo.', 'Compacto.', 'Suelo arenoso', 'No.', '"E1\nx"'];
  const r2 = ['2', 'UE1', '', '130-150', '20', 'Depósito', '', '', '1', '', '', '', '', '', '', '', '', 'Cubierto: 1', 'Tierra.', 'negro.', 'Compacto.', 'Tierra.', 'No.', 'E2'];
  const r4 = ['103', '', '', '', '', '', '', '', 'Not Found', '', 'Not Found', '', 'Not Found', '', 'Not Found', '', '', '', '', '', '', '', '', ''];
  const res = M.importTable([head, r1, r2, r4].map(r => r.join('\t')).join('\n'));
  assert.strictEqual(res.error, '');
  assert.strictEqual(res.rows.length, 2);
  assert.deepStrictEqual(M.analyse(res.rows).problems, []);
  const back = M.importTable(M.exportTable(res.rows));
  assert.strictEqual(back.rows[0].cubre, '2');
});

t('layout stays inside its bounds; 200 units are quick', () => {
  const rows = []; let s = 7;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 1; i <= 200; i++) {
    const c = [];
    for (let k = 0; k < 2; k++) { const j = i + 1 + Math.floor(rnd() * 6); if (j <= 200) c.push(j); }
    rows.push(row('A', i, { tipo: D, cubre: c.join(','), desc: 'u' }));
  }
  const t0 = Date.now(); const A = M.analyse(rows); const L = M.layout(A);
  assert.strictEqual(A.counts.errors, 0);
  assert.ok(Date.now() - t0 < 2000);
  L.boxes.forEach(b => { assert.ok(b.x >= 0 && b.x + b.w <= L.width + 0.01); });
});

console.log(n + ' tests passed');
