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
  'Bonos Soberanos USD':     '#f43f5e',
  'Bonos Provinciales':      '#e11d48',
  'BOPREAL':                 '#be123c',
  'Bonos CER':               '#fb923c',
  'Bonos Nacion $':          '#fbbf24',
  'Letras':                  '#e879f9',
  'Pesos':                   '#78716c',
  'Dolares/Efectivo':        '#84cc16',
  'Otros':                   '#64748b',
  'Cheques':                 '#84cc16',
  'Treasuries':              '#38bdf8',
  'ETP Exterior':            '#818cf8',
};

/* ══════════════════════════════════════════
   TIPO INFERENCE
══════════════════════════════════════════ */
function inferTipo(instrumento, ticker, esExterior = false, comitente = '') {
  const inst = instrumento.toUpperCase();
  const tic  = ticker.toUpperCase();
  const comi = comitente.toUpperCase();

  // ── ISIN LARGO EN TICKER (XS..., LU..., IE... de 12 chars) → ETP Exterior ──
  // Debe ir antes que todo para evitar que caigan en otras categorias
  if (/^[A-Z]{2}[A-Z0-9]{10}$/.test(tic))                            return 'ETP Exterior';

  // ── LETRAS — S14G6, S29Y6 etc (BEFORE pesos) ────────────────────────
  if (/^S\d{2}[A-Z]\d{1,2}$/.test(tic))                              return 'Letras';
  // D30S6 y similares con patron DxxSx tambien son letras
  if (/^D\d{2}S\d{1,2}$/.test(tic))                                   return 'Letras';

  // ── EFECTIVO ─────────────────────────────────────────────────────────
  if (tic === 'U$S' || tic === 'U$SCV7000')                           return 'Dolares/Efectivo';
  if (tic === '$'   || inst.includes('PESOS'))                         return 'Pesos';
  if (inst.includes('CABLE') || inst.includes('US DOLLAR') || tic === 'USD') return 'Dolares/Efectivo';

  // ── FCI PESOS con nombre LONG ────────────────────────────────────────
  if (tic.toUpperCase().startsWith('LONGPESOS'))                       return 'FCI';

  // ── CEDEARs ──────────────────────────────────────────────────────────
  if (inst.includes('CEDEAR'))                                         return 'CEDEARs';

  // ── ACCIONES EXTERIOR — ticker termina en .E ──────────────────────────
  if (tic.endsWith('.E'))                                              return 'Acciones Ext.';

  // ── LECAPSA/B/C → FCI ────────────────────────────────────────────────
  if (tic.startsWith('LECAPS'))                                        return 'FCI';

  // ── TREASURY — antes de ON para que no caiga en ON ───────────────────
  if (inst.includes('TREASURY') || inst.includes('U S TREASURY') ||
      tic.includes('TBILL') || tic.includes('TNOTE') || tic.includes('TBOND'))
                                                                       return 'Treasuries';

  // ── BONOS CER ────────────────────────────────────────────────────────
  // TXAR es accion arg, TXMJ9 y similares son bonos CER
  if (tic === 'TXAR')                                                  return 'Acciones Arg.';
  // DICP va en bonos CER
  if (tic === 'DICP')                                                  return 'Bonos CER';
  if (inst.includes(' CER') || inst.includes('CER ') || inst.includes('(CER)') ||
      inst.includes('AJUSTADO CER') ||
      (tic.startsWith('TX') && tic !== 'TXAR') ||
      tic.startsWith('TC') || tic.startsWith('CER'))                  return 'Bonos CER';

  // ── BONOS CAP → Letras o Bonos Nacion $ ──────────────────────────────
  if (inst.includes('CAP ') || inst.includes(' CAP') || inst.includes('(CAP)') ||
      inst.includes('CAPITALIZ') ||
      tic.startsWith('T2X') || tic.startsWith('T3X') || tic.startsWith('TZX')) {
    if (inst.includes('LETRA'))                                        return 'Letras';
    return 'Bonos Nacion $';
  }

  // ── BOPREAL ───────────────────────────────────────────────────────────
  const BOPREAL_T = ['BPOC7','BPOD7','BPOB8','BPOA8','BPY26','BPY27','BPY28'];
  if (BOPREAL_T.includes(tic) || inst.includes('BOPREAL') ||
      tic.startsWith('BPO') || tic.startsWith('BPY'))                 return 'BOPREAL';

  // ── BONOS PROVINCIALES ────────────────────────────────────────────────
  const PROV_T  = ['BA37D','BB37D','CO35','NDT25'];
  const PROV_KW = ['BUENOS AIRES','PROVINCIA DE','CORDOBA','NEUQUEN','MENDOZA','SANTA FE','ENTRE RIOS','SALTA','TUCUMAN'];
  if (PROV_T.includes(tic) || PROV_KW.some(k => inst.includes(k)) ||
      (inst.includes('BONO') && inst.includes('PROV')))               return 'Bonos Provinciales';

  // ── BONOS SOBERANOS USD ───────────────────────────────────────────────
  const SOV_PFX = ['GD','AL','AE','AO','AN'];
  if (SOV_PFX.some(p => tic.startsWith(p) && /^[A-Z]{2}\d+/.test(tic)) ||
      inst.includes('REP. ARG') || inst.includes('BONOS REP') || inst.includes('STEP UP'))
                                                                       return 'Bonos Soberanos USD';

  // ── BONOS NACION PESOS ────────────────────────────────────────────────
  if (inst.includes('BONO NACION') || inst.includes('BONO DEL TESORO') ||
      tic.startsWith('TTD') || tic.startsWith('TY') || tic.startsWith('TO'))
                                                                       return 'Bonos Nacion $';

  // ── ACCIONES ARGENTINAS — EARLY CHECK (antes de FCI/ISIN rules) ────────
  // Estas palabras en instrumento indican siempre accion arg, sin excepcion
  const esAccionArgEarly =
    inst.includes('ESCRIT') || inst.includes('ESCRITURALES') ||
    inst.includes('1 VOTO') || inst.includes('ORDS.') ||
    inst.includes('ORDS "') || inst.includes('ORD.') ||
    inst.includes('ORDINARIAS') || inst.includes('S.A. ORDS') ||
    inst.includes('S.A.I.C') || inst.includes('SOCIEDAD ANONIMA');
  const ACC_ARG_EARLY = ['GGAL','PAMP','TGNO4','TGNO','TGSU2','TGSU','MOLI','MOLA','CARC',
                         'YPF','YPFD','CRES','COME','IRSA','ECOG','ALUA','TXAR','BBAR','BMA',
                         'SUPV','MIRG','BYMA','HARG','LOMA','DGCU2','CEPU','GBAN','TECO2',
                         'VALO','TRAN','EDN','LEDE','RICH','SEMI'];
  if (ACC_ARG_EARLY.includes(tic) || esAccionArgEarly)                return 'Acciones Arg.';

  // ── FCI LIQUIDEZ ──────────────────────────────────────────────────────
  if (inst.includes('MONEY MARKET') || tic.includes('BCMM'))          return 'FCI Liquidez';

  // ── FCI ───────────────────────────────────────────────────────────────
  const FCI_T = ['BCMMA','BCRFA','ESTRA1A','ESTRA2A','ESTRA3A','INSTITUA','CPRIVADOA',
                 'SOJAA','BCMMUSA','LECAPSA','LECAPSB','LECAPSC','LECAPSD','BCAPYB'];
  if (FCI_T.some(f => tic === f || tic.startsWith(f)))                return 'FCI';
  // ISIN largo en instrumento (no en ticker) + es FCI local → ETP Exterior
  if (/[A-Z]{2}[A-Z0-9]{10}/.test(inst) && !esExterior)              return 'ETP Exterior';
  if (inst.includes('CLASE A') || inst.includes('CLASE B') ||
      inst.includes('BALANZ')  || inst.includes('LATAM')   ||
      inst.includes('INFLATION') || inst.includes('INSTITUA') ||
      inst.includes('PRIVADO') || inst.includes('SOJA')    ||
      inst.includes('FCI')     || inst.includes('FONDO'))             return 'FCI';

  // ── ON: si comitente empieza con U (ej U415) → Acciones Ext. ─────────
  if (/^U\d+/.test(comi))                                             return 'Acciones Ext.';

  // ── OBLIGACIONES NEGOCIABLES ──────────────────────────────────────────
  // CNH INDUSTRIAL y otras ONs no argentinas: si tienen ON en inst pero no .O al final
  const tieneON   = inst.includes(' ON ') || inst.includes('OBLIGACION');
  const tieneVto  = /V\d{2}\/\d{2}\/\d{2}/.test(inst);
  const tieneTasa = /\d+(\.\d+)?\s*%/.test(inst);
  const esBono    = inst.includes('BONO') || inst.includes('NACIONAL') ||
                    inst.includes('NACION') || inst.includes('SOBERAN') || inst.includes('PROVINCIA');
  const esON_tic  = /^[A-Z]{2,5}\d?O$/.test(tic) || /^[A-Z]{2,4}\d{1,2}O$/.test(tic);
  if (tieneON || tieneVto || esON_tic || (tieneTasa && !esBono))      return 'Obligaciones Negociables';
  if (inst.includes('CL.') && !inst.includes('CLASE'))                return 'Obligaciones Negociables';

  // ── ACCIONES ARGENTINAS — late fallback ─────────────────────────────────
  // (La mayoria ya fue capturada en el early check arriba)
  if (inst.includes('ESCRIT') || inst.includes('1 VOTO') || inst.includes('ORDS.'))
                                                                       return 'Acciones Arg.';

  // ── CHEQUES ───────────────────────────────────────────────────────────
  if (tic.startsWith('#'))                                             return 'Cheques';

  // ── CUENTA EXTERIOR ───────────────────────────────────────────────────
  if (esExterior) {
    // TREASURY en instrumento
    if (inst.includes('TREASURY') || inst.includes('U.S. TREASURY') ||
        inst.includes('U S TREASURY'))                                 return 'Treasuries';

    // ETP reales: fondos internacionales conocidos
    const esETP =
      inst.includes('GLOBAL EQUITY') || inst.includes('FIXED INCOME') ||
      inst.includes('BALANCED') || inst.includes('INCOME LATAM') ||
      inst.includes('ISHARES') || inst.includes('VANGUARD') ||
      inst.includes('INVESCO') || inst.includes('XTRACKERS') ||
      inst.includes('AMUNDI') || inst.includes('WISDOMTREE') ||
      inst.includes('WISDOM TREE') || inst.includes('SPDR') ||
      inst.includes('PIMCO');
    if (esETP)                                                         return 'ETP Exterior';

    // BALANZ fondos — solo si tiene palabras de fondo, no accion
    if (inst.includes('BALANZ') && (inst.includes('EQUITY') || inst.includes('INCOME') ||
        inst.includes('BOND') || inst.includes('BALANCED') || inst.includes('FUND')))
                                                                       return 'ETP Exterior';

    // ISIN en instrumento (no en ticker) → Acciones Ext. (referencia)
    if (/[A-Z]{2}[A-Z0-9]{10}/.test(inst) && !/^[A-Z]{2}[A-Z0-9]{10}$/.test(tic))
                                                                       return 'Acciones Ext.';
    // Empresas extranjeras
    if (inst.includes(' INC') || inst.includes(' CORP') ||
        inst.includes(' LTD') || inst.includes(' LLC')  ||
        inst.includes(' PLC') || inst.includes(' NV'))                return 'Acciones Ext.';
    // Ticker corto → accion exterior
    if (tic.length <= 5 && /^[A-Z]+$/.test(tic))                     return 'Acciones Ext.';
    // Fallback cuenta exterior → Acciones Ext.
    return 'Acciones Ext.';
  }

  // ── FCI LOCALES — terminan en L ──────────────────────────────────────
  if (/^[A-Z0-9]{3,10}L$/.test(tic))                                  return 'FCI';

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
  resumen:     { title:'Resumen',        sub:'Vision consolidada de carteras' },
  composicion: { title:'Composicion',    sub:'Distribucion por tipo de activo y comitente' },
  posiciones:  { title:'Posiciones',     sub:'Detalle completo de todas las posiciones' },
  analisis:    { title:'Analisis',       sub:'Diagnostico automatico de cartera' },
  vencimientos:{ title:'Vencimientos',   sub:'Calendario de vencimientos de renta fija' },
  comitentes:  { title:'Por comitente',  sub:'Resumen individual por cliente' },
  movimientos: { title:'Movimientos',    sub:'Cambios entre periodos guardados' },
  liquidez:    { title:'Liquidez ociosa', sub:'Saldos sin rendimiento — actuar directamente' },
  historico:   { title:'Historico',      sub:'Evolucion de carteras guardada periodo a periodo' },
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
  renderMovimientosView();

  id('filtroPeriodoMov') && id('filtroPeriodoMov').addEventListener('change', renderMovimientosDetalle);
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
  const instrumento  = str(r['instrumento']  || r['Instrumento']  || '');
  const ticker       = str(r['ticker']       || r['Ticker']       || '');
  const tenencia     = num(r['tenencia']     || r['Tenencia']     || 0);
  const pcompra      = num(r['preciocompra'] || r['PrecioCompra'] || 0);
  const nominales    = num(r['nominales']    || r['Nominales']    || 0);
  const dias         = num(r['diastenencia'] || r['DiasTenencia'] || 0);
  const comitente    = str(r['comitente']    || r['Comitente']    || '');
  const comitentepa  = str(r['comitentepa']  || r['Comitentepa']  || '');
  const cuenta       = str(r['cuenta']       || r['Cuenta']       || '');
  // Cuenta exterior: comitente vacio y comitentepa tiene valor
  const esExterior   = !comitente && !!comitentepa;
  const tipo         = inferTipo(instrumento, ticker, esExterior, comitente);
  const costoEst     = (pcompra > 0 && nominales > 0) ? nominales * pcompra : 0;
  const resultado    = costoEst > 0 ? tenencia - costoEst : null;
  const rendPct      = (costoEst > 0 && resultado !== null) ? (resultado / costoEst) * 100 : null;
  // Para mostrar: usar comitentepa si comitente esta vacio
  const comiNum      = comitente || comitentepa || '';   // numero de comitente
  const comiDisplay  = comiNum || cuenta;
  return { comitente: comiDisplay, comiNum, comitentepa, cuenta, instrumento, ticker, tipo, tenencia, pcompra, nominales, dias, costoEst, resultado, rendPct, esExterior };
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
  renderMovimientosView();
}

function limpiarHistorico() {
  if (!confirm('Limpiar todo el historico guardado? Esta accion no se puede deshacer.')) return;
  STATE.historico = [];
  saveHistoricoToStorage();
  renderHistoricoView();
  renderMovimientosView();
  toast('Historico limpiado','ok');
}

function eliminarPeriodo(pid) {
  STATE.historico = STATE.historico.filter(p => p.id !== pid);
  saveHistoricoToStorage();
  renderHistoricoView();
  renderMovimientosView();
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
  renderVencimientos(rows);
  renderComitentesView(rows);
  renderLiquidezOciosa(rows);
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

  renderAlertasLiquidez(rows);
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
  const EXCLUIR_TIPOS_LIQ = new Set(['Pesos','Dolares/Efectivo','FCI Liquidez']);
  const conCostoAll  = rows.filter(r => r.costoEst > 0 &&
    !EXCLUIR_REND.has(r.ticker.toUpperCase()) &&
    !EXCLUIR_TIPOS_LIQ.has(r.tipo));
  const conCosto     = conCostoAll;

  // Concentracion por emisor
  const byEmisor = {};
  rows.forEach(r => {
    const em = extractEmisor(r.instrumento, r.ticker);
    byEmisor[em] = (byEmisor[em]||0) + r.tenencia;
  });
  const emisorEntries = Object.entries(byEmisor).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxEm = emisorEntries[0]?.[1]||1;
  id('emisorChart').innerHTML = emisorEntries.map(([k,v],i) => `
    <div class="bar-row" style="margin-bottom:8px">
      <span class="bar-label">${esc(k)}</span>
      <div class="bar-track-wrap"><div class="bar-track-fill" style="width:${(v/maxEm*100).toFixed(1)}%;background:${PALETTE[i%PALETTE.length]}"></div></div>
      <span class="bar-val">${(v/total*100).toFixed(1)}%</span>
    </div>`).join('');

  // Duracion promedio renta fija
  const hoy = new Date();
  const rfConVtoAll = rows.filter(r => RENTA_FIJA_TIPOS.includes(r.tipo)).map(r => {
    const fv = extractFechaVto(r.instrumento, r.ticker);
    return fv ? { ...r, diasRest: Math.round((fv - hoy)/86400000) } : null;
  }).filter(r => r && r.diasRest >= 0); // exclude already matured
  // Deduplicate by ticker for duration chart (use max tenencia row)
  const byTicDur = {};
  rfConVtoAll.forEach(r => { if (!byTicDur[r.ticker] || r.tenencia > byTicDur[r.ticker].tenencia) byTicDur[r.ticker] = r; });
  const rfConVto = Object.values(byTicDur);
  const durProm = rfConVto.length ? rfConVtoAll.reduce((a,r)=>a+r.diasRest,0)/rfConVtoAll.length : null;
  const durEl = id('duracionPanel');
  if (durEl) {
    if (rfConVto.length) {
      durEl.innerHTML = `
        <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:14px">
          <div><span style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:700;display:block;margin-bottom:4px">Duracion promedio</span>
            <span style="font-size:28px;font-weight:600;font-family:'DM Mono',monospace;color:var(--text)">${Math.round(durProm)}d</span></div>
          <div><span style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:700;display:block;margin-bottom:4px">Posiciones con fecha</span>
            <span style="font-size:28px;font-weight:600;font-family:'DM Mono',monospace;color:var(--text)">${rfConVto.length}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${rfConVto.sort((a,b)=>a.diasRest-b.diasRest).slice(0,6).map(r => {
            const pct = Math.min(r.diasRest / 730 * 100, 100);
            const col = r.diasRest < 90 ? 'var(--red)' : r.diasRest < 365 ? 'var(--amber)' : 'var(--green)';
            return `<div style="display:flex;align-items:center;gap:8px">
              <span style="width:60px;font-size:11px;color:var(--text2);flex-shrink:0;text-align:right">${esc(r.ticker)}</span>
              <div style="flex:1;height:6px;background:var(--s3);border-radius:99px;overflow:hidden">
                <div style="width:${pct.toFixed(1)}%;height:100%;background:${col};border-radius:99px"></div>
              </div>
              <span style="width:40px;font-size:11px;font-family:'DM Mono',monospace;color:var(--text2);flex-shrink:0">${r.diasRest}d</span>
            </div>`;
          }).join('')}
        </div>`;
    } else {
      durEl.innerHTML = '<p style="color:var(--text3);font-size:12px;text-align:center;padding:12px">Sin fechas de vencimiento detectadas</p>';
    }
  }

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
    // Agrupar por ticker, solo si la tenencia total supera USD 20.000
    const byTicker = {};
    conCosto.filter(r=>r.rendPct!==null).forEach(r => {
      if (!byTicker[r.ticker]) byTicker[r.ticker] = { ticker:r.ticker, instrumento:r.instrumento, sumRend:0, count:0, totalTen:0 };
      byTicker[r.ticker].sumRend   += r.rendPct;
      byTicker[r.ticker].count    += 1;
      byTicker[r.ticker].totalTen += r.tenencia;
    });
    rendRows = Object.values(byTicker)
      .filter(t => t.totalTen >= 20000)
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

  // Agrupar en rojo por ticker, filtrar > 20k tenencia total
  const byTickerRojo = {};
  enRojo.forEach(r => {
    if (!byTickerRojo[r.ticker]) byTickerRojo[r.ticker] = {
      ticker: r.ticker, instrumento: r.instrumento, tipo: r.tipo,
      totalTen: 0, totalRes: 0, sumRend: 0, count: 0, diasMax: 0
    };
    byTickerRojo[r.ticker].totalTen += r.tenencia;
    byTickerRojo[r.ticker].totalRes += r.resultado;
    byTickerRojo[r.ticker].sumRend  += r.rendPct;
    byTickerRojo[r.ticker].count    += 1;
    byTickerRojo[r.ticker].diasMax   = Math.max(byTickerRojo[r.ticker].diasMax, r.dias);
  });
  const rojoAgrupado = Object.values(byTickerRojo)
    .filter(r => r.totalTen >= 20000)
    .sort((a,b) => a.totalRes - b.totalRes);

  renderTable('tablaEnRojo', rojoAgrupado, r => {
    const rendProm = r.sumRend / r.count;
    return `<tr>
      <td class="tc">${r.count}</td>
      <td><strong>${esc(r.ticker)}</strong></td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis">${esc(r.instrumento)}</td>
      <td class="tr">${fmtUSD(r.totalTen)}</td>
      <td class="tr neg">${fmtUSD(r.totalRes)}</td>
      <td class="tr neg">${rendProm.toFixed(1)}%</td>
      <td class="tr">${r.diasMax}d max</td>
    </tr>`;
  });
}

/* ══════════════════════════════════════════
   ALERTAS DE LIQUIDEZ OCIOSA
══════════════════════════════════════════ */
function renderAlertasLiquidez(rows) {
  const cont = id('alertasLiquidez');
  if (!cont) return;
  const alertas = [];

  // Saldos en pesos
  const pesos = rows.filter(r => r.tipo === 'Pesos');
  const totalPesos = sum(pesos, 'tenencia');
  if (totalPesos > 500) {
    const diasMax = pesos.length ? Math.max(...pesos.map(r => r.dias)) : 0;
    alertas.push({
      icon: '💵', level: totalPesos > 5000 ? 'urgent' : 'warn',
      title: 'Saldo en pesos sin invertir: USD ' + fmtUSD(totalPesos),
      desc: 'Dinero parado en pesos pierde vs inflacion. Dias max sin movimiento: ' + diasMax + 'd. Considerar FCI pesos o LECAP.',
      tag: 'Pesos ociosos', tagClass: totalPesos > 5000 ? 'red' : ''
    });
  }

  // Saldos en dolares/efectivo
  const dols = rows.filter(r => r.tipo === 'Dolares/Efectivo');
  const totalDols = sum(dols, 'tenencia');
  if (totalDols > 1000) {
    const diasMax = dols.length ? Math.max(...dols.map(r => r.dias)) : 0;
    alertas.push({
      icon: '💵', level: totalDols > 10000 ? 'urgent' : 'warn',
      title: 'Saldo en USD sin invertir: USD ' + fmtUSD(totalDols),
      desc: 'Dolares liquidos sin rendimiento. Dias max: ' + diasMax + 'd. Evaluar Treasuries, ONs o FCI USD.',
      tag: 'USD ocioso', tagClass: totalDols > 10000 ? 'red' : ''
    });
  }

  // FCI Liquidez pesos con muchos dias
  const mmPesos = rows.filter(r => r.tipo === 'FCI Liquidez' && r.dias > 30);
  if (mmPesos.length) {
    const total = sum(mmPesos, 'tenencia');
    const diasProm = sum(mmPesos, 'dias') / mmPesos.length;
    alertas.push({
      icon: '⏱️', level: 'info',
      title: mmPesos.length + ' posicion' + (mmPesos.length !== 1 ? 'es' : '') + ' en MM pesos hace mas de 30 dias (prom: ' + Math.round(diasProm) + 'd)',
      desc: 'USD ' + fmtUSD(total) + ' en money market por tiempo prolongado. Revisar si conviene rotar a mayor rendimiento.',
      tag: 'MM pesos', tagClass: ''
    });
  }

  // FCI Liquidez USD con muchos dias
  const mmUsd = rows.filter(r => (r.tipo === 'FCI' || r.tipo === 'FCI Liquidez') &&
    (r.ticker.toUpperCase().includes('USD') || r.ticker.toUpperCase().includes('BCMMUSA')) && r.dias > 30);
  if (mmUsd.length) {
    const total = sum(mmUsd, 'tenencia');
    alertas.push({
      icon: '⏱️', level: 'info',
      title: mmUsd.length + ' posicion' + (mmUsd.length !== 1 ? 'es' : '') + ' en MM USD hace mas de 30 dias',
      desc: 'USD ' + fmtUSD(total) + ' en money market USD por tiempo prolongado. Evaluar ON o Treasury.',
      tag: 'MM USD', tagClass: ''
    });
  }

  if (!alertas.length) { cont.innerHTML = ''; return; }

  cont.innerHTML = alertas.map(a => `
    <div class="liq-alerta ${a.level}">
      <div class="liq-icon">${a.icon}</div>
      <div class="liq-body">
        <div class="liq-title">${a.title}</div>
        <div class="liq-desc">${a.desc}</div>
      </div>
      <span class="liq-tag ${a.tagClass}">${a.tag}</span>
    </div>`).join('');
}


const VENC_HARDCODED = {
  'TLCTO': new Date(2036,0,20),  'LMS8O': new Date(2027,2,21),
  'YM37O': new Date(2027,4,7),   'IRCLO': new Date(2026,5,10),
  'BPY26': new Date(2026,4,31),  'YM39O': new Date(2030,6,22),
  'YM38O': new Date(2027,6,22),  'RCICO': new Date(2033,6,31),
  'MGCMO': new Date(2031,8,10),  'YMCXO': new Date(2031,8,11),
  'MR39O': new Date(2031,10,1),  'MGCRO': new Date(2037,10,14),
  'RUCOD': new Date(2030,11,5),  'BPOC7': new Date(2027,9,31),
  'BPOD7': new Date(2027,9,31),  'BPOB8': new Date(2028,9,31),
  'BPOA8': new Date(2028,9,31),  'GD35':  new Date(2035,6,9),
  'AE38':  new Date(2038,0,1),   'YM34O': new Date(2034,0,17),
  'VSCVO': new Date(2033,5,10),  'IRCPO': new Date(2035,2,31),
  'DNCAO': new Date(2033,3,28),  'TLCMO': new Date(2031,6,18),
  'TLCPO': new Date(2033,4,28),  'AO28':  new Date(2028,9,31),
  'YFCJO': new Date(2032,9,16),  'BA37D': new Date(2037,0,1),
  'MGCOO': new Date(2034,11,16), 'AL35':  new Date(2035,0,1),
  'AL30':  new Date(2030,0,1),   'AO27':  new Date(2027,9,29),
  'TSC4O': new Date(2035,10,20), 'VSCXO': new Date(2038,3,8),
  'CO35':  new Date(2035,1,3),   'VSCTO': new Date(2035,11,10),
  'TTD26': new Date(2026,11,15), 'TTJ26': new Date(2026,5,30),
  'AN29':  new Date(2029,10,30), 'GD41':  new Date(2041,6,9),
  'DNC7O': new Date(2030,9,24),  'PLC5O': new Date(2031,4,18),
  'DNC5O': new Date(2028,7,5),   'TTCDO': new Date(2030,0,1),
  'TTS26': new Date(2026,8,15),  'LOC5O': new Date(2027,6,24),
  'DICP':  new Date(2033,0,1),   'GD30':  new Date(2030,6,9),
  'AL29':  new Date(2029,0,1),   'TXMJ9': new Date(2029,5,29),
  'VBC2O': new Date(2026,8,5),   'HJCKO': new Date(2029,0,16),
  'GD46':  new Date(2046,6,9),   'AL41':  new Date(2041,0,1),
  'GD38':  new Date(2038,0,9),   'BB37D': new Date(2037,0,1),
  'NPCCO': new Date(2029,7,25),  'SBC2O': new Date(2029,0,16),
  'TX26':  new Date(2026,0,1),   'TX28':  new Date(2028,0,1),
  'PLC3O': new Date(2028,3,30),  'YFCMO': new Date(2027,4,20),
  'MR4OO': new Date(2031,10,1),  'MR35O': new Date(2027,7,28),
  'NDT25': new Date(2030,9,27), 'NPCCO': new Date(2029,7,25),
  'YMCUO': new Date(2031,0,17),   'TLCFO': new Date(2028,1,10),
  'RZ8BO': new Date(2026,1,10),   'DEC2O': new Date(2027,1,24),
  'YM35O': new Date(2027,1,27),   'RAC4O': new Date(2027,4,4),
  'PUA36': new Date(2036,3,29),   'DRSEO': new Date(2025,3,30),
  'OLC5O': new Date(2028,5,12),   'YMCWO': new Date(2026,6,1),
  'LIC6O': new Date(2026,6,2),    'BACGO': new Date(2029,5,23),
  'RZ9BO': new Date(2026,5,28),   'RZ9AO': new Date(2026,5,28),
  'MSSEO': new Date(2026,6,17),   'DRSBO': new Date(2025,6,20),
  'MSSFO': new Date(2027,6,23),   'MGCNO': new Date(2028,9,4),
  'LDCGO': new Date(2027,9,4),    'BYCHO': new Date(2028,9,10),
  'YMCYO': new Date(2028,9,10),   'YMCZO': new Date(2028,9,10),
  'YMCTO': new Date(2026,9,10),   'TO26':  new Date(2026,9,17),
  'BPOB7': new Date(2027,9,31),   'BPOA7': new Date(2027,9,31),
  'RFCBO': new Date(2025,11,7),   'CLIIO': new Date(2034,11,10),
  'BDC33': new Date(2033,10,26),  'CP38O': new Date(2030,10,28),
  'CRCKO': new Date(2025,4,16),   'RFCDO': new Date(2025,5,30),
  'MRCHO': new Date(2025,6,18),   'MRCKO': new Date(2025,6,19),
  'TX26':  new Date(2026,10,9),   'MRCOO': new Date(2026,0,20),
  'CRCLO': new Date(2026,1,8),    'CRCMO': new Date(2026,1,8),
  'LECBO': new Date(2026,2,21),   'MRCRO': new Date(2026,3,12),
  'PEC4O': new Date(2026,3,14),   'MRCQO': new Date(2026,3,18),
  'RCCTO': new Date(2026,4,9),
  'S29Y6': new Date(2026,4,29),  'S14G6': new Date(2026,7,14),
  'RC1CO': new Date(2033,6,31),  'RUCDO': new Date(2030,11,5),
  'TX26':  new Date(2026,0,1),   'RCICO': new Date(2033,6,31),
};
/* ══════════════════════════════════════════
   VENCIMIENTOS
══════════════════════════════════════════ */
function extractFechaVto(instrumento, ticker) {
  const inst = instrumento.toUpperCase();
  const tic  = (ticker||'').toUpperCase();
  // Hardcoded table takes priority
  if (tic && VENC_HARDCODED[tic]) return VENC_HARDCODED[tic];
  // Pattern 1: V22/08/26 (dia/mes/año)
  let m = inst.match(/V(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? '20' + m[3] : m[3];
    return new Date(parseInt(year), parseInt(m[2]) - 1, parseInt(m[1]));
  }
  // Pattern 2: "VENCE MM/YYYY" or "VTO MM/YYYY"
  m = inst.match(/(?:VCE|VTO|VENCE|VENCIMIENTO)[^\d]*(\d{2})[\/\-](\d{2,4})/);
  if (m) {
    const year = m[2].length === 2 ? '20' + m[2] : m[2];
    return new Date(parseInt(year), parseInt(m[1]) - 1, 1);
  }
  // Pattern 3: "CAP YYYYMMDD" or "CAP DD/MM/YYYY"
  m = inst.match(/CAP[^\d]*(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? '20' + m[3] : m[3];
    return new Date(parseInt(year), parseInt(m[2]) - 1, parseInt(m[1]));
  }
  // Pattern 4: standalone DD/MM/YYYY anywhere (last resort)
  m = inst.match(/(\d{2})\/(\d{2})\/(20\d{2})/);
  if (m) {
    return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  }
  // Pattern 5: year only in instrumento — use Jan 1
  m = inst.match(/(20[2-9]\d)/);
  if (m) return new Date(parseInt(m[1]), 0, 1);
}

const RENTA_FIJA_TIPOS = ['Obligaciones Negociables','Bonos Soberanos USD','Bonos CER',
  'Bonos Nacion $','Bonos Provinciales','BOPREAL','Letras','Treasuries'];

function renderVencimientos(rows) {
  const hoy = new Date();
  const rentaFija = rows.filter(r => RENTA_FIJA_TIPOS.includes(r.tipo));
  const conFecha  = [];
  const sinFecha  = [];

  rentaFija.forEach(r => {
    const fv = extractFechaVto(r.instrumento, r.ticker);
    if (fv) {
      const dias = Math.round((fv - hoy) / 86400000);
      conFecha.push({ ...r, fechaVto: fv, diasRestantes: dias });
    } else {
      sinFecha.push(r);
    }
  });

  conFecha.sort((a,b) => a.diasRestantes - b.diasRestantes);

  const v90  = conFecha.filter(r => r.diasRestantes <= 90  && r.diasRestantes >= 0).length;
  const v180 = conFecha.filter(r => r.diasRestantes <= 180 && r.diasRestantes >= 0).length;
  const v360 = conFecha.filter(r => r.diasRestantes <= 360 && r.diasRestantes >= 0).length;

  setText('venc90',      v90.toString());
  setText('venc180',     v180.toString());
  setText('venc360',     v360.toString());
  setText('vencSinFecha', sinFecha.length.toString());

  const badge = id('badgeVenc');
  if (badge) { badge.textContent = v90; badge.classList.toggle('hidden', v90 === 0); }

  // Agrupar por ticker para tabla principal
  const byTickerVenc = {};
  conFecha.forEach(r => {
    if (!byTickerVenc[r.ticker]) byTickerVenc[r.ticker] = {
      ticker: r.ticker, instrumento: r.instrumento, tipo: r.tipo,
      fechaVto: r.fechaVto, diasRestantes: r.diasRestantes,
      totalTen: 0, comitentes: 0
    };
    byTickerVenc[r.ticker].totalTen   += r.tenencia;
    byTickerVenc[r.ticker].comitentes += 1;
  });
  const vencAgrupados = Object.values(byTickerVenc).sort((a,b) => a.diasRestantes - b.diasRestantes);

  renderTable('tablaVencimientos', vencAgrupados, r => {
    const d = r.diasRestantes;
    const cls = d < 0 ? 'venc-nd' : d <= 90 ? 'venc-rojo' : d <= 180 ? 'venc-ambar' : 'venc-verde';
    const label = d < 0 ? 'Vencido' : d <= 90 ? 'Urgente' : d <= 180 ? 'Proximo' : 'OK';
    const fvStr = r.fechaVto.toLocaleDateString('es-AR');
    const col = TYPE_COLORS[r.tipo] || '#64748b';
    return `<tr>
      <td class="tr" style="text-align:center">${r.comitentes}</td>
      <td><strong>${esc(r.ticker)}</strong></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${esc(r.instrumento)}">${esc(r.instrumento)}</td>
      <td><span class="tipo-badge" style="background:${col}22;color:${col}">${esc(r.tipo)}</span></td>
      <td class="tr"><strong>${fmtUSD(r.totalTen)}</strong></td>
      <td class="tr">${fvStr}</td>
      <td class="tr">${d < 0 ? 'Vencido' : d + 'd'}</td>
      <td class="tc"><span class="venc-badge ${cls}">${label}</span></td>
    </tr>`;
  });

  // Sin fecha: agrupar tambien por ticker
  const byTickerSin = {};
  sinFecha.forEach(r => {
    if (!byTickerSin[r.ticker]) byTickerSin[r.ticker] = {
      ticker: r.ticker, instrumento: r.instrumento, tipo: r.tipo,
      totalTen: 0, comitentes: 0, diasMax: 0
    };
    byTickerSin[r.ticker].totalTen   += r.tenencia;
    byTickerSin[r.ticker].comitentes += 1;
    byTickerSin[r.ticker].diasMax = Math.max(byTickerSin[r.ticker].diasMax, r.dias);
  });
  const sinFechaAgrup = Object.values(byTickerSin).sort((a,b)=>b.totalTen-a.totalTen);

  renderTable('tablaVencSinFecha', sinFechaAgrup, r => {
    const col = TYPE_COLORS[r.tipo] || '#64748b';
    return `<tr>
      <td class="tr" style="text-align:center">${r.comitentes}</td>
      <td><strong>${esc(r.ticker)}</strong></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(r.instrumento)}</td>
      <td><span class="tipo-badge" style="background:${col}22;color:${col}">${esc(r.tipo)}</span></td>
      <td class="tr">${fmtUSD(r.totalTen)}</td>
      <td class="tr">${r.diasMax > 0 ? r.diasMax + 'd' : '--'}</td>
    </tr>`;
  });
}

/* ══════════════════════════════════════════
   CONCENTRACION POR EMISOR
══════════════════════════════════════════ */
function extractEmisor(instrumento, ticker) {
  const inst = instrumento.toUpperCase();
  // Known issuers by keyword
  const emisores = [
    ['YPF','YPF'],['CRESUD','CRESUD'],['PAMPA','PAMPA'],
    ['TELECOM','TELECOM'],['ARCOR','ARCOR'],['BANCO GALICIA','GALICIA'],
    ['MACRO','MACRO'],['SUPERVIELLE','SUPERVIELLE'],['IRSA','IRSA'],
    ['MASTELLONE','MASTELLONE'],['ALBANESI','ALBANESI'],
    ['LOMA NEGRA','LOMA NEGRA'],['ALUAR','ALUAR'],
    ['AEROPUERTOS','AEROPUERTOS'],['TECPETROL','TECPETROL'],
    ['CAPEX','CAPEX'],['MSU','MSU'],['COMPANIA GENERAL','CGPA'],
    ['GENNEIA','GENNEIA'],['EDENOR','EDENOR'],['METROGAS','METROGAS'],
    ['RAGHSA','RAGHSA'],['CONSULTATIO','CONSULTATIO'],
  ];
  for (const [kw, name] of emisores) {
    if (inst.includes(kw)) return name;
  }
  // Fallback: use ticker base (remove trailing O, D, numbers)
  return ticker.replace(/[0-9OD]+$/, '') || ticker;
}


function comiLabel(comiNum, cuenta) {
  // Max 3 words of cuenta name + (N° comitente)
  const words = (cuenta || '').trim().split(/\s+/).slice(0, 3).join(' ');
  if (words && comiNum) return words + ' (' + comiNum + ')';
  return words || comiNum || 'Sin nombre';
}

/* ══════════════════════════════════════════
   POR COMITENTE
══════════════════════════════════════════ */
function renderComitentesView(rows) {
  const cont = id('comitentesList');
  if (!cont) return;

  // Sort comitentes by total tenencia DESC
  const comiTen = {};
  rows.forEach(r => { comiTen[r.comitente] = (comiTen[r.comitente]||0) + r.tenencia; });
  const comis = [...new Set(rows.map(r => r.comitente))].sort((a,b) => comiTen[b] - comiTen[a]);
  if (!comis.length) { cont.innerHTML = '<div class="inline-empty"><p>Sin datos cargados</p></div>'; return; }

  cont.innerHTML = comis.map((comi, idx) => {
    const cRows = rows.filter(r => r.comitente === comi);
    const total = sum(cRows, 'tenencia');
    const conCosto = cRows.filter(r => r.costoEst > 0);
    const res = sum(conCosto, 'resultado');
    const resPct = sum(conCosto, 'costoEst') > 0 ? res / sum(conCosto, 'costoEst') * 100 : null;
    const byTipo = {};
    cRows.forEach(r => { byTipo[r.tipo] = (byTipo[r.tipo]||0) + r.tenencia; });
    const tipoTop = Object.entries(byTipo).sort((a,b)=>b[1]-a[1]);
    const resCls = res >= 0 ? 'green-s' : 'red-s';
    // Use cuenta for name, comiNum for number
    const sampleRow = cRows[0] || {};
    const displayName = comiLabel(sampleRow.comiNum || comi, sampleRow.cuenta);

    return `<div class="comitente-card">
      <div class="comitente-head" onclick="toggleComitente('cc${idx}')">
        <span class="comitente-name">${esc(displayName)}</span>
        <div class="comitente-stats">
          <div class="comitente-stat"><span>Tenencia</span><strong>USD ${fmtUSD(total)}</strong></div>
          <div class="comitente-stat"><span>Posiciones</span><strong>${cRows.length}</strong></div>
          ${resPct !== null ? `<div class="comitente-stat"><span>Resultado</span><strong class="${resCls}">${res>=0?'+':''}${resPct.toFixed(1)}%</strong></div>` : ''}
          <button class="pdf-btn" onclick="event.stopPropagation(); exportPdfComitente('${esc(comi)}','${esc(displayName)}')" title="Exportar PDF">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1.5" y="1" width="10" height="11" rx="1.5" stroke="currentColor" stroke-width="1.1"/><path d="M4 4.5H9M4 6.5H7.5M4 8.5H6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
            PDF
          </button>
          <svg class="chevron" id="ch${idx}" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5L7 9L11 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>
      <div class="comitente-body" id="cc${idx}">
        <div style="display:flex;gap:16px;margin-bottom:14px;flex-wrap:wrap;">
          ${tipoTop.map(([t,v]) => {
            const col = TYPE_COLORS[t]||'#64748b';
            return `<div style="display:flex;align-items:center;gap:6px;font-size:12px;">
              <div style="width:8px;height:8px;border-radius:50%;background:${col}"></div>
              <span style="color:var(--text2)">${esc(t)}</span>
              <span style="font-family:'DM Mono',monospace;color:var(--text)">${(v/total*100).toFixed(0)}%</span>
            </div>`;
          }).join('')}
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Ticker</th><th>Instrumento</th><th>Tipo</th><th class="tr">Tenencia</th><th class="tr">Rend.%</th><th class="tr">% cartera</th></tr></thead>
            <tbody>
              ${[...cRows].sort((a,b)=>b.tenencia-a.tenencia).map(r => {
                const col = TYPE_COLORS[r.tipo]||'#64748b';
                const rc = r.rendPct===null?'':r.rendPct>=0?'pos':'neg';
                return `<tr>
                  <td><strong>${esc(r.ticker)}</strong></td>
                  <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;font-size:11.5px" title="${esc(r.instrumento)}">${esc(r.instrumento)}</td>
                  <td><span class="tipo-badge" style="background:${col}22;color:${col}">${esc(r.tipo)}</span></td>
                  <td class="tr"><strong>${fmtUSD(r.tenencia)}</strong></td>
                  <td class="tr ${rc}">${r.rendPct!==null?(r.rendPct>=0?'+':'')+r.rendPct.toFixed(1)+'%':'--'}</td>
                  <td class="tr">${(r.tenencia/total*100).toFixed(1)}%</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  }).join('');
}


/* ══════════════════════════════════════════
   EXPORTAR PDF POR COMITENTE
══════════════════════════════════════════ */
function exportPdfComitente(comiKey, displayName) {
  const rows = getFiltered();
  const cRows = rows.filter(r => r.comitente === comiKey);
  if (!cRows.length) return;

  const total    = sum(cRows, 'tenencia');
  const conCosto = cRows.filter(r => r.costoEst > 0);
  const res      = sum(conCosto, 'resultado');
  const resPct   = sum(conCosto,'costoEst') > 0 ? res/sum(conCosto,'costoEst')*100 : null;
  const byTipo   = {};
  cRows.forEach(r => { byTipo[r.tipo]=(byTipo[r.tipo]||0)+r.tenencia; });
  const tipoEntries = Object.entries(byTipo).sort((a,b)=>b[1]-a[1]);
  const hoy = new Date().toLocaleDateString('es-AR', {day:'2-digit',month:'long',year:'numeric'});
  const EXCLUIR_LIQ = new Set(['U$S','U$SCV7000','$']);

  // Composicion bars HTML
  const compBars = tipoEntries.map(([t,v]) => {
    const col = TYPE_COLORS[t] || '#888';
    const pct = (v/total*100).toFixed(1);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <div style="width:130px;font-size:11px;color:#444">${t}</div>
      <div style="flex:1;height:8px;background:#eee;border-radius:99px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${col};border-radius:99px"></div>
      </div>
      <div style="width:50px;text-align:right;font-size:11px;font-family:monospace">USD ${fmtUSD(v)}</div>
      <div style="width:38px;text-align:right;font-size:11px;color:#888">${pct}%</div>
    </div>`;
  }).join('');

  // Positions table rows
  const posRows = [...cRows].sort((a,b)=>b.tenencia-a.tenencia).map(r => {
    const rendStr = r.rendPct !== null ? (r.rendPct>=0?'+':'')+r.rendPct.toFixed(1)+'%' : '—';
    const rendCol = r.rendPct === null ? '#888' : r.rendPct >= 0 ? '#16a34a' : '#dc2626';
    const pctCart = (r.tenencia/total*100).toFixed(1);
    return `<tr>
      <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;font-weight:600">${esc(r.ticker)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0;font-size:10.5px;color:#555;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.instrumento)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0;font-size:10.5px;color:#666">${esc(r.tipo)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;text-align:right;font-family:monospace">USD ${fmtUSD(r.tenencia)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;text-align:right;color:${rendCol};font-family:monospace">${rendStr}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;text-align:right;color:#888">${pctCart}%</td>
    </tr>`;
  }).join('');

  // Alertas de liquidez
  const liqRows = cRows.filter(r => ['Pesos','Dolares/Efectivo','FCI Liquidez'].includes(r.tipo));
  const alertasHTML = liqRows.length ? `
    <div style="margin-top:20px;padding:12px 16px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px">
      <div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:6px;text-transform:uppercase">Liquidez ociosa</div>
      ${liqRows.map(r=>`<div style="font-size:11px;color:#78350f;margin-bottom:3px">
        · ${esc(r.ticker)} — ${esc(r.tipo)} — USD ${fmtUSD(r.tenencia)} — ${r.dias > 0 ? r.dias+'d en posicion' : 'sin datos de días'}
      </div>`).join('')}
    </div>` : '';

  // Vencimientos proximos
  const RENTA_FIJA = ['Obligaciones Negociables','Bonos Soberanos USD','Bonos CER',
    'Bonos Nacion $','Bonos Provinciales','BOPREAL','Letras','Treasuries'];
  const hoyDate = new Date();
  const vencProx = cRows.filter(r => RENTA_FIJA.includes(r.tipo)).map(r => {
    const fv = extractFechaVto(r.instrumento, r.ticker);
    return fv ? { ticker:r.ticker, instrumento:r.instrumento, fechaVto:fv, dias: Math.round((fv-hoyDate)/86400000) } : null;
  }).filter(r => r && r.dias >= 0 && r.dias <= 365).sort((a,b)=>a.dias-b.dias);

  const vencHTML = vencProx.length ? `
    <div style="margin-top:20px;padding:12px 16px;background:#fef2f2;border-left:3px solid #f43f5e;border-radius:4px">
      <div style="font-size:11px;font-weight:700;color:#991b1b;margin-bottom:6px;text-transform:uppercase">Vencimientos proximos (12 meses)</div>
      ${vencProx.map(r=>`<div style="font-size:11px;color:#7f1d1d;margin-bottom:3px">
        · ${esc(r.ticker)} — vence ${r.fechaVto.toLocaleDateString('es-AR')} — en ${r.dias} dias
      </div>`).join('')}
    </div>` : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Reporte ${esc(displayName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 32px 40px; font-size: 12px; }
  @page { size: A4; margin: 16mm 18mm; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1a1a1a">
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#666;margin-bottom:4px">Reporte de cartera</div>
      <div style="font-size:22px;font-weight:700;letter-spacing:-0.01em">${esc(displayName)}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:10px;color:#888">Fecha de reporte</div>
      <div style="font-size:13px;font-weight:600">${hoy}</div>
    </div>
  </div>

  <div style="display:flex;gap:20px;margin-bottom:24px">
    <div style="flex:1;padding:14px 16px;background:#f8f9fa;border-radius:8px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:4px">Tenencia total</div>
      <div style="font-size:22px;font-weight:700;font-family:monospace">USD ${fmtUSD(total)}</div>
    </div>
    <div style="flex:1;padding:14px 16px;background:#f8f9fa;border-radius:8px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:4px">Posiciones</div>
      <div style="font-size:22px;font-weight:700">${cRows.length}</div>
    </div>
    <div style="flex:1;padding:14px 16px;background:${res>=0?'#f0fdf4':'#fef2f2'};border-radius:8px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:4px">Resultado estimado</div>
      <div style="font-size:22px;font-weight:700;font-family:monospace;color:${res>=0?'#16a34a':'#dc2626'}">
        ${resPct !== null ? (resPct>=0?'+':'')+resPct.toFixed(1)+'%' : '—'}
      </div>
    </div>
  </div>

  <div style="margin-bottom:24px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e0e0e0">Composicion por tipo de activo</div>
    ${compBars}
  </div>

  <div style="margin-bottom:20px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e0e0e0">Detalle de posiciones</div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f4f4f4">
          <th style="padding:8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#666">Ticker</th>
          <th style="padding:8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#666">Instrumento</th>
          <th style="padding:8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#666">Tipo</th>
          <th style="padding:8px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#666">Tenencia</th>
          <th style="padding:8px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#666">Rend.%</th>
          <th style="padding:8px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#666">% cartera</th>
        </tr>
      </thead>
      <tbody>${posRows}</tbody>
    </table>
  </div>

  ${alertasHTML}
  ${vencHTML}

  <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e0e0e0;font-size:9.5px;color:#aaa;text-align:center">
    Reporte generado el ${hoy} · Los resultados son estimados basados en precio de compra vs tenencia actual · No constituye asesoramiento financiero
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

function toggleComitente(id_) {
  const body = id(id_);
  const idx  = id_.replace('cc','');
  const chev = id('ch' + idx);
  if (!body) return;
  const open = body.classList.toggle('open');
  if (chev) chev.classList.toggle('open', open);
}

/* ══════════════════════════════════════════
   MOVIMIENTOS ENTRE PERIODOS
══════════════════════════════════════════ */
function renderMovimientosView() {
  const emptyEl   = id('movimientosEmpty');
  const contentEl = id('movimientosContent');
  if (!emptyEl || !contentEl) return;

  if (STATE.historico.length < 2) {
    emptyEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    id('badgeMov')?.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  // Populate periodo selector — compare each period vs previous
  const sel = id('filtroPeriodoMov');
  if (sel) {
    const prev = sel.value;
    sel.innerHTML = STATE.historico.slice(1).map((p, i) =>
      `<option value="${i+1}">${esc(STATE.historico[i].label)} → ${esc(p.label)}</option>`
    ).join('');
    // Default to last comparison
    if (!prev || !sel.querySelector(`option[value="${prev}"]`)) {
      sel.value = STATE.historico.length - 1;
    }
  }

  renderMovimientosDetalle();
}

function agruparPorTicker(rows, modo) {
  const m = {};
  rows.forEach(r => {
    const t = r.ticker;
    if (!m[t]) m[t] = { ticker:t, instrumento:r.instrumento, tipo:r.tipo, tenencia:0, tenAnt:0, diff:0, nomAnt:0, nomActual:0, count:0 };
    m[t].tenencia   += r.tenencia   || 0;
    m[t].tenAnt     += r.tenAnt     || 0;
    m[t].diff       += r.diff       || 0;
    m[t].nomAnt     += r.nomAnt     || 0;
    m[t].nomActual  += r.nomActual  || 0;
    m[t].count      += 1;
  });
  const arr = Object.values(m);
  if (modo === 'crecio') arr.sort((a,b) => b.diff - a.diff);
  else if (modo === 'cayo') arr.sort((a,b) => a.diff - b.diff);
  else arr.sort((a,b) => b.tenencia - a.tenencia);
  return arr;
}

function renderMovimientosDetalle() {
  const sel = id('filtroPeriodoMov');
  if (!sel || STATE.historico.length < 2) return;

  const idx  = parseInt(sel.value) || STATE.historico.length - 1;
  const curr = STATE.historico[idx];
  const prev = STATE.historico[idx - 1];
  if (!curr || !prev) return;

  const rowsCurr = curr.rows.map(r => typeof r.tipo !== 'undefined' ? r : { ...r, tipo: inferTipo(r.instrumento||'', r.ticker||'', false, r.comitente||'') });
  const rowsPrev = prev.rows.map(r => typeof r.tipo !== 'undefined' ? r : { ...r, tipo: inferTipo(r.instrumento||'', r.ticker||'', false, r.comitente||'') });

  const key = r => `${r.comitente}|${r.ticker}`;
  const mapP = new Map(rowsPrev.map(r => [key(r), r]));
  const mapC = new Map(rowsCurr.map(r => [key(r), r]));

  const nuevas   = rowsCurr.filter(r => !mapP.has(key(r)));
  const cerradas = rowsPrev.filter(r => !mapC.has(key(r)));
  const comunes  = rowsCurr.filter(r => mapP.has(key(r))).map(r => {
    const prev = mapP.get(key(r));
    // Use nominales for movement detection (price-independent)
    const nomActual = r.nominales || 0;
    const nomAnt    = prev.nominales || 0;
    const diffNom   = nomActual - nomAnt;
    return { ...r, tenAnt: prev.tenencia, nomAnt, nomActual, diff: diffNom, diffTen: r.tenencia - prev.tenencia };
  });
  // Net by ticker across all clients
  const netByTicker = {};
  comunes.forEach(r => {
    const t = r.ticker;
    if (!netByTicker[t]) netByTicker[t] = { ticker:t, instrumento:r.instrumento, tipo:r.tipo, nomAnt:0, nomActual:0, diff:0, tenencia:0, tenAnt:0 };
    netByTicker[t].nomAnt    += r.nomAnt    || 0;
    netByTicker[t].nomActual += r.nomActual || 0;
    netByTicker[t].diff      += r.diff      || 0;
    netByTicker[t].tenencia  += r.tenencia  || 0;
    netByTicker[t].tenAnt    += r.tenAnt    || 0;
  });
  const netted = Object.values(netByTicker).filter(r => r.diff !== 0);
  const crecieron = netted.filter(r => r.diff > 0).sort((a,b) => b.diff - a.diff);
  const cayeron   = netted.filter(r => r.diff < 0).sort((a,b) => a.diff - b.diff);

  const totalDelta = sum(rowsCurr,'tenencia') - sum(rowsPrev,'tenencia');

  setText('movNuevas',   nuevas.length.toString());
  setText('movCerradas', cerradas.length.toString());
  setText('movDelta',    (totalDelta>=0?'+':'')+fmtUSD(totalDelta));
  setText('movPeriodos', (prev.label||'') + ' → ' + (curr.label||''));

  const badge = id('badgeMov');
  if (badge) { const total = crecieron.length + cayeron.length; badge.textContent = total; badge.classList.toggle('hidden', total === 0); }

  // Agrupar nuevas por ticker
  // crecieron/cayeron already netted by ticker

  const movRowAgrup = r => {
    const col = TYPE_COLORS[r.tipo]||'#64748b';
    const diffNom = r.diff ?? 0;
    const cls  = diffNom >= 0 ? 'pos' : 'neg';
    const pctNom = r.nomAnt ? diffNom/r.nomAnt*100 : null;
    return `<tr>
      <td><strong>${esc(r.ticker)}</strong></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(r.instrumento)}</td>
      <td><span class="tipo-badge" style="background:${col}22;color:${col}">${esc(r.tipo)}</span></td>
      <td class="tr">${fmtNum(r.nomAnt)}</td>
      <td class="tr"><strong>${fmtNum(r.nomActual)}</strong></td>
      <td class="tr ${cls}"><strong>${diffNom>=0?'+':''}${fmtNum(diffNom)}</strong></td>
      <td class="tr ${cls}">${pctNom!==null?(pctNom>=0?'+':'')+pctNom.toFixed(1)+'%':'--'}</td>
    </tr>`;
  };


  renderTable('tablaMovCrecieron', crecieron, movRowAgrup);
  renderTable('tablaMovCayeron',   cayeron,   movRowAgrup);
}

/* ══════════════════════════════════════════
   LIQUIDEZ OCIOSA — pestaña
══════════════════════════════════════════ */
function renderLiquidezOciosa(rows) {
  const cont = id('liquidezContainer');
  if (!cont) return;

  const TIPOS_LIQ = ['Pesos','Dolares/Efectivo','FCI Liquidez'];
  const liqRows = rows.filter(r => TIPOS_LIQ.includes(r.tipo));

  const badge = id('badgeLiquidez');
  if (badge) {
    const urgentes = liqRows.filter(r => (r.tipo==='Pesos'&&r.dias>7)||(r.tipo==='Dolares/Efectivo'&&r.dias>7)||(r.tipo==='FCI Liquidez'&&r.dias>30));
    badge.classList.toggle('hidden', urgentes.length===0);
  }

  if (!liqRows.length) {
    cont.innerHTML = '<div class="inline-empty"><p>No se detectaron saldos liquidos en la cartera actual.</p></div>';
    return;
  }

  const totalPesos = sum(liqRows.filter(r=>r.tipo==='Pesos'), 'tenencia');
  const totalDols  = sum(liqRows.filter(r=>r.tipo==='Dolares/Efectivo'), 'tenencia');
  const totalMM    = sum(liqRows.filter(r=>r.tipo==='FCI Liquidez'), 'tenencia');
  const totalLiq   = totalPesos + totalDols + totalMM;

  // Group by tipo for summary
  const byTipo = {};
  liqRows.forEach(r => { byTipo[r.tipo] = (byTipo[r.tipo]||0) + r.tenencia; });

  cont.innerHTML = `
    <div class="kpi-mini-row" style="margin-bottom:16px;">
      <div class="kpi-mini-card accent-r"><span>Total liquidez ociosa</span><strong class="mono">USD ${fmtUSD(totalLiq)}</strong></div>
      <div class="kpi-mini-card"><span>Saldo en Pesos</span><strong class="mono">USD ${fmtUSD(totalPesos)}</strong></div>
      <div class="kpi-mini-card"><span>Saldo en Dolares</span><strong class="mono">USD ${fmtUSD(totalDols)}</strong></div>
      <div class="kpi-mini-card accent-a"><span>Money Market</span><strong class="mono">USD ${fmtUSD(totalMM)}</strong></div>
    </div>

    <div class="panel-card" style="margin-bottom:12px;">
      <div class="panel-head"><h2>Saldos en Pesos</h2><span class="panel-note">Dinero parado que pierde vs inflacion — actuar</span></div>
      ${buildLiqTable(liqRows.filter(r=>r.tipo==='Pesos'),'Pesos')}
    </div>

    <div class="panel-card" style="margin-bottom:12px;">
      <div class="panel-head"><h2>Saldos en Dolares / Efectivo</h2><span class="panel-note">USD sin rendimiento — evaluar ON, Treasury o FCI USD</span></div>
      ${buildLiqTable(liqRows.filter(r=>r.tipo==='Dolares/Efectivo'),'USD')}
    </div>

    <div class="panel-card">
      <div class="panel-head"><h2>Money Market</h2><span class="panel-note">Posiciones con dias prolongados — evaluar rotar a mayor rendimiento</span></div>
      ${buildLiqTable(liqRows.filter(r=>r.tipo==='FCI Liquidez'),'MM')}
    </div>`;
}

function buildLiqTable(rows, tipo) {
  if (!rows.length) return '<p style="padding:16px;color:var(--text3);font-size:12px">Sin posiciones en esta categoria</p>';

  const sorted = [...rows].sort((a,b) => b.tenencia - a.tenencia);
  const urgentDias = tipo === 'MM' ? 30 : 7;

  return `<div class="table-wrap">
    <table>
      <thead><tr>
        <th>Comitente</th>
        <th>Ticker</th>
        <th>Instrumento</th>
        <th class="tr">Tenencia USD</th>
        <th class="tr">Dias en posicion</th>
        <th class="tc">Urgencia</th>
      </tr></thead>
      <tbody>
        ${sorted.map(r => {
          const urgent = r.dias > urgentDias;
          const cls = urgent ? 'venc-rojo' : r.dias > urgentDias/2 ? 'venc-ambar' : 'venc-verde';
          const label = urgent ? 'Actuar' : r.dias > urgentDias/2 ? 'Revisar' : 'OK';
          return `<tr>
            <td>${esc(r.comitente)}</td>
            <td><strong>${esc(r.ticker)}</strong></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${esc(r.instrumento)}">${esc(r.instrumento)}</td>
            <td class="tr"><strong>${fmtUSD(r.tenencia)}</strong></td>
            <td class="tr">${r.dias > 0 ? r.dias + 'd' : '--'}</td>
            <td class="tc"><span class="venc-badge ${cls}">${label}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
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
