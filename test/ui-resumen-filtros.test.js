import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';

// Resumen: los filtros van debajo de "Estado actual" y encabezan lo que depende de ellos; se
// despliegan/colapsan (desplegados en escritorio, colapsados en el celular).

function anchoPantalla(win, px) {
  Object.defineProperty(win, 'innerWidth', { value: px, configurable: true });
}

describe('Resumen: filtros', () => {
  let win;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    win.STATE.activeTab = 'resumen';
  });

  it('van debajo de "Estado actual" y encabezan el bloque de lo filtrado', () => {
    win.render();
    const app = win.document.getElementById('app');
    const html = app.innerHTML;
    expect(html.indexOf('Estado actual')).toBeLessThan(html.indexOf('Según estos filtros'));
    const filtrado = app.querySelector('.resumen-filtrado');
    expect(filtrado.firstElementChild.className).toContain('filtros-resumen');
    expect(filtrado.textContent).toContain('Tendencia mensual');
    expect(filtrado.textContent).not.toContain('Estado actual');
  });

  it('en escritorio arrancan desplegados y en el celular colapsados, con un resumen de lo aplicado', () => {
    anchoPantalla(win, 1280);
    win.render();
    expect(win.document.getElementById('rf-vista')).not.toBe(null);

    const celu = loadApp();
    seedBase(celu);
    celu.STATE.activeTab = 'resumen';
    anchoPantalla(celu, 390);
    celu.render();
    expect(celu.document.getElementById('rf-vista')).toBe(null);
    const detalle = celu.document.querySelector('.filtros-resumen-detalle').textContent;
    expect(detalle).toContain('Todos los centros');
    expect(detalle).toContain('Todas las categorías');
  });

  it('el encabezado los despliega y los vuelve a colapsar', async () => {
    anchoPantalla(win, 390);
    win.render();
    await win.handleAction('toggle-filtros-resumen');
    expect(win.document.getElementById('rf-vista')).not.toBe(null);
    expect(win.document.querySelector('.filtros-resumen-toggle').getAttribute('aria-expanded')).toBe('true');
    await win.handleAction('toggle-filtros-resumen');
    expect(win.document.getElementById('rf-vista')).toBe(null);
  });

  it('"Volver al mes actual" aparece solo si se cambiaron, y los restablece', async () => {
    win.render();
    expect(win.document.querySelector('[data-action="restablecer-filtros-resumen"]')).toBe(null);
    win.STATE.resumenFiltros.centro = ['c-ef'];
    win.STATE.resumenFiltros.mes = [];
    win.render();
    expect(win.document.querySelector('.periodo-label').textContent).toBe('Todos los meses');
    expect(win.document.querySelector('.filtros-resumen-detalle').textContent).toContain('EF');
    await win.handleAction('restablecer-filtros-resumen');
    expect(win.STATE.resumenFiltros.centro).toEqual([]);
    expect(win.STATE.resumenFiltros.mes).toEqual([win.fechaHoyISO().slice(0, 7)]);
    expect(win.document.querySelector('[data-action="restablecer-filtros-resumen"]')).toBe(null);
  });

  it('con Dólares prendido, el filtro de Centro incluye los centros solo en dólares', () => {
    anchoPantalla(win, 1280);
    win.STATE.centros.push({ id: 'c-usd', codigo: 'USD', nombre: 'Caja dólares', moneda: 'USD' });
    win.render();
    win.document.querySelector('[data-multiselect-wrap="rf-centro"] [data-action="toggle-multiselect"]').click();
    expect(win.document.querySelector('[data-multiselect-wrap="rf-centro"]').textContent).toContain('USD');

    win.STATE.configuracion = [{ clave: 'feature.dolares', valor: 'false' }];
    win.STATE.multiSelectAbierto = 'rf-centro';
    win.render();
    expect(win.document.querySelector('[data-multiselect-wrap="rf-centro"]').textContent).not.toContain('USD');
  });
});
