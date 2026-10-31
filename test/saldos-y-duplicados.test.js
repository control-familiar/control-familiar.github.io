import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';

let win;
beforeEach(() => { win = loadApp(); });

describe('montoSignedMovimiento / montosIguales / normalizarProveedor', () => {
  it('un movimiento con ingreso da positivo, uno con egreso da negativo', () => {
    expect(win.montoSignedMovimiento({ ingreso: 100, egreso: 0 })).toBe(100);
    expect(win.montoSignedMovimiento({ ingreso: 0, egreso: 50 })).toBe(-50);
    expect(win.montoSignedMovimiento({ ingreso: 0, egreso: 0 })).toBe(-0);
  });

  it('montosIguales compara redondeando a centavos (evita errores de punto flotante)', () => {
    expect(win.montosIguales(0.1 + 0.2, 0.3)).toBe(true);
    expect(win.montosIguales(100, 100.004)).toBe(true);
    expect(win.montosIguales(100, 100.01)).toBe(false);
  });
});

describe('existeMovimientoIgual / calcularDuplicados', () => {
  beforeEach(() => {
    win.STATE.movimientos = [
      { id: 'm1', fecha: '2026-08-01', centroId: 'c1', proveedor: 'Supermercado La Anonima', ingreso: 0, egreso: 1000 },
    ];
  });

  it('detecta un movimiento existente igual (mismo día, centro y monto; el proveedor no se compara)', () => {
    expect(win.existeMovimientoIgual('2026-08-01', 'c1', 'SUPERMERCADO LA ANONIMA', -1000)).toBe(true);
    // el proveedor puede venir distinto (p. ej. lo editó el usuario después de importar) y sigue marcando duplicado
    expect(win.existeMovimientoIgual('2026-08-01', 'c1', 'Otro proveedor', -1000)).toBe(true);
  });

  it('no lo considera igual si difiere el centro o el monto', () => {
    expect(win.existeMovimientoIgual('2026-08-01', 'c2', 'Supermercado La Anonima', -1000)).toBe(false);
    expect(win.existeMovimientoIgual('2026-08-01', 'c1', 'Supermercado La Anonima', -999)).toBe(false);
  });

  it('sin fecha o centro nunca marca como duplicado', () => {
    expect(win.existeMovimientoIgual('', 'c1', 'Supermercado La Anonima', -1000)).toBe(false);
    expect(win.existeMovimientoIgual('2026-08-01', '', 'Supermercado La Anonima', -1000)).toBe(false);
  });

  it('calcularDuplicados marca tanto los que ya existen guardados como los repetidos dentro del mismo lote', () => {
    const filas = [
      { id: 'f1', fecha: '2026-08-01', centroId: 'c1', proveedor: 'Supermercado La Anonima', monto: -1000 }, // ya existe
      { id: 'f2', fecha: '2026-08-02', centroId: 'c1', proveedor: 'Netflix', monto: -500 }, // único
      { id: 'f3', fecha: '2026-08-03', centroId: 'c1', proveedor: 'Spotify', monto: -200 }, // repetido dentro del lote...
      { id: 'f4', fecha: '2026-08-03', centroId: 'c1', proveedor: 'SPOTIFY', monto: -200 }, // ...con f3
    ];
    expect(win.calcularDuplicados(filas)).toEqual({ f1: true, f3: true, f4: true });
  });
});

describe('calcularSaldos', () => {
  let restoreNow;
  beforeEach(() => {
    restoreNow = mockNow(win, new win.Date(2026, 7, 9)); // hoy = 2026-08-09
    win.STATE.centros = [
      { id: 'cA', codigo: 'EA', nombre: 'Efectivo Ana', titularId: 'u-ana' },
      { id: 'cF', codigo: 'EF', nombre: 'Efectivo Franco', titularId: 'u-franco' },
      { id: 'cX', codigo: 'CX', nombre: 'Cuenta Compartida' },
      { id: 'cY', codigo: 'XA', nombre: 'De alguien que ya no está', titularId: 'u-se-fue' },
    ];
    win.STATE.miembrosFamilia = [{ userId: 'u-franco', nombre: 'Franco' }, { userId: 'u-ana', nombre: 'Ana' }];
  });
  afterEach(() => { restoreNow(); });

  it('suma ingresos y resta egresos por centro, agrupando por titular (un usuario de la familia) y "Sin titular"', () => {
    win.STATE.movimientos = [
      { fecha: '2026-08-01', centroId: 'cA', ingreso: 1000, egreso: 0 },
      { fecha: '2026-08-02', centroId: 'cA', ingreso: 0, egreso: 300 },
      { fecha: '2026-08-01', centroId: 'cF', ingreso: 500, egreso: 0 },
      { fecha: '2026-08-01', centroId: 'cX', ingreso: 200, egreso: 0 },
      { fecha: '2026-08-01', centroId: 'cY', ingreso: 10, egreso: 0 },
      { fecha: '2026-08-01', centroId: null, ingreso: 50, egreso: 0 }, // sin centro asignado
    ];
    const s = win.calcularSaldos();
    expect(s.filas.find(function(f){ return f.id === 'cA'; }).saldo).toBe(700);
    expect(s.filas.find(function(f){ return f.id === 'cF'; }).saldo).toBe(500);
    expect(s.filas.find(function(f){ return f.id === 'cX'; }).saldo).toBe(200);
    expect(s.saldoSinCentro).toBe(50);
    // un grupo por titular, ordenado por nombre; "Sin titular" al final con cX, cY (su titular ya no es
    // de la familia) y lo que no tiene centro. El código del centro ya no dice nada del titular.
    expect(s.grupos.map(g => [g.titulo, g.total])).toEqual([['Ana', 700], ['Franco', 500], ['Sin titular', 260]]);
    expect(s.grupos[2].filas.map(f => f.id)).toEqual(['cX', 'cY']);
    expect(s.totalGeneral).toBe(1460);
  });

  it('ignora movimientos con fecha futura (pendientes) para el cálculo del saldo', () => {
    win.STATE.movimientos = [
      { fecha: '2026-08-01', centroId: 'cA', ingreso: 1000, egreso: 0 },
      { fecha: '2026-09-01', centroId: 'cA', ingreso: 5000, egreso: 0 }, // futuro respecto al 2026-08-09 mockeado
    ];
    const s = win.calcularSaldos();
    expect(s.filas.find(function(f){ return f.id === 'cA'; }).saldo).toBe(1000);
  });

  it('los movimientos de categorías Solo control sí mueven el saldo (solo quedan afuera de los reportes)', () => {
    win.STATE.categorias = [{ id: 'cat-ctrl', nombre: 'Control', tipo: 'control' }];
    win.STATE.movimientos = [
      { fecha: '2026-08-01', centroId: 'cA', ingreso: 1000, egreso: 0 },
      { fecha: '2026-08-02', centroId: 'cA', categoriaId: 'cat-ctrl', ingreso: 0, egreso: 400 },
    ];
    const s = win.calcularSaldos();
    expect(s.filas.find(function(f){ return f.id === 'cA'; }).saldo).toBe(600);
  });
});

describe('esTipoCategoria / esCategoriaInversion / esCategoriaSueldo', () => {
  beforeEach(() => {
    win.STATE.categorias = [
      { id: 'c1', nombre: 'Sueldo', tipo: 'sueldo' },
      { id: 'c2', nombre: 'Obra', tipo: 'inversion' },
      { id: 'c3', nombre: 'Comida', tipo: '' },
      { id: 'c4', nombre: 'Obra', tipo: '' },
    ];
  });

  it('esTipoCategoria compara el campo tipo de la categoría', () => {
    expect(win.esTipoCategoria('c1', 'sueldo')).toBe(true);
    expect(win.esTipoCategoria('c3', 'sueldo')).toBe(false);
    expect(win.esTipoCategoria('inexistente', 'sueldo')).toBe(false);
  });

  it('esCategoriaInversion / esCategoriaSueldo usan el tipo, no el nombre', () => {
    expect(win.esCategoriaInversion('c2')).toBe(true);
    expect(win.esCategoriaInversion('c4')).toBe(false); // se llama "Obra" pero es Normal
    expect(win.esCategoriaInversion('c1')).toBe(false);
    expect(win.esCategoriaSueldo('c1')).toBe(true);
    expect(win.esCategoriaSueldo('c2')).toBe(false);
  });

  it('esCategoriaFueraDeReportes: TEC y Solo control quedan afuera de los reportes', () => {
    win.STATE.categorias.push({ id: 'c6', nombre: 'Transferencia', tipo: 'tec' }, { id: 'c7', nombre: 'Control', tipo: 'control' });
    expect(win.esCategoriaFueraDeReportes('c6')).toBe(true);
    expect(win.esCategoriaFueraDeReportes('c7')).toBe(true);
    expect(win.esCategoriaFueraDeReportes('c2')).toBe(false);
    expect(win.esCategoriaFueraDeReportes('c3')).toBe(false);
  });

  it('cuentaEnTotalesMovimientos: Solo control solo suma si se filtra por esa categoría', () => {
    win.STATE.categorias.push({ id: 'c6', nombre: 'Transferencia', tipo: 'tec' }, { id: 'c7', nombre: 'Control', tipo: 'control' });
    expect(win.cuentaEnTotalesMovimientos({ categoriaId: 'c3' }, [])).toBe(true);
    expect(win.cuentaEnTotalesMovimientos({ categoriaId: 'c6' }, [])).toBe(false);
    expect(win.cuentaEnTotalesMovimientos({ categoriaId: 'c6' }, ['c6'])).toBe(false);
    expect(win.cuentaEnTotalesMovimientos({ categoriaId: 'c7' }, [])).toBe(false);
    expect(win.cuentaEnTotalesMovimientos({ categoriaId: 'c7' }, ['c3'])).toBe(false);
    expect(win.cuentaEnTotalesMovimientos({ categoriaId: 'c7' }, ['c7'])).toBe(true);
  });

  it('etiquetaInversion usa los nombres de las categorías de tipo Inversión', () => {
    expect(win.etiquetaInversion()).toBe('Obra');
    win.STATE.categorias.push({ id: 'c5', nombre: 'Auto', tipo: 'inversion' });
    expect(win.etiquetaInversion()).toBe('Obra + Auto');
    win.STATE.categorias = [];
    expect(win.etiquetaInversion()).toBe('Inversión');
  });
});
