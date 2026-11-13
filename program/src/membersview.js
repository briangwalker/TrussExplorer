// ===== The Members tab's table (#416, TE-B-332; UI-S6, UI-H4, UI-A17, UI-A18) =====
// Turns TrussMembers.rows(tr, res) into the Members table in Analysis, using the shared table piece (TrussPieces.tableHTML).
//   sorted(rows)              every member, highest use first (UI-S6); ties keep member order
//   csvRows(rows, typeLabel)  the CSV's rows, header first: EXACTLY what the app's rowsForCsv() gives (same columns,
//                             same rounding, same member order), checked on the real page in tests/ui/members.mjs
//   csvOf(table)              the CSV text of those rows, escaped exactly as the app's csvOf() (spreadsheet formulas kept as text)
//   tableHTML(P, rows, o)     the table: T/C as a letter and a word (UI-A17), the use bar in the app's meaning colours
//                             (UI-A18, ART-K14), "fails" in words; o = { typeLabel, lit (member k), id }
//   install(doc)              its CSS, once, in <style id="te-members">
//   toolbarHTML(P)            Copy table / Download CSV buttons (data-act="members-copy" / "members-csv"); the shell wires them
// Pure: no DOM, no app globals; the pieces, the rows and the type words come in as arguments (CODE-F1, CODE-F5).
(function (root) {
'use strict';

const HEAD = ['Elem', 'i', 'j', 'Type', 'Sticks', 'L (mm)', 'F (N)', 'T/C', 'P_cr (N)', 'Buckling?(Y/N)', 'Capacity (N)', 'Use (%)', 'Governs'];
const COLUMNS = [
  { key: 'k', label: 'Member', num: true }, { key: 'i', label: 'i', num: true }, { key: 'j', label: 'j', num: true },
  { key: 'type', label: 'Type' }, { key: 'sticks', label: 'Sticks', num: true },
  { key: 'L', label: 'L (mm)', num: true }, { key: 'F', label: 'F (N)', num: true }, { key: 'TC', label: 'T/C' },
  { key: 'Pcr', label: 'P_cr (N)', num: true }, { key: 'buckles', label: 'Buckling?' },
  { key: 'cap', label: 'Capacity (N)', num: true }, { key: 'use', label: 'Use' },
];
const TC_WORD = { T: 'tension', C: 'compression', 0: 'no force' };

function need(rows) { if (!Array.isArray(rows)) throw new Error('TrussMembersView: rows must be the array TrussMembers.rows() gives'); return rows; }
function words(typeLabel, t) { return typeLabel && typeLabel[t] != null ? typeLabel[t] : t; }

function sorted(rows) {
  return need(rows).map((r, n) => [r, n]).sort((a, b) => (b[0].use - a[0].use) || (a[1] - b[1])).map(x => x[0]);
}

// the same cells, in the same order and rounding, as rowsForCsv() in src/app/30-drawing.js
function csvRow(r, typeLabel) {
  return [r.k, r.i, r.j, words(typeLabel, r.type), r.sticks + (r.compact ? ' (2x2)' : ''), r.L_mm.toFixed(1), r.F_N.toFixed(2), r.TC, r.Pcr_N.toFixed(1), r.buckles,
    r.cap_N.toFixed(1), (r.use * 100).toFixed(0), r.governs];
}
function csvRows(rows, typeLabel) { return [HEAD.slice()].concat(need(rows).map(r => csvRow(r, typeLabel))); }

// as csvSafe() / csvOf() in src/app/30-drawing.js
function csvSafe(v) { if (typeof v !== 'string') return v; const t = v.replace(/[\u0000-\u001F\u007F]+/g, ' '); return /^[=+\-@]/.test(t) && !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t) ? "'" + t : t; }
function csvOf(table) { return table.map(r => r.map(v => { v = csvSafe(v); return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v; }).join(',')).join('\n'); }

function useColour(r) { return r.use >= 1 ? 'var(--bad)' : r.use >= 0.8 ? 'var(--warn)' : r.F_N < 0 ? 'var(--comp)' : 'var(--tens)'; }

function tableHTML(P, rows, o) {
  o = o || {};
  const esc = P.escH;
  const body = sorted(rows).map(r => {
    const c = csvRow(r, o.typeLabel), fails = r.use >= 1, pct = Math.max(0, Math.min(100, r.use * 100)).toFixed(0);
    const gov = r.governs && r.F_N ? ' ' + esc(r.governs) : '';
    return {
      key: r.k, cls: fails ? 'fail' : '',
      cells: { k: c[0], i: c[1], j: c[2], type: c[3], sticks: c[4], L: c[5], F: c[6], Pcr: c[8], buckles: c[9] === 'Y' ? 'Y (yes)' : c[9] === 'N' ? 'N (no)' : c[9], cap: r.F_N ? c[10] : '—' },
      html: {
        TC: `<span class="mv-tc tc-${esc(r.TC)}">${esc(r.TC)} <span class="mv-w">${esc(TC_WORD[r.TC] || '')}</span></span>`,
        use: `<span class="mv-bar" aria-hidden="true"><span style="width:${pct}%;background:${useColour(r)}"></span></span><span class="num">${esc(c[11])}%</span>${gov}${fails ? ' <b class="mv-fail">✕ fails</b>' : ''}`,
      },
    };
  });
  return P.tableHTML({ id: o.id || 'membersTbl', caption: 'Members, highest use first', columns: COLUMNS, rows: body, lit: o.lit, empty: 'No results: the truss is unstable.' });
}

function toolbarHTML(P) {
  return `<div class="mv-tools" data-pc>${P.buttonHTML({ label: 'Copy table', act: 'members-copy', title: 'Copy the member table as CSV' })}${P.buttonHTML({ label: 'Download CSV', act: 'members-csv', title: 'Save the member table as a .csv file' })}</div>`;
}

// its own small CSS, scoped under the table piece; meaning colours are the app's (UI-A18, ART-K14), the rest tokens
const CSS = `
#stage .te-tbl .mv-tc.tc-T{color:var(--tens)}
#stage .te-tbl .mv-tc.tc-C{color:var(--comp)}
#stage .te-tbl .mv-tc{font-weight:700}
#stage .te-tbl .mv-tc.tc-0{color:var(--te-ink)}
#stage .te-tbl .mv-w{font-weight:400;color:var(--te-muted)}
#stage .te-tbl .mv-bar{display:inline-block;width:48px;height:8px;margin-right:6px;vertical-align:middle;background:var(--te-surface-2);border:1px solid var(--te-line)}
#stage .te-tbl .mv-bar>span{display:block;height:100%}
#stage .te-tbl .mv-fail{color:var(--bad)}
#stage .mv-tools{display:flex;gap:8px;margin:0 0 8px}`;

// once per page: puts CSS in <style id="te-members"> (like TrussPieces.install); a second call does nothing
function install(doc) {
  if (!doc || doc.getElementById('te-members')) return false;
  const st = doc.createElement('style'); st.id = 'te-members'; st.textContent = CSS; doc.head.appendChild(st); return true;
}

const api = { HEAD, COLUMNS, sorted, csvRows, csvOf, tableHTML, toolbarHTML, CSS, install };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TrussMembersView = api;
})(typeof window !== 'undefined' ? window : globalThis);
