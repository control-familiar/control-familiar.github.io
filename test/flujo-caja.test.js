import { describe, it, expect } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';

describe('Flujo de Caja: capacidad de ahorro promedio', () => {
  it('cuenta el Sueldo (ARS + USDT acreditado) como ingreso, resta el resto neto, deja la Obra aparte y no duplica el Sueldo al venderse el USDT', () => {
    const win = loadApp();
    seedBase(win);
    const restore = mockNow(win, '2026-04-15T12:00:00');

    win.STATE.categorias.push({ id: 'cat-obra', nombre: 'Obra', tipo: 'inversion' });
    win.STATE.categorias.push({ id: 'cat-vu', nombre: 'Cripto vendida', tipo: 'venta_usdt' });

    win.STATE.movimientos = [
      // Sueldo en pesos
      { id: 'm1', fecha: '2026-01-10', centroId: 'c-ef', categoriaId: 'cat-suel', proveedor: 'Trabajo', ingreso: 100000, egreso: 0 },
      // Venta del USDT que ya se había acreditado como parte del sueldo (ver usdtMovimientos abajo):
      // no debe sumarse de nuevo, ya se contó como ingreso cuando se acreditó el USDT.
      { id: 'm2', fecha: '2026-01-20', centroId: 'c-ef', categoriaId: 'cat-vu', proveedor: 'Venta USDT', ingreso: 48000, egreso: 0 },
      // Gasto normal (resto de categorías)
      { id: 'm3', fecha: '2026-01-05', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Verduleria', ingreso: 0, egreso: 30000 },
      // Obra: no se resta de la capacidad de ahorro (es inversión), se informa aparte
      { id: 'm4', fecha: '2026-01-12', centroId: 'c-ef', categoriaId: 'cat-obra', proveedor: 'Albañil', ingreso: 0, egreso: 20000 }
    ];
    win.STATE.usdtMovimientos = [
      { id: 'u1', fecha: '2026-01-10', tipo: 'ingreso', categoriaId: 'cat-suel', montoArs: 50000 }
    ];

    const cap = win.capacidadAhorroPromedio('3m');
    // ingreso: 100000 (sueldo ARS) + 50000 (sueldo acreditado en USDT) = 150000, sin sumar los 48000 de la venta
    // egreso resto: 30000 → 150000 - 30000 = 120000, sobre 1 solo mes con datos; obra: 20000 aparte
    expect(cap.promedio).toBe(120000);
    expect(cap.inversionPromedio).toBe(20000);

    restore();
  });

  it('los aportes cargados en una categoría "Solo control" no cuentan como sueldo ni bajan el gasto (no hay reglas por nombre de proveedor)', () => {
    const win = loadApp();
    seedBase(win);
    const restore = mockNow(win, '2026-04-15T12:00:00');

    win.STATE.categorias.push({ id: 'cat-aportes', nombre: 'Aportes', tipo: 'control' });
    win.STATE.movimientos = [
      { id: 'm1', fecha: '2026-01-10', centroId: 'c-ef', categoriaId: 'cat-suel', proveedor: 'Empresa', ingreso: 100000, egreso: 0 },
      { id: 'm2', fecha: '2026-01-11', centroId: 'c-ef', categoriaId: 'cat-aportes', proveedor: 'Familiar', ingreso: 500000, egreso: 0 },
      { id: 'm3', fecha: '2026-01-12', centroId: 'c-ef', categoriaId: 'cat-aportes', proveedor: 'Otro', ingreso: 300000, egreso: 0 }
    ];
    win.STATE.usdtMovimientos = [];

    expect(win.capacidadAhorroPromedio('3m').promedio).toBe(100000);

    restore();
  });

  it('cuenta como sueldo los ingresos USDT con categoría de tipo Sueldo (los demás no), valuados a la cotización de la venta (FIFO) o a la de hoy si no se vendió', () => {
    const win = loadApp();
    seedBase(win);
    const restore = mockNow(win, '2026-04-15T12:00:00');

    win.STATE.usdtCotizacionBid = 1200;
    win.STATE.movimientos = [
      // Sueldo de Franco en pesos
      { id: 'm1', fecha: '2026-01-10', centroId: 'c-ef', categoriaId: 'cat-suel', proveedor: 'Trabajo', ingreso: 100000, egreso: 0 },
      // Pesos de vender el USDT de Ani, cargados en una categoría normal: no deben sumar de nuevo
      { id: 'm-venta', fecha: '2026-01-20', centroId: 'c-ea', categoriaId: 'cat-super', proveedor: 'Venta USDT', ingreso: 110000, egreso: 0 },
      { id: 'm2', fecha: '2026-02-15', centroId: 'c-ea', categoriaId: 'cat-super', proveedor: 'Verduleria', ingreso: 0, egreso: 9000 }
    ];
    win.STATE.usdtMovimientos = [
      // Sueldo en USDT (categoría de tipo Sueldo), sin valor en pesos
      { id: 'u1', fecha: '2026-01-05', tipo: 'ingreso', cantidad: 100, categoriaId: 'cat-suel', montoArs: 0 },
      // Vende 100 a $1100: se consume entero el ingreso u1
      { id: 'u2', fecha: '2026-01-20', tipo: 'venta', cantidad: 100, montoArs: 110000, cotizacion: 1100, movimientoId: 'm-venta' },
      // Febrero: entran 50 sin categoría (no es sueldo: un ahorro, por ejemplo) y vende 20 a $1150
      // → vale 20*1150 + 30*1200 (hoy) = 59000, pero no suma como ingreso
      { id: 'u3', fecha: '2026-02-05', tipo: 'ingreso', cantidad: 50, categoriaId: '', montoArs: 0 },
      { id: 'u4', fecha: '2026-02-10', tipo: 'venta', cantidad: 20, montoArs: 23000, cotizacion: 1150 }
    ];

    const valores = win.valoresArsIngresosUsdt();
    expect(valores.u1).toBe(110000);
    expect(valores.u3).toBe(59000);

    // Ene: 100000 + 110000 = 210000; Feb: 0 - 9000 = -9000 → promedio 100500
    expect(win.capacidadAhorroPromedio('3m').promedio).toBe(100500);

    const resumenEne = win.calcularTotalesResumenKpis([], [], ['2026-01']);
    expect(resumenEne.totalIngreso).toBe(210000);
    expect(resumenEne.totalEgreso).toBe(0);
    expect(win.calcularTotalesResumenKpis([], [], ['2026-02']).totalIngreso).toBe(0);
    // Filtrando por la categoría Sueldo, el USDT de esa categoría cuenta
    expect(win.calcularTotalesResumenKpis([], ['cat-suel'], ['2026-01']).totalIngreso).toBe(210000);

    restore();
  });
});

describe('Flujo de Caja: dólares', () => {
  it('los gastos en USD restan al blue; los ingresos en USD (ahorro/saldo inicial) no suman; el saldo incluye la tenencia', () => {
    const win = loadApp();
    seedBase(win);
    const restore = mockNow(win, '2026-04-15T12:00:00');
    win.STATE.centros.push({ id: 'c-da', codigo: 'DA', nombre: 'Dólares Ana', moneda: 'USD' });
    win.STATE.movimientos = [
      { id: 'm1', fecha: '2026-01-10', centroId: 'c-ef', categoriaId: 'cat-suel', proveedor: 'AdvertMind', ingreso: 100000, egreso: 0 }
    ];
    win.STATE.usdtMovimientos = [];
    win.STATE.movimientosUsd = [
      { id: 'u1', fecha: '2026-01-05', centroId: 'c-da', categoriaId: '', ingreso: 500, egreso: 0, moneda: 'USD', cambioId: '' },
      { id: 'u2', fecha: '2026-01-20', centroId: 'c-da', categoriaId: 'cat-super', ingreso: 0, egreso: 10, moneda: 'USD', cambioId: '' }
    ];
    win.STATE.dolarBlueCompra = 1000;
    win.STATE.dolarBlueVenta = 1020;

    expect(win.capacidadAhorroPromedio('3m').promedio).toBe(90000);

    win.STATE.activeTab = 'flujo';
    win.render();
    const html = win.document.getElementById('app').innerHTML;
    expect(html).toContain('US$ 490,00'); // tenencia: 500 - 10
    expect(html).toContain('590.000,00'); // 100.000 en pesos + 490 USD a $1.000

    restore();
  });
});
