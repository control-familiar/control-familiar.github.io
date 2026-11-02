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

describe('Cargar efectivo: centro del usuario logueado (R5)', () => {
  const chipsCentro = (win) => [...win.document.querySelectorAll('[data-action="ef-centro"]')].map(b => b.getAttribute('data-id'));
  const abrir = async (centros, usuarioId, recordado) => {
    const win = loadApp();
    seedBase(win);
    win.STATE.centros = centros;
    win.STATE.usuarioId = usuarioId;
    if (recordado) win.localStorage.setItem('controlCentroEfectivo', recordado);
    await win.handleAction('abrir-efectivo');
    return win;
  };
  const centros = [
    { id: 'c-ef', codigo: 'EFVO FRANCO', nombre: 'Efectivo Franco', titularId: 'u-franco' },
    { id: 'c-ea', codigo: 'EFVO ANA', nombre: 'Caja chica', entidad: 'efectivo', titularId: 'u-ana' },
    { id: 'c-gal', codigo: 'GALICIA', nombre: 'Banco Galicia', entidad: 'galicia', titularId: 'u-ana' },
  ];

  it('elige el centro de efectivo del usuario y muestra solo los de efectivo (el suyo primero) más "Otro…"', async () => {
    const win = await abrir(centros, 'u-ana');
    expect($(win, 'ef-centro').value).toBe('c-ea');
    expect(chipsCentro(win)).toEqual(['c-ea', 'c-ef', '__todos__']);
  });

  it('"Otro…" muestra todos los centros sin cambiar el elegido', async () => {
    const win = await abrir(centros, 'u-ana');
    await win.handleAction('ef-centro', '__todos__');
    expect(chipsCentro(win)).toEqual(['c-ea', 'c-ef', 'c-gal']);
    expect($(win, 'ef-centro').value).toBe('c-ea');
  });

  it('el último usado en el dispositivo no le gana al propio, salvo que sea uno de los propios', async () => {
    expect($(await abrir(centros, 'u-ana', 'c-ef'), 'ef-centro').value).toBe('c-ea');
    const dosPropios = centros.concat([{ id: 'c-ea2', codigo: 'EFVO ANA 2', nombre: 'Efectivo Ana dólares', titularId: 'u-ana' }]);
    expect($(await abrir(dosPropios, 'u-ana', 'c-ea2'), 'ef-centro').value).toBe('c-ea2');
  });

  it('sin centro de efectivo propio usa el último usado, y si es de otro tipo igual se ve en la lista', async () => {
    const win = await abrir(centros, 'u-otro', 'c-gal');
    expect($(win, 'ef-centro').value).toBe('c-gal');
    expect(chipsCentro(win)).toEqual(['c-gal', 'c-ea', 'c-ef']);
  });

  it('si la familia no tiene ningún centro de efectivo, muestra todos (como antes)', async () => {
    const win = await abrir([{ id: 'c-1', codigo: 'A', nombre: 'Cuenta A' }, { id: 'c-2', codigo: 'B', nombre: 'Cuenta B' }], 'u-ana');
    expect(chipsCentro(win)).toEqual(['c-1', 'c-2']);
    expect($(win, 'ef-centro').value).toBe('');
  });

  it('la entidad Efectivo se puede elegir en el ABM y se ve con un ícono de billetes', () => {
    const win = loadApp();
    expect(win.ENTIDADES.map(e => e.id)).toContain('efectivo');
    expect(win.logoEntidadHtml({ entidad: 'efectivo' })).toContain('bi-cash-stack');
    expect(win.logoEntidadHtml({ nombre: 'Efectivo Gerardo' })).toContain('bi-cash-stack');
  });
});

describe('Cargar efectivo: tecla "Realizar" del teclado', () => {
  it('Enter en el Monto le saca el foco (cierra el teclado en Android) sin perder lo escrito', async () => {
    const win = loadApp();
    seedBase(win);
    await win.handleAction('abrir-efectivo');
    const monto = $(win, 'ef-monto');
    monto.focus();
    monto.value = '20000';
    expect(win.document.activeElement).toBe(monto);
    monto.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(win.document.activeElement).not.toBe(monto);
    expect($(win, 'ef-monto').value).toBe('20000');
  });
});

describe('Cargar efectivo: orden de los campos', () => {
  it('Categoría va antes que Contraparte', async () => {
    const win = loadApp();
    seedBase(win);
    await win.handleAction('abrir-efectivo');
    const etiquetas = [...win.document.querySelectorAll('.ef-cuerpo .field > label')].map(l => l.textContent);
    expect(etiquetas.indexOf('Categoría (opcional)')).toBeLessThan(etiquetas.indexOf('Contraparte (opcional)'));
    expect(etiquetas.indexOf('Centro de Costo')).toBeLessThan(etiquetas.indexOf('Categoría (opcional)'));
  });
});

describe('Cargar efectivo: después de Guardar va a ver lo cargado', () => {
  let win;
  beforeEach(async () => {
    win = loadApp();
    seedBase(win);
    win.sb = mockSb().client;
    win.STATE.activeTab = 'resumen';
    win.STATE.movimientos = Array.from({ length: 60 }, (_, i) => (
      { id: 'v' + i, fecha: '2026-01-' + String((i % 28) + 1).padStart(2, '0'), centroId: 'c-ef', proveedor: 'Viejo ' + i, ingreso: 0, egreso: 10 }));
    await win.handleAction('abrir-efectivo');
  });

  it('Guardar lleva a Movimientos con el nuevo a la vista y resaltado, limpiando filtros que lo ocultarían', async () => {
    win.STATE.filtros.centro = ['c-ea'];
    win.STATE.filtros.texto = 'otra cosa';
    $(win, 'ef-monto').value = '700';
    await win.handleAction('ef-centro', 'c-ef');
    await win.handleAction('guardar-efectivo');
    const nuevo = win.STATE.movimientos.at(-1);
    expect(win.STATE.activeTab).toBe('movimientos');
    expect(win.STATE.filtros.centro).toEqual([]);
    expect(win.STATE.filtros.texto).toBe('');
    const fila = win.document.querySelector('[data-mov-id="' + nuevo.id + '"]').closest('tr');
    expect(fila.className).toContain('fila-recien');
  });

  it('si los filtros ya lo muestran, no se tocan', async () => {
    win.STATE.filtros.centro = ['c-ef'];
    $(win, 'ef-monto').value = '700';
    await win.handleAction('ef-centro', 'c-ef');
    await win.handleAction('guardar-efectivo');
    expect(win.STATE.activeTab).toBe('movimientos');
    expect(win.STATE.filtros.centro).toEqual(['c-ef']);
  });

  it('con fecha futura va a Vencimientos', async () => {
    const d = new Date(); d.setDate(d.getDate() + 10);
    const futura = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    await win.handleAction('ef-fecha', 'otra');
    $(win, 'ef-fecha').value = futura;
    $(win, 'ef-monto').value = '700';
    await win.handleAction('guardar-efectivo');
    expect(win.STATE.activeTab).toBe('vencimientos');
  });

  it('"Guardar y cargar otro" se queda en el modal y no cambia de pestaña', async () => {
    $(win, 'ef-monto').value = '700';
    await win.handleAction('guardar-efectivo-otro');
    expect(win.STATE.efectivoAbierto).toBe(true);
    expect(win.STATE.activeTab).toBe('resumen');
  });
});
