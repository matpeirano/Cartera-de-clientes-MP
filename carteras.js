'use strict';

const PALETTE = [
  '#3b82f6','#22c55e','#f59e0b','#f43f5e','#a855f7',
  '#14b8a6','#fb923c','#e879f9','#34d399','#fbbf24',
  '#60a5fa','#86efac','#fcd34d','#fca5a5','#c084fc',
];

// Tipo de activo inference from instrumento/ticker name
function inferTipo(instrumento, ticker) {
  const s = (instrumento + ' ' + ticker).toUpperCase();
  if (s.includes('CEDEAR'))            return 'CEDEARs';
  if (s.includes('MONEY MARKET') || s.includes('BCMMA') || s.includes('BCMMUSA')) return 'FCI Liquidez';
  if (s.includes('CLASE A') || s.includes('FCI') || s.includes('BALANZ') || s.includes('LATAM') || s.includes('INFLATION') || s.includes('INSTITUA') || s.includes('PRIVADO') || s.includes('SOJA'))  return 'FCI';
  if (s.includes(' ON ') || s.includes('CL.') || s.includes('V22/') || s.includes('V27/') || s.includes('STEP UP') || ticker.endsWith('O') || ticker.endsWith('D'))  return 'Obligaciones Negociables';
  if (s.includes('BONO') || s.includes('TTD') || s.includes('GD') || s.includes('AL'))  return 'Bonos Soberanos';
  if (s.includes('PESOS') || ticker === '$')  return 'Pesos';
  if (s.includes('DÓLARES') || ticker === 'U$S' || ticker === 'U$SCV7000') return 'Dólares/Efectivo';
  if (s.includes('ESCRIT') || s.includes('ORD') || s.includes('1 VOTO') || s.includes('S.A.')) return 'Acciones Arg.';
  return 'Otros';
}

const STATE = { actual: [], anterior: [] };

const VIEWS = {
  resumen:    { title: 'Resumen',      sub: 'Visión consolidada de carteras' },
  composicion:{ title: 'Composición',  sub: 'Distribución por tipo de activo y comitente' },
  posiciones: { title: 'Posiciones',   sub: 'Detalle completo de todas las posiciones' },
  analisis:   { title: 'Análisis',     sub: 'Diagnóstico automático de cartera' },
  evolucion:  { title: 'Evolución',    sub: 'Comparación vs Excel anterior' },
};

document.addEventListener('DOMContentLoaded', () => {
  id('fileActual').addEventListener('change',   e => handleFile(e, 'actual'));
  id('fileAnterior').addEventListener('change', e => handleFile(e, 'anterior'));
  id('fileEmpty').addEventListener('change',    e => handleFile(e, 'actual'));
  qAll('.nav-item').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  ['filtroComitente','filtroTipo','filtroTicker'].forEach(fid => {
    id(fid).addEventListener('input',  renderAll);
    id(fid).addEventListener('change', renderAll);
  });
});

async function handleFile(e, mode) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';
  try {
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf, { type: 'array' });
    const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (!json.length) { toast('El archivo no tiene datos.', 'err'); return; }
    const rows = json.map(parseRow).filter(r => r.tenencia > 0 || r.nominales > 0);

    if (mode === 'actual') {
      STATE.actual = rows;
      id('dotActual').classList.add('on');
      id('labelActual').textContent = file.name;
      populateFilters(rows);
      toast(`✓ ${rows.length} posiciones cargadas`, 'ok');
    } else {
      STATE.anterior = rows;
      id('dotAnterior').classList.add('secondary');
      id('labelAnterior').textContent = file.name;
      toast(`Excel anterior: ${rows.length} posiciones`, 'ok');
    }
    renderAll();
  } catch(err) {
    toast(err.message || 'Error al procesar archivo.', 'err');
    console.error(err);
  }
}

function parseRow(r) {
  const instrumento = str(r['instrumento'] || r['Instrumento'] || '');
  const ticker      = str(r['ticker']      || r['Ticker']      || '');
  const tenencia    = num(r['tenencia']    || r['Tenencia']    || 0);
  const pcompra     = num(r['preciocompra']|| r['PrecioCompra']|| r['precio_compra'] || 0);
  const nominales   = num(r['nominales']   || r['Nominales']   || 0);
  const dias        = num(r['diastenencia']|| r['DiasTenencia']|| 0);
  const comitente   = str(r['comitente']   || r['Comitente']   || '');
  const cuenta      = str(r['cuenta']      || r['Cuenta']      || '');
  const equipo      = str(r['equipo']      || r['Equipo']      || '');
  const asesor      = str(r['asesor']      || r['Asesor']      || '');
  const tipo        = inferTipo(instrumento, ticker);

  // Costo estimado: nominales × preciocompra (si preciocompra parece un precio por unidad)
  // Si preciocompra > 0 y nominales > 0, costo = nominales * preciocompra
  // De lo contrario usamos tenencia como proxy
  const costoEst = (pcompra > 0 && nominales > 0) ? nominales * pcompra : 0;
  const resultado = costoEst > 0 ? tenencia - costoEst : null;
  const rendPct   = (costoEst > 0 && resultado !== null) ? (resultado / costoEst) * 100 : null;

  return { comitente, cuenta, instrumento, ticker, tipo, tenencia, pcompra, nominales, dias, equipo, asesor, costoEst, resultado, rendPct };
}

function getFiltered() {
  const comi  = id('filtroComitente').value;
  const tipo  = id('filtroTipo').value;
  const q     = id('filtroTicker').value.trim().toUpperCase();
  return STATE.actual.filter(r =>
    (comi === 'TODOS' || r.comitente === comi) &&
    (tipo === 'TODOS' || r.tipo === tipo) &&
    (!q   || r.ticker.toUpperCase().includes(q) || r.instrumento.toUpperCase().includes(q))
  );
}

function populateFilters(rows) {
  const comitentes = [...new Set(rows.map(r => r.comitente).filter(Boolean))].sort();
  const tipos      = [...new Set(rows.map(r => r.tipo).filter(Boolean))].sort();

  const selC = id('filtroComitente');
  const prevC = selC.value;
  selC.innerHTML = '<option value="TODOS">Todos los comitentes</option>' +
    comitentes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (comitentes.includes(prevC)) selC.value = prevC;

  const selT = id('filtroTipo');
  const prevT = selT.value;
  selT.innerHTML = '<option value="TODOS">Todos los tipos</option>' +
    tipos.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  if (tipos.includes(prevT)) selT.value = prevT;
}

function renderAll() {
  if (!STATE.actual.length) return;
  id('emptyState').classList.add('hidden');
  id('appContent').classList.remove('hidden');

  const rows = getFiltered();
  renderResumen(rows);
  renderComposicion(rows);
  renderPosiciones(rows);
  renderAnalisis(rows);
  renderEvolucion(rows);
}

/* ── RESUMEN ── */
function renderResumen(rows) {
  const totalTenencia = sum(rows, 'tenencia');
  const comitentes    = new Set(rows.map(r => r.comitente)).size;
  const tickers       = new Set(rows.map(r => r.ticker)).size;
  const diasProm      = rows.length ? (sum(rows, 'dias') / rows.length) : 0;

  const conCosto  = rows.filter(r => r.costoEst > 0);
  const totalCosto= sum(conCosto, 'costoEst');
  const totalRes  = sum(conCosto, 'resultado');
  const resPct    = totalCosto > 0 ? totalRes / totalCosto * 100 : null;

  setText('kpiTenencia',    fmtUSD(totalTenencia));
  setText('kpiComitentes',  `${comitentes} comitente${comitentes!==1?'s':''}`);
  setText('kpiPosiciones',  fmt(rows.length));
  setText('kpiTickers',     `${tickers} tickers distintos`);
  setText('kpiDias',        Math.round(diasProm).toString());

  const resEl = id('kpiResultado');
  resEl.textContent = totalRes >= 0 ? '+' + fmtUSD(totalRes) : fmtUSD(totalRes);
  resEl.className   = 'kpi-val mono ' + (totalRes >= 0 ? 'pos' : 'neg');
  setText('kpiResultadoPct', resPct !== null ? `${resPct >= 0 ? '+' : ''}${resPct.toFixed(1)}% vs precio compra` : 'sin datos de compra');

  // Top posiciones
  const topPos = [...rows].sort((a,b) => b.tenencia - a.tenencia).slice(0, 8);
  const maxPos = topPos[0]?.tenencia || 1;
  id('topPosiciones').innerHTML = topPos.map((r, i) => `
    <div class="bar-row">
      <span class="bar-label" title="${esc(r.instrumento)}">${esc(r.ticker)}</span>
      <div class="bar-track-wrap"><div class="bar-track-fill" style="width:${(r.tenencia/maxPos*100).toFixed(1)}%;background:${PALETTE[i%PALETTE.length]}"></div></div>
      <span class="bar-val">${fmtUSD(r.tenencia)}</span>
    </div>`).join('');

  // Top comitentes
  const byComi = {};
  rows.forEach(r => { byComi[r.comitente] = (byComi[r.comitente]||0) + r.tenencia; });
  const topComi = Object.entries(byComi).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxComi = topComi[0]?.[1] || 1;
  id('topComitentes').innerHTML = topComi.map(([k,v], i) => `
    <div class="bar-row">
      <span class="bar-label" title="${esc(k)}">${esc(k.split(' ')[0])}</span>
      <div class="bar-track-wrap"><div class="bar-track-fill" style="width:${(v/maxComi*100).toFixed(1)}%;background:${PALETTE[i%PALETTE.length]}"></div></div>
      <span class="bar-val">${fmtUSD(v)}</span>
    </div>`).join('');
}

/* ── COMPOSICIÓN ── */
function renderComposicion(rows) {
  const total = sum(rows, 'tenencia') || 1;

  // By tipo
  const byTipo = {};
  rows.forEach(r => { byTipo[r.tipo] = (byTipo[r.tipo]||0) + r.tenencia; });
  const tipoEntries = Object.entries(byTipo).sort((a,b)=>b[1]-a[1]);
  renderDonut('donutTipo', 'legendTipo', tipoEntries, total);

  // By comitente
  const byComi = {};
  rows.forEach(r => { byComi[r.comitente] = (byComi[r.comitente]||0) + r.tenencia; });
  const comiEntries = Object.entries(byComi).sort((a,b)=>b[1]-a[1]);
  renderDonut('donutComitente', 'legendComitente', comiEntries, total);

  // Bar by tipo
  const maxTipo = tipoEntries[0]?.[1] || 1;
  id('barTipos').innerHTML = tipoEntries.map(([k,v], i) => `
    <div class="bar-row" style="margin-bottom:8px;">
      <span class="bar-label" style="width:140px">${esc(k)}</span>
      <div class="bar-track-wrap"><div class="bar-track-fill" style="width:${(v/maxTipo*100).toFixed(1)}%;background:${PALETTE[i%PALETTE.length]}"></div></div>
      <span class="bar-val" style="width:100px">${fmtUSD(v)}</span>
      <span style="width:46px;text-align:right;font-size:11px;font-family:'DM Mono',monospace;color:var(--text3);flex-shrink:0">${(v/total*100).toFixed(1)}%</span>
    </div>`).join('');
}

function renderDonut(svgId, legendId, entries, total) {
  const svg = id(svgId);
  const cx = 100, cy = 100, r = 72, inner = 46;
  let angle = -Math.PI / 2;
  const paths = entries.map(([ label, val ], i) => {
    const pct   = val / total;
    const sweep = pct * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const xi1 = cx + inner * Math.cos(angle - sweep);
    const yi1 = cy + inner * Math.sin(angle - sweep);
    const xi2 = cx + inner * Math.cos(angle);
    const yi2 = cy + inner * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const col = PALETTE[i % PALETTE.length];
    return `<path d="M${xi1.toFixed(2)},${yi1.toFixed(2)} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${xi2.toFixed(2)},${yi2.toFixed(2)} A${inner},${inner} 0 ${large} 0 ${xi1.toFixed(2)},${yi1.toFixed(2)} Z" fill="${col}" opacity="0.9"><title>${esc(label)}: ${fmtUSD(val)} (${(pct*100).toFixed(1)}%)</title></path>`;
  });
  svg.innerHTML = paths.join('') +
    `<circle cx="${cx}" cy="${cy}" r="${inner}" fill="var(--s1)"/>` +
    `<text x="${cx}" y="${cy-6}" text-anchor="middle" fill="var(--text3)" font-size="9" font-family="DM Sans">TENENCIA</text>` +
    `<text x="${cx}" y="${cy+10}" text-anchor="middle" fill="var(--text)" font-size="13" font-weight="600" font-family="DM Mono">${fmtUSD(total)}</text>`;

  id(legendId).innerHTML = entries.slice(0, 8).map(([k, v], i) => `
    <div class="legend-row">
      <div class="legend-dot" style="background:${PALETTE[i%PALETTE.length]}"></div>
      <span class="legend-label">${esc(k)}</span>
      <span class="legend-pct">${(v/total*100).toFixed(1)}%</span>
      <span class="legend-val" style="margin-left:6px">${fmtUSD(v)}</span>
    </div>`).join('');
}

/* ── POSICIONES ── */
function renderPosiciones(rows) {
  const total = sum(rows, 'tenencia') || 1;
  const sorted = [...rows].sort((a,b) => b.tenencia - a.tenencia);
  setText('posicionesCount', `${sorted.length} posiciones`);

  const tipColors = {};
  [...new Set(rows.map(r=>r.tipo))].sort().forEach((t,i) => { tipColors[t] = PALETTE[i%PALETTE.length]; });

  renderTable('tablaPosiciones', sorted, r => {
    const col = tipColors[r.tipo] || PALETTE[0];
    const rendCls = r.rendPct === null ? '' : r.rendPct >= 0 ? 'pos' : 'neg';
    const resCls  = r.resultado === null ? '' : r.resultado >= 0 ? 'pos' : 'neg';
    return `<tr>
      <td title="${esc(r.comitente)}">${esc(r.comitente.split(' ')[0])}</td>
      <td><strong>${esc(r.ticker)}</strong></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${esc(r.instrumento)}">${esc(r.instrumento)}</td>
      <td><span class="tipo-badge" style="background:${col}22;color:${col}">${esc(r.tipo)}</span></td>
      <td class="tr">${fmtNum(r.nominales)}</td>
      <td class="tr">${r.pcompra > 0 ? fmtNum4(r.pcompra) : '—'}</td>
      <td class="tr"><strong>${fmtUSD(r.tenencia)}</strong></td>
      <td class="tr ${resCls}">${r.resultado !== null ? (r.resultado>=0?'+':'')+fmtUSD(r.resultado) : '—'}</td>
      <td class="tr ${rendCls}">${r.rendPct !== null ? (r.rendPct>=0?'+':'')+r.rendPct.toFixed(1)+'%' : '—'}</td>
      <td class="tr">${r.dias > 0 ? fmt(r.dias)+'d' : '—'}</td>
      <td class="tr">${(r.tenencia/total*100).toFixed(1)}%</td>
    </tr>`;
  });
}

/* ── ANÁLISIS ── */
function renderAnalisis(rows) {
  const total     = sum(rows, 'tenencia') || 1;
  const sorted    = [...rows].sort((a,b) => b.tenencia - a.tenencia);
  const top5      = sorted.slice(0, 5);
  const top5pct   = sum(top5, 'tenencia') / total * 100;
  const conCosto  = rows.filter(r => r.costoEst > 0);
  const enRojo    = conCosto.filter(r => r.resultado !== null && r.resultado < 0);
  const enVerde   = conCosto.filter(r => r.resultado !== null && r.resultado > 0);

  const byTipo    = {};
  rows.forEach(r => { byTipo[r.tipo] = (byTipo[r.tipo]||0) + r.tenencia; });
  const tipoCount = Object.keys(byTipo).length;
  const liqPct    = ((byTipo['FCI Liquidez']||0) + (byTipo['Pesos']||0) + (byTipo['Dólares/Efectivo']||0)) / total * 100;
  const comiCount = new Set(rows.map(r=>r.comitente)).size;

  // Diagnóstico
  const diags = [];

  if (top5pct > 60)
    diags.push({ level:'alert', icon:'⚠️', title:`Alta concentración: top 5 posiciones representan el ${top5pct.toFixed(0)}%`, desc:`Las primeras 5 posiciones concentran más del 60% de la cartera. ${top5.map(r=>r.ticker).join(', ')}. Considerar diversificar.` });
  else if (top5pct > 40)
    diags.push({ level:'warn', icon:'📊', title:`Concentración moderada: top 5 = ${top5pct.toFixed(0)}%`, desc:`Concentración dentro de rangos aceptables pero con margen de mejora.` });
  else
    diags.push({ level:'ok', icon:'✓', title:`Buena diversificación: top 5 = ${top5pct.toFixed(0)}%`, desc:`Las posiciones están bien distribuidas entre múltiples activos.` });

  if (tipoCount >= 5)
    diags.push({ level:'ok', icon:'✓', title:`Diversificación por tipo: ${tipoCount} categorías distintas`, desc:`La cartera incluye ${Object.keys(byTipo).join(', ')}.` });
  else if (tipoCount >= 3)
    diags.push({ level:'info', icon:'ℹ️', title:`${tipoCount} tipos de activos`, desc:`Hay margen para ampliar la diversificación por clase de activo.` });
  else
    diags.push({ level:'warn', icon:'⚠️', title:`Poca diversificación: solo ${tipoCount} tipo${tipoCount!==1?'s':''} de activo`, desc:`La cartera está muy concentrada en pocas categorías.` });

  if (liqPct > 30)
    diags.push({ level:'warn', icon:'💧', title:`Alta liquidez: ${liqPct.toFixed(0)}% en efectivo/FCI liquidez`, desc:`${liqPct.toFixed(0)}% de la cartera está en posiciones de liquidez. Podría ser una oportunidad de inversión.` });
  else if (liqPct < 5)
    diags.push({ level:'info', icon:'💧', title:`Baja liquidez: ${liqPct.toFixed(1)}%`, desc:`Menos del 5% en posiciones líquidas. Revisar si el cliente tiene necesidades de liquidez próximas.` });

  if (enRojo.length > 0) {
    const totalPerdida = Math.abs(sum(enRojo, 'resultado'));
    diags.push({ level:'alert', icon:'📉', title:`${enRojo.length} posición${enRojo.length!==1?'es':''} con resultado negativo`, desc:`Pérdida estimada acumulada: USD ${fmtUSD(totalPerdida)}. Tickers: ${enRojo.map(r=>r.ticker).join(', ')}.` });
  }
  if (enVerde.length > 0) {
    const totalGan = sum(enVerde, 'resultado');
    diags.push({ level:'ok', icon:'📈', title:`${enVerde.length} posición${enVerde.length!==1?'es':''} con ganancia`, desc:`Ganancia estimada acumulada: USD ${fmtUSD(totalGan)}.` });
  }

  if (comiCount > 1)
    diags.push({ level:'info', icon:'👥', title:`${comiCount} comitentes en la cartera`, desc:`Podés filtrar por comitente en la barra superior para ver cada cartera individualmente.` });

  id('diagnosticoList').innerHTML = diags.map(d => `
    <div class="diag-card ${d.level}">
      <div class="diag-icon">${d.icon}</div>
      <div class="diag-body">
        <div class="diag-title">${d.title}</div>
        <div class="diag-desc">${d.desc}</div>
      </div>
    </div>`).join('');

  // Concentración chart
  const top5val  = sum(top5, 'tenencia');
  const restoval = total - top5val;
  const concData = [...top5.map(r => [r.ticker, r.tenencia]), ['Resto', restoval]];
  const maxConc  = concData[0]?.[1] || 1;
  id('concentracionChart').innerHTML = concData.map(([k,v], i) => `
    <div class="bar-row" style="margin-bottom:8px">
      <span class="bar-label">${esc(k)}</span>
      <div class="bar-track-wrap"><div class="bar-track-fill" style="width:${(v/maxConc*100).toFixed(1)}%;background:${i===concData.length-1?'var(--text3)':PALETTE[i]}"></div></div>
      <span class="bar-val">${(v/total*100).toFixed(1)}%</span>
    </div>`).join('');

  // Rendimiento chart — solo posiciones con costo
  const rendRows = conCosto.filter(r=>r.rendPct!==null).sort((a,b)=>b.rendPct-a.rendPct);
  if (rendRows.length) {
    const maxAbs = Math.max(...rendRows.map(r=>Math.abs(r.rendPct)), 1);
    id('rendimientoChart').innerHTML = `<div style="display:flex;flex-direction:column;gap:6px">` +
      rendRows.map(r => {
        const pct = r.rendPct;
        const pos = pct >= 0;
        const barW = (Math.abs(pct)/maxAbs*100).toFixed(1);
        return `<div style="display:flex;align-items:center;gap:8px">
          <span style="width:60px;font-size:11px;color:var(--text2);text-align:right;flex-shrink:0">${esc(r.ticker)}</span>
          <div style="flex:1;height:7px;background:var(--s3);border-radius:99px;overflow:hidden;position:relative;">
            <div style="position:absolute;${pos?'left:0':'right:0'};width:${barW}%;height:100%;background:${pos?'var(--green)':'var(--red)'};border-radius:99px"></div>
          </div>
          <span style="width:52px;font-size:11px;font-family:'DM Mono',monospace;color:${pos?'var(--green)':'var(--red)'};text-align:right;flex-shrink:0">${pct>=0?'+':''}${pct.toFixed(1)}%</span>
        </div>`;
      }).join('') + '</div>';
  } else {
    id('rendimientoChart').innerHTML = `<p style="color:var(--text3);font-size:12px;text-align:center;padding:20px">Sin datos de precio de compra para calcular rendimiento</p>`;
  }

  // Tabla en rojo
  renderTable('tablaEnRojo', enRojo.sort((a,b)=>a.resultado-b.resultado), r => `<tr>
    <td>${esc(r.comitente.split(' ')[0])}</td>
    <td><strong>${esc(r.ticker)}</strong></td>
    <td>${esc(r.instrumento)}</td>
    <td class="tr">${fmtNum4(r.pcompra)}</td>
    <td class="tr">${fmtUSD(r.tenencia)}</td>
    <td class="tr neg">${fmtUSD(r.resultado)}</td>
    <td class="tr neg">${r.rendPct.toFixed(1)}%</td>
    <td class="tr">${r.dias}d</td>
  </tr>`);
}

/* ── EVOLUCIÓN ── */
function renderEvolucion(rowsActual) {
  const emptyEl   = id('evolucionEmpty');
  const contentEl = id('evolucionContent');

  if (!STATE.anterior.length) {
    emptyEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  const totalAct = sum(rowsActual, 'tenencia');
  const rowsAnt  = STATE.anterior;
  const totalAnt = sum(rowsAnt, 'tenencia');
  const delta    = totalAct - totalAnt;

  setText('evoDeltaTenencia', (delta>=0?'+':'')+fmtUSD(delta));
  id('evoDeltaTenencia').className = 'mono ' + (delta>=0 ? 'pos' : 'neg');

  // Key: comitente + ticker
  const key  = r => `${r.comitente}|${r.ticker}`;
  const mapAnt = new Map(rowsAnt.map(r => [key(r), r]));
  const mapAct = new Map(rowsActual.map(r => [key(r), r]));

  const nuevas   = rowsActual.filter(r => !mapAnt.has(key(r)));
  const cerradas = rowsAnt.filter(r => !mapAct.has(key(r)));
  const comunes  = rowsActual.filter(r => mapAnt.has(key(r)));

  setText('evoPosNuevas', fmt(nuevas.length));
  setText('evoPosC',      fmt(cerradas.length));
  setText('evoComi',      fmt(new Set(rowsActual.map(r=>r.comitente)).size));

  const crecieron = comunes.map(r => ({ ...r, tenAnt: mapAnt.get(key(r)).tenencia, diff: r.tenencia - mapAnt.get(key(r)).tenencia })).filter(r=>r.diff>0).sort((a,b)=>b.diff-a.diff);
  const cayeron   = comunes.map(r => ({ ...r, tenAnt: mapAnt.get(key(r)).tenencia, diff: r.tenencia - mapAnt.get(key(r)).tenencia })).filter(r=>r.diff<0).sort((a,b)=>a.diff-b.diff);

  const evoRow = r => {
    const pct = r.tenAnt ? r.diff/r.tenAnt*100 : null;
    const cls = r.diff >= 0 ? 'pos' : 'neg';
    return `<tr>
      <td>${esc(r.comitente.split(' ')[0])}</td>
      <td><strong>${esc(r.ticker)}</strong></td>
      <td>${esc(r.instrumento)}</td>
      <td class="tr">${fmtUSD(r.tenAnt)}</td>
      <td class="tr">${fmtUSD(r.tenencia)}</td>
      <td class="tr ${cls}">${r.diff>=0?'+':''}${fmtUSD(r.diff)}</td>
      <td class="tr ${cls}">${pct!==null?(pct>=0?'+':'')+pct.toFixed(1)+'%':'—'}</td>
    </tr>`;
  };

  renderTable('tablaCrecieron', crecieron, evoRow);
  renderTable('tablaCayeron',   cayeron,   evoRow);
}

/* ── NAV ── */
function switchView(view) {
  qAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  qAll('.view-section').forEach(s => s.classList.add('hidden'));
  const sec = id('view' + view.charAt(0).toUpperCase() + view.slice(1));
  if (sec) sec.classList.remove('hidden');
  const meta = VIEWS[view] || {};
  setText('viewTitle', meta.title || view);
  setText('viewSub',   meta.sub   || '');
}

/* ── UTILS ── */
function renderTable(tableId, rows, renderer) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (tbody) tbody.innerHTML = rows.map(renderer).join('');
}
function sum(rows, key) { return rows.reduce((a,r) => a+(Number(r[key])||0), 0); }
function setText(eid, v) { const e=id(eid); if(e) e.textContent=v; }
function id(eid)   { return document.getElementById(eid); }
function qAll(sel) { return document.querySelectorAll(sel); }
function str(v)    { return (v??'').toString().trim(); }
function num(v)    { if(v===null||v===undefined||v==='') return 0; if(typeof v==='number') return Number.isFinite(v)?v:0; const n=Number(String(v).trim().replace(/\./g,'').replace(',','.')); return Number.isFinite(n)?n:0; }
function fmtUSD(n) { return new Intl.NumberFormat('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.round(Number(n)||0)); }
function fmtNum(n) { return new Intl.NumberFormat('es-AR',{minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(n)||0); }
function fmtNum4(n){ return new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:4}).format(Number(n)||0); }
function fmt(n)    { return new Intl.NumberFormat('es-AR').format(Number(n)||0); }
function esc(v)    { return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

let _tt;
function toast(msg, type='') {
  const el=id('toast'); el.textContent=msg; el.className=`toast ${type}`;
  clearTimeout(_tt); _tt=setTimeout(()=>{el.className='toast hidden';},3200);
}
