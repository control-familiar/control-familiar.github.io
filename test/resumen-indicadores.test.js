import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';

// Indicadores del Resumen: lo pendiente (fecha futura) no cuenta y se informa aparte, los gastos en
// dólares suman pasados a pesos, y la Tendencia mensual usa las mismas cuentas que las tarjetas.

describe('Resumen: indicadores', () => {
  let win, restore;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    restore = mockNow(win, '2026-10-15T12:00:00');
    win.STATE.categorias.push({ id: 'cat-obra', nombre: 'Obra', tipo: 'inversion' });
    win.STATE.centros.push({ id: 'c-usd', codigo: 'USD', nombre: 'Dólares', moneda: 'USD' });
    win.STATE.dolarBlueCompra = 1000;
    win.STATE.movimientos = [
      { id: 's1', fecha: '2026-10-01', centroId: 'c-ef', categoriaId: 'cat-suel', ingreso: 500000, egreso: 0 },
      { id: 'g1', fecha: '2026-10-05', centroId: 'c-ef', categoriaId: 'cat-super', ingreso: 0, egreso: 80000 },
      { id: 'o1', fecha: '2026-10-06', centroId: 'c-ef', categoriaId: 'cat-obra', ingreso: 0, egreso: 50000 },
      // pendientes (fecha futura dentro del mes)
      { id: 'p1', fecha: '2026-10-25', centroId: 'c-ef', categoriaId: 'cat-super', ingreso: 0, egreso: 30000 },
      { id: 'p2', fecha: '2026-10-28', centroId: 'c-ef', categoriaId: 'cat-suel', ingreso: 999999, egreso: 0 },
      // la parte en pesos de una compra de dólares (TEC, no cuenta)
      { id: 'cp', fecha: '2026-10-07', centroId: 'c-ef', categoriaId: 'cat-tec', ingreso: 0, egreso: 100000, cambioId: 'k1' }
    ];
    win.STATE.movimientosUsd = [
      { id: 'u1', fecha: '2026-10-08', centroId: 'c-usd', categoriaId: 'cat-super', ingreso: 0, egreso: 20, moneda: 'USD' },  // gasto: $20.000
      { id: 'u2', fecha: '2026-10-09', centroId: 'c-usd', categoriaId: 'cat-obra', ingreso: 0, egreso: 10, moneda: 'USD' },   // inversión: $10.000
      { id: 'u3', fecha: '2026-10-07', centroId: 'c-usd', categoriaId: 'cat-tec', ingreso: 100, egreso: 0, moneda: 'USD', cambioId: 'k1' }, // compra: no
      { id: 'u4', fecha: '2026-10-10', centroId: 'c-usd', categoriaId: 'cat-super', ingreso: 50, egreso: 0, moneda: 'USD' }    // ingreso USD: no
    ];
  });
  afterEach(() => restore());

  it('no cuenta lo pendiente y lo devuelve aparte; suma los gastos en dólares pasados a pesos', () => {
    const t = win.calcularTotalesResumenKpis([], [], ['2026-10']);
    expect(t.totalIngreso).toBe(500000);              // el sueldo del 28 todavía no entró
    expect(t.totalEgreso).toBe(80000 + 20000);        // super + gasto en USD a $1000
    expect(t.totalInversion).toBe(50000 + 10000);     // obra + obra en USD
    expect(t.saldo).toBe(500000 - 100000 - 60000);
    expect(t.pendientes).toBe(30000);
    expect(t.cantPendientes).toBe(1);
    // el gasto en USD aparece en el desglose, ya en pesos
    expect(t.movsResto.find(m => m.id === 'u1').egreso).toBe(20000);
  });

  it('la tarjeta de Egresos avisa lo que falta pagar del período', () => {
    win.STATE.activeTab = 'resumen';
    win.STATE.resumenFiltros.mes = ['2026-10'];
    win.render();
    const card = [...win.document.querySelectorAll('.kpi-chicas .summary-card')].find(c => c.textContent.includes('Egresos'));
    expect(card.textContent).toContain('+ 30.000,00 por pagar');
    expect(card.querySelector('[data-action="ir-a-vencimientos"]')).not.toBe(null);
  });

  it('la Tendencia mensual usa las mismas cuentas que las tarjetas (Egresos = gastos netos + Inversión)', () => {
    let datos = null;
    win.trendChart = (meses, dataPorMes) => { datos = dataPorMes; return ''; };
    win.STATE.activeTab = 'resumen';
    win.render();
    const t = win.calcularTotalesResumenKpis([], [], ['2026-10']);
    expect(datos['2026-10']).toEqual({ ingreso: t.totalIngreso, egreso: t.totalEgreso + t.totalInversion });
  });
});
