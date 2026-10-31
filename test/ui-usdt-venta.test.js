import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

// Una venta de USDT crea el ingreso en pesos en Movimientos siempre en la categoría de tipo
// "Venta de USDT" (D6: por tipo, no por nombre), sin elegirlo a mano: así no queda en otra
// categoría ni se cuenta dos veces como ingreso.
function setVal(win, id, value) { win.document.getElementById(id).value = value; }

describe('USDT: venta con la categoría de tipo Venta de USDT', () => {
  let win;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    win.STATE.categorias.push({ id: 'cat-cripto', nombre: 'Cripto vendida', tipo: 'venta_usdt' });
    win.STATE.usdtMovimientos = [];
    win.sb = mockSb().client;
    win.STATE.activeTab = 'usdt';
    win.STATE.usdtDraft = { tipo: 'venta', fecha: '', cantidad: '', detalle: '', montoArs: '', centroId: '', categoriaId: '', subcategoriaId: '' };
    win.render();
  });

  it('el formulario muestra la categoría fija en vez de los selectores', () => {
    expect(win.document.getElementById('f-usdt-categoria')).toBeNull();
    expect(win.document.getElementById('f-usdt-subcategoria')).toBeNull();
    expect(win.document.body.textContent).toContain('Cripto vendida');
  });

  it('al guardar, el movimiento en pesos queda en esa categoría', async () => {
    setVal(win, 'f-usdt-fecha', '2026-10-01');
    setVal(win, 'f-usdt-cantidad', '100');
    setVal(win, 'f-usdt-monto-ars', '130000');
    setVal(win, 'f-usdt-centro', 'c-ef');
    await win.handleAction('save-usdt', '');

    expect(win.STATE.usdtFormMsg).toBeNull();
    expect(win.STATE.movimientos).toHaveLength(1);
    expect(win.STATE.movimientos[0].categoriaId).toBe('cat-cripto');
    expect(win.STATE.movimientos[0].subcategoriaId).toBeFalsy();
    expect(win.esIngresoPorVentaUsdt(win.STATE.movimientos[0], {})).toBe(true);
  });

  it('una categoría que se llama "Venta USDT" pero no es de ese tipo no se usa', () => {
    win.STATE.categorias = win.STATE.categorias.filter(c => c.id !== 'cat-cripto');
    win.STATE.categorias.push({ id: 'cat-nombre', nombre: 'Venta USDT' });
    win.render();
    expect(win.destinoVentaUsdt()).toBe(null);
    expect(win.document.getElementById('f-usdt-categoria')).not.toBeNull(); // sin destino fijo, se elige a mano
  });
});

describe('ABM: tipo de categoría Venta de USDT', () => {
  let win;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    win.sb = mockSb().client;
    win.STATE.activeTab = 'abm';
    win.STATE.abmSubTab = 'categorias';
    win.render();
  });

  it('se ofrece solo si la familia tiene USDT prendido', () => {
    const opciones = () => [...win.document.querySelectorAll('#f-categoria-tipo option')].map(o => o.value);
    expect(opciones()).toContain('venta_usdt');
    win.STATE.configuracion = [{ clave: 'feature.usdt', valor: 'false' }];
    win.render();
    expect(opciones()).not.toContain('venta_usdt');
  });

  it('puede haber una sola categoría de ese tipo', async () => {
    win.STATE.categorias.push({ id: 'cat-cripto', nombre: 'Cripto vendida', tipo: 'venta_usdt' });
    win.render();
    win.document.getElementById('f-categoria-nombre').value = 'Otra venta';
    win.document.getElementById('f-categoria-tipo').value = 'venta_usdt';
    await win.handleAction('save-categoria', '');
    expect(win.STATE.dbError).toContain('puede haber una sola');
    expect(win.STATE.categorias.filter(c => c.tipo === 'venta_usdt')).toHaveLength(1);
  });
});

describe('Saldos: tarjeta de USDT', () => {
  it('muestra la tenencia de USDT (ingresos menos ventas), aparte del saldo en pesos', () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.usdtMovimientos = [
      { id: 'u1', tipo: 'ingreso', fecha: '2026-09-01', cantidad: 1000 },
      { id: 'u2', tipo: 'venta', fecha: '2026-09-10', cantidad: 250, montoArs: 300000 }
    ];
    win.STATE.usdtCotizacionBid = 1200;
    win.STATE.activeTab = 'saldos';
    win.render();
    const texto = win.document.body.textContent;
    expect(texto).toContain('Saldo en USDT');
    expect(texto).toContain('750,00 USDT');
    expect(texto).toContain('≈ $900.000,00');
  });
});

describe('Flujo de Caja: Saldo actual total incluye el USDT', () => {
  it('suma pesos + USDT a la cotización de hoy y lo detalla debajo', () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.usdtMovimientos = [{ id: 'u1', tipo: 'ingreso', fecha: '2026-09-01', cantidad: 100 }];
    win.STATE.usdtCotizacionBid = 1000;
    win.STATE.activeTab = 'flujo';
    win.render();
    const card = [...win.document.querySelectorAll('.summary-card')].find(c => c.textContent.includes('Saldo actual total'));
    expect(card.querySelector('.value').textContent).toBe('100.000,00'); // sin pesos cargados: solo los 100 USDT a $1.000
    expect(card.textContent).toContain('100,00 USDT (≈ 100.000,00 a $1.000,00)');
  });
});

describe('USDT: la venta es facturable y no se cuenta como ingreso', () => {
  it('el movimiento de la venta queda en la categoría de tipo Venta de USDT, sin subcategoría, y es facturable', async () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.categorias.push({ id: 'cat-venta-usdt', nombre: 'Venta USDT', tipo: 'venta_usdt' });
    win.STATE.usdtMovimientos = [];
    win.sb = mockSb().client;
    win.STATE.activeTab = 'usdt';
    win.STATE.usdtDraft = { tipo: 'venta', fecha: '', cantidad: '', detalle: '', montoArs: '', centroId: '', categoriaId: '', subcategoriaId: '' };
    win.render();
    expect(win.document.body.textContent).toContain('Venta USDT');

    setVal(win, 'f-usdt-fecha', '2026-10-01');
    setVal(win, 'f-usdt-cantidad', '100');
    setVal(win, 'f-usdt-monto-ars', '130000');
    setVal(win, 'f-usdt-centro', 'c-ef');
    await win.handleAction('save-usdt', '');

    expect(win.STATE.usdtFormMsg).toBeNull();
    expect(win.STATE.movimientos[0].categoriaId).toBe('cat-venta-usdt');
    expect(win.STATE.movimientos[0].subcategoriaId).toBeFalsy();
    expect(win.esIngresoPorVentaUsdt(win.STATE.movimientos[0], {})).toBe(true);
    expect(win.esVentaUsdtFacturable({ id: 'x', categoriaId: 'cat-venta-usdt', ingreso: 1000 })).toBe(true);
  });
});
