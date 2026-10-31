import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase, catalogoTodoPrendido } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

// Catálogo en el formato de la base (snake_case), para cargarlo con cargarTodo().
const CATALOGO_DB = catalogoTodoPrendido().map(c => ({
  clave: c.clave, tipo: c.tipo, descripcion: c.descripcion, valor_default: c.clave.startsWith('feature.') ? 'false' : '0',
  grupo: c.grupo, orden: c.orden
}));
const tabsVisibles = win => [...win.document.querySelectorAll('[data-tab]')].map(t => t.getAttribute('data-tab'));
// Prende solo las funciones indicadas (el resto queda con el default: apagadas)
const prender = (...funciones) => funciones.map(f => ({ clave: 'feature.' + f, valor: 'true' }));

describe('Funciones opcionales: por defecto apagadas', () => {
  it('sin nada configurado, la familia ve solo la base común', () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.configCatalogo = [];
    win.render();
    expect(tabsVisibles(win)).toEqual(['resumen', 'movimientos', 'vencimientos', 'saldos', 'importar', 'abm']);
    for (const f of ['usdt', 'dolares', 'flujo_caja', 'facturacion_arca', 'tarjetas']) expect(win.funcionActiva(f)).toBe(false);
  });

  it('cada función prendida suma su pestaña', () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.configCatalogo = [];
    win.STATE.configuracion = prender('usdt', 'flujo_caja');
    win.render();
    expect(tabsVisibles(win)).toEqual(['resumen', 'movimientos', 'vencimientos', 'saldos', 'flujo', 'usdt', 'importar', 'abm']);
  });

  it('si la pestaña abierta es de una función apagada, vuelve a Resumen', () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.configCatalogo = [];
    win.STATE.activeTab = 'dolares';
    win.render();
    expect(win.STATE.activeTab).toBe('resumen');
  });
});

describe('Funciones opcionales: no se cargan los datos de las apagadas', () => {
  const tablas = {
    config_catalogo: CATALOGO_DB,
    movimientos: [{ id: 'm1', fecha: '2026-10-01', moneda: 'ARS', egreso: 10 }, { id: 'm2', fecha: '2026-10-01', moneda: 'USD', egreso: 5 }],
    usdt_movimientos: [{ id: 'u1', tipo: 'ingreso', cantidad: 1 }],
    deudas: [{ id: 'd1', concepto: 'Auto' }],
    facturas: [{ id: 'f1', estado: 'emitida' }]
  };

  it('todo apagado: no pide usdt_movimientos, deudas ni facturas, y no muestra movimientos en USD', async () => {
    const win = loadApp();
    const sbMock = mockSb(Object.assign({ familia_config: [] }, tablas));
    win.sb = sbMock.client;
    await win.cargarTodo();
    const pedidas = sbMock.selects.map(s => s.table);
    for (const t of ['usdt_movimientos', 'deudas', 'facturas']) expect(pedidas).not.toContain(t);
    expect(win.STATE.movimientos.map(m => m.id)).toEqual(['m1']);
    expect(win.STATE.movimientosUsd).toEqual([]);
    expect(win.STATE.usdtMovimientos).toEqual([]);
  });

  it('todo prendido: carga todo', async () => {
    const win = loadApp();
    const sbMock = mockSb(Object.assign({
      familia_config: ['usdt', 'dolares', 'flujo_caja', 'facturacion_arca', 'tarjetas'].map(f => ({ clave: 'feature.' + f, valor: 'true' }))
    }, tablas));
    win.sb = sbMock.client;
    await win.cargarTodo();
    expect(win.STATE.movimientosUsd.map(m => m.id)).toEqual(['m2']);
    expect(win.STATE.usdtMovimientos).toHaveLength(1);
    expect(win.STATE.deudas).toHaveLength(1);
    expect(win.STATE.facturas).toHaveLength(1);
  });

  it('Facturación sin USDT no carga facturas (depende de USDT)', async () => {
    const win = loadApp();
    const sbMock = mockSb(Object.assign({ familia_config: [{ clave: 'feature.facturacion_arca', valor: 'true' }] }, tablas));
    win.sb = sbMock.client;
    await win.cargarTodo();
    expect(win.funcionActiva('facturacion_arca')).toBe(false);
    expect(sbMock.selects.map(s => s.table)).not.toContain('facturas');
  });
});

describe('Funciones opcionales: Tarjetas apagada', () => {
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    win.STATE.configCatalogo = [];
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.movimientos = [
      { id: 't1', fecha: '2026-10-10', centroId: 'c-ef', categoriaId: 'cat-super', subcategoriaId: '', proveedor: 'Super', detalle: '', ingreso: 0, egreso: 100, tarjeta: true, tarjetaMarca: 'Visa', cuotas: '2/6', moneda: 'ARS' },
      { id: 't2', fecha: '2026-10-10', centroId: 'c-ef', categoriaId: 'cat-super', subcategoriaId: '', proveedor: 'Kiosco', detalle: '', ingreso: 0, egreso: 50, tarjeta: true, tarjetaMarca: 'Visa', cuotas: '', moneda: 'ARS' }
    ];
  });

  it('los movimientos con tarjeta se ven sueltos, sin agrupar por resumen ni filtro "Solo tarjeta"', () => {
    win.STATE.activeTab = 'movimientos';
    win.STATE.filtros.mes = [];
    win.render();
    expect(win.document.querySelector('.fila-grupo-tarjeta')).toBe(null);
    expect(win.document.getElementById('ff-solo-tarjeta')).toBe(null);
    expect(win.document.getElementById('app').textContent).toContain('Kiosco');
  });

  it('el formulario no muestra los campos de tarjeta, y editar un movimiento de tarjeta los conserva', async () => {
    win.STATE.activeTab = 'movimientos';
    await win.handleAction('edit-mov', 't1');
    expect(win.document.getElementById('f-mov-tarjeta')).toBe(null);
    expect(win.document.getElementById('f-mov-tarjeta-marca')).toBe(null);
    win.document.getElementById('f-mov-detalle').value = 'editado';
    await win.handleAction('save-mov', 't1');
    const update = sbMock.calls.find(c => c.op === 'update');
    expect(update.fields).toMatchObject({ detalle: 'editado', tarjeta: true, tarjeta_marca: 'Visa', cuotas: '2/6' });
  });

  it('Importar no ofrece "Tarjeta de Crédito"', () => {
    win.STATE.activeTab = 'importar';
    win.STATE.importEntidad = 'tarjeta';
    win.render();
    const opciones = [...win.document.querySelectorAll('#imp-entidad option')].map(o => o.value);
    expect(opciones).not.toContain('tarjeta');
    expect(win.STATE.importEntidad).toBe('mp');
  });
});

describe('Funciones opcionales: Dólares apagada', () => {
  it('el ABM de centros no muestra la moneda, pero editar un centro en dólares la conserva', async () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.configCatalogo = [];
    const sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.centros.push({ id: 'c-usd', codigo: 'USD', nombre: 'Caja dólares', moneda: 'USD' });
    win.STATE.activeTab = 'abm';
    win.STATE.abmSubTab = 'centros';
    win.render();
    expect(win.document.getElementById('app').textContent).not.toContain('Moneda');
    await win.handleAction('edit-centro', 'c-usd');
    win.document.getElementById('f-centro-nombre').value = 'Caja dólares (renombrada)';
    await win.handleAction('save-centro', 'c-usd');
    expect(sbMock.calls.find(c => c.op === 'update').fields.moneda).toBe('USD');
  });
});

describe('Regla del sueldo de fin de mes (sueldo_dias_mes_siguiente)', () => {
  let win;
  beforeEach(() => { win = loadApp(); win.STATE.configCatalogo = []; });

  it('apagada (0 o vacío): el sueldo cuenta en el mes de su fecha', () => {
    expect(win.mesEfectivoSueldo('2026-10-29')).toBe('2026-10');
    win.STATE.configuracion = [{ clave: 'sueldo_dias_mes_siguiente', valor: '0' }];
    expect(win.mesEfectivoSueldo('2026-10-31')).toBe('2026-10');
  });

  it('con N días: los últimos N días del mes cuentan para el mes siguiente', () => {
    win.STATE.configuracion = [{ clave: 'sueldo_dias_mes_siguiente', valor: '3' }];
    expect(win.mesEfectivoSueldo('2026-10-28')).toBe('2026-10');
    expect(win.mesEfectivoSueldo('2026-10-29')).toBe('2026-11');
    expect(win.mesEfectivoSueldo('2026-12-30')).toBe('2027-01');
    win.STATE.configuracion = [{ clave: 'sueldo_dias_mes_siguiente', valor: '5' }];
    expect(win.mesEfectivoSueldo('2026-10-27')).toBe('2026-11');
  });
});

describe('Facturación ARCA: faltan datos del emisor (D8)', () => {
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.categorias.push({ id: 'cat-vu', nombre: 'Venta USDT', tipo: 'venta_usdt' });
    win.STATE.movimientos = [{ id: 'mv', fecha: '2026-10-01', centroId: 'c-ef', categoriaId: 'cat-vu', ingreso: 50000, egreso: 0, moneda: 'ARS' }];
    win.STATE.facturas = [];
  });

  it('sin CUIT o razón social, Facturar avisa que el soporte tiene que cargarlos y no intenta facturar', async () => {
    win.STATE.configuracion = [{ clave: 'arca_cuit', valor: '20111111112' }];
    await win.handleAction('facturar-mov', 'mv');
    expect(win.STATE.confirmState).toBe(null);
    expect(win.STATE.dbError).toContain('el soporte tiene que cargar tus datos de facturación');
    expect(sbMock.calls).toHaveLength(0);
  });

  it('con los dos datos, pide confirmación para facturar', async () => {
    win.STATE.configuracion = [{ clave: 'arca_cuit', valor: '20111111112' }, { clave: 'arca_razon_social', valor: 'Demo SA' }];
    await win.handleAction('facturar-mov', 'mv');
    expect(win.STATE.confirmState.action).toBe('facturar-mov-do');
  });

  it('el superadmin ve el aviso en la configuración de la familia', async () => {
    const sbAdmin = mockSb(
      { superadmins: [{ user_id: 's1' }], familias: [{ id: 'fa', nombre: 'Familia A' }], config_catalogo: CATALOGO_DB,
        familia_config: [{ familia_id: 'fa', clave: 'feature.facturacion_arca', valor: 'true' }] },
      { admin_miembros: { data: [], error: null } }
    );
    win.sb = sbAdmin.client;
    await win.cargarPerfil();
    await win.cargarTodo();
    win.STATE.activeTab = 'admin';
    win.render();
    expect(win.document.getElementById('app').textContent).toContain('Facturación ARCA está prendida pero USDT no');
  });
});
