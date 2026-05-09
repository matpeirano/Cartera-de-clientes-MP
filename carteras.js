'use strict';

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
const STORAGE_KEY = 'ifa_carteras_historico_v1';

const PALETTE = [
  '#3b82f6','#22c55e','#f59e0b','#f43f5e','#a855f7',
  '#14b8a6','#fb923c','#e879f9','#34d399','#fbbf24',
  '#60a5fa','#86efac','#fcd34d','#fca5a5','#c084fc',
];

const TYPE_COLORS = {
  'CEDEARs':                 '#3b82f6',
  'Acciones Ext.':           '#60a5fa',
  'Acciones Arg.':           '#22c55e',
  'FCI':                     '#a855f7',
  'FCI Liquidez':            '#14b8a6',
  'Obligaciones Negociables':'#f59e0b',
  'Bonos Soberanos':         '#f43f5e',
  'Bonos CER':               '#fb923c',
  'Bonos CAP':               '#e879f9',
  'Bonos Nacion $':          '#fbbf24',
  'LECAPs':                  '#34d399',
  'Pesos':                   '#78716c',
  'Dolares/Efectivo':        '#84cc16',
  'Otros':                   '#64748b',
};

/* ══════════════════════════════════════════
   TIPO INFERENCE
══════════════════════════════════════════ */
function inferTipo(instrumento, ticker) {
  const inst = instrumento.toUpperCase();
  const tic  = ticker.toUpperCase();

  // Efectivo — SOLO estos dos
  if (tic === 'U$S' || tic === 'U$SCV7000')                          return 'Dolares/Efectivo';
  if (tic === '$'   || inst.includes('PESOS'))                        return 'Pesos';

  // CEDEARs
  if (inst.includes('CEDEAR'))                                        return 'CEDEARs';

  // Acciones del exterior — ticker termina en .E
  if (tic.endsWith('.E'))                                             return 'Acciones Ext.';

  // LECAPS — letras del tesoro
  if (inst.includes('LECAP') || inst.includes('LETRA') || tic.startsWith('S') && tic.length === 6 && /S\d{2}[A-Z]\d{2}/.test(tic)) return 'LECAPs';

  // Bonos CER — ajustados por inflacion
  if (inst.includes(' CER') || inst.includes('CER ') || inst.includes('(CER)') ||
      tic.startsWith('TX')  || tic.startsWith('TC')  || tic.startsWith('CER'))  return 'Bonos CER';

  // Bonos CAP / Capitalizables — tesoro en pesos
  if (inst.includes(' CAP') || inst.includes('CAP ') || inst.includes('CAPITALIZ') ||
      tic.startsWith('T2X') || tic.startsWith('T3X') || tic.startsWith('TZX'))  return 'Bonos CAP';

  // Bonos soberanos en USD (GD, AL, AE)
  if (inst.includes('REP. ARG') || inst.includes('BONOS REP') ||
      tic.startsWith('GD')  || tic.startsWith('AL')  || tic.startsWith('AE'))   return 'Bonos Soberanos';

  // Bonos nacionales pesos (TTD, etc.) — si no cayeron en CER/CAP ya
  if (inst.includes('BONO NACION') || inst.includes('BONO NACI') ||
      tic.startsWith('TTD'))                                          return 'Bonos Nacion $';

  // Obligaciones Negociables:
  // 1) dice ON en instrumento
  // 2) tiene vencimiento tipo V22/08/26
  // 3) tiene tasa (%) en el nombre y NO dice bono/nacional/nacion
  const tieneON  = inst.includes(' ON ') || inst.includes('OBLIGACION');
  const tieneVto = /V\d{2}\/\d{2}\/\d{2}/.test(inst);
  const tieneTasa= /\d+(\.\d+)?\s*%/.test(inst);
  const esBono   = inst.includes('BONO') || inst.includes('NACIONAL') || inst.includes('NACION') || inst.includes('SOBERAN');
  if (tieneON || tieneVto || (tieneTasa && !esBono))                 return 'Obligaciones Negociables';
  if (inst.includes('STEP UP') || inst.includes('CL.'))              return 'Obligaciones Negociables';

  // FCI Liquidez (Money Market)
  if (inst.includes('MONEY MARKET') || tic.includes('BCMM'))         return 'FCI Liquidez';

  // FCI — todo lo demas que sea fondo
  if (inst.includes('CLASE A') || inst.includes('CLASE B') ||
      inst.includes('BALANZ')  || inst.includes('LATAM')   ||
      inst.includes('INFLATION') || inst.includes('INSTITUA') ||
      inst.includes('PRIVADO') || inst.includes('SOJA')    ||
      inst.includes('FCI')     || inst.includes('FONDO'))            return 'FCI';

  // Tickers de FCI conocidos que no cayeron arriba
  const fciFijos = ['BCMMA','BCRFA','ESTRA1A','ESTRA2A','ESTRA3A','INSTITUA','CPRIVADOA','SOJAA'];
  if (fciFijos.some(f => tic.startsWith(f) || tic === f))            return 'FCI';

  // Acciones argentinas
  if (inst.includes('ESCRIT') || inst.includes('ESCRITURALES') ||
      inst.includes('1 VOTO') || inst.includes('ORD.') ||
      inst.includes('ORDINARIAS'))                                    return 'Acciones Arg.';

  return 'Otros';
}

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
const STATE = {
  actual:       [],
  historico:    [],
  _lastFilename:'',
};

const VIEWS = {
  resumen:    { title:'Resumen',     sub:'Vision consolidada de carteras' },
  composicion:{ title:'Composicion', sub:'Distribucion por tipo de activo y comitente' },
  posiciones: { title:'Posiciones',  sub:'Detalle completo de todas las posiciones' },
  analisis:   { title:'Analisis',    sub:'Diagnostico automatico de cartera' },
  historico:  { title:'Historico',   sub:'Evolucion de carteras guardada periodo a periodo' },
};

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadHistoricoFromStorage();

  id('fileActual').addEventListener('change', handleFile);
  id('fileEmpty').addEventListener('change',  handleFile);
  id('btnGuardarPeriodo').addEventListener('click', showSavePeriodoModal);
  id('btnConfirmarGuardar').addEventListener('click', confirmarGuardarPeriodo);
  id('btnCancelarGuardar').addEventListener('click', closeSavePeriodoModal);
  id('btnLimpiarHistorico').addEventListener('click', limpiarHistorico);

  qAll('.nav-item').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));

  ['filtroComitente','filtroTipo','filtroTicker'].forEach(fid => {
    id(fid).addEventListener('input',  renderAll);
    id(fid).addEventListener('change', renderAll);
  });

  renderHistoricoView();
});

/* ══════════════════════════════════════════
   FILE HANDLING
══════════════════════════════════════════ */
async function handleFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';
  try {
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf, { type:'array' });
    const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'' });
    if (!json.length) { toast('El archivo no tiene datos.','err'); return; }

    const rows = json.map(parseRow).filter(r => r.tenencia > 0 || r.nominales > 0);
    STATE.actual       = rows;
    STATE._lastFilename = file.name;

    id('dotActual').classList.add('on');
    id('labelActual').textContent = file.name;
    id('btnGuardarPeriodo').classList.remove('hidden');

    populateFilters(rows);
    toast('Cargadas ' + rows.length + ' posiciones','ok');
    renderAll();
  } catch(err) {
    toast(err.message || 'Error al procesar archivo.','err');
  }
}

function parseRow(r) {
  const instrumento = str(r['instrumento'] || r['Instrumento'] || '');
  const ticker      = str(r['ticker']      || r['Ticker']      || '');
  const tenencia    = num(r['tenencia']    || r['Tenencia']    || 0);
  const pcompra     = num(r['preciocompra']|| r['PrecioCompra']|| 0);
  const nominales   = num(r['nominales']   || r['Nominales']   || 0);
  const dias        = num(r['diastenencia']|| r['DiasTenencia']|| 0);
  const comitente   = str(r['comitente']   || r['Comitente']   || '');
  const cuenta      = str(r['cuenta']      || r['Cuenta']      || '');
  const tipo        = inferTipo(instrumento, ticker);
  const costoEst    = (pcompra > 0 && nominales > 0) ? nominales * pcompra : 0;
  const resultado   = costoEst > 0 ? tenencia - costoEst : null;
  const rendPct     = (costoEst > 0 && resultado !== null) ? (resultado / costoEst) * 100 : null;
  return { comitente, cuenta, instrumento, ticker, tipo, tenencia, pcompra, nominales, dias, costoEst, resultado, rendPct };
}

/* ══════════════════════════════════════════
   GUARDAR PERIODO
══════════════════════════════════════════ */
function showSavePeriodoModal() {
  if (!STATE.actual.length) return;
  const hoy   = new Date();
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  id('inputPeriodoLabel').value = meses[hoy.getMonth()] + ' ' + hoy.getFullYear();
  id('inputPeriodoFecha').value = hoy.toISOString().slice(0,10);
  id('modalGuardar').classList.remove('hidden');
}

function closeSavePeriodoModal() { id('modalGuardar').classList.add('hidden'); }

function confirmarGuardarPeriodo() {
  const label = id('inputPeriodoLabel').value.trim() || 'Sin nombre';
  const fecha = id('inputPeriodoFecha').value || new Date().toISOString().slice(0,10);
  STATE.historico.push({ id: Date.now(), label, fecha, filename: STATE._lastFilename, rows: STATE.actual });
  // Sort by fecha ascending
  STATE.historico.sort((a,b) => a.fecha.localeCompare(b.fecha));
  saveHistoricoToStorage();
  closeSavePeriodoModal();
  toast('Periodo "' + label + '" guardado','ok');
  renderHistoricoView();
}

function limpiarHistorico() {
  if (!confirm('Limpiar todo el historico guardado? Esta accion no se puede deshacer.')) return;
  STATE.historico = [];
  saveHistoricoToStorage();
  renderHistoricoView();
  toast('Historico limpiado','ok');
}

function eliminarPeriodo(pid) {
  STATE.historico = STATE.historico.filter(p => p.id !== pid);
  saveHistoricoToStorage();
  renderHistoricoView();
  toast('Periodo eliminado','ok');
}

/* ══════════════════════════════════════════
   STORAGE
══════════════════════════════════════════ */
function saveHistoricoToStorage() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE.historico)); }
  catch(e) { toast('No se pudo guardar (localStorage lleno)','err'); }
}

function loadHistoricoFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) STATE.historico = JSON.parse(raw);
  } catch(e) { STATE.historico = []; }
  updateBadge();
}

function updateBadge() {
  const b = id('badgeHistorico');
  if (!b) return;
  b.textContent = STATE.historico.length;
  b.classList.toggle('hidden', STATE.historico.length === 0);
}

/* ══════════════════════════════════════════
   FILTERS
══════════════════════════════════════════ */
function populateFilters(rows) {
  const comis = [...new Set(rows.map(r=>r.comitente).filter(Boolean))].sort();
  const tipos = [...new Set(rows.map(r=>r.tipo).filter(Boolean))].sort();
  const selC  = id('filtroComitente'), prevC = selC.value;
  selC.innerHTML = '<option value="TODOS">Todos los comitentes</option>' + comis.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (comis.includes(prevC)) selC.value = prevC;
  const selT = id('filtroTipo'), prevT = selT.value;
  selT.innerHTML = '<option value="TODOS">Todos los tipos</option>' + tipos.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  if (tipos.includes(prevT)) selT.value = prevT;
}

function getFiltered() {
  const comi = id('filtroComitente').value;
  const tipo = id('filtroTipo').value;
  const q    = id('filtroTicker').value.trim().toUpperCase();
  return STATE.actual.filter(r =>
    (comi==='TODOS' || r.comitente===comi) &&
    (tipo==='TODOS' || r.tipo===tipo) &&
    (!q || r.ticker.toUpperCase().includes(q) || r.instrumento.toUpperCase().includes(q))
  );
}

/* ══════════════════════════════════════════
   RENDER CONTROLLER
══════════════════════════════════════════ */
function renderAll() {
  if (!STATE.actual.length) return;
  id('emptyState').classList.add('hidden');
  id('appContent').classList.remove('hidden');
  const rows = getFiltered();
  renderResumen(rows);
  renderComposicion(rows);
  renderPosiciones(rows);
  renderAnalisis(rows);
}

/* ══════════════════════════════════════════
   RESUMEN
══════════════════════════════════════════ */
function renderResumen(rows) {
  const totalTen  = sum(rows,'tenencia');
  const comiCount = new Set(rows.map(r=>r.comitente)).size;
  const ticCount  = new Set(rows.map(r=>r.ticker)).size;
  const diasProm  = rows.length ? sum(rows,'dias')/rows.length : 0;
  const conCosto  = rows.filter(r=>r.costoEst>0);
  const totalRes  = sum(conCosto,'resultado');
  const totCosto  = sum(conCosto,'costoEst');
  const resPct    = totCosto>0 ? totalRes/totCosto*100 : null;

  setText('kpiTenencia',   fmtUSD(totalTen));
  setText('kpiComitentes', comiCount + ' comitente' + (comiCount!==1?'s':''));
  setText('kpiPosiciones', fmt(rows.length));
  setText('kpiTickers',    ticCount + ' tickers distintos');
  setText('kpiDias',       Math.round(diasProm).toString());
  const resEl = id('kpiResultado');
  if (resEl) { resEl.textContent = conCosto.length ? (totalRes>=0?'+':'')+fmtUSD(totalRes) : '-'; resEl.className='kpi-val mono '+(totalRes>=0?'pos':'neg'); }
  setText('kpiResultadoPct', resPct!==null ? (resPct>=0?'+':'')+resPct.toFixed(1)+'% vs costo estimado' : 'sin datos de compra');

  const topPos  = [...rows].sort((a,b)=>b.tenencia-a.tenencia).slice(0,8);
  const maxPos  = topPos[0]?.tenencia||1;
  id('topPosiciones').innerHTML = topPos.map((r,i)=>`
    <div class="bar-row">
      <span class="bar-label" title="${esc(r.instrumento)}">${esc(r.ticker)}</span>
      <div class="bar-track-wrap"><div class="bar-track-fill" style="width:${(r.tenencia/maxPos*100).toFixed(1)}%;background:${TYPE_COLORS[r.tipo]||PALETTE[i]}"></div></div>
      <span class="bar-val">${fmtUSD(r.tenencia)}</span>
    </div>`).join('');

  const byComi = {};
  rows.forEach(r=>{ byComi[r.comitente]=(byComi[r.comitente]||0)+r.tenencia; });
  const topComi = Object.entries(byComi).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxComi = topComi[0]?.[1]||1;
  id('topComitentes').innerHTML = topComi.map(([k,v],i)=>`
    <div class="bar-row">
      <span class="bar-label" title="${esc(k)}">${esc(k.split(' ')[0])}</span>
      <div class="bar-track-wrap"><div class="bar-track-fill" style="width:${(v/maxComi*100).toFixed(1)}%;background:${PALETTE[i%PALETTE.length]}"></div></div>
      <span class="bar-val">${fmtUSD(v)}</span>
    </div>`).join('');
}

/* ══════════════════════════════════════════
   COMPOSICION
══════════════════════════════════════════ */
function renderComposicion(rows) {
  const total = sum(rows,'tenencia')||1;
  const byTipo={}, byComi={};
  rows.forEach(r=>{ byTipo[r.tipo]=(byTipo[r.tipo]||0)+r.tenencia; byComi[r.comitente]=(byComi[r.comitente]||0)+r.tenencia; });
  const tipoE = Object.entries(byTipo).sort((a,b)=>b[1]-a[1]);
  const comiE = Object.entries(byComi).sort((a,b)=>b[1]-a[1]);
  renderDonut('donutTipo','legendTipo',tipoE,total,true);
  renderDonut('donutComitente','legendComitente',comiE,total,false);
  const maxT = tipoE[0]?.[1]||1;
  id('barTipos').innerHTML = tipoE.map(([k,v])=>{
    const col=TYPE_COLORS[k]||'#64748b';
    return `<div class="bar-row" style="margin-bottom:8px">
      <span class="bar-label" style="width:170px">${esc(k)}</span>
      <div class="bar-track-wrap"><div class="bar-track-fill" style="width:${(v/maxT*100).toFixed(1)}%;background:${col}"></div></div>
      <span class="bar-val" style="width:90px">${fmtUSD(v)}</span>
      <span style="width:46px;text-align:right;font-size:11px;font-family:'DM Mono',monospace;color:var(--text3);flex-shrink:0">${(v/total*100).toFixed(1)}%</span>
    </div>`;
  }).join('');
}

function renderDonut(svgId, legendId, entries, total, useTypeColors) {
  const svg=id(svgId); if(!svg) return;
  const cx=100,cy=100,r=72,inner=46; let angle=-Math.PI/2;
  const paths=entries.map(([label,val],i)=>{
    const pct=val/total, sweep=pct*2*Math.PI;
    const x1=cx+r*Math.cos(angle),y1=cy+r*Math.sin(angle); angle+=sweep;
    const x2=cx+r*Math.cos(angle),y2=cy+r*Math.sin(angle);
    const xi1=cx+inner*Math.cos(angle-sweep),yi1=cy+inner*Math.sin(angle-sweep);
    const xi2=cx+inner*Math.cos(angle),yi2=cy+inner*Math.sin(angle);
    const large=sweep>Math.PI?1:0;
    const col=useTypeColors?(TYPE_COLORS[label]||PALETTE[i%PALETTE.length]):PALETTE[i%PALETTE.length];
    return `<path d="M${xi1.toFixed(1)},${yi1.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} L${xi2.toFixed(1)},${yi2.toFixed(1)} A${inner},${inner} 0 ${large} 0 ${xi1.toFixed(1)},${yi1.toFixed(1)} Z" fill="${col}" opacity="0.9"><title>${esc(label)}: ${fmtUSD(val)} (${(pct*100).toFixed(1)}%)</title></path>`;
  });
  svg.innerHTML=paths.join('')+
    `<circle cx="${cx}" cy="${cy}" r="${inner}" fill="var(--s1)"/>` +
    `<text x="${cx}" y="${cy-6}" text-anchor="middle" fill="var(--text3)" font-size="9" font-family="DM Sans">TENENCIA</text>` +
    `<text x="${cx}" y="${cy+10}" text-anchor="middle" fill="var(--text)" font-size="13" font-weight="600" font-family="DM Mono">${fmtUSD(total)}</text>`;
  id(legendId).innerHTML=entries.slice(0,9).map(([k,v],i)=>{
    const col=useTypeColors?(TYPE_COLORS[k]||PALETTE[i%PALETTE.length]):PALETTE[i%PALETTE.length];
    return `<div class="legend-row"><div class="legend-dot" style="background:${col}"></div><span class="legend-label">${esc(k)}</span><span class="legend-pct">${(v/total*100).toFixed(1)}%</span><span class="legend-val" style="margin-left:6px">${fmtUSD(v)}</span></div>`;
  }).join('');
}

/* ══════════════════════════════════════════
   POSICIONES
══════════════════════════════════════════ */
function renderPosiciones(rows) {
  const total=sum(rows,'tenencia')||1;
  const sorted=[...rows].sort((a,b)=>b.tenencia-a.tenencia);
  setText('posicionesCount', sorted.length + ' posiciones');
  renderTable('tablaPosiciones', sorted, r=>{
    const col=TYPE_COLORS[r.tipo]||'#64748b';
    const rendCls=r.rendPct===null?'':r.rendPct>=0?'pos':'neg';
    const resCls=r.resultado===null?'':r.resultado>=0?'pos':'neg';
    return `<tr>
      <td title="${esc(r.comitente)}">${esc(r.comitente.split(' ')[0])}</td>
      <td><strong>${esc(r.ticker)}</strong></td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis" title="${esc(r.instrumento)}">${esc(r.instrumento)}</td>
      <td><span class="tipo-badge" style="background:${col}22;color:${col}">${esc(r.tipo)}</span></td>
      <td class="tr">${fmtNum(r.nominales)}</td>
      <td class="tr">${r.pcompra>0?fmtNum4(r.pcompra):'--'}</td>
      <td class="tr"><strong>${fmtUSD(r.tenencia)}</strong></td>
      <td class="tr ${resCls}">${r.resultado!==null?(r.resultado>=0?'+':'')+fmtUSD(r.resultado):'--'}</td>
      <td class="tr ${rendCls}">${r.rendPct!==null?(r.rendPct>=0?'+':'')+r.rendPct.toFixed(1)+'%':'--'}</td>
      <td class="tr">${r.dias>0?fmt(r.dias)+'d':'--'}</td>
      <td class="tr">${(r.tenencia/total*100).toFixed(1)}%</td>
    </tr>`;
  });
}

/* ══════════════════════════════════════════
   ANALISIS
══════════════════════════════════════════ */
function renderAnalisis(rows) {
  const total=sum(rows,'tenencia')||1;
  const sorted=[...rows].sort((a,b)=>b.tenencia-a.tenencia);
  const top5=sorted.slice(0,5), top5pct=sum(top5,'tenencia')/total*100;
  const byTipo={};
  rows.forEach(r=>{ byTipo[r.tipo]=(byTipo[r.tipo]||0)+r.tenencia; });
  const tipoCount=Object.keys(byTipo).length;
  const liqVal=(byTipo['FCI Liquidez']||0)+(byTipo['Pesos']||0)+(byTipo['Dolares/Efectivo']||0);
  const liqPct=liqVal/total*100;
  const comiCount=new Set(rows.map(r=>r.comitente)).size;

  const diags=[];
  if (top5pct>60) diags.push({level:'alert',icon:'⚠️',title:'Alta concentracion: top 5 = '+top5pct.toFixed(0)+'%',desc:top5.map(r=>r.ticker).join(', ')+' concentran mas del 60%. Considerar diversificar.'});
  else if(top5pct>40) diags.push({level:'warn',icon:'📊',title:'Concentracion moderada: top 5 = '+top5pct.toFixed(0)+'%',desc:'Dentro de rangos aceptables pero con margen de mejora.'});
  else diags.push({level:'ok',icon:'✓',title:'Buena diversificacion: top 5 = '+top5pct.toFixed(0)+'%',desc:'Posiciones bien distribuidas entre multiples activos.'});

  if(tipoCount>=5) diags.push({level:'ok',icon:'✓',title:tipoCount+' tipos de activos distintos',desc:'La cartera incluye: '+Object.keys(byTipo).join(', ')+'.'});
  else if(tipoCount>=3) diags.push({level:'info',icon:'ℹ️',title:tipoCount+' tipos de activos',desc:'Hay margen para ampliar la diversificacion por clase de activo.'});
  else diags.push({level:'warn',icon:'⚠️',title:'Poca diversificacion: '+tipoCount+' tipo'+(tipoCount!==1?'s':'')+' de activo',desc:'La cartera esta muy concentrada en pocas categorias.'});

  if(liqPct>30) diags.push({level:'warn',icon:'💧',title:'Alta liquidez: '+liqPct.toFixed(0)+'% en efectivo/MM',desc:'USD '+fmtUSD(liqVal)+' en posiciones liquidas. Puede ser oportunidad de inversion.'});
  else if(liqPct<3&&rows.length>3) diags.push({level:'info',icon:'💧',title:'Liquidez baja: '+liqPct.toFixed(1)+'%',desc:'Menos del 3% liquido. Revisar si el cliente tiene necesidades proximas.'});

  // Tickers de liquidez — excluir del rendimiento
  const EXCLUIR_REND = new Set(['U$S','U$SCV7000','$']);
  const conCostoAll  = rows.filter(r => r.costoEst > 0 && !EXCLUIR_REND.has(r.ticker.toUpperCase()));
  const conCosto     = conCostoAll; // alias para enRojo/enVerde

  const enRojo   = conCosto.filter(r=>r.resultado!==null&&r.resultado<0);
  const enVerde  = conCosto.filter(r=>r.resultado!==null&&r.resultado>0);

  // Diagnostico usa conCosto sin liquidez
  if(enRojo.length>0) diags.push({level:'alert',icon:'📉',title:enRojo.length+' posicion'+(enRojo.length!==1?'es':'')+' con resultado negativo',desc:'Perdida estimada: USD '+fmtUSD(Math.abs(sum(enRojo,'resultado')))+'. Tickers: '+enRojo.map(r=>r.ticker).join(', ')+'.'});
  if(enVerde.length>0) diags.push({level:'ok',icon:'📈',title:enVerde.length+' posicion'+(enVerde.length!==1?'es':'')+' con ganancia estimada',desc:'Ganancia acumulada: USD '+fmtUSD(sum(enVerde,'resultado'))+'.'});
  if(comiCount>1) diags.push({level:'info',icon:'👥',title:comiCount+' comitentes',desc:'Filtra por comitente en la barra superior para ver cada cartera individualmente.'});

  id('diagnosticoList').innerHTML=diags.map(d=>`
    <div class="diag-card ${d.level}">
      <div class="diag-icon">${d.icon}</div>
      <div class="diag-body"><div class="diag-title">${d.title}</div><div class="diag-desc">${d.desc}</div></div>
    </div>`).join('');

  const top5val=sum(top5,'tenencia');
  const concData=[...top5.map(r=>[r.ticker,r.tenencia]),['Resto',total-top5val]];
  const maxConc=concData[0]?.[1]||1;
  id('concentracionChart').innerHTML=concData.map(([k,v],i)=>`
    <div class="bar-row" style="margin-bottom:8px">
      <span class="bar-label">${esc(k)}</span>
      <div class="bar-track-wrap"><div class="bar-track-fill" style="width:${(v/maxConc*100).toFixed(1)}%;background:${i===concData.length-1?'var(--text3)':PALETTE[i]}"></div></div>
      <span class="bar-val">${(v/total*100).toFixed(1)}%</span>
    </div>`).join('');

  // Rendimiento: si vista general -> promediar por ticker; si por cliente -> individual
  const esVistaPorCliente = id('filtroComitente').value !== 'TODOS';
  let rendRows;
  if (esVistaPorCliente) {
    rendRows = conCosto.filter(r=>r.rendPct!==null).sort((a,b)=>b.rendPct-a.rendPct);
  } else {
    const byTicker = {};
    conCosto.filter(r=>r.rendPct!==null).forEach(r => {
      if (!byTicker[r.ticker]) byTicker[r.ticker] = { ticker:r.ticker, instrumento:r.instrumento, sumRend:0, count:0 };
      byTicker[r.ticker].sumRend += r.rendPct;
      byTicker[r.ticker].count  += 1;
    });
    rendRows = Object.values(byTicker)
      .map(t => ({ ticker:t.ticker, instrumento:t.instrumento, rendPct:t.sumRend/t.count, clientes:t.count }))
      .sort((a,b)=>b.rendPct-a.rendPct);
  }

  if(rendRows.length){
    const maxAbs=Math.max(...rendRows.map(r=>Math.abs(r.rendPct)),1);
    const notaPromedio = !esVistaPorCliente ? `<p style="font-size:10.5px;color:var(--text3);margin-bottom:10px">Rendimiento promedio por activo entre todos los clientes. Filtra por cliente para ver posiciones individuales.</p>` : '';
    id('rendimientoChart').innerHTML= notaPromedio + `<div style="display:flex;flex-direction:column;gap:6px">`+
      rendRows.map(r=>{
        const pos=r.rendPct>=0, bw=(Math.abs(r.rendPct)/maxAbs*100).toFixed(1);
        const nota = (!esVistaPorCliente && r.clientes>1) ? `<span style="font-size:9.5px;color:var(--text3);flex-shrink:0">${r.clientes} clientes</span>` : '';
        return `<div style="display:flex;align-items:center;gap:8px">
          <span style="width:60px;font-size:11px;color:var(--text2);text-align:right;flex-shrink:0" title="${esc(r.instrumento||'')}">${esc(r.ticker)}</span>
          <div style="flex:1;height:7px;background:var(--s3);border-radius:99px;overflow:hidden;position:relative;">
            <div style="position:absolute;${pos?'left:0':'right:0'};width:${bw}%;height:100%;background:${pos?'var(--green)':'var(--red)'};border-radius:99px"></div>
          </div>
          <span style="width:54px;font-size:11px;font-family:'DM Mono',monospace;color:${pos?'var(--green)':'var(--red)'};text-align:right;flex-shrink:0">${r.rendPct>=0?'+':''}${r.rendPct.toFixed(1)}%</span>
          ${nota}
        </div>`;
      }).join('')+`</div>`;
  } else {
    id('rendimientoChart').innerHTML=`<p style="color:var(--text3);font-size:12px;text-align:center;padding:20px">Sin datos suficientes de precio de compra</p>`;
  }

  renderTable('tablaEnRojo', enRojo.sort((a,b)=>a.resultado-b.resultado), r=>`<tr>
    <td>${esc(r.comitente.split(' ')[0])}</td><td><strong>${esc(r.ticker)}</strong></td><td>${esc(r.instrumento)}</td>
    <td class="tr">${fmtNum4(r.pcompra)}</td><td class="tr">${fmtUSD(r.tenencia)}</td>
    <td class="tr neg">${fmtUSD(r.resultado)}</td><td class="tr neg">${r.rendPct.toFixed(1)}%</td><td class="tr">${r.dias}d</td>
  </tr>`);
}

/* ══════════════════════════════════════════
   HISTORICO
══════════════════════════════════════════ */
function renderHistoricoView() {
  updateBadge();
  const hist=STATE.historico;
  const container=id('historicoContainer');
  if(!container) return;

  if(!hist.length){
    container.innerHTML=`<div class="inline-empty">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="14" stroke="currentColor" stroke-width="1.5"/><path d="M18 10V18L23 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <p>Todavia no guardaste ningun periodo.<br>Carga un Excel y presiona <strong>Guardar periodo</strong>.</p>
    </div>`;
    return;
  }

  const primero=hist[0], ultimo=hist[hist.length-1];
  const tenInicial=sum(primero.rows,'tenencia'), tenActual=sum(ultimo.rows,'tenencia');
  const delta=tenActual-tenInicial, deltaPct=tenInicial?delta/tenInicial*100:null;

  container.innerHTML=`
    <div class="hist-kpis">
      <div class="hist-kpi"><span>Periodos guardados</span><strong>${hist.length}</strong></div>
      <div class="hist-kpi accent-b"><span>Tenencia inicial</span><strong class="mono">${fmtUSD(tenInicial)}</strong></div>
      <div class="hist-kpi ${delta>=0?'accent-g':'accent-r'}"><span>Tenencia actual</span><strong class="mono">${fmtUSD(tenActual)}</strong></div>
      <div class="hist-kpi ${delta>=0?'accent-g':'accent-r'}"><span>Variacion total</span><strong class="mono">${delta>=0?'+':''}${fmtUSD(delta)}${deltaPct!==null?' ('+(delta>=0?'+':'')+deltaPct.toFixed(1)+'%)':''}</strong></div>
    </div>
    <div class="timeline-wrap">
      ${hist.map((p,i)=>{
        const tenP=sum(p.rows,'tenencia');
        const prev=i>0?hist[i-1]:null;
        const tenPrev=prev?sum(prev.rows,'tenencia'):null;
        const diff=tenPrev!==null?tenP-tenPrev:null;
        const diffPct=(tenPrev&&diff!==null)?diff/tenPrev*100:null;
        const isLast=i===hist.length-1;
        const byTipo={};
        p.rows.forEach(r=>{ byTipo[r.tipo]=(byTipo[r.tipo]||0)+r.tenencia; });
        const tipoTop=Object.entries(byTipo).sort((a,b)=>b[1]-a[1]).slice(0,4);
        const totalP=tenP||1;
        const cambios=calcCambios(prev,p);
        const comiCount=new Set(p.rows.map(r=>r.comitente)).size;

        return `
        <div class="tl-period${isLast?' tl-period-last':''}">
          <div class="tl-connector">
            <div class="tl-line-left${i===0?' invisible':''}"></div>
            <div class="tl-dot${isLast?' tl-dot-active':''}"></div>
            <div class="tl-line-right${isLast?' invisible':''}"></div>
          </div>
          <div class="tl-card">
            <div class="tl-card-head">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <strong class="tl-period-label">${esc(p.label)}</strong>
                  <span class="tl-filename">${esc(p.fecha)} · ${esc(p.filename)}</span>
                </div>
                <button class="tl-del-btn" onclick="eliminarPeriodo(${p.id})" title="Eliminar">x</button>
              </div>
            </div>
            <div class="tl-metrics">
              <div class="tl-metric">
                <span class="tl-metric-label">Tenencia total</span>
                <span class="tl-metric-value">${fmtUSD(tenP)}</span>
                <div class="tl-metric-delta">${diff!==null?`<span class="${diff>=0?'tl-delta-pos':'tl-delta-neg'}">${diff>=0?'▲':'▼'} ${diff>=0?'+':''}${fmtUSD(diff)} (${diffPct!==null?(diffPct>=0?'+':'')+diffPct.toFixed(1)+'%':''})</span>`:''}</div>
              </div>
              <div class="tl-metric">
                <span class="tl-metric-label">Posiciones · comitentes</span>
                <span class="tl-metric-value">${p.rows.length} pos · ${comiCount} comi</span>
                <div class="tl-metric-delta">
                  ${cambios.nuevas>0?`<span class="tl-delta-pos">+${cambios.nuevas} nuevas</span> `:''}
                  ${cambios.cerradas>0?`<span class="tl-delta-neg">-${cambios.cerradas} cerradas</span>`:''}
                </div>
              </div>
              <div class="tl-metric">
                <span class="tl-metric-label">Composicion</span>
                <div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">
                  ${tipoTop.map(([t,v])=>{
                    const col=TYPE_COLORS[t]||'#64748b';
                    const pct=(v/totalP*100).toFixed(0);
                    return `<div style="display:flex;align-items:center;gap:6px">
                      <div style="width:${Math.max(4,pct)}%;height:5px;background:${col};border-radius:99px;min-width:4px;max-width:60px"></div>
                      <span style="font-size:10px;color:var(--text3)">${esc(t)} ${pct}%</span>
                    </div>`;
                  }).join('')}
                </div>
              </div>
              ${cambios.mayoresMovs.length?`
              <div class="tl-metric">
                <span class="tl-metric-label">Movimientos destacados</span>
                ${cambios.mayoresMovs.map(m=>`
                  <div style="font-size:11px;color:var(--text2);margin-top:3px">
                    <span class="${m.diff>=0?'tl-delta-pos':'tl-delta-neg'}">${m.diff>=0?'▲':'▼'}</span>
                    <strong>${esc(m.ticker)}</strong>
                    ${m.diff>=0?'+':''}${fmtUSD(m.diff)} USD
                  </div>`).join('')}
              </div>`:''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function calcCambios(prev, curr) {
  if(!prev) return {nuevas:0,cerradas:0,mayoresMovs:[]};
  const key=r=>`${r.comitente}|${r.ticker}`;
  const mapP=new Map(prev.rows.map(r=>[key(r),r]));
  const mapC=new Map(curr.rows.map(r=>[key(r),r]));
  const nuevas=curr.rows.filter(r=>!mapP.has(key(r))).length;
  const cerradas=prev.rows.filter(r=>!mapC.has(key(r))).length;
  const movs=curr.rows.filter(r=>mapP.has(key(r)))
    .map(r=>({ticker:r.ticker,diff:r.tenencia-mapP.get(key(r)).tenencia}))
    .filter(m=>Math.abs(m.diff)>100)
    .sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff))
    .slice(0,3);
  return {nuevas,cerradas,mayoresMovs:movs};
}

/* ══════════════════════════════════════════
   NAV
══════════════════════════════════════════ */
function switchView(view) {
  qAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  qAll('.view-section').forEach(s=>s.classList.add('hidden'));
  const sec=id('view'+view.charAt(0).toUpperCase()+view.slice(1));
  if(sec) sec.classList.remove('hidden');
  const meta=VIEWS[view]||{};
  setText('viewTitle',meta.title||view);
  setText('viewSub',meta.sub||'');
}

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */
function renderTable(tid,rows,fn){ const tb=document.querySelector(`#${tid} tbody`); if(tb) tb.innerHTML=rows.map(fn).join(''); }
function sum(rows,key){ return rows.reduce((a,r)=>a+(Number(r[key])||0),0); }
function setText(eid,v){ const e=id(eid); if(e) e.textContent=v; }
function id(eid){ return document.getElementById(eid); }
function qAll(s){ return document.querySelectorAll(s); }
function str(v){ return (v??'').toString().trim(); }
function num(v){ if(v===null||v===undefined||v==='') return 0; if(typeof v==='number') return Number.isFinite(v)?v:0; const n=Number(String(v).trim().replace(/\./g,'').replace(',','.')); return Number.isFinite(n)?n:0; }
function fmtUSD(n){ return new Intl.NumberFormat('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.round(Number(n)||0)); }
function fmtNum(n){ return new Intl.NumberFormat('es-AR',{minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(n)||0); }
function fmtNum4(n){ return new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:4}).format(Number(n)||0); }
function fmt(n){ return new Intl.NumberFormat('es-AR').format(Number(n)||0); }
function esc(v){ return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

let _tt;
function toast(msg,type=''){ const el=id('toast'); el.textContent=msg; el.className=`toast ${type}`; clearTimeout(_tt); _tt=setTimeout(()=>{el.className='toast hidden';},3200); }
