import { describe, it, expect } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';

// Regresión: al sacar el centro por defecto (R4, fase 6) quedó una referencia a una variable borrada y
// "Previsualizar" cortaba con un error apenas el parser encontraba movimientos.
describe('Importar: previsualizar', () => {
  it('arma la vista previa con el Centro de Costo vacío, sin errores', async () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.activeTab = 'importar';
    win.STATE.importEntidad = 'santander';
    win.STATE.importRaw = 'texto del resumen';
    win.runParser = () => ({ rows: [{ fecha: '01/10/26', proveedor: 'Kiosco', tipo: 'Compra', monto: '-100' }], error: null });
    await win.handleAction('preview-import');
    expect(win.STATE.importPreview).toHaveLength(1);
    expect(win.STATE.importPreview[0].centroId).toBe('');
    expect(win.STATE.importMsg).toBe(null);
    const proveedor = win.document.querySelector('[data-rowid="' + win.STATE.importPreview[0].id + '"][data-field="proveedor"]');
    expect(proveedor.value).toBe('Kiosco');
  });

  it('si hubo filas omitidas, lo avisa', async () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.activeTab = 'importar';
    win.STATE.importEntidad = 'santander';
    win.STATE.importRaw = 'texto del resumen';
    win.runParser = () => ({ rows: [{ fecha: '01/10/26', proveedor: 'Kiosco', tipo: '', monto: '-100' }], error: null, omitidas: 2 });
    await win.handleAction('preview-import');
    expect(win.STATE.importMsg.text).toContain('2 fila(s) en dólares no se importaron');
  });
});
