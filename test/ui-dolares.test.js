import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase, totalDeGrupo } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

// Módulo Dólares: los movimientos en USD van a la misma tabla "movimientos" (moneda 'USD') pero
// viven en STATE.movimientosUsd, así ningún informe en pesos los suma. Una compra/venta son dos
// movimientos unidos por cambio_id: el de USD y el de pesos (que sí cuenta en Saldos).
function seedDolares(win) {
  seedBase(win);
  win.STATE.centros.find(c => c.id === 'c-ef').moneda = 'AMBAS'; // Franco: misma cuenta, pesos y dólares
  win.STATE.centros.push({ id: 'c-da', codigo: 'DA', nombre: 'Dólares Ana', moneda: 'USD', titularId: 'u-ana' }); // Ana: CC solo en USD
  win.STATE.categorias.push({ id: 'cat-inv', nombre: 'Ahorro', tipo: 'inversion' });
  win.STATE.movimientosUsd = [];
}
function setVal(win, id, value) { win.document.getElementById(id).value = value; }

describe('Dólares', () => {
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    seedDolares(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.activeTab = 'dolares';
    win.render();
  });

  it('una compra crea el movimiento en USD y el egreso en pesos vinculado', async () => {
    setVal(win, 'f-usd-fecha', '2026-10-01');
    setVal(win, 'f-usd-cantidad', '100');
    setVal(win, 'f-usd-centro', 'c-da');
    setVal(win, 'f-usd-monto-ars', '130000');
    setVal(win, 'f-usd-centro-ars', 'c-ef');
    setVal(win, 'f-usd-categoria', 'cat-inv');
    await win.handleAction('save-dolares', '');

    expect(win.STATE.dolaresFormMsg).toBeNull();
    expect(win.STATE.movimientosUsd).toHaveLength(1);
    const usd = win.STATE.movimientosUsd[0];
    expect(usd).toMatchObject({ moneda: 'USD', centroId: 'c-da', ingreso: 100, egreso: 0 });
    expect(win.STATE.movimientos).toHaveLength(1);
    const ars = win.STATE.movimientos[0];
    expect(ars).toMatchObject({ moneda: 'ARS', centroId: 'c-ef', egreso: 130000, cambioId: usd.cambioId });
    expect(usd.cambioId).toBeTruthy();

    const inserts = sbMock.calls.filter(c => c.op === 'insert');
    expect(inserts.map(c => c.rows.moneda)).toEqual(['USD', undefined]);

    expect(totalDeGrupo(win.calcularSaldosUsd(), 'Ana')).toBe(100);
    expect(totalDeGrupo(win.calcularSaldos(), 'Franco')).toBe(-130000); // los pesos sí salen del CC en pesos
  });

  it('pide pesos, CC en pesos y categoría para una compra', async () => {
    setVal(win, 'f-usd-fecha', '2026-10-01');
    setVal(win, 'f-usd-cantidad', '100');
    setVal(win, 'f-usd-centro', 'c-da');
    await win.handleAction('save-dolares', '');
    expect(win.STATE.dolaresFormMsg).toMatch(/pesos/);
    expect(sbMock.calls).toHaveLength(0);
  });

  it('un gasto en dólares no crea nada en pesos', async () => {
    setVal(win, 'f-usd-tipo', 'egreso');
    win.STATE.dolaresDraft = Object.assign(win.getDolaresFormValues(), { tipo: 'egreso' });
    win.render();
    setVal(win, 'f-usd-fecha', '2026-10-02');
    setVal(win, 'f-usd-cantidad', '20');
    setVal(win, 'f-usd-centro', 'c-ef');
    await win.handleAction('save-dolares', '');
    expect(win.STATE.movimientosUsd[0]).toMatchObject({ egreso: 20, cambioId: '' });
    expect(win.STATE.movimientos).toHaveLength(0);
    expect(totalDeGrupo(win.calcularSaldosUsd(), 'Franco')).toBe(-20);
  });

  it('una TEC en dólares con CC destino crea el espejo en USD, sin nada en pesos', async () => {
    win.STATE.dolaresDraft = { tipo: 'egreso', fecha: '2026-10-03', cantidad: '50', centroId: 'c-ef', montoArs: '', centroArsId: '', categoriaId: 'cat-tec', subcategoriaId: '', detalle: '', centroDestinoId: '' };
    win.render();
    expect(win.document.getElementById('f-usd-centro-destino')).toBeTruthy();
    setVal(win, 'f-usd-centro-destino', 'c-da');
    await win.handleAction('save-dolares', '');

    expect(win.STATE.dolaresFormMsg).toBeNull();
    expect(win.STATE.movimientosUsd).toHaveLength(2);
    expect(win.STATE.movimientosUsd[1]).toMatchObject({ centroId: 'c-da', ingreso: 50, egreso: 0, categoriaId: 'cat-tec', moneda: 'USD' });
    expect(win.STATE.movimientos).toHaveLength(0);
    expect(totalDeGrupo(win.calcularSaldosUsd(), 'Franco')).toBe(-50);
    expect(totalDeGrupo(win.calcularSaldosUsd(), 'Ana')).toBe(50);
  });

  it('el tipo Transferencia entre cuentas crea gasto en origen e ingreso en destino con la categoría TEC', async () => {
    win.STATE.dolaresDraft = { tipo: 'transferencia', fecha: '2026-10-04', cantidad: '30', centroId: 'c-ef', montoArs: '', centroArsId: '', categoriaId: '', subcategoriaId: '', detalle: '', centroDestinoId: '' };
    win.render();
    expect(win.document.getElementById('f-usd-categoria')).toBeNull();
    await win.handleAction('save-dolares', '');
    expect(win.STATE.dolaresFormMsg).toMatch(/destino/);
    expect(sbMock.calls).toHaveLength(0);

    setVal(win, 'f-usd-centro-destino', 'c-da');
    await win.handleAction('save-dolares', '');
    expect(win.STATE.dolaresFormMsg).toBeNull();
    expect(win.STATE.movimientosUsd).toEqual([
      expect.objectContaining({ centroId: 'c-ef', egreso: 30, ingreso: 0, categoriaId: 'cat-tec' }),
      expect.objectContaining({ centroId: 'c-da', ingreso: 30, egreso: 0, categoriaId: 'cat-tec' })
    ]);
    expect(win.STATE.movimientos).toHaveLength(0);
  });

  it('editar una compra a ingreso borra la contraparte en pesos y limpia cambio_id', async () => {
    win.STATE.movimientosUsd = [{ id: 'u1', fecha: '2026-10-01', centroId: 'c-da', categoriaId: 'cat-inv', subcategoriaId: '', proveedor: 'Compra USD', detalle: '', ingreso: 100, egreso: 0, moneda: 'USD', cambioId: 'k1' }];
    win.STATE.movimientos = [{ id: 'a1', fecha: '2026-10-01', centroId: 'c-ef', categoriaId: 'cat-inv', subcategoriaId: '', proveedor: 'Compra USD', detalle: '', ingreso: 0, egreso: 130000, moneda: 'ARS', cambioId: 'k1' }];
    await win.handleAction('edit-dolares', 'u1');
    expect(win.document.getElementById('f-usd-monto-ars').value).toBe('130000');
    win.STATE.dolaresDraft = Object.assign(win.getDolaresFormValues(), { tipo: 'ingreso' });
    win.render();
    await win.handleAction('save-dolares', 'u1');

    expect(win.STATE.movimientos).toHaveLength(0);
    expect(win.STATE.movimientosUsd[0].cambioId).toBe('');
    const upd = sbMock.calls.find(c => c.op === 'update' && c.val === 'u1');
    expect(upd.fields.cambio_id).toBeNull();
    expect(sbMock.calls).toContainEqual(expect.objectContaining({ op: 'delete', val: 'a1' }));
  });

  it('borrar una compra borra también el movimiento en pesos', async () => {
    win.STATE.movimientosUsd = [{ id: 'u1', fecha: '2026-10-01', centroId: 'c-da', ingreso: 100, egreso: 0, moneda: 'USD', cambioId: 'k1' }];
    win.STATE.movimientos = [{ id: 'a1', fecha: '2026-10-01', centroId: 'c-ef', ingreso: 0, egreso: 130000, moneda: 'ARS', cambioId: 'k1' }];
    await win.handleAction('del-dolares', 'u1');
    expect(win.STATE.confirmState.message).toMatch(/pesos vinculado/);
    await win.handleAction('confirm-yes');
    expect(win.STATE.movimientosUsd).toHaveLength(0);
    expect(win.STATE.movimientos).toHaveLength(0);
  });

  it('los CC solo en dólares no aparecen en los combos ni en los Saldos en pesos', () => {
    expect(win.centrosOrdenados().map(c => c.id)).not.toContain('c-da');
    expect(win.centrosDolaresOrdenados().map(c => c.id).sort()).toEqual(['c-da', 'c-ef']);
    expect(win.calcularSaldos().filas.map(f => f.id)).not.toContain('c-da');
  });

  it('Saldos y Resumen muestran la tenencia en dólares aparte', () => {
    win.STATE.movimientosUsd = [{ id: 'u1', fecha: '2026-10-01', centroId: 'c-da', ingreso: 250, egreso: 0, moneda: 'USD', cambioId: '' }];
    win.STATE.activeTab = 'saldos';
    win.render();
    expect(win.document.getElementById('app').innerHTML).toContain('Saldo en dólares');
    win.STATE.activeTab = 'resumen';
    win.render();
    expect(win.document.getElementById('app').innerHTML).toContain('Tenencia dólares');
  });
});

describe('ABM: moneda del Centro de Costo', () => {
  it('guarda la moneda elegida', async () => {
    const win = loadApp();
    seedBase(win);
    const sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.activeTab = 'abm';
    win.STATE.abmSubTab = 'centros';
    win.render();
    setVal(win, 'f-centro-codigo', 'da');
    setVal(win, 'f-centro-nombre', 'Dólares Ana');
    setVal(win, 'f-centro-moneda', 'USD');
    await win.handleAction('save-centro', '');
    expect(win.STATE.centros.find(c => c.codigo === 'DA').moneda).toBe('USD');
    expect(sbMock.calls[0].rows.moneda).toBe('USD');
  });
});
