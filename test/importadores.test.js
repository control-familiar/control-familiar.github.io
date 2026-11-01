import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase, importadoresTodos } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

// D7: los importadores viven en la base (tabla importadores, global) y cada familia tiene una lista de
// los que NO ve. El parser de cada uno sigue en app.js y se conecta por código.

const opciones = (win, id) => [...win.document.querySelectorAll('#' + id + ' option')].map(o => o.value);

describe('Importar: opciones según los importadores de la familia', () => {
  let win;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    win.STATE.activeTab = 'importar';
  });

  it('con todo visible, ofrece las cuentas, "Tarjeta de Crédito" y el Excel, en el orden de la tabla', () => {
    win.render();
    expect(opciones(win, 'imp-entidad')).toEqual(['mp', 'santander', 'nacion', 'provincia', 'macro', 'tarjeta', 'excel']);
    win.STATE.importEntidad = 'tarjeta';
    win.render();
    expect(opciones(win, 'imp-banco')).toEqual(['nacion', 'santander', 'provincia', 'mercadopago', 'galicia']);
  });

  it('no muestra los que la familia tiene ocultos (y un banco de tarjeta se oculta aparte de su cuenta)', () => {
    win.STATE.importadoresOcultos = ['excel', 'provincia', 'tarjeta_santander'];
    win.STATE.importEntidad = 'tarjeta';
    win.render();
    expect(opciones(win, 'imp-entidad')).toEqual(['mp', 'santander', 'nacion', 'macro', 'tarjeta']);
    expect(opciones(win, 'imp-banco')).toEqual(['nacion', 'provincia', 'mercadopago', 'galicia']);
  });

  it('sin ningún banco de tarjeta visible, no aparece "Tarjeta de Crédito"', () => {
    win.STATE.importadoresOcultos = ['tarjeta_nacion', 'tarjeta_santander', 'tarjeta_provincia', 'tarjeta_mercadopago', 'tarjeta_galicia'];
    win.render();
    expect(opciones(win, 'imp-entidad')).not.toContain('tarjeta');
  });

  it('si lo elegido se oculta, pasa al primero disponible', () => {
    win.STATE.importEntidad = 'santander';
    win.STATE.importadoresOcultos = ['mp', 'santander'];
    win.render();
    expect(win.STATE.importEntidad).toBe('nacion');
    win.STATE.importEntidad = 'tarjeta';
    win.STATE.importBanco = 'nacion';
    win.STATE.importadoresOcultos = ['tarjeta_nacion'];
    win.render();
    expect(win.STATE.importBanco).toBe('santander');
  });

  it('un importador inactivo no lo ve nadie', () => {
    win.STATE.importadores.find(i => i.codigo === 'mp').activo = false;
    win.render();
    expect(opciones(win, 'imp-entidad')).not.toContain('mp');
  });

  it('una fila sin parser en app.js no se muestra (y avisa en la consola)', () => {
    const avisos = [];
    win.console.warn = m => avisos.push(m);
    win.STATE.importadores.push({ codigo: 'banco_nuevo', nombre: 'Banco Nuevo', activo: true, orden: 5 });
    win.render();
    expect(opciones(win, 'imp-entidad')).not.toContain('banco_nuevo');
    expect(avisos.join(' ')).toContain('banco_nuevo');
  });

  it('sin ningún importador visible, avisa que se lo pida al soporte', () => {
    win.STATE.importadoresOcultos = importadoresTodos().map(i => i.codigo);
    win.render();
    expect(win.document.getElementById('imp-entidad')).toBe(null);
    expect(win.document.getElementById('app').textContent).toContain('pedíselo al soporte');
  });
});

describe('Importadores: carga y edición del superadmin', () => {
  let win, sbMock;
  beforeEach(async () => {
    win = loadApp();
    seedBase(win);
    sbMock = mockSb({
      superadmins: [{ user_id: 's1' }],
      familias: [{ id: 'fa', nombre: 'Familia A' }, { id: 'fb', nombre: 'Familia B' }],
      importadores: importadoresTodos().map(i => ({ codigo: i.codigo, nombre: i.nombre, activo: true, orden: i.orden })).reverse(),
      familia_importadores_ocultos: [{ familia_id: 'fa', importador_codigo: 'excel' }, { familia_id: 'fb', importador_codigo: 'mp' }]
    }, { admin_miembros: { data: [], error: null } });
    win.sb = sbMock.client;
    await win.cargarPerfil();
    await win.cargarTodo();
    win.STATE.ready = true;
    win.STATE.activeTab = 'admin';
    win.render();
  });

  it('carga los importadores ordenados y los ocultos de la familia elegida', () => {
    expect(win.STATE.importadores[0].codigo).toBe('mp');
    expect(win.STATE.importadoresOcultos).toEqual(['excel']);
    expect(sbMock.selects.find(s => s.table === 'familia_importadores_ocultos').filtros).toEqual([['familia_id', 'fa']]);
  });

  it('Administración muestra un tilde por importador (tildado = visible)', () => {
    const tildes = [...win.document.querySelectorAll('[data-action="importador-alternar"]')];
    expect(tildes).toHaveLength(11);
    expect(tildes.find(t => t.getAttribute('data-id') === 'excel').checked).toBe(false);
    expect(tildes.find(t => t.getAttribute('data-id') === 'mp').checked).toBe(true);
    expect(win.document.getElementById('app').textContent).toContain('Tarjeta de Crédito · Nación');
  });

  it('destildar oculta (insert) y volver a tildar muestra (delete), en la familia elegida', async () => {
    await win.handleAction('importador-alternar', 'mp');
    expect(sbMock.calls.find(c => c.op === 'insert')).toMatchObject({ table: 'familia_importadores_ocultos', rows: { familia_id: 'fa', importador_codigo: 'mp' } });
    expect(win.STATE.importadoresOcultos).toContain('mp');
    await win.handleAction('importador-alternar', 'excel');
    expect(sbMock.calls.find(c => c.op === 'delete')).toMatchObject({ table: 'familia_importadores_ocultos', filtros: [['familia_id', 'fa'], ['importador_codigo', 'excel']] });
    expect(win.STATE.importadoresOcultos).not.toContain('excel');
  });

  it('un miembro no puede cambiar los importadores', async () => {
    const miembro = loadApp();
    seedBase(miembro);
    const sbMiembro = mockSb({ superadmins: [], familias: [{ id: 'fa', nombre: 'Familia A' }] });
    miembro.sb = sbMiembro.client;
    await miembro.cargarPerfil();
    await miembro.handleAction('importador-alternar', 'mp');
    expect(sbMiembro.calls).toHaveLength(0);
  });
});
