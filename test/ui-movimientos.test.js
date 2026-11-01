import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

// Completa los campos del formulario de "Nuevo movimiento" / "Editar movimiento" directo por id,
// tal como quedan una vez que el usuario los tipeó o eligió en el combo (los combos de
// Centro/Categoría/Subcategoría guardan el id elegido en un <input type="hidden">, ver renderCombo()).
function llenarFormMov(win, valores) {
  const setVal = (id, v) => { const el = win.document.getElementById(id); if (el) el.value = v ?? ''; };
  setVal('f-mov-fecha', valores.fecha);
  setVal('f-mov-centro', valores.centroId);
  setVal('f-mov-categoria', valores.categoriaId);
  setVal('f-mov-subcategoria', valores.subcategoriaId);
  setVal('f-mov-proveedor', valores.proveedor);
  setVal('f-mov-detalle', valores.detalle);
  if (valores.tipo) { const t = win.document.getElementById('f-mov-tipo'); if (t) t.value = valores.tipo; }
  setVal('f-mov-monto', valores.monto);
  if (valores.tarjeta) win.document.getElementById('f-mov-tarjeta').checked = true;
  if (valores.cuotas != null) setVal('f-mov-cuotas', String(valores.cuotas));
  if (valores.centroDestinoId != null) setVal('f-mov-centro-destino', valores.centroDestinoId);
}

describe('Movimientos: alta, edición y borrado', () => {
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.activeTab = 'movimientos';
    win.handleAction('abrir-nuevo-mov');
  });

  it('valida campos obligatorios y no inserta nada si faltan', async () => {
    llenarFormMov(win, { fecha: '2026-07-10', proveedor: 'Coto' }); // sin centro/categoría/monto
    await win.handleAction('save-mov');
    expect(win.STATE.movFieldErrors.centroId).toBeTruthy();
    expect(win.STATE.movFieldErrors.categoriaId).toBeTruthy();
    expect(win.STATE.movFieldErrors.monto).toBeTruthy();
    expect(sbMock.calls.length).toBe(0);
    expect(win.STATE.nuevoMovAbierto).toBe(true); // el modal sigue abierto
  });

  it('rechaza una fecha con año de 5 dígitos (no la toma como fecha futura)', async () => {
    llenarFormMov(win, {
      fecha: '20226-07-29', centroId: 'c-ef', categoriaId: 'cat-super',
      proveedor: 'Intereses', tipo: 'ingreso', monto: '132.4'
    });
    // jsdom (como algunos navegadores) puede sanear el valor del input date; se fuerza el valor
    // crudo para probar la validación propia del formulario.
    Object.defineProperty(win.document.getElementById('f-mov-fecha'), 'value', { value: '20226-07-29', configurable: true });
    await win.handleAction('save-mov');
    expect(win.STATE.movFieldErrors.fecha).toBeTruthy();
    expect(sbMock.calls.length).toBe(0);
  });

  it('conserva Proveedor/Detalle tipeados si falla la validación (no los pisa el re-render)', async () => {
    llenarFormMov(win, { fecha: '2026-07-10', proveedor: 'Coto', detalle: 'Compra semanal' }); // falta centro/categoría/monto
    await win.handleAction('save-mov');
    expect(win.document.getElementById('f-mov-proveedor').value).toBe('Coto');
    expect(win.document.getElementById('f-mov-detalle').value).toBe('Compra semanal');
  });

  it('da de alta un egreso simple y lo persiste via sb.insert', async () => {
    llenarFormMov(win, {
      fecha: '2026-07-10', centroId: 'c-ef', categoriaId: 'cat-super', subcategoriaId: 'sub-verd',
      proveedor: 'Verduleria Don Pepe', detalle: 'Verdura semanal', tipo: 'egreso', monto: '3500'
    });
    await win.handleAction('save-mov');
    expect(win.STATE.movFormMsg).toBeNull();
    expect(win.STATE.nuevoMovAbierto).toBe(false);
    expect(win.STATE.movimientos).toHaveLength(1);
    const m = win.STATE.movimientos[0];
    expect(m.proveedor).toBe('Verduleria Don Pepe');
    expect(m.egreso).toBe(3500);
    expect(m.ingreso).toBe(0);
    // Nota: los arrays que arma app.js viven en el realm de la ventana jsdom, no en el de este
    // proceso Node -- `expect.any(Array)` falla por el chequeo `instanceof` entre realms distintos,
    // así que se compara por longitud en vez de por tipo.
    expect(sbMock.calls).toHaveLength(1);
    expect(sbMock.calls[0].op).toBe('insert');
    expect(sbMock.calls[0].table).toBe('movimientos');
    expect(sbMock.calls[0].rows).toHaveLength(1);
  });

  it('categoría TEC con Centro Destino crea el movimiento y su espejo (signo contrario) en un solo insert', async () => {
    // El campo "Centro de Costo Destino" solo aparece en el DOM cuando la Categoría elegida es
    // de tipo TEC (ver esTec en camposMov()) — hay que re-renderizar con esa categoría puesta
    // antes de poder completarlo, igual que pasa en el navegador tras elegirla en el combo.
    win.STATE.movDraft = Object.assign({ fecha:'', centroId:'', categoriaId:'cat-tec', subcategoriaId:'', proveedor:'', detalle:'', tipo:'egreso', monto:'', tarjeta:false, fechaConsumo:'', tarjetaMarca:'', cuotas:1 });
    win.render();
    llenarFormMov(win, {
      fecha: '2026-07-10', centroId: 'c-ef', categoriaId: 'cat-tec',
      proveedor: 'Transferencia', tipo: 'egreso', monto: '10000', centroDestinoId: 'c-ea'
    });
    await win.handleAction('save-mov');
    expect(win.STATE.movimientos).toHaveLength(2);
    const origen = win.STATE.movimientos.find(m => m.centroId === 'c-ef');
    const espejo = win.STATE.movimientos.find(m => m.centroId === 'c-ea');
    expect(origen.egreso).toBe(10000);
    expect(espejo.ingreso).toBe(10000);
    expect(espejo.detalle).toMatch(/transferencia automática/i);
    expect(sbMock.calls).toHaveLength(1); // un solo insert con las 2 filas, no dos viajes separados
    expect(sbMock.calls[0].rows).toHaveLength(2);
  });

  it('rechaza Centro Destino igual al de origen en un movimiento TEC', async () => {
    win.STATE.movDraft = Object.assign({ fecha:'', centroId:'', categoriaId:'cat-tec', subcategoriaId:'', proveedor:'', detalle:'', tipo:'egreso', monto:'', tarjeta:false, fechaConsumo:'', tarjetaMarca:'', cuotas:1 });
    win.render();
    llenarFormMov(win, {
      fecha: '2026-07-10', centroId: 'c-ef', categoriaId: 'cat-tec',
      proveedor: 'Transferencia', tipo: 'egreso', monto: '10000', centroDestinoId: 'c-ef'
    });
    await win.handleAction('save-mov');
    expect(win.STATE.movFormMsg).toMatch(/distinto al de origen/i);
    expect(win.STATE.movimientos).toHaveLength(0);
  });

  it('tarjeta con cuotas crea un movimiento por cuota, uno por mes, mismo monto cada uno', async () => {
    llenarFormMov(win, {
      fecha: '2026-01-15', centroId: 'c-ef', categoriaId: 'cat-super',
      proveedor: 'Electro SA', detalle: 'Heladera', tipo: 'egreso', monto: '90000'
    });
    // El campo "Cantidad de cuotas" solo aparece al tildar la tarjeta (ver campoCuotas en camposMov()),
    // igual que en el navegador real: disparamos el mismo 'change' que dispara el tilde del checkbox.
    win.document.getElementById('f-mov-tarjeta').checked = true;
    win.document.getElementById('f-mov-tarjeta').dispatchEvent(new win.Event('change', { bubbles: true }));
    win.document.getElementById('f-mov-cuotas').value = '3';
    await win.handleAction('save-mov');
    expect(win.STATE.movimientos).toHaveLength(3);
    const fechas = win.STATE.movimientos.map(m => m.fecha).sort();
    expect(fechas).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
    win.STATE.movimientos.forEach(m => expect(m.egreso).toBe(90000));
    const ordenados = win.STATE.movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha));
    // El Detalle no se toca: la cuota queda en su propio campo, no como sufijo de texto.
    expect(ordenados.map(m => m.detalle)).toEqual(['Heladera', 'Heladera', 'Heladera']);
    expect(ordenados.map(m => m.cuotas)).toEqual(['1/3', '2/3', '3/3']);
  });

  it('permite guardar un movimiento a fecha futura sin Centro de Costo', async () => {
    llenarFormMov(win, {
      fecha: '2099-01-01', categoriaId: 'cat-super', proveedor: 'Alquiler', tipo: 'egreso', monto: '1000'
    });
    await win.handleAction('save-mov');
    expect(win.STATE.movFormMsg).toBeNull();
    expect(win.STATE.movimientos).toHaveLength(1);
  });

  it('edita un movimiento existente (precarga sus valores y hace update, no insert)', async () => {
    win.STATE.movimientos = [{
      id: 'm1', fecha: '2026-05-01', centroId: 'c-ef', categoriaId: 'cat-super', subcategoriaId: 'sub-verd',
      proveedor: 'Viejo proveedor', detalle: '', ingreso: 0, egreso: 500, tarjeta: false, fechaConsumo: '', tarjetaMarca: ''
    }];
    win.STATE.nuevoMovAbierto = false;
    win.handleAction('edit-mov', 'm1');
    expect(win.document.getElementById('f-mov-proveedor').value).toBe('Viejo proveedor');
    expect(win.document.getElementById('f-mov-monto').value).toBe('500');

    llenarFormMov(win, {
      fecha: '2026-05-01', centroId: 'c-ef', categoriaId: 'cat-super', subcategoriaId: 'sub-verd',
      proveedor: 'Proveedor corregido', detalle: '', tipo: 'egreso', monto: '600'
    });
    await win.handleAction('save-mov', 'm1');
    expect(win.STATE.movimientos[0].proveedor).toBe('Proveedor corregido');
    expect(win.STATE.movimientos[0].egreso).toBe(600);
    expect(sbMock.calls[0]).toMatchObject({ op: 'update', table: 'movimientos', val: 'm1' });
  });

  it('borrar movimiento: pide confirmación, "Cancelar" no borra y "Sí" borra y llama a sb.delete', async () => {
    win.STATE.movimientos = [{ id: 'm1', fecha: '2026-05-01', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'X', ingreso: 0, egreso: 100 }];
    win.STATE.nuevoMovAbierto = false;
    win.render();

    win.handleAction('del-mov', 'm1');
    expect(win.STATE.confirmState).toBeTruthy();
    win.handleAction('confirm-no');
    expect(win.STATE.movimientos).toHaveLength(1);

    win.handleAction('del-mov', 'm1');
    await win.handleAction('confirm-yes');
    expect(win.STATE.movimientos).toHaveLength(0);
    expect(sbMock.calls).toEqual([{ op: 'delete', table: 'movimientos', val: 'm1' }]);
  });
});

describe('Movimientos: filtros de la tabla', () => {
  let win;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    win.STATE.movimientos = [
      { id: 'm1', fecha: '2026-06-01', centroId: 'c-ef', categoriaId: 'cat-super', subcategoriaId: 'sub-verd', proveedor: 'Verduleria Don Pepe', detalle: '', ingreso: 0, egreso: 100 },
      { id: 'm2', fecha: '2026-07-01', centroId: 'c-ea', categoriaId: 'cat-suel', subcategoriaId: '', proveedor: 'Empleador SA', detalle: '', ingreso: 5000, egreso: 0 }
    ];
    win.STATE.activeTab = 'movimientos';
    win.render();
  });

  it('clic sobre una celda con data-filter-field filtra la tabla por ese valor', () => {
    const celda = win.document.querySelector('[data-filter-field="centro"][data-filter-value="c-ef"]');
    expect(celda).toBeTruthy();
    celda.dispatchEvent(new win.Event('click', { bubbles: true }));
    expect(win.STATE.filtros.centro).toEqual(['c-ef']);
    const filas = win.document.querySelectorAll('#tabla-movimientos tbody tr');
    expect(filas).toHaveLength(1);
  });

  it('"Limpiar filtros" resetea todos los filtros activos de una', () => {
    win.STATE.filtros.centro = ['c-ef'];
    win.STATE.filtros.texto = 'pepe';
    win.STATE.filtros.soloTarjeta = true;
    win.render();
    const btn = win.document.querySelector('[data-action="limpiar-filtros-mov"]');
    expect(btn).toBeTruthy();
    win.handleAction('limpiar-filtros-mov');
    expect(win.STATE.filtros).toMatchObject({ centro: [], categoria: [], subcategoria: [], mes: [], texto: '', soloIncompletos: false, soloTarjeta: false });
  });

  it('el botón "Limpiar filtros" no aparece si no hay filtros activos', () => {
    expect(win.document.querySelector('[data-action="limpiar-filtros-mov"]')).toBeNull();
  });
});

describe('Movimientos: paginación', () => {
  it('pagina de a 50 y "Siguiente" avanza de página', () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.movimientos = Array.from({ length: 60 }, (_, i) => ({
      id: 'm' + i, fecha: '2026-01-' + String((i % 28) + 1).padStart(2, '0'), centroId: 'c-ef',
      categoriaId: 'cat-super', proveedor: 'Proveedor ' + i, detalle: '', ingreso: 0, egreso: 10
    }));
    win.STATE.activeTab = 'movimientos';
    win.render();
    expect(win.document.querySelectorAll('#tabla-movimientos tbody tr')).toHaveLength(50);

    win.handleAction('mov-pagina-siguiente');
    expect(win.STATE.movPaginaActual).toBe(2);
    expect(win.document.querySelectorAll('#tabla-movimientos tbody tr')).toHaveLength(10);

    win.handleAction('mov-pagina-siguiente'); // no hay página 3: el render la clampea de vuelta a la última
    expect(win.STATE.movPaginaActual).toBe(2);
  });
});

describe('Movimientos: edición en línea', () => {
  it('cambiar el Centro de Costo en línea invalida el cache de Saldos', async () => {
    const win = loadApp();
    seedBase(win);
    const sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.movimientos = [{ id: 'm1', fecha: '2026-01-05', centroId: '', categoriaId: 'cat-super', subcategoriaId: '', proveedor: 'Super', detalle: '', ingreso: 0, egreso: 100 }];
    win.STATE.activeTab = 'movimientos';
    win.STATE.filtros = { centro: [], categoria: [], subcategoria: [], mes: [], texto: '', soloIncompletos: true, soloTarjeta: false };
    win.render();
    expect(win.calcularSaldos().saldoSinCentro).toBe(-100);
    win.obtenerSaldos(); // deja el cache armado
    expect(win.STATE.saldosDirty).toBe(false);

    const sel = win.document.querySelector('select[data-mov-id="m1"][data-field="centroId"]');
    sel.value = 'c-ef';
    sel.dispatchEvent(new win.Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 0));

    expect(win.STATE.saldosDirty).toBe(true);
    expect(win.obtenerSaldos().filas.find(f => f.id === 'c-ef').saldo).toBe(-100);
  });
});

describe('Movimientos: auditoría (A1)', () => {
  const abrirEdicion = async (mov) => {
    const win = loadApp();
    seedBase(win);
    win.STATE.movimientos = [Object.assign({ id: 'm1', fecha: '2026-10-30', centroId: 'c-ef', proveedor: 'Kiosco', ingreso: 0, egreso: 50 }, mov)];
    win.STATE.activeTab = 'movimientos';
    await win.handleAction('edit-mov', 'm1');
    return win.document.querySelector('.auditoria-mov');
  };

  it('al editar muestra quién lo cargó y cuándo', async () => {
    const d = new Date(2026, 9, 31, 17, 5);
    const linea = await abrirEdicion({ createdAt: d.toISOString(), creadoPor: 'u-ana' });
    expect(linea.textContent).toContain('Cargado por Ana el ' + d.toLocaleDateString('es-AR') + ' a las 17:05');
  });

  it('sin quién (anteriores a la auditoría) muestra solo cuándo; sin fecha no muestra nada', async () => {
    const linea = await abrirEdicion({ createdAt: new Date(2026, 9, 1, 9, 0).toISOString(), creadoPor: '' });
    expect(linea.textContent).toMatch(/^ ?Cargado el .* a las 09:00$/);
    expect(await abrirEdicion({})).toBe(null);
  });

  it('lee created_at y creado_por de la base', () => {
    const win = loadApp();
    const m = win.fromDbMovimiento({ id: 'm1', fecha: '2026-10-30', created_at: '2026-10-31T20:05:00Z', creado_por: 'u-ana' });
    expect(m.createdAt).toBe('2026-10-31T20:05:00Z');
    expect(m.creadoPor).toBe('u-ana');
  });
});
