import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

// Round-trip de los mappers toDbX/fromDbX: si `schema.sql` cambia un nombre de columna
// sin actualizar el mapper correspondiente, estos tests lo detectan.

let win;
beforeEach(() => { win = loadApp(); });

describe('centro', () => {
  it('toDbCentro -> fromDbCentro conserva los datos', () => {
    const centro = { id: 'c1', codigo: 'EF', nombre: 'Efectivo Franco', color: '#4E9D77', colorTexto: '#fff', entidad: 'santander', moneda: 'AMBAS' };
    expect(win.fromDbCentro(win.toDbCentro(centro))).toEqual(centro);
  });
  it('color/colorTexto/entidad ausentes se guardan como null y vuelven como string vacío', () => {
    const row = win.toDbCentro({ id: 'c1', codigo: 'EF', nombre: 'Efectivo Franco' });
    expect(row.color).toBeNull();
    expect(row.color_texto).toBeNull();
    expect(row.entidad).toBeNull();
    expect(win.fromDbCentro(row)).toEqual({ id: 'c1', codigo: 'EF', nombre: 'Efectivo Franco', color: '', colorTexto: '', entidad: '', moneda: 'ARS' });
  });
  it('la moneda solo se manda cuando no es pesos (anda aunque falte migracion_dolares.sql)', () => {
    expect(win.toDbCentro({ id: 'c1', codigo: 'EF', nombre: 'Efectivo Franco', moneda: 'ARS' })).not.toHaveProperty('moneda');
    expect(win.toDbCentro({ id: 'c1', codigo: 'USA', nombre: 'Dólares Ana', moneda: 'USD' }).moneda).toBe('USD');
  });
});

describe('categoria', () => {
  it('toDbCategoria -> fromDbCategoria conserva los datos', () => {
    const categoria = { id: 'cat1', nombre: 'Comida', tipo: 'egreso', color: '#D97B6C', colorTexto: '' };
    expect(win.fromDbCategoria(win.toDbCategoria(categoria))).toEqual(categoria);
  });
});

describe('subcategoria', () => {
  it('toDbSubcategoria usa categoria_id (snake_case) y vuelve como categoriaId', () => {
    const sub = { id: 's1', categoriaId: 'cat1', nombre: 'Supermercado' };
    const row = win.toDbSubcategoria(sub);
    expect(row).toEqual({ id: 's1', categoria_id: 'cat1', nombre: 'Supermercado' });
    expect(win.fromDbSubcategoria(row)).toEqual(sub);
  });
});

describe('movimiento', () => {
  it('toDbMovimiento -> fromDbMovimiento conserva todos los campos, incluida la tarjeta', () => {
    const mov = {
      id: 'm1', fecha: '2026-08-09', centroId: 'c1', categoriaId: 'cat1', subcategoriaId: 's1',
      proveedor: 'Netflix', detalle: 'Suscripción mensual', ingreso: 0, egreso: 890,
      tarjeta: true, fechaConsumo: '2026-08-01', tarjetaMarca: 'Visa', cuotas: '3/6', moneda: 'ARS', cambioId: '',
    };
    expect(win.fromDbMovimiento(win.toDbMovimiento(mov))).toEqual(mov);
  });

  it('un movimiento en dólares conserva moneda y cambio_id; uno en pesos no los manda', () => {
    const usd = {
      id: 'm2', fecha: '2026-08-09', centroId: 'c1', categoriaId: '', subcategoriaId: '', proveedor: 'Compra USD', detalle: '',
      ingreso: 100, egreso: 0, tarjeta: false, fechaConsumo: '', tarjetaMarca: '', cuotas: '', moneda: 'USD', cambioId: 'k1',
    };
    const row = win.toDbMovimiento(usd);
    expect(row).toMatchObject({ moneda: 'USD', cambio_id: 'k1' });
    expect(win.fromDbMovimiento(row)).toEqual(usd);
    const ars = win.toDbMovimiento({ id: 'm3', fecha: '2026-08-09', ingreso: 0, egreso: 10 });
    expect(ars).not.toHaveProperty('moneda');
    expect(ars).not.toHaveProperty('cambio_id');
  });

  it('ingreso/egreso siempre se guardan como número, aunque vengan como string o vacíos', () => {
    const row = win.toDbMovimiento({ id: 'm1', fecha: '2026-08-09', ingreso: '1234,56'.replace(',', '.'), egreso: '' });
    expect(row.ingreso).toBe(1234.56);
    expect(row.egreso).toBe(0);
  });

  it('IDs de referencia ausentes se guardan como null y vuelven como string vacío', () => {
    const row = win.toDbMovimiento({ id: 'm1', fecha: '2026-08-09', ingreso: 0, egreso: 0 });
    expect(row.centro_id).toBeNull();
    expect(row.categoria_id).toBeNull();
    expect(row.subcategoria_id).toBeNull();
    expect(win.fromDbMovimiento(row).centroId).toBe('');
  });
});

describe('vencimiento', () => {
  it('toDbVencimiento -> fromDbVencimiento conserva los datos, con estado por defecto "pendiente"', () => {
    const venc = { id: 'v1', concepto: 'Tarjeta Visa', fecha: '2026-08-15', monto: 5000, centroId: 'c1', estado: 'pendiente' };
    expect(win.fromDbVencimiento(win.toDbVencimiento(venc))).toEqual(venc);
    expect(win.toDbVencimiento({ id: 'v1', concepto: 'X', fecha: '2026-08-15', monto: 100 }).estado).toBe('pendiente');
  });
});

describe('factura', () => {
  it('fromDbFactura mapea una factura emitida con todos los campos', () => {
    const row = {
      id: 'f1', movimiento_id: 'm1', fecha: '2026-08-09', tipo_comprobante: 'C',
      punto_venta: 4, numero: 123, importe: 50000, cae: '75312345678901',
      cae_vencimiento: '2026-08-19', estado: 'emitida', error: null, ambiente: 'homologacion', detalle: '5 USDT a $10000',
    };
    expect(win.fromDbFactura(row)).toEqual({
      id: 'f1', movimientoId: 'm1', fecha: '2026-08-09', tipoComprobante: 'C',
      puntoVenta: 4, numero: 123, importe: 50000, cae: '75312345678901',
      caeVencimiento: '2026-08-19', estado: 'emitida', error: '', ambiente: 'homologacion', detalle: '5 USDT a $10000',
    });
  });

  it('fromDbFactura rellena con vacíos/defaults una factura en error sin CAE ni número', () => {
    const row = { id: 'f1', movimiento_id: 'm1', fecha: '2026-08-09', importe: 50000, estado: 'error', error: 'Límite superado' };
    const f = win.fromDbFactura(row);
    expect(f.cae).toBe('');
    expect(f.numero).toBeNull();
    expect(f.tipoComprobante).toBe('C');
    expect(f.ambiente).toBe('homologacion');
    expect(f.error).toBe('Límite superado');
  });
});

describe('configuracion', () => {
  it('fromDbConfiguracion mapea clave/valor tal cual', () => {
    expect(win.fromDbConfiguracion({ clave: 'monotributo_limite_categoria_b', valor: '1400000' }))
      .toEqual({ clave: 'monotributo_limite_categoria_b', valor: '1400000' });
  });
});
