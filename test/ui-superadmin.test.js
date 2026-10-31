import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

const FAMILIAS = [
  { id: 'fa', nombre: 'Familia A', created_at: '2026-10-01T00:00:00Z' },
  { id: 'fb', nombre: 'Familia B', created_at: '2026-10-02T00:00:00Z' }
];
const MIEMBROS = [
  { user_id: 'u1', email: 'a@ejemplo.com', familia_id: 'fa', familia: 'Familia A', created_at: '2026-10-01T00:00:00Z' },
  { user_id: 'u2', email: 'b@ejemplo.com', familia_id: 'fb', familia: 'Familia B', created_at: '2026-10-02T00:00:00Z' }
];

// Superadmin logueado: lee su fila de superadmins y todas las familias (eso le devuelve RLS).
async function comoSuperadmin(win, tablas = {}) {
  const sbMock = mockSb(
    Object.assign({ superadmins: [{ user_id: 's1' }], familias: FAMILIAS }, tablas),
    { admin_miembros: { data: MIEMBROS, error: null } }
  );
  win.sb = sbMock.client;
  await win.cargarPerfil();
  return sbMock;
}

const accionesVisibles = win => [...win.document.querySelectorAll('#app [data-action]')].map(b => b.getAttribute('data-action'));

describe('Perfil al entrar', () => {
  let win;
  beforeEach(() => { win = loadApp(); });

  it('superadmin: solo lectura, arranca en la primera familia y carga los miembros', async () => {
    await comoSuperadmin(win);
    expect(win.STATE.esSuperadmin).toBe(true);
    expect(win.STATE.soloLectura).toBe(true);
    expect(win.STATE.sinFamilia).toBe(false);
    expect(win.STATE.familiaSeleccionadaId).toBe('fa');
    expect(win.STATE.adminMiembros).toHaveLength(2);
  });

  it('superadmin: recuerda la última familia elegida en ese navegador', async () => {
    win.localStorage.setItem('controlFamiliaSuperadmin', 'fb');
    await comoSuperadmin(win);
    expect(win.STATE.familiaSeleccionadaId).toBe('fb');
  });

  it('superadmin: si la familia guardada ya no existe, vuelve a la primera', async () => {
    win.localStorage.setItem('controlFamiliaSuperadmin', 'borrada');
    await comoSuperadmin(win);
    expect(win.STATE.familiaSeleccionadaId).toBe('fa');
  });

  it('miembro: ve su familia (RLS) y puede escribir', async () => {
    win.sb = mockSb({ superadmins: [], familias: [FAMILIAS[0]] }).client;
    await win.cargarPerfil();
    expect(win.STATE.esSuperadmin).toBe(false);
    expect(win.STATE.soloLectura).toBe(false);
    expect(win.STATE.sinFamilia).toBe(false);
    expect(win.STATE.familiaSeleccionadaId).toBe(null);
  });

  it('sin familia: no ve la app, ve un aviso y puede cerrar sesión', async () => {
    win.sb = mockSb({ superadmins: [], familias: [] }).client;
    win.STATE.usuarioEmail = 'suelto@ejemplo.com';
    await win.cargarPerfil();
    expect(win.STATE.sinFamilia).toBe(true);
    win.STATE.ready = true;
    win.render();
    const texto = win.document.getElementById('app').textContent;
    expect(texto).toContain('no está asignado a ninguna familia');
    expect(texto).toContain('suelto@ejemplo.com');
    expect(accionesVisibles(win)).toEqual(['cerrar-sesion']);
  });
});

describe('Superadmin: datos de la familia elegida', () => {
  it('filtra por familia las tablas de datos, pero no familias ni superadmins', async () => {
    const win = loadApp();
    const sbMock = await comoSuperadmin(win, {
      centros: [{ id: 'ca', familia_id: 'fa', codigo: 'A', nombre: 'Centro A' }, { id: 'cb', familia_id: 'fb', codigo: 'B', nombre: 'Centro B' }]
    });
    expect(sbMock.selects.find(s => s.table === 'familias').filtros).toEqual([]);
    await win.cargarTodo();
    expect(win.STATE.centros.map(c => c.id)).toEqual(['ca']);
    expect(sbMock.selects.find(s => s.table === 'centros').filtros).toEqual([['familia_id', 'fa']]);
  });

  it('al cambiar de familia recarga sus datos y limpia los filtros', async () => {
    const win = loadApp();
    await comoSuperadmin(win, {
      centros: [{ id: 'ca', familia_id: 'fa', codigo: 'A', nombre: 'Centro A' }, { id: 'cb', familia_id: 'fb', codigo: 'B', nombre: 'Centro B' }]
    });
    await win.cargarTodo();
    win.STATE.ready = true;
    win.STATE.filtros.texto = 'algo';
    await win.elegirFamilia('fb');
    expect(win.STATE.centros.map(c => c.id)).toEqual(['cb']);
    expect(win.STATE.filtros.texto).toBe('');
    expect(win.localStorage.getItem('controlFamiliaSuperadmin')).toBe('fb');
    expect(win.document.getElementById('sel-familia').value).toBe('fb');
  });
});

describe('Superadmin: solo lectura', () => {
  let win, sbMock;
  beforeEach(async () => {
    win = loadApp();
    seedBase(win);
    sbMock = await comoSuperadmin(win);
    win.STATE.movimientos = [
      { id: 'm1', fecha: '2026-10-01', centroId: 'c-ef', categoriaId: '', subcategoriaId: '', proveedor: 'Sin categoría', detalle: '', ingreso: 0, egreso: 100, moneda: 'ARS' }
    ];
    win.STATE.ready = true;
  });

  it('no muestra Importar ni los botones de alta; sí Administración y el selector de familia', () => {
    win.render();
    const tabs = [...win.document.querySelectorAll('[data-tab]')].map(t => t.getAttribute('data-tab'));
    expect(tabs).not.toContain('importar');
    expect(tabs).toContain('admin');
    expect(accionesVisibles(win)).not.toContain('abrir-nuevo-mov');
    expect(accionesVisibles(win)).not.toContain('abrir-efectivo');
    const opciones = [...win.document.querySelectorAll('#sel-familia option')].map(o => o.textContent);
    expect(opciones).toEqual(['Familia A', 'Familia B']);
  });

  it('en cada pestaña solo quedan acciones de lectura', () => {
    for (const tab of ['resumen', 'movimientos', 'vencimientos', 'saldos', 'flujo', 'usdt', 'dolares', 'gimnasio', 'abm', 'admin']) {
      win.STATE.activeTab = tab;
      win.render();
      for (const accion of accionesVisibles(win)) expect([tab, win.ACCIONES_LECTURA.includes(accion)]).toEqual([tab, true]);
    }
  });

  it('ABM: se ve el listado de centros, sin el formulario de alta ni editar/borrar', () => {
    win.STATE.activeTab = 'abm';
    win.STATE.abmSubTab = 'centros';
    win.render();
    const app = win.document.getElementById('app');
    expect(app.textContent).toContain('Efectivo Franco');
    expect(win.document.getElementById('f-centro-codigo').closest('.card').style.display).toBe('none');
    expect(accionesVisibles(win)).not.toContain('edit-centro');
    expect(accionesVisibles(win)).not.toContain('del-centro');
  });

  it('Movimientos: los campos editables de la tabla quedan deshabilitados', () => {
    win.STATE.activeTab = 'movimientos';
    win.STATE.filtros.soloIncompletos = true; // ahí la tabla muestra selects/inputs para categorizar en línea
    win.render();
    const editables = [...win.document.querySelectorAll('#tabla-movimientos [data-field]')];
    expect(editables.length).toBeGreaterThan(0);
    expect(editables.every(el => el.disabled)).toBe(true);
  });

  it('ignora las acciones de escritura aunque lleguen', async () => {
    await win.handleAction('del-centro', 'c-ef');
    expect(win.STATE.confirmState).toBe(null);
    await win.handleAction('abrir-nuevo-mov');
    expect(win.STATE.nuevoMovAbierto).toBe(false);
    expect(sbMock.calls.filter(c => c.op !== 'rpc')).toHaveLength(0);
  });

  it('y si algo llegara a escribir, la capa de datos lo frena', async () => {
    await expect(win.dbInsert('centros', { codigo: 'X' })).rejects.toThrow('solo lectura');
    await expect(win.dbUpdate('centros', 'c-ef', { nombre: 'X' })).rejects.toThrow('solo lectura');
    await expect(win.dbDelete('centros', 'c-ef')).rejects.toThrow('solo lectura');
    expect(sbMock.calls.filter(c => c.op !== 'rpc')).toHaveLength(0);
  });

  it('Administración: lista familias (con cantidad de miembros) y miembros con su email', () => {
    win.STATE.activeTab = 'admin';
    win.render();
    const texto = win.document.getElementById('app').textContent;
    expect(texto).toContain('Familias (2)');
    expect(texto).toContain('Miembros (2)');
    expect(texto).toContain('a@ejemplo.com');
    expect(texto).toContain('b@ejemplo.com');
    expect(accionesVisibles(win)).toContain('descargar-backup');
    expect(accionesVisibles(win)).toContain('restaurar-backup-preview');
  });

  it('Administración: restaurar pide confirmación y manda solo la familia elegida', async () => {
    sbMock = mockSb({ superadmins: [{ user_id: 's1' }], familias: FAMILIAS },
      { admin_miembros: { data: MIEMBROS, error: null }, restaurar_familia: { data: { centros: 1 }, error: null } });
    win.sb = sbMock.client;
    win.STATE.activeTab = 'admin';
    win.STATE.backupArchivo = {
      version: 3, familias: FAMILIAS,
      centros: [{ id: 'ca', familia_id: 'fa' }, { id: 'cb', familia_id: 'fb' }]
    };
    win.STATE.backupFamiliaRestaurar = 'fa';
    win.render();
    win.document.getElementById('backup-familia').value = 'fb';
    await win.handleAction('restaurar-familia');
    expect(win.STATE.confirmState.message).toContain('Familia B');
    await win.handleAction('confirm-yes');
    const rpc = sbMock.calls.find(c => c.nombre === 'restaurar_familia');
    expect(rpc.args.p_familia_id).toBe('fb');
    expect(rpc.args.p_datos.centros.map(r => r.id)).toEqual(['cb']);
    expect(win.STATE.backupMsg).toEqual({ type: 'ok', text: 'Familia restaurada: 1 fila(s) agregadas o actualizadas.' });
    expect(win.STATE.familiaSeleccionadaId).toBe('fb');
    expect(win.STATE.backupArchivo).toBe(null);
  });
});

describe('Miembro de una familia', () => {
  let win;
  beforeEach(async () => {
    win = loadApp();
    seedBase(win);
    win.sb = mockSb({ superadmins: [], familias: [FAMILIAS[0]] }).client;
    await win.cargarPerfil();
    win.STATE.ready = true;
  });

  it('no tiene Administración, ni selector de familia, ni backup en el ABM', () => {
    win.STATE.activeTab = 'abm';
    win.render();
    const tabs = [...win.document.querySelectorAll('[data-tab]')].map(t => t.getAttribute('data-tab'));
    expect(tabs).not.toContain('admin');
    expect(tabs).toContain('importar');
    expect(win.document.getElementById('sel-familia')).toBe(null);
    const subtabs = [...win.document.querySelectorAll('[data-subtab]')].map(t => t.getAttribute('data-subtab'));
    expect(subtabs).not.toContain('backup');
    expect(accionesVisibles(win)).toContain('abrir-nuevo-mov');
  });

  it('no puede disparar las acciones del superadmin', async () => {
    win.STATE.backupArchivo = { version: 3, familias: FAMILIAS, centros: [] };
    await win.handleAction('restaurar-familia');
    expect(win.STATE.confirmState).toBe(null);
  });
});
