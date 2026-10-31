// ===================== ESTADO Y CONEXIÓN A SUPABASE =====================
var SUPABASE_URL = 'https://ssfbamnomyjkuixqzxok.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzZmJhbW5vbXlqa3VpeHF6eG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTU5MzEsImV4cCI6MjEwODk3MTkzMX0.6RX4y2yPr4JJT5V9iWf9231ajal6BD5oefTmJgQOhMA';
var sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

var STATE = { centros: [], categorias: [], subcategorias: [], movimientos: [], vencimientos: [], vencRecurrentes: [], vencDraft: null, usdtMovimientos: [], movimientosUsd: [], deudas: [], facturas: [], configuracion: [], facturaLoadingId:null, activeTab: 'resumen', editing: null, ready:false,
  importEntidad:'mp', importBanco:'nacion', importVencimiento:'', importTarjetaMarca:'', importRaw:'', importPreview:null, importPreviewExcel:null, importMsg:null,
  bulkColorCatMsg:null, bulkColorCatAbierto:false, confirmState:null, subDeleteState:null, vencPagarState:null, movFormMsg:null, movFieldErrors:null,
  filtros:{centro:[], categoria:[], subcategoria:[], mes:[], texto:'', soloIncompletos:false, soloTarjeta:false},
  resumenFiltros:{centro:[], categoria:[], mes:[fechaHoyISO().slice(0,7)], vista:'categoria'}, multiSelectAbierto:null, multiSelectBusqueda:'', abmSubTab:'categorias', grillaRango:'3m',
  vencFormMsg:null, vrecFormMsg:null, dbError:null, saldosCache:null, saldosDirty:true,
  usuarioEmail:null, efectivoAbierto:false, efectivoMsg:null, efectivoCategoriaId:'', efectivoDraft:null, backupMsg:null, menuMovilAbierto:false, incompletosSnapshotIds:null,
  usdtVentaMovId:null, usdtVentaMovMsg:null, usdtVentaMovCantidad:'',
  reglas: [], reglaFormMsg:null, reglasPaginaActual:1, reglasPorPagina:leerTamPagina('controlReglasPorPagina', [15,30,50,100], 15), movPorPagina:leerTamPagina('controlMovPorPagina', [25,50,100,200], 50),
  nuevoMovAbierto:false, movDraftCentroDestinoId:'', comboAbierto:null, comboBusqueda:'', comboHighlight:0,
  movSeleccionados:[], bulkEditMovAbierto:false, bulkEditMovMsg:null, movPaginaActual:1, gruposAbiertos:{},
  tema: (function(){ try{ return localStorage.getItem('controlTema')==='oscuro' ? 'oscuro' : 'claro'; }catch(e){ return 'claro'; } })(),
  temaColor: (function(){ try{ var c = localStorage.getItem('controlTemaColor'); return (c==='azul'||c==='naranja') ? c : 'verde'; }catch(e){ return 'verde'; } })(),
  menuUsuarioAbierto:false, usdtFormMsg:null, usdtDraft:null, usdtIngresoOpcionalesAbierto:false,
  // Multi-familia (ver docs/MULTI-FAMILIA.md): el superadmin ve todas las familias en solo lectura, de a una
  // (la elegida en el selector); un usuario sin familia no ve la app.
  esSuperadmin:false, soloLectura:false, sinFamilia:false, familias:[], familiaSeleccionadaId:null,
  adminMiembros:[], adminMiembrosError:null, backupArchivo:null, backupFamiliaRestaurar:'',
  configCatalogo:[], configMsg:null,
  miembrosFamilia:[], // usuarios de la familia (D5: titulares de los centros), [{userId, nombre}]
  importadores:[], importadoresOcultos:[], importadoresMsg:null, // D7
  usdtCotizacionBid:null, usdtCotizacionActualizada:null, usdtCotizacionError:null, usdtCotizacionCargando:false,
  dolaresDraft:null, dolaresFormMsg:null, dolarBlueCompra:null, dolarBlueVenta:null, dolarBlueActualizada:null, dolarBlueError:null, dolarBlueCargando:false,
  deudaFormMsg:null, flujoVentana:'6m', flujoHorizonte:12, filtrosMovAbiertos:false };
var MOV_PAGE_SIZE = 50;
var REGLAS_PAGE_SIZE = 15;
// Cantidad de registros por página elegible desde el paginador; se recuerda en el navegador.
var OPCIONES_POR_PAGINA_MOV = [25, 50, 100, 200];
var OPCIONES_POR_PAGINA_REGLAS = [15, 30, 50, 100];
function leerTamPagina(clave, opciones, porDefecto){
  try{
    var n = parseInt(localStorage.getItem(clave), 10);
    if(opciones.indexOf(n) !== -1) return n;
  }catch(e){}
  return porDefecto;
}
function guardarTamPagina(clave, n){ try{ localStorage.setItem(clave, String(n)); }catch(e){} }
function selectorPorPagina(id, opciones, actual){
  return '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-soft)">Por página '+
    '<select id="'+id+'" style="width:auto;padding:4px 8px;font-size:12px">'+
    opciones.map(function(n){ return '<option value="'+n+'"'+(n===actual?' selected':'')+'>'+n+'</option>'; }).join('')+
    '</select></label>';
}

// ===================== FILTROS MÚLTIPLES (selects convertidos a checkboxes) =====================
var MULTISELECT_MAP = {
  'ff-centro': {store:'filtros', field:'centro'},
  'ff-categoria': {store:'filtros', field:'categoria'},
  'ff-subcategoria': {store:'filtros', field:'subcategoria'},
  'ff-mes': {store:'filtros', field:'mes'},
  'rf-centro': {store:'resumenFiltros', field:'centro'},
  'rf-categoria': {store:'resumenFiltros', field:'categoria'},
  'rf-mes': {store:'resumenFiltros', field:'mes'}
};
function arrayFiltro(msId){
  var map = MULTISELECT_MAP[msId];
  if(!map) return [];
  var obj = STATE[map.store];
  if(!obj[map.field]) obj[map.field] = [];
  return obj[map.field];
}
function toggleMultiSelectValor(msId, valor, marcado){
  var arr = arrayFiltro(msId);
  var idx = arr.indexOf(valor);
  if(marcado && idx===-1) arr.push(valor);
  else if(!marcado && idx!==-1) arr.splice(idx,1);
  if(MULTISELECT_MAP[msId] && MULTISELECT_MAP[msId].store==='filtros') STATE.movPaginaActual = 1;
  if(msId==='ff-categoria' && STATE.filtros.categoria.length){
    // podar de la selección de Subcategoría las que ya no pertenecen a ninguna categoría elegida
    var catArr = STATE.filtros.categoria;
    STATE.filtros.subcategoria = (STATE.filtros.subcategoria||[]).filter(function(v){
      if(v==='__vacio__') return true;
      var s = STATE.subcategorias.find(function(x){return x.id===v;});
      return s && catArr.indexOf(s.categoriaId)!==-1;
    });
  }
}
function renderMultiSelect(id, options, seleccion){
  var abierto = STATE.multiSelectAbierto === id;
  var resumen;
  if(!seleccion.length) resumen = 'Todos';
  else if(seleccion.length===1){
    var opt = options.find(function(o){ return o.value===seleccion[0]; });
    resumen = opt ? opt.label : '1 seleccionado';
  } else resumen = seleccion.length+' seleccionados';

  var panelHtml = '';
  if(abierto){
    var q = (STATE.multiSelectBusqueda||'').trim().toLowerCase();
    var visibles = q ? options.filter(function(o){ return o.label.toLowerCase().indexOf(q)!==-1; }) : options;
    var itemsHtml = visibles.map(function(o){
      var checked = seleccion.indexOf(o.value)!==-1;
      return '<label class="multiselect-item"><input type="checkbox" data-multiselect="'+id+'" value="'+esc(o.value)+'" '+(checked?'checked':'')+'>'+esc(o.label)+'</label>';
    }).join('');
    panelHtml = ''+
      '<div class="multiselect-panel">'+
        (options.length ? '<input type="text" id="ms-buscar-'+id+'" class="multiselect-search" placeholder="Buscar..." value="'+esc(STATE.multiSelectBusqueda||'')+'" autocomplete="off">' : '')+
        (options.length ? '<div class="multiselect-panel-actions"><button type="button" class="link" data-action="multiselect-limpiar" data-id="'+id+'">Limpiar</button></div>' : '')+
        '<div class="multiselect-list">'+(itemsHtml || '<div class="empty" style="padding:6px 4px">'+(q?'Sin resultados.':'Sin opciones.')+'</div>')+'</div>'+
      '</div>';
  }
  return '<div class="multiselect'+(abierto?' abierto':'')+'" data-multiselect-wrap="'+id+'">'+
    '<button type="button" class="multiselect-toggle" data-action="toggle-multiselect" data-id="'+id+'">'+esc(resumen)+' <span class="multiselect-caret">▾</span></button>'+
    panelHtml+
  '</div>';
}

// ===================== MENÚ DE USUARIO (avatar arriba a la derecha) =====================
function inicialesUsuario(){
  var email = STATE.usuarioEmail || '';
  var nombre = (email.split('@')[0] || '').replace(/[^a-zA-Zá-úÁ-Ú]+/g, ' ').trim();
  var partes = nombre.split(/\s+/).filter(Boolean);
  var iniciales = partes.length >= 2 ? (partes[0][0] + partes[1][0]) : nombre.slice(0, 2);
  return (iniciales || '?').toUpperCase();
}
// Se renderiza tanto en la barra superior de escritorio como en la de mobile (misma marca
// data-user-menu-wrap, mismo STATE.menuUsuarioAbierto) — solo una de las dos queda visible
// según el ancho de pantalla, pero conviene que las dos compartan el mismo estado.
function renderMenuUsuario(){
  var abierto = STATE.menuUsuarioAbierto;
  var panelHtml = '';
  if(abierto){
    var coloresTema = [
      {id:'verde', nombre:'Verde', hex:'#2F9E6E'},
      {id:'azul', nombre:'Azul', hex:'#2F6FE0'},
      {id:'naranja', nombre:'Naranja', hex:'#E0722F'}
    ];
    var swatchesHtml = coloresTema.map(function(c){
      var activo = (STATE.temaColor||'verde')===c.id;
      return '<button type="button" class="color-swatch'+(activo?' activo':'')+'" data-action="set-tema-color" data-id="'+c.id+'" style="background:'+c.hex+'" title="'+c.nombre+'" aria-label="Tema '+c.nombre+'" aria-pressed="'+activo+'"></button>';
    }).join('');
    panelHtml = '<div class="user-menu-panel">'+
      (STATE.usuarioEmail ? '<div class="user-menu-email">'+esc(STATE.usuarioEmail)+'</div>' : '')+
      '<div class="user-menu-label">Color</div>'+
      '<div class="user-menu-colores">'+swatchesHtml+'</div>'+
      '<button type="button" class="user-menu-item" data-action="toggle-tema">'+(STATE.tema==='oscuro'?'<i class="bi bi-sun"></i> Modo claro':'<i class="bi bi-moon-stars"></i> Modo oscuro')+'</button>'+
      '<button type="button" class="user-menu-item" data-action="cerrar-sesion">Cerrar sesión</button>'+
    '</div>';
  }
  return '<div class="user-menu-wrap'+(abierto?' abierto':'')+'" data-user-menu-wrap>'+
    '<button type="button" class="avatar-btn" data-action="toggle-menu-usuario" aria-label="Cuenta" title="'+esc(STATE.usuarioEmail||'')+'">'+esc(inicialesUsuario())+'</button>'+
    panelHtml+
  '</div>';
}

// ===================== COMBOBOX (select con buscador y autocompletado) =====================
// Se usa en el formulario de Movimiento (Centro/Categoría/Subcategoría/Centro Destino). Mantiene
// un <input type="hidden"> con el value real (para no tocar el código que ya lee esos ids) y un
// <input type="text"> visible que al escribir filtra las opciones. Con la lista filtrada abierta,
// Enter o Tab confirman la opción resaltada (por defecto la primera) y Tab sigue al próximo campo.
// Etiqueta vacía a propósito: si no hay selección, el input debe verse vacío (con el placeholder
// gris nativo), no mostrar literalmente el texto "Elegir..." como si fuera lo tipeado.
// Excepción para Subcategoría: si lo tipeado no matchea ninguna opción de la categoría elegida,
// confirmar (Enter/Tab/blur) da de alta esa subcategoría al vuelo — ver obtenerOCrearSubcategoriaId.
function comboOpcionVacia(){ return {value:'', label:''}; }
function filtrarOpcionesCombo(options, query){
  var q = (query||'').trim().toLowerCase();
  if(!q) return options;
  return options.filter(function(o){ return o.label.toLowerCase().indexOf(q)!==-1; });
}
function renderCombo(comboId, hiddenId, options, valorSeleccionado, placeholder){
  var abierto = STATE.comboAbierto === comboId;
  var seleccionado = options.find(function(o){ return o.value===(valorSeleccionado||''); });
  var etiquetaActual = seleccionado ? seleccionado.label : '';
  var query = abierto ? (STATE.comboBusqueda||'') : '';
  var valorVisible = abierto ? query : etiquetaActual;
  var panelHtml = '';
  if(abierto){
    var visibles = filtrarOpcionesCombo(options, query);
    var itemsHtml = visibles.map(function(o, i){
      return '<div class="combo-item'+(i===STATE.comboHighlight?' resaltado':'')+'" data-value="'+esc(o.value)+'">'+(o.label?esc(o.label):'<span style="color:var(--ink-soft)">(vacío)</span>')+'</div>';
    }).join('');
    var mensajeSinResultados = (comboId==='mov-subcategoria' && query.trim())
      ? 'Sin resultados. Presioná Enter para crear "'+esc(query.trim())+'".'
      : 'Sin resultados.';
    panelHtml = '<div class="combo-panel"><div class="combo-list">'+(itemsHtml || '<div class="empty" style="padding:6px 4px">'+mensajeSinResultados+'</div>')+'</div></div>';
  }
  return '<div class="combo'+(abierto?' abierto':'')+'" data-combo-wrap="'+comboId+'">'+
    '<input type="hidden" id="'+hiddenId+'" value="'+esc(valorSeleccionado||'')+'">'+
    '<input type="text" class="combo-input" id="'+comboId+'-input" data-combo-id="'+comboId+'" autocomplete="off" placeholder="'+esc(placeholder||'Elegir...')+'" value="'+esc(valorVisible)+'">'+
    panelHtml+
  '</div>';
}
// Busca (o crea) la subcategoría de la categoría actualmente elegida en el formulario de
// Movimiento a partir de un texto tipeado que no matcheó ninguna opción existente del combo.
// Se usa cuando el usuario tipea un nombre nuevo y confirma (Enter/Tab/blur): en vez de perder
// lo tipeado, se da de alta la subcategoría al vuelo, igual que ya pasa al importar movimientos.
async function obtenerOCrearSubcategoriaId(nombreTexto){
  var categoriaId = (document.getElementById('f-mov-categoria')||{}).value || '';
  if(!categoriaId) return null;
  var existente = STATE.subcategorias.find(function(s){
    return s.categoriaId===categoriaId && s.nombre.toLowerCase()===nombreTexto.toLowerCase();
  });
  if(existente) return existente.id;
  var nueva = {id:uid(), categoriaId:categoriaId, nombre:nombreTexto};
  try{
    await dbInsert('subcategorias', toDbSubcategoria(nueva));
    STATE.subcategorias.push(nueva);
    return nueva.id;
  }catch(e){
    STATE.dbError = 'No se pudo crear la subcategoría: '+(e.message||e);
    return null;
  }
}
// Aplica la opción elegida en un combo del formulario de Movimiento al draft correspondiente.
function aplicarSeleccionCombo(comboId, valor){
  // Siempre se sincroniza todo el draft del formulario (no solo el campo que cambia): Fecha,
  // Proveedor, Detalle, Monto, etc. no tienen listener propio, así que si no los capturamos acá
  // antes de re-renderizar, un re-render disparado por el combo los pisaría con el valor en blanco.
  var draft = getMovFormValues();
  if(comboId==='mov-centro-destino'){ STATE.movDraftCentroDestinoId = valor; STATE.movDraft = draft; return; }
  if(comboId==='mov-centro') draft.centroId = valor;
  else if(comboId==='mov-categoria'){ draft.categoriaId = valor; draft.subcategoriaId = ''; }
  else if(comboId==='mov-subcategoria') draft.subcategoriaId = valor;
  STATE.movDraft = draft;
}
// Lee del DOM ya renderizado cuál es la opción resaltada (o la primera visible) del combo abierto.
function comboValorResaltadoDOM(comboId){
  var wrap = document.querySelector('[data-combo-wrap="'+comboId+'"]');
  if(!wrap) return null;
  var item = wrap.querySelector('.combo-item.resaltado') || wrap.querySelector('.combo-item');
  return item ? item.getAttribute('data-value') : null;
}
function moverResaltadoCombo(comboId, delta){
  var wrap = document.querySelector('[data-combo-wrap="'+comboId+'"]');
  var total = wrap ? wrap.querySelectorAll('.combo-item').length : 0;
  if(!total) return;
  STATE.movDraft = getMovFormValues(); // ver el porqué en aplicarSeleccionCombo
  STATE.comboHighlight = ((STATE.comboHighlight + delta) % total + total) % total;
  render();
}
// Id del próximo campo tabulable dentro del mismo modal/tarjeta, calculado ANTES de re-renderizar
// (se usa para reenfocar "a mano" tras un Tab en un combo, ver el porqué en el keydown de abajo).
function idSiguienteFocuseable(elementoActual){
  var contenedor = elementoActual.closest('.modal-card') || elementoActual.closest('.card') || document;
  var lista = Array.prototype.slice.call(contenedor.querySelectorAll('input, select, textarea, button')).filter(function(x){
    return x.type !== 'hidden' && !x.disabled;
  });
  var idx = lista.indexOf(elementoActual);
  var siguiente = idx > -1 ? lista[idx+1] : null;
  return siguiente && siguiente.id ? siguiente.id : null;
}
// Cierra el combo abierto. Si forzar es true (Enter, click en una opción) confirma siempre la
// opción resaltada; si no (blur / Tab), solo confirma cuando el usuario efectivamente tipeó algo
// para filtrar — así tabular por el campo sin tocarlo no pisa el valor que ya tenía cargado.
async function finalizarCombo(comboId, forzar){
  if(STATE.comboAbierto !== comboId) return;
  if(forzar || STATE.comboBusqueda){
    var valor = comboValorResaltadoDOM(comboId);
    if(valor === null && comboId==='mov-subcategoria' && STATE.comboBusqueda.trim()){
      valor = await obtenerOCrearSubcategoriaId(STATE.comboBusqueda.trim());
    }
    if(valor !== null) aplicarSeleccionCombo(comboId, valor);
  } else {
    STATE.movDraft = getMovFormValues(); // cerrar sin confirmar nada igual dispara un render: ver aplicarSeleccionCombo
  }
  STATE.comboAbierto = null; STATE.comboBusqueda = ''; STATE.comboHighlight = 0;
  render();
}

function uid(){
  if(window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
    var r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
    return v.toString(16);
  });
}

// ---- Mapeo entre el modelo JS (camelCase) y las columnas de Supabase (snake_case) ----
// "moneda" solo se manda cuando no es la default ('ARS'): así la app sigue guardando bien aunque
// todavía no se haya corrido migracion_dolares.sql (la columna nueva no existiría).
function toDbCentro(c){
  var r = {id:c.id, codigo:c.codigo, nombre:c.nombre, color:c.color||null, color_texto:c.colorTexto||null, entidad:c.entidad||null, titular_id:c.titularId||null};
  if(monedaCentro(c)!=='ARS') r.moneda = monedaCentro(c);
  return r;
}
function fromDbCentro(r){ return {id:r.id, codigo:r.codigo, nombre:r.nombre, color:r.color||'', colorTexto:r.color_texto||'', entidad:r.entidad||'', moneda:(r.moneda==='USD'||r.moneda==='AMBAS')?r.moneda:'ARS', titularId:r.titular_id||''}; }
function fromDbMiembro(r){ return {userId:r.user_id, nombre:r.nombre||''}; }
// Moneda de un Centro de Costo: 'ARS' (solo pesos), 'USD' (solo dólares) o 'AMBAS' (misma cuenta,
// un saldo en pesos y otro en dólares).
function monedaCentro(c){ return c && (c.moneda==='USD' || c.moneda==='AMBAS') ? c.moneda : 'ARS'; }
function centroAdmitePesos(c){ return monedaCentro(c)!=='USD'; }
function centroAdmiteDolares(c){ return monedaCentro(c)!=='ARS'; }
function toDbCategoria(c){ return {id:c.id, nombre:c.nombre, tipo:c.tipo||null, color:c.color||null, color_texto:c.colorTexto||null}; }
function fromDbCategoria(r){ return {id:r.id, nombre:r.nombre, tipo:r.tipo||'', color:r.color||'', colorTexto:r.color_texto||''}; }
function toDbSubcategoria(s){ return {id:s.id, categoria_id:s.categoriaId||null, nombre:s.nombre}; }
function fromDbSubcategoria(r){ return {id:r.id, categoriaId:r.categoria_id||'', nombre:r.nombre}; }
// Igual que en toDbCentro: "moneda" y "cambio_id" solo viajan cuando hacen falta (movimientos en
// dólares / patas de una compra-venta), para no depender de migracion_dolares.sql en todo lo demás.
function toDbMovimiento(m){
  var r = {id:m.id, fecha:m.fecha, centro_id:m.centroId||null, categoria_id:m.categoriaId||null, subcategoria_id:m.subcategoriaId||null, proveedor:m.proveedor||null, detalle:m.detalle||null, ingreso:Number(m.ingreso)||0, egreso:Number(m.egreso)||0, tarjeta:!!m.tarjeta, fecha_consumo:m.fechaConsumo||null, tarjeta_marca:m.tarjetaMarca||null, cuotas:m.cuotas||null};
  if(m.moneda==='USD') r.moneda = 'USD';
  if(m.cambioId) r.cambio_id = m.cambioId;
  return r;
}
function fromDbMovimiento(r){ return {id:r.id, fecha:r.fecha, centroId:r.centro_id||'', categoriaId:r.categoria_id||'', subcategoriaId:r.subcategoria_id||'', proveedor:r.proveedor||'', detalle:r.detalle||'', ingreso:Number(r.ingreso)||0, egreso:Number(r.egreso)||0, tarjeta:!!r.tarjeta, fechaConsumo:r.fecha_consumo||'', tarjetaMarca:r.tarjeta_marca||'', cuotas:r.cuotas||'', moneda:r.moneda==='USD'?'USD':'ARS', cambioId:r.cambio_id||''}; }
function toDbVencimiento(v){
  return {id:v.id, concepto:v.concepto, fecha:v.fecha, monto:Number(v.monto)||0, centro_id:v.centroId||null,
    categoria_id:v.categoriaId||null, subcategoria_id:v.subcategoriaId||null, estado:v.estado||'pendiente',
    recurrente_id:v.recurrenteId||null, periodo:v.periodo||null};
}
function fromDbVencimiento(r){
  return {id:r.id, concepto:r.concepto, fecha:r.fecha, monto:Number(r.monto)||0, centroId:r.centro_id||'',
    categoriaId:r.categoria_id||'', subcategoriaId:r.subcategoria_id||'', estado:r.estado||'pendiente',
    recurrenteId:r.recurrente_id||'', periodo:r.periodo||''};
}
// Plantilla de vencimiento recurrente (V1). desde/hasta: mes 'aaaa-mm' en la app, día 1 en la base.
// generado_hasta lo maneja solo la base (generar_vencimientos_recurrentes), por eso no se manda.
function toDbVencRecurrente(r){
  return {id:r.id, concepto:r.concepto, monto:Number(r.monto)||0, dia:Number(r.dia)||1, centro_id:r.centroId||null,
    categoria_id:r.categoriaId||null, subcategoria_id:r.subcategoriaId||null,
    desde:r.desde ? r.desde+'-01' : null, hasta:r.hasta ? r.hasta+'-01' : null};
}
function fromDbVencRecurrente(r){
  return {id:r.id, concepto:r.concepto, monto:Number(r.monto)||0, dia:Number(r.dia)||1, centroId:r.centro_id||'',
    categoriaId:r.categoria_id||'', subcategoriaId:r.subcategoria_id||'',
    desde:(r.desde||'').slice(0,7), hasta:(r.hasta||'').slice(0,7)};
}
async function crearMovimientoDesdeVencimiento(v){
  var nuevoMov = {
    id: uid(), fecha: v.fecha, centroId: v.centroId||'', categoriaId: v.categoriaId||'', subcategoriaId: v.subcategoriaId||'',
    proveedor: v.concepto, detalle:'', ingreso:0, egreso: Number(v.monto)||0
  };
  await dbInsert('movimientos', toDbMovimiento(nuevoMov));
  STATE.movimientos.push(nuevoMov);
  STATE.saldosDirty = true;
}
function toDbDeuda(d){ return {id:d.id, concepto:d.concepto, saldo_pendiente:Number(d.saldoPendiente)||0, cuota_mensual:Number(d.cuotaMensual)||0, centro_id:d.centroId||null, estado:d.estado||'activa'}; }
function fromDbDeuda(r){ return {id:r.id, concepto:r.concepto, saldoPendiente:Number(r.saldo_pendiente)||0, cuotaMensual:Number(r.cuota_mensual)||0, centroId:r.centro_id||'', estado:r.estado||'activa'}; }
function toDbRegla(r){ return {id:r.id, proveedor:r.proveedor, categoria:r.categoria, subcategoria:r.subcategoria||null}; }
function fromDbRegla(r){ return {id:r.id, proveedor:r.proveedor, categoria:r.categoria, subcategoria:r.subcategoria||''}; }
function toDbUsdt(u){
  return {
    id:u.id, fecha:u.fecha, tipo:u.tipo, cantidad:Number(u.cantidad)||0,
    monto_ars: Number(u.montoArs)||null,
    cotizacion: Number(u.cotizacion)||null,
    centro_id: u.tipo==='venta' ? (u.centroId||null) : null,
    categoria_id: u.categoriaId||null,
    subcategoria_id: u.subcategoriaId||null,
    movimiento_id: u.movimientoId||null, detalle: u.detalle||null
  };
}
function fromDbUsdt(r){
  return {
    id:r.id, fecha:r.fecha, tipo:r.tipo, cantidad:Number(r.cantidad)||0,
    montoArs:Number(r.monto_ars)||0, cotizacion:Number(r.cotizacion)||0,
    centroId:r.centro_id||'', categoriaId:r.categoria_id||'', subcategoriaId:r.subcategoria_id||'',
    movimientoId:r.movimiento_id||'', detalle:r.detalle||''
  };
}
// La Edge Function "facturar-arca" es quien inserta/actualiza filas de facturas; acá solo se leen.
function fromDbFactura(r){
  return {
    id:r.id, movimientoId:r.movimiento_id||'', fecha:r.fecha, tipoComprobante:r.tipo_comprobante||'C',
    puntoVenta:r.punto_venta||null, numero:r.numero||null, importe:Number(r.importe)||0,
    cae:r.cae||'', caeVencimiento:r.cae_vencimiento||'', estado:r.estado||'pendiente',
    error:r.error||'', ambiente:r.ambiente||'homologacion', detalle:r.detalle||''
  };
}
function fromDbConfiguracion(r){ return {clave:r.clave, valor:r.valor}; }
function fromDbConfigCatalogo(r){
  return {clave:r.clave, tipo:r.tipo, descripcion:r.descripcion||'', valorDefault:r.valor_default, grupo:r.grupo||'', orden:Number(r.orden)||0};
}

// ---- CRUD genérico contra Supabase ----
// Tablas con datos de cada familia. Un miembro no necesita filtrar (RLS ya le devuelve solo lo de su
// familia, y familia_id lo completa la base al insertar); el superadmin ve todas, así que acá se
// filtra por la familia elegida en el selector.
var TABLAS_DE_FAMILIA = ['centros', 'categorias', 'subcategorias', 'movimientos', 'vencimientos_recurrentes', 'vencimientos', 'deudas',
  'usdt_movimientos', 'facturas', 'reglas_categorizacion', 'familia_config', 'familia_importadores_ocultos'];

// opciones.todasLasFamilias: sin filtrar por la familia elegida (backup global del superadmin).
async function dbFetchAll(table, ordenarPor, opciones){
  var filtrarFamilia = STATE.esSuperadmin && STATE.familiaSeleccionadaId && (TABLAS_DE_FAMILIA.indexOf(table)!==-1 || table==='miembros') &&
    !(opciones && opciones.todasLasFamilias);
  var allRows = [];
  var pageSize = 1000;
  var from = 0;
  while(true){
    var q = sb.from(table).select('*');
    if(filtrarFamilia) q = q.eq('familia_id', STATE.familiaSeleccionadaId);
    if(ordenarPor) q = q.order(ordenarPor, {ascending:true}).order('id', {ascending:true});
    var res = await q.range(from, from + pageSize - 1);
    if(res.error) throw res.error;
    var rows = res.data || [];
    allRows = allRows.concat(rows);
    if(rows.length < pageSize) break; // ya no hay más filas
    from += pageSize;
  }
  return allRows;
}
// Red de seguridad del modo solo lectura (superadmin): aunque algún botón de escritura quedara visible,
// no llega a la base. RLS lo rechazaría igual, pero con un error menos claro.
function verificarEscritura(){
  if(STATE.soloLectura) throw new Error('El soporte ve los datos de las familias en solo lectura.');
}
async function dbInsert(table, rowOrRows){
  verificarEscritura();
  var res = await sb.from(table).insert(rowOrRows).select();
  if(res.error) throw res.error;
  return res.data;
}
async function dbUpdate(table, id, fields){
  verificarEscritura();
  var res = await sb.from(table).update(fields).eq('id', id);
  if(res.error) throw res.error;
}
async function dbDelete(table, id){
  verificarEscritura();
  var res = await sb.from(table).delete().eq('id', id);
  if(res.error) throw res.error;
}
async function dbUpsert(table, rows){
  if(!rows.length) return [];
  verificarEscritura();
  var res = await sb.from(table).upsert(rows).select();
  if(res.error) throw res.error;
  return res.data;
}

// ---- BACKUP (solo superadmin) ----
// Tablas que entran en el backup global (botón "Descargar backup" de Administración y el backup diario
// de scripts/backup-a-drive/backup.js, que tiene que listar exactamente las mismas): familias, miembros
// y los datos de todas las familias. arca_ta queda afuera a propósito: es un token temporal de ARCA.
var TABLAS_BACKUP = ['familias', 'miembros'].concat(TABLAS_DE_FAMILIA);

// Backup versión 3: las filas tal cual están en la base (snake_case, con familia_id), igual que el
// backup diario a Drive. Lee de la base y no de STATE para no perder columnas que la app no mapea
// (created_at, etc.) ni las familias que no están elegidas en el selector.
async function armarBackup(){
  var backupObj = { version: 3, exportadoEn: new Date().toISOString() };
  for(var i=0; i<TABLAS_BACKUP.length; i++){
    backupObj[TABLAS_BACKUP[i]] = await dbFetchAll(TABLAS_BACKUP[i], null, { todasLasFamilias: true });
  }
  return backupObj;
}

// Familias que trae un backup v3, con cuántas filas de datos tiene cada una. Incluye las que tienen
// datos aunque no figuren en "familias" (por si el archivo se armó a mano o está incompleto).
function familiasEnBackup(datos){
  var porId = {};
  (datos.familias||[]).forEach(function(f){ porId[f.id] = { id:f.id, nombre:f.nombre||'', filas:0 }; });
  TABLAS_DE_FAMILIA.forEach(function(t){
    (datos[t]||[]).forEach(function(r){
      if(!r.familia_id) return;
      if(!porId[r.familia_id]) porId[r.familia_id] = { id:r.familia_id, nombre:'', filas:0 };
      porId[r.familia_id].filas++;
    });
  });
  return Object.keys(porId).map(function(id){ return porId[id]; })
    .sort(function(a, b){ return (a.nombre||a.id).localeCompare(b.nombre||b.id); });
}

// Restaura UNA familia del backup con la función restaurar_familia() de la base: valida que todo sea
// de esa familia y aplica todo o nada (no borra: agrega lo que falta y actualiza lo que coincide por id).
async function restaurarFamilia(datos, familiaId){
  var familia = (datos.familias||[]).find(function(f){ return f.id===familiaId; });
  var payload = { familia: familia ? { id: familia.id, nombre: familia.nombre } : null };
  TABLAS_DE_FAMILIA.forEach(function(t){
    payload[t] = (datos[t]||[]).filter(function(r){ return r.familia_id===familiaId; });
  });
  var res = await sb.rpc('restaurar_familia', { p_familia_id: familiaId, p_datos: payload });
  if(res.error) throw res.error;
  return res.data;
}

// Vencimientos recurrentes (V1): la base crea los de cada mes que falte (generar_vencimientos_recurrentes
// en schema.sql), con la fecha local de hoy. El superadmin solo mira, así que no genera. Si falla, la app
// carga igual (los vencimientos ya generados se ven) y se reintenta en la próxima carga.
async function generarVencimientosRecurrentes(){
  if(STATE.soloLectura) return 0;
  try{
    var res = await sb.rpc('generar_vencimientos_recurrentes', { p_hoy: fechaHoyISO() });
    if(res.error) throw res.error;
    return Number(res.data)||0;
  }catch(e){
    if(window.console) console.warn('No se pudieron generar los vencimientos recurrentes: '+(e.message||e));
    return 0;
  }
}

async function cargarTodo(){
  // Configuración (D3) primero: el catálogo (global, con los defaults) + lo que la familia tiene distinto
  // (configuracionValor() combina las dos). Define qué funciones opcionales están prendidas.
  var configCatalogo = await dbFetchAll('config_catalogo');
  STATE.configCatalogo = configCatalogo.map(fromDbConfigCatalogo).sort(function(a, b){
    return a.grupo.localeCompare(b.grupo) || (a.orden - b.orden) || a.clave.localeCompare(b.clave);
  });
  var configuracion = await dbFetchAll('familia_config');
  STATE.configuracion = configuracion.map(fromDbConfiguracion);
  // Importadores (D7): los globales y los que esta familia tiene ocultos.
  STATE.importadores = (await dbFetchAll('importadores')).map(function(r){
    return { codigo:r.codigo, nombre:r.nombre||r.codigo, activo:r.activo!==false, orden:Number(r.orden)||0 };
  }).sort(function(a, b){ return (a.orden - b.orden) || a.codigo.localeCompare(b.codigo); });
  STATE.importadoresOcultos = (await dbFetchAll('familia_importadores_ocultos')).map(function(r){ return r.importador_codigo; });

  await generarVencimientosRecurrentes();
  var [centros, categorias, subcategorias, movimientos, vencimientos, vencRecurrentes] = await Promise.all([
    dbFetchAll('centros'), dbFetchAll('categorias'), dbFetchAll('subcategorias'), dbFetchAll('movimientos', 'created_at'), dbFetchAll('vencimientos'),
    dbFetchAll('vencimientos_recurrentes')
  ]);
  STATE.centros = centros.map(fromDbCentro);
  STATE.miembrosFamilia = (await dbFetchAll('miembros')).map(fromDbMiembro)
    .sort(function(a, b){ return a.nombre.localeCompare(b.nombre, 'es', {sensitivity:'base'}); });
  STATE.categorias = categorias.map(fromDbCategoria);
  STATE.subcategorias = subcategorias.map(fromDbSubcategoria);
  // Los movimientos en dólares viven en la misma tabla pero en una lista aparte: STATE.movimientos
  // queda solo en pesos, así ningún cálculo existente (Saldos, Resumen, Flujo, Comparativa...) suma
  // dólares como si fueran pesos. Los en USD se ven y se editan desde la pestaña Dólares.
  var todosLosMovs = movimientos.map(fromDbMovimiento);
  STATE.movimientos = todosLosMovs.filter(function(m){ return m.moneda!=='USD'; });
  // Con Dólares apagada, los movimientos en USD no se muestran en ningún lado.
  STATE.movimientosUsd = funcionActiva('dolares') ? todosLosMovs.filter(function(m){ return m.moneda==='USD'; }) : [];
  STATE.vencimientos = vencimientos.map(fromDbVencimiento);
  STATE.vencRecurrentes = vencRecurrentes.map(fromDbVencRecurrente);
  STATE.usdtMovimientos = []; STATE.deudas = []; STATE.facturas = [];
  if(funcionActiva('usdt')) try{
    // Try/catch aparte: si todavía no corriste migracion_usdt.sql, arranca vacío en vez de romper la carga.
    var usdtMovimientos = await dbFetchAll('usdt_movimientos');
    STATE.usdtMovimientos = usdtMovimientos.map(fromDbUsdt);
  }catch(e){ STATE.usdtMovimientos = []; }
  if(funcionActiva('flujo_caja')) try{
    // Idem: si todavía no corriste migracion_deudas.sql, arranca vacío en vez de romper la carga.
    var deudas = await dbFetchAll('deudas');
    STATE.deudas = deudas.map(fromDbDeuda);
  }catch(e){ STATE.deudas = []; }
  try{
    // Idem: si todavía no corriste migracion_reglas_categorizacion.sql, arranca vacío en vez de romper la carga.
    var reglas = await dbFetchAll('reglas_categorizacion');
    STATE.reglas = reglas.map(fromDbRegla);
  }catch(e){ STATE.reglas = []; }
  if(funcionActiva('facturacion_arca')) try{
    // Idem: si todavía no corriste migracion_facturacion_arca.sql, arranca vacío en vez de romper la carga.
    var facturas = await dbFetchAll('facturas');
    STATE.facturas = facturas.map(fromDbFactura);
  }catch(e){ STATE.facturas = []; }
}

// ===================== AUTENTICACIÓN =====================
// Quién es el usuario logueado: superadmin (ve todas las familias en solo lectura, con selector) o
// miembro de una familia (RLS le devuelve solo la suya). Si no es ninguna de las dos, no ve la app.
async function cargarPerfil(){
  var superadmins = await dbFetchAll('superadmins');
  var familias = await dbFetchAll('familias', 'nombre');
  STATE.esSuperadmin = superadmins.length > 0;
  STATE.soloLectura = STATE.esSuperadmin;
  STATE.familias = familias;
  STATE.sinFamilia = !STATE.esSuperadmin && !familias.length;
  STATE.familiaSeleccionadaId = null;
  STATE.adminMiembros = [];
  STATE.adminMiembrosError = null;
  if(STATE.esSuperadmin){
    var guardada = null;
    try{ guardada = localStorage.getItem('controlFamiliaSuperadmin'); }catch(e){}
    var existe = familias.some(function(f){ return f.id===guardada; });
    STATE.familiaSeleccionadaId = existe ? guardada : (familias[0] ? familias[0].id : null);
    try{
      var res = await sb.rpc('admin_miembros');
      if(res.error) throw res.error;
      STATE.adminMiembros = res.data || [];
    }catch(e){ STATE.adminMiembrosError = 'No se pudieron cargar los miembros: '+(e.message||e); }
  } else if(STATE.activeTab==='admin'){
    STATE.activeTab = 'resumen';
  }
}
async function cargarSesion(){
  await cargarPerfil();
  if(!STATE.sinFamilia) await cargarTodo();
}

// Superadmin: cambia la familia que se está mirando y recarga sus datos.
async function elegirFamilia(familiaId){
  STATE.familiaSeleccionadaId = familiaId;
  try{ localStorage.setItem('controlFamiliaSuperadmin', familiaId); }catch(e){}
  STATE.filtros = {centro:[], categoria:[], subcategoria:[], mes:[], texto:'', soloIncompletos:false, soloTarjeta:false};
  STATE.editing = null; STATE.movSeleccionados = []; STATE.movPaginaActual = 1; STATE.reglasPaginaActual = 1;
  STATE.incompletosSnapshotIds = null; STATE.dbError = null; STATE.configMsg = null; STATE.importadoresMsg = null;
  STATE.ready = false;
  render();
  try{
    await cargarTodo();
  }catch(e){ STATE.dbError = 'No se pudo cargar la familia: '+(e.message||e); }
  STATE.saldosDirty = true;
  STATE.ready = true;
  render();
}

async function mostrarApp(){
  document.getElementById('loginWrap').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  try{
    await cargarSesion();
  }catch(e){
    // A veces la carga falla por un desfasaje transitorio de reloj contra el token recién emitido
    // (ej. "JWT issued at future") justo al loguearse — un reintento a los pocos segundos casi
    // siempre alcanza, sin que haga falta que el usuario le dé F5 a mano.
    await new Promise(function(r){ setTimeout(r, 1500); });
    try{
      await cargarSesion();
    }catch(e2){
      STATE.dbError = 'No se pudo cargar la información desde la base de datos: ' + (e2.message||e2);
    }
  }
  STATE.saldosDirty = true;
  STATE.ready = true;
  render();
  // La app abre en Resumen, que valúa el USDT de sueldo sin vender a la cotización de hoy:
  // traerla de entrada igual que cuando se entra a la pestaña con un clic.
  if(funcionActiva('usdt') && (STATE.activeTab==='usdt' || STATE.activeTab==='resumen' || STATE.activeTab==='saldos' || STATE.activeTab==='flujo') && STATE.usdtCotizacionBid===null && !STATE.usdtCotizacionCargando) obtenerCotizacionUsdt();
  if(funcionActiva('dolares') && (STATE.activeTab==='dolares' || STATE.activeTab==='resumen' || STATE.activeTab==='saldos' || STATE.activeTab==='flujo') && STATE.dolarBlueCompra===null && !STATE.dolarBlueCargando) obtenerDolarBlue();
}

function mostrarLogin(msg){
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginWrap').style.display = 'flex';
  document.getElementById('loginMsg').innerHTML = msg ? '<div class="msg err" style="margin-bottom:10px">'+msg.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];})+'</div>' : '';
}

async function intentarLogin(){
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  if(!email || !password){ mostrarLogin('Completá email y contraseña.'); return; }
  mostrarLogin('Iniciando sesión...');
  var res = await sb.auth.signInWithPassword({ email: email, password: password });
  if(res.error){ mostrarLogin('No pudimos iniciar sesión: ' + res.error.message); return; }
  STATE.usuarioEmail = (res.data && res.data.user) ? res.data.user.email : email;
  await mostrarApp();
}

async function cerrarSesion(){
  await sb.auth.signOut();
  mostrarLogin();
}

async function initAuth(){
  if(!sb){ mostrarLogin('No se pudo cargar la librería de Supabase. Revisá tu conexión a internet y refrescá la página.'); return; }
  var { data } = await sb.auth.getSession();
  if(data && data.session){
    STATE.usuarioEmail = data.session.user ? data.session.user.email : null;
    await mostrarApp();
  } else {
    mostrarLogin();
  }
  sb.auth.onAuthStateChange(function(event, session){
    if(event === 'SIGNED_OUT'){ mostrarLogin(); }
  });
}

// ===================== HELPERS =====================
function fmtMonto(n){
  n = Number(n)||0;
  return n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtCantidadUsdt(n){
  n = Number(n)||0;
  return n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:6});
}
function calcularSaldoUsdt(){
  return STATE.usdtMovimientos.reduce(function(s,u){
    return s + (u.tipo==='ingreso' ? (Number(u.cantidad)||0) : -(Number(u.cantidad)||0));
  }, 0);
}
// Un movimiento en pesos cargado a mano en la categoría de Venta de USDT (p. ej. desde Importar)
// todavía no tiene su contraparte en usdt_movimientos: esto detecta esos casos para ofrecer
// el ícono que genera el registro USDT vinculado, y evita ofrecerlo dos veces si ya existe.
function usdtVinculadoAMovimiento(movId){
  return STATE.usdtMovimientos.some(function(u){ return u.movimientoId===movId; });
}
function esVentaUsdtPendiente(m){
  return funcionActiva('usdt') && esMovimientoVentaUsdt(m) && Number(m.ingreso)>0 && !usdtVinculadoAMovimiento(m.id);
}
// Las ventas de USDT van a la categoría de tipo "venta_usdt" (se elige en el ABM; la base admite una
// sola por familia), no a una que se llame de cierta forma (D6).
function esCategoriaVentaUsdt(categoriaId){
  return esTipoCategoria(categoriaId, 'venta_usdt');
}
function esMovimientoVentaUsdt(m){
  return esCategoriaVentaUsdt(m.categoriaId);
}
// El ingreso en pesos de toda venta de USDT se clasifica solo en la categoría de tipo "venta_usdt",
// sin elegirlo a mano, para que no termine en otra categoría y confunda. Devuelve {categoriaId,
// subcategoriaId, etiqueta}, o null si la familia todavía no tiene esa categoría.
function destinoVentaUsdt(){
  var cat = STATE.categorias.find(function(c){ return c.tipo==='venta_usdt'; });
  return cat ? {categoriaId:cat.id, subcategoriaId:'', etiqueta:cat.nombre} : null;
}
// Un ingreso de la pestaña USDT cuenta como Sueldo en Resumen y Flujo de caja si su categoría es de
// tipo Sueldo (D6; sin categoría suma a la tenencia pero no es ingreso). Los pesos que después entran
// al vender USDT (movimiento vinculado a una venta, o en la categoría de Venta de USDT) no se cuentan
// como ingreso: es la misma plata que ya entró como USDT.
function idsMovimientosDeVentaUsdt(){
  var ids = {};
  STATE.usdtMovimientos.forEach(function(u){ if(u.tipo==='venta' && u.movimientoId) ids[u.movimientoId] = true; });
  return ids;
}
function esIngresoPorVentaUsdt(m, idsVenta){
  return esMovimientoVentaUsdt(m) || !!idsVenta[m.id];
}
// Valor en pesos de cada ingreso de USDT (id -> ARS). Si tiene "Valor en pesos" cargado se usa ese;
// si no, se valúa a la cotización de las ventas que lo consumieron (FIFO: el USDT que entró primero
// es el primero que se vende) y lo que todavía no se vendió, a la cotización de hoy (o a la de la
// última venta, si todavía no se consultó la de hoy).
function valoresArsIngresosUsdt(){
  var ordenados = STATE.usdtMovimientos.slice().sort(function(a,b){
    return (a.fecha||'').localeCompare(b.fecha||'') || (a.tipo==='ingreso'?0:1) - (b.tipo==='ingreso'?0:1);
  });
  var cola = [], porId = {}, ultimaCotizacion = 0;
  ordenados.forEach(function(u){
    var cant = Number(u.cantidad)||0;
    if(u.tipo==='ingreso'){
      porId[u.id] = {restante:cant, valorVendido:0};
      cola.push(porId[u.id]);
      return;
    }
    var cot = Number(u.cotizacion) || (cant ? (Number(u.montoArs)||0)/cant : 0);
    if(cot) ultimaCotizacion = cot;
    var porVender = cant;
    while(porVender>1e-9 && cola.length){
      var primero = cola[0];
      var usado = Math.min(primero.restante, porVender);
      primero.restante -= usado;
      primero.valorVendido += usado*cot;
      porVender -= usado;
      if(primero.restante<=1e-9) cola.shift();
    }
  });
  var cotizacionRestante = STATE.usdtCotizacionBid || ultimaCotizacion;
  var out = {};
  ordenados.forEach(function(u){
    if(u.tipo!=='ingreso') return;
    var montoCargado = Number(u.montoArs)||0;
    out[u.id] = montoCargado>0 ? montoCargado : porId[u.id].valorVendido + porId[u.id].restante*cotizacionRestante;
  });
  return out;
}
// Solo cuenta lo emitido en producción: una prueba en homologación no debe mostrarse como
// "ya facturado" ni contarse en el acumulado real de la categoría de Monotributo.
function facturaEmitidaDeMovimiento(movId){
  return STATE.facturas.find(function(f){ return f.movimientoId===movId && f.estado==='emitida' && f.ambiente==='produccion'; }) || null;
}
function esVentaUsdtFacturable(m){
  return funcionActiva('facturacion_arca') && esMovimientoVentaUsdt(m) && Number(m.ingreso)>0 && !facturaEmitidaDeMovimiento(m.id);
}
// Valor efectivo de una configuración: el de la familia o, si no tiene, el default del catálogo
// (igual que config_valor() en la base).
function configuracionValor(clave){
  var row = STATE.configuracion.find(function(c){ return c.clave===clave; });
  if(row) return row.valor;
  var item = (STATE.configCatalogo||[]).find(function(c){ return c.clave===clave; });
  return item && item.valorDefault!=null ? item.valorDefault : null;
}
// Mismo criterio que valor_config_valido() en schema.sql.
function valorConfigValido(tipo, valor){
  if(tipo==='numero') return /^-?[0-9]+(\.[0-9]+)?$/.test(valor);
  if(tipo==='booleano') return valor==='true' || valor==='false';
  return true;
}
// Funciones opcionales (D4): claves booleanas "feature.*" del catálogo, apagadas por defecto. Apagada =
// se oculta y no se cargan sus datos (no se borra nada). Facturación ARCA factura ventas de USDT, así que
// sin USDT queda apagada aunque su clave esté prendida.
var FUNCIONES_OPCIONALES = ['usdt', 'dolares', 'flujo_caja', 'facturacion_arca', 'tarjetas'];
function funcionActiva(nombre){
  if(nombre==='facturacion_arca' && !funcionActiva('usdt')) return false;
  return configuracionValor('feature.'+nombre)==='true';
}
// Movimiento con tarjeta a los efectos de mostrarlo como tal (agrupado por resumen, ícono): con la
// función Tarjetas apagada se ve como uno común, aunque en la base siga marcado.
function esTarjeta(m){ return !!(m && m.tarjeta) && funcionActiva('tarjetas'); }
// Facturación prendida pero sin los datos del emisor (D8): no se intenta facturar.
function faltanDatosFacturacion(){
  return !configuracionValor('arca_cuit') || !configuracionValor('arca_razon_social');
}

// Solo el superadmin (S4): guarda el valor de una familia, o lo borra (vuelve al default) si viene vacío.
// No pasa por dbInsert/dbUpsert a propósito: el superadmin está en solo lectura para los datos, no para esto.
async function guardarConfigFamilia(familiaId, clave, valor){
  var res = valor===''
    ? await sb.from('familia_config').delete().eq('familia_id', familiaId).eq('clave', clave)
    : await sb.from('familia_config').upsert({ familia_id: familiaId, clave: clave, valor: valor }, { onConflict: 'familia_id,clave' });
  if(res && res.error) throw res.error;
  STATE.configuracion = STATE.configuracion.filter(function(c){ return c.clave!==clave; });
  if(valor!=='') STATE.configuracion.push({ clave: clave, valor: valor });
}
function limiteCategoriaB(){
  var v = configuracionValor('monotributo_limite_categoria_b');
  return v!=null ? (Number(v)||0) : 0;
}
// Inicio de la ventana de 12 meses móviles que termina en fechaRefISO (inclusive). Es el criterio
// real de recategorización de Monotributo (acumulado rodante), no "mes calendario".
function inicioVentana12Meses(fechaRefISO){
  var m = (fechaRefISO||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return '0000-00-00';
  var y = parseInt(m[1],10), mes = parseInt(m[2],10), dia = parseInt(m[3],10);
  var d = new Date(y, mes-1-12, dia);
  return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
}
function acumuladoFacturado12Meses(facturas, fechaRefISO){
  var desde = inicioVentana12Meses(fechaRefISO);
  return facturas.reduce(function(s, f){
    if(f.estado!=='emitida' || !f.fecha || f.fecha<desde || f.fecha>fechaRefISO) return s;
    return s + (Number(f.importe)||0);
  }, 0);
}
// Mismo mapeo que CBTE_TIPO_POR_LETRA en supabase/functions/facturar-arca/index.ts — no se puede
// compartir código entre Deno y el browser, así que queda documentado en los dos lados.
var CBTE_TIPO_POR_LETRA = { C: 11 };
// Arma el payload del QR obligatorio (RG 4892) a partir de una fila de STATE.facturas + el CUIT
// del emisor. Siempre Consumidor Final sin identificar (DocTipo 99, DocNro 0), que es lo que
// realmente le mandamos a ARCA en FECAESolicitar.
function armarPayloadQrFactura(factura, cuit){
  return {
    ver: 1, fecha: factura.fecha, cuit: Number(cuit),
    ptoVta: Number(factura.puntoVenta), tipoCmp: CBTE_TIPO_POR_LETRA[factura.tipoComprobante],
    nroCmp: Number(factura.numero), importe: Number(factura.importe.toFixed(2)),
    moneda: 'PES', ctz: 1, tipoDocRec: 99, nroDocRec: 0,
    tipoCodAut: 'E', codAut: Number(factura.cae)
  };
}
function fmtPuntoVentaYNumero(puntoVenta, numero){
  return String(puntoVenta).padStart(4,'0')+'-'+String(numero).padStart(8,'0');
}
function abrirComprobante(factura){
  if(!factura || !factura.cae) return;
  var cuit = configuracionValor('arca_cuit');
  var razonSocial = configuracionValor('arca_razon_social') || '';
  var payload = armarPayloadQrFactura(factura, cuit);
  var textoQr = 'https://www.afip.gob.ar/fe/qr/?p='+btoa(JSON.stringify(payload));
  // API sincrónica de qrcode-generator (0 = detecta automáticamente la versión de QR según el
  // largo del texto; 'M' = nivel de corrección de errores estándar).
  var qr = window.qrcode(0, 'M');
  qr.addData(textoQr);
  qr.make();
  var dataUrl = qr.createDataURL(6, 8);

  var w = window.open('', '_blank');
  if(!w) return;
  w.document.write(
    '<!doctype html><html><head><meta charset="utf-8"><title>Factura '+esc(factura.tipoComprobante)+' '+fmtPuntoVentaYNumero(factura.puntoVenta, factura.numero)+'</title>'+
    '<style>body{font-family:Arial,sans-serif;max-width:640px;margin:24px auto;color:#111}'+
    'h1{font-size:20px;border-bottom:2px solid #111;padding-bottom:8px}'+
    '.fila{display:flex;justify-content:space-between;margin:6px 0}'+
    '.total{font-size:22px;font-weight:bold;margin:16px 0}'+
    'img{display:block;margin:16px 0}'+
    'button{font-size:14px;padding:8px 16px;cursor:pointer}'+
    '@media print{button{display:none}}</style></head><body>'+
    '<h1>FACTURA '+esc(factura.tipoComprobante)+'</h1>'+
    '<div class="fila"><span>'+esc(razonSocial)+'</span><span>CUIT '+esc(cuit)+'</span></div>'+
    '<div class="fila"><span>Responsable Monotributo</span><span>Punto de Venta '+String(factura.puntoVenta).padStart(4,'0')+' — Nº '+String(factura.numero).padStart(8,'0')+'</span></div>'+
    '<div class="fila"><span>Fecha de emisión: '+esc(factura.fecha)+'</span></div>'+
    '<hr>'+
    '<div class="fila"><span>Receptor</span><span>Consumidor Final</span></div>'+
    '<div class="total">Importe total: $'+fmtMonto(factura.importe)+'</div>'+
    '<div class="fila"><span>CAE</span><span>'+esc(factura.cae)+'</span></div>'+
    '<div class="fila"><span>Vencimiento de CAE</span><span>'+esc(factura.caeVencimiento)+'</span></div>'+
    '<img src="'+dataUrl+'" width="150" height="150" alt="QR AFIP">'+
    '<button onclick="window.print()">Imprimir / Guardar como PDF</button>'+
    '</body></html>'
  );
  w.document.close();
}
// Si el sueldo se acredita unos días antes de fin de mes, para que en el Resumen cuente en el mes al
// que en realidad corresponde (y no en el que se acredita), los últimos N días de cada mes se consideran
// ya del mes siguiente a los efectos de "a qué mes pertenece el Sueldo". N es la configuración
// sueldo_dias_mes_siguiente de la familia; 0 o vacío = la regla está apagada.
function mesEfectivoSueldo(fechaISO){
  var m = (fechaISO||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return (fechaISO||'').slice(0,7);
  var diasMesSiguiente = Math.max(0, parseInt(configuracionValor('sueldo_dias_mes_siguiente'),10)||0);
  var y = parseInt(m[1],10), mes = parseInt(m[2],10), dia = parseInt(m[3],10);
  var ultimoDiaMes = new Date(y, mes, 0).getDate();
  if(dia <= ultimoDiaMes - diasMesSiguiente) return m[1]+'-'+m[2];
  var sig = new Date(y, mes, 1); // "mes" (1-indexado) usado como índice 0-indexado de Date = el mes siguiente
  return sig.getFullYear()+'-'+pad2(sig.getMonth()+1);
}
// Cotización de venta de USDT en Binance P2P (ARS), vía CriptoYa (API pública, sin key, CORS abierto).
// "bid" es lo que te pagan si vendés ahora — es lo que corresponde acá, no "ask" (precio de compra).
async function obtenerCotizacionUsdt(){
  if(STATE.usdtCotizacionCargando) return;
  STATE.usdtCotizacionCargando = true;
  STATE.usdtCotizacionError = null;
  render();
  try{
    var res = await fetch('https://criptoya.com/api/binancep2p/usdt/ars/1');
    if(!res.ok) throw new Error('HTTP '+res.status);
    var data = await res.json();
    var bid = Number(data && data.bid);
    if(!bid || bid<=0) throw new Error('respuesta inesperada de la API');
    STATE.usdtCotizacionBid = bid;
    STATE.usdtCotizacionActualizada = new Date();
  }catch(e){
    STATE.usdtCotizacionError = 'No se pudo obtener la cotización de Binance P2P ('+(e.message||e)+').';
  }
  STATE.usdtCotizacionCargando = false;
  render();
}
function nombreCentro(id){ var c = STATE.centros.find(function(x){return x.id===id;}); return c ? c.codigo+' · '+c.nombre : '—'; }
// Solo los CC que admiten pesos: es la lista de todos los combos/filtros de movimientos en pesos.
// Los CC solo en dólares se eligen desde la pestaña Dólares (centrosDolaresOrdenados).
function centrosOrdenados(){ return STATE.centros.filter(centroAdmitePesos).sort(function(a,b){ return (a.codigo||'').localeCompare(b.codigo||'', 'es', {sensitivity:'base'}); }); }
function categoriasOrdenadas(){ return STATE.categorias.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||'', 'es', {sensitivity:'base'}); }); }
function subcategoriasOrdenadas(lista){ return lista.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||'', 'es', {sensitivity:'base'}); }); }
function nombreCategoria(id){ var c = STATE.categorias.find(function(x){return x.id===id;}); return c ? c.nombre : '—'; }
function nombreSubcategoria(id){ var s = STATE.subcategorias.find(function(x){return x.id===id;}); return s ? s.nombre : '—'; }
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
// Centro de Costo por defecto al cargar efectivo: el último que se usó en este dispositivo (cada uno
// carga desde su celular, así que en la práctica queda el de cada persona). Solo si sigue existiendo.
function centroEfectivoRecordado(){
  var id = null;
  try{ id = localStorage.getItem('controlCentroEfectivo'); }catch(e){}
  return STATE.centros.some(function(c){ return c.id===id; }) ? id : '';
}
function fechaHoyISO(){
  var d = new Date();
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth()+1).padStart(2,'0');
  var dd = String(d.getDate()).padStart(2,'0');
  return yyyy+'-'+mm+'-'+dd;
}
// Mismo corte que el breakpoint mobile de style.css (@media max-width:640px).
function esVistaMobile(){ return window.innerWidth <= 640; }
function esMovimientoPendiente(m){
  return !!(m.fecha) && m.fecha > fechaHoyISO();
}

// ===================== PARSERS PORTADOS DEL CONVERSOR =====================
function matchRule(prov){ return null; } // acá la categorización se hace a mano en la previsualización

var MESES_RE = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre';
var mesMap = {enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};
function mesNum(m){ return mesMap[(m||'').toLowerCase()]||'01'; }

function parseMonto(str){
  if(!str) return null;
  return parseFloat(str.replace(/\./g,'').replace(',','.').replace(/[^0-9.\-]/g,''));
}
function formatMonto(n){
  if(n===null||n===undefined||isNaN(n)) return '';
  return Math.abs(n).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function reconstructMontos(rawLines){
  var out = [];
  var i = 0;
  var reMOnlyNum = /^[\d.]+$/;
  while(i < rawLines.length){
    var l = rawLines[i];
    if(l === '$' || l === '-' || l === '+'){
      var sign = '';
      var j = i;
      if(l === '-' || l === '+'){ sign = l; j++; }
      if(j < rawLines.length && rawLines[j] === '$'){ j++; }
      var numPart = '';
      if(j < rawLines.length && reMOnlyNum.test(rawLines[j])){ numPart = rawLines[j].replace(/\./g,''); j++; }
      var decPart = '';
      if(j < rawLines.length && rawLines[j] === ','){ j++;
        if(j < rawLines.length && /^\d+$/.test(rawLines[j])){ decPart = rawLines[j]; j++; }
      }
      out.push(sign + '$' + numPart + (decPart ? ',' + decPart : ''));
      i = j;
      continue;
    }
    out.push(l); i++;
  }
  return out;
}

function joinFechaLines(lines){
  var reFechaSolo = new RegExp('^(\\d+)\\s+de\\s+('+MESES_RE+')\\s*$','i');
  var reMonto = /^[+\-]?\$[\d.,]+$/;
  var out = [];
  var i = 0;
  while(i < lines.length){
    var l = lines[i];
    if(l.toLowerCase() === 'hoy'){
      var j = i+1;
      if(j < lines.length && /^(Disponible|Saldo del día)/i.test(lines[j])){ j++; }
      if(j < lines.length && reMonto.test(lines[j])){ j++; }
      out.push('__HOY__'); i = j; continue;
    }
    var mF = l.match(reFechaSolo);
    if(mF){
      var j = i+1;
      if(j < lines.length && /^(Disponible|Saldo del día)/i.test(lines[j])){ j++; }
      if(j < lines.length && reMonto.test(lines[j])){ j++; }
      out.push('__FECHA__'+mF[1]+'__'+mF[2]);
      i = j; continue;
    }
    var mFpeg = l.match(new RegExp('^(\\d+)\\s+de\\s+('+MESES_RE+')','i'));
    if(mFpeg){
      out.push('__FECHA__'+mFpeg[1]+'__'+mFpeg[2]);
      i++; continue;
    }
    if(/^(Disponible|Saldo del día)\s*$/i.test(l)){ i++; continue; }
    out.push(l); i++;
  }
  return out;
}

function getTodayStr(anio){
  var t = new Date();
  return String(t.getDate()).padStart(2,'0')+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+anio;
}

// Año de 2 dígitos a usar cuando el resumen no lo trae (ej. Mercado Pago, que solo da "día de mes").
function anioActualCorto(){
  return String(new Date().getFullYear()).slice(2);
}

function parseLines(lines, anio){
  var reMonto = /^[+\-]?\$[\d.,]+$/;
  var reHora = /^\d{1,2}:\d{2}$/;
  var reMovimiento = /^Movimiento\s+\.\.\./i;
  var currentDate = null;
  var rows = [];
  var i = 0;
  while(i < lines.length){
    var line = lines[i];
    if(line === '__HOY__'){ currentDate = getTodayStr(anio); i++; continue; }
    if(line.indexOf('__FECHA__') === 0){
      var parts = line.split('__').filter(function(x){return x.length>0;});
      var dia = parts[1] ? parts[1].padStart(2,'0') : '01';
      var mes = mesNum(parts[2]||'');
      currentDate = dia+'-'+mes+'-'+anio;
      i++; continue;
    }
    if(reMonto.test(line) || reMovimiento.test(line)){ i++; continue; }
    if(reHora.test(line)){
      var hora = line; var j = i+1;
      if(j >= lines.length){ i++; continue; }
      var proveedor = lines[j]; j++;
      var half = Math.ceil(proveedor.length/2);
      var firstH = proveedor.slice(0,half).trim();
      var secondH = proveedor.slice(half);
      if(firstH.length > 3 && secondH.toLowerCase().indexOf(firstH.toLowerCase()) === 0){
        proveedor = firstH;
      }
      if(j < lines.length && lines[j].toLowerCase() === proveedor.toLowerCase()){ j++; }
      var tipo = 'Transferencia enviada';
      if(j < lines.length && !reMonto.test(lines[j]) && !reHora.test(lines[j]) && !reMovimiento.test(lines[j]) && lines[j].indexOf('__') !== 0){
        var kandidato = lines[j];
        if(kandidato.toLowerCase().indexOf(proveedor.toLowerCase()) === 0){
          var t2 = kandidato.slice(proveedor.length).trim();
          if(t2.length > 0) tipo = t2;
        } else {
          tipo = kandidato;
        }
        j++;
      }
      if(j < lines.length && reMovimiento.test(lines[j])){ j++; }
      if(j < lines.length && reMonto.test(lines[j])){
        var monto = parseMonto(lines[j]); j++;
        rows.push({
          fecha: currentDate||'',
          proveedor: proveedor,
          tipo: tipo,
          monto: monto,
          ingreso: monto>0 ? formatMonto(monto) : '',
          egreso: monto<0 ? formatMonto(monto) : ''
        });
        i = j;
      } else { i++; }
      continue;
    }
    i++;
  }
  return rows;
}

function procesarTexto(raw, anio){
  var rawLines = raw.split('\n').map(function(l){ return l.replace(/^[*\u2022]\s*/,'').trim(); }).filter(function(l){ return l.length>0; });
  var step1 = reconstructMontos(rawLines);
  var step2 = joinFechaLines(step1);
  return parseLines(step2, anio);
}

// Resumen de tarjeta (Nación, Santander): mismo formato de línea entre los dos bancos una vez que
// se pega el texto tal cual sale del resumen (no de la web de cada banco) —
// "dd/mm/aa detalle...  [C.NN/MM]  comprobante  monto". Se descartan "SU PAGO EN PESOS" (el pago
// del resumen, no un consumo) y cualquier línea que no arranque con fecha (el subtotal
// "TOTAL TARJETA...", texto de planes de cuotas al pie, etc. quedan afuera solos). El importe real
// de la línea es SIEMPRE el último número con forma de monto: filas de impuestos/percepciones
// (IIBB, IVA RG 4240) traen otros números con esa misma forma en el medio del texto (ej.
// "2,00%(0)") que no son el importe.
function parseTarjetaResumen(raw, vencimientoStr){
  var lines = raw.split('\n').map(function(l){ return l.replace(/\r$/,''); }).filter(function(l){ return l.trim().length>0; });
  var reFecha = /^(\d{2})\/(\d{2})\/(\d{2})\s+(.*)$/;
  // Los importes de línea en estos resúmenes NO llevan separador de miles ("13608,33", no
  // "13.608,33") — a diferencia de subtotales como "TOTAL TARJETA" que sí lo llevan. El primer
  // grupo de dígitos queda sin acotar (\d+, no \d{1,3}) para no truncar el número si el patrón de
  // grupos de miles no aparece: con \d{1,3} un importe como "50003,02" hace backtrack y matchea
  // solo "003,02", perdiendo el "50" de adelante.
  var reMoney = /-?\d+(?:\.\d{3})*,\d{2}-?/g;
  var reCuota = /C\.\s*(\d{1,2})\s*\/\s*(\d{1,2})/i;
  var reUsdMonto = /USD\s*[\d.,]+/gi;
  // Ojo: no se puede cerrar con \b después de "*" (no es un carácter de "palabra", así que \b no
  // marca límite ahí) — se usa un lookahead de espacio/fin de texto en su lugar.
  var reComprobante = /\b\d{4,7}[A-Z*](?=\s|$)/g;

  // vencimientoStr viene en formato ISO (yyyy-mm-dd) del input de fecha; se pasa a dd-mm-aa corto
  // porque el resto del pipeline de importación (fechaCortaAISO) espera ese formato en "fecha".
  var vf = (vencimientoStr||'').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var fechaOut = vf ? (vf[3]+'-'+vf[2]+'-'+vf[1].slice(2)) : (vencimientoStr||'').trim();

  var rows = [];
  lines.forEach(function(line){
    var fm = line.trim().match(reFecha);
    if(!fm) return; // filtra headers, "TOTAL TARJETA", texto de planes de cuotas al pie, etc.
    var fechaConsumo = fm[1]+'-'+fm[2]+'-'+fm[3];
    var resto = fm[4];
    if(/su pago/i.test(resto) || /pago en pesos/i.test(resto)) return;

    var montos = resto.match(reMoney);
    if(!montos || !montos.length) return;
    var moneyTok = montos[montos.length-1];
    var medio = resto.slice(0, resto.lastIndexOf(moneyTok));

    var cuota = '';
    var mc = medio.match(reCuota);
    if(mc){ cuota = mc[1]+'/'+mc[2]; medio = medio.slice(0, mc.index) + medio.slice(mc.index + mc[0].length); }

    var detalle = medio
      .replace(reUsdMonto, ' ')
      .replace(reComprobante, ' ')
      .replace(/\$/g, ' ')
      .replace(/\s+/g,' ')
      .trim();
    if(!detalle) return;

    var isNeg = /^-/.test(moneyTok) || /-$/.test(moneyTok);
    var cleaned = moneyTok.replace(/-/g,'');
    var val = parseMonto(cleaned);
    if(val === null || isNaN(val)) return;
    if(isNeg) val = -val;
    var monto = -val;

    rows.push({
      fecha: fechaOut,
      fechaConsumo: fechaConsumo,
      proveedor: detalle,
      tipo: '',
      cuota: cuota,
      monto: monto,
      ingreso: monto>0 ? formatMonto(monto) : '',
      egreso: monto<0 ? formatMonto(monto) : ''
    });
  });
  return rows;
}

function parseTarjeta(raw, vencimientoStr){
  var lines = raw.split('\n').map(function(l){ return l.replace(/\r$/,''); }).filter(function(l){ return l.trim().length>0; });
  var reFecha = /^(\d{2})\.(\d{2})\.(\d{2})\b/;
  var reMoney = /^-?\$?\d{1,3}(?:\.\d{3})*,\d{2}-?$/;
  var reComprobante = /^\d+\*?$/;

  // vencimientoStr viene en formato ISO (yyyy-mm-dd) del input de fecha; se pasa a dd-mm-aa corto
  // porque el resto del pipeline de importación (fechaCortaAISO) espera ese formato en "fecha".
  var vf = (vencimientoStr||'').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var fechaOut = vf ? (vf[3]+'-'+vf[2]+'-'+vf[1].slice(2)) : (vencimientoStr||'').trim();

  var rows = [];
  lines.forEach(function(line){
    var trimmed = line.trim();
    var fm = trimmed.match(reFecha);
    if(!fm) return;
    var fechaConsumo = fm[1]+'-'+fm[2]+'-'+fm[3];

    var tokens = trimmed.split(/\s+/).filter(function(t){ return t.length>0; });
    var rest = tokens.slice(1);
    if(rest.length && reComprobante.test(rest[0])) rest = rest.slice(1);

    var moneyIdx = -1;
    for(var i=0;i<rest.length;i++){ if(reMoney.test(rest[i])){ moneyIdx = i; break; } }
    if(moneyIdx === -1) return;

    var moneyTok = rest[moneyIdx];
    var detalleCrudo = rest.slice(0, moneyIdx).filter(function(w){ return w !== '$'; }).join(' ');
    var cuota = '';
    var mCuota = detalleCrudo.match(/\bCuota\s+(\d+)\/(\d+)\b/i) || detalleCrudo.match(/\bC\.(\d+)\/(\d+)\b/i);
    if(mCuota) cuota = mCuota[1]+'/'+mCuota[2];
    var detalle = detalleCrudo
      .replace(/\bCuota\s+\d+\/\d+\b/i,'')
      .replace(/\bC\.\d+\/\d+\b/i,'')
      .replace(/\s+/g,' ')
      .trim();
    if(!detalle) return;
    if(/^su pago/i.test(detalle) || /pago en pesos/i.test(detalle)) return;

    var cleaned = moneyTok.replace(/\$/g,'');
    var isNeg = /^-/.test(cleaned) || /-$/.test(cleaned);
    cleaned = cleaned.replace(/-/g,'');
    var val = parseMonto(cleaned);
    if(val === null || isNaN(val)) return;
    if(isNeg) val = -val;
    var monto = -val;

    rows.push({
      fecha: fechaOut,
      fechaConsumo: fechaConsumo,
      proveedor: detalle,
      tipo: '',
      cuota: cuota,
      monto: monto,
      ingreso: monto>0 ? formatMonto(monto) : '',
      egreso: monto<0 ? formatMonto(monto) : ''
    });
  });
  return rows;
}

var MESES_ABR_MAP = {ene:'01',feb:'02',mar:'03',abr:'04',may:'05',jun:'06',jul:'07',ago:'08',sep:'09',set:'09',oct:'10',nov:'11',dic:'12'};

// Resumen de Tarjeta de Crédito Mercado Pago: cada fila trae su propia fecha (dd/mmm, sin año) y
// puede venir en Pesos ($) o Dólares (US$). Las filas en dólares se descartan (no hay forma de
// cargarlas junto con las de pesos sin un campo de moneda en "movimientos") y se informan aparte.
function parseTarjetaMercadoPago(raw, anio, vencimientoStr){
  var text = raw.replace(/\s+/g, ' ').trim();
  var yy = (anio||'26').toString().trim();
  if(yy.length===4) yy = yy.slice(2);

  // vencimientoStr viene en formato ISO (yyyy-mm-dd) del input de fecha; se pasa a dd-mm-aa corto
  // porque el resto del pipeline de importación (fechaCortaAISO) espera ese formato en "fecha".
  var vfVenc = (vencimientoStr||'').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var fechaOut = vfVenc ? (vfVenc[3]+'-'+vfVenc[2]+'-'+vfVenc[1].slice(2)) : (vencimientoStr||'').trim();

  var reFecha = /(\d{1,2})\/([a-záéíóúñ]{3,4})\b/gi;
  var marcas = [];
  var m;
  while((m = reFecha.exec(text)) !== null){
    var mesCod = MESES_ABR_MAP[m[2].toLowerCase()];
    if(!mesCod) continue; // token con "/" que no corresponde a un mes válido (evita falsos positivos)
    marcas.push({ index: m.index, largo: m[0].length, dia: m[1].padStart(2,'0'), mes: mesCod });
  }

  var reFila = /^(.+?)(?:\s+(\d+)\s+de\s+(\d+))?\s+(\d+)\s+(\$|US\$)\s*([\d.,]+)/i;
  var rows = [];
  var omitidas = 0;

  marcas.forEach(function(marca, idx){
    var desde = marca.index + marca.largo;
    var hasta = (idx+1 < marcas.length) ? marcas[idx+1].index : text.length;
    var segmento = text.slice(desde, hasta).trim();
    var fm = segmento.match(reFila);
    if(!fm) return;

    if(fm[5].toUpperCase() !== '$'){ omitidas++; return; } // fila en dólares

    var detalle = fm[1].replace(/\s+/g,' ').trim();
    if(!detalle) return;

    var val = parseMonto(fm[6]);
    if(val === null || isNaN(val)) return;
    var monto = -val; // un consumo de tarjeta es un egreso

    rows.push({
      fecha: fechaOut,
      fechaConsumo: marca.dia+'-'+marca.mes+'-'+yy,
      proveedor: detalle,
      tipo: '',
      monto: monto,
      ingreso: monto>0 ? formatMonto(monto) : '',
      egreso: monto<0 ? formatMonto(monto) : ''
    });
  });

  return { rows: rows, omitidas: omitidas };
}

function parseProvincia(raw){
  var lines = raw.split('\n').map(function(l){ return l.replace(/\r$/,'').trim(); }).filter(function(l){ return l.length>0; });
  var reFecha = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  var reSaldoLabel = /^saldo:?$/i;
  var reMontoSolo = /^\$\s*[\d.,]+$/;
  var reMontoConSigno = /^(-?)\$\s*([\d.,]+)$/;
  var rows = [];
  var i = 0;
  while(i < lines.length){
    var fm = lines[i].match(reFecha);
    if(!fm){ i++; continue; }
    var fecha = fm[1]+'-'+fm[2]+'-'+fm[3].slice(2);
    i++;
    var detalleLineas = [];
    while(i < lines.length && !reSaldoLabel.test(lines[i]) && !reFecha.test(lines[i])){
      detalleLineas.push(lines[i]);
      i++;
    }
    if(i < lines.length && reSaldoLabel.test(lines[i])) i++; // saltar "Saldo:"
    if(i < lines.length && reMontoSolo.test(lines[i])) i++; // saltar el saldo resultante ("$ X.XXX,XX")
    if(i >= lines.length) break;
    var mm = lines[i].match(reMontoConSigno);
    if(!mm){ i++; continue; }
    i++;
    var val = parseMonto(mm[2]);
    var monto = mm[1]==='-' ? -Math.abs(val) : Math.abs(val);
    var detalle = detalleLineas.join(' ').trim();
    rows.push({
      fecha: fecha,
      proveedor: detalle || 'Movimiento',
      tipo: '',
      monto: monto,
      ingreso: monto>0 ? formatMonto(monto) : '',
      egreso: monto<0 ? formatMonto(monto) : ''
    });
  }
  return rows;
}

function parseNacion(raw){
  var lines = raw.split('\n').map(function(l){ return l.replace(/\r$/,''); }).filter(function(l){ return l.trim().length>0; });
  var reFecha = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  var reMontoField = /\$\s*[\d.,]+/;
  var reMontoExtract = /(-?)\s*\$\s*([\d.,]+)/;
  var rows = [];
  lines.forEach(function(line){
    var parts = line.split('\t').map(function(p){ return p.trim(); }).filter(function(p){ return p.length>0; });
    if(parts.length < 3){
      parts = line.split(/\s{2,}/).map(function(p){ return p.trim(); }).filter(function(p){ return p.length>0; });
    }
    if(!parts.length) return;
    var fm = parts[0].match(reFecha);
    if(!fm) return;
    var fecha = fm[1]+'-'+fm[2]+'-'+fm[3].slice(2);
    var resto = parts.slice(1);
    var montoIdx = -1;
    for(var i=0;i<resto.length;i++){
      if(reMontoField.test(resto[i])){ montoIdx = i; break; }
    }
    if(montoIdx === -1) return;
    var mm = resto[montoIdx].match(reMontoExtract);
    if(!mm) return;
    var val = parseMonto(mm[2]);
    var monto = mm[1]==='-' ? -Math.abs(val) : Math.abs(val);
    var concepto = resto.slice(0, montoIdx).filter(function(p){ return !/^\d+$/.test(p); }).join(' ').trim();
    rows.push({
      fecha: fecha,
      proveedor: concepto || 'Movimiento',
      tipo: '',
      monto: monto,
      ingreso: monto>0 ? formatMonto(monto) : '',
      egreso: monto<0 ? formatMonto(monto) : ''
    });
  });
  return rows;
}

function extraerProveedorSantander(tipo, detalle){
  var m = detalle.match(/^(De|A)\s+(.+)$/i);
  if(m){
    var resto = m[2];
    var partes = resto.split('/');
    return partes[0].replace(/,/g,' ').replace(/\s+/g,' ').trim();
  }
  var m2 = detalle.match(/^(.+?)\s*-\s*\d+$/);
  if(m2) return m2[1].trim();
  return tipo;
}

function parseSantander(raw){
  var lines = raw.split('\n').map(function(l){ return l.trim(); }).filter(function(l){ return l.length>0; });
  var reFecha = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  var reMontoLine = /pesos argentino/i;
  var reMontoExtract = /([+\-]?)\$([\d.,]+)\s*$/;

  var blocks = [];
  var current = null;
  lines.forEach(function(l){
    if(reFecha.test(l)){
      if(current) blocks.push(current);
      current = { fecha: l, lines: [] };
    } else if(current){
      current.lines.push(l);
    }
  });
  if(current) blocks.push(current);

  var rows = [];
  blocks.forEach(function(b){
    var fp = b.fecha.match(reFecha);
    if(!fp) return;
    var fecha = fp[1]+'-'+fp[2]+'-'+fp[3].slice(2);
    if(!b.lines.length) return;
    var tipo = b.lines[0];
    var idx = 1;
    var detalleLines = [];
    while(idx < b.lines.length && !reMontoLine.test(b.lines[idx])){
      detalleLines.push(b.lines[idx]);
      idx++;
    }
    var detalle = detalleLines.join(' / ');
    if(idx >= b.lines.length) return;
    var montoLine = b.lines[idx];
    var mm = montoLine.match(reMontoExtract);
    if(!mm) return;
    var val = parseMonto(mm[2]);
    var monto = mm[1]==='-' ? -Math.abs(val) : Math.abs(val);
    var proveedor = extraerProveedorSantander(tipo, detalle);
    rows.push({
      fecha: fecha,
      proveedor: proveedor,
      tipo: tipo,
      monto: monto,
      ingreso: monto>0 ? formatMonto(monto) : '',
      egreso: monto<0 ? formatMonto(monto) : ''
    });
  });
  return rows;
}

// ===================== HELPERS DE IMPORTACIÓN =====================
function fechaCortaAISO(fCorta){
  var m = (fCorta||'').match(/^(\d{2})-(\d{2})-(\d{2,4})$/);
  if(!m) return '';
  var yy = m[3].length===2 ? '20'+m[3] : m[3];
  return yy+'-'+m[2]+'-'+m[1];
}

function buscarReglaParaProveedor(proveedor){
  var texto = (proveedor||'').toLowerCase();
  if(!texto) return null;
  var candidatas = (STATE.reglas||[]).filter(function(r){
    return r.proveedor && texto.indexOf(r.proveedor.toLowerCase()) !== -1;
  });
  if(!candidatas.length) return null;
  candidatas.sort(function(a,b){ return b.proveedor.length - a.proveedor.length; }); // preferir el match más específico (texto más largo)
  return candidatas[0];
}
function resolverCategoriaSubcategoriaPorNombre(categoriaNombre, subcategoriaNombre){
  var cat = STATE.categorias.find(function(c){ return (c.nombre||'').toLowerCase() === (categoriaNombre||'').toLowerCase(); });
  if(!cat) return { categoriaId:'', subcategoriaId:'' };
  var subId = '';
  if(subcategoriaNombre){
    var sub = STATE.subcategorias.find(function(s){ return s.categoriaId===cat.id && (s.nombre||'').toLowerCase()===subcategoriaNombre.toLowerCase(); });
    if(sub) subId = sub.id;
  }
  return { categoriaId: cat.id, subcategoriaId: subId };
}
function aplicarReglaAFila(proveedor){
  var regla = buscarReglaParaProveedor(proveedor);
  if(!regla) return { categoriaId:'', subcategoriaId:'' };
  return resolverCategoriaSubcategoriaPorNombre(regla.categoria, regla.subcategoria);
}
async function agregarOActualizarRegla(proveedorTexto, categoriaNombre, subcategoriaNombre){
  var texto = (proveedorTexto||'').trim();
  if(!texto || !categoriaNombre) return;
  var existente = STATE.reglas.find(function(r){ return r.proveedor.toLowerCase() === texto.toLowerCase(); });
  if(existente){
    existente.categoria = categoriaNombre;
    existente.subcategoria = subcategoriaNombre||'';
    await dbUpdate('reglas_categorizacion', existente.id, {categoria:categoriaNombre, subcategoria:subcategoriaNombre||null});
  } else {
    var nueva = { id: uid(), proveedor: texto, categoria: categoriaNombre, subcategoria: subcategoriaNombre||'' };
    await dbInsert('reglas_categorizacion', [toDbRegla(nueva)]);
    STATE.reglas.push(nueva);
  }
}

// ===================== DETECCIÓN DE DUPLICADOS EN IMPORTACIÓN =====================
// Un movimiento se considera "el mismo" si coincide Centro de Costo, día y el monto (con
// signo: ingreso positivo, egreso negativo). El proveedor NO se usa para comparar: en las
// entidades que parsean el detalle crudo del resumen (Provincia, Nación, Santander) ese texto
// suele quedar feo y el usuario lo prolija después de importar; si comparáramos por proveedor,
// una fila re-pegada de un resumen superpuesto dejaría de matchear contra el movimiento ya
// guardado (con el proveedor editado) y el aviso de duplicado no aparecería.
function montoSignedMovimiento(m){
  var ingreso = Number(m.ingreso)||0, egreso = Number(m.egreso)||0;
  return ingreso>0 ? ingreso : -egreso;
}
function normalizarProveedor(p){ return (p||'').trim().toLowerCase(); }
function montosIguales(a, b){ return Math.round((Number(a)||0)*100) === Math.round((Number(b)||0)*100); }

function existeMovimientoIgual(fecha, centroId, proveedor, monto){
  if(!fecha || !centroId) return false;
  return STATE.movimientos.some(function(m){
    return m.fecha===fecha && m.centroId===centroId && montosIguales(montoSignedMovimiento(m), monto);
  });
}

// Recibe una lista normalizada [{id, fecha, centroId, proveedor, monto}] y devuelve un mapa
// id -> true para las filas que son posible duplicado: ya existe un movimiento igual guardado,
// o se repite otra fila del mismo lote pegado (p. ej. el usuario pegó el resumen dos veces).
function calcularDuplicados(filasNormalizadas){
  var dupIds = {};
  filasNormalizadas.forEach(function(f, i){
    if(existeMovimientoIgual(f.fecha, f.centroId, f.proveedor, f.monto)){ dupIds[f.id] = true; return; }
    for(var j=0;j<filasNormalizadas.length;j++){
      if(j===i) continue;
      var o = filasNormalizadas[j];
      if(o.fecha===f.fecha && o.centroId===f.centroId && montosIguales(o.monto, f.monto)){
        dupIds[f.id] = true; break;
      }
    }
  });
  return dupIds;
}

// Suma n meses a una fecha ISO (YYYY-MM-DD), ajustando al último día del mes
// destino si este tiene menos días (ej: 31-01 + 1 mes -> 28/29-02, no 03-03).
function sumarMeses(fechaISO, n){
  var m = (fechaISO||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return fechaISO;
  var y = parseInt(m[1],10), mes = parseInt(m[2],10), dia = parseInt(m[3],10);
  var total = (mes-1) + n;
  var nuevoY = y + Math.floor(total/12);
  var nuevoMes = ((total % 12) + 12) % 12; // 0-11
  var ultimoDia = new Date(nuevoY, nuevoMes+1, 0).getDate();
  var nuevoDia = Math.min(dia, ultimoDia);
  return nuevoY+'-'+String(nuevoMes+1).padStart(2,'0')+'-'+String(nuevoDia).padStart(2,'0');
}

function parseFechaFlexible(s){
  if(!s) return '';
  s = s.trim();
  var m;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) return m[1]+'-'+m[2]+'-'+m[3];
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if(m){
    var dd1 = m[1].padStart(2,'0'), mm1 = m[2].padStart(2,'0');
    var yy1 = m[3].length===2 ? '20'+m[3] : m[3];
    return yy1+'-'+mm1+'-'+dd1;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(m){
    var dd2 = m[1].padStart(2,'0'), mm2 = m[2].padStart(2,'0');
    var yy2 = m[3].length===2 ? '20'+m[3] : m[3];
    return yy2+'-'+mm2+'-'+dd2;
  }
  return '';
}

function parseNumeroFlexible(s){
  if(!s) return 0;
  s = String(s).trim().replace(/[^\d.,\-]/g,'');
  if(!s) return 0;
  var lastComma = s.lastIndexOf(',');
  var lastDot = s.lastIndexOf('.');
  var val;
  if(lastComma > -1 && lastDot > -1){
    val = lastComma > lastDot ? parseFloat(s.replace(/\./g,'').replace(',','.')) : parseFloat(s.replace(/,/g,''));
  } else if(lastComma > -1){
    val = parseFloat(s.replace(/\./g,'').replace(',','.'));
  } else if(lastDot > -1){
    var afterDot = s.length - lastDot - 1;
    val = (afterDot === 2) ? parseFloat(s) : parseFloat(s.replace(/\./g,''));
  } else {
    val = parseFloat(s);
  }
  return isNaN(val) ? 0 : val;
}
// Cantidad tipeada a mano (p. ej. USDT): acepta coma o punto como decimal ("12,5" / "12.5").
// Si hay ambos, el último es el decimal. A diferencia de parseNumeroFlexible, un punto solo
// siempre es decimal (las cantidades de USDT suelen tener más de 2 decimales).
function parseCantidadDecimal(s){
  s = String(s||'').trim().replace(/[^\d.,\-]/g,'');
  if(!s) return 0;
  var lastComma = s.lastIndexOf(',');
  var lastDot = s.lastIndexOf('.');
  var dec = lastComma > lastDot ? ',' : '.';
  var entero = s.slice(0, Math.max(lastComma, lastDot)).replace(/[.,]/g,'');
  var val = (lastComma === -1 && lastDot === -1) ? parseFloat(s)
    : (s.split(dec).length > 2 ? parseFloat(s.replace(/[.,]/g,'')) // "1.234.567": solo miles
    : parseFloat(entero + '.' + s.slice(Math.max(lastComma, lastDot)+1)));
  return isNaN(val) ? 0 : val;
}

function parseExcelHistorico(raw){
  var lines = raw.split('\n').map(function(l){ return l.replace(/\r$/,''); }).filter(function(l){ return l.trim().length>0; });
  var rows = [];
  lines.forEach(function(line){
    var cols = line.split('\t');
    if(cols.length < 10){ cols = line.split(/\s{2,}/); }
    if(cols.length < 10) return;
    var periodo = (cols[0]||'').trim();
    var categoria = (cols[2]||'').trim();
    var subcategoria = (cols[3]||'').trim();
    var cc = (cols[4]||'').trim();
    var fechaRaw = (cols[5]||'').trim();
    var proveedor = (cols[6]||'').trim();
    var detalle = (cols[7]||'').trim();
    var ingresosRaw = (cols[8]||'').trim();
    var egresosRaw = (cols[9]||'').trim();

    if(/^periodo$/i.test(periodo) && /^categor/i.test(categoria)) return; // fila de encabezado

    var fecha = parseFechaFlexible(fechaRaw);
    var ingreso = parseNumeroFlexible(ingresosRaw);
    var egreso = parseNumeroFlexible(egresosRaw);
    if(!fecha && !proveedor && !ingreso && !egreso) return;

    rows.push({ fecha: fecha, cc: cc, categoria: categoria, subcategoria: subcategoria,
      proveedor: proveedor, detalle: detalle, ingreso: ingreso||0, egreso: egreso||0 });
  });
  return rows;
}

// Importadores (D7): las filas de la tabla "importadores" se conectan por código con su parser. Los de
// tarjeta ("tarjeta_<banco>") se eligen en pantalla como "Tarjeta de Crédito" + banco. Agregar un banco =
// parser acá + fila en la tabla (schema.sql).
var PARSERS_IMPORTACION = ['mp', 'santander', 'nacion', 'provincia',
  'tarjeta_nacion', 'tarjeta_santander', 'tarjeta_provincia', 'tarjeta_mercadopago', 'excel'];
function esImportadorTarjeta(codigo){ return codigo.indexOf('tarjeta_')===0; }
var IMPORTADORES_SIN_PARSER_AVISADOS = {};
// Los que ve la familia: activos, con parser, no ocultos para ella y (los de tarjeta) con Tarjetas prendida.
function importadoresVisibles(){
  return STATE.importadores.filter(function(i){
    if(!i.activo) return false;
    if(PARSERS_IMPORTACION.indexOf(i.codigo)===-1){
      if(!IMPORTADORES_SIN_PARSER_AVISADOS[i.codigo]){
        IMPORTADORES_SIN_PARSER_AVISADOS[i.codigo] = true;
        if(window.console) console.warn('Importador "'+i.codigo+'" sin parser en app.js: no se muestra.');
      }
      return false;
    }
    if(STATE.importadoresOcultos.indexOf(i.codigo)!==-1) return false;
    return !esImportadorTarjeta(i.codigo) || funcionActiva('tarjetas');
  });
}

function runParser(){
  var entidad = STATE.importEntidad;
  var raw = STATE.importRaw || '';
  if(!raw.trim()) return { rows: [], error: 'Pegá el texto del resumen primero.' };
  if(entidad === 'mp') return { rows: procesarTexto(raw, anioActualCorto()), error: null };
  if(entidad === 'santander') return { rows: parseSantander(raw), error: null };
  if(entidad === 'nacion') return { rows: parseNacion(raw), error: null };
  if(entidad === 'provincia') return { rows: parseProvincia(raw), error: null };
  if(entidad === 'tarjeta'){
    var venc = STATE.importVencimiento || '';
    if(!venc.trim()) return { rows: [], error: 'Ingresá la fecha de vencimiento del resumen.' };
    var banco = STATE.importBanco || 'nacion';
    if(banco === 'mercadopago'){
      // el resumen de MP trae fecha propia por fila (dd/mmm, sin año): se usa como Fecha de consumo,
      // y el Vencimiento tipeado (con el que también se deduce el año de esas fechas) queda como fecha
      // del movimiento, igual que en Nación/Santander.
      var anioMp = /^\d{4}/.test(venc.trim()) ? venc.trim().slice(2,4) : '26';
      var resMp = parseTarjetaMercadoPago(raw, anioMp, venc);
      return { rows: resMp.rows, error: null, omitidas: resMp.omitidas };
    }
    var rows = (banco === 'santander' || banco === 'nacion') ? parseTarjetaResumen(raw, venc) : parseTarjeta(raw, venc);
    return { rows: rows, error: null };
  }
  if(entidad === 'excel') return { rows: [], error: null }; // se maneja aparte en el handler de preview-import
  return { rows: [], error: 'Entidad no reconocida.' };
}

// ===================== RENDER PRINCIPAL =====================
// Reemplazar app.innerHTML mientras un input tiene el foco dispara blur/focus síncronos sobre ese
// nodo; como algunos de esos handlers (combobox) a su vez llaman a render(), sin esta guarda se
// entra en una recursión infinita (reemplazar el DOM dispara blur/focus, que llama a render(), que
// vuelve a reemplazar el DOM...). Si ya hay un render en curso, los mutan STATE igual pero el
// re-render efectivo queda para la próxima llamada real (siempre llega enseguida: el próximo
// tipeo, o el blur final al salir del campo).
var RENDER_EN_CURSO = false;
function render(){
  if(RENDER_EN_CURSO) return;
  RENDER_EN_CURSO = true;
  try{
    renderInterno();
  } finally {
    RENDER_EN_CURSO = false;
  }
}
function renderInterno(){
  var app = document.getElementById('app');
  if(!STATE.ready){ app.innerHTML = '<div class="loading">Cargando datos...</div>'; return; }
  if(STATE.sinFamilia){
    app.innerHTML = '<div class="login-wrap"><div class="login-card">'+
      '<h1 style="font-size:24px;margin-bottom:8px">Control</h1>'+
      '<div class="msg err" style="margin-bottom:16px">Tu usuario ('+esc(STATE.usuarioEmail||'')+') no está asignado a ninguna familia. Pedile al soporte que te agregue.</div>'+
      '<button data-action="cerrar-sesion" style="width:100%">Cerrar sesión</button>'+
    '</div></div>';
    app.querySelector('[data-action="cerrar-sesion"]').addEventListener('click', function(){ handleAction('cerrar-sesion'); });
    return;
  }

  // Guardar qué campo de texto tenía el foco (y en qué posición del cursor), para
  // restaurarlo después de reconstruir el HTML — si no, cada letra tipeada te saca el foco.
  var focoActivo = document.activeElement;
  var focoPendiente = null;
  if(focoActivo && focoActivo.id && (focoActivo.tagName==='INPUT' || focoActivo.tagName==='TEXTAREA')){
    focoPendiente = { id: focoActivo.id, start: focoActivo.selectionStart, end: focoActivo.selectionEnd };
  }

  // Guardar el scroll de la lista del filtro múltiple abierto (si hay uno): al tildar una opción
  // se re-renderiza todo el HTML y, sin esto, la lista vuelve a mostrarse desde arriba en vez de
  // quedarse donde el usuario la había dejado (molesto si tildás varias opciones seguidas).
  var multiSelectScrollTop = null;
  if(STATE.multiSelectAbierto){
    var msListPrevia = document.querySelector('[data-multiselect-wrap="'+STATE.multiSelectAbierto+'"] .multiselect-list');
    if(msListPrevia) multiSelectScrollTop = msListPrevia.scrollTop;
  }

  MODAL_HTML = '';

  // Agrupados por intención: ver (Resumen) → día a día → consultar/analizar → herramientas.
  // separadorAntes dibuja una línea fina entre grupos en el menú lateral.
  var tabs = [
    {id:'resumen', label:'Resumen', icono:'bi-bar-chart-line'},
    {id:'movimientos', label:'Movimientos', icono:'bi-receipt', separadorAntes:true},
    {id:'vencimientos', label:'Vencimientos', icono:'bi-alarm'},
    {id:'saldos', label:'Saldos', icono:'bi-bank', separadorAntes:true},
    {id:'flujo', label:'Flujo de Caja', icono:'bi-graph-up-arrow'},
    {id:'usdt', label:'USDT', icono:'bi-coin'},
    {id:'dolares', label:'Dólares', icono:'bi-currency-dollar'},
    {id:'importar', label:'Importar', icono:'bi-cloud-arrow-down', separadorAntes:true},
    {id:'abm', label:'ABM', icono:'bi-gear'}
  ];
  // Pestañas de funciones opcionales: solo si la familia las tiene prendidas.
  var funcionDeTab = { usdt:'usdt', dolares:'dolares', flujo:'flujo_caja' };
  tabs = tabs.filter(function(t){ return !funcionDeTab[t.id] || funcionActiva(funcionDeTab[t.id]); });
  if(STATE.esSuperadmin){
    tabs = tabs.filter(function(t){ return t.id!=='importar'; });
    tabs.push({id:'admin', label:'Administración', icono:'bi-shield-lock', separadorAntes:true});
  }
  if(!tabs.some(function(t){ return t.id===STATE.activeTab; })) STATE.activeTab = 'resumen';

  var sidebarHtml = '<div class="sidebar'+(STATE.menuMovilAbierto?' abierto':'')+'">'+
    '<div class="masthead"><span class="masthead-mark"><i class="bi bi-piggy-bank"></i></span><h1>Control</h1><div class="tagline">Control económico<br>datos compartidos</div></div>'+
    '<button data-action="abrir-nuevo-mov" title="Nuevo movimiento" style="width:100%;margin-bottom:16px;font-size:14px;padding:12px">+<span class="tab-label"> Movimiento</span></button>'+
    '<div class="tabs">';
  tabs.forEach(function(t){
    if(t.separadorAntes) sidebarHtml += '<div class="tab-separador" role="separator"></div>';
    sidebarHtml += '<div class="tab '+(STATE.activeTab===t.id?'active':'')+'" data-tab="'+t.id+'" title="'+esc(t.label)+'"><span class="tab-icon"><i class="bi '+t.icono+'"></i></span><span class="tab-label">'+esc(t.label)+'</span></div>';
  });
  sidebarHtml += '</div>'+
    '</div>';

  var tabActual = tabs.find(function(t){ return t.id===STATE.activeTab; });
  var tituloSeccion = tabActual ? tabActual.label : 'Control';

  var mobileTopbarHtml = '<div class="mobile-topbar">'+
    '<div style="display:flex;align-items:center;gap:8px;min-width:0">'+
      '<button class="hamburger-btn" data-action="toggle-menu-movil" aria-label="Abrir menú"><i class="bi bi-list"></i></button>'+
      '<h1>Control</h1>'+
    '</div>'+
    '<div style="display:flex;align-items:center;gap:10px;flex-shrink:0">'+
      '<button class="mobile-add-btn" data-action="abrir-efectivo" title="Cargar efectivo" aria-label="Cargar efectivo"><i class="bi bi-cash-coin"></i></button>'+
      renderSelectorFamilia('sel-familia-movil')+
      renderMenuUsuario()+
    '</div>'+
  '</div>'+
  '<div class="sidebar-backdrop'+(STATE.menuMovilAbierto?' visible':'')+'" data-action="cerrar-menu-movil"></div>';

  var contentHtml = '<div class="topbar-desktop"><h2 class="topbar-titulo">'+esc(tituloSeccion)+'</h2>'+
    '<div style="display:flex;align-items:center;gap:12px">'+renderSelectorFamilia('sel-familia')+renderMenuUsuario()+'</div></div>';
  if(STATE.dbError){
    contentHtml += '<div class="msg err" style="margin-bottom:14px">'+esc(STATE.dbError)+'</div>';
  }

  contentHtml += '<div class="panel active">';
  if(STATE.activeTab==='movimientos') contentHtml += renderMovimientos();
  else {
    // Los movimientos pendientes (fecha futura) se editan/borran desde la pestaña Vencimientos, y el
    // botón "+ Movimiento" del sidebar abre el alta desde cualquier pestaña. El modal (edición o alta)
    // vive dentro de renderMovimientos(), así que hay que construirlo igual aunque no se muestre el
    // listado completo de esa pestaña.
    if((STATE.editing && STATE.editing.type==='mov') || STATE.nuevoMovAbierto) renderMovimientos();
    if(STATE.activeTab==='importar') contentHtml += renderImportar();
    else if(STATE.activeTab==='vencimientos') contentHtml += renderVencimientos();
    else if(STATE.activeTab==='saldos') contentHtml += renderSaldos();
    else if(STATE.activeTab==='resumen') contentHtml += renderResumen();
    else if(STATE.activeTab==='flujo') contentHtml += renderFlujoCaja();
    else if(STATE.activeTab==='usdt') contentHtml += renderUsdt();
    else if(STATE.activeTab==='dolares') contentHtml += renderDolares();
    else if(STATE.activeTab==='abm') contentHtml += renderABM();
    else if(STATE.activeTab==='admin' && STATE.esSuperadmin) contentHtml += renderAdministracion();
  }
  contentHtml += '</div>';

  contentHtml += '<footer class="small">Los datos se guardan en la base de datos compartida: vos y quien tenga usuario ven y editan la misma información.</footer>';

  if(STATE.confirmState){
    var csClaseSi = STATE.confirmState.destructivo===false ? '' : 'danger';
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="confirm"><div class="modal-card">'+
      '<div style="margin-bottom:16px">'+esc(STATE.confirmState.message)+'</div>'+
      '<button'+(csClaseSi?' class="'+csClaseSi+'"':'')+' data-action="confirm-yes">'+esc(STATE.confirmState.textoConfirmar||'Sí, borrar')+'</button> '+
      '<button class="secondary" data-action="confirm-no">Cancelar</button>'+
    '</div></div>';
  }

  if(STATE.vencPagarState){
    var vps = STATE.vencimientos.find(function(x){return x.id===STATE.vencPagarState.id;});
    if(vps){
      var yaCargadosPagar = movimientosDelVencimiento(vps);
      MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="pagar-venc"><div class="modal-card">'+
        '<div style="margin-bottom:16px">¿Marcar "'+esc(vps.concepto)+'" como pagado?</div>'+
        (yaCargadosPagar.length ? '<div class="info-box warning" style="margin-bottom:12px"><i class="bi bi-info-circle"></i> '+
          esc(textoMovimientoYaCargado(yaCargadosPagar))+' Si lo cargás como movimiento, va a quedar dos veces.</div>' : '')+
        '<div class="fields-row" style="flex-direction:column;align-items:stretch;gap:8px">'+
          '<button data-action="pagar-venc-con-mov" data-id="'+vps.id+'">Sí, y cargarlo como movimiento</button>'+
          '<button class="secondary" data-action="pagar-venc-sin-mov" data-id="'+vps.id+'">Sí, sólo marcar pagado</button>'+
          '<button class="secondary" data-action="cancel-pagar-venc">Cancelar</button>'+
        '</div>'+
      '</div></div>';
    }
  }

  if(STATE.subDeleteState){
    var sds = STATE.subDeleteState;
    var otrasSubs = subcategoriasOrdenadas(STATE.subcategorias.filter(function(s){ return s.categoriaId===sds.categoriaId && s.id!==sds.id; }));
    var mensajeSub = sds.afectados > 0
      ? '¿Borrar la subcategoría "'+esc(sds.nombre)+'"? Hay <strong>'+sds.afectados+' movimiento(s)</strong> que la tienen asignada.'
      : '¿Borrar la subcategoría "'+esc(sds.nombre)+'"? No tiene movimientos asignados.';
    var selectorReasignar = (sds.afectados > 0 && otrasSubs.length > 0) ? ''+
      '<div class="field" style="margin-top:12px;margin-bottom:16px">'+
        '<label>¿Qué hacer con esos '+sds.afectados+' movimiento(s)?</label>'+
        '<select id="sub-delete-reasignar">'+
          '<option value="">Dejarlos sin subcategoría</option>'+
          otrasSubs.map(function(s){ return '<option value="'+s.id+'">Reasignar a: '+esc(s.nombre)+'</option>'; }).join('')+
        '</select>'+
      '</div>' : '';
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="subdelete"><div class="modal-card">'+
      '<div style="margin-bottom:8px">'+mensajeSub+'</div>'+
      selectorReasignar+
      '<button class="danger" data-action="sub-delete-confirmar">Sí, borrar</button> '+
      '<button class="secondary" data-action="sub-delete-cancel">Cancelar</button>'+
    '</div></div>';
  }

  if(STATE.efectivoAbierto){
    var centroDefaultId = centroEfectivoRecordado();
    // Draft: conserva lo tipeado (Fecha/Centro/Tipo/Monto/Proveedor/Detalle/Subcategoría) entre
    // renders disparados por el propio modal (p. ej. al elegir Categoría, ver el listener de
    // ef-categoria más abajo) — si no, cada re-render los recrea vacíos porque no tienen otro estado.
    var efd = STATE.efectivoDraft || {};
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="efectivo"><div class="modal-card">'+
      '<h2><i class="bi bi-cash-coin"></i> Cargar efectivo</h2>'+
      (STATE.efectivoMsg ? '<div class="msg err">'+esc(STATE.efectivoMsg)+'</div>' : '')+
      '<div class="fields-row">'+
        '<div class="field"><label>Fecha</label><input type="date" id="ef-fecha" value="'+esc(efd.fecha||fechaHoyISO())+'"></div>'+
        '<div class="field"><label>Centro de Costo</label><select id="ef-centro"><option value="">Elegir...</option>'+
          centrosOrdenados().map(function(c){ return '<option value="'+c.id+'" '+((efd.centroId||centroDefaultId)===c.id?'selected':'')+'>'+esc(c.codigo)+' · '+esc(c.nombre)+'</option>'; }).join('')+
        '</select></div>'+
        '<div class="field"><label>Tipo</label><select id="ef-tipo">'+
          '<option value="egreso" '+((efd.tipo||'egreso')==='egreso'?'selected':'')+'>Egreso</option>'+
          '<option value="ingreso" '+(efd.tipo==='ingreso'?'selected':'')+'>Ingreso</option>'+
        '</select></div>'+
      '</div>'+
      '<div class="fields-row" style="margin-top:10px">'+
        '<div class="field" style="flex:1 1 100%"><label>Monto</label><input type="number" step="0.01" id="ef-monto" placeholder="0.00" value="'+esc(efd.monto||'')+'" style="font-size:18px"></div>'+
      '</div>'+
      '<div class="fields-row" style="margin-top:10px">'+
        '<div class="field"><label>Contraparte (opcional)</label><input type="text" id="ef-proveedor" placeholder="Ej: Kiosco" value="'+esc(efd.proveedor||'')+'"></div>'+
        '<div class="field"><label>Detalle (opcional)</label><input type="text" id="ef-detalle" value="'+esc(efd.detalle||'')+'"></div>'+
      '</div>'+
      '<div class="fields-row" style="margin-top:10px">'+
        '<div class="field"><label>Categoría (opcional)</label><select id="ef-categoria"><option value="">Elegir...</option>'+
          categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'" '+(STATE.efectivoCategoriaId===c.id?'selected':'')+'>'+esc(c.nombre)+'</option>'; }).join('')+
        '</select></div>'+
        '<div class="field"><label>Subcategoría (opcional)</label><select id="ef-subcategoria"><option value="">Elegir...</option>'+
          subcategoriasOrdenadas(STATE.subcategorias.filter(function(s){return s.categoriaId===STATE.efectivoCategoriaId;})).map(function(s){ return '<option value="'+s.id+'" '+(efd.subcategoriaId===s.id?'selected':'')+'>'+esc(s.nombre)+'</option>'; }).join('')+
        '</select></div>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--ink-soft);margin-top:10px">Podés completar Categoría y Subcategoría ahora, o dejarlas para después desde Movimientos.</div>'+
      '<div class="fields-row" style="margin-top:14px">'+
        '<button data-action="guardar-efectivo">Guardar</button>'+
        '<button class="secondary" data-action="cerrar-efectivo">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  }

  if(STATE.usdtVentaMovId){
    var mUvm = STATE.movimientos.find(function(x){ return x.id===STATE.usdtVentaMovId; });
    if(!mUvm){
      STATE.usdtVentaMovId = null;
    } else {
      var cantidadUvmDraft = STATE.usdtVentaMovCantidad || '';
      var cantidadUvmNum = parseCantidadDecimal(cantidadUvmDraft);
      var cotizacionUvmPreview = (cantidadUvmNum>0) ? (Number(mUvm.ingreso)/cantidadUvmNum) : 0;
      MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="usdt-venta-mov"><div class="modal-card">'+
        '<h2><i class="bi bi-coin"></i> Generar movimiento USDT</h2>'+
        '<div style="margin-bottom:10px;font-size:13px;color:var(--ink-soft)">Vinculado al movimiento del '+esc(fechaISOaDDMMAAAA(mUvm.fecha)||mUvm.fecha)+' por '+fmtMonto(mUvm.ingreso)+(mUvm.proveedor?' ('+esc(mUvm.proveedor)+')':'')+'.</div>'+
        (STATE.usdtVentaMovMsg ? '<div class="msg err">'+esc(STATE.usdtVentaMovMsg)+'</div>' : '')+
        '<div class="field"><label>¿Cuántos USDT se vendieron?</label><input type="text" inputmode="decimal" id="uvm-cantidad" placeholder="0.00" value="'+esc(cantidadUvmDraft)+'" style="font-size:18px" autofocus></div>'+
        (cotizacionUvmPreview ? '<div style="font-size:12px;color:var(--ink-soft);margin-top:6px">Cotización resultante: $'+fmtMonto(cotizacionUvmPreview)+' por USDT</div>' : '')+
        '<div class="fields-row" style="margin-top:14px">'+
          '<button data-action="guardar-usdt-venta-mov">Guardar</button>'+
          '<button class="secondary" data-action="cerrar-usdt-venta-mov">Cancelar</button>'+
        '</div>'+
      '</div></div>';
    }
  }

  var html = mobileTopbarHtml + '<div class="layout">'+sidebarHtml+'<div class="main-content">'+contentHtml+'</div></div>' + MODAL_HTML;

  app.innerHTML = html;
  bindEvents();

  if(focoPendiente){
    var elFoco = document.getElementById(focoPendiente.id);
    if(elFoco && (elFoco.tagName==='INPUT' || elFoco.tagName==='TEXTAREA')){
      elFoco.focus();
      if(typeof elFoco.setSelectionRange === 'function' && focoPendiente.start !== null && focoPendiente.start !== undefined){
        try{ elFoco.setSelectionRange(focoPendiente.start, focoPendiente.end); }catch(e){}
      }
    }
  }

  if(multiSelectScrollTop !== null){
    var msListNueva = document.querySelector('[data-multiselect-wrap="'+STATE.multiSelectAbierto+'"] .multiselect-list');
    if(msListNueva) msListNueva.scrollTop = multiSelectScrollTop;
  }
}

var MODAL_HTML = '';

// ===================== CENTROS DE COSTO =====================
var ENTIDADES = [
  {id:'', label:'(sin asignar)'},
  {id:'santander', label:'Santander'},
  {id:'nacion', label:'Nación'},
  {id:'provincia', label:'Provincia'},
  {id:'icbc', label:'ICBC'},
  {id:'mercadopago', label:'Mercado Pago'}
];
var MONEDAS_CENTRO = [
  {id:'ARS', label:'Pesos'},
  {id:'USD', label:'Dólares'},
  {id:'AMBAS', label:'Pesos y dólares'}
];
function campoCentro(codigo, nombre, color, entidad, moneda, titularId){
  return '<div class="field"><label>Código (CC)</label><input type="text" id="f-centro-codigo" placeholder="Ej: MPF" value="'+esc(codigo)+'" style="width:100px;text-transform:uppercase"></div>'+
    '<div class="field"><label>Nombre</label><input type="text" id="f-centro-nombre" placeholder="Ej: Mercado Pago" value="'+esc(nombre)+'" style="width:220px"></div>'+
    '<div class="field"><label>Color</label><input type="color" id="f-centro-color" value="'+esc(color)+'"></div>'+
    '<div class="field"><label>Entidad</label><select id="f-centro-entidad">'+
      ENTIDADES.map(function(e){ return '<option value="'+e.id+'"'+(e.id===(entidad||'')?' selected':'')+'>'+e.label+'</option>'; }).join('')+
    '</select></div>'+
    // Titular (D5): un usuario de la familia. Los nombres se cargan con scripts/sql/alta_miembro.sql.
    '<div class="field"><label>Titular</label><select id="f-centro-titular"><option value="">Sin titular</option>'+
      STATE.miembrosFamilia.map(function(m){ return '<option value="'+esc(m.userId)+'"'+(m.userId===titularId?' selected':'')+'>'+esc(m.nombre)+'</option>'; }).join('')+
    '</select></div>'+
    // Con Dólares apagada no se muestra, pero se conserva la moneda que tenía el centro.
    (funcionActiva('dolares')
      ? '<div class="field"><label>Moneda</label><select id="f-centro-moneda">'+
          MONEDAS_CENTRO.map(function(m){ return '<option value="'+m.id+'"'+(m.id===(moneda||'ARS')?' selected':'')+'>'+m.label+'</option>'; }).join('')+
        '</select></div>'
      : '<input type="hidden" id="f-centro-moneda" value="'+esc(moneda||'ARS')+'">');
}
function renderCentros(){
  var rows = STATE.centros.map(function(c){
    return '<tr><td data-label="Código">'+renderChip(c.codigo, colorCentro(c.id), colorTextoCentro(c.id))+'</td><td data-label="Nombre">'+esc(c.nombre)+'</td>'+
      '<td data-label="Entidad">'+logoEntidadHtml(c)+'</td>'+
      '<td data-label="Titular">'+(titularDeCentro(c) ? esc(nombreMiembro(titularDeCentro(c))) : '<span style="color:var(--ink-soft)">Sin titular</span>')+'</td>'+
      (funcionActiva('dolares') ? '<td data-label="Moneda">'+MONEDAS_CENTRO.find(function(m){ return m.id===monedaCentro(c); }).label+'</td>' : '')+
      '<td class="actions-cell"><button class="link" data-action="edit-centro" data-id="'+c.id+'">editar</button>'+
      '<button class="link" data-action="del-centro" data-id="'+c.id+'">borrar</button></td></tr>';
  }).join('');
  var editing = STATE.editing && STATE.editing.type==='centro' ? STATE.centros.find(function(x){return x.id===STATE.editing.id;}) : null;

  if(editing){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
      '<h2>Editar centro de costo</h2>'+
      '<div class="fields-row">'+ campoCentro(editing.codigo, editing.nombre, colorCentro(editing.id), editing.entidad, monedaCentro(editing), titularDeCentro(editing)) +'</div>'+
      '<div class="fields-row" style="margin-top:14px">'+
        '<button data-action="save-centro" data-id="'+editing.id+'">Guardar cambios</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  }

  var formNuevoCentro = editing ? '' : ''+
  '<div class="card">'+
    '<h2>Nuevo centro de costo</h2>'+
    '<div class="fields-row">'+ campoCentro('', '', PALETA_DONUT[STATE.centros.length % PALETA_DONUT.length], '', 'ARS', '') +
      '<button data-action="save-centro" data-id="">Agregar</button>'+
    '</div>'+
  '</div>';

  return formNuevoCentro +
  '<div class="card">'+
    '<h3>Centros de costo cargados</h3>'+
    (STATE.centros.length ? '<table class="table tabla-movil"><thead><tr><th>Código</th><th>Nombre</th><th>Entidad</th><th>Titular</th>'+(funcionActiva('dolares')?'<th>Moneda</th>':'')+'<th></th></tr></thead><tbody>'+rows+'</tbody></table>' : '<div class="empty">Todavía no cargaste ningún centro de costo.</div>')+
  '</div>';
}

// ===================== CATEGORÍAS =====================
// Tratamiento de la categoría en Resumen y Flujo de caja (campo "tipo"):
//   ''        → normal: cuenta como ingreso/egreso corriente
//   'tec'     → transferencia entre cuentas: no cuenta en ningún reporte
//   'inversion' → se muestra aparte (tarjeta propia) y no se resta de la capacidad de ahorro
//   'sueldo'  → ingreso base de Resumen y de la capacidad de ahorro
//   'control' → solo para llevar la cuenta: no cuenta en reportes ni en los totales de Movimientos
//               (salvo que se filtre por esa categoría), pero sí mueve el saldo de la cuenta en Saldos
var TIPOS_CATEGORIA = [
  {id:'', label:'Normal'},
  {id:'tec', label:'TEC (transferencia entre cuentas)'},
  {id:'inversion', label:'Inversión (se muestra aparte)'},
  {id:'sueldo', label:'Sueldo (ingreso base)'},
  {id:'control', label:'Solo control (no cuenta en reportes)'},
  {id:'venta_usdt', label:'Venta de USDT (destino de las ventas)', funcion:'usdt'}
];
// Ayuda que se muestra abajo del desplegable "Tratamiento en reportes" en el ABM.
function ayudaTipoCategoria(){
  return '<div style="font-size:11px;color:var(--ink-soft);margin-top:10px;line-height:1.5">'+
    '<strong>¿Cuál elegir?</strong> Pensá si esa plata tiene que bajar tu capacidad de ahorro mensual.<br>'+
    '<strong>Normal:</strong> gastos e ingresos del día a día (Super, Servicios, Auto…). Se restan del Saldo y de la capacidad de ahorro.<br>'+
    '<strong>TEC:</strong> plata que pasa de una cuenta tuya a otra tuya. No cuenta en ningún reporte, solo mueve el saldo de cada cuenta.<br>'+
    '<strong>Inversión:</strong> gastos grandes pagados con ahorros que dejan algo de valor (ej. Obra). Tarjeta propia en Resumen y no se resta de la capacidad de ahorro.<br>'+
    '<strong>Sueldo:</strong> tu ingreso fijo. Es el "Total ingresos" de Resumen y la base de la capacidad de ahorro.<br>'+
    '<strong>Solo control:</strong> movimientos que querés registrar y controlar pero que no son ingresos ni gastos tuyos. No cuenta en reportes (sí mueve el saldo de la cuenta en Saldos); en Movimientos sus totales solo se suman si filtrás por esa categoría.'+
    (funcionActiva('usdt') ? '<br><strong>Venta de USDT:</strong> adonde van solos los pesos de cada venta de USDT. No cuenta como ingreso (la plata ya entró como USDT). Puede haber una sola.' : '')+
  '</div>';
}
function tipoLabel(tipo){
  return ({tec:'TEC', inversion:'Inversión', sueldo:'Sueldo', control:'Solo control', venta_usdt:'Venta de USDT'})[tipo] || '—';
}

function renderABM(){
  var subtabs = [
    {id:'categorias', label:'Categorías'},
    {id:'subcategorias', label:'Subcategorías'},
    {id:'centros', label:'Centros de Costo'},
    {id:'reglas', label:'Reglas de categorización'}
  ];
  var html = '<div class="subtabs">';
  subtabs.forEach(function(t){
    html += '<div class="subtab '+(STATE.abmSubTab===t.id?'active':'')+'" data-subtab="'+t.id+'">'+t.label+'</div>';
  });
  html += '</div>';

  if(STATE.abmSubTab === 'subcategorias') html += renderSubcategorias();
  else if(STATE.abmSubTab === 'centros') html += renderCentros();
  else if(STATE.abmSubTab === 'reglas') html += renderReglas();
  else html += renderCategorias();

  return html;
}

// Reglas de categorización: proveedor -> categoría/subcategoría sugeridas al previsualizar una
// importación (ver Importar). Viven en ABM porque son dato de configuración igual que Centros/
// Categorías, no una acción puntual de importar.
function renderReglas(){
  var reglasOrdenadas = (STATE.reglas||[]).slice().sort(function(a,b){ return (a.proveedor||'').localeCompare(b.proveedor||'', 'es', {sensitivity:'base'}); });
  var totalPaginasReglas = Math.max(1, Math.ceil(reglasOrdenadas.length / STATE.reglasPorPagina));
  if(STATE.reglasPaginaActual > totalPaginasReglas) STATE.reglasPaginaActual = totalPaginasReglas;
  if(STATE.reglasPaginaActual < 1) STATE.reglasPaginaActual = 1;
  var inicioPaginaReglas = (STATE.reglasPaginaActual-1) * STATE.reglasPorPagina;
  var reglasPagina = reglasOrdenadas.slice(inicioPaginaReglas, inicioPaginaReglas + STATE.reglasPorPagina);

  var filasReglas = reglasPagina.map(function(r){
    return '<tr><td>'+esc(r.proveedor)+'</td><td>'+esc(r.categoria)+'</td><td>'+esc(r.subcategoria||'—')+'</td>'+
      '<td><button class="secondary" data-action="borrar-regla" data-id="'+r.id+'" title="Borrar regla" style="padding:2px 8px">✕</button></td></tr>';
  }).join('');
  var categoriaOptsRegla = categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'">'+esc(c.nombre)+'</option>'; }).join('');

  var paginadorReglas = reglasOrdenadas.length ? ''+
    '<div class="fields-row" style="margin-top:10px;align-items:center">'+
      selectorPorPagina('reglas-por-pagina', OPCIONES_POR_PAGINA_REGLAS, STATE.reglasPorPagina)+
      '<button class="secondary" data-action="reglas-pagina-anterior" style="font-size:12px;padding:6px 12px"'+(STATE.reglasPaginaActual<=1?' disabled':'')+'>« Anterior</button>'+
      '<span style="font-size:12px;color:var(--ink-soft)">Página '+STATE.reglasPaginaActual+' de '+totalPaginasReglas+'</span>'+
      '<button class="secondary" data-action="reglas-pagina-siguiente" style="font-size:12px;padding:6px 12px"'+(STATE.reglasPaginaActual>=totalPaginasReglas?' disabled':'')+'>Siguiente »</button>'+
    '</div>' : '';

  return ''+
  '<div class="card">'+
    '<h2>Nueva regla</h2>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Al previsualizar una importación (pestaña Importar), si la contraparte de una fila coincide (parcialmente, sin importar mayúsculas) con el texto de una regla, se precargan su Categoría y Subcategoría. También se crean solas al tildar "Guardar como regla" en una fila de la previsualización.</div>'+
    (STATE.reglaFormMsg ? '<div class="msg err">'+esc(STATE.reglaFormMsg)+'</div>' : '')+
    '<div class="fields-row">'+
      '<div class="field"><label>Contraparte (texto parcial)</label><input type="text" id="regla-proveedor" placeholder="Ej: Barrientos"></div>'+
      '<div class="field"><label>Categoría</label><select id="regla-categoria"><option value="">Elegir...</option>'+categoriaOptsRegla+'</select></div>'+
      '<div class="field"><label>Subcategoría (opcional)</label><input type="text" id="regla-subcategoria" placeholder="Ej: Limpieza"></div>'+
      '<div class="field" style="justify-content:flex-end"><button data-action="agregar-regla">Agregar regla</button></div>'+
    '</div>'+
  '</div>'+
  '<div class="card">'+
    '<h3>Reglas guardadas ('+reglasOrdenadas.length+')</h3>'+
    (reglasOrdenadas.length ? ''+
      '<div style="overflow-x:auto"><table class="table"><thead><tr><th>Contraparte</th><th>Categoría</th><th>Subcategoría</th><th></th></tr></thead>'+
      '<tbody>'+filasReglas+'</tbody></table></div>'+paginadorReglas
      : '<div class="empty">Todavía no hay reglas guardadas.</div>')+
  '</div>';
}

// Selector de familia del superadmin (arriba a la derecha). A los miembros no se les muestra.
function renderSelectorFamilia(idSelect){
  if(!STATE.esSuperadmin) return '';
  if(!STATE.familias.length) return '<span class="selector-familia-vacio">Sin familias</span>';
  return '<label class="selector-familia" title="Familia que estás viendo (solo lectura)">'+
    '<i class="bi bi-eye"></i>'+
    '<select id="'+idSelect+'" data-selector-familia aria-label="Familia">'+
      STATE.familias.map(function(f){
        return '<option value="'+esc(f.id)+'"'+(f.id===STATE.familiaSeleccionadaId?' selected':'')+'>'+esc(f.nombre)+'</option>';
      }).join('')+
    '</select>'+
  '</label>';
}

function fmtFechaHora(iso){
  if(!iso) return '—';
  var d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR');
}

// Configuración de la familia elegida en el selector (solo superadmin; la familia no la ve, C1).
// Un campo vacío = usa el default del catálogo.
function renderConfigFamilia(){
  var familia = STATE.familias.find(function(f){ return f.id===STATE.familiaSeleccionadaId; });
  if(!familia) return '';
  var msgHtml = STATE.configMsg ? '<div class="msg '+(STATE.configMsg.type==='ok'?'ok':'err')+'">'+esc(STATE.configMsg.text)+'</div>' : '';
  // Avisos de combinaciones que dejan Facturación ARCA sin funcionar (D8)
  var avisos = [];
  if(configuracionValor('feature.facturacion_arca')==='true' && !funcionActiva('usdt')) avisos.push('Facturación ARCA está prendida pero USDT no: sin USDT no se factura.');
  if(funcionActiva('facturacion_arca') && faltanDatosFacturacion()) avisos.push('Facturación ARCA está prendida pero faltan el CUIT o la razón social: la familia no va a poder facturar.');
  var avisosHtml = avisos.map(function(a){ return '<div class="msg err">'+esc(a)+'</div>'; }).join('');
  var html = '';
  var grupoActual = null;
  STATE.configCatalogo.forEach(function(item){
    if(item.grupo!==grupoActual){
      grupoActual = item.grupo;
      html += '<h3 style="margin-top:14px">'+esc(item.grupo)+'</h3>';
    }
    var propio = STATE.configuracion.find(function(c){ return c.clave===item.clave; });
    var valor = propio ? propio.valor : '';
    var porDefecto = item.valorDefault!=null ? 'Default: '+item.valorDefault : 'Sin valor por defecto';
    var control = item.tipo==='booleano'
      ? '<select id="cfg-'+esc(item.clave)+'"><option value="">'+esc(porDefecto)+'</option>'+
          '<option value="true"'+(valor==='true'?' selected':'')+'>Sí</option>'+
          '<option value="false"'+(valor==='false'?' selected':'')+'>No</option></select>'
      : '<input type="text"'+(item.tipo==='numero'?' inputmode="decimal"':'')+' id="cfg-'+esc(item.clave)+'" value="'+esc(valor)+'" placeholder="'+esc(porDefecto)+'" style="width:260px">';
    html += '<div class="fields-row" style="align-items:flex-end;margin-bottom:10px">'+
      '<div class="field"><label>'+esc(item.clave)+(propio?'':' <span style="color:var(--ink-soft);font-weight:normal">(usa el default)</span>')+'</label>'+control+
        '<div style="font-size:11px;color:var(--ink-soft);margin-top:4px;max-width:420px">'+esc(item.descripcion)+'</div></div>'+
      '<div class="field"><button data-action="config-guardar" data-id="'+esc(item.clave)+'">Guardar</button></div>'+
      (propio ? '<div class="field"><button class="secondary" data-action="config-default" data-id="'+esc(item.clave)+'">Usar default</button></div>' : '')+
    '</div>';
  });
  return '<div class="card">'+
    '<h2>Configuración de '+esc(familia.nombre)+'</h2>'+
    '<div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px">Valores de la familia elegida arriba. Vacío = usa el default. La familia no ve esta pantalla. Las claves nuevas se agregan en <code>schema.sql</code>.</div>'+
    msgHtml+avisosHtml+
    (STATE.configCatalogo.length ? html : '<div class="empty">El catálogo de configuración está vacío.</div>')+
  '</div>';
}

// Importadores de la familia elegida (solo superadmin, D7): tildado = la familia lo ve. Se guarda lo que
// se oculta, así un importador nuevo aparece en todas.
function renderImportadoresFamilia(){
  var familia = STATE.familias.find(function(f){ return f.id===STATE.familiaSeleccionadaId; });
  if(!familia) return '';
  var lista = STATE.importadores.filter(function(i){ return i.activo && PARSERS_IMPORTACION.indexOf(i.codigo)!==-1; });
  var msgHtml = STATE.importadoresMsg ? '<div class="msg '+(STATE.importadoresMsg.type==='ok'?'ok':'err')+'">'+esc(STATE.importadoresMsg.text)+'</div>' : '';
  var fila = function(i){
    var visible = STATE.importadoresOcultos.indexOf(i.codigo)===-1;
    return '<label style="display:flex;align-items:center;gap:8px;font-weight:normal;margin:4px 0">'+
      '<input type="checkbox" style="width:auto" data-action="importador-alternar" data-id="'+esc(i.codigo)+'"'+(visible?' checked':'')+'> '+
      esc(esImportadorTarjeta(i.codigo) ? 'Tarjeta de Crédito · '+i.nombre : i.nombre)+
    '</label>';
  };
  return '<div class="card">'+
    '<h2>Importadores de '+esc(familia.nombre)+'</h2>'+
    '<div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px">Tildado = la familia lo ve en Importar. Los de tarjeta además necesitan la función Tarjetas prendida. Los importadores nuevos se agregan en <code>schema.sql</code> y aparecen tildados.</div>'+
    msgHtml+
    (lista.length ? lista.map(fila).join('') : '<div class="empty">No hay importadores cargados.</div>')+
  '</div>';
}

// Pestaña Administración (solo superadmin): familias, miembros, backup global y restauración por familia.
// Las altas se hacen por script (scripts/sql/alta_*.sql): acá solo se muestran.
function renderAdministracion(){
  var miembrosPorFamilia = {};
  STATE.adminMiembros.forEach(function(m){ miembrosPorFamilia[m.familia_id] = (miembrosPorFamilia[m.familia_id]||0) + 1; });

  var filasFamilias = STATE.familias.map(function(f){
    return '<tr><td>'+esc(f.nombre)+'</td><td>'+(miembrosPorFamilia[f.id]||0)+'</td><td>'+fmtFechaHora(f.created_at)+'</td></tr>';
  }).join('');
  var filasMiembros = STATE.adminMiembros.map(function(m){
    return '<tr><td>'+esc(m.nombre||'')+'</td><td>'+esc(m.email)+'</td><td>'+esc(m.familia)+'</td><td>'+fmtFechaHora(m.created_at)+'</td></tr>';
  }).join('');
  var ayudaAltas = '<div style="font-size:12px;color:var(--ink-soft);margin-top:10px">Las altas se hacen con los scripts de <code>scripts/sql/</code> en el SQL Editor de Supabase.</div>';

  var msgHtml = STATE.backupMsg ? '<div class="msg '+(STATE.backupMsg.type==='ok'?'ok':'err')+'">'+esc(STATE.backupMsg.text)+'</div>' : '';
  var restaurarHtml = '';
  if(STATE.backupArchivo){
    var enArchivo = familiasEnBackup(STATE.backupArchivo);
    restaurarHtml = '<div class="fields-row" style="margin-top:12px">'+
      '<div class="field"><label>Familia a restaurar</label><select id="backup-familia">'+
        enArchivo.map(function(f){
          var enBase = STATE.familias.some(function(x){ return x.id===f.id; });
          return '<option value="'+esc(f.id)+'"'+(f.id===STATE.backupFamiliaRestaurar?' selected':'')+'>'+
            esc(f.nombre||f.id)+' — '+f.filas+' fila(s)'+(enBase?'':' (no existe en la base: se vuelve a crear)')+'</option>';
        }).join('')+
      '</select></div>'+
      '<div class="field" style="justify-content:flex-end"><button data-action="restaurar-familia">Restaurar esta familia</button></div>'+
      '<div class="field" style="justify-content:flex-end"><button class="secondary" data-action="cancelar-restaurar">Cancelar</button></div>'+
    '</div>';
  }

  return ''+
  '<div class="card">'+
    '<h2>Familias ('+STATE.familias.length+')</h2>'+
    (STATE.familias.length
      ? '<div style="overflow-x:auto"><table class="table"><thead><tr><th>Familia</th><th>Miembros</th><th>Alta</th></tr></thead><tbody>'+filasFamilias+'</tbody></table></div>'
      : '<div class="empty">Todavía no hay familias.</div>')+
    ayudaAltas+
  '</div>'+
  '<div class="card">'+
    '<h2>Miembros ('+STATE.adminMiembros.length+')</h2>'+
    (STATE.adminMiembrosError ? '<div class="msg err">'+esc(STATE.adminMiembrosError)+'</div>' : '')+
    (STATE.adminMiembros.length
      ? '<div style="overflow-x:auto"><table class="table"><thead><tr><th>Nombre</th><th>Email</th><th>Familia</th><th>Alta</th></tr></thead><tbody>'+filasMiembros+'</tbody></table></div>'
      : (STATE.adminMiembrosError ? '' : '<div class="empty">Todavía no hay miembros.</div>'))+
  '</div>'+
  renderConfigFamilia()+
  renderImportadoresFamilia()+
  '<div class="card">'+
    '<h2>Descargar backup</h2>'+
    '<div style="font-size:12px;color:var(--ink-soft);margin-bottom:12px">Genera un archivo con <strong>todas las familias</strong>: familias, miembros y sus datos (Centros, Categorías, Subcategorías, Movimientos, Vencimientos, Deudas, USDT, Facturas, Reglas y Configuración).</div>'+
    '<button data-action="descargar-backup"><i class="bi bi-download"></i> Descargar backup completo (.json)</button>'+
  '</div>'+
  '<div class="card">'+
    '<h2>Restaurar una familia desde un backup</h2>'+
    msgHtml+
    '<div style="font-size:12px;color:var(--ink-soft);margin-bottom:12px">Elegí un archivo .json descargado con "Descargar backup" y después la familia a restaurar: las demás no se tocan. Esto <strong>no borra</strong> nada: agrega lo que falte y actualiza lo que coincida por ID. Es todo o nada: si algo no cierra, no se aplica ninguna fila.</div>'+
    '<div class="fields-row">'+
      '<input type="file" id="backup-file" accept="application/json,.json">'+
      '<button data-action="restaurar-backup-preview">Leer archivo</button>'+
    '</div>'+
    restaurarHtml+
  '</div>';
}

function campoCategoria(nombre, tipo, color){
  return '<div class="field"><label>Nombre</label><input type="text" id="f-categoria-nombre" placeholder="Ej: Alimentos" value="'+esc(nombre)+'" style="width:220px"></div>'+
    '<div class="field"><label>Color</label><input type="color" id="f-categoria-color" value="'+esc(color)+'"></div>'+
    '<div class="field"><label>Tratamiento en reportes</label><select id="f-categoria-tipo">'+
      TIPOS_CATEGORIA.filter(function(t){ return !t.funcion || funcionActiva(t.funcion) || (tipo||'')===t.id; })
        .map(function(t){ return '<option value="'+t.id+'" '+((tipo||'')===t.id?'selected':'')+'>'+esc(t.label)+'</option>'; }).join('')+
    '</select></div>';
}
function renderCategorias(){
  var rows = STATE.categorias.map(function(c){
    var subCount = STATE.subcategorias.filter(function(s){return s.categoriaId===c.id;}).length;
    return '<tr><td data-label="Nombre">'+renderChip(c.nombre, colorCategoria(c.id), colorTextoCategoria(c.id))+'</td><td class="mono" data-label="Tipo">'+tipoLabel(c.tipo)+'</td><td class="mono" data-label="Subcategorías">'+subCount+' subcategoría(s)</td>'+
      '<td class="actions-cell"><button class="link" data-action="edit-categoria" data-id="'+c.id+'">editar</button>'+
      '<button class="link" data-action="del-categoria" data-id="'+c.id+'">borrar</button></td></tr>';
  }).join('');
  var editing = STATE.editing && STATE.editing.type==='categoria' ? STATE.categorias.find(function(x){return x.id===STATE.editing.id;}) : null;

  var bulkColorMsgHtml = STATE.bulkColorCatMsg ? '<div class="msg '+(STATE.bulkColorCatMsg.type==='ok'?'ok':'err')+'">'+esc(STATE.bulkColorCatMsg.text)+'</div>' : '';

  if(editing){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
      '<h2>Editar categoría</h2>'+
      '<div class="fields-row">'+ campoCategoria(editing.nombre, editing.tipo||'', colorCategoria(editing.id)) +'</div>'+
      ayudaTipoCategoria()+
      '<div class="fields-row" style="margin-top:14px">'+
        '<button data-action="save-categoria" data-id="'+editing.id+'">Guardar cambios</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  } else if(STATE.bulkColorCatAbierto){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card modal-card-lg">'+
      '<h2>Actualizar colores en masa</h2>'+
      bulkColorMsgHtml+
      '<div class="field"><label>Pegá "Nombre" + tab + "Color" (hex, ej #FDE68A) por línea. También podés pegar directamente la fila "Categoría / Color sugerido / Hex" tal cual, usa la última columna. Solo actualiza categorías que ya existen (por nombre, sin importar mayúsculas); no crea categorías nuevas.</label>'+
      '<textarea id="bulk-colores-categorias" rows="8" style="width:100%;font-family:\'Geist Mono\',ui-monospace,Consolas,monospace;font-size:12px" placeholder="Comida\tDurazno\t#FED7AA"></textarea></div>'+
      '<div class="fields-row" style="margin-top:14px">'+
        '<button data-action="bulk-actualizar-colores-categorias">Actualizar colores</button>'+
        '<button class="secondary" data-action="cancel-edit">Cerrar</button>'+
      '</div>'+
    '</div></div>';
  }

  var formNuevaCategoria = editing ? '' : ''+
  '<div class="card">'+
    '<h2>Nueva categoría</h2>'+
    '<div class="fields-row">'+ campoCategoria('', '', PALETA_DONUT[STATE.categorias.length % PALETA_DONUT.length]) +
      '<button data-action="save-categoria" data-id="">Agregar</button>'+
    '</div>'+
    ayudaTipoCategoria()+
  '</div>';

  return formNuevaCategoria +
  '<div class="card">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">'+
      '<h3 style="margin:0">Categorías cargadas</h3>'+
      (STATE.categorias.length ? '<button class="secondary" data-action="abrir-bulk-colores-categorias" style="font-size:12px;padding:6px 12px"><i class="bi bi-palette"></i> Actualizar colores en masa</button>' : '')+
    '</div>'+
    (STATE.categorias.length ? '<table class="table tabla-movil"><thead><tr><th>Nombre</th><th>Tipo</th><th>Subcategorías</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>' : '<div class="empty">Todavía no cargaste ninguna categoría.</div>')+
  '</div>';
}

// ===================== SUBCATEGORÍAS =====================
function campoSubcategoria(catOptions, nombre){
  return '<div class="field"><label>Categoría</label><select id="f-sub-categoria">'+catOptions+'</select></div>'+
    '<div class="field"><label>Nombre</label><input type="text" id="f-sub-nombre" placeholder="Ej: Supermercado" value="'+esc(nombre)+'" style="width:220px"></div>';
}
function renderSubcategorias(){
  var catOptions = categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'">'+esc(c.nombre)+'</option>'; }).join('');
  var subsOrdenadasPorCategoria = STATE.subcategorias.slice().sort(function(a,b){
    var cmpCat = nombreCategoria(a.categoriaId).localeCompare(nombreCategoria(b.categoriaId), 'es', {sensitivity:'base'});
    if(cmpCat !== 0) return cmpCat;
    return (a.nombre||'').localeCompare(b.nombre||'', 'es', {sensitivity:'base'});
  });
  var rows = subsOrdenadasPorCategoria.map(function(s){
    return '<tr><td data-label="Categoría">'+esc(nombreCategoria(s.categoriaId))+'</td><td data-label="Subcategoría">'+esc(s.nombre)+'</td>'+
      '<td class="actions-cell"><button class="link" data-action="edit-subcategoria" data-id="'+s.id+'">editar</button>'+
      '<button class="link" data-action="del-subcategoria" data-id="'+s.id+'">borrar</button></td></tr>';
  }).join('');
  var editing = STATE.editing && STATE.editing.type==='subcategoria' ? STATE.subcategorias.find(function(x){return x.id===STATE.editing.id;}) : null;

  if(STATE.categorias.length === 0){
    return '<div class="card"><div class="empty">Primero cargá al menos una categoría en ABM → Categorías.</div></div>';
  }

  if(editing){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
      '<h2>Editar subcategoría</h2>'+
      '<div class="fields-row">'+ campoSubcategoria(catOptions, editing.nombre) +'</div>'+
      '<div class="fields-row" style="margin-top:14px">'+
        '<button data-action="save-subcategoria" data-id="'+editing.id+'">Guardar cambios</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  }

  var formNuevaSub = editing ? '' : ''+
  '<div class="card">'+
    '<h2>Nueva subcategoría</h2>'+
    '<div class="fields-row">'+ campoSubcategoria(catOptions, '') +
      '<button data-action="save-subcategoria" data-id="">Agregar</button>'+
    '</div>'+
  '</div>';

  return formNuevaSub +
  '<div class="card">'+
    '<h3>Subcategorías cargadas</h3>'+
    (STATE.subcategorias.length ? '<table class="table tabla-movil"><thead><tr><th>Categoría</th><th>Subcategoría</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>' : '<div class="empty">Todavía no cargaste ninguna subcategoría.</div>')+
  '</div>';

  // Nota: si hay editing, seteamos el select después en bindEvents (post-render) porque innerHTML no respeta "selected" con reflow directo en todos los navegadores.
}

// ===================== MOVIMIENTOS =====================
function getMeses(){
  var set = {};
  STATE.movimientos.forEach(function(m){
    var mes = (m.fecha||'').slice(0,7); // yyyy-mm
    if(mes) set[mes] = true;
  });
  return Object.keys(set).sort().reverse();
}
// Igual que getMeses pero sin meses futuros (cuotas ya cargadas, etc.): para filtros y gráficos
// donde consultar meses que todavía no pasaron es raro y solo agrega ruido.
function getMesesHastaHoy(){
  var hoy = new Date();
  var mesActualStr = hoy.getFullYear()+'-'+pad2(hoy.getMonth()+1);
  return getMeses().filter(function(m){ return m <= mesActualStr; });
}

function camposFaltantes(m){
  var faltan = [];
  if(!m.fecha) faltan.push('Fecha');
  if(!m.centroId) faltan.push('Centro de Costo');
  if(!m.categoriaId) faltan.push('Categoría');
  if(!m.proveedor) faltan.push('Contraparte');
  if(Number(m.ingreso)===0 && Number(m.egreso)===0) faltan.push('Ingreso/Egreso');
  return faltan;
}

// Celdas editables (selects/inputs) para categorizar un movimiento en línea, sin abrir el modal:
// se usan tanto en "Solo incompletos" como dentro de los grupos de tarjeta desplegables.
function celdasEditablesMov(m){
  var subOpcionesFila = subcategoriasOrdenadas(STATE.subcategorias.filter(function(s){ return s.categoriaId===m.categoriaId; }))
    .map(function(s){ return '<option value="'+s.id+'" '+(m.subcategoriaId===s.id?'selected':'')+'>'+esc(s.nombre)+'</option>'; }).join('');
  return {
    centro: '<td data-label="Centro"><select data-mov-id="'+m.id+'" data-field="centroId"><option value="">—</option>'+
      centrosOrdenados().map(function(c){ return '<option value="'+c.id+'" '+(m.centroId===c.id?'selected':'')+'>'+esc(c.codigo)+'</option>'; }).join('')+
      '</select></td>',
    categoria: '<td data-label="Categoría"><select data-mov-id="'+m.id+'" data-field="categoriaId"><option value="">—</option>'+
      categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'" '+(m.categoriaId===c.id?'selected':'')+'>'+esc(c.nombre)+'</option>'; }).join('')+
      '</select></td>',
    subcategoria: '<td data-label="Subcategoría"><select data-mov-id="'+m.id+'" data-field="subcategoriaId"><option value="">—</option>'+subOpcionesFila+'</select></td>',
    proveedor: '<td data-label="Contraparte">'+(esTarjeta(m)?'<span title="Pagado con tarjeta de crédito"><i class="bi bi-credit-card"></i></span> ':'')+'<input type="text" data-mov-id="'+m.id+'" data-field="proveedor" value="'+esc(m.proveedor||'')+'" style="width:100%;box-sizing:border-box"></td>',
    detalle: '<td data-label="Detalle"><input type="text" data-mov-id="'+m.id+'" data-field="detalle" value="'+esc(m.detalle||'')+'" style="width:100%;box-sizing:border-box"></td>'
  };
}

// Celdas de solo lectura (chips + texto, con filtro al click) para mostrar un movimiento sin editar
// en línea: se usan en la tabla normal y dentro de las líneas de un resumen de tarjeta desplegado.
// Para editarlas hay que usar el ícono de editar (abre el modal completo), igual que cualquier otra fila.
function celdasSoloLecturaMov(m){
  var subValorFiltro = m.subcategoriaId || '__vacio__';
  return {
    centro: '<td'+(m.centroId?' class="celda-filtrable" data-filter-field="centro" data-filter-value="'+esc(m.centroId)+'" title="Filtrar por este Centro de Costo"':'')+' data-label="Centro">'+(m.centroId?renderChip(nombreCentro(m.centroId).split(' · ')[0], colorCentro(m.centroId), colorTextoCentro(m.centroId)):'—')+'</td>',
    categoria: '<td'+(m.categoriaId?' class="celda-filtrable" data-filter-field="categoria" data-filter-value="'+esc(m.categoriaId)+'" title="Filtrar por esta Categoría"':'')+' data-label="Categoría">'+(m.categoriaId?renderChip(nombreCategoria(m.categoriaId), colorCategoria(m.categoriaId), colorTextoCategoria(m.categoriaId)):'—')+'</td>',
    subcategoria: '<td class="celda-filtrable" data-filter-field="subcategoria" data-filter-value="'+esc(subValorFiltro)+'" title="Filtrar por esta Subcategoría" data-label="Subcategoría">'+esc(nombreSubcategoria(m.subcategoriaId))+'</td>',
    proveedor: '<td'+(m.proveedor?' class="celda-filtrable" data-filter-field="texto" data-filter-value="'+esc(m.proveedor)+'" title="Filtrar por esta Contraparte"':'')+' data-label="Contraparte">'+(esTarjeta(m)?'<span title="Pagado con tarjeta de crédito"><i class="bi bi-credit-card"></i></span> ':'')+esc(m.proveedor||'')+'</td>',
    detalle: '<td data-label="Detalle">'+esc(m.detalle||'')+'</td>'
  };
}

function renderBulkEditMovModal(){
  var n = (STATE.movSeleccionados||[]).length;
  var subOpts = subcategoriasOrdenadas(STATE.subcategorias).map(function(s){
    return {value:s.id, label:nombreCategoria(s.categoriaId)+' → '+s.nombre};
  });
  var msgHtml = STATE.bulkEditMovMsg ? '<div class="msg '+(STATE.bulkEditMovMsg.type==='ok'?'ok':'err')+'">'+esc(STATE.bulkEditMovMsg.text)+'</div>' : '';
  var labelVaciar = function(id){ return ' <span style="font-weight:normal;font-size:11px;color:var(--ink-soft);white-space:nowrap"><input type="checkbox" id="'+id+'" style="width:auto;vertical-align:middle"> vaciar</span>'; };
  return '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card modal-card-lg">'+
    '<h2>Editar '+n+' movimiento(s) seleccionado(s)</h2>'+
    '<div style="font-size:12px;color:var(--ink-soft);margin-bottom:10px">Dejá "— Sin cambios —" (o vacío) en los campos que no querés tocar: solo se aplican a los '+n+' movimientos los campos que completes acá.</div>'+
    msgHtml+
    '<div class="form-grid">'+
      '<div class="field"><label>Fecha</label><input type="date" id="bem-fecha"></div>'+
      '<div class="field"><label>Centro de Costo</label><select id="bem-centro"><option value="">— Sin cambios —</option><option value="__vaciar__">(Vaciar)</option>'+
        centrosOrdenados().map(function(c){ return '<option value="'+c.id+'">'+esc(c.codigo+' · '+c.nombre)+'</option>'; }).join('')+
      '</select></div>'+
    '</div>'+
    '<div class="form-grid">'+
      '<div class="field"><label>Categoría</label><select id="bem-categoria"><option value="">— Sin cambios —</option><option value="__vaciar__">(Vaciar)</option>'+
        categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'">'+esc(c.nombre)+'</option>'; }).join('')+
      '</select></div>'+
      '<div class="field"><label>Subcategoría</label><select id="bem-subcategoria"><option value="">— Sin cambios —</option><option value="__vaciar__">(Vaciar)</option>'+
        subOpts.map(function(o){ return '<option value="'+o.value+'">'+esc(o.label)+'</option>'; }).join('')+
      '</select></div>'+
    '</div>'+
    '<div class="form-grid">'+
      '<div class="field"><label>Contraparte'+labelVaciar('bem-proveedor-vaciar')+'</label><input type="text" id="bem-proveedor" placeholder="— Sin cambios —"></div>'+
      '<div class="field"><label>Detalle'+labelVaciar('bem-detalle-vaciar')+'</label><input type="text" id="bem-detalle" placeholder="— Sin cambios —"></div>'+
    '</div>'+
    '<div class="form-grid">'+
      '<div class="field"><label>Tipo</label><select id="bem-tipo"><option value="">— Sin cambios —</option><option value="egreso">Egreso</option><option value="ingreso">Ingreso</option></select></div>'+
      '<div class="field"><label>Monto</label><input type="number" step="0.01" id="bem-monto" placeholder="— Sin cambios —"></div>'+
    '</div>'+
    '<div class="form-grid">'+
      (funcionActiva('tarjetas') ? '<div class="field"><label>Tarjeta</label><select id="bem-tarjeta"><option value="">— Sin cambios —</option><option value="si">Marcar</option><option value="no">Desmarcar</option></select></div>' : '')+
    '</div>'+
    '<div style="margin-top:16px;display:flex;gap:10px">'+
    '<button data-action="guardar-bulk-edit-mov">Aplicar a '+n+' movimiento(s)</button>'+
    '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
    '</div>'+
  '</div></div>';
}

function movimientosFiltrados(f){
  // STATE.movimientos está en orden de carga (viene de la base por created_at y lo nuevo se agrega al
  // final), así que su posición desempata: dentro de un mismo día, lo último cargado va primero.
  var ordenCarga = new Map();
  STATE.movimientos.forEach(function(m, i){ ordenCarga.set(m, i); });
  return STATE.movimientos.filter(function(m){
    if(esMovimientoPendiente(m)) return false; // los movimientos con fecha futura se muestran en Vencimientos, no acá
    if(f.centro.length && f.centro.indexOf(m.centroId)===-1) return false;
    if(f.categoria.length && f.categoria.indexOf(m.categoriaId)===-1) return false;
    if(f.mes.length && f.mes.indexOf((m.fecha||'').slice(0,7))===-1) return false;
    if(f.subcategoria.length){
      var valorSub = m.subcategoriaId || '__vacio__';
      if(f.subcategoria.indexOf(valorSub)===-1) return false;
    }
    if(f.soloIncompletos){
      var idsCongelados = STATE.incompletosSnapshotIds;
      if(idsCongelados){ if(idsCongelados.indexOf(m.id)===-1) return false; }
      else if(camposFaltantes(m).length===0){ return false; }
    }
    if(f.soloTarjeta && funcionActiva('tarjetas') && !m.tarjeta) return false;
    if(f.texto){
      var t = f.texto.toLowerCase();
      if((m.proveedor||'').toLowerCase().indexOf(t)===-1 && (m.detalle||'').toLowerCase().indexOf(t)===-1) return false;
    }
    return true;
  }).sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||'') || (ordenCarga.get(b) - ordenCarga.get(a)); });
}

// Aviso de vencimientos y movimientos pendientes de hoy y mañana: arriba de Movimientos y de Resumen.
function alertaVencimientosProximosHtml(){
  // Los movimientos con tarjeta se juntan en una sola línea por resumen (Fecha + Centro, igual que en
  // Vencimientos), en vez de listar cada consumo. La marca se muestra solo si es la misma en todos.
  var movsProximos = [], resumenesTarjetaProximos = {};
  STATE.movimientos.forEach(function(m){
    if(!esMovimientoPendiente(m)) return;
    var dias = diasHasta(m.fecha);
    if(dias!==0 && dias!==1) return;
    var monto = (Number(m.egreso)||0)-(Number(m.ingreso)||0);
    if(!m.tarjeta){
      movsProximos.push({dias:dias, concepto:m.proveedor||nombreCategoria(m.categoriaId)||m.detalle||'Movimiento', monto:monto, centroId:m.centroId});
      return;
    }
    var clave = m.fecha+'|'+(m.centroId||'');
    var r = resumenesTarjetaProximos[clave];
    if(!r){
      r = resumenesTarjetaProximos[clave] = {dias:dias, marcas:{}, cantidad:0, monto:0, centroId:m.centroId};
      movsProximos.push(r);
    }
    if(m.tarjetaMarca) r.marcas[m.tarjetaMarca] = true;
    r.cantidad++;
    r.monto += monto;
  });
  movsProximos.forEach(function(x){
    if(!x.cantidad) return;
    var marcas = Object.keys(x.marcas);
    x.concepto = 'Resumen '+(marcas.length===1 ? marcas[0] : 'tarjeta')+' · '+x.cantidad+' movimiento(s)';
  });

  var vencimientosProximos = STATE.vencimientos.filter(function(v){
    if(v.estado!=='pendiente') return false;
    var dias = diasHasta(v.fecha);
    return dias===0 || dias===1;
  }).map(function(v){
    return {dias:diasHasta(v.fecha), concepto:v.concepto, monto:v.monto, centroId:v.centroId};
  }).concat(movsProximos).sort(function(a,b){ return a.dias-b.dias; });

  return vencimientosProximos.length ? ''+
  '<div class="card" style="border-color:var(--danger);background:var(--danger-soft)">'+
    '<h3 style="color:var(--danger)"><i class="bi bi-alarm"></i> Vencimientos próximos</h3>'+
    '<div style="font-size:13px;margin-bottom:8px">'+
      vencimientosProximos.map(function(x){
        return '<div style="margin-bottom:4px">'+(x.dias===0?'<strong>Hoy</strong>':'<strong>Mañana</strong>')+' — '+esc(x.concepto)+(x.centroId?' ('+esc(nombreCentro(x.centroId).split(' · ')[0])+')':'')+' — <span class="mono">'+fmtMonto(x.monto)+'</span></div>';
      }).join('')+
    '</div>'+
    '<button class="secondary" data-action="ir-a-vencimientos" style="font-size:12px;padding:6px 12px">Ver vencimientos</button>'+
  '</div>' : '';
}
function renderMovimientos(){
  var f = STATE.filtros || {centro:[], categoria:[], mes:[], texto:'', subcategoria:[], soloIncompletos:false};

  var centroOptions = centrosOrdenados().map(function(c){ return {value:c.id, label:c.codigo}; });
  var categoriaOptions = categoriasOrdenadas().map(function(c){ return {value:c.id, label:c.nombre}; });
  var meses = getMesesHastaHoy();
  var mesOptions = meses.map(function(m){ return {value:m, label:m}; });
  var subsParaFiltro = subcategoriasOrdenadas(f.categoria.length ? STATE.subcategorias.filter(function(s){ return f.categoria.indexOf(s.categoriaId)!==-1; }) : STATE.subcategorias);
  var subcategoriaOptions = [{value:'__vacio__', label:'(Sin subcategoría)'}].concat(subsParaFiltro.map(function(s){
    var etiqueta = f.categoria.length ? s.nombre : nombreCategoria(s.categoriaId)+' → '+s.nombre;
    return {value:s.id, label:etiqueta};
  }));

  var cantidadIncompletos = STATE.movimientos.filter(function(m){ return !esMovimientoPendiente(m) && camposFaltantes(m).length>0; }).length;

  // Control de integridad de TEC: debería dar 0 (cada transferencia es un ingreso en un centro y un egreso en otro, por el mismo monto)
  var movsTec = STATE.movimientos.filter(function(m){ return esTipoCategoria(m.categoriaId,'tec'); });
  var ingresoTec = movsTec.reduce(function(s,m){ return s+(Number(m.ingreso)||0); },0);
  var egresoTec = movsTec.reduce(function(s,m){ return s+(Number(m.egreso)||0); },0);
  var difTec = ingresoTec - egresoTec;
  var categoriasSospechosas = STATE.categorias.filter(function(c){
    return c.tipo !== 'tec' && c.tipo !== 'control' && /tec|transfer/i.test(c.nombre||'');
  });

  var lista = movimientosFiltrados(f);

  var totalIngreso = lista.reduce(function(s,m){ return cuentaEnTotalesMovimientos(m, f.categoria) ? s + (Number(m.ingreso)||0) : s; },0);
  var totalEgreso = lista.reduce(function(s,m){ return cuentaEnTotalesMovimientos(m, f.categoria) ? s + (Number(m.egreso)||0) : s; },0);
  var etiquetaTotales = 'Totales (sin TEC'+(lista.some(function(m){ return esTipoCategoria(m.categoriaId,'control') && !cuentaEnTotalesMovimientos(m, f.categoria); }) ? ' ni Solo control' : '')+')';

  // Los movimientos con tarjeta se agrupan por Fecha + Centro + Marca (un resumen = un pago de una
  // tarjeta puntual) en una sola línea desplegable, ubicada en la tabla en el mismo lugar cronológico
  // que le tocaría a cualquier otro movimiento (no aparte). Con "Solo incompletos" activo no se agrupa,
  // para no interferir con ese filtro.
  var agruparTarjeta = !f.soloIncompletos;
  var gruposTarjetaMap = {};
  var vista = [];
  lista.forEach(function(m){
    if(!agruparTarjeta || !esTarjeta(m)){ vista.push({tipo:'mov', mov:m}); return; }
    var clave = 'mov-tarjeta|'+m.fecha+'|'+(m.centroId||'')+'|'+(m.tarjetaMarca||'');
    var g = gruposTarjetaMap[clave];
    if(!g){
      g = {tipo:'grupo', clave:clave, fecha:m.fecha, centroId:m.centroId||'', marca:m.tarjetaMarca||'', movs:[]};
      gruposTarjetaMap[clave] = g;
      vista.push(g);
    }
    g.movs.push(m);
  });

  var totalPaginasMov = Math.max(1, Math.ceil(vista.length / STATE.movPorPagina));
  if(STATE.movPaginaActual > totalPaginasMov) STATE.movPaginaActual = totalPaginasMov;
  if(STATE.movPaginaActual < 1) STATE.movPaginaActual = 1;
  var inicioPaginaMov = (STATE.movPaginaActual-1) * STATE.movPorPagina;
  var vistaPagina = vista.slice(inicioPaginaMov, inicioPaginaMov + STATE.movPorPagina);

  var seleccionados = STATE.movSeleccionados || [];
  var idsCheckboxVisibles = [];

  function filaMovNormal(m){
    var faltan = camposFaltantes(m);
    var incompleto = faltan.length>0;
    var facturaMov = facturaEmitidaDeMovimiento(m.id);

    var celdaCentro, celdaCategoria, celdaSubcategoria, celdaProveedor, celdaDetalle;
    if(f.soloIncompletos){
      var celdasEd = celdasEditablesMov(m);
      celdaCentro = celdasEd.centro; celdaCategoria = celdasEd.categoria; celdaSubcategoria = celdasEd.subcategoria;
      celdaProveedor = celdasEd.proveedor; celdaDetalle = celdasEd.detalle;
    } else {
      var celdasRO = celdasSoloLecturaMov(m);
      celdaCentro = celdasRO.centro; celdaCategoria = celdasRO.categoria; celdaSubcategoria = celdasRO.subcategoria;
      celdaProveedor = celdasRO.proveedor; celdaDetalle = celdasRO.detalle;
    }

    var claseFila = incompleto ? 'fila-incompleta' : '';
    var tituloFila = incompleto ? ' title="Falta: '+esc(faltan.join(', '))+'"' : '';
    var fechaFiltrable = !f.soloIncompletos && (m.fecha||'').slice(0,7);
    idsCheckboxVisibles.push(m.id);
    return '<tr'+(claseFila?' class="'+claseFila+'"':'')+tituloFila+'>'+
      '<td data-label=""><input type="checkbox" class="chk-select-mov" data-mov-id="'+m.id+'" '+(seleccionados.indexOf(m.id)!==-1?'checked':'')+'></td>'+
      '<td class="mono'+(fechaFiltrable?' celda-filtrable':'')+'" data-label="Fecha"'+(fechaFiltrable?' data-filter-field="mes" data-filter-value="'+esc(fechaFiltrable)+'" title="Filtrar por este Mes"':'')+'>'+(incompleto?'<i class="bi bi-exclamation-triangle"></i> ':'')+esc(fechaISOaDDMMAAAA(m.fecha)||m.fecha||'')+'</td>'+
      celdaCentro + celdaCategoria + celdaSubcategoria + celdaProveedor + celdaDetalle +
      '<td class="num ingreso" data-label="Ingreso">'+(Number(m.ingreso)?fmtMonto(m.ingreso):'')+'</td>'+
      '<td class="num egreso" data-label="Egreso">'+(Number(m.egreso)?fmtMonto(m.egreso):'')+'</td>'+
      '<td class="actions-cell">'+
      (esVentaUsdtPendiente(m)?'<button class="icon-btn" data-action="abrir-usdt-venta-mov" data-id="'+m.id+'" title="Generar movimiento USDT" aria-label="Generar movimiento USDT"><i class="bi bi-coin"></i></button>':'')+
      (esVentaUsdtFacturable(m)?'<button class="icon-btn" data-action="facturar-mov" data-id="'+m.id+'" title="Facturar con ARCA" aria-label="Facturar con ARCA" '+(STATE.facturaLoadingId===m.id?'disabled':'')+'><i class="bi bi-receipt"></i></button>':'')+
      (facturaMov?'<button class="icon-btn" data-action="ver-comprobante" data-id="'+facturaMov.id+'" title="Ver comprobante — CAE '+esc(facturaMov.cae)+'" aria-label="Ver comprobante"><i class="bi bi-check-circle"></i></button>':'')+
      '<button class="icon-btn" data-action="edit-mov" data-id="'+m.id+'" title="Editar" aria-label="Editar"><i class="bi bi-pencil"></i></button>'+
      '<button class="icon-btn icon-btn-danger" data-action="del-mov" data-id="'+m.id+'" title="Borrar" aria-label="Borrar"><i class="bi bi-trash"></i></button></td>'+
    '</tr>';
  }

  function filaDetalleTarjeta(m){
    var faltan = camposFaltantes(m);
    var incompleto = faltan.length>0;
    var celdas = celdasSoloLecturaMov(m);
    var tituloFila = incompleto ? ' title="Falta: '+esc(faltan.join(', '))+'"' : '';
    idsCheckboxVisibles.push(m.id);
    return '<tr class="fila-detalle-tarjeta'+(incompleto?' fila-incompleta':'')+'"'+tituloFila+'>'+
      '<td data-label=""><input type="checkbox" class="chk-select-mov" data-mov-id="'+m.id+'" '+(seleccionados.indexOf(m.id)!==-1?'checked':'')+'></td>'+
      '<td class="mono" data-label="Fecha de consumo">'+(incompleto?'<i class="bi bi-exclamation-triangle"></i> ':'')+esc(m.fechaConsumo?fechaISOaDDMMAAAA(m.fechaConsumo):'—')+'</td>'+
      '<td class="mono" data-label="Cuotas" style="color:var(--ink-soft)">'+(m.cuotas?esc(m.cuotas):'<i class="bi bi-link-45deg" title="Vinculado al resumen de tarjeta, sin cuota individual"></i>')+'</td>'+
      celdas.categoria + celdas.subcategoria + celdas.proveedor + celdas.detalle +
      '<td class="num ingreso" data-label="Ingreso">'+(Number(m.ingreso)?fmtMonto(m.ingreso):'')+'</td>'+
      '<td class="num egreso" data-label="Egreso">'+(Number(m.egreso)?fmtMonto(m.egreso):'')+'</td>'+
      '<td class="actions-cell"><button class="icon-btn" data-action="edit-mov" data-id="'+m.id+'" title="Editar" aria-label="Editar"><i class="bi bi-pencil"></i></button>'+
      '<button class="icon-btn icon-btn-danger" data-action="del-mov" data-id="'+m.id+'" title="Borrar" aria-label="Borrar"><i class="bi bi-trash"></i></button></td>'+
    '</tr>';
  }

  function filaGrupoTarjeta(g){
    var abierto = !!STATE.gruposAbiertos[g.clave];
    var totalIngresoG = g.movs.reduce(function(s,m){ return s+(Number(m.ingreso)||0); },0);
    var totalEgresoG = g.movs.reduce(function(s,m){ return s+(Number(m.egreso)||0); },0);
    var faltantesGrupo = g.movs.filter(function(m){ return camposFaltantes(m).length>0; }).length;
    var caret = abierto ? '▾' : '▸';
    var leyenda = 'Resumen '+(g.marca ? esc(g.marca) : 'tarjeta')+' · '+g.movs.length+' movimiento(s)'+(faltantesGrupo?' · <i class="bi bi-exclamation-triangle"></i> '+faltantesGrupo+' por categorizar':'');
    var filaResumen = '<tr class="fila-grupo-tarjeta">'+
      '<td data-label=""></td>'+
      '<td class="mono" data-label="Fecha">'+esc(fechaISOaDDMMAAAA(g.fecha)||g.fecha)+'</td>'+
      '<td data-label="Centro">'+(g.centroId?renderChip(nombreCentro(g.centroId).split(' · ')[0], colorCentro(g.centroId), colorTextoCentro(g.centroId)):'—')+'</td>'+
      '<td colspan="4" data-label="Detalle"><button class="link" data-action="toggle-grupo-tarjeta-mov" data-id="'+esc(g.clave)+'">'+caret+' <i class="bi bi-credit-card"></i> '+leyenda+'</button></td>'+
      '<td class="num ingreso" data-label="Ingreso">'+(totalIngresoG?fmtMonto(totalIngresoG):'')+'</td>'+
      '<td class="num egreso" data-label="Egreso">'+(totalEgresoG?fmtMonto(totalEgresoG):'')+'</td>'+
      '<td class="actions-cell"></td>'+
    '</tr>';
    if(!abierto) return filaResumen;
    return filaResumen + g.movs.map(filaDetalleTarjeta).join('');
  }

  var rows = vistaPagina.map(function(item){ return item.tipo==='grupo' ? filaGrupoTarjeta(item) : filaMovNormal(item.mov); }).join('');
  var todosVisiblesSeleccionados = idsCheckboxVisibles.length>0 && idsCheckboxVisibles.every(function(mid){ return seleccionados.indexOf(mid)!==-1; });

  var editing = STATE.editing && STATE.editing.type==='mov' ? STATE.movimientos.find(function(x){return x.id===STATE.editing.id;}) : null;
  var editingNormalizado = editing ? {
    fecha: editing.fecha, centroId: editing.centroId, categoriaId: editing.categoriaId, subcategoriaId: editing.subcategoriaId,
    proveedor: editing.proveedor, detalle: editing.detalle,
    tipo: Number(editing.ingreso) > 0 ? 'ingreso' : 'egreso',
    monto: Number(editing.ingreso) > 0 ? editing.ingreso : editing.egreso,
    tarjeta: !!editing.tarjeta, fechaConsumo: editing.fechaConsumo||'', tarjetaMarca: editing.tarjetaMarca||'', cuotas:1, cuotasInfo: editing.cuotas||''
  } : null;
  var e = STATE.movDraft || editingNormalizado || {fecha:'', centroId:'', categoriaId:'', subcategoriaId:'', proveedor:'', detalle:'', tipo:'egreso', monto:'', tarjeta:false, fechaConsumo:'', tarjetaMarca:'', cuotas:1, cuotasInfo:''};
  var subOptionsArr = subcategoriasOrdenadas(STATE.subcategorias.filter(function(s){ return s.categoriaId === e.categoriaId; }))
    .map(function(s){ return {value:s.id, label:s.nombre}; });

  function camposMov(e, subOptionsArr){
    var catSel = STATE.categorias.find(function(c){return c.id===e.categoriaId;});
    var esTec = catSel && catSel.tipo === 'tec';
    var destinoOpts = [comboOpcionVacia()].concat(STATE.centros.filter(function(c){return c.id!==e.centroId && centroAdmitePesos(c);}).map(function(c){ return {value:c.id, label:c.codigo+' · '+c.nombre}; }));
    var campoDestino = esTec ? ''+
      '<div class="fields-row" style="margin-top:12px">'+
        '<div class="field" style="flex:1 1 240px"><label>Centro de Costo Destino (transferencia, opcional)</label>'+renderCombo('mov-centro-destino', 'f-mov-centro-destino', destinoOpts, STATE.movDraftCentroDestinoId, 'Elegir...')+'</div>'+
        '<div class="field" style="flex:2 1 260px;justify-content:flex-end"><div style="font-size:11px;color:var(--ink-soft);padding-bottom:8px">'+(editing ?
          'Si lo completás, se va a crear un movimiento espejo nuevo en ese centro (misma fecha y categoría, mismo monto, tipo contrario) — pensado para cuando falta la contrapartida de un movimiento importado. No hace falta si ya la cargaste.' :
          'Si lo completás, se va a crear automáticamente el movimiento espejo en ese centro (misma fecha y categoría, mismo monto, tipo contrario). Si lo dejás vacío, se carga solo este movimiento.'
        )+'</div></div>'+
      '</div>' : '';
    var cuotasNum = Math.max(1, parseInt(e.cuotas,10)||1);
    var textoAyudaCuotas;
    if(cuotasNum<=1){
      textoAyudaCuotas = 'La Fecha de arriba se toma como vencimiento del resumen en que se paga.';
    } else if(editing){
      textoAyudaCuotas = 'Este movimiento queda como la cuota 1/'+cuotasNum+'. Se van a crear '+(cuotasNum-1)+' movimiento(s) más para las cuotas siguientes, uno por mes a partir de la Fecha de arriba, con este mismo monto cada uno.';
    } else {
      textoAyudaCuotas = 'La Fecha de arriba se toma como vencimiento de la 1ª cuota. Se van a crear '+cuotasNum+' movimientos, uno por mes, con este mismo monto cada uno.';
    }
    var campoCuotas = (e.tarjeta && funcionActiva('tarjetas')) ? ''+
      '<div class="form-section">'+
        '<div class="form-section-title"><i class="bi bi-credit-card"></i> Tarjeta de crédito</div>'+
        '<div class="form-grid">'+
          '<div class="field"><label>Fecha de consumo (opcional)</label><input type="date" id="f-mov-fecha-consumo" value="'+esc(e.fechaConsumo||'')+'"></div>'+
          '<div class="field"><label>Marca de tarjeta (opcional)</label><input type="text" id="f-mov-tarjeta-marca" autocomplete="off" placeholder="Visa, Mastercard, Amex..." value="'+esc(e.tarjetaMarca||'')+'"></div>'+
        '</div>'+
        '<div class="form-grid">'+
          '<div class="field"><label>Cuotas a generar</label><input type="text" inputmode="numeric" pattern="[0-9]*" id="f-mov-cuotas" value="'+cuotasNum+'"></div>'+
          '<div class="field"><label>Cuota manual (si no generás arriba)</label><input type="text" autocomplete="off" placeholder="ej. 5/6" id="f-mov-cuotas-info" value="'+esc(e.cuotasInfo||'')+'"></div>'+
        '</div>'+
        '<div style="font-size:11px;color:var(--ink-soft);margin-top:8px">'+textoAyudaCuotas+' "Cuota manual" es solo para escribir la etiqueta a mano en un movimiento suelto — dejala vacía si ya pusiste una cantidad arriba.</div>'+
        '<div class="info-box warning" style="margin-top:10px"><i class="bi bi-pin-angle"></i> <strong>Pendiente:</strong> este consumo va a figurar como pendiente hasta la Fecha de arriba (el vencimiento del resumen en que se paga).</div>'+
      '</div>' : '';
    function claseCampo(nombre){ return 'field'+(STATE.movFieldErrors && STATE.movFieldErrors[nombre] ? ' invalid' : ''); }
    function msgCampo(nombre){ return (STATE.movFieldErrors && STATE.movFieldErrors[nombre]) ? '<div class="field-error">'+esc(STATE.movFieldErrors[nombre])+'</div>' : ''; }
    return ''+
      (STATE.movFormMsg ? '<div class="msg err">'+esc(STATE.movFormMsg)+'</div>' : '')+
      '<div class="form-grid">'+
        '<div class="'+claseCampo('fecha')+'"><label>Fecha</label><input type="date" id="f-mov-fecha" max="9999-12-31" value="'+esc(e.fecha)+'">'+msgCampo('fecha')+'</div>'+
        '<div class="'+claseCampo('centroId')+'"><label>Centro de Costo'+((e.fecha && e.fecha>fechaHoyISO())?' (opcional, fecha futura)':'')+'</label>'+
          renderCombo('mov-centro', 'f-mov-centro', [comboOpcionVacia()].concat(centrosOrdenados().map(function(c){ return {value:c.id, label:c.codigo+' · '+c.nombre}; })), e.centroId, 'Elegir...')+msgCampo('centroId')+
        '</div>'+
      '</div>'+
      '<div class="form-grid">'+
        '<div class="'+claseCampo('categoriaId')+'"><label>Categoría</label>'+
          renderCombo('mov-categoria', 'f-mov-categoria', [comboOpcionVacia()].concat(categoriasOrdenadas().map(function(c){ return {value:c.id, label:c.nombre}; })), e.categoriaId, 'Elegir...')+msgCampo('categoriaId')+
        '</div>'+
        '<div class="field"><label>Subcategoría</label>'+
          renderCombo('mov-subcategoria', 'f-mov-subcategoria', [comboOpcionVacia()].concat(subOptionsArr), e.subcategoriaId, 'Elegir o crear...')+
        '</div>'+
      '</div>'+
      campoDestino+
      '<div class="form-grid" style="margin-top:12px">'+
        '<div class="'+claseCampo('proveedor')+'"><label>Contraparte</label><input type="text" id="f-mov-proveedor" value="'+esc(e.proveedor)+'">'+msgCampo('proveedor')+'</div>'+
        '<div class="field"><label>Detalle</label><input type="text" id="f-mov-detalle" value="'+esc(e.detalle)+'"></div>'+
      '</div>'+
      '<div class="form-grid">'+
        '<div class="field"><label>Tipo</label><select id="f-mov-tipo">'+
          '<option value="egreso" '+(e.tipo==='egreso'?'selected':'')+'>Egreso</option>'+
          '<option value="ingreso" '+(e.tipo==='ingreso'?'selected':'')+'>Ingreso</option>'+
        '</select></div>'+
        '<div class="'+claseCampo('monto')+'"><label>Monto</label><input type="number" step="0.01" id="f-mov-monto" value="'+esc(e.monto)+'">'+msgCampo('monto')+'</div>'+
      '</div>'+
      (funcionActiva('tarjetas') ? '<label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:normal;margin-top:14px">'+
        '<input type="checkbox" id="f-mov-tarjeta" '+(e.tarjeta?'checked':'')+' style="width:auto"> <i class="bi bi-credit-card"></i> Pagado con tarjeta de crédito'+
      '</label>' : '')+
      campoCuotas;
  }

  if(STATE.bulkEditMovAbierto){
    MODAL_HTML = renderBulkEditMovModal();
  } else if(editing || STATE.nuevoMovAbierto){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card modal-card-lg">'+
      '<h2>'+(editing?'Editar movimiento':'Nuevo movimiento')+'</h2>'+
      camposMov(e, subOptionsArr)+
        '<button data-action="save-mov" data-id="'+(editing?editing.id:'')+'">'+(editing?'Guardar cambios':'Agregar')+'</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  }

  var alertaVencimientosHtml = alertaVencimientosProximosHtml();

  var controlTecHtml = (Math.abs(difTec) > 0.005 || categoriasSospechosas.length > 0) ? ''+
  '<div class="card" style="border-color:var(--danger);background:var(--danger-soft)">'+
    '<h3 style="color:var(--danger)"><i class="bi bi-exclamation-triangle"></i> Control TEC</h3>'+
    (Math.abs(difTec) > 0.005 ? ''+
      '<div style="font-size:13px;margin-bottom:6px">Ingresos TEC: <strong class="mono">'+fmtMonto(ingresoTec)+'</strong> — Egresos TEC: <strong class="mono">'+fmtMonto(egresoTec)+'</strong> — Diferencia: <strong class="mono">'+fmtMonto(difTec)+'</strong></div>'+
      '<div style="font-size:12px;color:var(--ink-soft)">Debería dar $0,00. Si no da cero, hay transferencias sin su par correspondiente en el otro Centro de Costo (revisá con el filtro de Categoría = TEC).</div>'
      : '')+
    (categoriasSospechosas.length > 0 ? ''+
      '<div style="font-size:12px;color:var(--ink-soft);margin-top:'+(Math.abs(difTec)>0.005?'10px':'0')+'">'+
        'La(s) categoría(s) '+categoriasSospechosas.map(function(c){return '"'+esc(c.nombre)+'"';}).join(', ')+' parece(n) ser de transferencias pero no tiene(n) el Tipo "TEC" asignado en ABM → Categorías — por eso se están contando como ingreso/egreso real en el Resumen.'+
      '</div>'
      : '')+
  '</div>' : '';

  var hayFiltrosActivosMov = f.centro.length || f.categoria.length || f.subcategoria.length || f.mes.length || f.texto || f.soloIncompletos || f.soloTarjeta;
  // En mobile los filtros arrancan colapsados detrás de un ícono, para no ocupar toda la pantalla
  // apenas se entra a Movimientos; en escritorio siempre van expandidos.
  var filtrosColapsados = esVistaMobile() && !STATE.filtrosMovAbiertos;
  var filtersHtml = ''+
  '<div class="card card-filtros">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:'+(filtrosColapsados?'0':'10px')+'">'+
      '<h3 style="margin-bottom:0">Filtros'+(filtrosColapsados && hayFiltrosActivosMov ? ' <span style="font-size:10px;font-weight:600;color:var(--accent);background:var(--accent-soft);border-radius:10px;padding:2px 8px;text-transform:none;letter-spacing:normal">activos</span>' : '')+'</h3>'+
      '<div style="display:flex;align-items:center;gap:8px">'+
        (hayFiltrosActivosMov && !filtrosColapsados ? '<button class="secondary" data-action="limpiar-filtros-mov" style="font-size:12px;padding:6px 12px">✕ Limpiar filtros</button>' : '')+
        '<button class="secondary solo-mobile" data-action="toggle-filtros-mov" style="font-size:12px;padding:6px 12px" aria-label="'+(filtrosColapsados?'Mostrar filtros':'Ocultar filtros')+'">'+(filtrosColapsados?'<i class="bi bi-funnel"></i> Filtros':'<i class="bi bi-x-lg"></i> Ocultar')+'</button>'+
      '</div>'+
    '</div>'+
    (filtrosColapsados ? '' : ''+
    '<div class="filters">'+
      '<div class="field"><label>Centro de Costo</label>'+renderMultiSelect('ff-centro', centroOptions, f.centro)+'</div>'+
      '<div class="field"><label>Categoría</label>'+renderMultiSelect('ff-categoria', categoriaOptions, f.categoria)+'</div>'+
      '<div class="field"><label>Mes</label>'+renderMultiSelect('ff-mes', mesOptions, f.mes)+'</div>'+
      '<div class="field"><label>Subcategoría</label>'+renderMultiSelect('ff-subcategoria', subcategoriaOptions, f.subcategoria)+'</div>'+
      '<div class="field"><label>Buscar</label><input type="text" id="ff-texto" placeholder="contraparte o detalle" value="'+esc(f.texto)+'" style="width:180px"></div>'+
      '<div class="field"><label>&nbsp;</label><label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:normal;white-space:nowrap;padding:7px 0">'+
        '<input type="checkbox" id="ff-solo-incompletos" '+(f.soloIncompletos?'checked':'')+' style="width:auto"> Solo incompletos ('+cantidadIncompletos+')'+
      '</label></div>'+
      (funcionActiva('tarjetas') ? '<div class="field"><label>&nbsp;</label><label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:normal;white-space:nowrap;padding:7px 0">'+
        '<input type="checkbox" id="ff-solo-tarjeta" '+(f.soloTarjeta?'checked':'')+' style="width:auto"> <i class="bi bi-credit-card"></i> Solo tarjeta'+
      '</label></div>' : '')+
      (f.soloIncompletos ? '<div class="field"><label>&nbsp;</label><button class="secondary" data-action="refrescar-incompletos" style="font-size:12px;padding:6px 12px"><i class="bi bi-arrow-clockwise"></i> Actualizar lista</button></div>' : '')+
    '</div>')+
  '</div>';

  var barraSeleccionHtml = seleccionados.length ? ''+
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;font-size:13px">'+
      '<span>'+seleccionados.length+' seleccionado(s)</span>'+
      '<button data-action="abrir-bulk-edit-mov" style="font-size:12px;padding:6px 12px"><i class="bi bi-pencil"></i> Editar seleccionados</button>'+
      '<button class="secondary" data-action="deseleccionar-mov" style="font-size:12px;padding:6px 12px">Deseleccionar todo</button>'+
    '</div>' : '';

  var paginacionHtml = vista.length ? ''+
    '<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:12px;font-size:13px;flex-wrap:wrap">'+
      selectorPorPagina('mov-por-pagina', OPCIONES_POR_PAGINA_MOV, STATE.movPorPagina)+
      '<button class="secondary" data-action="mov-pagina-anterior" style="font-size:12px;padding:6px 12px"'+(STATE.movPaginaActual<=1?' disabled':'')+'>« Anterior</button>'+
      '<span>Página '+STATE.movPaginaActual+' de '+totalPaginasMov+'</span>'+
      '<button class="secondary" data-action="mov-pagina-siguiente" style="font-size:12px;padding:6px 12px"'+(STATE.movPaginaActual>=totalPaginasMov?' disabled':'')+'>Siguiente »</button>'+
    '</div>' : '';

  var tableHtml = ''+
  '<div class="card">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">'+
      '<h3 style="margin-bottom:0">Movimientos ('+lista.length+')</h3>'+
      (lista.length ? '<button class="secondary" data-action="exportar-movimientos-excel" style="font-size:12px;padding:6px 12px"><i class="bi bi-file-earmark-excel"></i> Exportar a Excel</button>' : '')+
    '</div>'+
    barraSeleccionHtml+
    (lista.length ? ''+
    '<table id="tabla-movimientos" class="table tabla-movil"><thead><tr><th><input type="checkbox" id="chk-select-all-mov" '+(todosVisiblesSeleccionados?'checked':'')+'></th><th>Fecha</th><th>CC</th><th>Categoría</th><th>Subcategoría</th><th>Contraparte</th><th>Detalle</th><th class="num">Ingreso</th><th class="num">Egreso</th><th></th></tr></thead>'+
    '<tbody>'+rows+'</tbody>'+
    '<tfoot><tr><td colspan="7" data-label="">'+esc(etiquetaTotales)+'</td><td class="num ingreso" data-label="Total Ingreso">'+fmtMonto(totalIngreso)+'</td><td class="num egreso" data-label="Total Egreso">'+fmtMonto(totalEgreso)+'</td><td class="num '+(totalIngreso-totalEgreso>=0?'ingreso':'egreso')+'" data-label="Ingresos - Egresos">'+fmtMonto(totalIngreso-totalEgreso)+'</td></tr></tfoot>'+
    '</table>' : '<div class="empty">No hay movimientos que coincidan con los filtros.</div>')+
    paginacionHtml+
  '</div>';

  return alertaVencimientosHtml + controlTecHtml + filtersHtml + tableHtml;
}

// ===================== IMPORTAR =====================
function renderImportar(){
  var visibles = importadoresVisibles();
  var deCuenta = visibles.filter(function(i){ return !esImportadorTarjeta(i.codigo); });
  var deTarjeta = visibles.filter(function(i){ return esImportadorTarjeta(i.codigo); });
  if(!visibles.length){
    return '<div class="card"><h2>Importar movimientos</h2><div class="empty">No hay importadores habilitados para tu familia. Si necesitás uno, pedíselo al soporte.</div></div>';
  }
  // Opciones de "Entidad" en el orden de la tabla; los de tarjeta se juntan en "Tarjeta de Crédito", donde
  // aparece el primero.
  var opcionesEntidad = [];
  visibles.forEach(function(i){
    var opcion = esImportadorTarjeta(i.codigo) ? 'tarjeta' : i.codigo;
    if(opcionesEntidad.indexOf(opcion)===-1) opcionesEntidad.push(opcion);
  });
  // Si lo elegido ya no está disponible (se ocultó o se apagó Tarjetas), pasar al primero que sí.
  if(opcionesEntidad.indexOf(STATE.importEntidad)===-1) STATE.importEntidad = opcionesEntidad[0];
  if(STATE.importEntidad==='tarjeta' && !deTarjeta.some(function(i){ return i.codigo==='tarjeta_'+STATE.importBanco; })){
    STATE.importBanco = deTarjeta[0].codigo.slice('tarjeta_'.length);
  }
  var e = STATE.importEntidad;
  var msgHtml = STATE.importMsg ? '<div class="msg '+(STATE.importMsg.type==='ok'?'ok':'err')+'">'+esc(STATE.importMsg.text)+'</div>' : '';

  var subFieldsHtml = '';
  if(e === 'tarjeta'){
    subFieldsHtml = ''+
      '<div class="field"><label>Banco</label><select id="imp-banco">'+
        deTarjeta.map(function(i){
          var banco = i.codigo.slice('tarjeta_'.length);
          return '<option value="'+esc(banco)+'" '+(STATE.importBanco===banco?'selected':'')+'>'+esc(i.nombre)+'</option>';
        }).join('')+
      '</select></div>'+
      '<div class="field"><label>Vencimiento</label><input type="date" id="imp-vencimiento" value="'+esc(STATE.importVencimiento||'')+'"></div>'+
      '<div class="field"><label>Marca de tarjeta (opcional)</label><input type="text" id="imp-tarjeta-marca" autocomplete="off" placeholder="Visa, Mastercard, Amex..." value="'+esc(STATE.importTarjetaMarca||'')+'" style="width:150px"></div>';
  }

  var excelHint = e==='excel' ? '<div class="msg ok" style="margin-top:8px">Pegá las filas copiadas de tu Excel, en este orden de columnas (separadas por tab): Periodo, Cuenta, Categoría, Subcategoría, CC, Fecha, Contraparte, Detalle, Ingresos, Egresos. Si falta un Centro de Costo, Categoría o Subcategoría, se crea automáticamente al importar.</div>' : '';

  var formHtml = ''+
  '<div class="card">'+
    '<h2>Importar movimientos</h2>'+
    msgHtml+
    '<div class="fields-row">'+
      '<div class="field"><label>Entidad</label><select id="imp-entidad">'+
        opcionesEntidad.map(function(opcion){
          var etiqueta = opcion==='tarjeta' ? 'Tarjeta de Crédito' : deCuenta.find(function(i){ return i.codigo===opcion; }).nombre;
          return '<option value="'+esc(opcion)+'" '+(e===opcion?'selected':'')+'>'+esc(etiqueta)+'</option>';
        }).join('')+
      '</select></div>'+
      subFieldsHtml+
    '</div>'+
    excelHint+
    '<div class="field" style="margin-top:10px"><label>Texto del resumen</label>'+
    '<textarea id="imp-raw" rows="8" style="width:100%;font-family:\'Geist Mono\',ui-monospace,Consolas,monospace;font-size:12px" placeholder="Pegá acá el texto copiado del resumen...">'+esc(STATE.importRaw||'')+'</textarea></div>'+
    '<div class="fields-row" style="margin-top:10px"><button data-action="preview-import">Previsualizar</button></div>'+
  '</div>';

  var previewHtml = '';
  if(STATE.importPreview){
    var centroOpts = centrosOrdenados().map(function(c){ return '<option value="'+c.id+'">'+esc(c.codigo)+'</option>'; }).join('');
    var catOpts = categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'">'+esc(c.nombre)+'</option>'; }).join('');

    var dupIds = calcularDuplicados(STATE.importPreview.map(function(r){
      return { id:r.id, fecha:r.fecha, centroId:r.centroId, proveedor:r.proveedor, monto:r.monto };
    }));

    var rows = STATE.importPreview.map(function(r){
      var esDup = !!dupIds[r.id];
      var centroSel = '<select data-rowid="'+r.id+'" data-field="centroId"><option value="">—</option>'+
        centrosOrdenados().map(function(c){ return '<option value="'+c.id+'" '+(r.centroId===c.id?'selected':'')+'>'+esc(c.codigo)+'</option>'; }).join('')+'</select>';
      var catSel = '<select data-rowid="'+r.id+'" data-field="categoriaId"><option value="">Sin categoría</option>'+
        categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'" '+(r.categoriaId===c.id?'selected':'')+'>'+esc(c.nombre)+'</option>'; }).join('')+'</select>';
      var subOpts = subcategoriasOrdenadas(STATE.subcategorias.filter(function(s){return s.categoriaId===r.categoriaId;}))
        .map(function(s){ return '<option value="'+s.id+'" '+(r.subcategoriaId===s.id?'selected':'')+'>'+esc(s.nombre)+'</option>'; }).join('');
      var subSel = '<select data-rowid="'+r.id+'" data-field="subcategoriaId"><option value="">—</option>'+subOpts+'</select>';
      var dupTag = esDup ? ' <span title="Posible duplicado: mismo Centro, fecha y monto que otro movimiento. Revisá antes de importar." style="color:var(--danger)"><i class="bi bi-exclamation-triangle"></i></span>' : '';
      var provInput = '<input type="text" id="imp-prov-'+r.id+'" data-rowid="'+r.id+'" data-field="proveedor" value="'+esc(r.proveedor)+'" style="width:100%;min-width:110px;box-sizing:border-box">';
      var detInput = '<input type="text" id="imp-det-'+r.id+'" data-rowid="'+r.id+'" data-field="detalle" value="'+esc(r.detalle)+'" style="width:100%;min-width:110px;box-sizing:border-box">';
      var cuotasInput = '<input type="text" id="imp-cuotas-'+r.id+'" data-rowid="'+r.id+'" data-field="cuotas" value="'+esc(r.cuotas||'')+'" style="width:100%;min-width:60px;box-sizing:border-box">';
      var fechaConsumoInput = '<input type="date" id="imp-fc-'+r.id+'" data-rowid="'+r.id+'" data-field="fechaConsumo" value="'+esc(r.fechaConsumo||'')+'" style="width:100%;min-width:120px;box-sizing:border-box">';
      return '<tr'+(esDup?' class="fila-duplicada"':'')+'>'+
        '<td><input type="checkbox" data-rowid="'+r.id+'" data-field="incluir" '+(r.incluir?'checked':'')+'></td>'+
        '<td class="mono">'+esc(fechaISOaDDMMAAAA(r.fecha)||r.fecha)+dupTag+'</td>'+
        '<td>'+fechaConsumoInput+'</td>'+
        '<td>'+centroSel+'</td>'+
        '<td>'+catSel+'</td>'+
        '<td>'+subSel+'</td>'+
        '<td>'+provInput+'</td>'+
        '<td>'+detInput+'</td>'+
        '<td>'+cuotasInput+'</td>'+
        '<td class="num ingreso">'+(r.monto>0?fmtMonto(r.monto):'')+'</td>'+
        '<td class="num egreso">'+(r.monto<0?fmtMonto(-r.monto):'')+'</td>'+
        '<td style="text-align:center"><input type="checkbox" data-rowid="'+r.id+'" data-field="guardarRegla" '+(r.guardarRegla?'checked':'')+' title="Guardar esta relación contraparte → categoría como regla para futuras importaciones"></td>'+
      '</tr>';
    }).join('');

    var incluidos = STATE.importPreview.filter(function(r){return r.incluir;}).length;
    var duplicados = STATE.importPreview.filter(function(r){return dupIds[r.id];}).length;

    previewHtml = ''+
    '<div class="card">'+
      '<h3>Aplicar a todas las filas</h3>'+
      '<div class="fields-row">'+
        '<div class="field"><label>Centro de Costo</label><select id="imp-centro-all"><option value="">(sin cambio)</option>'+centroOpts+'</select></div>'+
        '<div class="field"><label>Categoría</label><select id="imp-cat-all"><option value="">(sin cambio)</option>'+catOpts+'</select></div>'+
        '<button class="secondary" data-action="apply-all">Aplicar a todas</button>'+
      '</div>'+
    '</div>'+
    '<div class="card">'+
      '<h3>Previsualización ('+STATE.importPreview.length+' movimiento(s), '+incluidos+' seleccionado(s))</h3>'+
      (duplicados>0 ? '<div class="msg err"><i class="bi bi-exclamation-triangle"></i> '+duplicados+' fila(s) marcada(s) como posible duplicado (mismo Centro, fecha y monto que otro movimiento). Revisalas antes de confirmar.</div>' : '')+
      '<table id="import-preview-table" class="table"><thead><tr><th></th><th>Fecha</th><th>Fecha de consumo</th><th>Centro</th><th>Categoría</th><th>Subcategoría</th><th>Contraparte</th><th>Detalle</th><th>Cuotas</th><th class="num">Ingreso</th><th class="num">Egreso</th><th title="Guardar la relación contraparte → categoría como regla para futuras importaciones">Regla</th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table>'+
      '<div class="fields-row" style="margin-top:14px">'+
        '<button data-action="confirm-import">Importar '+incluidos+' movimiento(s)</button>'+
        '<button class="secondary" data-action="cancel-import">Cancelar</button>'+
      '</div>'+
    '</div>';
  }

  var previewExcelHtml = '';
  if(STATE.importPreviewExcel){
    var dupIdsExcel = calcularDuplicados(STATE.importPreviewExcel.map(function(r){
      var centro = STATE.centros.find(function(c){ return (c.codigo||'').toUpperCase() === (r.ccText||'').toUpperCase(); });
      return { id:r.id, fecha:r.fecha, centroId: centro?centro.id:('__nuevo__'+(r.ccText||'').toUpperCase()), proveedor:r.proveedor, monto: r.ingreso>0?r.ingreso:-r.egreso };
    }));

    var rowsExcel = STATE.importPreviewExcel.map(function(r){
      var esDup = !!dupIdsExcel[r.id];
      var tagCC = r.ccExists ? '' : ' <span style="color:var(--danger);font-size:11px">(se creará)</span>';
      var tagCat = r.catExists ? '' : ' <span style="color:var(--danger);font-size:11px">(se creará)</span>';
      var tagSub = (!r.subcategoriaText) ? '' : (r.subExists ? '' : ' <span style="color:var(--danger);font-size:11px">(se creará)</span>');
      var dupTag = esDup ? ' <span title="Posible duplicado: mismo Centro, fecha y monto que otro movimiento. Revisá antes de importar." style="color:var(--danger)"><i class="bi bi-exclamation-triangle"></i></span>' : '';
      return '<tr'+(esDup?' class="fila-duplicada"':'')+'>'+
        '<td><input type="checkbox" data-rowid="'+r.id+'" data-field="incluir" '+(r.incluir?'checked':'')+'></td>'+
        '<td class="mono">'+esc(fechaISOaDDMMAAAA(r.fecha)||r.fecha)+dupTag+'</td>'+
        '<td class="mono">'+esc(r.ccText)+tagCC+'</td>'+
        '<td>'+esc(r.categoriaText)+tagCat+'</td>'+
        '<td>'+esc(r.subcategoriaText)+tagSub+'</td>'+
        '<td>'+esc(r.proveedor)+'</td>'+
        '<td>'+esc(r.detalle)+'</td>'+
        '<td class="num ingreso">'+(r.ingreso>0?fmtMonto(r.ingreso):'')+'</td>'+
        '<td class="num egreso">'+(r.egreso>0?fmtMonto(r.egreso):'')+'</td>'+
      '</tr>';
    }).join('');
    var incluidosExcel = STATE.importPreviewExcel.filter(function(r){return r.incluir;}).length;
    var nuevosCC = STATE.importPreviewExcel.filter(function(r){return !r.ccExists;}).length;
    var nuevasCat = STATE.importPreviewExcel.filter(function(r){return !r.catExists;}).length;
    var duplicadosExcel = STATE.importPreviewExcel.filter(function(r){return dupIdsExcel[r.id];}).length;

    previewExcelHtml = ''+
    '<div class="card">'+
      '<h3>Previsualización ('+STATE.importPreviewExcel.length+' movimiento(s), '+incluidosExcel+' seleccionado(s))</h3>'+
      (nuevosCC>0||nuevasCat>0 ? '<div class="msg ok">Se van a crear automáticamente: '+nuevosCC+' Centro(s) de Costo nuevo(s), '+nuevasCat+' Categoría(s) nueva(s) (marcados en rojo abajo). Revisá que no sean errores de tipeo antes de confirmar.</div>' : '')+
      (duplicadosExcel>0 ? '<div class="msg err"><i class="bi bi-exclamation-triangle"></i> '+duplicadosExcel+' fila(s) marcada(s) como posible duplicado (mismo Centro, fecha y monto que otro movimiento). Revisalas antes de confirmar.</div>' : '')+
      '<table id="import-preview-excel-table" class="table"><thead><tr><th></th><th>Fecha</th><th>CC</th><th>Categoría</th><th>Subcategoría</th><th>Contraparte</th><th>Detalle</th><th class="num">Ingreso</th><th class="num">Egreso</th></tr></thead>'+
      '<tbody>'+rowsExcel+'</tbody></table>'+
      '<div class="fields-row" style="margin-top:14px">'+
        '<button data-action="confirm-import-excel">Importar '+incluidosExcel+' movimiento(s)</button>'+
        '<button class="secondary" data-action="cancel-import">Cancelar</button>'+
      '</div>'+
    '</div>';
  }

  var cantidadReglas = (STATE.reglas||[]).length;
  var reglasHtml = ''+
  '<div class="card" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">'+
    '<div style="font-size:12px;color:var(--ink-soft)">'+cantidadReglas+' regla(s) de categorización guardada(s) — al previsualizar, si la contraparte de una fila coincide con una regla se precargan Categoría y Subcategoría.</div>'+
    '<button type="button" class="secondary" data-action="ir-a-reglas" style="font-size:12px;padding:6px 12px">Administrar reglas (ABM)</button>'+
  '</div>';

  return formHtml + previewHtml + previewExcelHtml + reglasHtml;
}

// ===================== VENCIMIENTOS =====================
function fechaVencCortaAISO(s){
  var m = (s||'').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(!m) return '';
  var dd = m[1].padStart(2,'0'), mm = m[2].padStart(2,'0');
  var yy = m[3].length===2 ? '20'+m[3] : m[3];
  return yy+'-'+mm+'-'+dd;
}
function fechaISOaDDMMAAAA(iso){
  var m = (iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? m[3]+'/'+m[2]+'/'+m[1] : '';
}
function diasHasta(iso){
  if(!iso) return null;
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var partes = iso.split('-').map(Number);
  var f = new Date(partes[0], partes[1]-1, partes[2]);
  return Math.round((f-hoy)/86400000);
}

// Campos compartidos por el formulario de vencimiento (prefijo 'venc') y el de recurrente ('vrec').
// Al cambiar la Categoría se re-renderiza con lo tipeado en STATE.vencDraft (ver el listener en render).
function camposCentroCategoriaVenc(prefijo, e, idEnEdicion){
  var subOpciones = subcategoriasOrdenadas(STATE.subcategorias.filter(function(s){ return s.categoriaId === e.categoriaId; }))
    .map(function(s){ return '<option value="'+s.id+'" '+(e.subcategoriaId===s.id?'selected':'')+'>'+esc(s.nombre)+'</option>'; }).join('');
  return '<div class="field"><label>Centro de Costo</label><select id="f-'+prefijo+'-centro"><option value="">(sin asignar)</option>'+
      centrosOrdenados().map(function(c){ return '<option value="'+c.id+'" '+(e.centroId===c.id?'selected':'')+'>'+esc(c.codigo)+' · '+esc(c.nombre)+'</option>'; }).join('') +
    '</select></div>'+
    '<div class="field"><label>Categoría</label><select id="f-'+prefijo+'-categoria" data-venc-form="'+prefijo+'" data-id="'+esc(idEnEdicion||'')+'"><option value="">Sin categoría</option>'+
      categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'" '+(e.categoriaId===c.id?'selected':'')+'>'+esc(c.nombre)+'</option>'; }).join('')+
    '</select></div>'+
    '<div class="field"><label>Subcategoría</label><select id="f-'+prefijo+'-subcategoria"><option value="">—</option>'+subOpciones+'</select></div>';
}
// Lee del DOM los campos del formulario con ese prefijo; solo los que están en pantalla.
function leerFormVenc(prefijo){
  var valores = {};
  ['concepto', 'fecha', 'monto', 'dia', 'desde', 'hasta', 'estado'].forEach(function(campo){
    var el = document.getElementById('f-'+prefijo+'-'+campo);
    if(el) valores[campo] = el.value;
  });
  [['centro', 'centroId'], ['categoria', 'categoriaId'], ['subcategoria', 'subcategoriaId']].forEach(function(par){
    var el = document.getElementById('f-'+prefijo+'-'+par[0]);
    if(el) valores[par[1]] = el.value;
  });
  return valores;
}
// Lo tipeado en el formulario (si el draft es de ese formulario y de esa fila) sobre los datos guardados.
function conDraftVenc(prefijo, idEnEdicion, base){
  var d = STATE.vencDraft;
  return (d && d.form===prefijo && d.id===(idEnEdicion||'')) ? Object.assign({}, base, d.valores) : base;
}
function mesAaaaMmAMmAaaa(mes){
  var m = (mes||'').match(/^(\d{4})-(\d{2})$/);
  return m ? m[2]+'/'+m[1] : '';
}
var ESTADOS_VENC = [['pendiente', 'Pendiente'], ['pagado', 'Pagado'], ['salteado', 'Salteado (no se paga)']];

// V6: egresos ya cargados en el mes del vencimiento con su misma categoría (y subcategoría, si tiene), para
// avisar "ya tenés este movimiento" antes de pagarlo y cargarlo de nuevo. Solo un aviso: no los vincula.
function movimientosDelVencimiento(v){
  if(!v.categoriaId || !v.fecha) return [];
  var mes = v.fecha.slice(0,7);
  return STATE.movimientos.filter(function(m){
    return (m.fecha||'').slice(0,7)===mes && m.categoriaId===v.categoriaId &&
      (!v.subcategoriaId || m.subcategoriaId===v.subcategoriaId) && (Number(m.egreso)||0) > 0;
  }).sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); });
}
function textoMovimientoYaCargado(movs){
  var m = movs[0];
  return 'Ya tenés un movimiento de esta categoría el '+fechaISOaDDMMAAAA(m.fecha)+' por $'+fmtMonto(m.egreso)+
    (m.proveedor ? ' ('+m.proveedor+')' : '')+(movs.length>1 ? ' y '+(movs.length-1)+' más' : '')+'.';
}

function campoVenc(e, mostrarEstado, idEnEdicion){
  var html = '<div class="field"><label>Concepto</label><input type="text" id="f-venc-concepto" value="'+esc(e.concepto)+'" style="width:220px" placeholder="Ej: Tarjeta Visa Santander"></div>'+
    '<div class="field"><label>Fecha de vencimiento</label><input type="date" id="f-venc-fecha" value="'+esc(e.fecha)+'"></div>'+
    '<div class="field"><label>Monto</label><input type="number" step="0.01" id="f-venc-monto" value="'+esc(e.monto)+'" style="width:130px"></div>'+
    camposCentroCategoriaVenc('venc', e, idEnEdicion);
  if(mostrarEstado){
    html += '<div class="field"><label>Estado</label><select id="f-venc-estado">'+
        ESTADOS_VENC.map(function(par){ return '<option value="'+par[0]+'"'+((e.estado||'pendiente')===par[0]?' selected':'')+'>'+par[1]+'</option>'; }).join('')+
      '</select></div>'+
      '<div class="field" style="align-self:flex-end;margin-bottom:8px"><label style="display:flex;align-items:center;gap:6px;font-weight:400"><input type="checkbox" id="f-venc-crear-mov" style="width:auto"> Cargar también como movimiento</label></div>';
  }
  return html;
}
function campoVencRecurrente(e, idEnEdicion){
  return '<div class="field"><label>Concepto</label><input type="text" id="f-vrec-concepto" value="'+esc(e.concepto)+'" style="width:220px" placeholder="Ej: Patín"></div>'+
    '<div class="field"><label>Día del mes</label><input type="number" min="1" max="31" step="1" id="f-vrec-dia" value="'+esc(e.dia)+'" style="width:80px"></div>'+
    '<div class="field"><label>Monto</label><input type="number" step="0.01" id="f-vrec-monto" value="'+esc(e.monto)+'" style="width:130px"></div>'+
    camposCentroCategoriaVenc('vrec', e, idEnEdicion)+
    '<div class="field"><label>Desde (mes)</label><input type="month" id="f-vrec-desde" value="'+esc(e.desde)+'"></div>'+
    '<div class="field"><label>Hasta (mes, opcional)</label><input type="month" id="f-vrec-hasta" value="'+esc(e.hasta)+'"></div>';
}
// Plantillas de vencimientos recurrentes (V1): se ven siempre en la pestaña; el alta y la edición van en un modal.
function renderVencRecurrentes(){
  var mesActual = fechaHoyISO().slice(0,7);
  var lista = STATE.vencRecurrentes.slice().sort(function(a,b){
    return (a.dia-b.dia) || (a.concepto||'').localeCompare(b.concepto||'', 'es', {sensitivity:'base'});
  });
  var rows = lista.map(function(r){
    var terminado = r.hasta && r.hasta < mesActual;
    var vigencia = 'desde '+mesAaaaMmAMmAaaa(r.desde)+(r.hasta ? ' hasta '+mesAaaaMmAMmAaaa(r.hasta) : '');
    return '<tr'+(terminado?' style="opacity:.55"':'')+'>'+
      '<td data-label="Concepto">'+esc(r.concepto)+'</td>'+
      '<td class="mono" data-label="Día">'+r.dia+'</td>'+
      '<td class="mono" data-label="Centro">'+esc(r.centroId?nombreCentro(r.centroId).split(' · ')[0]:'—')+'</td>'+
      '<td data-label="Categoría">'+(r.categoriaId ? esc(nombreCategoria(r.categoriaId))+(r.subcategoriaId?' › '+esc(nombreSubcategoria(r.subcategoriaId)):'') : '—')+'</td>'+
      '<td class="mono" data-label="Vigencia">'+esc(vigencia)+(terminado?' (terminado)':'')+'</td>'+
      '<td class="num mono" data-label="Monto">'+fmtMonto(r.monto)+'</td>'+
      '<td class="actions-cell">'+
        '<button class="link" data-action="edit-vrec" data-id="'+r.id+'">editar</button>'+
        '<button class="link" data-action="del-vrec" data-id="'+r.id+'">borrar</button>'+
      '</td>'+
    '</tr>';
  }).join('');
  return '<div class="card"><h3><i class="bi bi-arrow-repeat"></i> Vencimientos recurrentes ('+lista.length+')</h3>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Algo que se paga todos los meses. Al abrir la app se crea solo el vencimiento de cada mes (también los que hayan quedado atrás desde el mes "Desde"), que después marcás pagado o salteado. Los cambios valen para los meses que todavía no se crearon.</div>'+
    (lista.length ? '<table class="table tabla-movil"><thead><tr><th>Concepto</th><th>Día</th><th>Centro</th><th>Categoría</th><th>Vigencia</th><th class="num">Monto</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>' : '<div class="empty">Todavía no cargaste ningún vencimiento recurrente.</div>')+
    '<div class="fields-row" style="margin-top:10px"><button class="secondary" data-action="nuevo-vrec">Nuevo recurrente</button></div>'+
  '</div>';
}
function renderVencimientos(){
  var editing = STATE.editing && STATE.editing.type==='venc' ? STATE.vencimientos.find(function(x){return x.id===STATE.editing.id;}) : null;
  var editingRec = STATE.editing && STATE.editing.type==='vrec' ? STATE.editing : null;

  if(editing){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
      '<h2>Editar vencimiento</h2>'+
      (STATE.vencFormMsg ? '<div class="msg err">'+esc(STATE.vencFormMsg)+'</div>' : '')+
      '<div class="fields-row">'+ campoVenc(conDraftVenc('venc', editing.id, editing), true, editing.id) +'</div>'+
      '<div class="fields-row" style="margin-top:14px">'+
        '<button data-action="save-venc" data-id="'+editing.id+'">Guardar cambios</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  }

  if(editingRec){
    var plantilla = editingRec.id ? STATE.vencRecurrentes.find(function(x){ return x.id===editingRec.id; }) : null;
    var baseRec = plantilla || {concepto:'', dia:'', monto:'', centroId:'', categoriaId:'', subcategoriaId:'', desde:fechaHoyISO().slice(0,7), hasta:''};
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
      '<h2>'+(plantilla ? 'Editar vencimiento recurrente' : 'Nuevo vencimiento recurrente')+'</h2>'+
      (STATE.vrecFormMsg ? '<div class="msg err">'+esc(STATE.vrecFormMsg)+'</div>' : '')+
      '<div class="fields-row">'+ campoVencRecurrente(conDraftVenc('vrec', editingRec.id, baseRec), editingRec.id) +'</div>'+
      '<div style="font-size:11px;color:var(--ink-soft);margin-top:8px">Se crea un vencimiento por mes desde el mes "Desde": si es un mes pasado, también se crean los de esos meses. Si el mes no tiene ese día (por ejemplo el 31), vence el último día del mes.'+
        (plantilla ? ' Los cambios valen para los meses que todavía no se crearon; los ya creados se editan en la lista de vencimientos.' : '')+'</div>'+
      '<div class="fields-row" style="margin-top:14px">'+
        '<button data-action="save-vrec" data-id="'+esc(editingRec.id||'')+'">'+(plantilla ? 'Guardar cambios' : 'Agregar')+'</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  }

  var formNuevoVenc = editing ? '' : ''+
  '<div class="card">'+
    '<h2>Nuevo vencimiento</h2>'+
    (STATE.vencFormMsg ? '<div class="msg err">'+esc(STATE.vencFormMsg)+'</div>' : '')+
    '<div class="fields-row">'+ campoVenc(conDraftVenc('venc', '', {concepto:'', fecha:'', monto:'', centroId:'', categoriaId:'', subcategoriaId:''})) +
      '<button data-action="save-venc" data-id="">Agregar</button>'+
    '</div>'+
  '</div>';

  var formHtml = formNuevoVenc;

  var lista = STATE.vencimientos.filter(function(v){ return v.estado==='pendiente'; }).sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); });
  var rows = lista.map(function(v){
    var dias = diasHasta(v.fecha);
    var diasTxt = dias===null ? '' : (dias<0 ? Math.abs(dias)+' día(s) vencido' : (dias===0 ? 'Vence hoy' : 'en '+dias+' día(s)'));
    var colorDias = dias!==null && dias<=3 ? 'egreso' : (dias!==null && dias<=7 ? '' : 'ingreso');
    var yaCargados = movimientosDelVencimiento(v);
    var avisoYaCargado = yaCargados.length ? '<div class="venc-ya-cargado" style="font-size:11px;color:var(--ink-soft);margin-top:4px">'+
        '<i class="bi bi-info-circle"></i> '+esc(textoMovimientoYaCargado(yaCargados))+' '+
        '<button class="link" data-action="pagar-venc-sin-mov" data-id="'+v.id+'">¿Marcar pagado?</button></div>' : '';
    return '<tr>'+
      '<td data-label="Concepto">'+(v.recurrenteId?'<i class="bi bi-arrow-repeat" title="Vencimiento recurrente"></i> ':'')+esc(v.concepto)+avisoYaCargado+'</td>'+
      '<td class="mono" data-label="Fecha">'+esc(fechaISOaDDMMAAAA(v.fecha))+'</td>'+
      '<td class="mono '+colorDias+'" data-label="Estado">'+diasTxt+'</td>'+
      '<td class="mono" data-label="Centro">'+esc(v.centroId?nombreCentro(v.centroId).split(' · ')[0]:'—')+'</td>'+
      '<td class="num mono" data-label="Monto">'+fmtMonto(v.monto)+'</td>'+
      '<td class="actions-cell">'+
        '<button class="link" data-action="pagar-venc" data-id="'+v.id+'">marcar pagado</button>'+
        '<button class="link" data-action="saltear-venc" data-id="'+v.id+'" title="Este mes no se paga">saltear</button>'+
        '<button class="link" data-action="edit-venc" data-id="'+v.id+'">editar</button>'+
        '<button class="link" data-action="del-venc" data-id="'+v.id+'">borrar</button>'+
      '</td>'+
    '</tr>';
  }).join('');

  var tableHtml = '<div class="card"><h3>Vencimientos ('+lista.length+')</h3>'+
    (lista.length ? '<table class="table tabla-movil"><thead><tr><th>Concepto</th><th>Fecha</th><th>Estado</th><th>Centro</th><th class="num">Monto</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>' : '<div class="empty">Todavía no cargaste ningún vencimiento.</div>')+
  '</div>';

  var pagados = STATE.vencimientos.filter(function(v){ return v.estado!=='pendiente'; }).sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
  var rowsPagados = pagados.map(function(v){
    return '<tr>'+
      '<td data-label="Concepto">'+(v.recurrenteId?'<i class="bi bi-arrow-repeat" title="Vencimiento recurrente"></i> ':'')+esc(v.concepto)+'</td>'+
      '<td class="mono" data-label="Fecha">'+esc(fechaISOaDDMMAAAA(v.fecha))+'</td>'+
      '<td data-label="Estado">'+(v.estado==='salteado' ? 'Salteado' : 'Pagado')+'</td>'+
      '<td class="mono" data-label="Centro">'+esc(v.centroId?nombreCentro(v.centroId).split(' · ')[0]:'—')+'</td>'+
      '<td class="num mono" data-label="Monto">'+fmtMonto(v.monto)+'</td>'+
      '<td class="actions-cell">'+
        '<button class="link" data-action="toggle-venc-estado" data-id="'+v.id+'">marcar pendiente</button>'+
        '<button class="link" data-action="del-venc" data-id="'+v.id+'">borrar</button>'+
      '</td>'+
    '</tr>';
  }).join('');
  var tablePagadosHtml = pagados.length ? '<div class="card">'+
    '<details class="resumen-tarjeta" data-grupo-key="venc-pagados"'+(STATE.gruposAbiertos['venc-pagados']?' open':'')+'>'+
      '<summary><span>Vencimientos pagados y salteados ('+pagados.length+')</span></summary>'+
      '<div style="overflow-x:auto;margin-top:10px"><table class="table tabla-movil"><thead><tr><th>Concepto</th><th>Fecha</th><th>Estado</th><th>Centro</th><th class="num">Monto</th><th></th></tr></thead><tbody>'+rowsPagados+'</tbody></table></div>'+
    '</details>'+
  '</div>' : '';

  // Movimientos ya cargados con fecha futura (p. ej. cuotas de tarjeta): no aparecen en Movimientos
  // hasta que llega su fecha, pero se pueden revisar/editar/borrar acá mientras tanto.
  var pendientesMov = STATE.movimientos.filter(esMovimientoPendiente).sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); });
  function filaMovPendiente(m){
    var dias = diasHasta(m.fecha);
    var diasTxt = dias===null ? '' : (dias===0 ? 'Vence hoy' : 'en '+dias+' día(s)');
    return '<tr>'+
      '<td class="mono" data-label="Fecha">'+esc(fechaISOaDDMMAAAA(m.fecha)||m.fecha||'')+'</td>'+
      '<td class="mono" data-label="Vence">'+diasTxt+'</td>'+
      '<td class="mono" data-label="Centro">'+esc(nombreCentro(m.centroId)).split(' · ')[0]+'</td>'+
      '<td data-label="Categoría">'+esc(nombreCategoria(m.categoriaId))+'</td>'+
      '<td data-label="Contraparte">'+(esTarjeta(m)?'<span title="Pagado con tarjeta de crédito"><i class="bi bi-credit-card"></i></span> ':'')+esc(m.proveedor||'')+'</td>'+
      '<td data-label="Detalle">'+esc(m.detalle||'')+'</td>'+
      '<td class="num ingreso" data-label="Ingreso">'+(Number(m.ingreso)?fmtMonto(m.ingreso):'')+'</td>'+
      '<td class="num egreso" data-label="Egreso">'+(Number(m.egreso)?fmtMonto(m.egreso):'')+'</td>'+
      '<td class="actions-cell"><button class="link" data-action="edit-mov" data-id="'+m.id+'">editar</button>'+
      '<button class="link" data-action="del-mov" data-id="'+m.id+'">borrar</button></td>'+
    '</tr>';
  }

  // De los pendientes con tarjeta, agrupar por Fecha + Centro (la cuenta desde la que se paga esa tarjeta)
  // para ver de un vistazo el total a pagar de cada resumen, con el detalle desplegable.
  var pendientesTarjeta = pendientesMov.filter(esTarjeta);
  var pendientesOtros = pendientesMov.filter(function(m){ return !esTarjeta(m); });
  var gruposTarjetaMap = {}, gruposTarjetaOrden = [];
  pendientesTarjeta.forEach(function(m){
    var clave = m.fecha+'|'+(m.centroId||'');
    if(!gruposTarjetaMap[clave]){
      gruposTarjetaMap[clave] = { fecha:m.fecha, centroId:m.centroId||'', movs:[], total:0 };
      gruposTarjetaOrden.push(clave);
    }
    gruposTarjetaMap[clave].movs.push(m);
    gruposTarjetaMap[clave].total += (Number(m.egreso)||0) - (Number(m.ingreso)||0);
  });
  var gruposTarjetaHtml = gruposTarjetaOrden.map(function(clave){
    var g = gruposTarjetaMap[clave];
    var dias = diasHasta(g.fecha);
    var diasTxt = dias===null ? '' : (dias===0 ? 'Vence hoy' : 'en '+dias+' día(s)');
    var nombreCC = g.centroId ? nombreCentro(g.centroId) : '(sin centro asignado)';
    var filasGrupo = g.movs.map(filaMovPendiente).join('');
    var claveAbierto = 'venc-tarjeta|'+clave;
    return '<details class="resumen-tarjeta" data-grupo-key="'+esc(claveAbierto)+'"'+(STATE.gruposAbiertos[claveAbierto]?' open':'')+'>'+
      '<summary>'+
        '<span class="mono">'+esc(fechaISOaDDMMAAAA(g.fecha)||g.fecha)+'</span>'+
        '<span style="color:var(--ink-soft);font-size:12px">'+diasTxt+'</span>'+
        '<span><i class="bi bi-credit-card"></i> '+esc(nombreCC)+'</span>'+
        '<span style="font-size:12px;color:var(--ink-soft)">'+g.movs.length+' movimiento(s)</span>'+
        '<span class="mono egreso" style="margin-left:auto;font-weight:600">'+fmtMonto(g.total)+'</span>'+
      '</summary>'+
      '<div style="overflow-x:auto;margin-top:10px"><table class="table tabla-movil"><thead><tr><th>Fecha</th><th>Vence</th><th>Centro</th><th>Categoría</th><th>Contraparte</th><th>Detalle</th><th class="num">Ingreso</th><th class="num">Egreso</th><th></th></tr></thead><tbody>'+filasGrupo+'</tbody></table></div>'+
    '</details>';
  }).join('');

  var rowsPendientesOtros = pendientesOtros.map(filaMovPendiente).join('');
  var tablePendientesMovHtml = '<div class="card"><h3>Movimientos con fecha futura ('+pendientesMov.length+')</h3>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Movimientos ya cargados (por ejemplo, cuotas de tarjeta) con fecha posterior a hoy. No se cuentan en Saldos todavía; al llegar su fecha van a pasar a verse en Movimientos automáticamente.</div>'+
    (gruposTarjetaHtml ? gruposTarjetaHtml : '')+
    (pendientesOtros.length ? ''+
      (gruposTarjetaHtml ? '<div style="font-size:11px;color:var(--ink-soft);margin:14px 0 8px;text-transform:uppercase;letter-spacing:.04em">Otros movimientos pendientes</div>' : '')+
      '<table class="table tabla-movil"><thead><tr><th>Fecha</th><th>Vence</th><th>Centro</th><th>Categoría</th><th>Contraparte</th><th>Detalle</th><th class="num">Ingreso</th><th class="num">Egreso</th><th></th></tr></thead><tbody>'+rowsPendientesOtros+'</tbody></table>'
      : '')+
    (!pendientesMov.length ? '<div class="empty">No hay movimientos con fecha futura.</div>' : '')+
  '</div>';

  return formHtml + tableHtml + renderVencRecurrentes() + tablePendientesMovHtml + tablePagadosHtml;
}

// ===================== SALDOS =====================
// Titular de un Centro de Costo (D5): un usuario de la familia, elegido en el ABM. '' = sin titular
// (también si el usuario ya no es de la familia).
function titularDeCentro(c){
  var id = c && c.titularId;
  return id && STATE.miembrosFamilia.some(function(m){ return m.userId===id; }) ? id : '';
}
function nombreMiembro(userId){
  var m = STATE.miembrosFamilia.find(function(x){ return x.userId===userId; });
  return m ? m.nombre : '';
}
// Saldos agrupados: un grupo por titular (por nombre) y al final "Sin titular", que suma también lo que
// no tiene Centro de Costo. Cada grupo: {titularId, titulo, total, filas}; solo los que tienen algo.
function agruparSaldosPorTitular(filas, saldoSinCentro){
  var porNombre = STATE.miembrosFamilia.slice().sort(function(a, b){ return a.nombre.localeCompare(b.nombre, 'es', {sensitivity:'base'}); });
  var grupos = porNombre.map(function(m){
    var filasGrupo = filas.filter(function(f){ return f.titularId===m.userId; });
    return { titularId:m.userId, titulo:m.nombre, filas:filasGrupo, total:filasGrupo.reduce(function(s,f){ return s+f.saldo; },0) };
  }).filter(function(g){ return g.filas.length; });
  var sinTitular = filas.filter(function(f){ return !f.titularId; });
  if(sinTitular.length || saldoSinCentro!==0){
    grupos.push({ titularId:'', titulo:'Sin titular', filas:sinTitular,
      total:sinTitular.reduce(function(s,f){ return s+f.saldo; },0) + saldoSinCentro });
  }
  return grupos;
}
function calcularSaldos(){
  var saldoPorCentro = {};
  STATE.centros.forEach(function(c){ saldoPorCentro[c.id] = 0; });
  var saldoSinCentro = 0;

  STATE.movimientos.forEach(function(m){
    if(esMovimientoPendiente(m)) return; // los movimientos con fecha futura no se consideran para el saldo todavía
    var delta = (Number(m.ingreso)||0) - (Number(m.egreso)||0);
    if(m.centroId && saldoPorCentro.hasOwnProperty(m.centroId)){
      saldoPorCentro[m.centroId] += delta;
    } else {
      saldoSinCentro += delta;
    }
  });

  var filas = STATE.centros.filter(function(c){ return centroAdmitePesos(c) || saldoPorCentro[c.id]; }).map(function(c){
    return { id:c.id, codigo:c.codigo, nombre:c.nombre, entidad:c.entidad, titularId: titularDeCentro(c), saldo: saldoPorCentro[c.id]||0 };
  }).sort(function(a,b){ return a.codigo.localeCompare(b.codigo); });

  var grupos = agruparSaldosPorTitular(filas, saldoSinCentro);
  var totalGeneral = grupos.reduce(function(s,g){ return s+g.total; },0);

  return { filas:filas, saldoSinCentro:saldoSinCentro, grupos:grupos, totalGeneral:totalGeneral, calculadoEn: new Date() };
}
function obtenerSaldos(){
  if(STATE.saldosDirty || !STATE.saldosCache){
    STATE.saldosCache = calcularSaldos();
    STATE.saldosDirty = false;
  }
  return STATE.saldosCache;
}
// Logo de la entidad de un Centro de Costo, para Saldos y ABM. Usa el campo explícito `entidad`
// (elegido en ABM); si todavía no está cargado, adivina por el nombre como fallback para no dejar
// en blanco los centros viejos. Va en un chip blanco porque los logos vienen pensados para fondo
// claro (se ven mal sueltos sobre el tema oscuro).
function logoEntidadHtml(centro){
  var e = (centro.entidad||'').toLowerCase();
  if(!e){
    var n = (centro.nombre||'').toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u').replace(/ñ/g,'n');
    if(n.indexOf('santander')>-1) e = 'santander';
    else if(n.indexOf('nacion')>-1) e = 'nacion';
    else if(n.indexOf('provincia')>-1) e = 'provincia';
    else if(n.indexOf('icbc')>-1) e = 'icbc';
    else if(n.indexOf('mercado pago')>-1 || n.indexOf('mercadopago')>-1) e = 'mercadopago';
  }
  var archivo = {santander:'santander.svg', nacion:'nacion.svg', provincia:'provincia.svg', icbc:'icbc.svg', mercadopago:'mercadopago.webp'}[e];
  var nombreEntidad = {santander:'Santander', nacion:'Nación', provincia:'Provincia', icbc:'ICBC', mercadopago:'Mercado Pago'}[e];
  if(!archivo) return '';
  return '<span class="entidad-logo-wrap"><img class="entidad-logo" src="assets/logos/'+archivo+'" alt="'+nombreEntidad+'" title="'+nombreEntidad+'"></span>';
}
function renderSaldos(){
  var s = obtenerSaldos();
  var filas = s.filas, saldoSinCentro = s.saldoSinCentro;

  var horaCalculo = s.calculadoEn.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});

  var cards = ''+
  '<div class="summary-cards">'+
    '<div class="summary-card"><div class="label">Saldo total</div><div class="value">'+fmtMonto(s.totalGeneral)+'</div></div>'+
  '</div>';

  function grupoSaldos(titulo, total, filasGrupo, extraHtml){
    if(!filasGrupo.length && !extraHtml) return '';
    var items = filasGrupo.map(function(f){
      return '<div class="saldo-item">'+
        '<div class="saldo-item-encabezado">'+
          '<div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1">'+renderChip(f.codigo, colorCentro(f.id), colorTextoCentro(f.id))+'<span class="saldo-item-nombre"> · '+esc(f.nombre)+'</span></div>'+
          '<div style="display:flex;align-items:center;gap:10px;flex-shrink:0">'+
            logoEntidadHtml(f)+
            '<button type="button" class="icon-btn" data-action="ir-a-movimientos-centro" data-id="'+f.id+'" title="Ver movimientos de este Centro de Costo" aria-label="Ver movimientos"><i class="bi bi-receipt"></i></button>'+
          '</div>'+
        '</div>'+
        '<div class="saldo-item-monto">'+fmtMonto(f.saldo)+'</div>'+
      '</div>';
    }).join('');
    return '<div class="saldos-grupo">'+
      '<div class="saldos-grupo-encabezado"><div class="saldos-grupo-titulo">'+esc(titulo)+'</div><div class="saldos-grupo-total">'+fmtMonto(total)+'</div></div>'+
      items+(extraHtml||'')+
    '</div>';
  }

  var extraSinCentro = saldoSinCentro !== 0 ? ''+
    '<div class="saldo-item">'+
      '<div class="saldo-item-nombre">Movimientos sin Centro de Costo asignado</div>'+
      '<div class="saldo-item-monto">'+fmtMonto(saldoSinCentro)+'</div>'+
    '</div>' : '';

  var gruposHtml = s.grupos.map(function(g){
    return grupoSaldos(g.titulo, g.total, g.filas, g.titularId ? '' : extraSinCentro);
  }).join('');

  var tabla = '<div class="card">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px">'+
      '<h3 style="margin-bottom:0">Saldo por Centro de Costo</h3>'+
      '<div style="display:flex;align-items:center;gap:8px">'+
        '<span style="font-size:11px;color:var(--ink-soft)">Calculado a las '+horaCalculo+'</span>'+
        '<button class="secondary" data-action="recalcular-saldos" style="font-size:12px;padding:6px 12px">↻ Recalcular</button>'+
      '</div>'+
    '</div>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Parte del saldo inicial cargado en la categoría "Saldo Inicial" (0 si no tiene) y suma/resta todos los ingresos y egresos, sin excluir TEC, inversiones ni Solo control, para reflejar el saldo real de cada cuenta. Se recalcula solo con cada movimiento nuevo; usá "Recalcular" para traer también cambios hechos desde otra sesión. Los movimientos con fecha posterior a hoy se ven en Vencimientos (no en Movimientos) y no se incluyen en este cálculo.</div>'+
    (filas.length || saldoSinCentro!==0 ? '<div class="saldos-grupos">'+gruposHtml+'</div>' : '<div class="empty">Todavía no cargaste ningún Centro de Costo.</div>')+
  '</div>';

  var sUsd = calcularSaldosUsd();
  var tablaUsd = funcionActiva('dolares') && (sUsd.filas.length || sUsd.saldoSinCentro!==0) ? '<div class="card">'+
    '<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:10px;margin-bottom:4px">'+
      '<h3 style="margin-bottom:0">Saldo en dólares</h3>'+
      '<div class="mono" style="font-weight:600">'+fmtUsd(sUsd.totalGeneral)+(STATE.dolarBlueCompra?' <span style="font-size:12px;color:var(--ink-soft);font-weight:400">≈ $'+fmtMonto(sUsd.totalGeneral*STATE.dolarBlueCompra)+' (blue)</span>':'')+'</div>'+
    '</div>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Aparte del saldo en pesos (no se suma al total de arriba). Se carga y se detalla en la pestaña Dólares.</div>'+
    saldosUsdGruposHtml(sUsd)+
  '</div>' : '';

  // USDT: una sola billetera (sin Centro de Costo). Igual que los dólares, aparte del saldo en pesos.
  var saldoUsdt = calcularSaldoUsdt();
  var tablaUsdt = STATE.usdtMovimientos.length ? '<div class="card">'+
    '<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:10px;margin-bottom:4px">'+
      '<h3 style="margin-bottom:0">Saldo en USDT</h3>'+
      '<div class="mono" style="font-weight:600">'+fmtCantidadUsdt(saldoUsdt)+' USDT'+(STATE.usdtCotizacionBid?' <span style="font-size:12px;color:var(--ink-soft);font-weight:400">≈ $'+fmtMonto(saldoUsdt*STATE.usdtCotizacionBid)+' (a $'+fmtMonto(STATE.usdtCotizacionBid)+')</span>':'')+'</div>'+
    '</div>'+
    '<div style="font-size:11px;color:var(--ink-soft)">Aparte del saldo en pesos (no se suma al total de arriba). Se carga y se detalla en la pestaña USDT.</div>'+
  '</div>' : '';

  return cards + tabla + tablaUsd + tablaUsdt;
}

// ===================== RESUMEN =====================
function esTipoCategoria(categoriaId, tipo){
  var cat = STATE.categorias.find(function(c){ return c.id === categoriaId; });
  return !!cat && cat.tipo === tipo;
}
// El tratamiento en reportes sale del campo "tipo" de la categoría (se elige en el ABM), no del nombre.
function esCategoriaInversion(categoriaId){
  return esTipoCategoria(categoriaId, 'inversion');
}
function esCategoriaSueldo(categoriaId){
  return esTipoCategoria(categoriaId, 'sueldo');
}
// TEC y Solo control no cuentan en ningún reporte (Resumen, grilla mensual, Flujo de caja).
function esCategoriaFueraDeReportes(categoriaId){
  return esTipoCategoria(categoriaId, 'tec') || esTipoCategoria(categoriaId, 'control');
}
// Totales de Movimientos (tabla y Excel): sin TEC; Solo control únicamente si se filtra por esa categoría.
function cuentaEnTotalesMovimientos(m, filtroCategorias){
  if(esTipoCategoria(m.categoriaId, 'tec')) return false;
  if(esTipoCategoria(m.categoriaId, 'control')) return (filtroCategorias||[]).indexOf(m.categoriaId) !== -1;
  return true;
}
// Nombre para mostrar las categorías de tipo Inversión en Resumen/Flujo de caja: si hay una sola
// (ej. "Obra") se usa su nombre; si hay varias, se juntan; si no hay ninguna, "Inversión".
function etiquetaInversion(){
  var nombres = STATE.categorias.filter(function(c){ return c.tipo === 'inversion'; }).map(function(c){ return c.nombre; });
  return nombres.length ? nombres.join(' + ') : 'Inversión';
}

var PALETA_DONUT = ['#2F9E6E','#A8D8BE','#E0654B','#F0C48A','#8FBFE0','#C3AEDB','#E3C08D','#7FC4B8','#F2A6A6','#B7D89A'];

// ===================== CHIPS (Centro de Costo / Categoría) =====================
// El color se elige a mano desde el ABM (campo "Color") y se guarda en centros.color /
// categorias.color. Mientras alguno no tenga color asignado (o para los creados por carga
// masiva/importación), se usa un color determinístico según su id como respaldo, para que
// nunca se vea un chip gris/roto y siempre sea "fijo" para ese mismo registro.
function colorAutoPorId(id){
  var hash = 0;
  var s = id || '';
  for(var i=0;i<s.length;i++){ hash = (hash*31 + s.charCodeAt(i)) | 0; }
  return PALETA_DONUT[Math.abs(hash) % PALETA_DONUT.length];
}
function colorCentro(centroId){
  var c = STATE.centros.find(function(x){ return x.id===centroId; });
  return (c && c.color) || colorAutoPorId(centroId||'');
}
// Color de texto explícito del centro (columna centros.color_texto), si se cargó a mano/por SQL.
// Si no hay uno guardado, renderChip calcula el contraste automáticamente.
function colorTextoCentro(centroId){
  var c = STATE.centros.find(function(x){ return x.id===centroId; });
  return (c && c.colorTexto) || '';
}
function colorCategoria(categoriaId){
  var c = STATE.categorias.find(function(x){ return x.id===categoriaId; });
  return (c && c.color) || colorAutoPorId(categoriaId||'');
}
// Color de texto explícito de la categoría (columna categorias.color_texto), si se cargó a mano/por SQL.
// Si no hay uno guardado, renderChip calcula el contraste automáticamente.
function colorTextoCategoria(categoriaId){
  var c = STATE.categorias.find(function(x){ return x.id===categoriaId; });
  return (c && c.colorTexto) || '';
}
function colorTextoParaFondo(hex){
  var c = (hex||'').replace('#','');
  if(c.length===3) c = c.split('').map(function(ch){ return ch+ch; }).join('');
  if(c.length!==6 || /[^0-9a-fA-F]/.test(c)) return '#1A1A1A';
  var r=parseInt(c.substr(0,2),16), g=parseInt(c.substr(2,2),16), b=parseInt(c.substr(4,2),16);
  var luminancia = (0.299*r + 0.587*g + 0.114*b) / 255;
  return luminancia > 0.6 ? '#1A1A1A' : '#FFFFFF';
}
function renderChip(texto, color, colorTexto){
  if(!texto) return '—';
  var bg = color || '#E1EEE7';
  return '<span class="chip" style="background:'+esc(bg)+';color:'+esc(colorTexto||colorTextoParaFondo(bg))+'">'+esc(texto)+'</span>';
}

var NOMBRES_MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function mesLabelCorto(mesStr){
  var m = (mesStr||'').match(/^(\d{4})-(\d{2})$/);
  if(!m) return mesStr||'';
  var idx = parseInt(m[2],10)-1;
  return (NOMBRES_MES_CORTO[idx]||m[2])+' '+m[1].slice(2);
}

function donutChart(segments, size){
  var strokeWidth = Math.round(size*0.16);
  var total = segments.reduce(function(s,x){return s+x.value;},0);
  if(total<=0) return '<div class="empty">Sin datos para graficar.</div>';
  var r = (size - strokeWidth)/2;
  var cx = size/2, cy = size/2;
  var circumference = 2*Math.PI*r;
  var offsetAcc = 0;
  var circles = segments.filter(function(s){return s.value>0;}).map(function(s){
    var pct = s.value/total;
    var dash = pct*circumference;
    var gap = circumference - dash;
    var circle = '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+s.color+'" stroke-width="'+strokeWidth+'" '+
      'stroke-dasharray="'+dash.toFixed(2)+' '+gap.toFixed(2)+'" stroke-dashoffset="'+(-offsetAcc).toFixed(2)+'" transform="rotate(-90 '+cx+' '+cy+')"></circle>';
    offsetAcc += dash;
    return circle;
  }).join('');
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'">'+circles+'</svg>';
}

function trendChart(meses, dataPorMes, width, height){
  if(!meses.length) return '<div class="empty">No hay suficientes datos para la tendencia mensual.</div>';
  var padding = 34;
  var chartW = width - padding*2;
  var chartH = height - padding*2;
  var max = 1;
  meses.forEach(function(m){ var d=dataPorMes[m]||{ingreso:0,egreso:0}; max=Math.max(max,d.ingreso,d.egreso); });
  var n = meses.length;
  var groupW = chartW/n;
  var barW = Math.max(4, Math.min(16, groupW/3));
  var svg = '<line x1="'+padding+'" y1="'+(padding+chartH)+'" x2="'+(width-padding)+'" y2="'+(padding+chartH)+'" stroke="#C7D6CD" stroke-width="1"></line>';
  meses.forEach(function(m,i){
    var d = dataPorMes[m]||{ingreso:0,egreso:0};
    var xBase = padding + i*groupW + groupW/2;
    var hIngreso = (d.ingreso/max)*chartH;
    var hEgreso = (d.egreso/max)*chartH;
    svg += '<rect x="'+(xBase-barW-1.5)+'" y="'+(padding+chartH-hIngreso)+'" width="'+barW+'" height="'+hIngreso+'" fill="#2F9E6E" rx="3"></rect>';
    svg += '<rect x="'+(xBase+1.5)+'" y="'+(padding+chartH-hEgreso)+'" width="'+barW+'" height="'+hEgreso+'" fill="#E0654B" rx="3"></rect>';
    svg += '<text x="'+xBase+'" y="'+(height-12)+'" font-size="10" text-anchor="middle" fill="#71857A">'+esc(mesLabelCorto(m))+'</text>';
  });
  return '<svg viewBox="0 0 '+width+' '+height+'" width="100%" height="'+height+'" preserveAspectRatio="xMidYMid meet">'+svg+'</svg>';
}

function pad2(n){ return String(n).padStart(2,'0'); }
function mesesTrimestreActual(hoy){
  var qStart = Math.floor(hoy.getMonth()/3)*3;
  var out = [];
  for(var i=0;i<3;i++) out.push(hoy.getFullYear()+'-'+pad2(qStart+i+1));
  return out;
}
function mesesSemestreActual(hoy){
  var sStart = hoy.getMonth()<6 ? 0 : 6;
  var out = [];
  for(var i=0;i<6;i++) out.push(hoy.getFullYear()+'-'+pad2(sStart+i+1));
  return out;
}
function mesesAnioActual(hoy){
  var out = [];
  for(var i=0;i<12;i++) out.push(hoy.getFullYear()+'-'+pad2(i+1));
  return out;
}
function mesOffset(hoy, offset){
  var d = new Date(hoy.getFullYear(), hoy.getMonth()+offset, 1);
  return d.getFullYear()+'-'+pad2(d.getMonth()+1);
}
function mesesUltimos(hoy, n){ // últimos n meses terminando en el actual (lo incluye), sin importar si hay datos cargados
  var out = [];
  for(var i=n-1;i>=0;i--) out.push(mesOffset(hoy, -i));
  return out;
}
function mesesProximos(hoy, n){ // próximos n meses, sin incluir el actual (para ver cuotas/vencimientos futuros)
  var out = [];
  for(var i=1;i<=n;i++) out.push(mesOffset(hoy, i));
  return out;
}
function mesesAlrededorDeHoy(hoy, atras, adelante){ // 'atras' meses antes del actual + el actual + 'adelante' meses después
  var out = [];
  for(var i=-atras;i<=adelante;i++) out.push(mesOffset(hoy, i));
  return out;
}
function mesesParaRango(mesesDisponibles, rango){
  var hoy = new Date();
  // "Mes actual": 10 meses en total. En escritorio el actual queda 4to (3 atrás + actual + 6
  // adelante); en mobile, donde entra menos ancho, el actual va primero (actual + 9 adelante).
  if(rango==='actual') return esVistaMobile() ? mesesAlrededorDeHoy(hoy, 0, 9) : mesesAlrededorDeHoy(hoy, 3, 6);
  if(rango==='3m') return mesesUltimos(hoy, 3);
  if(rango==='6m') return mesesUltimos(hoy, 6);
  if(rango==='12m') return mesesUltimos(hoy, 12);
  if(rango==='trimestre') return mesesTrimestreActual(hoy);
  if(rango==='semestre') return mesesSemestreActual(hoy);
  if(rango==='anio') return mesesAnioActual(hoy);
  if(rango==='prox1m') return mesesProximos(hoy, 1);
  if(rango==='prox3m') return mesesProximos(hoy, 3);
  if(rango==='prox6m') return mesesProximos(hoy, 6);
  return mesesDisponibles; // 'todo'
}

function renderGrillaMensual(movs, rango){
  var todosMeses = getMeses().slice().sort();
  if(!todosMeses.length) return '<div class="empty">Todavía no hay movimientos cargados.</div>';

  var meses = mesesParaRango(todosMeses, rango);
  if(!meses.length) return '<div class="empty">No hay meses para mostrar en este rango.</div>';
  var mesesSet = {};
  meses.forEach(function(m){ mesesSet[m] = true; });

  var datos = {}, totalesPorMes = {}, totalesPorMesSinInversion = {}, totalesPorCategoria = {}, granTotal = 0, granTotalSinInversion = 0;

  var idsVentaUsdt = idsMovimientosDeVentaUsdt();
  movs.forEach(function(m){
    if(esCategoriaFueraDeReportes(m.categoriaId)) return;
    if(esCategoriaSueldo(m.categoriaId)) return;
    if(esIngresoPorVentaUsdt(m, idsVentaUsdt)) return; // los pesos de vender USDT son el mismo Sueldo, aunque tengan otra categoría
    var neto = (Number(m.ingreso)||0) - (Number(m.egreso)||0);
    if(neto===0) return;
    var mes = (m.fecha||'').slice(0,7);
    if(!mes || !mesesSet[mes]) return;
    var cid = m.categoriaId || '';
    if(!datos[cid]) datos[cid] = {};
    datos[cid][mes] = (datos[cid][mes]||0) + neto;
    totalesPorMes[mes] = (totalesPorMes[mes]||0) + neto;
    totalesPorCategoria[cid] = (totalesPorCategoria[cid]||0) + neto;
    granTotal += neto;
    if(!esCategoriaInversion(cid)){
      totalesPorMesSinInversion[mes] = (totalesPorMesSinInversion[mes]||0) + neto;
      granTotalSinInversion += neto;
    }
  });

  // Alfabético (mismo criterio que categoriasOrdenadas), para ubicar una categoría rápido y que no cambie de fila entre rangos.
  // Las categorías normales van arriba; las de tipo Inversión (ej. Obra) en una sección aparte debajo,
  // para no mezclar el gasto del día a día con la inversión.
  var categoriaIds = Object.keys(datos).sort(function(a,b){ return nombreCategoria(a).localeCompare(nombreCategoria(b), 'es', {sensitivity:'base'}); });
  if(!categoriaIds.length) return '<div class="empty">No hay movimientos en el rango seleccionado.</div>';
  var idsNormales = categoriaIds.filter(function(cid){ return !esCategoriaInversion(cid); });
  var idsInversion = categoriaIds.filter(function(cid){ return esCategoriaInversion(cid); });

  // Intensidad del color calculada por sección: si no, los montos de Inversión (mucho más grandes)
  // dejan casi sin color a todas las categorías normales.
  function filasCategorias(ids){
    var maxCelda = 0;
    ids.forEach(function(cid){ meses.forEach(function(m){ maxCelda = Math.max(maxCelda, Math.abs(datos[cid][m]||0)); }); });
    return ids.map(function(cid){
      var celdas = meses.map(function(m){
        var v = datos[cid][m]||0;
        var intensidad = maxCelda ? (Math.abs(v)/maxCelda) : 0;
        var colorRgb = v<0 ? '217,123,108' : '78,157,119';
        var estilo = v!==0 ? ' style="background:rgba('+colorRgb+','+(0.08+intensidad*0.32).toFixed(2)+')"' : '';
        return '<td class="num mono"'+estilo+'>'+(v!==0?fmtMonto(v):'—')+'</td>';
      }).join('');
      var totalCat = totalesPorCategoria[cid]||0;
      return '<tr><td>'+esc(cid ? nombreCategoria(cid) : 'Sin categoría')+'</td>'+celdas+'<td class="num mono '+(totalCat>=0?'ingreso':'egreso')+'" style="font-weight:600">'+fmtMonto(totalCat)+'</td></tr>';
    }).join('');
  }
  function filaTotal(etiqueta, porMes, total){
    return '<tr style="font-weight:600"><td>'+esc(etiqueta)+'</td>'+
      meses.map(function(m){ var v=porMes[m]||0; return '<td class="num mono '+(v>=0?'ingreso':'egreso')+'">'+fmtMonto(v)+'</td>'; }).join('')+
      '<td class="num mono '+(total>=0?'ingreso':'egreso')+'">'+fmtMonto(total)+'</td></tr>';
  }

  var headerCols = meses.map(function(m){ return '<th class="num">'+esc(mesLabelCorto(m))+'</th>'; }).join('');
  var seccionInversion = idsInversion.length ?
    '<tbody>'+
      '<tr><td colspan="'+(meses.length+2)+'" style="padding-top:22px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)">Inversión</td></tr>'+
      filasCategorias(idsInversion)+
      filaTotal('Total con '+etiquetaInversion(), totalesPorMes, granTotal)+
    '</tbody>' : '';

  return '<div style="overflow-x:auto">'+
    '<table class="table"><thead><tr><th>Categoría</th>'+headerCols+'<th class="num">Total</th></tr></thead>'+
    '<tbody>'+filasCategorias(idsNormales)+'</tbody>'+
    '<tbody>'+filaTotal('Total', totalesPorMesSinInversion, granTotalSinInversion)+'</tbody>'+
    seccionInversion+
    '</table></div>';
}

// Calcula los 4 totales de Resumen (ingresos/egresos/inversión/saldo) para una combinación de filtros
// de Centro/Categoría/Mes. Extraído de renderResumen() para poder llamarlo dos veces: una con los
// filtros vigentes y otra con el mes anterior, y así mostrar la comparación en las KPI cards.
// Indicadores del Resumen para un recorte de Centro/Categoría/Mes (también los usa la Tendencia mensual,
// mes por mes, así el gráfico cuenta lo mismo que las tarjetas).
// - "Total ingresos" = solo lo categorizado como Sueldo. "Total egresos" = neto (egreso-ingreso) del resto
//   de las categorías (todo menos TEC/Solo control/Sueldo/Inversión). Inversión va aparte.
// - Los movimientos con fecha futura (pendientes) no cuentan, igual que en Saldos: el Resumen muestra lo
//   que ya pasó. Lo pendiente del período se devuelve aparte (pendientes: neto de lo que iría a egresos o
//   Inversión) para avisarlo debajo de "Total egresos".
// - El Sueldo (en pesos o en USDT) se filtra por mes aparte: usa mesEfectivoSueldo en vez del mes calendario
//   (ver la configuración sueldo_dias_mes_siguiente). De USDT cuentan los ingresos con categoría de tipo
//   Sueldo (ver valoresArsIngresosUsdt); los pesos de vender USDT quedan afuera (esa plata ya entró como
//   USDT, sumarla de nuevo la duplicaría).
// - Los gastos en dólares (no las compras/ventas, que ya cuentan por su parte en pesos) suman a egresos o a
//   Inversión pasados a pesos con cotizacionUsdReferencia(), igual que en Flujo de Caja.
function calcularTotalesResumenKpis(centroArr, categoriaArr, mesArr){
  var hoy = fechaHoyISO();
  var filtrados = STATE.movimientos.filter(function(m){
    if(centroArr.length && centroArr.indexOf(m.centroId)===-1) return false;
    if(categoriaArr.length && categoriaArr.indexOf(m.categoriaId)===-1) return false;
    if(mesArr.length && mesArr.indexOf((m.fecha||'').slice(0,7))===-1) return false;
    return true;
  });
  // Gastos en dólares del recorte, como movimientos en pesos (para sumarlos y desglosarlos con el resto).
  var cotizUsd = cotizacionUsdReferencia();
  STATE.movimientosUsd.forEach(function(m){
    if(m.cambioId || !(Number(m.egreso)>0)) return;
    if(centroArr.length && centroArr.indexOf(m.centroId)===-1) return;
    if(categoriaArr.length && categoriaArr.indexOf(m.categoriaId)===-1) return;
    if(mesArr.length && mesArr.indexOf((m.fecha||'').slice(0,7))===-1) return;
    filtrados.push(Object.assign({}, m, { ingreso:0, egreso:(Number(m.egreso)||0)*cotizUsd, moneda:'ARS', origenUsd:true }));
  });
  var idsVentaUsdt = idsMovimientosDeVentaUsdt();
  var movsReales = filtrados.filter(function(m){
    return !esCategoriaFueraDeReportes(m.categoriaId) && !esIngresoPorVentaUsdt(m, idsVentaUsdt) && !esCategoriaSueldo(m.categoriaId);
  });
  var movsPendientes = movsReales.filter(function(m){ return (m.fecha||'') > hoy; });
  var movsHastaHoy = movsReales.filter(function(m){ return (m.fecha||'') <= hoy; });
  var movsInversion = movsHastaHoy.filter(function(m){ return esCategoriaInversion(m.categoriaId); });
  var movsResto = movsHastaHoy.filter(function(m){ return !esCategoriaInversion(m.categoriaId); });

  var movsSueldo = STATE.movimientos.filter(function(m){
    if(!esCategoriaSueldo(m.categoriaId) || esIngresoPorVentaUsdt(m, idsVentaUsdt)) return false;
    if((m.fecha||'') > hoy) return false;
    if(centroArr.length && centroArr.indexOf(m.centroId)===-1) return false;
    if(categoriaArr.length && categoriaArr.indexOf(m.categoriaId)===-1) return false;
    if(mesArr.length && mesArr.indexOf(mesEfectivoSueldo(m.fecha))===-1) return false;
    return true;
  });
  var valoresUsdt = valoresArsIngresosUsdt();
  var usdtSueldo = STATE.usdtMovimientos.filter(function(u){
    if(u.tipo!=='ingreso' || !esCategoriaSueldo(u.categoriaId)) return false;
    if((u.fecha||'') > hoy) return false;
    if(centroArr.length && centroArr.indexOf(u.centroId||'')===-1) return false;
    if(categoriaArr.length && categoriaArr.indexOf(u.categoriaId)===-1) return false;
    if(mesArr.length && mesArr.indexOf(mesEfectivoSueldo(u.fecha))===-1) return false;
    return true;
  });
  function neto(lista){ return lista.reduce(function(s,m){ return s + (Number(m.egreso)||0) - (Number(m.ingreso)||0); },0); }
  var totalIngreso = movsSueldo.reduce(function(s,m){ return s + (Number(m.ingreso)||0); },0)
    + usdtSueldo.reduce(function(s,u){ return s + (valoresUsdt[u.id]||0); },0);
  var totalEgreso = neto(movsResto);
  var totalInversion = neto(movsInversion);
  var saldo = totalIngreso - totalEgreso - totalInversion;
  return { totalIngreso:totalIngreso, totalEgreso:totalEgreso, totalInversion:totalInversion, saldo:saldo, movsResto:movsResto,
    pendientes:neto(movsPendientes), cantPendientes:movsPendientes.length };
}
// "2026-05" -> "2026-04". Para calcular a qué mes comparar cuando el filtro de Mes de Resumen
// tiene un único mes elegido.
function mesAnteriorDe(mesStr){
  var partes = (mesStr||'').split('-');
  if(partes.length!==2) return '';
  var d = new Date(parseInt(partes[0],10), parseInt(partes[1],10)-1, 1);
  return mesOffset(d, -1);
}

function renderResumen(){
  var f = STATE.resumenFiltros || {centro:[], categoria:[], mes:[], vista:'categoria'};

  var centroOptions = centrosOrdenados().map(function(c){ return {value:c.id, label:c.codigo}; });
  var categoriaOptions = categoriasOrdenadas().map(function(c){ return {value:c.id, label:c.nombre}; });
  var meses = getMesesHastaHoy();
  var mesOptions = meses.map(function(m){ return {value:m, label:mesLabelCorto(m)}; });

  var movsCentro = STATE.movimientos.filter(function(m){ return !f.centro.length || f.centro.indexOf(m.centroId)!==-1; });

  var actual = calcularTotalesResumenKpis(f.centro, f.categoria, f.mes);
  var totalIngreso = actual.totalIngreso, totalEgreso = actual.totalEgreso, totalInversion = actual.totalInversion, saldo = actual.saldo;
  var movsResto = actual.movsResto;

  // Comparación contra el mes anterior: solo tiene sentido cuando el filtro de Mes está en un único
  // mes puntual (con 0 o 2+ meses elegidos, "mes anterior" es ambiguo, así que se omite el delta).
  var mesRef = f.mes.length===1 ? f.mes[0] : null;
  var anterior = mesRef ? calcularTotalesResumenKpis(f.centro, f.categoria, [mesAnteriorDe(mesRef)]) : null;
  function deltaHtml(valorActual, favorableSiSube, valorAnterior){
    if(valorAnterior===null || valorAnterior===undefined) return '';
    var diff = valorActual - valorAnterior;
    if(Math.abs(diff) < 1) return '<div style="font-size:11px;margin-top:2px;color:var(--ink-soft)">= mes anterior</div>';
    var subio = diff>0;
    var favorable = favorableSiSube ? subio : !subio;
    var color = favorable ? 'var(--accent)' : 'var(--danger)';
    var icono = subio ? 'bi-arrow-up-short' : 'bi-arrow-down-short';
    return '<div class="mono" style="font-size:11px;margin-top:2px;color:'+color+'"><i class="bi '+icono+'"></i> '+fmtMonto(Math.abs(diff))+' vs. mes ant.</div>';
  }
  // Tasa de ahorro: más comparable entre meses que el Saldo en pesos solo, porque no depende de cuánto
  // ingresó ese mes puntual.
  var tasaAhorro = totalIngreso>0 ? Math.round(saldo/totalIngreso*100) : null;

  // "Estado actual": foto de hoy que junta números de otras pestañas (Saldos, USDT, Dólares,
  // Flujo de Caja) -- a diferencia de las KPI cards de abajo, no depende de los filtros de Centro/
  // Categoría/Mes de esta pantalla, porque son datos globales, no del recorte que se esté mirando.
  var saldosGlobal = obtenerSaldos();
  var saldoUsdtCant = calcularSaldoUsdt();
  var valorUsdtArs = STATE.usdtCotizacionBid ? saldoUsdtCant*STATE.usdtCotizacionBid : null;
  var tenenciaUsd = calcularSaldosUsd().totalGeneral;
  var valorUsdArs = STATE.dolarBlueCompra ? tenenciaUsd*STATE.dolarBlueCompra : null;
  var hayDolares = funcionActiva('dolares') && (STATE.movimientosUsd.length>0 || STATE.centros.some(centroAdmiteDolares));
  var capAhorro = capacidadAhorroPromedio('6m');
  var estadoActualHtml = '<div class="card">'+
    '<h3>Estado actual</h3>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">La foto de hoy — no depende de los filtros de abajo.</div>'+
    '<div class="summary-cards">'+
      '<div class="summary-card"><div class="kpi-ic kpi-ic-accent"><i class="bi bi-bank"></i></div><div class="label">Saldo total (Saldos)</div><div class="value">'+fmtMonto(saldosGlobal.totalGeneral)+'</div></div>'+
      (funcionActiva('usdt') ? '<div class="summary-card"><div class="kpi-ic kpi-ic-warning"><i class="bi bi-coin"></i></div><div class="label">Tenencia USDT</div><div class="value">'+fmtCantidadUsdt(saldoUsdtCant)+' USDT'+(valorUsdtArs!==null?'<div class="mono" style="font-size:12px;color:var(--ink-soft);font-weight:400">≈ '+fmtMonto(valorUsdtArs)+'</div>':'')+'</div></div>' : '')+
      (hayDolares ? '<div class="summary-card"><div class="kpi-ic kpi-ic-accent"><i class="bi bi-currency-dollar"></i></div><div class="label">Tenencia dólares</div><div class="value">'+fmtUsd(tenenciaUsd)+(valorUsdArs!==null?'<div class="mono" style="font-size:12px;color:var(--ink-soft);font-weight:400">≈ '+fmtMonto(valorUsdArs)+' (blue)</div>':'')+'</div></div>' : '')+
      '<div class="summary-card"><div class="kpi-ic kpi-ic-accent"><i class="bi bi-piggy-bank"></i></div><div class="label">Ahorro promedio / mes</div><div class="value">'+(capAhorro?fmtMonto(capAhorro.promedio):'—')+'</div>'+(capAhorro?'<div style="font-size:11px;color:var(--ink-soft);margin-top:2px">últimos 6 meses cerrados, sin '+esc(etiquetaInversion())+'</div>':'')+'</div>'+
    '</div>'+
  '</div>';

  // Desglose por categoría o por centro de costo, según STATE.resumenFiltros.vista: total neto (ingresos - egresos), más
  // cantidad de movimientos (para distinguir "un gasto grande puntual" de "muchos gastos chicos"). No incluye Sueldo (queda afuera de esta comparación, como las inversiones).
  var porGrupo = {};
  movsResto.forEach(function(m){
    var key = f.vista === 'centro' ? (m.centroId||'') : (m.categoriaId||'');
    if(!porGrupo[key]) porGrupo[key] = {monto:0, cant:0};
    porGrupo[key].monto += (Number(m.ingreso)||0) - (Number(m.egreso)||0);
    porGrupo[key].cant++;
  });
  var lista = Object.keys(porGrupo).map(function(k){
    var nombre = f.vista === 'centro' ? (k ? nombreCentro(k).split(' · ')[0] : 'Sin centro') : (k ? nombreCategoria(k) : 'Sin categoría');
    return { nombre: nombre, monto: porGrupo[k].monto, cant: porGrupo[k].cant };
  }).filter(function(x){return x.monto!==0;}).sort(function(a,b){ return Math.abs(b.monto)-Math.abs(a.monto); });
  var maxBar = lista.length ? Math.abs(lista[0].monto) : 1;

  function etiquetaCant(cant){ return ' <span style="color:var(--ink-soft);font-weight:400">('+cant+' mov.)</span>'; }
  var bars = lista.map(function(x){
    var pct = maxBar ? Math.round((Math.abs(x.monto)/maxBar)*100) : 0;
    var claseColor = x.monto >= 0 ? 'ingreso' : 'egreso';
    return '<div class="bar-row"><div class="name">'+esc(x.nombre)+etiquetaCant(x.cant)+'</div>'+
      '<div class="bar-track"><div class="bar-fill '+claseColor+'-fill" style="width:'+pct+'%"></div></div>'+
      '<div class="amt '+claseColor+'">'+fmtMonto(x.monto)+'</div></div>';
  }).join('');
  var totalLista = lista.reduce(function(s,x){ return s+x.monto; },0);
  var claseColorTotalLista = totalLista >= 0 ? 'ingreso' : 'egreso';
  var totalListaHtml = lista.length ? ''+
    '<div class="bar-row" style="border-top:2px solid var(--accent);border-bottom:none;margin-top:4px;padding-top:10px;font-weight:600">'+
      '<div class="name">Total</div><div class="bar-track"></div>'+
      '<div class="amt '+claseColorTotalLista+'">'+fmtMonto(totalLista)+'</div>'+
    '</div>' : '';

  // Top contrapartes: mismo recorte que "Total por Categoría/Centro" (movsResto: sin TEC/Sueldo/Inversión)
  // pero agrupado por proveedor en vez de por categoría -- suele ser más accionable ("Coto: -$65.000
  // en 3 compras" dice más que "Supermercado: -$120.000").
  var porProveedor = {};
  movsResto.forEach(function(m){
    var key = (m.proveedor||'').trim() || 'Sin contraparte';
    if(!porProveedor[key]) porProveedor[key] = {monto:0, cant:0};
    porProveedor[key].monto += (Number(m.ingreso)||0) - (Number(m.egreso)||0);
    porProveedor[key].cant++;
  });
  var listaProveedores = Object.keys(porProveedor).map(function(k){
    return { nombre:k, monto:porProveedor[k].monto, cant:porProveedor[k].cant };
  }).filter(function(x){return x.monto!==0;}).sort(function(a,b){ return Math.abs(b.monto)-Math.abs(a.monto); }).slice(0,8);
  var maxBarProv = listaProveedores.length ? Math.max.apply(null, listaProveedores.map(function(x){return Math.abs(x.monto);})) : 1;
  var barsProveedores = listaProveedores.map(function(x){
    var pct = maxBarProv ? Math.round((Math.abs(x.monto)/maxBarProv)*100) : 0;
    var claseColor = x.monto >= 0 ? 'ingreso' : 'egreso';
    return '<div class="bar-row"><div class="name">'+esc(x.nombre)+etiquetaCant(x.cant)+'</div>'+
      '<div class="bar-track"><div class="bar-fill '+claseColor+'-fill" style="width:'+pct+'%"></div></div>'+
      '<div class="amt '+claseColor+'">'+fmtMonto(x.monto)+'</div></div>';
  }).join('');

  // Donut: top 8 + "Otros" (no incluye las inversiones, que ya tienen su propia tarjeta aparte). Usa el valor absoluto para el tamaño de cada porción (una torta no puede tener porciones negativas), pero muestra el monto real (con signo) en la leyenda.
  var segmentos = lista.slice(0,8).map(function(x,i){ return {label:x.nombre, value:Math.abs(x.monto), montoReal:x.monto, color:PALETA_DONUT[i%PALETA_DONUT.length]}; });
  var restoMonto = lista.slice(8).reduce(function(s,x){return s+x.monto;},0);
  if(restoMonto!==0) segmentos.push({label:'Otros', value:Math.abs(restoMonto), montoReal:restoMonto, color:'#E1EEE7'});
  var donutSvg = donutChart(segmentos, 160);
  var leyenda = segmentos.filter(function(s){return s.value>0;}).map(function(s){
    return '<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:4px">'+
      '<span style="width:10px;height:10px;border-radius:2px;background:'+s.color+';display:inline-block;flex-shrink:0"></span>'+
      '<span>'+esc(s.label)+'</span><span class="mono '+(s.montoReal>=0?'ingreso':'egreso')+'">'+fmtMonto(s.montoReal)+'</span></div>';
  }).join('');

  // Tendencia mensual: las mismas cuentas que las tarjetas, mes por mes (respeta Centro/Categoría pero no
  // el filtro de Mes: muestra todos). Ingresos = Total ingresos; Egresos = Total egresos + Inversión, así la
  // distancia entre las dos barras es el Saldo de ese mes.
  var mesesTrend = meses.slice().sort();
  var dataPorMes = {};
  mesesTrend.forEach(function(mes){
    var t = calcularTotalesResumenKpis(f.centro, f.categoria, [mes]);
    dataPorMes[mes] = { ingreso: Math.max(0, t.totalIngreso), egreso: Math.max(0, t.totalEgreso + t.totalInversion) };
  });
  var trendSvg = trendChart(mesesTrend, dataPorMes, 640, 220);

  return alertaVencimientosProximosHtml()+
  '<div class="card card-filtros">'+
    '<h3>Filtros</h3>'+
    '<div class="filters">'+
      '<div class="field"><label>Centro de Costo</label>'+renderMultiSelect('rf-centro', centroOptions, f.centro)+'</div>'+
      '<div class="field"><label>Categoría</label>'+renderMultiSelect('rf-categoria', categoriaOptions, f.categoria)+'</div>'+
      '<div class="field"><label>Mes</label>'+renderMultiSelect('rf-mes', mesOptions, f.mes)+'</div>'+
      '<div class="field"><label>Desglose por</label><select id="rf-vista">'+
        '<option value="categoria" '+(f.vista==='categoria'?'selected':'')+'>Categoría</option>'+
        '<option value="centro" '+(f.vista==='centro'?'selected':'')+'>Centro de Costo</option>'+
      '</select></div>'+
    '</div>'+
  '</div>'+
  estadoActualHtml+
  '<div class="summary-cards">'+
    '<div class="summary-card"><div class="kpi-ic kpi-ic-accent"><i class="bi bi-arrow-up"></i></div><div class="label">Total ingresos</div><div class="value ingreso">'+fmtMonto(totalIngreso)+'</div>'+deltaHtml(totalIngreso, true, anterior?anterior.totalIngreso:null)+'</div>'+
    '<div class="summary-card"><div class="kpi-ic kpi-ic-danger"><i class="bi bi-arrow-down"></i></div><div class="label">Total egresos</div><div class="value egreso">'+fmtMonto(totalEgreso)+'</div>'+deltaHtml(totalEgreso, false, anterior?anterior.totalEgreso:null)+
      (actual.cantPendientes ? '<div style="font-size:11px;margin-top:2px;color:var(--ink-soft)">+ '+fmtMonto(actual.pendientes)+' pendientes (<button type="button" class="link" data-action="ir-a-vencimientos" style="font-size:11px;padding:0">ver Vencimientos</button>)</div>' : '')+'</div>'+
    '<div class="summary-card"><div class="kpi-ic kpi-ic-warning"><i class="bi bi-building"></i></div><div class="label">'+esc(etiquetaInversion())+'</div><div class="value egreso">'+fmtMonto(totalInversion)+'</div></div>'+
    '<div class="summary-card"><div class="kpi-ic kpi-ic-accent"><i class="bi bi-wallet2"></i></div><div class="label">Saldo</div><div class="value">'+fmtMonto(saldo)+'</div>'+(tasaAhorro!==null?'<div style="font-size:11px;color:var(--ink-soft);margin-top:2px">'+tasaAhorro+'% del ingreso</div>':'')+deltaHtml(saldo, true, anterior?anterior.saldo:null)+'</div>'+
  '</div>'+
  '<div class="card">'+
    '<h3>Tendencia mensual (Ingresos vs Egresos)</h3>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:6px">Cada mes, calculado igual que las tarjetas de arriba: Ingresos = Sueldo; Egresos = gastos netos + '+esc(etiquetaInversion())+'. La diferencia es el Saldo del mes. Respeta los filtros de Centro y Categoría.</div>'+
    trendSvg+
  '</div>'+
  '<div class="card">'+
    '<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">'+
      '<div style="flex-shrink:0">'+donutSvg+'</div>'+
      '<div style="flex:1;min-width:180px">'+(leyenda||'<div class="empty">Sin datos para graficar.</div>')+'</div>'+
    '</div>'+
  '</div>'+
  '<div class="card">'+
    '<h3>Total por '+(f.vista==='centro'?'Centro de Costo':'Categoría')+'</h3>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Ingresos menos egresos de cada '+(f.vista==='centro'?'centro':'categoría')+'. Verde = neto a favor (ingreso), coral = neto en contra (egreso). No incluye TEC (transferencias entre cuentas), '+esc(etiquetaInversion())+' ni Sueldo (quedan afuera de esta comparación).</div>'+
    (lista.length ? bars+totalListaHtml : '<div class="empty">Todavía no hay movimientos cargados.</div>')+
  '</div>'+
  '<div class="card">'+
    '<h3>Top contrapartes</h3>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Las 8 contrapartes con mayor movimiento neto en el período filtrado (mismo recorte que "Total por '+(f.vista==='centro'?'Centro de Costo':'Categoría')+'" de arriba: sin TEC, Sueldo ni '+esc(etiquetaInversion())+').</div>'+
    (listaProveedores.length ? barsProveedores : '<div class="empty">Todavía no hay movimientos cargados.</div>')+
  '</div>'+
  '<div class="card">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px">'+
      '<h3 style="margin-bottom:0">Comparativa mensual por categoría</h3>'+
      '<div class="field" style="min-width:160px"><select id="rf-grilla-rango">'+
        '<option value="actual" '+(STATE.grillaRango==='actual'?'selected':'')+'>Mes actual (centrado)</option>'+
        '<option value="todo" '+(STATE.grillaRango==='todo'?'selected':'')+'>Todo el histórico</option>'+
        '<option value="3m" '+(STATE.grillaRango==='3m'?'selected':'')+'>Últimos 3 meses</option>'+
        '<option value="6m" '+(STATE.grillaRango==='6m'?'selected':'')+'>Últimos 6 meses</option>'+
        '<option value="12m" '+(STATE.grillaRango==='12m'?'selected':'')+'>Últimos 12 meses</option>'+
        '<option value="prox1m" '+(STATE.grillaRango==='prox1m'?'selected':'')+'>Próximo mes</option>'+
        '<option value="prox3m" '+(STATE.grillaRango==='prox3m'?'selected':'')+'>Próximos 3 meses</option>'+
        '<option value="prox6m" '+(STATE.grillaRango==='prox6m'?'selected':'')+'>Próximos 6 meses</option>'+
        '<option value="trimestre" '+(STATE.grillaRango==='trimestre'?'selected':'')+'>Este trimestre</option>'+
        '<option value="semestre" '+(STATE.grillaRango==='semestre'?'selected':'')+'>Este semestre</option>'+
        '<option value="anio" '+(STATE.grillaRango==='anio'?'selected':'')+'>Este año</option>'+
      '</select></div>'+
    '</div>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Ingresos menos egresos por categoría, mes a mes'+(f.centro.length?' (Centro de Costo: '+f.centro.map(function(cid){ return esc(nombreCentro(cid).split(' · ')[0]); }).join(', ')+')':'')+'. Verde = neto a favor, coral = neto en contra. No incluye TEC, Solo control ni Sueldo. Las categorías de tipo Inversión van aparte, debajo del Total. Ignora el filtro de Mes/Categoría de arriba (usa el selector de rango de acá al lado).</div>'+
    renderGrillaMensual(movsCentro, STATE.grillaRango)+
  '</div>';
}

// ===================== FLUJO DE CAJA =====================
// Capacidad de ahorro promedio: Sueldo menos el neto del resto de categorías (sin TEC/Sueldo/Inversión),
// promediada sobre los últimos meses CERRADOS (no cuenta el mes en curso, que suele estar
// incompleto y subestimaría/sobreestimaría el promedio).
// A diferencia del "Saldo" de Resumen, las categorías de tipo Inversión (ej. Obra) NO se restan: se pagan con
// ahorros, no son gasto corriente, y restarlas daba un "ahorro" negativo en los meses de obra fuerte.
// Se devuelve aparte (inversionPromedio) para mostrarla al lado.
// El Sueldo usa mesEfectivoSueldo (no el mes calendario de la fecha) e incluye los ingresos de USDT
// con categoría de tipo Sueldo (valoresArsIngresosUsdt); los pesos de vender USDT quedan afuera, porque
// volver a sumarlos duplicaría la misma plata.
function capacidadAhorroPromedio(ventana){
  var hoy = new Date();
  var mesActualStr = hoy.getFullYear()+'-'+pad2(hoy.getMonth()+1);
  var todosPasados = getMeses().filter(function(m){ return m < mesActualStr; }).sort(); // ascendente
  var usados = ventana==='todo' ? todosPasados : todosPasados.slice(-parseInt(ventana,10));
  if(!usados.length) return null;
  var usadosSet = {};
  usados.forEach(function(m){ usadosSet[m] = true; });

  var ingresoPorMes = {}, egresoPorMes = {}, inversionPorMes = {};
  var idsVentaUsdt = idsMovimientosDeVentaUsdt();
  STATE.movimientos.forEach(function(m){
    if(esCategoriaFueraDeReportes(m.categoriaId)) return;
    if(esIngresoPorVentaUsdt(m, idsVentaUsdt)) return;
    if(esCategoriaSueldo(m.categoriaId)){
      var mesSueldo = mesEfectivoSueldo(m.fecha);
      if(!usadosSet[mesSueldo]) return;
      ingresoPorMes[mesSueldo] = (ingresoPorMes[mesSueldo]||0) + (Number(m.ingreso)||0);
      return;
    }
    var mes = (m.fecha||'').slice(0,7);
    if(!usadosSet[mes]) return;
    if(esCategoriaInversion(m.categoriaId)){
      inversionPorMes[mes] = (inversionPorMes[mes]||0) + (Number(m.egreso)||0) - (Number(m.ingreso)||0);
    } else {
      egresoPorMes[mes] = (egresoPorMes[mes]||0) + (Number(m.egreso)||0) - (Number(m.ingreso)||0);
    }
  });
  var valoresUsdt = valoresArsIngresosUsdt();
  STATE.usdtMovimientos.forEach(function(u){
    if(u.tipo!=='ingreso' || !esCategoriaSueldo(u.categoriaId)) return;
    var mesSueldo = mesEfectivoSueldo(u.fecha);
    if(!usadosSet[mesSueldo]) return;
    ingresoPorMes[mesSueldo] = (ingresoPorMes[mesSueldo]||0) + (valoresUsdt[u.id]||0);
  });
  // Gastos en dólares (no compras/ventas, que ya cuentan por su parte en pesos): son gasto corriente
  // como cualquier otro, valuados a cotizacionUsdReferencia(). Los ingresos en USD que no vienen de
  // una venta (saldo inicial, ahorro) no son sueldo, así que no suman.
  var cotizUsd = cotizacionUsdReferencia();
  STATE.movimientosUsd.forEach(function(m){
    if(m.cambioId || !(Number(m.egreso)>0)) return;
    if(esCategoriaFueraDeReportes(m.categoriaId)) return;
    var mes = (m.fecha||'').slice(0,7);
    if(!usadosSet[mes]) return;
    var ars = (Number(m.egreso)||0)*cotizUsd;
    if(esCategoriaInversion(m.categoriaId)) inversionPorMes[mes] = (inversionPorMes[mes]||0) + ars;
    else egresoPorMes[mes] = (egresoPorMes[mes]||0) + ars;
  });

  var suma = usados.reduce(function(s,mes){
    return s + (ingresoPorMes[mes]||0) - (egresoPorMes[mes]||0);
  },0);
  var sumaInversion = usados.reduce(function(s,mes){ return s + (inversionPorMes[mes]||0); },0);
  return { promedio: suma/usados.length, inversionPromedio: sumaInversion/usados.length, meses: usados };
}
// Cotización para pasar dólares a pesos en Flujo de Caja: el blue compra de hoy; si todavía no se
// pudo traer, la de la última compra/venta cargada (0 si no hay ninguna).
function cotizacionUsdReferencia(){
  if(STATE.dolarBlueCompra) return STATE.dolarBlueCompra;
  var ultima = 0, fechaUltima = '';
  STATE.movimientosUsd.forEach(function(m){
    var par = movimientoPesosDeCambio(m), cant = montoMovimiento(m);
    if(par && cant && (m.fecha||'') >= fechaUltima){ fechaUltima = m.fecha||''; ultima = montoMovimiento(par)/cant; }
  });
  return ultima;
}
// Idem para el USDT: la cotización de venta de hoy; si todavía no se pudo traer, la de la última venta cargada.
function cotizacionUsdtReferencia(){
  if(STATE.usdtCotizacionBid) return STATE.usdtCotizacionBid;
  var ultima = 0, fechaUltima = '';
  STATE.usdtMovimientos.forEach(function(u){
    if(u.tipo!=='venta') return;
    var cant = Number(u.cantidad)||0;
    var cot = Number(u.cotizacion) || (cant ? (Number(u.montoArs)||0)/cant : 0);
    if(cot && (u.fecha||'') >= fechaUltima){ fechaUltima = u.fecha||''; ultima = cot; }
  });
  return ultima;
}
function mesesRestantesDeuda(d){
  if(d.estado==='cancelada') return 0;
  var cuota = Number(d.cuotaMensual)||0;
  if(cuota<=0) return null;
  return Math.max(0, Math.ceil((Number(d.saldoPendiente)||0) / cuota));
}
function fechaEstimadaCancelacion(d){
  var n = mesesRestantesDeuda(d);
  if(n===null) return '';
  return sumarMeses(fechaHoyISO(), n);
}
// Simula mes a mes, para el horizonte pedido, cuánto se acumula de ahorro si se destina el
// promedio histórico menos las cuotas de las deudas activas (cada una deja de "pesar" en
// cuanto termina de pagarse, según su propia cuota y saldo pendiente).
function simularProyeccionFlujo(ahorroPromedio, horizonteMeses){
  var hoy = new Date();
  var deudasSim = STATE.deudas.filter(function(d){ return d.estado!=='cancelada'; }).map(function(d){
    return { saldo: Number(d.saldoPendiente)||0, cuota: Number(d.cuotaMensual)||0 };
  });
  var filas = [];
  var acumulado = 0;
  for(var i=1;i<=horizonteMeses;i++){
    var cuotasMes = 0;
    deudasSim.forEach(function(d){
      if(d.saldo>0 && d.cuota>0){
        var pago = Math.min(d.cuota, d.saldo);
        cuotasMes += pago;
        d.saldo -= pago;
      }
    });
    var ahorroNeto = ahorroPromedio - cuotasMes;
    acumulado += ahorroNeto;
    filas.push({ mes: mesOffset(hoy, i), cuotasDeudas: cuotasMes, ahorroNeto: ahorroNeto, acumulado: acumulado });
  }
  return filas;
}
// Gráfico de línea simple (una serie), con eje de referencia en cero: para visualizar cómo
// evoluciona el ahorro acumulado proyectado, que puede ir de negativo a positivo.
function lineChart(meses, valores, width, height){
  if(!meses.length) return '<div class="empty">No hay meses para proyectar.</div>';
  var padding = 34;
  var chartW = width - padding*2;
  var chartH = height - padding*2;
  var maxAbs = 1;
  valores.forEach(function(v){ maxAbs = Math.max(maxAbs, Math.abs(v)); });
  var n = meses.length;
  var zeroY = padding + chartH/2;
  var stepX = n>1 ? chartW/(n-1) : 0;
  var puntos = valores.map(function(v,i){
    var x = padding + (n>1 ? i*stepX : chartW/2);
    var y = zeroY - (v/maxAbs)*(chartH/2);
    return {x:x, y:y, v:v};
  });
  var pathD = puntos.map(function(p,i){ return (i===0?'M':'L')+p.x.toFixed(1)+' '+p.y.toFixed(1); }).join(' ');
  var svg = '<line x1="'+padding+'" y1="'+zeroY+'" x2="'+(width-padding)+'" y2="'+zeroY+'" stroke="#C7D6CD" stroke-width="1" stroke-dasharray="3 3"></line>';
  svg += '<path d="'+pathD+'" fill="none" stroke="#2F9E6E" stroke-width="2"></path>';
  puntos.forEach(function(p){ svg += '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3.5" fill="'+(p.v>=0?'#2F9E6E':'#E0654B')+'"></circle>'; });
  meses.forEach(function(m,i){
    var x = padding + (n>1 ? i*stepX : chartW/2);
    svg += '<text x="'+x+'" y="'+(height-12)+'" font-size="10" text-anchor="middle" fill="#71857A">'+esc(mesLabelCorto(m))+'</text>';
  });
  return '<svg viewBox="0 0 '+width+' '+height+'" width="100%" height="'+height+'" preserveAspectRatio="xMidYMid meet">'+svg+'</svg>';
}
function campoDeuda(d){
  return '<div class="field"><label>Concepto</label><input type="text" id="f-deuda-concepto" value="'+esc(d.concepto)+'" style="width:220px" placeholder="Ej: Préstamo personal Banco X"></div>'+
    '<div class="field"><label>Saldo pendiente</label><input type="number" step="0.01" id="f-deuda-saldo" value="'+esc(d.saldoPendiente)+'" style="width:150px"></div>'+
    '<div class="field"><label>Cuota mensual</label><input type="number" step="0.01" id="f-deuda-cuota" value="'+esc(d.cuotaMensual)+'" style="width:150px"></div>'+
    '<div class="field"><label>Centro de Costo (opcional)</label><select id="f-deuda-centro"><option value="">(sin asignar)</option>'+
      centrosOrdenados().map(function(c){ return '<option value="'+c.id+'" '+(d.centroId===c.id?'selected':'')+'>'+esc(c.codigo)+' · '+esc(c.nombre)+'</option>'; }).join('') +
    '</select></div>';
}
function renderFlujoCaja(){
  var editing = STATE.editing && STATE.editing.type==='deuda' ? STATE.deudas.find(function(x){return x.id===STATE.editing.id;}) : null;

  if(editing){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
      '<h2>Editar deuda</h2>'+
      (STATE.deudaFormMsg ? '<div class="msg err">'+esc(STATE.deudaFormMsg)+'</div>' : '')+
      '<div class="fields-row">'+ campoDeuda(editing) +'</div>'+
      '<div class="fields-row" style="margin-top:14px">'+
        '<button data-action="save-deuda" data-id="'+editing.id+'">Guardar cambios</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  }

  var formNuevaDeuda = editing ? '' : ''+
  '<div class="card">'+
    '<h2>Nueva deuda</h2>'+
    (STATE.deudaFormMsg ? '<div class="msg err">'+esc(STATE.deudaFormMsg)+'</div>' : '')+
    '<div class="fields-row">'+ campoDeuda({concepto:'', saldoPendiente:'', cuotaMensual:'', centroId:''}) +
      '<button data-action="save-deuda" data-id="">Agregar</button>'+
    '</div>'+
  '</div>';

  var ventana = STATE.flujoVentana || '6m';
  var horizonte = STATE.flujoHorizonte || 12;
  var cap = capacidadAhorroPromedio(ventana);
  var ahorroPromedio = cap ? cap.promedio : 0;

  var deudasActivas = STATE.deudas.filter(function(d){ return d.estado!=='cancelada'; });
  var totalCuotasActivas = deudasActivas.reduce(function(s,d){ return s+(Number(d.cuotaMensual)||0); },0);
  var margen = ahorroPromedio - totalCuotasActivas;
  var saldos = obtenerSaldos();
  var tenenciaUsd = calcularSaldosUsd().totalGeneral;
  var cotizUsdFlujo = cotizacionUsdReferencia();
  var saldoUsdArs = tenenciaUsd*cotizUsdFlujo;
  var tenenciaUsdt = calcularSaldoUsdt();
  var cotizUsdtFlujo = cotizacionUsdtReferencia();
  var saldoUsdtArs = tenenciaUsdt*cotizUsdtFlujo;
  var detalleSaldoTotal = [];
  if(tenenciaUsd) detalleSaldoTotal.push(fmtUsd(tenenciaUsd)+(cotizUsdFlujo ? ' (≈ '+fmtMonto(saldoUsdArs)+' a $'+fmtMonto(cotizUsdFlujo)+')' : ' (sin cotización: no se suman)'));
  if(tenenciaUsdt) detalleSaldoTotal.push(fmtCantidadUsdt(tenenciaUsdt)+' USDT'+(cotizUsdtFlujo ? ' (≈ '+fmtMonto(saldoUsdtArs)+' a $'+fmtMonto(cotizUsdtFlujo)+')' : ' (sin cotización: no se suman)'));

  var proyeccion = cap ? simularProyeccionFlujo(ahorroPromedio, horizonte) : [];
  var mesesProy = proyeccion.map(function(f){ return f.mes; });
  var valoresAcumulado = proyeccion.map(function(f){ return f.acumulado; });

  var configHtml = '<div class="card">'+
    '<h3>Configuración</h3>'+
    '<div class="fields-row">'+
      '<div class="field"><label>Ventana histórica para el promedio</label><select id="fc-ventana">'+
        '<option value="3m" '+(ventana==='3m'?'selected':'')+'>Últimos 3 meses cerrados</option>'+
        '<option value="6m" '+(ventana==='6m'?'selected':'')+'>Últimos 6 meses cerrados</option>'+
        '<option value="12m" '+(ventana==='12m'?'selected':'')+'>Últimos 12 meses cerrados</option>'+
        '<option value="todo" '+(ventana==='todo'?'selected':'')+'>Todo el histórico</option>'+
      '</select></div>'+
      '<div class="field"><label>Meses a proyectar</label><select id="fc-horizonte">'+
        '<option value="6" '+(horizonte===6?'selected':'')+'>6 meses</option>'+
        '<option value="12" '+(horizonte===12?'selected':'')+'>12 meses</option>'+
        '<option value="24" '+(horizonte===24?'selected':'')+'>24 meses</option>'+
      '</select></div>'+
    '</div>'+
  '</div>';

  var summaryHtml = '<div class="summary-cards">'+
    '<div class="summary-card"><div class="label">Capacidad de ahorro promedio / mes</div><div class="value '+(ahorroPromedio>=0?'ingreso':'egreso')+'">'+(cap?fmtMonto(ahorroPromedio):'—')+'</div></div>'+
    '<div class="summary-card"><div class="label">Inversión en '+esc(etiquetaInversion())+' promedio / mes</div><div class="value">'+(cap?fmtMonto(cap.inversionPromedio):'—')+'</div></div>'+
    '<div class="summary-card"><div class="label">Saldo actual total</div><div class="value">'+fmtMonto(saldos.totalGeneral + saldoUsdArs + saldoUsdtArs)+'</div>'+
      (detalleSaldoTotal.length ? '<div style="font-size:11px;color:var(--ink-soft);margin-top:2px">Pesos '+fmtMonto(saldos.totalGeneral)+' + '+detalleSaldoTotal.join(' + ')+'</div>' : '')+
    '</div>'+
    '<div class="summary-card"><div class="label">Cuotas de deudas activas / mes</div><div class="value egreso">'+fmtMonto(totalCuotasActivas)+'</div></div>'+
    '<div class="summary-card"><div class="label">Margen libre / mes</div><div class="value '+(margen>=0?'ingreso':'egreso')+'">'+fmtMonto(margen)+'</div></div>'+
  '</div>'+
  (cap ? '<div style="font-size:11px;color:var(--ink-soft);margin:-10px 0 18px">Promedio calculado sobre '+cap.meses.length+' mes(es) cerrados: '+cap.meses.map(mesLabelCorto).join(', ')+'. Sueldo menos gastos corrientes, sin contar TEC ni '+esc(etiquetaInversion())+': las categorías de tipo Inversión se muestran aparte (a diferencia del Saldo de Resumen, que sí las resta). Los gastos en dólares se suman a los gastos, pasados a pesos al blue.</div>' : '<div class="empty" style="margin:-6px 0 18px">Todavía no hay ningún mes cerrado con movimientos cargados para calcular un promedio (el mes en curso no cuenta).</div>')+
  (cap && margen<0 ? '<div class="msg err" style="margin:-6px 0 18px">Las cuotas de las deudas activas superan la capacidad de ahorro promedio: con el ritmo actual no alcanzan para cubrirlas todas.</div>' : '');

  var lista = STATE.deudas.slice().sort(function(a,b){
    var pa = a.estado==='cancelada' ? 1 : 0, pb = b.estado==='cancelada' ? 1 : 0;
    return pa-pb || (a.concepto||'').localeCompare(b.concepto||'', 'es', {sensitivity:'base'});
  });
  var filas = lista.map(function(d){
    var mesesRest = mesesRestantesDeuda(d);
    var fechaFin = fechaEstimadaCancelacion(d);
    return '<tr>'+
      '<td data-label="Concepto">'+esc(d.concepto)+'</td>'+
      '<td class="num mono egreso" data-label="Saldo pendiente">'+fmtMonto(d.saldoPendiente)+'</td>'+
      '<td class="num mono" data-label="Cuota mensual">'+fmtMonto(d.cuotaMensual)+'</td>'+
      '<td class="mono" data-label="Centro">'+esc(d.centroId?nombreCentro(d.centroId).split(' · ')[0]:'—')+'</td>'+
      '<td class="mono" data-label="Meses restantes">'+(d.estado==='cancelada'?'Cancelada':(mesesRest===null?'—':mesesRest+' mes(es)'))+'</td>'+
      '<td class="mono" data-label="Cancelación estimada">'+(d.estado==='cancelada'||!fechaFin?'—':fechaISOaDDMMAAAA(fechaFin))+'</td>'+
      '<td class="actions-cell">'+
        (d.estado!=='cancelada' ? '<button class="link" data-action="pagar-cuota-deuda" data-id="'+d.id+'">registrar pago de cuota</button>' : '')+
        '<button class="link" data-action="toggle-deuda-estado" data-id="'+d.id+'">'+(d.estado==='cancelada'?'reactivar':'marcar cancelada')+'</button>'+
        '<button class="link" data-action="edit-deuda" data-id="'+d.id+'">editar</button>'+
        '<button class="link" data-action="del-deuda" data-id="'+d.id+'">borrar</button>'+
      '</td>'+
    '</tr>';
  }).join('');
  var tablaDeudasHtml = '<div class="card"><h3>Deudas ('+lista.length+')</h3>'+
    (lista.length ? '<div style="overflow-x:auto"><table class="table tabla-movil"><thead><tr><th>Concepto</th><th class="num">Saldo pendiente</th><th class="num">Cuota mensual</th><th>Centro</th><th>Meses restantes</th><th>Cancelación estimada</th><th></th></tr></thead><tbody>'+filas+'</tbody></table></div>' : '<div class="empty">Todavía no cargaste ninguna deuda.</div>')+
  '</div>';

  // "Ahorro base" es la misma capacidad de ahorro promedio en las N filas (no varía mes a mes, a
  // diferencia de "Cuotas deudas" que sí baja a medida que se van terminando de pagar) — repetirla
  // en cada fila de la tabla era puro ruido. Se muestra una sola vez, arriba, como supuesto de la
  // proyección, y la tabla queda solo con lo que efectivamente cambia mes a mes.
  var filasProy = proyeccion.map(function(f){
    return '<tr>'+
      '<td data-label="Mes">'+esc(mesLabelCorto(f.mes))+'</td>'+
      '<td class="num mono egreso" data-label="Cuotas deudas">'+(f.cuotasDeudas?fmtMonto(f.cuotasDeudas):'—')+'</td>'+
      '<td class="num mono '+(f.ahorroNeto>=0?'ingreso':'egreso')+'" data-label="Ahorro neto">'+fmtMonto(f.ahorroNeto)+'</td>'+
      '<td class="num mono '+(f.acumulado>=0?'ingreso':'egreso')+'" style="font-weight:600" data-label="Acumulado">'+fmtMonto(f.acumulado)+'</td>'+
    '</tr>';
  }).join('');
  var proyeccionHtml = '<div class="card">'+
    '<h3>Proyección de ahorro acumulado (próximos '+horizonte+' meses)</h3>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-bottom:10px">Arranca en $0 y acumula cada mes la capacidad de ahorro promedio menos las cuotas de las deudas activas (que se dan de baja solas cuando terminan de pagarse). No incluye vencimientos ni cuotas de tarjeta ya cargados con fecha futura — esos compromisos puntuales se ven en la pestaña Vencimientos.</div>'+
    (cap ? '<div style="font-size:12px;color:var(--ink-soft);margin-bottom:10px">Ahorro base supuesto: <span class="mono" style="color:var(--ink);font-weight:600">'+fmtMonto(ahorroPromedio)+'</span> / mes en las '+horizonte+' filas de abajo.</div>' : '')+
    (cap ? lineChart(mesesProy, valoresAcumulado, 640, 220) : '<div class="empty">Cargá al menos un mes cerrado de movimientos para poder proyectar.</div>')+
    (cap ? '<div style="overflow-x:auto;margin-top:14px"><table class="table tabla-movil"><thead><tr><th>Mes</th><th class="num">Cuotas deudas</th><th class="num">Ahorro neto</th><th class="num">Acumulado</th></tr></thead><tbody>'+filasProy+'</tbody></table></div>' : '')+
  '</div>';

  return configHtml + summaryHtml + formNuevaDeuda + tablaDeudasHtml + proyeccionHtml;
}

// ===================== DÓLARES (tenencia en USD por Centro de Costo + compras/ventas) =====================
// Los movimientos en dólares están en la tabla "movimientos" con moneda 'USD', pero en memoria viven
// en STATE.movimientosUsd (ver cargarTodo): ningún informe en pesos los ve. Una compra o venta son
// dos movimientos unidos por cambio_id: el de USD (acá) y el de pesos (en Movimientos, cuenta en Saldos).
function fmtUsd(n){ return 'US$ '+fmtMonto(n); }
function ordenarPorCodigo(lista){ return lista.sort(function(a,b){ return (a.codigo||'').localeCompare(b.codigo||'', 'es', {sensitivity:'base'}); }); }
function centrosDolaresOrdenados(){ return ordenarPorCodigo(STATE.centros.filter(centroAdmiteDolares)); }
function tipoMovimientoUsd(m){
  var entra = (Number(m.ingreso)||0) > 0;
  if(m.cambioId) return entra ? 'compra' : 'venta';
  return entra ? 'ingreso' : 'egreso';
}
// "transferencia" solo existe en el formulario: se guarda como un gasto en el CC origen y un ingreso
// en el CC destino, los dos con la categoría TEC (después cada uno se ve y se edita por separado).
var TIPOS_USD = {compra:'Compra de dólares', venta:'Venta de dólares', ingreso:'Ingreso de dólares (o saldo inicial)', egreso:'Gasto en dólares', transferencia:'Transferencia entre cuentas'};
function categoriaTecUsd(){ return categoriasOrdenadas().find(function(c){ return c.tipo==='tec'; }) || null; }
var TIPOS_USD_CORTO = {compra:'Compra', venta:'Venta', ingreso:'Ingreso', egreso:'Gasto'};
function movimientoPesosDeCambio(m){
  if(!m || !m.cambioId) return null;
  return STATE.movimientos.find(function(x){ return x.cambioId===m.cambioId; }) || null;
}
function montoMovimiento(m){ return (Number(m.ingreso)||0) || (Number(m.egreso)||0); }
function calcularSaldosUsd(){
  var saldoPorCentro = {};
  var saldoSinCentro = 0;
  STATE.movimientosUsd.forEach(function(m){
    if(esMovimientoPendiente(m)) return;
    var delta = (Number(m.ingreso)||0) - (Number(m.egreso)||0);
    if(m.centroId && STATE.centros.some(function(c){ return c.id===m.centroId; })) saldoPorCentro[m.centroId] = (saldoPorCentro[m.centroId]||0) + delta;
    else saldoSinCentro += delta;
  });
  // Un CC aparece si admite dólares o si (por un cambio de moneda posterior) todavía tiene saldo en USD.
  var filas = STATE.centros.filter(function(c){ return centroAdmiteDolares(c) || saldoPorCentro[c.id]; }).map(function(c){
    return { id:c.id, codigo:c.codigo, nombre:c.nombre, entidad:c.entidad, titularId: titularDeCentro(c), saldo: saldoPorCentro[c.id]||0 };
  }).sort(function(a,b){ return a.codigo.localeCompare(b.codigo); });
  var grupos = agruparSaldosPorTitular(filas, saldoSinCentro);
  return { filas:filas, saldoSinCentro:saldoSinCentro, grupos:grupos,
    totalGeneral: grupos.reduce(function(s,g){ return s+g.total; },0) };
}
// Grupos por titular con el saldo en USD de cada CC (mismo formato que Saldos en pesos).
function saldosUsdGruposHtml(s){
  function grupo(titulo, total, filasGrupo, extraHtml){
    if(!filasGrupo.length && !extraHtml) return '';
    var items = filasGrupo.map(function(f){
      return '<div class="saldo-item">'+
        '<div class="saldo-item-encabezado">'+
          '<div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1">'+renderChip(f.codigo, colorCentro(f.id), colorTextoCentro(f.id))+'<span class="saldo-item-nombre"> · '+esc(f.nombre)+'</span></div>'+
          '<div style="display:flex;align-items:center;gap:10px;flex-shrink:0">'+logoEntidadHtml(f)+'</div>'+
        '</div>'+
        '<div class="saldo-item-monto">'+fmtUsd(f.saldo)+'</div>'+
      '</div>';
    }).join('');
    return '<div class="saldos-grupo">'+
      '<div class="saldos-grupo-encabezado"><div class="saldos-grupo-titulo">'+esc(titulo)+'</div><div class="saldos-grupo-total">'+fmtUsd(total)+'</div></div>'+
      items+(extraHtml||'')+
    '</div>';
  }
  var extraSinCentro = s.saldoSinCentro !== 0 ? '<div class="saldo-item"><div class="saldo-item-nombre">Movimientos en dólares sin Centro de Costo</div><div class="saldo-item-monto">'+fmtUsd(s.saldoSinCentro)+'</div></div>' : '';
  return '<div class="saldos-grupos">'+
    s.grupos.map(function(g){ return grupo(g.titulo, g.total, g.filas, g.titularId ? '' : extraSinCentro); }).join('')+
  '</div>';
}
// Cotización del dólar blue (ARS) vía DolarApi (pública, sin key, CORS abierto). La tenencia se valúa
// a "compra" (lo que te pagan si vendés hoy); "venta" es lo que pagás si comprás.
async function obtenerDolarBlue(){
  if(STATE.dolarBlueCargando) return;
  STATE.dolarBlueCargando = true;
  STATE.dolarBlueError = null;
  render();
  try{
    var res = await fetch('https://dolarapi.com/v1/dolares/blue');
    if(!res.ok) throw new Error('HTTP '+res.status);
    var data = await res.json();
    var compra = Number(data && data.compra), venta = Number(data && data.venta);
    if(!compra || compra<=0 || !venta || venta<=0) throw new Error('respuesta inesperada de la API');
    STATE.dolarBlueCompra = compra;
    STATE.dolarBlueVenta = venta;
    STATE.dolarBlueActualizada = new Date();
  }catch(e){
    STATE.dolarBlueError = 'No se pudo obtener la cotización del dólar blue ('+(e.message||e)+').';
  }
  STATE.dolarBlueCargando = false;
  render();
}
function dolarBlueInfoHtml(){
  return '<div style="font-size:11px;color:var(--ink-soft);margin-top:4px">'+
    (STATE.dolarBlueCompra ? 'Blue: compra $'+fmtMonto(STATE.dolarBlueCompra)+' / venta $'+fmtMonto(STATE.dolarBlueVenta)+' · actualizada a las '+STATE.dolarBlueActualizada.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})+' — ' : '')+
    '<button class="link" data-action="actualizar-dolar-blue" style="padding:0;font-size:11px">↻ Actualizar</button>'+
    (STATE.dolarBlueError ? '<div style="color:var(--danger);margin-top:2px">'+esc(STATE.dolarBlueError)+'</div>' : '')+
  '</div>';
}
function getDolaresFormValues(){
  function v(id){ return (document.getElementById(id)||{}).value || ''; }
  return {
    tipo: v('f-usd-tipo') || 'compra', fecha: v('f-usd-fecha'), cantidad: v('f-usd-cantidad'),
    centroId: v('f-usd-centro'), montoArs: v('f-usd-monto-ars'), centroArsId: v('f-usd-centro-ars'),
    categoriaId: v('f-usd-categoria'), subcategoriaId: v('f-usd-subcategoria'), detalle: v('f-usd-detalle'),
    centroDestinoId: v('f-usd-centro-destino')
  };
}
function campoDolares(e, editando){
  var esCambio = e.tipo==='compra' || e.tipo==='venta';
  var esTransf = e.tipo==='transferencia';
  // TEC en dólares (ingreso/gasto): igual que en pesos, se puede elegir un CC destino para crear el espejo.
  var esTec = !esCambio && !esTransf && esTipoCategoria(e.categoriaId, 'tec');
  function optsCentro(lista, sel){ return lista.map(function(c){ return '<option value="'+c.id+'" '+(sel===c.id?'selected':'')+'>'+esc(c.codigo)+' · '+esc(c.nombre)+'</option>'; }).join(''); }
  var subOpciones = subcategoriasOrdenadas(STATE.subcategorias.filter(function(s){ return s.categoriaId === e.categoriaId; }))
    .map(function(s){ return '<option value="'+s.id+'" '+(e.subcategoriaId===s.id?'selected':'')+'>'+esc(s.nombre)+'</option>'; }).join('');
  var cantidadNum = parseFloat(e.cantidad)||0;
  // Comprar dólares: pagás la punta "venta" del blue; venderlos: te pagan la punta "compra".
  var cotizSugerida = e.tipo==='compra' ? STATE.dolarBlueVenta : STATE.dolarBlueCompra;
  var sugerencia = (esCambio && cotizSugerida && cantidadNum)
    ? '<button type="button" class="link" data-action="usar-dolar-blue" style="padding:0;font-size:11px;margin-top:4px">Usar blue de hoy ($'+fmtMonto(cotizSugerida)+' → $'+fmtMonto(cantidadNum*cotizSugerida)+')</button>'
    : '';
  var camposCambio = esCambio ? ''+
    '<div class="fields-row" style="margin-top:10px">'+
      '<div class="field"><label>'+(e.tipo==='compra'?'Pesos pagados (ARS)':'Pesos recibidos (ARS)')+'</label><input type="number" step="0.01" min="0" id="f-usd-monto-ars" value="'+esc(e.montoArs)+'" style="width:150px">'+sugerencia+'</div>'+
      '<div class="field"><label>'+(e.tipo==='compra'?'CC de donde salen los pesos':'CC donde entran los pesos')+'</label><select id="f-usd-centro-ars"><option value="">Elegir...</option>'+optsCentro(centrosOrdenados(), e.centroArsId)+'</select></div>'+
    '</div>' : '';
  var campoDestino = esTec ? ''+
    '<div class="fields-row" style="margin-top:10px">'+
      '<div class="field"><label>CC en dólares destino (transferencia, opcional)</label><select id="f-usd-centro-destino"><option value="">Elegir...</option>'+
        optsCentro(centrosDolaresOrdenados().filter(function(c){ return c.id!==e.centroId; }), e.centroDestinoId)+'</select></div>'+
      '<div class="field" style="flex:1 1 260px;justify-content:flex-end"><div style="font-size:11px;color:var(--ink-soft);padding-bottom:8px">'+(editando ?
        'Si lo completás, se crea un movimiento espejo nuevo en ese CC (misma fecha y categoría, misma cantidad, tipo contrario). No hace falta si ya lo cargaste.' :
        'Si lo completás, se crea automáticamente el movimiento espejo en ese CC (misma fecha y categoría, misma cantidad, tipo contrario). Si lo dejás vacío, se carga solo este movimiento.'
      )+'</div></div>'+
    '</div>' : '';
  var catTec = categoriaTecUsd();
  var filaCategoria = esTransf ? ''+
    '<div class="fields-row" style="margin-top:10px">'+
      '<div class="field"><label>CC en dólares destino (donde entran)</label><select id="f-usd-centro-destino"><option value="">Elegir...</option>'+
        optsCentro(centrosDolaresOrdenados().filter(function(c){ return c.id!==e.centroId; }), e.centroDestinoId)+'</select></div>'+
      '<div class="field"><label>Detalle (opcional)</label><input type="text" id="f-usd-detalle" value="'+esc(e.detalle)+'" style="width:200px"></div>'+
    '</div>'+
    '<div style="font-size:11px;color:var(--ink-soft);margin-top:8px">'+(catTec ?
      'Se crean dos movimientos con la categoría '+esc(catTec.nombre)+': un gasto en el CC origen y un ingreso en el CC destino.' :
      'Para usar este tipo creá primero una categoría de tipo TEC en ABM → Categorías.')+'</div>'
  : ''+
    '<div class="fields-row" style="margin-top:10px">'+
      '<div class="field"><label>Categoría'+(esCambio?'':' (opcional)')+'</label><select id="f-usd-categoria"><option value="">'+(esCambio?'Elegir...':'Sin categoría')+'</option>'+
        categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'" '+(e.categoriaId===c.id?'selected':'')+'>'+esc(c.nombre)+'</option>'; }).join('')+
      '</select></div>'+
      '<div class="field"><label>Subcategoría</label><select id="f-usd-subcategoria"><option value="">—</option>'+subOpciones+'</select></div>'+
      '<div class="field"><label>Detalle (opcional)</label><input type="text" id="f-usd-detalle" value="'+esc(e.detalle)+'" style="width:200px"></div>'+
    '</div>';
  return ''+
    (STATE.dolaresFormMsg ? '<div class="msg err">'+esc(STATE.dolaresFormMsg)+'</div>' : '')+
    '<div class="fields-row">'+
      '<div class="field"><label>Tipo</label><select id="f-usd-tipo">'+
        ['compra','venta','ingreso','egreso','transferencia'].map(function(t){ return '<option value="'+t+'" '+(e.tipo===t?'selected':'')+'>'+TIPOS_USD[t]+'</option>'; }).join('')+
      '</select></div>'+
      '<div class="field"><label>Fecha</label><input type="date" id="f-usd-fecha" value="'+esc(e.fecha)+'"></div>'+
      '<div class="field"><label>Cantidad (US$)</label><input type="number" step="0.01" min="0" id="f-usd-cantidad" value="'+esc(e.cantidad)+'" style="width:130px"></div>'+
      '<div class="field"><label>'+(esTransf?'CC en dólares origen (de donde salen)':'CC en dólares')+'</label><select id="f-usd-centro"><option value="">Elegir...</option>'+optsCentro(centrosDolaresOrdenados(), e.centroId)+'</select></div>'+
    '</div>'+
    camposCambio+
    filaCategoria+
    campoDestino+
    (esCambio ? '<div style="font-size:11px;color:var(--ink-soft);margin-top:8px">Al guardar se crea (o actualiza) también el '+(e.tipo==='compra'?'egreso':'ingreso')+' en pesos en Movimientos, con la misma categoría. Para que no cuente como gasto o ingreso en Resumen, usá una categoría de tipo Inversión o Solo control.</div>' : '');
}
function renderDolares(){
  var s = calcularSaldosUsd();
  var editing = STATE.editing && STATE.editing.type==='usd' ? STATE.movimientosUsd.find(function(x){ return x.id===STATE.editing.id; }) : null;
  var editingNormalizado = null;
  if(editing){
    var parEd = movimientoPesosDeCambio(editing);
    editingNormalizado = {
      tipo: tipoMovimientoUsd(editing), fecha: editing.fecha, cantidad: montoMovimiento(editing), centroId: editing.centroId,
      montoArs: parEd ? montoMovimiento(parEd) : '', centroArsId: parEd ? parEd.centroId : '',
      categoriaId: editing.categoriaId, subcategoriaId: editing.subcategoriaId, detalle: editing.detalle
    };
  }
  var e = STATE.dolaresDraft || editingNormalizado || {tipo:'compra', fecha:fechaHoyISO(), cantidad:'', centroId:'', montoArs:'', centroArsId:'', categoriaId:'', subcategoriaId:'', detalle:''};

  var formHtml = '';
  if(editing){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
      '<h2>Editar movimiento en dólares</h2>'+
      campoDolares(e, true)+
      '<div class="fields-row" style="margin-top:14px">'+
        '<button data-action="save-dolares" data-id="'+editing.id+'">Guardar cambios</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  } else {
    formHtml = '<div class="card">'+
      '<h2>Nuevo movimiento en dólares</h2>'+
      (centrosDolaresOrdenados().length ? campoDolares(e)+'<div class="fields-row" style="margin-top:14px"><button data-action="save-dolares" data-id="">Agregar</button></div>'
        : '<div class="empty">Todavía no hay Centros de Costo en dólares. En ABM → Centros de Costo elegí la moneda "Dólares" (o "Pesos y dólares") para las cuentas que tengan caja en USD.</div>')+
    '</div>';
  }

  var lista = STATE.movimientosUsd.slice().sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
  var rows = lista.map(function(m){
    var tipo = tipoMovimientoUsd(m);
    var entra = tipo==='compra' || tipo==='ingreso';
    var cant = montoMovimiento(m);
    var par = movimientoPesosDeCambio(m);
    var montoArs = par ? montoMovimiento(par) : 0;
    return '<tr>'+
      '<td class="mono" data-label="Fecha">'+esc(fechaISOaDDMMAAAA(m.fecha)||m.fecha||'')+'</td>'+
      '<td data-label="Tipo">'+(entra?'<i class="bi bi-arrow-up-circle" style="color:var(--accent)"></i> ':'<i class="bi bi-arrow-down-circle" style="color:var(--danger)"></i> ')+TIPOS_USD_CORTO[tipo]+'</td>'+
      '<td data-label="Centro">'+(m.centroId?renderChip(nombreCentro(m.centroId).split(' · ')[0], colorCentro(m.centroId), colorTextoCentro(m.centroId)):'—')+'</td>'+
      '<td class="num mono" data-label="US$">'+(entra?'+':'−')+fmtMonto(cant)+'</td>'+
      '<td class="num mono" data-label="Pesos">'+(par?fmtMonto(montoArs)+' <span style="font-size:11px;color:var(--ink-soft)">'+esc(nombreCentro(par.centroId).split(' · ')[0])+'</span>':(m.cambioId?'<span title="El movimiento en pesos vinculado ya no existe">—</span>':'—'))+'</td>'+
      '<td class="num mono" data-label="Cotización">'+(par && cant ? fmtMonto(montoArs/cant) : '—')+'</td>'+
      '<td data-label="Categoría">'+(m.categoriaId?esc(nombreCategoria(m.categoriaId)):'—')+'</td>'+
      '<td data-label="Detalle">'+esc(m.detalle||'')+'</td>'+
      '<td class="actions-cell"><button class="icon-btn" data-action="edit-dolares" data-id="'+m.id+'" title="Editar" aria-label="Editar"><i class="bi bi-pencil"></i></button>'+
      '<button class="icon-btn icon-btn-danger" data-action="del-dolares" data-id="'+m.id+'" title="Borrar" aria-label="Borrar"><i class="bi bi-trash"></i></button></td>'+
    '</tr>';
  }).join('');

  return ''+
  '<div class="card">'+
    '<h2><i class="bi bi-currency-dollar"></i> Tenencia de dólares</h2>'+
    '<div style="font-size:12px;color:var(--ink-soft);margin-top:2px">Registrá acá las compras y ventas de dólares y, si hace falta, algún ingreso o gasto en USD. Una compra o venta mueve los dólares en el CC en dólares y crea sola la contraparte en pesos en Movimientos. Los montos en dólares no se suman a ningún informe en pesos.</div>'+
  '</div>'+
  '<div class="summary-cards">'+
    '<div class="summary-card"><div class="label">Tenencia total</div><div class="value">'+fmtUsd(s.totalGeneral)+'</div></div>'+
    '<div class="summary-card"><div class="label">Valor en pesos (dólar blue)</div>'+
      (STATE.dolarBlueCargando ? '<div class="value" style="font-size:14px;color:var(--ink-soft)">Consultando…</div>'
        : STATE.dolarBlueCompra ? '<div class="value">$'+fmtMonto(s.totalGeneral*STATE.dolarBlueCompra)+'</div>'
        : '<div class="value" style="font-size:14px;color:var(--ink-soft)">Sin cotización</div>')+
      dolarBlueInfoHtml()+
    '</div>'+
  '</div>'+
  '<div class="card"><h3>Saldo en dólares por Centro de Costo</h3>'+
    (s.filas.length || s.saldoSinCentro!==0 ? saldosUsdGruposHtml(s) : '<div class="empty">Todavía no hay Centros de Costo en dólares.</div>')+
  '</div>'+
  formHtml+
  '<div class="card">'+
    '<h3>Movimientos en dólares ('+lista.length+')</h3>'+
    (lista.length ? '<table class="table tabla-movil"><thead><tr><th>Fecha</th><th>Tipo</th><th>Centro</th><th class="num">US$</th><th class="num">Pesos</th><th class="num">Cotización</th><th>Categoría</th><th>Detalle</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>' : '<div class="empty">Todavía no cargaste ningún movimiento en dólares.</div>')+
  '</div>';
}

// ===================== USDT (tenencia + ventas que se acreditan en pesos) =====================
function getUsdtFormValues(){
  var v = {
    tipo: (document.getElementById('f-usdt-tipo')||{}).value || 'ingreso',
    fecha: (document.getElementById('f-usdt-fecha')||{}).value || '',
    cantidad: (document.getElementById('f-usdt-cantidad')||{}).value || '',
    detalle: (document.getElementById('f-usdt-detalle')||{}).value || '',
    montoArs: (document.getElementById('f-usdt-monto-ars')||{}).value || '',
    centroId: (document.getElementById('f-usdt-centro')||{}).value || '',
    categoriaId: (document.getElementById('f-usdt-categoria')||{}).value || '',
    subcategoriaId: (document.getElementById('f-usdt-subcategoria')||{}).value || ''
  };
  var destinoVenta = v.tipo==='venta' ? destinoVentaUsdt() : null;
  if(destinoVenta){ v.categoriaId = destinoVenta.categoriaId; v.subcategoriaId = destinoVenta.subcategoriaId; }
  return v;
}
function campoUsdt(e){
  var esVenta = e.tipo === 'venta';
  var subOpciones = subcategoriasOrdenadas(STATE.subcategorias.filter(function(s){ return s.categoriaId === e.categoriaId; }))
    .map(function(s){ return '<option value="'+s.id+'" '+(e.subcategoriaId===s.id?'selected':'')+'>'+esc(s.nombre)+'</option>'; }).join('');
  var categoriaSubHtml = ''+
    '<div class="field"><label>Categoría'+(esVenta?'':' (opcional; de tipo Sueldo para que cuente como sueldo)')+'</label><select id="f-usdt-categoria"><option value="">'+(esVenta?'Elegir...':'Sin categoría')+'</option>'+
      categoriasOrdenadas().map(function(c){ return '<option value="'+c.id+'" '+(e.categoriaId===c.id?'selected':'')+'>'+esc(c.nombre)+'</option>'; }).join('')+
    '</select></div>'+
    '<div class="field"><label>Subcategoría</label><select id="f-usdt-subcategoria"><option value="">—</option>'+subOpciones+'</select></div>';
  var destinoVenta = esVenta ? destinoVentaUsdt() : null;
  if(destinoVenta){
    categoriaSubHtml = '<div class="field"><label>Categoría</label><div style="padding:9px 0;font-size:13px">'+esc(destinoVenta.etiqueta)+'</div></div>';
  }
  var camposTipo;
  if(esVenta){
    camposTipo = ''+
      '<div class="fields-row" style="margin-top:10px">'+
        '<div class="field"><label>Monto recibido (ARS)</label><input type="number" step="0.01" id="f-usdt-monto-ars" value="'+esc(e.montoArs)+'" style="width:140px"></div>'+
        '<div class="field"><label>Centro de Costo destino</label><select id="f-usdt-centro"><option value="">Elegir...</option>'+
          centrosOrdenados().map(function(c){ return '<option value="'+c.id+'" '+(e.centroId===c.id?'selected':'')+'>'+esc(c.codigo)+' · '+esc(c.nombre)+'</option>'; }).join('')+
        '</select></div>'+
        categoriaSubHtml+
      '</div>'+
      '<div style="font-size:11px;color:var(--ink-soft);margin-top:8px">Al guardar se crea (o actualiza) automáticamente un ingreso en pesos en Movimientos, por el monto recibido, en el Centro de Costo elegido acá'+(destinoVenta?' y con categoría '+esc(destinoVenta.etiqueta)+' (no se cuenta de nuevo como Sueldo: ya se contó al ingresar el USDT)':' y la Categoría elegida')+'.</div>';
  } else {
    var cantidadNum = parseFloat(e.cantidad)||0;
    var sugerenciaCotizacion = STATE.usdtCotizacionBid && cantidadNum
      ? '<button type="button" class="link" data-action="usar-cotizacion-usdt-ingreso" style="padding:0;font-size:11px;margin-top:4px">Usar cotización de hoy ($'+fmtMonto(STATE.usdtCotizacionBid)+'/USDT → $'+fmtMonto(cantidadNum*STATE.usdtCotizacionBid)+')</button>'
      : '';
    // Todo ingreso de USDT ya cuenta como Sueldo en Resumen/Flujo de caja (ver valoresArsIngresosUsdt):
    // estos campos solo sirven para fijar a mano su valor en pesos, así que quedan colapsados por default.
    var mostrarOpcionalesIngreso = STATE.usdtIngresoOpcionalesAbierto || !!e.categoriaId || !!e.montoArs;
    camposTipo = mostrarOpcionalesIngreso ? ''+
      '<div class="fields-row" style="margin-top:10px">'+
        categoriaSubHtml+
        '<div class="field"><label>Valor en pesos (referencial)</label><input type="number" step="0.01" id="f-usdt-monto-ars" value="'+esc(e.montoArs)+'" style="width:140px">'+sugerenciaCotizacion+'</div>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--ink-soft);margin-top:8px">Todo ingreso de USDT cuenta como Sueldo en Resumen y Flujo de Caja. Si cargás un valor en pesos se usa ese; si no, se valúa a la cotización con la que se vendió (o a la de hoy, si todavía no se vendió). No crea ningún movimiento en pesos ni afecta ningún Centro de Costo.</div>'
      : '<button type="button" class="link" data-action="toggle-usdt-opcionales" style="padding:6px 0;font-size:12px;margin-top:4px"><i class="bi bi-plus-circle"></i> Valor en pesos y categoría (opcional)</button>';
  }
  return ''+
    (STATE.usdtFormMsg ? '<div class="msg err">'+esc(STATE.usdtFormMsg)+'</div>' : '')+
    '<div class="fields-row">'+
      '<div class="field"><label>Tipo</label><select id="f-usdt-tipo">'+
        '<option value="ingreso" '+(e.tipo==='ingreso'?'selected':'')+'>Ingreso de USDT</option>'+
        '<option value="venta" '+(e.tipo==='venta'?'selected':'')+'>Venta de USDT</option>'+
      '</select></div>'+
      '<div class="field"><label>Fecha</label><input type="date" id="f-usdt-fecha" value="'+esc(e.fecha)+'"></div>'+
      '<div class="field"><label>Cantidad (USDT)</label><input type="number" step="0.00000001" min="0" id="f-usdt-cantidad" value="'+esc(e.cantidad)+'" style="width:150px"></div>'+
      '<div class="field"><label>Detalle (opcional)</label><input type="text" id="f-usdt-detalle" value="'+esc(e.detalle)+'" style="width:200px"></div>'+
    '</div>'+
    camposTipo;
}
function renderUsdt(){
  var saldo = calcularSaldoUsdt();
  var editing = STATE.editing && STATE.editing.type==='usdt' ? STATE.usdtMovimientos.find(function(x){return x.id===STATE.editing.id;}) : null;
  var editingNormalizado = editing ? {
    tipo: editing.tipo, fecha: editing.fecha, cantidad: editing.cantidad, detalle: editing.detalle,
    montoArs: editing.montoArs||'', centroId: editing.centroId, categoriaId: editing.categoriaId, subcategoriaId: editing.subcategoriaId
  } : null;
  var e = STATE.usdtDraft || editingNormalizado || {tipo:'ingreso', fecha:fechaHoyISO(), cantidad:'', detalle:'', montoArs:'', centroId:'', categoriaId:'', subcategoriaId:''};

  var formHtml = '';
  if(editing){
    MODAL_HTML = '<div class="modal-overlay" data-modal-backdrop="edit"><div class="modal-card">'+
      '<h2>Editar movimiento USDT</h2>'+
      campoUsdt(e)+
      '<div class="fields-row" style="margin-top:14px">'+
        '<button data-action="save-usdt" data-id="'+editing.id+'">Guardar cambios</button>'+
        '<button class="secondary" data-action="cancel-edit">Cancelar</button>'+
      '</div>'+
    '</div></div>';
  } else {
    formHtml = ''+
    '<div class="card">'+
      '<h2>Nuevo movimiento USDT</h2>'+
      campoUsdt(e)+
      '<div class="fields-row" style="margin-top:14px"><button data-action="save-usdt" data-id="">Agregar</button></div>'+
    '</div>';
  }

  var lista = STATE.usdtMovimientos.slice().sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
  var rows = lista.map(function(u){
    var esVenta = u.tipo==='venta';
    return '<tr>'+
      '<td class="mono" data-label="Fecha">'+esc(fechaISOaDDMMAAAA(u.fecha)||u.fecha||'')+'</td>'+
      '<td data-label="Tipo">'+(esVenta?'<i class="bi bi-arrow-down-circle" style="color:var(--danger)"></i> Venta':'<i class="bi bi-arrow-up-circle" style="color:var(--accent)"></i> Ingreso')+'</td>'+
      '<td class="num mono" data-label="Cantidad">'+fmtCantidadUsdt(u.cantidad)+'</td>'+
      '<td class="num mono" data-label="Monto ARS">'+(u.montoArs?fmtMonto(u.montoArs):'—')+'</td>'+
      '<td class="num mono" data-label="Cotización">'+(u.cotizacion?fmtMonto(u.cotizacion):'—')+'</td>'+
      '<td data-label="Centro">'+(esVenta?esc(nombreCentro(u.centroId).split(' · ')[0]):'—')+'</td>'+
      '<td data-label="Categoría">'+(u.categoriaId?esc(nombreCategoria(u.categoriaId)):'—')+'</td>'+
      '<td data-label="Detalle">'+esc(u.detalle||'')+'</td>'+
      '<td class="actions-cell"><button class="icon-btn" data-action="edit-usdt" data-id="'+u.id+'" title="Editar" aria-label="Editar"><i class="bi bi-pencil"></i></button>'+
      '<button class="icon-btn icon-btn-danger" data-action="del-usdt" data-id="'+u.id+'" title="Borrar" aria-label="Borrar"><i class="bi bi-trash"></i></button></td>'+
    '</tr>';
  }).join('');

  return ''+
  '<div class="card">'+
    '<h2><i class="bi bi-coin"></i> Tenencia de USDT</h2>'+
    '<div style="font-size:12px;color:var(--ink-soft);margin-top:2px">Registrá acá tus ingresos en USDT y, cuando los vendas, cuánto recibiste en pesos. La venta resta de tu tenencia y crea sola el ingreso en pesos en Movimientos — no hace falta cargarlo dos veces.</div>'+
  '</div>'+
  '<div class="summary-cards">'+
    '<div class="summary-card"><div class="label">Tenencia actual</div><div class="value">'+fmtCantidadUsdt(saldo)+' USDT</div></div>'+
    '<div class="summary-card">'+
      '<div class="label">Valor en pesos (Binance P2P)</div>'+
      (STATE.usdtCotizacionCargando ? '<div class="value" style="font-size:14px;color:var(--ink-soft)">Consultando…</div>'
        : STATE.usdtCotizacionBid ? '<div class="value">$'+fmtMonto(saldo*STATE.usdtCotizacionBid)+'</div>'
        : '<div class="value" style="font-size:14px;color:var(--ink-soft)">Sin cotización</div>')+
      '<div style="font-size:11px;color:var(--ink-soft);margin-top:4px">'+
        (STATE.usdtCotizacionBid ? 'Cotización de venta: $'+fmtMonto(STATE.usdtCotizacionBid)+' · actualizada a las '+STATE.usdtCotizacionActualizada.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})+' — ' : '')+
        '<button class="link" data-action="actualizar-cotizacion-usdt" style="padding:0;font-size:11px">↻ Actualizar</button>'+
        (STATE.usdtCotizacionError ? '<div style="color:var(--danger);margin-top:2px">'+esc(STATE.usdtCotizacionError)+'</div>' : '')+
      '</div>'+
    '</div>'+
    (funcionActiva('facturacion_arca') && limiteCategoriaB()>0 ? '<div class="summary-card"><div class="label">Facturado a ARCA (últimos 12 meses)</div><div class="value">$'+fmtMonto(acumuladoFacturado12Meses(STATE.facturas.filter(function(f){return f.ambiente==='produccion';}), fechaHoyISO()))+' / $'+fmtMonto(limiteCategoriaB())+'</div></div>' : '')+
  '</div>'+
  formHtml+
  '<div class="card">'+
    '<h3>Movimientos ('+lista.length+')</h3>'+
    (lista.length ? '<table class="table tabla-movil"><thead><tr><th>Fecha</th><th>Tipo</th><th class="num">Cantidad</th><th class="num">Monto ARS</th><th class="num">Cotización</th><th>Centro</th><th>Categoría</th><th>Detalle</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>' : '<div class="empty">Todavía no cargaste ningún movimiento de USDT.</div>')+
  '</div>';
}

// ===================== EVENTOS =====================
function bindEvents(){
  document.querySelectorAll('[data-modal-backdrop]').forEach(function(overlay){
    overlay.addEventListener('click', function(ev){
      if(ev.target !== overlay) return; // sólo si el click fue directo en el fondo, no en el contenido del modal
      var tipo = overlay.getAttribute('data-modal-backdrop');
      var accion = tipo==='confirm' ? 'confirm-no' : (tipo==='subdelete' ? 'sub-delete-cancel' : (tipo==='efectivo' ? 'cerrar-efectivo' : (tipo==='usdt-venta-mov' ? 'cerrar-usdt-venta-mov' : (tipo==='pagar-venc' ? 'cancel-pagar-venc' : 'cancel-edit'))));
      handleAction(accion);
    });
  });

  // El evento "toggle" de <details> no burbujea: hay que escucharlo en cada uno para recordar
  // qué resúmenes de tarjeta quedaron abiertos y que no se cierren solos en el próximo render().
  document.querySelectorAll('details.resumen-tarjeta[data-grupo-key]').forEach(function(det){
    det.addEventListener('toggle', function(){
      STATE.gruposAbiertos[det.getAttribute('data-grupo-key')] = det.open;
    });
  });

  // En colores en masa el separador es el tab: la tecla Tab lo escribe en vez de pasar al botón.
  var bulkColores = document.getElementById('bulk-colores-categorias');
  if(bulkColores) bulkColores.addEventListener('keydown', function(ev){
    if(ev.key!=='Tab' || ev.shiftKey) return;
    ev.preventDefault();
    bulkColores.setRangeText('\t', bulkColores.selectionStart, bulkColores.selectionEnd, 'end');
  });

  document.querySelectorAll('.tab').forEach(function(t){
    t.addEventListener('click', function(){
      var tabId = t.getAttribute('data-tab');
      STATE.activeTab = tabId; STATE.editing = null; STATE.movDraft = null; STATE.vencDraft = null; STATE.usdtDraft = null; STATE.usdtFormMsg = null; STATE.usdtIngresoOpcionalesAbierto = false; STATE.dolaresDraft = null; STATE.dolaresFormMsg = null; STATE.nuevoMovAbierto = false; STATE.menuMovilAbierto = false; STATE.multiSelectAbierto = null; STATE.bulkEditMovAbierto = false; STATE.movSeleccionados = [];
      render();
      // Primera vez que se entra a USDT (o a Resumen/Saldos/Flujo, que valúan a la cotización de hoy el USDT de
      // sueldo todavía sin vender) en esta sesión: traer la cotización sola, sin que haya que tocar "Actualizar".
      if(funcionActiva('usdt') && (tabId==='usdt' || tabId==='resumen' || tabId==='saldos' || tabId==='flujo') && STATE.usdtCotizacionBid===null && !STATE.usdtCotizacionCargando) obtenerCotizacionUsdt();
      // Idem el dólar blue, que valúa la tenencia en USD (Dólares, Saldos y la foto de Resumen).
      if(funcionActiva('dolares') && (tabId==='dolares' || tabId==='resumen' || tabId==='saldos' || tabId==='flujo') && STATE.dolarBlueCompra===null && !STATE.dolarBlueCargando) obtenerDolarBlue();
    });
  });

  document.querySelectorAll('.subtab').forEach(function(t){
    t.addEventListener('click', function(){ STATE.abmSubTab = t.getAttribute('data-subtab'); STATE.editing = null; render(); });
  });

  // Restaurar select de categoría en edición de subcategoría
  if(STATE.activeTab==='abm' && STATE.abmSubTab==='subcategorias' && STATE.editing && STATE.editing.type==='subcategoria'){
    var s = STATE.subcategorias.find(function(x){return x.id===STATE.editing.id;});
    var sel = document.getElementById('f-sub-categoria');
    if(s && sel) sel.value = s.categoriaId;
  }

  // Filtros de movimientos (Centro/Categoría/Subcategoría/Mes son multiselect, ver checkboxes más abajo)
  var ffTexto = document.getElementById('ff-texto');
  if(ffTexto){ ffTexto.addEventListener('input', function(){ STATE.filtros.texto = ffTexto.value; STATE.movPaginaActual = 1; render(); }); }
  var ffSoloIncompletos = document.getElementById('ff-solo-incompletos');
  if(ffSoloIncompletos){
    ffSoloIncompletos.addEventListener('change', function(){
      STATE.filtros.soloIncompletos = ffSoloIncompletos.checked;
      STATE.movPaginaActual = 1;
      if(ffSoloIncompletos.checked){
        STATE.incompletosSnapshotIds = STATE.movimientos.filter(function(m){ return !esMovimientoPendiente(m) && camposFaltantes(m).length>0; }).map(function(m){ return m.id; });
      } else {
        STATE.incompletosSnapshotIds = null;
      }
      render();
    });
  }
  var movPorPaginaSel = document.getElementById('mov-por-pagina');
  if(movPorPaginaSel){ movPorPaginaSel.addEventListener('change', function(){
    STATE.movPorPagina = parseInt(movPorPaginaSel.value, 10) || MOV_PAGE_SIZE;
    guardarTamPagina('controlMovPorPagina', STATE.movPorPagina);
    STATE.movPaginaActual = 1; render();
  }); }
  var reglasPorPaginaSel = document.getElementById('reglas-por-pagina');
  if(reglasPorPaginaSel){ reglasPorPaginaSel.addEventListener('change', function(){
    STATE.reglasPorPagina = parseInt(reglasPorPaginaSel.value, 10) || REGLAS_PAGE_SIZE;
    guardarTamPagina('controlReglasPorPagina', STATE.reglasPorPagina);
    STATE.reglasPaginaActual = 1; render();
  }); }
  var ffSoloTarjeta = document.getElementById('ff-solo-tarjeta');
  if(ffSoloTarjeta){ ffSoloTarjeta.addEventListener('change', function(){ STATE.filtros.soloTarjeta = ffSoloTarjeta.checked; STATE.movPaginaActual = 1; render(); }); }

  // Filtros del Resumen (Centro/Categoría/Mes son multiselect, ver checkboxes más abajo)
  var rfVista = document.getElementById('rf-vista');
  if(rfVista){ rfVista.addEventListener('change', function(){ STATE.resumenFiltros.vista = rfVista.value; render(); }); }

  // Checkboxes de los filtros multiselect (Centro/Categoría/Subcategoría/Mes en Movimientos y Resumen)
  document.querySelectorAll('[data-multiselect]').forEach(function(cb){
    cb.addEventListener('change', function(){
      toggleMultiSelectValor(cb.getAttribute('data-multiselect'), cb.value, cb.checked);
      render();
    });
  });

  // Buscador dentro del panel del filtro multiselect abierto
  if(STATE.multiSelectAbierto){
    var msBuscar = document.getElementById('ms-buscar-'+STATE.multiSelectAbierto);
    if(msBuscar){
      msBuscar.addEventListener('input', function(){
        STATE.multiSelectBusqueda = msBuscar.value;
        render();
      });
    }
  }

  var rfGrillaRango = document.getElementById('rf-grilla-rango');
  if(rfGrillaRango){
    rfGrillaRango.addEventListener('change', function(){
      STATE.grillaRango = rfGrillaRango.value;
      render();
    });
  }

  // Configuración de la pestaña Flujo de Caja (ventana histórica del promedio / horizonte a proyectar)
  var fcVentana = document.getElementById('fc-ventana');
  if(fcVentana){ fcVentana.addEventListener('change', function(){ STATE.flujoVentana = fcVentana.value; render(); }); }
  var fcHorizonte = document.getElementById('fc-horizonte');
  if(fcHorizonte){ fcHorizonte.addEventListener('change', function(){ STATE.flujoHorizonte = parseInt(fcHorizonte.value,10)||12; render(); }); }

  // Combobox del formulario de Movimiento (Centro/Categoría/Subcategoría/Centro Destino):
  // tipear filtra la lista; Enter o Tab confirman la opción resaltada (la primera por defecto).
  document.querySelectorAll('.combo-input').forEach(function(inp){
    var comboId = inp.getAttribute('data-combo-id');
    inp.addEventListener('focus', function(){
      // Ignorar el focus "sintético" que dispara el propio render() al restaurar el foco después
      // de reemplazar el DOM (ver comentario en RENDER_EN_CURSO) — si no, pisa STATE.comboBusqueda
      // justo después de haberlo tipeado, aunque ya no cause una recursión infinita.
      if(RENDER_EN_CURSO) return;
      if(STATE.comboAbierto !== comboId){
        // getMovFormValues() ANTES de tocar nada: Fecha/Proveedor/Detalle/Monto no tienen listener
        // propio, así que sin este snapshot el render de abajo los dejaría en blanco (ver aplicarSeleccionCombo).
        STATE.movDraft = getMovFormValues();
        STATE.comboAbierto = comboId; STATE.comboBusqueda = ''; STATE.comboHighlight = 0;
        render();
      }
    });
    inp.addEventListener('input', function(){
      var draft = getMovFormValues();
      STATE.movDraft = draft;
      STATE.comboAbierto = comboId; STATE.comboBusqueda = inp.value; STATE.comboHighlight = 0;
      render();
    });
    inp.addEventListener('keydown', function(ev){
      if(STATE.comboAbierto !== comboId) return;
      if(ev.key==='ArrowDown'){ ev.preventDefault(); moverResaltadoCombo(comboId, 1); }
      else if(ev.key==='ArrowUp'){ ev.preventDefault(); moverResaltadoCombo(comboId, -1); }
      else if(ev.key==='Enter'){ ev.preventDefault(); finalizarCombo(comboId, true); }
      else if(ev.key==='Escape'){ STATE.movDraft = getMovFormValues(); STATE.comboAbierto = null; STATE.comboBusqueda = ''; render(); }
      else if(ev.key==='Tab'){
        // Tomamos el control manualmente: el re-render que dispara finalizarCombo reemplaza todo
        // el DOM, y si dejáramos que el navegador mueva el foco de forma nativa en el mismo tick,
        // el elemento al que iba a enfocar puede quedar reemplazado y el foco termina perdiéndose.
        // Por eso: prevenimos el Tab, resolvemos "cuál es el siguiente campo" ANTES de re-renderizar,
        // confirmamos la selección, y enfocamos ese id nosotros mismos ya con el DOM nuevo.
        ev.preventDefault();
        var siguienteId = idSiguienteFocuseable(inp);
        Promise.resolve(finalizarCombo(comboId, false)).then(function(){
          if(siguienteId){
            var el = document.getElementById(siguienteId);
            if(el) el.focus();
          }
        });
      }
    });
    inp.addEventListener('blur', function(){
      // Idem el focus de arriba: el propio reemplazo del DOM dispara un blur sintético sobre el
      // nodo que tenía el foco justo antes de removerlo — ignorarlo para no confirmar (o perder)
      // la selección por un efecto colateral del render, no por una acción real del usuario.
      if(RENDER_EN_CURSO) return;
      // Diferido al próximo tick: si el blur es porque el usuario clickeó otro botón (p. ej.
      // "Cancelar"), reemplazar el DOM ahora mismo (de forma síncrona, dentro del mismo mousedown)
      // haría que ese click se pierda porque el botón que iba a recibirlo ya no sería el mismo nodo.
      // Esperar un tick deja que el click termine de procesarse sobre el DOM actual antes de redibujar.
      setTimeout(function(){ finalizarCombo(comboId, false); }, 0);
    });
  });
  document.querySelectorAll('.combo-item').forEach(function(item){
    // preventDefault en mousedown evita que el input pierda el foco antes de que llegue el click
    item.addEventListener('mousedown', function(ev){ ev.preventDefault(); });
    item.addEventListener('click', function(){
      var comboId = item.closest('[data-combo-wrap]').getAttribute('data-combo-wrap');
      aplicarSeleccionCombo(comboId, item.getAttribute('data-value'));
      STATE.comboAbierto = null; STATE.comboBusqueda = ''; STATE.comboHighlight = 0;
      render();
    });
  });


  // Refrescar subcategorías disponibles al cambiar la categoría en el modal de Efectivo
  var efCategoriaSel = document.getElementById('ef-categoria');
  if(efCategoriaSel){
    efCategoriaSel.addEventListener('change', function(){
      // Snapshot ANTES de re-renderizar: ver el comentario en efectivoDraft dentro del render.
      var draft = getEfectivoFormValues();
      draft.subcategoriaId = ''; // cambió la categoría: la subcategoría anterior ya no aplica
      STATE.efectivoDraft = draft;
      STATE.efectivoCategoriaId = efCategoriaSel.value;
      render();
    });
  }

  // Formulario de Dólares: el Tipo muestra/oculta los campos de pesos, la Categoría refresca las
  // subcategorías, y el CC en dólares propone el mismo CC para los pesos si es "Pesos y dólares".
  // El CC de origen también refresca la lista de CC destino de una TEC.
  ['f-usd-tipo','f-usd-categoria','f-usd-centro'].forEach(function(idSel){
    var sel = document.getElementById(idSel);
    if(!sel) return;
    sel.addEventListener('change', function(){
      var draft = getDolaresFormValues();
      if(idSel==='f-usd-categoria') draft.subcategoriaId = '';
      if(idSel==='f-usd-centro'){
        var cUsd = STATE.centros.find(function(c){ return c.id===draft.centroId; });
        if(!draft.centroArsId && cUsd && monedaCentro(cUsd)==='AMBAS') draft.centroArsId = cUsd.id;
      }
      STATE.dolaresDraft = draft;
      render();
    });
  });

  // Formulario de USDT: mostrar/ocultar los campos de venta al cambiar el Tipo,
  // y refrescar las subcategorías disponibles al cambiar la Categoría.
  var usdtTipoSel = document.getElementById('f-usdt-tipo');
  if(usdtTipoSel){
    usdtTipoSel.addEventListener('change', function(){
      var draft = getUsdtFormValues();
      draft.tipo = usdtTipoSel.value;
      STATE.usdtDraft = draft;
      render();
    });
  }
  var usdtCategoriaSel = document.getElementById('f-usdt-categoria');
  if(usdtCategoriaSel){
    usdtCategoriaSel.addEventListener('change', function(){
      var draft = getUsdtFormValues();
      draft.categoriaId = usdtCategoriaSel.value;
      draft.subcategoriaId = '';
      STATE.usdtDraft = draft;
      render();
    });
  }

  // Formularios de vencimiento y de recurrente: refrescar las subcategorías al cambiar la Categoría,
  // conservando lo tipeado.
  document.querySelectorAll('select[data-venc-form]').forEach(function(sel){
    sel.addEventListener('change', function(){
      var prefijo = sel.getAttribute('data-venc-form');
      var valores = leerFormVenc(prefijo);
      valores.subcategoriaId = '';
      STATE.vencDraft = {form:prefijo, id:sel.getAttribute('data-id')||'', valores:valores};
      render();
    });
  });

  // Mostrar/ocultar los campos de cuotas al tildar "Pagado con tarjeta de crédito",
  // y refrescar la ayuda ("se van a crear N movimientos...") al cambiar la cantidad de cuotas.
  var movTarjetaChk = document.getElementById('f-mov-tarjeta');
  if(movTarjetaChk){
    movTarjetaChk.addEventListener('change', function(){
      var draft = getMovFormValues();
      draft.tarjeta = movTarjetaChk.checked;
      STATE.movDraft = draft;
      render();
    });
  }
  var movCuotasInput = document.getElementById('f-mov-cuotas');
  if(movCuotasInput){
    movCuotasInput.addEventListener('input', function(){
      var draft = getMovFormValues();
      draft.cuotas = movCuotasInput.value;
      STATE.movDraft = draft;
      render();
    });
  }
  var uvmCantidadInput = document.getElementById('uvm-cantidad');
  if(uvmCantidadInput){
    uvmCantidadInput.addEventListener('input', function(){
      STATE.usdtVentaMovCantidad = uvmCantidadInput.value;
      render();
    });
  }

  // Formulario de Importar
  var impEntidad = document.getElementById('imp-entidad');
  if(impEntidad){ impEntidad.addEventListener('change', function(){ STATE.importEntidad = impEntidad.value; STATE.importPreview = null; STATE.importPreviewExcel = null; STATE.importMsg = null; render(); }); }
  var impBanco = document.getElementById('imp-banco');
  if(impBanco){ impBanco.addEventListener('change', function(){ STATE.importBanco = impBanco.value; }); }
  var impVenc = document.getElementById('imp-vencimiento');
  if(impVenc){ impVenc.addEventListener('input', function(){ STATE.importVencimiento = impVenc.value; }); }
  var impTarjetaMarca = document.getElementById('imp-tarjeta-marca');
  if(impTarjetaMarca){ impTarjetaMarca.addEventListener('input', function(){ STATE.importTarjetaMarca = impTarjetaMarca.value; }); }
  var impRaw = document.getElementById('imp-raw');
  if(impRaw){ impRaw.addEventListener('input', function(){ STATE.importRaw = impRaw.value; }); }

  var previewTable = document.getElementById('import-preview-table');
  if(previewTable){
    previewTable.addEventListener('change', function(ev){
      var t = ev.target;
      var rowId = t.getAttribute('data-rowid');
      var field = t.getAttribute('data-field');
      if(!rowId || !field) return;
      var row = STATE.importPreview.find(function(r){return r.id===rowId;});
      if(!row) return;
      if(field==='incluir' || field==='guardarRegla') row[field] = t.checked;
      else if(field==='categoriaId'){ row.categoriaId = t.value; row.subcategoriaId=''; }
      else row[field] = t.value;
      render();
    });
    previewTable.addEventListener('input', function(ev){
      var t = ev.target;
      if(t.tagName !== 'INPUT' || t.type !== 'text') return;
      var rowId = t.getAttribute('data-rowid');
      var field = t.getAttribute('data-field');
      if(!rowId || !field) return;
      var row = STATE.importPreview.find(function(r){return r.id===rowId;});
      if(!row) return;
      row[field] = t.value;
      render();
    });
  }

  var tablaMovimientos = document.getElementById('tabla-movimientos');
  if(tablaMovimientos){
    tablaMovimientos.addEventListener('change', async function(ev){
      var t = ev.target;
      if(t.classList.contains('chk-select-mov')){
        var midSel = t.getAttribute('data-mov-id');
        var sel = STATE.movSeleccionados || (STATE.movSeleccionados = []);
        var iSel = sel.indexOf(midSel);
        if(t.checked && iSel===-1) sel.push(midSel);
        else if(!t.checked && iSel!==-1) sel.splice(iSel,1);
        render(); return;
      }
      if(t.id==='chk-select-all-mov'){
        var idsVisibles = Array.prototype.map.call(tablaMovimientos.querySelectorAll('.chk-select-mov'), function(c){ return c.getAttribute('data-mov-id'); });
        if(t.checked){
          idsVisibles.forEach(function(mid){ if(STATE.movSeleccionados.indexOf(mid)===-1) STATE.movSeleccionados.push(mid); });
        } else {
          STATE.movSeleccionados = STATE.movSeleccionados.filter(function(mid){ return idsVisibles.indexOf(mid)===-1; });
        }
        render(); return;
      }
      var movId = t.getAttribute('data-mov-id');
      var campo = t.getAttribute('data-field');
      if(!movId || !campo) return;
      var mov = STATE.movimientos.find(function(m){ return m.id===movId; });
      if(!mov) return;
      var valor = t.value;
      var camposDb = {};
      if(campo==='categoriaId'){
        mov.categoriaId = valor; mov.subcategoriaId = '';
        camposDb = { categoria_id: valor||null, subcategoria_id: null };
      } else if(campo==='centroId'){
        mov.centroId = valor;
        camposDb = { centro_id: valor||null };
        STATE.saldosDirty = true; // el movimiento pasa a sumar en el saldo de otro Centro de Costo
      } else if(campo==='subcategoriaId'){
        mov.subcategoriaId = valor;
        camposDb = { subcategoria_id: valor||null };
      } else if(campo==='proveedor' || campo==='detalle'){
        mov[campo] = valor;
        camposDb[campo] = valor||null;
      } else { return; }
      try{
        await dbUpdate('movimientos', movId, camposDb);
      }catch(e){ STATE.dbError = 'No se pudo guardar el cambio: '+(e.message||e); }
      render();
    });

    // Clic sobre Fecha/Centro/Categoría/Subcategoría/Proveedor -> filtra la tabla por ese valor
    tablaMovimientos.addEventListener('click', function(ev){
      var celda = ev.target.closest('[data-filter-field]');
      if(!celda) return;
      var campoFiltro = celda.getAttribute('data-filter-field');
      var valorFiltro = celda.getAttribute('data-filter-value');
      if(!valorFiltro) return;
      if(campoFiltro === 'texto') STATE.filtros.texto = valorFiltro;
      else STATE.filtros[campoFiltro] = [valorFiltro];
      STATE.movPaginaActual = 1;
      render();
    });
  }

  var previewExcelTable = document.getElementById('import-preview-excel-table');
  if(previewExcelTable){
    previewExcelTable.addEventListener('change', function(ev){
      var t = ev.target;
      var rowId = t.getAttribute('data-rowid');
      var field = t.getAttribute('data-field');
      if(!rowId || !field) return;
      var row = STATE.importPreviewExcel.find(function(r){return r.id===rowId;});
      if(!row) return;
      if(field==='incluir') row.incluir = t.checked;
      render();
    });
  }

  document.querySelectorAll('[data-selector-familia]').forEach(function(sel){
    sel.addEventListener('change', function(){ elegirFamilia(sel.value); });
  });
  var backupFamiliaSel = document.getElementById('backup-familia');
  if(backupFamiliaSel){ backupFamiliaSel.addEventListener('change', function(){ STATE.backupFamiliaRestaurar = backupFamiliaSel.value; }); }

  if(STATE.soloLectura) aplicarSoloLectura();

  document.querySelectorAll('[data-action]').forEach(function(btn){
    btn.addEventListener('click', function(){ handleAction(btn.getAttribute('data-action'), btn.getAttribute('data-id')); });
  });
}

// Modo solo lectura (superadmin): después de cada render saca lo que escribe en la base, así no hace falta
// tocar cada pantalla. Los botones de acciones que no están en ACCIONES_LECTURA desaparecen; las tarjetas de
// alta (las que tenían un botón de guardar/agregar) se ocultan enteras para no dejar un formulario sin botón;
// y los campos que editan directo en la tabla de Movimientos quedan deshabilitados.
function aplicarSoloLectura(){
  var app = document.getElementById('app');
  app.querySelectorAll('[data-action]').forEach(function(el){
    var accion = el.getAttribute('data-action');
    if(ACCIONES_LECTURA.indexOf(accion)!==-1) return;
    var esAlta = /^(save-|guardar-|agregar-|preview-import)/.test(accion);
    var card = esAlta && el.closest('.card');
    if(card) card.style.display = 'none';
    el.remove();
  });
  app.querySelectorAll('#tabla-movimientos [data-field], #tabla-movimientos .chk-select-mov, #chk-select-all-mov').forEach(function(el){
    el.disabled = true;
  });
}

function getEfectivoFormValues(){
  return {
    fecha: (document.getElementById('ef-fecha')||{}).value || '',
    centroId: (document.getElementById('ef-centro')||{}).value || '',
    tipo: (document.getElementById('ef-tipo')||{}).value || 'egreso',
    monto: (document.getElementById('ef-monto')||{}).value || '',
    proveedor: (document.getElementById('ef-proveedor')||{}).value || '',
    detalle: (document.getElementById('ef-detalle')||{}).value || '',
    subcategoriaId: (document.getElementById('ef-subcategoria')||{}).value || ''
  };
}

function getMovFormValues(){
  var v = {
    fecha: (document.getElementById('f-mov-fecha')||{}).value || '',
    centroId: (document.getElementById('f-mov-centro')||{}).value || '',
    categoriaId: (document.getElementById('f-mov-categoria')||{}).value || '',
    subcategoriaId: (document.getElementById('f-mov-subcategoria')||{}).value || '',
    proveedor: (document.getElementById('f-mov-proveedor')||{}).value || '',
    detalle: (document.getElementById('f-mov-detalle')||{}).value || '',
    tipo: (document.getElementById('f-mov-tipo')||{}).value || 'egreso',
    monto: (document.getElementById('f-mov-monto')||{}).value || '',
    tarjeta: (document.getElementById('f-mov-tarjeta')||{}).checked || false,
    fechaConsumo: (document.getElementById('f-mov-fecha-consumo')||{}).value || '',
    tarjetaMarca: (document.getElementById('f-mov-tarjeta-marca')||{}).value || '',
    cuotas: (document.getElementById('f-mov-cuotas')||{}).value || 1,
    cuotasInfo: (document.getElementById('f-mov-cuotas-info')||{}).value || ''
  };
  // Con Tarjetas apagada el formulario no muestra esos campos: al editar se conservan los que ya tenía
  // el movimiento (si no, guardarlo lo desmarcaría como de tarjeta).
  if(!funcionActiva('tarjetas')){
    var original = STATE.editing && STATE.editing.type==='mov' ? STATE.movimientos.find(function(m){ return m.id===STATE.editing.id; }) : null;
    v.tarjeta = !!(original && original.tarjeta);
    v.fechaConsumo = original ? (original.fechaConsumo||'') : '';
    v.tarjetaMarca = original ? (original.tarjetaMarca||'') : '';
    v.cuotas = 1;
    v.cuotasInfo = original ? (original.cuotas||'') : '';
  }
  return v;
}

// Acciones que no escriben en la base: las únicas que tiene el superadmin (solo lectura, S1). Cualquier
// otra se ignora y su botón no se muestra (ver aplicarSoloLectura). Una acción nueva que solo mire
// datos tiene que sumarse acá para que el superadmin la vea.
var ACCIONES_LECTURA = ['mov-pagina-anterior', 'mov-pagina-siguiente', 'ir-a-vencimientos', 'ir-a-movimientos-centro',
  'ir-a-reglas', 'reglas-pagina-anterior', 'reglas-pagina-siguiente', 'cancel-edit', 'confirm-yes', 'confirm-no',
  'limpiar-filtros-mov', 'toggle-filtros-mov', 'toggle-grupo-tarjeta-mov', 'toggle-multiselect', 'multiselect-limpiar',
  'refrescar-incompletos', 'recalcular-saldos', 'exportar-movimientos-excel', 'ver-comprobante',
  'actualizar-cotizacion-usdt', 'actualizar-dolar-blue', 'toggle-usdt-opcionales',
  'toggle-menu-movil', 'cerrar-menu-movil', 'toggle-menu-usuario', 'set-tema-color', 'toggle-tema', 'cerrar-sesion',
  // Administración (solo superadmin)
  'descargar-backup', 'restaurar-backup-preview', 'cancelar-restaurar', 'restaurar-familia', 'restaurar-familia-confirmado',
  'config-guardar', 'config-default', 'importador-alternar'];
var ACCIONES_SUPERADMIN = ['descargar-backup', 'restaurar-backup-preview', 'cancelar-restaurar', 'restaurar-familia', 'restaurar-familia-confirmado',
  'config-guardar', 'config-default', 'importador-alternar'];

async function handleAction(action, id){
  if(STATE.soloLectura && ACCIONES_LECTURA.indexOf(action)===-1) return;
  if(!STATE.esSuperadmin && ACCIONES_SUPERADMIN.indexOf(action)!==-1) return;
  STATE.movDraft = null;
  STATE.usdtDraft = null;
  STATE.vencDraft = null;

  if(action==='mov-pagina-anterior'){ STATE.movPaginaActual = Math.max(1, STATE.movPaginaActual-1); render(); return; }
  if(action==='mov-pagina-siguiente'){ STATE.movPaginaActual = STATE.movPaginaActual+1; render(); return; }
  if(action==='ir-a-vencimientos'){ STATE.activeTab = 'vencimientos'; render(); return; }
  if(action==='ir-a-movimientos-centro'){
    STATE.filtros.centro = id ? [id] : [];
    STATE.movPaginaActual = 1;
    STATE.activeTab = 'movimientos';
    render();
    return;
  }
  if(action==='ir-a-reglas'){
    STATE.activeTab = 'abm';
    STATE.abmSubTab = 'reglas';
    render();
    return;
  }
  if(action==='reglas-pagina-anterior'){ STATE.reglasPaginaActual = Math.max(1, STATE.reglasPaginaActual-1); render(); return; }
  if(action==='reglas-pagina-siguiente'){ STATE.reglasPaginaActual = STATE.reglasPaginaActual+1; render(); return; }
  if(action==='cancel-edit'){
    STATE.editing = null; STATE.nuevoMovAbierto = false; STATE.movDraftCentroDestinoId = '';
    STATE.comboAbierto = null; STATE.comboBusqueda = '';
    STATE.bulkEditMovAbierto = false; STATE.bulkEditMovMsg = null;
    STATE.usdtFormMsg = null; STATE.movFieldErrors = null;
    STATE.dolaresDraft = null; STATE.dolaresFormMsg = null;
    STATE.vencFormMsg = null; STATE.vrecFormMsg = null;
    STATE.bulkColorCatAbierto = false; STATE.bulkColorCatMsg = null;
    render(); return;
  }
  if(action==='abrir-bulk-colores-categorias'){
    STATE.editing = null; STATE.bulkColorCatAbierto = true; STATE.bulkColorCatMsg = null;
    render(); return;
  }
  if(action==='abrir-nuevo-mov'){
    STATE.nuevoMovAbierto = true; STATE.movFormMsg = null; STATE.movFieldErrors = null; STATE.movDraftCentroDestinoId = '';
    STATE.comboAbierto = null; STATE.comboBusqueda = ''; STATE.menuMovilAbierto = false;
    STATE.bulkEditMovAbierto = false;
    render(); return;
  }
  if(action==='deseleccionar-mov'){ STATE.movSeleccionados = []; render(); return; }
  if(action==='abrir-bulk-edit-mov'){
    if(!STATE.movSeleccionados || !STATE.movSeleccionados.length) return;
    STATE.editing = null; STATE.nuevoMovAbierto = false;
    STATE.bulkEditMovAbierto = true; STATE.bulkEditMovMsg = null;
    render(); return;
  }
  if(action==='guardar-bulk-edit-mov'){
    var idsSel = (STATE.movSeleccionados||[]).slice();
    if(!idsSel.length){ STATE.bulkEditMovAbierto = false; render(); return; }
    var valBem = function(elId){ return (document.getElementById(elId)||{}).value || ''; };
    var fechaV = valBem('bem-fecha');
    var centroV = valBem('bem-centro');
    var categoriaV = valBem('bem-categoria');
    var subcategoriaV = valBem('bem-subcategoria');
    var proveedorV = valBem('bem-proveedor');
    var proveedorVaciar = !!(document.getElementById('bem-proveedor-vaciar')||{}).checked;
    var detalleV = valBem('bem-detalle');
    var detalleVaciar = !!(document.getElementById('bem-detalle-vaciar')||{}).checked;
    var tipoV = valBem('bem-tipo');
    var montoV = valBem('bem-monto');
    var tarjetaV = valBem('bem-tarjeta');

    var tocaFecha = !!fechaV;
    var tocaCentro = !!centroV;
    var tocaCategoria = !!categoriaV;
    var tocaSubcategoria = !!subcategoriaV;
    var tocaProveedor = proveedorVaciar || !!proveedorV;
    var tocaDetalle = detalleVaciar || !!detalleV;
    var tocaTipo = !!tipoV;
    var tocaMonto = montoV !== '';
    var tocaTarjeta = !!tarjetaV;

    if(!tocaFecha && !tocaCentro && !tocaCategoria && !tocaSubcategoria && !tocaProveedor && !tocaDetalle && !tocaTipo && !tocaMonto && !tocaTarjeta){
      STATE.bulkEditMovMsg = { type:'err', text:'Elegí al menos un campo para modificar.' };
      render(); return;
    }

    var montoNum = tocaMonto ? (Math.abs(parseFloat(montoV))||0) : 0;
    try{
      for(var bi=0; bi<idsSel.length; bi++){
        var mov = STATE.movimientos.find(function(m){ return m.id===idsSel[bi]; });
        if(!mov) continue;
        var camposDb = {};
        if(tocaFecha){ mov.fecha = fechaV; camposDb.fecha = fechaV; }
        if(tocaCentro){ mov.centroId = centroV==='__vaciar__' ? '' : centroV; camposDb.centro_id = mov.centroId||null; }
        if(tocaCategoria){
          mov.categoriaId = categoriaV==='__vaciar__' ? '' : categoriaV;
          camposDb.categoria_id = mov.categoriaId||null;
          if(!tocaSubcategoria){ mov.subcategoriaId = ''; camposDb.subcategoria_id = null; }
        }
        if(tocaSubcategoria){ mov.subcategoriaId = subcategoriaV==='__vaciar__' ? '' : subcategoriaV; camposDb.subcategoria_id = mov.subcategoriaId||null; }
        if(tocaProveedor){ mov.proveedor = proveedorVaciar ? '' : proveedorV; camposDb.proveedor = mov.proveedor||null; }
        if(tocaDetalle){ mov.detalle = detalleVaciar ? '' : detalleV; camposDb.detalle = mov.detalle||null; }
        if(tocaTipo || tocaMonto){
          var tipoActual = Number(mov.ingreso)>0 ? 'ingreso' : 'egreso';
          var tipoFinal = tocaTipo ? tipoV : tipoActual;
          var montoActual = tipoActual==='ingreso' ? Number(mov.ingreso)||0 : Number(mov.egreso)||0;
          var montoFinal = tocaMonto ? montoNum : montoActual;
          mov.ingreso = tipoFinal==='ingreso' ? montoFinal : 0;
          mov.egreso = tipoFinal==='egreso' ? montoFinal : 0;
          camposDb.ingreso = mov.ingreso; camposDb.egreso = mov.egreso;
        }
        if(tocaTarjeta){ mov.tarjeta = tarjetaV==='si'; camposDb.tarjeta = mov.tarjeta; }
        await dbUpdate('movimientos', mov.id, camposDb);
      }
      STATE.saldosDirty = true;
      STATE.bulkEditMovAbierto = false;
      STATE.bulkEditMovMsg = null;
      STATE.movSeleccionados = [];
    }catch(e){ STATE.dbError = 'No se pudo aplicar la edición masiva: '+(e.message||e); }
    render(); return;
  }

  if(action==='confirm-yes'){
    var pending = STATE.confirmState; STATE.confirmState = null;
    if(pending) await handleAction(pending.action, pending.id);
    return;
  }
  if(action==='confirm-no'){ STATE.confirmState = null; render(); return; }

  // ---- CENTROS ----
  if(action==='edit-centro'){ STATE.editing = {type:'centro', id:id}; render(); return; }
  if(action==='del-centro'){
    STATE.confirmState = { message:'¿Borrar este centro de costo?', action:'del-centro-do', id:id };
    render(); return;
  }
  if(action==='del-centro-do'){
    try{
      await dbDelete('centros', id);
      STATE.centros = STATE.centros.filter(function(c){return c.id!==id;});
      STATE.saldosDirty = true;
    }catch(e){ STATE.dbError = 'No se pudo borrar el centro de costo: '+(e.message||e); }
    render(); return;
  }
  if(action==='save-centro'){
    var codigo = document.getElementById('f-centro-codigo').value.trim().toUpperCase();
    var nombre = document.getElementById('f-centro-nombre').value.trim();
    var colorCentroInput = document.getElementById('f-centro-color').value;
    var entidadCentroInput = document.getElementById('f-centro-entidad').value;
    var monedaCentroInput = (document.getElementById('f-centro-moneda')||{}).value || 'ARS';
    var titularCentroInput = (document.getElementById('f-centro-titular')||{}).value || '';
    if(!codigo || !nombre) return;
    STATE.dbError = null;
    try{
      if(id){
        var c = STATE.centros.find(function(x){return x.id===id;});
        var camposCentro = {codigo:codigo, nombre:nombre, color:colorCentroInput, entidad:entidadCentroInput||null, titular_id:titularCentroInput||null};
        // Como en toDbCentro: la moneda solo viaja si es (o era) distinta de pesos.
        if(monedaCentroInput!=='ARS' || monedaCentro(c)!=='ARS') camposCentro.moneda = monedaCentroInput;
        await dbUpdate('centros', id, camposCentro);
        c.codigo = codigo; c.nombre = nombre; c.color = colorCentroInput; c.entidad = entidadCentroInput; c.moneda = monedaCentroInput; c.titularId = titularCentroInput;
      } else {
        var nuevoC = {id:uid(), codigo:codigo, nombre:nombre, color:colorCentroInput, entidad:entidadCentroInput, moneda:monedaCentroInput, titularId:titularCentroInput};
        await dbInsert('centros', toDbCentro(nuevoC));
        STATE.centros.push(nuevoC);
      }
      STATE.saldosDirty = true;
      STATE.editing = null;
    }catch(e){ STATE.dbError = 'No se pudo guardar el centro de costo: '+(e.message||e); }
    render(); return;
  }

  // ---- CATEGORÍAS ----
  if(action==='edit-categoria'){ STATE.editing = {type:'categoria', id:id}; render(); return; }
  if(action==='del-categoria'){
    STATE.confirmState = { message:'¿Borrar esta categoría? También se borrarán sus subcategorías.', action:'del-categoria-do', id:id };
    render(); return;
  }
  if(action==='del-categoria-do'){
    try{
      await dbDelete('categorias', id); // ON DELETE CASCADE en la base borra las subcategorías asociadas
      STATE.categorias = STATE.categorias.filter(function(c){return c.id!==id;});
      STATE.subcategorias = STATE.subcategorias.filter(function(s){return s.categoriaId!==id;});
    }catch(e){ STATE.dbError = 'No se pudo borrar la categoría: '+(e.message||e); }
    render(); return;
  }
  if(action==='save-categoria'){
    var nombre = document.getElementById('f-categoria-nombre').value.trim();
    var tipo = document.getElementById('f-categoria-tipo').value || '';
    var colorCategoriaInput = document.getElementById('f-categoria-color').value;
    if(!nombre) return;
    STATE.dbError = null;
    var otraVentaUsdt = tipo==='venta_usdt' && STATE.categorias.find(function(x){ return x.tipo==='venta_usdt' && x.id!==id; });
    if(otraVentaUsdt){
      STATE.dbError = 'Ya hay una categoría de tipo Venta de USDT ("'+otraVentaUsdt.nombre+'"): puede haber una sola.';
      render(); return;
    }
    try{
      if(id){
        await dbUpdate('categorias', id, {nombre:nombre, tipo:tipo||null, color:colorCategoriaInput});
        var c = STATE.categorias.find(function(x){return x.id===id;});
        c.nombre = nombre; c.tipo = tipo; c.color = colorCategoriaInput;
      } else {
        var nuevaC = {id:uid(), nombre:nombre, tipo:tipo, color:colorCategoriaInput};
        await dbInsert('categorias', toDbCategoria(nuevaC));
        STATE.categorias.push(nuevaC);
      }
      STATE.editing = null;
    }catch(e){ STATE.dbError = 'No se pudo guardar la categoría: '+(e.message||e); }
    render(); return;
  }
  if(action==='bulk-actualizar-colores-categorias'){
    var rawColores = document.getElementById('bulk-colores-categorias').value;
    var lineasColor = rawColores.split('\n').map(function(l){ return l.replace(/\r$/,''); }).filter(function(l){ return l.trim().length>0; });
    var actualizadasColor = 0, noEncontradas = [], invalidas = [];
    var paraUpsertColor = [];
    var reHex = /^#?[0-9a-fA-F]{6}$/;
    lineasColor.forEach(function(linea){
      var partes = linea.split('\t').map(function(p){ return p.trim(); });
      if(partes.length < 2) return;
      var nombreLinea = partes[0];
      var hexLinea = partes[partes.length-1]; // soporta pegar "Nombre / Color sugerido / Hex" tal cual: usa la última columna
      if(/^categor[ií]a$/i.test(nombreLinea)) return; // fila de encabezado
      if(!nombreLinea || !reHex.test(hexLinea)){ if(nombreLinea) invalidas.push(nombreLinea); return; }
      var hexNormalizado = '#'+hexLinea.replace('#','').toUpperCase();
      var existente = STATE.categorias.find(function(c){ return c.nombre.toLowerCase() === nombreLinea.toLowerCase(); });
      if(!existente){ noEncontradas.push(nombreLinea); return; }
      existente.color = hexNormalizado;
      paraUpsertColor.push(toDbCategoria(existente));
      actualizadasColor++;
    });
    try{
      if(paraUpsertColor.length) await dbUpsert('categorias', paraUpsertColor);
      var detalle = [];
      if(noEncontradas.length) detalle.push(noEncontradas.length+' sin coincidencia: '+noEncontradas.join(', '));
      if(invalidas.length) detalle.push(invalidas.length+' con color inválido: '+invalidas.join(', '));
      STATE.bulkColorCatMsg = { type: actualizadasColor>0 ? 'ok' : 'err',
        text: actualizadasColor+' categoría(s) actualizada(s).'+(detalle.length?' '+detalle.join('. ')+'.':'') };
    }catch(e){ STATE.dbError = 'No se pudo actualizar los colores: '+(e.message||e); }
    render(); return;
  }

  // ---- EXPORTAR MOVIMIENTOS A EXCEL ----
  if(action==='exportar-movimientos-excel'){
    try{
      var f = STATE.filtros || {centro:[], categoria:[], mes:[], texto:'', subcategoria:[], soloIncompletos:false, soloTarjeta:false};
      var listaExport = movimientosFiltrados(f);

      var workbook = new ExcelJS.Workbook();
      var sheet = workbook.addWorksheet('Movimientos');
      sheet.views = [{ state:'frozen', ySplit:1 }];
      sheet.columns = [
        { header:'Fecha', key:'fecha', width:12 },
        { header:'Centro de Costo', key:'centro', width:22 },
        { header:'Categoría', key:'categoria', width:20 },
        { header:'Subcategoría', key:'subcategoria', width:20 },
        { header:'Contraparte', key:'proveedor', width:24 },
        { header:'Detalle', key:'detalle', width:30 },
        { header:'Ingreso', key:'ingreso', width:14 },
        { header:'Egreso', key:'egreso', width:14 },
        { header:'Tarjeta', key:'tarjeta', width:10 },
        { header:'Marca tarjeta', key:'marca', width:14 },
        { header:'Cuotas', key:'cuotas', width:10 }
      ];
      sheet.getRow(1).font = { bold:true };

      var COLOR_TARJETA = 'FFFCE8B2'; // amarillo suave: marca los movimientos con tarjeta, agrupados por fecha+centro+marca en la tabla de la app
      listaExport.forEach(function(m){
        var fila = sheet.addRow({
          fecha: fechaISOaDDMMAAAA(m.fecha) || m.fecha || '',
          centro: nombreCentro(m.centroId),
          categoria: nombreCategoria(m.categoriaId),
          subcategoria: m.subcategoriaId ? nombreSubcategoria(m.subcategoriaId) : '',
          proveedor: m.proveedor || '',
          detalle: m.detalle || '',
          ingreso: Number(m.ingreso) || null,
          egreso: Number(m.egreso) || null,
          tarjeta: m.tarjeta ? 'Sí' : 'No',
          marca: m.tarjetaMarca || '',
          cuotas: m.cuotas || ''
        });
        fila.getCell('ingreso').numFmt = '#,##0.00';
        fila.getCell('egreso').numFmt = '#,##0.00';
        if(m.tarjeta){
          fila.eachCell(function(celda){ celda.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLOR_TARJETA} }; });
        }
      });

      var totalIngresoExport = listaExport.reduce(function(s,m){ return cuentaEnTotalesMovimientos(m, f.categoria) ? s + (Number(m.ingreso)||0) : s; },0);
      var totalEgresoExport = listaExport.reduce(function(s,m){ return cuentaEnTotalesMovimientos(m, f.categoria) ? s + (Number(m.egreso)||0) : s; },0);
      var hayControlExcluido = listaExport.some(function(m){ return esTipoCategoria(m.categoriaId,'control') && !cuentaEnTotalesMovimientos(m, f.categoria); });
      var filaTotales = sheet.addRow({ detalle:'Totales (sin TEC'+(hayControlExcluido?' ni Solo control':'')+')', ingreso:totalIngresoExport, egreso:totalEgresoExport });
      filaTotales.font = { bold:true };
      filaTotales.getCell('ingreso').numFmt = '#,##0.00';
      filaTotales.getCell('egreso').numFmt = '#,##0.00';

      var buffer = await workbook.xlsx.writeBuffer();
      var blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'movimientos-'+fechaHoyISO()+'.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    }catch(e){ STATE.dbError = 'No se pudo generar el Excel: '+(e.message||e); render(); }
    return;
  }

  // ---- BACKUP ----
  if(action==='descargar-backup'){
    try{
      var backupObj = await armarBackup();
    }catch(e){ STATE.backupMsg = {type:'err', text:'No se pudo generar el backup: '+(e.message||e)}; render(); return; }
    var blob = new Blob([JSON.stringify(backupObj, null, 2)], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var fecha = fechaHoyISO();
    a.href = url;
    a.download = 'backup-control-economico-'+fecha+'.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    STATE.backupMsg = { type:'ok', text:'Backup descargado.' };
    render(); return;
  }
  if(action==='restaurar-backup-preview'){
    var archivo = document.getElementById('backup-file').files[0];
    STATE.backupArchivo = null;
    if(!archivo){ STATE.backupMsg = {type:'err', text:'Elegí primero un archivo .json.'}; render(); return; }
    try{
      var datos = JSON.parse(await archivo.text());
      if(!datos || typeof datos !== 'object'){ throw new Error('El archivo no tiene el formato esperado.'); }
      if(!(Number(datos.version) >= 3)) throw new Error('Es un backup del proyecto original (una sola familia): solo se pueden restaurar backups multi-familia (versión 3).');
      var enArchivo = familiasEnBackup(datos);
      if(!enArchivo.length) throw new Error('El archivo no tiene datos de ninguna familia.');
      STATE.backupArchivo = datos;
      var actual = enArchivo.find(function(f){ return f.id===STATE.familiaSeleccionadaId; });
      STATE.backupFamiliaRestaurar = (actual || enArchivo[0]).id;
      STATE.backupMsg = { type:'ok', text:'Backup del '+(datos.exportadoEn ? new Date(datos.exportadoEn).toLocaleString('es-AR') : '(fecha desconocida)')+' con '+enArchivo.length+' familia(s). Elegí cuál restaurar.' };
    }catch(e){ STATE.backupMsg = {type:'err', text:'No se pudo leer el archivo: '+(e.message||e)}; }
    render(); return;
  }
  if(action==='cancelar-restaurar'){ STATE.backupArchivo = null; STATE.backupMsg = null; render(); return; }

  // ---- IMPORTADORES DE LA FAMILIA (superadmin) ----
  // Como la configuración, no pasa por dbInsert/dbDelete: el superadmin está en solo lectura para los datos, no para esto.
  if(action==='importador-alternar'){
    var familiaImp = STATE.familiaSeleccionadaId;
    if(!familiaImp || !STATE.importadores.some(function(i){ return i.codigo===id; })){ render(); return; }
    var estabaOculto = STATE.importadoresOcultos.indexOf(id)!==-1;
    try{
      var resImp = estabaOculto
        ? await sb.from('familia_importadores_ocultos').delete().eq('familia_id', familiaImp).eq('importador_codigo', id)
        : await sb.from('familia_importadores_ocultos').insert({ familia_id: familiaImp, importador_codigo: id });
      if(resImp && resImp.error) throw resImp.error;
      STATE.importadoresOcultos = estabaOculto
        ? STATE.importadoresOcultos.filter(function(c){ return c!==id; })
        : STATE.importadoresOcultos.concat([id]);
      STATE.importadoresMsg = null;
    }catch(e){ STATE.importadoresMsg = { type:'err', text:'No se pudo guardar: '+(e.message||e) }; }
    render(); return;
  }

  // ---- CONFIGURACIÓN DE LA FAMILIA (superadmin) ----
  if(action==='config-guardar' || action==='config-default'){
    var itemCfg = STATE.configCatalogo.find(function(c){ return c.clave===id; });
    if(!itemCfg || !STATE.familiaSeleccionadaId){ render(); return; }
    var valorCfg = action==='config-default' ? '' : String((document.getElementById('cfg-'+id)||{}).value||'').trim();
    if(valorCfg!=='' && !valorConfigValido(itemCfg.tipo, valorCfg)){
      STATE.configMsg = { type:'err', text:'"'+valorCfg+'" no es un valor válido para '+id+(itemCfg.tipo==='numero' ? ' (tiene que ser un número, con punto decimal y sin separador de miles).' : '.') };
      render(); return;
    }
    try{
      await guardarConfigFamilia(STATE.familiaSeleccionadaId, id, valorCfg);
      if(id.indexOf('feature.')===0){ await cargarTodo(); STATE.saldosDirty = true; }
      STATE.configMsg = { type:'ok', text: valorCfg==='' ? id+': vuelve a usar el default.' : id+' guardado.' };
    }catch(e){ STATE.configMsg = { type:'err', text:'No se pudo guardar '+id+': '+(e.message||e) }; }
    render(); return;
  }
  if(action==='restaurar-familia'){
    if(!STATE.backupArchivo){ render(); return; }
    STATE.backupFamiliaRestaurar = (document.getElementById('backup-familia')||{}).value || STATE.backupFamiliaRestaurar;
    var famR = familiasEnBackup(STATE.backupArchivo).find(function(f){ return f.id===STATE.backupFamiliaRestaurar; });
    if(!famR){ render(); return; }
    STATE.confirmState = {
      message: '¿Restaurar la familia "'+(famR.nombre||famR.id)+'" desde este backup ('+famR.filas+' fila(s))? Se agregan o actualizan sus datos; no se borra nada y las demás familias no se tocan.',
      action: 'restaurar-familia-confirmado',
      textoConfirmar: 'Sí, restaurar'
    };
    render(); return;
  }
  if(action==='restaurar-familia-confirmado'){
    var datosR = STATE.backupArchivo;
    var familiaR = STATE.backupFamiliaRestaurar;
    if(!datosR || !familiaR){ render(); return; }
    try{
      var resultado = await restaurarFamilia(datosR, familiaR);
      // La familia pudo haberse vuelto a crear: recargar la lista y mostrar la restaurada.
      await cargarPerfil();
      if(STATE.familias.some(function(f){ return f.id===familiaR; })) STATE.familiaSeleccionadaId = familiaR;
      await cargarTodo();
      STATE.saldosDirty = true;
      var total = Object.keys(resultado||{}).reduce(function(s, t){ return s + (Number(resultado[t])||0); }, 0);
      STATE.backupArchivo = null;
      STATE.backupMsg = { type:'ok', text:'Familia restaurada: '+total+' fila(s) agregadas o actualizadas.' };
    }catch(e){ STATE.backupMsg = { type:'err', text:'No se restauró nada: '+(e.message||e) }; }
    render(); return;
  }

  if(action==='refrescar-incompletos'){
    STATE.incompletosSnapshotIds = STATE.movimientos.filter(function(m){ return !esMovimientoPendiente(m) && camposFaltantes(m).length>0; }).map(function(m){ return m.id; });
    render(); return;
  }
  if(action==='limpiar-filtros-mov'){
    STATE.filtros = {centro:[], categoria:[], subcategoria:[], mes:[], texto:'', soloIncompletos:false, soloTarjeta:false};
    STATE.incompletosSnapshotIds = null;
    STATE.movPaginaActual = 1;
    render(); return;
  }
  if(action==='toggle-filtros-mov'){ STATE.filtrosMovAbiertos = !STATE.filtrosMovAbiertos; render(); return; }

  // ---- MENÚ MÓVIL ----
  if(action==='toggle-menu-movil'){ STATE.menuMovilAbierto = !STATE.menuMovilAbierto; render(); return; }
  if(action==='cerrar-menu-movil'){ STATE.menuMovilAbierto = false; render(); return; }

  // ---- TEMA (claro/oscuro) ----
  if(action==='toggle-tema'){
    STATE.tema = STATE.tema==='oscuro' ? 'claro' : 'oscuro';
    if(STATE.tema==='oscuro') document.documentElement.setAttribute('data-theme', 'oscuro');
    else document.documentElement.removeAttribute('data-theme');
    try{ localStorage.setItem('controlTema', STATE.tema); }catch(e){}
    STATE.menuUsuarioAbierto = false;
    render(); return;
  }
  if(action==='set-tema-color'){
    var colorElegido = id;
    STATE.temaColor = colorElegido;
    if(colorElegido==='verde') document.documentElement.removeAttribute('data-color');
    else document.documentElement.setAttribute('data-color', colorElegido);
    try{ localStorage.setItem('controlTemaColor', colorElegido); }catch(e){}
    render(); return;
  }

  // ---- MENÚ DE USUARIO (avatar) ----
  if(action==='toggle-menu-usuario'){ STATE.menuUsuarioAbierto = !STATE.menuUsuarioAbierto; render(); return; }
  if(action==='cerrar-sesion'){ await cerrarSesion(); return; }

  // ---- FILTROS MULTISELECT ----
  if(action==='toggle-multiselect'){
    var abriendo = STATE.multiSelectAbierto !== id;
    STATE.multiSelectAbierto = abriendo ? id : null;
    STATE.multiSelectBusqueda = '';
    render();
    if(abriendo){
      var msInput = document.getElementById('ms-buscar-'+id);
      if(msInput) msInput.focus();
    }
    return;
  }
  if(action==='multiselect-limpiar'){ arrayFiltro(id).length = 0; render(); return; }

  // ---- EFECTIVO (carga rápida) ----
  if(action==='abrir-efectivo'){
    STATE.efectivoMsg = null;
    STATE.efectivoAbierto = true;
    STATE.efectivoCategoriaId = '';
    STATE.efectivoDraft = null;
    STATE.menuMovilAbierto = false;
    render(); return;
  }
  if(action==='cerrar-efectivo'){
    STATE.efectivoAbierto = false;
    STATE.efectivoMsg = null;
    STATE.efectivoCategoriaId = '';
    STATE.efectivoDraft = null;
    render(); return;
  }
  if(action==='guardar-efectivo'){
    var efFecha = document.getElementById('ef-fecha').value;
    var efCentro = document.getElementById('ef-centro').value;
    var efTipo = document.getElementById('ef-tipo').value;
    var efMonto = Math.abs(parseFloat(document.getElementById('ef-monto').value))||0;
    var efProveedor = document.getElementById('ef-proveedor').value.trim();
    var efDetalle = document.getElementById('ef-detalle').value.trim();
    var efCategoria = document.getElementById('ef-categoria').value;
    var efSubcategoria = document.getElementById('ef-subcategoria').value;

    if(!efFecha || !efMonto){
      // Conservar lo tipeado: sin este snapshot, el render de abajo recrea el modal con los
      // campos en blanco (ver efectivoDraft) aunque el usuario ya haya cargado casi todo.
      STATE.efectivoDraft = getEfectivoFormValues();
      STATE.efectivoMsg = 'Completá al menos la fecha y el monto.';
      render(); return;
    }
    STATE.efectivoMsg = null; STATE.dbError = null;
    var nuevoEf = {
      id: uid(), fecha: efFecha, centroId: efCentro, categoriaId: efCategoria, subcategoriaId: efSubcategoria,
      proveedor: efProveedor, detalle: efDetalle,
      ingreso: efTipo==='ingreso' ? efMonto : 0,
      egreso: efTipo==='egreso' ? efMonto : 0
    };
    try{
      await dbInsert('movimientos', toDbMovimiento(nuevoEf));
      STATE.movimientos.push(nuevoEf);
      try{ if(efCentro) localStorage.setItem('controlCentroEfectivo', efCentro); }catch(e){}
      STATE.saldosDirty = true;
      STATE.efectivoAbierto = false;
      STATE.efectivoCategoriaId = '';
      STATE.efectivoDraft = null;
    }catch(e){
      // Falló el guardado (p. ej. sin conexión): conservar lo tipeado también acá.
      STATE.efectivoDraft = getEfectivoFormValues();
      STATE.dbError = 'No se pudo guardar el movimiento: '+(e.message||e);
    }
    render(); return;
  }

  // ---- SALDOS ----
  if(action==='recalcular-saldos'){
    STATE.dbError = null;
    try{
      await cargarTodo(); // trae datos frescos, por si hubo cambios desde otra sesión
    }catch(e){ STATE.dbError = 'No se pudo actualizar desde la base de datos: '+(e.message||e); }
    STATE.saldosDirty = true;
    render(); return;
  }

  // ---- SUBCATEGORÍAS ----
  if(action==='edit-subcategoria'){ STATE.editing = {type:'subcategoria', id:id}; render(); return; }
  if(action==='del-subcategoria'){
    var subABorrar = STATE.subcategorias.find(function(s){return s.id===id;});
    if(!subABorrar) return;
    var afectados = STATE.movimientos.filter(function(m){return m.subcategoriaId===id;}).length;
    STATE.subDeleteState = { id:id, nombre:subABorrar.nombre, categoriaId:subABorrar.categoriaId, afectados:afectados, reasignarA:'' };
    render(); return;
  }
  if(action==='sub-delete-cancel'){ STATE.subDeleteState = null; render(); return; }
  if(action==='sub-delete-confirmar'){
    var sds = STATE.subDeleteState;
    if(!sds) return;
    var reasignarA = document.getElementById('sub-delete-reasignar') ? document.getElementById('sub-delete-reasignar').value : '';
    try{
      if(sds.afectados > 0 && reasignarA){
        verificarEscritura();
        await sb.from('movimientos').update({subcategoria_id: reasignarA}).eq('subcategoria_id', sds.id);
        STATE.movimientos.forEach(function(m){ if(m.subcategoriaId===sds.id) m.subcategoriaId = reasignarA; });
      } else if(sds.afectados > 0){
        STATE.movimientos.forEach(function(m){ if(m.subcategoriaId===sds.id) m.subcategoriaId = ''; });
      }
      await dbDelete('subcategorias', sds.id);
      STATE.subcategorias = STATE.subcategorias.filter(function(s){return s.id!==sds.id;});
      STATE.subDeleteState = null;
    }catch(e){ STATE.dbError = 'No se pudo borrar la subcategoría: '+(e.message||e); }
    render(); return;
  }
  if(action==='save-subcategoria'){
    var categoriaId = document.getElementById('f-sub-categoria').value;
    var nombre = document.getElementById('f-sub-nombre').value.trim();
    if(!categoriaId || !nombre) return;
    STATE.dbError = null;
    try{
      if(id){
        await dbUpdate('subcategorias', id, {categoria_id:categoriaId, nombre:nombre});
        var s = STATE.subcategorias.find(function(x){return x.id===id;});
        s.categoriaId = categoriaId; s.nombre = nombre;
      } else {
        var nuevaS = {id:uid(), categoriaId:categoriaId, nombre:nombre};
        await dbInsert('subcategorias', toDbSubcategoria(nuevaS));
        STATE.subcategorias.push(nuevaS);
      }
      STATE.editing = null;
    }catch(e){ STATE.dbError = 'No se pudo guardar la subcategoría: '+(e.message||e); }
    render(); return;
  }

  // ---- MOVIMIENTOS ----
  if(action==='toggle-grupo-tarjeta-mov'){
    STATE.gruposAbiertos[id] = !STATE.gruposAbiertos[id];
    render(); return;
  }
  if(action==='edit-mov'){
    STATE.editing = {type:'mov', id:id}; STATE.movFormMsg = null; STATE.movFieldErrors = null; STATE.movDraftCentroDestinoId = '';
    STATE.bulkEditMovAbierto = false;
    render(); return;
  }
  if(action==='del-mov'){
    STATE.confirmState = { message:'¿Borrar este movimiento?', action:'del-mov-do', id:id };
    render(); return;
  }
  if(action==='del-mov-do'){
    try{
      await dbDelete('movimientos', id);
      STATE.movimientos = STATE.movimientos.filter(function(m){return m.id!==id;});
      if(STATE.movSeleccionados) STATE.movSeleccionados = STATE.movSeleccionados.filter(function(mid){return mid!==id;});
      STATE.saldosDirty = true;
    }catch(e){ STATE.dbError = 'No se pudo borrar el movimiento: '+(e.message||e); }
    render(); return;
  }
  if(action==='save-mov'){
    var v = getMovFormValues();
    STATE.movDraft = v; // conservar lo tipeado si la validación falla más abajo
    var esFechaFutura = !!v.fecha && v.fecha > fechaHoyISO();
    var errores = {};
    if(!v.fecha) errores.fecha = 'La fecha es obligatoria.';
    // El input date deja tipear años de 5 dígitos ("20226-07-29"): esa fecha se guardaba, quedaba
    // como "futura" y aparecía como un mes suelto en los filtros y promedios.
    else if(!/^\d{4}-\d{2}-\d{2}$/.test(v.fecha)) errores.fecha = 'La fecha no es válida (revisá el año).';
    if(!v.centroId && !esFechaFutura) errores.centroId = 'Seleccioná un centro de costo.';
    if(!v.categoriaId) errores.categoriaId = 'Seleccioná una categoría.';
    if(!v.proveedor) errores.proveedor = 'La contraparte es obligatoria.';
    if(!v.monto) errores.monto = 'Ingresá un monto válido.';
    if(Object.keys(errores).length){
      STATE.movFieldErrors = errores;
      STATE.movFormMsg = null;
      render(); return;
    }
    STATE.movFieldErrors = null;
    var catElegida = STATE.categorias.find(function(c){return c.id===v.categoriaId;});
    var esTecMov = catElegida && catElegida.tipo === 'tec';
    var centroDestinoEl = document.getElementById('f-mov-centro-destino');
    var centroDestino = centroDestinoEl ? centroDestinoEl.value : '';

    if(esTecMov && centroDestino && centroDestino === v.centroId){
      STATE.movFormMsg = 'El Centro de Costo Destino tiene que ser distinto al de origen.';
      render(); return;
    }

    STATE.movFormMsg = null; STATE.dbError = null;
    var monto = Math.abs(parseFloat(v.monto))||0;
    var mov = {
      fecha: v.fecha, centroId: v.centroId, categoriaId: v.categoriaId, subcategoriaId: v.subcategoriaId,
      proveedor: v.proveedor, detalle: v.detalle,
      ingreso: v.tipo==='ingreso' ? monto : 0,
      egreso: v.tipo==='egreso' ? monto : 0,
      tarjeta: !!v.tarjeta,
      fechaConsumo: v.tarjeta ? (v.fechaConsumo||'') : '',
      tarjetaMarca: v.tarjeta ? (v.tarjetaMarca||'').trim() : '',
      cuotas: v.tarjeta ? (v.cuotasInfo||'').trim() : ''
    };
    // Compra en cuotas con tarjeta: la Fecha cargada es el vencimiento de la 1ª cuota;
    // las siguientes caen un mes después cada una, con el mismo monto (no se divide). El Detalle no
    // se toca — cada movimiento generado lleva su número de cuota en el campo Cuotas ("N/Total"),
    // pisando lo que hubiera en el campo Cuotas del formulario (el generador manda si está activo).
    // La Fecha de consumo (si se cargó) es la misma para todas las cuotas: la compra se hizo una sola vez.
    // Al editar un movimiento ya cargado también se puede sumar cuotas: el movimiento editado
    // queda como la 1ª cuota y se crean nuevos movimientos para las cuotas restantes.
    var cuotasTotal = v.tarjeta ? Math.max(1, parseInt(v.cuotas,10)||1) : 1;
    function etiquetaCuota(numeroCuota){
      return cuotasTotal>1 ? (numeroCuota+'/'+cuotasTotal) : mov.cuotas;
    }
    try{
      if(id){
        var movEditado = Object.assign({}, mov, { cuotas: etiquetaCuota(1) });
        await dbUpdate('movimientos', id, toDbMovimiento(Object.assign({id:id}, movEditado)));
        var idx = STATE.movimientos.findIndex(function(m){return m.id===id;});
        // cambioId se conserva: si es la pata en pesos de una compra/venta de dólares, sigue vinculada.
        if(idx>-1) STATE.movimientos[idx] = Object.assign({id:id, cambioId: STATE.movimientos[idx].cambioId||''}, movEditado);

        if(esTecMov && centroDestino){
          // faltaba la línea espejo (típico de movimientos importados): crearla ahora, sin tocar ninguna otra existente
          var nuevoEspejo = {
            id: uid(), fecha: movEditado.fecha, centroId: centroDestino, categoriaId: movEditado.categoriaId, subcategoriaId: movEditado.subcategoriaId,
            proveedor: movEditado.proveedor, detalle: (movEditado.detalle ? movEditado.detalle+' ' : '')+'(transferencia automática)',
            ingreso: v.tipo==='ingreso' ? 0 : monto,
            egreso: v.tipo==='ingreso' ? monto : 0,
            tarjeta: !!v.tarjeta
          };
          await dbInsert('movimientos', [toDbMovimiento(nuevoEspejo)]);
          STATE.movimientos.push(nuevoEspejo);
        }

        if(cuotasTotal>1){
          var loteRestante = [];
          for(var cj=1; cj<cuotasTotal; cj++){
            var fechaCuotaJ = sumarMeses(v.fecha, cj);
            loteRestante.push(Object.assign({id:uid()}, mov, { fecha: fechaCuotaJ, cuotas: etiquetaCuota(cj+1) }));
          }
          await dbInsert('movimientos', loteRestante.map(toDbMovimiento));
          STATE.movimientos.push.apply(STATE.movimientos, loteRestante);
        }
      } else {
        var fechasCuotas = [];
        for(var ci=0; ci<cuotasTotal; ci++){ fechasCuotas.push(ci===0 ? v.fecha : sumarMeses(v.fecha, ci)); }
        var nuevosLote = [];
        fechasCuotas.forEach(function(fechaCuota, i){
          var base = Object.assign({}, mov, { fecha: fechaCuota, cuotas: etiquetaCuota(i+1) });
          if(esTecMov && centroDestino){
            // crear el movimiento de origen + el espejo automático en el centro destino, con tipo contrario
            var nuevoM = Object.assign({id:uid()}, base);
            var espejo = {
              id: uid(), fecha: fechaCuota, centroId: centroDestino, categoriaId: v.categoriaId, subcategoriaId: v.subcategoriaId,
              proveedor: v.proveedor, detalle: (base.detalle ? base.detalle+' ' : '')+'(transferencia automática)',
              ingreso: v.tipo==='ingreso' ? 0 : monto,
              egreso: v.tipo==='ingreso' ? monto : 0,
              tarjeta: !!v.tarjeta
            };
            nuevosLote.push(nuevoM, espejo);
          } else {
            nuevosLote.push(Object.assign({id:uid()}, base));
          }
        });
        await dbInsert('movimientos', nuevosLote.map(toDbMovimiento));
        STATE.movimientos.push.apply(STATE.movimientos, nuevosLote);
      }
      STATE.saldosDirty = true;
      STATE.editing = null;
      STATE.movDraft = null;
      STATE.nuevoMovAbierto = false;
      STATE.movDraftCentroDestinoId = '';
    }catch(e){ STATE.dbError = 'No se pudo guardar el movimiento: '+(e.message||e); }
    render(); return;
  }

  // ---- VENCIMIENTOS ----
  if(action==='edit-venc'){ STATE.editing = {type:'venc', id:id}; STATE.vencFormMsg = null; render(); return; }
  if(action==='del-venc'){
    STATE.confirmState = { message:'¿Borrar este vencimiento?', action:'del-venc-do', id:id };
    render(); return;
  }
  if(action==='del-venc-do'){
    try{
      await dbDelete('vencimientos', id);
      STATE.vencimientos = STATE.vencimientos.filter(function(v){return v.id!==id;});
    }catch(e){ STATE.dbError = 'No se pudo borrar el vencimiento: '+(e.message||e); }
    render(); return;
  }
  if(action==='save-venc'){
    var valoresVenc = leerFormVenc('venc');
    var concepto = (valoresVenc.concepto||'').trim();
    var fecha = valoresVenc.fecha||'';
    var monto = parseFloat(valoresVenc.monto) || 0;
    var centroId = valoresVenc.centroId||'';
    var categoriaVencId = valoresVenc.categoriaId||'', subcategoriaVencId = valoresVenc.subcategoriaId||'';
    if(!concepto || !fecha){
      STATE.vencFormMsg = 'Completá al menos concepto y fecha de vencimiento.';
      STATE.vencDraft = {form:'venc', id:id||'', valores:valoresVenc};
      render(); return;
    }
    var estadoSel = document.getElementById('f-venc-estado');
    var crearMovChk = document.getElementById('f-venc-crear-mov');
    STATE.vencFormMsg = null; STATE.dbError = null;
    try{
      if(id){
        var v = STATE.vencimientos.find(function(x){return x.id===id;});
        var estadoAnterior = v.estado;
        v.concepto = concepto; v.fecha = fecha; v.monto = monto; v.centroId = centroId;
        v.categoriaId = categoriaVencId; v.subcategoriaId = subcategoriaVencId;
        if(estadoSel) v.estado = estadoSel.value;
        await dbUpdate('vencimientos', id, toDbVencimiento(v));
        if(estadoSel && estadoSel.value==='pagado' && estadoAnterior!=='pagado' && crearMovChk && crearMovChk.checked){
          await crearMovimientoDesdeVencimiento(v);
        }
      } else {
        var nuevoV = {id:uid(), concepto:concepto, fecha:fecha, monto:monto, centroId:centroId,
          categoriaId:categoriaVencId, subcategoriaId:subcategoriaVencId, estado:'pendiente'};
        await dbInsert('vencimientos', toDbVencimiento(nuevoV));
        STATE.vencimientos.push(nuevoV);
      }
      STATE.editing = null;
    }catch(e){ STATE.dbError = 'No se pudo guardar el vencimiento: '+(e.message||e); }
    render(); return;
  }
  if(action==='toggle-venc-estado'){
    var vt = STATE.vencimientos.find(function(x){return x.id===id;});
    if(!vt) return;
    var nuevoEstado = (vt.estado==='pendiente') ? 'pagado' : 'pendiente'; // pagado o salteado vuelven a pendiente
    try{
      await dbUpdate('vencimientos', id, {estado:nuevoEstado});
      vt.estado = nuevoEstado;
    }catch(e){ STATE.dbError = 'No se pudo actualizar el estado: '+(e.message||e); }
    render(); return;
  }
  if(action==='saltear-venc'){
    var vs = STATE.vencimientos.find(function(x){return x.id===id;});
    if(!vs) return;
    try{
      await dbUpdate('vencimientos', id, {estado:'salteado'});
      vs.estado = 'salteado';
    }catch(e){ STATE.dbError = 'No se pudo actualizar el estado: '+(e.message||e); }
    render(); return;
  }

  // ---- VENCIMIENTOS RECURRENTES (V1) ----
  if(action==='nuevo-vrec'){ STATE.editing = {type:'vrec', id:''}; STATE.vrecFormMsg = null; render(); return; }
  if(action==='edit-vrec'){ STATE.editing = {type:'vrec', id:id}; STATE.vrecFormMsg = null; render(); return; }
  if(action==='save-vrec'){
    var valoresRec = leerFormVenc('vrec');
    var diaRec = parseInt(valoresRec.dia, 10);
    var errorRec = null;
    if(!(valoresRec.concepto||'').trim() || !valoresRec.dia || !valoresRec.desde) errorRec = 'Completá al menos concepto, día del mes y mes "Desde".';
    else if(!(diaRec>=1 && diaRec<=31)) errorRec = 'El día del mes tiene que ser entre 1 y 31.';
    else if(valoresRec.hasta && valoresRec.hasta < valoresRec.desde) errorRec = 'El mes "Hasta" no puede ser anterior a "Desde".';
    if(errorRec){
      STATE.vrecFormMsg = errorRec;
      STATE.vencDraft = {form:'vrec', id:id||'', valores:valoresRec};
      render(); return;
    }
    var datosRec = {concepto:valoresRec.concepto.trim(), dia:diaRec, monto:parseFloat(valoresRec.monto)||0,
      centroId:valoresRec.centroId||'', categoriaId:valoresRec.categoriaId||'', subcategoriaId:valoresRec.subcategoriaId||'',
      desde:valoresRec.desde, hasta:valoresRec.hasta||''};
    STATE.vrecFormMsg = null; STATE.dbError = null;
    try{
      if(id){
        var rec = STATE.vencRecurrentes.find(function(x){return x.id===id;});
        Object.assign(rec, datosRec);
        await dbUpdate('vencimientos_recurrentes', id, toDbVencRecurrente(rec));
      } else {
        var nuevaRec = Object.assign({id:uid()}, datosRec);
        await dbInsert('vencimientos_recurrentes', toDbVencRecurrente(nuevaRec));
        STATE.vencRecurrentes.push(nuevaRec);
      }
      STATE.editing = null;
      // Si "Desde" ya llegó, el vencimiento de este mes (y los de atrás) se ven enseguida.
      if(await generarVencimientosRecurrentes() > 0){
        STATE.vencimientos = (await dbFetchAll('vencimientos')).map(fromDbVencimiento);
      }
    }catch(e){ STATE.dbError = 'No se pudo guardar el vencimiento recurrente: '+(e.message||e); }
    render(); return;
  }
  if(action==='del-vrec'){
    var recBorrar = STATE.vencRecurrentes.find(function(x){return x.id===id;});
    STATE.confirmState = { message:'¿Borrar el vencimiento recurrente "'+(recBorrar?recBorrar.concepto:'')+'"? Deja de crearse cada mes; los vencimientos ya creados quedan.', action:'del-vrec-do', id:id };
    render(); return;
  }
  if(action==='del-vrec-do'){
    try{
      await dbDelete('vencimientos_recurrentes', id);
      STATE.vencRecurrentes = STATE.vencRecurrentes.filter(function(r){return r.id!==id;});
      STATE.vencimientos.forEach(function(v){ if(v.recurrenteId===id) v.recurrenteId = ''; }); // la base hace lo mismo (on delete set null)
    }catch(e){ STATE.dbError = 'No se pudo borrar el vencimiento recurrente: '+(e.message||e); }
    render(); return;
  }
  if(action==='pagar-venc'){ STATE.vencPagarState = {id:id}; render(); return; }
  if(action==='cancel-pagar-venc'){ STATE.vencPagarState = null; render(); return; }
  if(action==='pagar-venc-sin-mov'){
    var vps1 = STATE.vencimientos.find(function(x){return x.id===id;});
    if(!vps1) return;
    try{
      await dbUpdate('vencimientos', id, {estado:'pagado'});
      vps1.estado = 'pagado';
      STATE.vencPagarState = null;
    }catch(e){ STATE.dbError = 'No se pudo actualizar el estado: '+(e.message||e); }
    render(); return;
  }
  if(action==='pagar-venc-con-mov' || action==='venc-a-movimiento'){
    var vm = STATE.vencimientos.find(function(x){return x.id===id;});
    if(!vm) return;
    try{
      await crearMovimientoDesdeVencimiento(vm);
      await dbUpdate('vencimientos', id, {estado:'pagado'});
      vm.estado = 'pagado';
      STATE.vencPagarState = null;
      if(action==='venc-a-movimiento'){ STATE.activeTab = 'movimientos'; STATE.editing = null; }
    }catch(e){ STATE.dbError = 'No se pudo convertir el vencimiento en movimiento: '+(e.message||e); }
    render(); return;
  }
  if(action==='edit-deuda'){ STATE.editing = {type:'deuda', id:id}; STATE.deudaFormMsg = null; render(); return; }
  if(action==='del-deuda'){
    STATE.confirmState = { message:'¿Borrar esta deuda?', action:'del-deuda-do', id:id };
    render(); return;
  }
  if(action==='del-deuda-do'){
    try{
      await dbDelete('deudas', id);
      STATE.deudas = STATE.deudas.filter(function(d){return d.id!==id;});
    }catch(e){ STATE.dbError = 'No se pudo borrar la deuda: '+(e.message||e); }
    render(); return;
  }
  if(action==='save-deuda'){
    var conceptoD = document.getElementById('f-deuda-concepto').value.trim();
    var saldoD = parseFloat(document.getElementById('f-deuda-saldo').value) || 0;
    var cuotaD = parseFloat(document.getElementById('f-deuda-cuota').value) || 0;
    var centroD = document.getElementById('f-deuda-centro').value;
    if(!conceptoD || saldoD<=0 || cuotaD<=0){
      STATE.deudaFormMsg = 'Completá concepto, saldo pendiente y cuota mensual (mayores a cero).';
      render(); return;
    }
    STATE.deudaFormMsg = null; STATE.dbError = null;
    try{
      if(id){
        var dEdit = STATE.deudas.find(function(x){return x.id===id;});
        dEdit.concepto = conceptoD; dEdit.saldoPendiente = saldoD; dEdit.cuotaMensual = cuotaD; dEdit.centroId = centroD;
        await dbUpdate('deudas', id, toDbDeuda(dEdit));
      } else {
        var nuevaD = {id:uid(), concepto:conceptoD, saldoPendiente:saldoD, cuotaMensual:cuotaD, centroId:centroD, estado:'activa'};
        await dbInsert('deudas', toDbDeuda(nuevaD));
        STATE.deudas.push(nuevaD);
      }
      STATE.editing = null;
    }catch(e){ STATE.dbError = 'No se pudo guardar la deuda: '+(e.message||e); }
    render(); return;
  }
  if(action==='toggle-deuda-estado'){
    var dt = STATE.deudas.find(function(x){return x.id===id;});
    if(!dt) return;
    var nuevoEstadoD = (dt.estado==='cancelada') ? 'activa' : 'cancelada';
    try{
      await dbUpdate('deudas', id, {estado:nuevoEstadoD});
      dt.estado = nuevoEstadoD;
    }catch(e){ STATE.dbError = 'No se pudo actualizar el estado de la deuda: '+(e.message||e); }
    render(); return;
  }
  if(action==='pagar-cuota-deuda'){
    var dp = STATE.deudas.find(function(x){return x.id===id;});
    if(!dp) return;
    var nuevoSaldo = Math.max(0, (Number(dp.saldoPendiente)||0) - (Number(dp.cuotaMensual)||0));
    var camposUpd = {saldo_pendiente: nuevoSaldo};
    if(nuevoSaldo===0) camposUpd.estado = 'cancelada';
    try{
      await dbUpdate('deudas', id, camposUpd);
      dp.saldoPendiente = nuevoSaldo;
      if(nuevoSaldo===0) dp.estado = 'cancelada';
    }catch(e){ STATE.dbError = 'No se pudo registrar el pago de la cuota: '+(e.message||e); }
    render(); return;
  }
  // ---- IMPORTAR ----
  if(action==='preview-import'){
    var entidadImp = document.getElementById('imp-entidad') ? document.getElementById('imp-entidad').value : STATE.importEntidad;

    if(entidadImp === 'excel'){
      var filasExcel = parseExcelHistorico(STATE.importRaw||'');
      if(!filasExcel.length){
        STATE.importMsg = {type:'err', text:'No se encontraron filas con el formato esperado (10 columnas separadas por tab: Periodo, Cuenta, Categoría, Subcategoría, CC, Fecha, Contraparte, Detalle, Ingresos, Egresos).'};
        STATE.importPreviewExcel = null; render(); return;
      }
      STATE.importPreviewExcel = filasExcel.map(function(r){
        var ccMatch = STATE.centros.find(function(c){ return (c.codigo||'').toUpperCase() === (r.cc||'').toUpperCase(); });
        var catMatch = STATE.categorias.find(function(c){ return c.nombre.toLowerCase() === (r.categoria||'').toLowerCase(); });
        var subMatch = r.subcategoria ? STATE.subcategorias.find(function(s){ return s.nombre.toLowerCase() === r.subcategoria.toLowerCase() && (!catMatch || s.categoriaId===catMatch.id); }) : null;
        return {
          id: uid(), fecha: r.fecha, ccText: r.cc, categoriaText: r.categoria, subcategoriaText: r.subcategoria,
          proveedor: r.proveedor, detalle: r.detalle, ingreso: r.ingreso, egreso: r.egreso, incluir: true,
          ccExists: !!ccMatch, catExists: !!catMatch, subExists: !!subMatch
        };
      });
      STATE.importPreview = null;
      STATE.importMsg = null;
      render(); return;
    }

    var res = runParser();
    if(res.error){ STATE.importMsg = {type:'err', text: res.error}; STATE.importPreview = null; render(); return; }
    if(!res.rows.length){
      var textoVacio = res.omitidas ? 'Todas las filas encontradas ('+res.omitidas+') están en dólares; esta entidad solo importa montos en pesos.' : 'No se encontró ningún movimiento en el texto pegado.';
      STATE.importMsg = {type:'err', text: textoVacio}; STATE.importPreview = null; render(); return;
    }
    var tarjetaMarcaLote = (STATE.importEntidad==='tarjeta') ? (STATE.importTarjetaMarca||'').trim() : '';
    STATE.importPreview = res.rows.map(function(r){
      var sugerido = aplicarReglaAFila(r.proveedor);
      return { id:uid(), fecha: fechaCortaAISO(r.fecha), fechaConsumo: r.fechaConsumo ? fechaCortaAISO(r.fechaConsumo) : '', tarjetaMarca: tarjetaMarcaLote, cuotas: r.cuota||'', proveedor: r.proveedor||'', detalle: r.tipo||'', monto: r.monto,
        centroId: '', categoriaId: sugerido.categoriaId, subcategoriaId: sugerido.subcategoriaId, incluir:true, guardarRegla:false };
    });
    STATE.importMsg = defaultCentroId ? null : {type:'err', text:'No encontré un Centro de Costo con el código esperado para esta entidad. Asigná uno por fila abajo, o cargalo primero en ABM → Centros de Costo.'};
    if(res.omitidas){
      var omitTexto = res.omitidas+' fila(s) en dólares no se importaron (esta entidad solo carga montos en pesos); cargalas manualmente si corresponde.';
      STATE.importMsg = STATE.importMsg ? {type: STATE.importMsg.type, text: STATE.importMsg.text+' '+omitTexto} : {type:'ok', text: omitTexto};
    }
    render(); return;
  }
  if(action==='cancel-import'){ STATE.importPreview = null; STATE.importPreviewExcel = null; STATE.importMsg = null; render(); return; }
  if(action==='confirm-import-excel'){
    var seleccionadasExcel = STATE.importPreviewExcel.filter(function(r){return r.incluir;});
    if(!seleccionadasExcel.length){ STATE.importMsg = {type:'err', text:'No hay movimientos seleccionados para importar.'}; render(); return; }

    var nuevosCentros = [], nuevasCategorias = [], nuevasSubcategorias = [];

    function resolverCentro(ccText){
      if(!ccText) return '';
      var found = STATE.centros.find(function(c){ return (c.codigo||'').toUpperCase() === ccText.toUpperCase(); });
      if(found) return found.id;
      var nuevo = {id:uid(), codigo: ccText.toUpperCase(), nombre: ccText};
      STATE.centros.push(nuevo); nuevosCentros.push(nuevo); STATE.saldosDirty = true;
      return nuevo.id;
    }
    function resolverCategoria(nombreText){
      if(!nombreText) return '';
      var found = STATE.categorias.find(function(c){ return c.nombre.toLowerCase() === nombreText.toLowerCase(); });
      if(found) return found.id;
      var nuevo = {id:uid(), nombre: nombreText, tipo:''};
      STATE.categorias.push(nuevo); nuevasCategorias.push(nuevo);
      return nuevo.id;
    }
    function resolverSubcategoria(nombreText, categoriaId){
      if(!nombreText || !categoriaId) return '';
      var found = STATE.subcategorias.find(function(s){ return s.nombre.toLowerCase() === nombreText.toLowerCase() && s.categoriaId === categoriaId; });
      if(found) return found.id;
      var nuevo = {id:uid(), categoriaId: categoriaId, nombre: nombreText};
      STATE.subcategorias.push(nuevo); nuevasSubcategorias.push(nuevo);
      return nuevo.id;
    }

    var nuevosMovimientos = [];
    seleccionadasExcel.forEach(function(r){
      var centroId = resolverCentro(r.ccText);
      var categoriaId = resolverCategoria(r.categoriaText);
      var subcategoriaId = resolverSubcategoria(r.subcategoriaText, categoriaId);
      var nm = {
        id: uid(), fecha: r.fecha, centroId: centroId, categoriaId: categoriaId, subcategoriaId: subcategoriaId,
        proveedor: r.proveedor, detalle: r.detalle, ingreso: r.ingreso||0, egreso: r.egreso||0
      };
      nuevosMovimientos.push(nm);
      STATE.movimientos.push(nm);
      STATE.saldosDirty = true;
    });

    try{
      if(nuevosCentros.length) await dbInsert('centros', nuevosCentros.map(toDbCentro));
      if(nuevasCategorias.length) await dbInsert('categorias', nuevasCategorias.map(toDbCategoria));
      if(nuevasSubcategorias.length) await dbInsert('subcategorias', nuevasSubcategorias.map(toDbSubcategoria));
      await dbInsert('movimientos', nuevosMovimientos.map(toDbMovimiento));

      STATE.importPreviewExcel = null; STATE.importRaw = '';
      STATE.importMsg = { type:'ok', text: seleccionadasExcel.length+' movimiento(s) importado(s). Se crearon '+nuevosCentros.length+' centro(s) de costo, '+nuevasCategorias.length+' categoría(s) y '+nuevasSubcategorias.length+' subcategoría(s) nuevas.' };
      STATE.activeTab = 'movimientos'; STATE.editing = null;
    }catch(e){
      // revertir los agregados en memoria si la base de datos falló, para no mostrar datos que no se guardaron
      STATE.centros = STATE.centros.filter(function(c){ return nuevosCentros.indexOf(c)===-1; });
      STATE.categorias = STATE.categorias.filter(function(c){ return nuevasCategorias.indexOf(c)===-1; });
      STATE.subcategorias = STATE.subcategorias.filter(function(s){ return nuevasSubcategorias.indexOf(s)===-1; });
      STATE.movimientos = STATE.movimientos.filter(function(m){ return nuevosMovimientos.indexOf(m)===-1; });
      STATE.dbError = 'No se pudo completar la importación: '+(e.message||e);
    }
    render(); return;
  }
  if(action==='apply-all'){
    var catAllSel = document.getElementById('imp-cat-all');
    var centroAllSel = document.getElementById('imp-centro-all');
    var catVal = catAllSel ? catAllSel.value : '';
    var centroVal = centroAllSel ? centroAllSel.value : '';
    STATE.importPreview.forEach(function(row){
      if(catVal){ row.categoriaId = catVal; row.subcategoriaId=''; }
      if(centroVal){ row.centroId = centroVal; }
    });
    render(); return;
  }
  if(action==='confirm-import'){
    var seleccionadas = STATE.importPreview.filter(function(r){return r.incluir;});
    if(!seleccionadas.length){ STATE.importMsg = {type:'err', text:'No hay movimientos seleccionados para importar.'}; render(); return; }
    var faltaCentro = seleccionadas.some(function(r){return !r.centroId;});
    if(faltaCentro){ STATE.importMsg = {type:'err', text:'Hay movimientos sin Centro de Costo asignado. Asignalo antes de importar.'}; render(); return; }
    var esTarjeta = STATE.importEntidad === 'tarjeta';
    var nuevosMov = seleccionadas.map(function(r){
      return {
        id: uid(), fecha: r.fecha, centroId: r.centroId, categoriaId: r.categoriaId, subcategoriaId: r.subcategoriaId,
        proveedor: r.proveedor, detalle: r.detalle,
        ingreso: r.monto>0 ? r.monto : 0,
        egreso: r.monto<0 ? -r.monto : 0,
        tarjeta: esTarjeta,
        fechaConsumo: r.fechaConsumo || '',
        tarjetaMarca: r.tarjetaMarca || '',
        cuotas: r.cuotas || ''
      };
    });
    try{
      await dbInsert('movimientos', nuevosMov.map(toDbMovimiento));
      STATE.movimientos = STATE.movimientos.concat(nuevosMov);
      STATE.saldosDirty = true;
      var nuevasReglas = 0;
      for(var idxSel=0; idxSel<seleccionadas.length; idxSel++){
        var rSel = seleccionadas[idxSel];
        if(rSel.guardarRegla && rSel.categoriaId){
          await agregarOActualizarRegla(rSel.proveedor, nombreCategoria(rSel.categoriaId), rSel.subcategoriaId ? nombreSubcategoria(rSel.subcategoriaId) : '');
          nuevasReglas++;
        }
      }
      STATE.importPreview = null; STATE.importRaw = '';
      STATE.importMsg = {type:'ok', text: seleccionadas.length+' movimiento(s) importado(s) correctamente.'+(nuevasReglas ? ' Se guardaron '+nuevasReglas+' regla(s) de categorización nueva(s).' : '')};
      STATE.activeTab = 'movimientos'; STATE.editing = null;
    }catch(e){ STATE.dbError = 'No se pudo completar la importación: '+(e.message||e); }
    render(); return;
  }

  // ---- REGLAS DE CATEGORIZACIÓN ----
  if(action==='agregar-regla'){
    var rProv = document.getElementById('regla-proveedor').value.trim();
    var rCatId = document.getElementById('regla-categoria').value;
    var rSub = document.getElementById('regla-subcategoria').value.trim();
    if(!rProv || !rCatId){
      STATE.reglaFormMsg = 'Completá al menos la contraparte y la categoría.';
      render(); return;
    }
    try{
      await agregarOActualizarRegla(rProv, nombreCategoria(rCatId), rSub);
      STATE.reglaFormMsg = null;
    }catch(e){ STATE.reglaFormMsg = 'No se pudo guardar la regla: '+(e.message||e); }
    render(); return;
  }
  if(action==='borrar-regla'){
    try{
      await dbDelete('reglas_categorizacion', id);
      STATE.reglas = STATE.reglas.filter(function(r){ return r.id !== id; });
    }catch(e){ STATE.dbError = 'No se pudo borrar la regla: '+(e.message||e); }
    render(); return;
  }

  // ---- FACTURACIÓN ARCA ----
  if(action==='ver-comprobante'){
    var facturaVer = STATE.facturas.find(function(f){return f.id===id;});
    abrirComprobante(facturaVer);
    return;
  }
  if(action==='facturar-mov'){
    var movAFacturar = STATE.movimientos.find(function(x){return x.id===id;});
    if(!movAFacturar) return;
    if(faltanDatosFacturacion()){
      STATE.dbError = 'Antes de facturar, el soporte tiene que cargar tus datos de facturación (CUIT y razón social).';
      render(); return;
    }
    STATE.confirmState = {
      message: '¿Emitir factura ARCA por $'+fmtMonto(movAFacturar.ingreso)+' a Consumidor Final?',
      action: 'facturar-mov-do', id: id, destructivo: false, textoConfirmar: 'Sí, facturar'
    };
    render(); return;
  }
  if(action==='facturar-mov-do'){
    STATE.facturaLoadingId = id;
    STATE.dbError = null;
    render();
    try{
      var resFactura = await sb.functions.invoke('facturar-arca', { body: { movimientoId: id } });
      if(resFactura.error) throw resFactura.error;
      var cuerpoFactura = resFactura.data || {};
      if(cuerpoFactura.factura){
        var facturaNueva = fromDbFactura(cuerpoFactura.factura);
        STATE.facturas = STATE.facturas.filter(function(f){return f.id!==facturaNueva.id;}).concat([facturaNueva]);
      }
      if(cuerpoFactura.error) STATE.dbError = 'No se pudo emitir la factura: '+cuerpoFactura.error;
    }catch(e){
      STATE.dbError = 'No se pudo emitir la factura: '+(e.message||e);
    }
    STATE.facturaLoadingId = null;
    render(); return;
  }

  // ---- DÓLARES ----
  if(action==='actualizar-dolar-blue'){ await obtenerDolarBlue(); return; }
  if(action==='usar-dolar-blue'){
    var draftBlue = getDolaresFormValues();
    var cotizBlue = draftBlue.tipo==='compra' ? STATE.dolarBlueVenta : STATE.dolarBlueCompra;
    var cantBlue = parseFloat(draftBlue.cantidad)||0;
    if(cantBlue>0 && cotizBlue) draftBlue.montoArs = String(Math.round(cantBlue*cotizBlue*100)/100);
    STATE.dolaresDraft = draftBlue;
    render(); return;
  }
  if(action==='edit-dolares'){ STATE.editing = {type:'usd', id:id}; STATE.dolaresDraft = null; STATE.dolaresFormMsg = null; render(); return; }
  if(action==='del-dolares'){
    var usdBorrar = STATE.movimientosUsd.find(function(x){ return x.id===id; });
    var avisoPar = movimientoPesosDeCambio(usdBorrar) ? ' Esto también borra el movimiento en pesos vinculado en Movimientos.' : '';
    STATE.confirmState = { message:'¿Borrar este movimiento en dólares?'+avisoPar, action:'del-dolares-do', id:id };
    render(); return;
  }
  if(action==='del-dolares-do'){
    try{
      var parBorrar = movimientoPesosDeCambio(STATE.movimientosUsd.find(function(x){ return x.id===id; }));
      if(parBorrar){
        await dbDelete('movimientos', parBorrar.id);
        STATE.movimientos = STATE.movimientos.filter(function(m){ return m.id!==parBorrar.id; });
        STATE.saldosDirty = true;
      }
      await dbDelete('movimientos', id);
      STATE.movimientosUsd = STATE.movimientosUsd.filter(function(m){ return m.id!==id; });
    }catch(e){ STATE.dbError = 'No se pudo borrar el movimiento en dólares: '+(e.message||e); }
    render(); return;
  }
  if(action==='save-dolares'){
    var vD = getDolaresFormValues();
    STATE.dolaresDraft = vD;
    var cantD = Math.abs(parseFloat(vD.cantidad))||0;
    if(!vD.fecha || !cantD || !vD.centroId){
      STATE.dolaresFormMsg = 'Completá al menos: fecha, cantidad de dólares (mayor a 0) y CC en dólares.';
      render(); return;
    }
    if(vD.tipo==='transferencia'){
      var catTecD = categoriaTecUsd();
      if(!catTecD){ STATE.dolaresFormMsg = 'Creá primero una categoría de tipo TEC en ABM → Categorías.'; render(); return; }
      if(!vD.centroDestinoId){ STATE.dolaresFormMsg = 'Elegí el CC en dólares destino.'; render(); return; }
      // Se guarda como gasto TEC en el origen; el espejo (ingreso en el destino) lo crea el bloque de abajo.
      vD = Object.assign({}, vD, { tipo:'egreso', categoriaId: catTecD.id, subcategoriaId:'' });
    }
    var esCambioD = vD.tipo==='compra' || vD.tipo==='venta';
    var montoArsD = Math.abs(parseFloat(vD.montoArs))||0;
    if(esCambioD && (!montoArsD || !vD.centroArsId || !vD.categoriaId)){
      STATE.dolaresFormMsg = 'Para una '+vD.tipo+' completá también: pesos, CC en pesos y Categoría.';
      render(); return;
    }
    var destinoD = (!esCambioD && esTipoCategoria(vD.categoriaId, 'tec')) ? vD.centroDestinoId : '';
    if(destinoD && destinoD===vD.centroId){
      STATE.dolaresFormMsg = 'El CC destino tiene que ser distinto al de origen.';
      render(); return;
    }
    STATE.dolaresFormMsg = null; STATE.dbError = null;
    var entraD = vD.tipo==='compra' || vD.tipo==='ingreso';
    var existenteD = id ? STATE.movimientosUsd.find(function(x){ return x.id===id; }) : null;
    var parPrevio = movimientoPesosDeCambio(existenteD);
    var cambioIdD = esCambioD ? ((existenteD && existenteD.cambioId) || uid()) : '';
    var proveedorD = esCambioD ? (vD.tipo==='compra' ? 'Compra USD' : 'Venta USD') : '';
    var movUsd = {
      id: id || uid(), fecha: vD.fecha, centroId: vD.centroId, categoriaId: vD.categoriaId, subcategoriaId: vD.subcategoriaId,
      proveedor: proveedorD, detalle: vD.detalle, ingreso: entraD?cantD:0, egreso: entraD?0:cantD, tarjeta:false,
      fechaConsumo:'', tarjetaMarca:'', cuotas:'', moneda:'USD', cambioId: cambioIdD
    };
    var movArs = esCambioD ? {
      id: parPrevio ? parPrevio.id : uid(), fecha: vD.fecha, centroId: vD.centroArsId, categoriaId: vD.categoriaId, subcategoriaId: vD.subcategoriaId,
      proveedor: proveedorD, detalle: (vD.detalle?vD.detalle+' — ':'')+(vD.tipo==='compra'?'Compra ':'Venta ')+fmtUsd(cantD)+' (cotización $'+fmtMonto(montoArsD/cantD)+')',
      ingreso: entraD?0:montoArsD, egreso: entraD?montoArsD:0, tarjeta:false, fechaConsumo:'', tarjetaMarca:'', cuotas:'', moneda:'ARS', cambioId: cambioIdD
    } : null;
    try{
      if(existenteD){
        var camposUsd = toDbMovimiento(movUsd);
        if(!cambioIdD && existenteD.cambioId) camposUsd.cambio_id = null; // pasó de compra/venta a ingreso/gasto
        await dbUpdate('movimientos', id, camposUsd);
        Object.assign(existenteD, movUsd);
      } else {
        await dbInsert('movimientos', toDbMovimiento(movUsd));
        STATE.movimientosUsd.push(movUsd);
      }
      if(movArs && parPrevio){
        await dbUpdate('movimientos', parPrevio.id, toDbMovimiento(movArs));
        Object.assign(parPrevio, movArs);
      } else if(movArs){
        await dbInsert('movimientos', toDbMovimiento(movArs));
        STATE.movimientos.push(movArs);
      } else if(parPrevio){
        await dbDelete('movimientos', parPrevio.id);
        STATE.movimientos = STATE.movimientos.filter(function(m){ return m.id!==parPrevio.id; });
      }
      if(destinoD){
        var espejoUsd = {
          id: uid(), fecha: vD.fecha, centroId: destinoD, categoriaId: vD.categoriaId, subcategoriaId: vD.subcategoriaId,
          proveedor: '', detalle: (vD.detalle ? vD.detalle+' ' : '')+'(transferencia automática)',
          ingreso: entraD?0:cantD, egreso: entraD?cantD:0, tarjeta:false,
          fechaConsumo:'', tarjetaMarca:'', cuotas:'', moneda:'USD', cambioId:''
        };
        await dbInsert('movimientos', toDbMovimiento(espejoUsd));
        STATE.movimientosUsd.push(espejoUsd);
      }
      STATE.saldosDirty = true;
      STATE.editing = null;
      STATE.dolaresDraft = null;
    }catch(e){ STATE.dbError = 'No se pudo guardar el movimiento en dólares: '+(e.message||e); }
    render(); return;
  }

  // ---- USDT ----
  if(action==='actualizar-cotizacion-usdt'){ await obtenerCotizacionUsdt(); return; }
  if(action==='usar-cotizacion-usdt-ingreso'){
    var draftCot = getUsdtFormValues();
    var cantidadCot = parseFloat(draftCot.cantidad)||0;
    if(cantidadCot>0 && STATE.usdtCotizacionBid){
      draftCot.montoArs = String(Math.round(cantidadCot*STATE.usdtCotizacionBid*100)/100);
    }
    STATE.usdtDraft = draftCot;
    render(); return;
  }
  if(action==='edit-usdt'){ STATE.editing = {type:'usdt', id:id}; STATE.usdtFormMsg = null; render(); return; }
  if(action==='toggle-usdt-opcionales'){
    var draftOpc = getUsdtFormValues();
    STATE.usdtDraft = draftOpc;
    STATE.usdtIngresoOpcionalesAbierto = true;
    render(); return;
  }
  if(action==='del-usdt'){
    var uBorrar = STATE.usdtMovimientos.find(function(x){return x.id===id;});
    var avisoVinculado = (uBorrar && uBorrar.movimientoId) ? ' Esto también borra el movimiento en pesos vinculado en Movimientos.' : '';
    STATE.confirmState = { message:'¿Borrar este movimiento de USDT?'+avisoVinculado, action:'del-usdt-do', id:id };
    render(); return;
  }
  if(action==='del-usdt-do'){
    try{
      var uBorrado = STATE.usdtMovimientos.find(function(x){return x.id===id;});
      if(uBorrado && uBorrado.movimientoId){
        await dbDelete('movimientos', uBorrado.movimientoId);
        STATE.movimientos = STATE.movimientos.filter(function(m){return m.id!==uBorrado.movimientoId;});
        STATE.saldosDirty = true;
      }
      await dbDelete('usdt_movimientos', id);
      STATE.usdtMovimientos = STATE.usdtMovimientos.filter(function(x){return x.id!==id;});
    }catch(e){ STATE.dbError = 'No se pudo borrar el movimiento de USDT: '+(e.message||e); }
    render(); return;
  }
  if(action==='save-usdt'){
    var vU = getUsdtFormValues();
    STATE.usdtDraft = vU;
    if(!vU.fecha || !vU.cantidad || parseFloat(vU.cantidad)<=0){
      STATE.usdtFormMsg = 'Completá al menos: fecha y cantidad de USDT (mayor a 0).';
      render(); return;
    }
    var esVentaU = vU.tipo === 'venta';
    if(esVentaU && (!vU.montoArs || parseFloat(vU.montoArs)<=0 || !vU.centroId || !vU.categoriaId)){
      STATE.usdtFormMsg = 'Para una venta completá también: monto en pesos recibido, Centro de Costo y Categoría.';
      render(); return;
    }
    STATE.usdtFormMsg = null; STATE.dbError = null;
    var cantidadU = Math.abs(parseFloat(vU.cantidad))||0;
    var montoArsU = Math.abs(parseFloat(vU.montoArs))||0;
    var cotizacionU = (cantidadU && montoArsU) ? montoArsU/cantidadU : 0;
    var detalleMovVinculado = (vU.detalle?vU.detalle+' — ':'')+'Venta '+fmtCantidadUsdt(cantidadU)+' USDT (cotización $'+fmtMonto(cotizacionU)+')';

    try{
      if(id){
        var existenteU = STATE.usdtMovimientos.find(function(x){return x.id===id;});
        var movimientoIdPrevio = existenteU ? existenteU.movimientoId : '';
        var movimientoIdFinal = movimientoIdPrevio;

        if(esVentaU){
          var datosMovU = {
            fecha: vU.fecha, centroId: vU.centroId, categoriaId: vU.categoriaId, subcategoriaId: vU.subcategoriaId,
            proveedor: 'Venta USDT', detalle: detalleMovVinculado, ingreso: montoArsU, egreso: 0, tarjeta:false
          };
          if(movimientoIdPrevio){
            await dbUpdate('movimientos', movimientoIdPrevio, toDbMovimiento(Object.assign({id:movimientoIdPrevio}, datosMovU)));
            var movAActualizar = STATE.movimientos.find(function(m){return m.id===movimientoIdPrevio;});
            if(movAActualizar) Object.assign(movAActualizar, datosMovU);
          } else {
            movimientoIdFinal = uid();
            var movNuevoDesdeEdicion = Object.assign({id:movimientoIdFinal}, datosMovU);
            await dbInsert('movimientos', toDbMovimiento(movNuevoDesdeEdicion));
            STATE.movimientos.push(movNuevoDesdeEdicion);
          }
        } else if(movimientoIdPrevio){
          // Pasó de venta a ingreso: ya no corresponde el movimiento en pesos que tenía vinculado.
          await dbDelete('movimientos', movimientoIdPrevio);
          STATE.movimientos = STATE.movimientos.filter(function(m){return m.id!==movimientoIdPrevio;});
          movimientoIdFinal = '';
        }

        var usdtActualizado = {
          id:id, tipo:vU.tipo, fecha:vU.fecha, cantidad:cantidadU, detalle:vU.detalle,
          montoArs:montoArsU, cotizacion:cotizacionU,
          centroId: esVentaU?vU.centroId:'', categoriaId: vU.categoriaId, subcategoriaId: vU.subcategoriaId,
          movimientoId: movimientoIdFinal
        };
        await dbUpdate('usdt_movimientos', id, toDbUsdt(usdtActualizado));
        var idxU = STATE.usdtMovimientos.findIndex(function(x){return x.id===id;});
        if(idxU>-1) STATE.usdtMovimientos[idxU] = usdtActualizado;
        STATE.saldosDirty = true;
      } else {
        var movimientoIdNuevo = '';
        if(esVentaU){
          movimientoIdNuevo = uid();
          var movNuevoU = {
            id: movimientoIdNuevo, fecha: vU.fecha, centroId: vU.centroId, categoriaId: vU.categoriaId, subcategoriaId: vU.subcategoriaId,
            proveedor: 'Venta USDT', detalle: detalleMovVinculado, ingreso: montoArsU, egreso: 0, tarjeta:false
          };
          await dbInsert('movimientos', toDbMovimiento(movNuevoU));
          STATE.movimientos.push(movNuevoU);
        }
        var usdtNuevo = {
          id: uid(), tipo: vU.tipo, fecha: vU.fecha, cantidad: cantidadU, detalle: vU.detalle,
          montoArs: montoArsU, cotizacion: cotizacionU,
          centroId: esVentaU?vU.centroId:'', categoriaId: vU.categoriaId, subcategoriaId: vU.subcategoriaId,
          movimientoId: movimientoIdNuevo
        };
        await dbInsert('usdt_movimientos', toDbUsdt(usdtNuevo));
        STATE.usdtMovimientos.push(usdtNuevo);
        STATE.saldosDirty = true;
      }
      STATE.editing = null;
      STATE.usdtDraft = null;
      STATE.usdtIngresoOpcionalesAbierto = false;
    }catch(e){ STATE.dbError = 'No se pudo guardar el movimiento de USDT: '+(e.message||e); }
    render(); return;
  }

  // ---- USDT desde un movimiento existente en la categoría de Venta de USDT ----
  if(action==='abrir-usdt-venta-mov'){
    STATE.usdtVentaMovId = id;
    STATE.usdtVentaMovMsg = null;
    STATE.usdtVentaMovCantidad = '';
    render(); return;
  }
  if(action==='cerrar-usdt-venta-mov'){
    STATE.usdtVentaMovId = null;
    STATE.usdtVentaMovMsg = null;
    STATE.usdtVentaMovCantidad = '';
    render(); return;
  }
  if(action==='guardar-usdt-venta-mov'){
    var mUvmG = STATE.movimientos.find(function(x){ return x.id===STATE.usdtVentaMovId; });
    if(!mUvmG){ STATE.usdtVentaMovId = null; render(); return; }
    var cantidadUvmInput = document.getElementById('uvm-cantidad').value;
    var cantidadUvmG = Math.abs(parseCantidadDecimal(cantidadUvmInput))||0;
    if(!cantidadUvmG || cantidadUvmG<=0){
      STATE.usdtVentaMovCantidad = cantidadUvmInput;
      STATE.usdtVentaMovMsg = 'Ingresá una cantidad de USDT mayor a 0.';
      render(); return;
    }
    STATE.usdtVentaMovMsg = null; STATE.dbError = null;
    var montoArsUvm = Number(mUvmG.ingreso)||0;
    var nuevoUsdtUvm = {
      id: uid(), tipo:'venta', fecha: mUvmG.fecha, cantidad: cantidadUvmG, detalle: mUvmG.detalle||'',
      montoArs: montoArsUvm, cotizacion: montoArsUvm/cantidadUvmG,
      centroId: mUvmG.centroId||'', categoriaId: mUvmG.categoriaId||'', subcategoriaId: mUvmG.subcategoriaId||'',
      movimientoId: mUvmG.id
    };
    try{
      await dbInsert('usdt_movimientos', toDbUsdt(nuevoUsdtUvm));
      STATE.usdtMovimientos.push(nuevoUsdtUvm);
      STATE.usdtVentaMovId = null;
      STATE.usdtVentaMovCantidad = '';
    }catch(e){
      STATE.usdtVentaMovCantidad = cantidadUvmInput;
      STATE.dbError = 'No se pudo generar el movimiento de USDT: '+(e.message||e);
    }
    render(); return;
  }
}

document.getElementById('btnLogin').addEventListener('click', intentarLogin);
document.getElementById('login-password').addEventListener('keydown', function(ev){ if(ev.key==='Enter') intentarLogin(); });
// Ojito del login: muestra u oculta la contraseña que se está escribiendo (sin perder el foco ni el cursor).
document.getElementById('btnVerPassword').addEventListener('click', function(){
  var input = document.getElementById('login-password');
  var mostrar = input.type === 'password';
  input.type = mostrar ? 'text' : 'password';
  this.innerHTML = '<i class="bi '+(mostrar ? 'bi-eye-slash' : 'bi-eye')+'"></i>';
  this.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
  this.setAttribute('title', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
  input.focus();
});
initAuth();

// Cerrar cualquier filtro multiselect abierto al hacer clic fuera de él (listener único, no se repite en cada render).
// No filtra por el id puntual abierto: alcanza con que el clic haya sido dentro de CUALQUIER multiselect
// (el propio toggle, un checkbox o "Limpiar" ya actualizan STATE.multiSelectAbierto en su propio handler).
document.addEventListener('click', function(ev){
  if(!STATE.multiSelectAbierto) return;
  if(ev.target.closest && ev.target.closest('[data-multiselect-wrap]')) return;
  STATE.multiSelectAbierto = null;
  STATE.multiSelectBusqueda = '';
  render();
});

// Cerrar el menú de usuario (avatar) al hacer clic fuera de él, mismo patrón que el multiselect de arriba.
document.addEventListener('click', function(ev){
  if(!STATE.menuUsuarioAbierto) return;
  if(ev.target.closest && ev.target.closest('[data-user-menu-wrap]')) return;
  STATE.menuUsuarioAbierto = false;
  render();
});

// Re-renderizar al cruzar el breakpoint mobile (esVistaMobile() se recalcula recién en el próximo
// render): así, si se rota el celular o se agranda/achica la ventana, el colapso de Filtros en
// Movimientos y el armado de "Mes actual" en la Comparativa mensual se actualizan solos.
var resizeTimeoutId = null;
window.addEventListener('resize', function(){
  clearTimeout(resizeTimeoutId);
  resizeTimeoutId = setTimeout(function(){ if(STATE.ready) render(); }, 150);
});
