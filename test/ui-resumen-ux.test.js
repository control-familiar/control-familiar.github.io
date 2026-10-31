import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';

// Resumen: flechas del período, Saldo protagonista, "por pagar" con vencimientos, tocar una fila o un mes
// para profundizar, comparación con el promedio, signos +/− y aviso cuando el período está vacío.

describe('Resumen: experiencia', () => {
  let win, restore;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    restore = mockNow(win, '2026-10-15T12:00:00');
    win.STATE.resumenFiltros = { centro: [], categoria: [], mes: ['2026-10'], vista: 'categoria' };
    win.STATE.movimientos = [
      { id: 's10', fecha: '2026-10-01', centroId: 'c-ef', categoriaId: 'cat-suel', proveedor: 'Empresa', ingreso: 500000, egreso: 0 },
      { id: 'g10', fecha: '2026-10-05', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Super El Sol', ingreso: 0, egreso: 120000 },
      // 3 meses anteriores: 100.000 de Super por mes (promedio 100.000 → octubre +20%)
      { id: 'g07', fecha: '2026-07-05', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Super El Sol', ingreso: 0, egreso: 100000 },
      { id: 'g08', fecha: '2026-08-05', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Super El Sol', ingreso: 0, egreso: 100000 },
      { id: 'g09', fecha: '2026-09-05', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Super El Sol', ingreso: 0, egreso: 100000 }
    ];
    win.STATE.vencimientos = [
      { id: 'v1', concepto: 'Luz', fecha: '2026-10-20', monto: 15000, centroId: 'c-ef', categoriaId: '', estado: 'pendiente' },
      { id: 'v2', concepto: 'Gas', fecha: '2026-10-10', monto: 9000, centroId: 'c-ef', categoriaId: '', estado: 'pagado' },
      { id: 'v3', concepto: 'Agua', fecha: '2026-11-10', monto: 7000, centroId: 'c-ef', categoriaId: '', estado: 'pendiente' }
    ];
    win.STATE.activeTab = 'resumen';
    win.render();
  });
  afterEach(() => restore());
  const $ = sel => win.document.querySelector(sel);

  it('las flechas cambian de mes, sin pasar del actual', async () => {
    expect($('.periodo-label').textContent).toBe('Octubre 2026');
    expect($('[data-action="resumen-mes"][data-id="+1"]').disabled).toBe(true);
    await win.handleAction('resumen-mes', '-1');
    expect(win.STATE.resumenFiltros.mes).toEqual(['2026-09']);
    expect($('.periodo-label').textContent).toBe('Septiembre 2026');
    await win.handleAction('resumen-mes', '+1');
    await win.handleAction('resumen-mes', '+1');
    expect(win.STATE.resumenFiltros.mes).toEqual(['2026-10']);
  });

  it('el Saldo del período va primero, con signo y con la barra de lo que entró y salió', () => {
    expect($('.kpi-saldo-valor').textContent).toBe('+380.000,00');
    expect($('.kpi-saldo').textContent).toContain('ahorraste el 76% del ingreso');
    expect($('.kpi-saldo-barras').textContent).toContain('Entró');
    expect($('.kpi-saldo-barras').textContent).toContain('Salió');
  });

  it('"por pagar" suma los vencimientos pendientes del período (no los pagados ni los de otro mes)', () => {
    const t = win.calcularTotalesResumenKpis([], [], ['2026-10']);
    expect(t.vencPendientes).toBe(15000);
    expect(t.cantVencPendientes).toBe(1);
    expect($('.kpi-chicas').textContent).toContain('+ 15.000,00 por pagar');
  });

  it('cada categoría se compara con su promedio de los 3 meses anteriores', () => {
    const fila = [...win.document.querySelectorAll('.bar-row')].find(r => r.textContent.includes('Supermercado'));
    expect(fila.textContent).toContain('+20% vs. prom. 3 meses');
    expect(fila.querySelector('.amt').textContent).toContain('-120.000,00');
  });

  it('tocar una categoría o una contraparte lleva a Movimientos con ese recorte', async () => {
    await win.handleAction('resumen-ver-movimientos', 'cat:cat-super');
    expect(win.STATE.activeTab).toBe('movimientos');
    expect(win.STATE.filtros.categoria).toEqual(['cat-super']);
    expect(win.STATE.filtros.mes).toEqual(['2026-10']);

    win.STATE.activeTab = 'resumen';
    win.render();
    await win.handleAction('resumen-ver-movimientos', 'prov:Super El Sol');
    expect(win.STATE.filtros.texto).toBe('Super El Sol');
    expect(win.STATE.filtros.categoria).toEqual([]);
  });

  it('tocar un mes de la tendencia lo elige y queda resaltado', async () => {
    const mes = $('.trend-mes[data-id="2026-08"]');
    expect(mes.getAttribute('opacity')).toBe('0.4');
    await win.handleAction('resumen-elegir-mes', '2026-08');
    expect(win.STATE.resumenFiltros.mes).toEqual(['2026-08']);
    expect($('.trend-mes[data-id="2026-08"]').getAttribute('opacity')).toBe('1');
  });

  it('ya no está la torta (repetía el total por categoría)', () => {
    expect(win.document.querySelector('#app svg circle')).toBe(null);
  });

  it('un período sin movimientos muestra un aviso en vez de tarjetas en $0', async () => {
    win.STATE.resumenFiltros.mes = ['2026-06'];
    win.render();
    expect($('.resumen-vacio').textContent).toContain('No hay movimientos en Junio 2026');
    expect($('.kpi-saldo')).toBe(null);
    expect($('.resumen-vacio [data-action="abrir-efectivo"]')).not.toBe(null);
  });

  it('montos con signo explícito', () => {
    expect(win.fmtMontoSigno(1500)).toBe('+1.500,00');
    expect(win.fmtMontoSigno(-1500)).toBe('-1.500,00');
    expect(win.fmtMontoCorto(-85000)).toBe('−85 mil');
    expect(win.fmtMontoCorto(1250000)).toBe('+1,3 M');
  });
});
