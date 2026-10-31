import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

// Carga rápida de efectivo pensada para el celular: Monto primero, Egreso/Ingreso, Fecha, Centro y
// Categoría como botones, regla de categorización desde la Contraparte, "Guardar y cargar otro" y
// aviso con Deshacer.

const $ = (win, id) => win.document.getElementById(id);
const chip = (win, accion, id) => win.document.querySelector('[data-action="' + accion + '"][data-id="' + id + '"]');

describe('parseMontoAr', () => {
  it('entiende montos escritos como en Argentina y también con punto decimal', () => {
    const win = loadApp();
    expect(win.parseMontoAr('1.500,50')).toBe(1500.5);
    expect(win.parseMontoAr('1500,5')).toBe(1500.5);
    expect(win.parseMontoAr('1.500')).toBe(1500);
    expect(win.parseMontoAr('1.500.000')).toBe(1500000);
    expect(win.parseMontoAr('1500.50')).toBe(1500.5);
    expect(win.parseMontoAr('$ 2.000')).toBe(2000);
    expect(win.parseMontoAr('-300')).toBe(300);
    expect(win.parseMontoAr('')).toBe(0);
    expect(win.parseMontoAr('abc')).toBe(0);
  });
});

describe('Cargar efectivo: formulario rápido', () => {
  let win, sbMock;
  beforeEach(async () => {
    win = loadApp();
    seedBase(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.movimientos = [
      { id: 'v1', fecha: '2026-09-01', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Verdulería Don Pepe', ingreso: 0, egreso: 100 },
      { id: 'v2', fecha: '2026-09-02', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Kiosco', ingreso: 0, egreso: 50 }
    ];
    win.STATE.reglas = [{ id: 'r1', proveedor: 'verdu', categoria: 'Supermercado', subcategoria: 'Verduleria' }];
    await win.handleAction('abrir-efectivo');
  });

  it('el Monto va primero, con teclado decimal y foco', () => {
    const monto = $(win, 'ef-monto');
    expect(monto.getAttribute('inputmode')).toBe('decimal');
    expect(win.document.activeElement).toBe(monto);
    const primerCampo = win.document.querySelector('#ef-card .ef-cuerpo input, #ef-card .ef-cuerpo select');
    expect(primerCampo.id).toBe('ef-monto');
  });

  it('Egreso/Ingreso, Fecha y Centro son botones que no borran lo tipeado', async () => {
    $(win, 'ef-monto').value = '1.200';
    $(win, 'ef-proveedor').value = 'Kiosco';
    await win.handleAction('ef-tipo', 'ingreso');
    expect($(win, 'ef-tipo').value).toBe('ingreso');
    expect(chip(win, 'ef-tipo', 'ingreso').className).toContain('activo');
    await win.handleAction('ef-fecha', 'ayer');
    expect($(win, 'ef-fecha').value).toBe(win.fechaAyerISO());
    await win.handleAction('ef-centro', 'c-ea');
    expect($(win, 'ef-centro').value).toBe('c-ea');
    expect(chip(win, 'ef-centro', 'c-ea').className).toContain('activo');
    expect($(win, 'ef-monto').value).toBe('1.200');
    expect($(win, 'ef-proveedor').value).toBe('Kiosco');
  });

  it('"Otra…" en Fecha muestra el calendario', async () => {
    expect($(win, 'ef-fecha').type).toBe('hidden');
    await win.handleAction('ef-fecha', 'otra');
    expect($(win, 'ef-fecha').type).toBe('date');
  });

  it('ofrece primero las categorías más usadas y "Otra…" abre la lista completa', async () => {
    const primeras = [...win.document.querySelectorAll('[data-action="ef-categoria"]')].map(b => b.getAttribute('data-id'));
    expect(primeras[0]).toBe('cat-super');
    expect(primeras).not.toContain('cat-tec'); // TEC no cuenta en reportes: no se sugiere
    await win.handleAction('ef-categoria', '__todas__');
    expect($(win, 'ef-categoria').tagName).toBe('SELECT');
  });

  it('una Contraparte con regla de categorización completa la categoría', () => {
    const prov = $(win, 'ef-proveedor');
    prov.value = 'Verdulería Don Pepe';
    prov.dispatchEvent(new win.Event('change', { bubbles: true }));
    expect(win.STATE.efectivoCategoriaId).toBe('cat-super');
    expect($(win, 'ef-subcategoria').value).toBe('sub-verd');
    expect($(win, 'ef-proveedor').value).toBe('Verdulería Don Pepe');
  });

  it('autocompleta la Contraparte con las ya cargadas', () => {
    const opciones = [...win.document.querySelectorAll('#ef-proveedores option')].map(o => o.value);
    expect(opciones).toEqual(['Kiosco', 'Verdulería Don Pepe']);
  });

  it('Detalle y Subcategoría quedan plegados en "Más datos"', async () => {
    expect($(win, 'ef-detalle').type).toBe('hidden');
    await win.handleAction('ef-mas');
    expect($(win, 'ef-detalle').type).toBe('text');
    expect($(win, 'ef-subcategoria').tagName).toBe('SELECT');
  });

  it('"Guardar y cargar otro" guarda y deja la hoja abierta con la misma fecha, centro y tipo', async () => {
    await win.handleAction('ef-centro', 'c-ea');
    $(win, 'ef-monto').value = '1.500,50';
    $(win, 'ef-proveedor').value = 'Kiosco';
    await win.handleAction('guardar-efectivo-otro');
    expect(win.STATE.movimientos.at(-1)).toMatchObject({ egreso: 1500.5, centroId: 'c-ea', proveedor: 'Kiosco' });
    expect(win.STATE.efectivoAbierto).toBe(true);
    expect($(win, 'ef-monto').value).toBe('');
    expect($(win, 'ef-proveedor').value).toBe('');
    expect($(win, 'ef-centro').value).toBe('c-ea');
    expect(win.document.activeElement).toBe($(win, 'ef-monto'));
  });

  it('después de guardar avisa abajo, y "Deshacer" borra lo cargado', async () => {
    $(win, 'ef-monto').value = '700';
    await win.handleAction('guardar-efectivo');
    expect(win.STATE.efectivoAbierto).toBe(false);
    const nuevo = win.STATE.movimientos.at(-1);
    const aviso = win.document.querySelector('.aviso-flotante');
    expect(aviso.textContent).toContain('Egreso de $700,00 cargado');
    await win.handleAction('deshacer-efectivo', nuevo.id);
    expect(win.STATE.movimientos.find(m => m.id === nuevo.id)).toBeUndefined();
    expect(sbMock.calls.at(-1)).toMatchObject({ op: 'delete', table: 'movimientos', val: nuevo.id });
  });
});

describe('Botón flotante "+ Efectivo"', () => {
  it('está en la página (se ve solo en el celular) y se oculta con la hoja abierta', async () => {
    const win = loadApp();
    seedBase(win);
    win.render();
    expect(win.document.querySelector('.fab-efectivo')).not.toBe(null);
    await win.handleAction('abrir-efectivo');
    expect(win.document.querySelector('.fab-efectivo')).toBe(null);
  });
});

describe('Cargar efectivo: teclado de Android', () => {
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const ancho = (win, px) => Object.defineProperty(win, 'innerWidth', { value: px, configurable: true });

  it('abrir el teclado (resize sin cruzar el breakpoint) no redibuja: el Monto conserva el foco y lo escrito', async () => {
    const win = loadApp();
    seedBase(win);
    ancho(win, 390);
    win.dispatchEvent(new win.Event('resize')); // la app ya quedó en vista celular
    await esperar(250);
    await win.handleAction('abrir-efectivo');
    const monto = $(win, 'ef-monto');
    monto.value = '1500';
    win.dispatchEvent(new win.Event('resize'));
    await esperar(250);
    expect($(win, 'ef-monto')).toBe(monto);
    expect($(win, 'ef-monto').value).toBe('1500');
  });

  it('cruzar el breakpoint (rotar o agrandar la ventana) sí redibuja', async () => {
    const win = loadApp();
    seedBase(win);
    await win.handleAction('abrir-efectivo');
    const monto = $(win, 'ef-monto');
    ancho(win, 390);
    win.dispatchEvent(new win.Event('resize'));
    await esperar(250);
    expect($(win, 'ef-monto')).not.toBe(monto);
  });
});
