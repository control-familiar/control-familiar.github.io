import { describe, it, expect } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';

// Cubre lo más básico pero más fácil de romper sin darse cuenta: que cada pestaña
// renderice sin tirar una excepción, tanto con datos como completamente vacía.
describe('render de cada pestaña', () => {
  const tabs = ['movimientos', 'importar', 'vencimientos', 'saldos', 'resumen', 'flujo', 'dolares', 'abm'];

  it('no explota con datos cargados, para ninguna pestaña', () => {
    const win = loadApp();
    seedBase(win);
    for (const tab of tabs) {
      win.STATE.activeTab = tab;
      expect(() => win.render(), `pestaña "${tab}"`).not.toThrow();
      expect(win.document.getElementById('app').innerHTML).toContain('topbar-titulo');
    }
  });

  it('no explota completamente vacía (sin centros/categorías/movimientos)', () => {
    const win = loadApp();
    win.STATE.ready = true;
    for (const tab of tabs) {
      win.STATE.activeTab = tab;
      expect(() => win.render(), `pestaña "${tab}" vacía`).not.toThrow();
    }
  });

  it('ABM: recorre las 3 sub-pestañas (centros/categorías/subcategorías) sin explotar', () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.activeTab = 'abm';
    for (const sub of ['centros', 'categorias', 'subcategorias']) {
      win.STATE.abmSubTab = sub;
      expect(() => win.render(), `ABM sub-pestaña "${sub}"`).not.toThrow();
    }
  });

  it('el modal de Nuevo movimiento y el de Cargar efectivo renderizan sin explotar', () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.nuevoMovAbierto = true;
    expect(() => win.render()).not.toThrow();
    win.STATE.nuevoMovAbierto = false;

    win.STATE.efectivoAbierto = true;
    expect(() => win.render()).not.toThrow();
  });

  it('muestra la pantalla de login (no la app) cuando no hay sesión', () => {
    const win = loadApp();
    // sb es null en el harness de tests (ver loadApp.js) -> initAuth cae a mostrarLogin().
    return win.initAuth().then(() => {
      expect(win.document.getElementById('loginWrap').style.display).not.toBe('none');
      expect(win.document.getElementById('app').style.display).toBe('none');
    });
  });
});
