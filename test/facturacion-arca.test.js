import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { prenderTodo } from './helpers/fixtures.js';

let win;
beforeEach(() => { win = loadApp(); prenderTodo(win); });

describe('acumuladoFacturado12Meses', () => {
  it('suma solo las facturas emitidas dentro de los 12 meses móviles hasta la fecha de referencia', () => {
    const facturas = [
      { fecha: '2025-09-01', importe: 100000, estado: 'emitida' },  // justo en el borde, entra
      { fecha: '2025-08-31', importe: 999999, estado: 'emitida' },  // un día antes del borde, no entra
      { fecha: '2026-08-01', importe: 200000, estado: 'emitida' },
      { fecha: '2026-08-15', importe: 300000, estado: 'error' },    // no cuenta: no está emitida
      { fecha: '2026-09-02', importe: 400000, estado: 'emitida' },  // posterior a la fecha de referencia, no entra
    ];
    expect(win.acumuladoFacturado12Meses(facturas, '2026-09-01')).toBe(300000);
  });

  it('devuelve 0 si no hay facturas emitidas', () => {
    expect(win.acumuladoFacturado12Meses([], '2026-08-31')).toBe(0);
    expect(win.acumuladoFacturado12Meses([{ fecha: '2026-08-01', importe: 100, estado: 'error' }], '2026-08-31')).toBe(0);
  });
});

describe('esVentaUsdtFacturable', () => {
  it('no es facturable si Facturación ARCA está apagada, o si está prendida pero USDT no', () => {
    win.STATE.categorias = [{ id: 'cvu', nombre: 'Cripto', tipo: 'venta_usdt' }];
    win.STATE.facturas = [];
    const mov = { id: 'm1', categoriaId: 'cvu', ingreso: 50000 };
    win.STATE.configuracion = [{ clave: 'feature.facturacion_arca', valor: 'false' }];
    expect(win.esVentaUsdtFacturable(mov)).toBe(false);
    win.STATE.configuracion = [{ clave: 'feature.usdt', valor: 'false' }];
    expect(win.funcionActiva('facturacion_arca')).toBe(false);
    expect(win.esVentaUsdtFacturable(mov)).toBe(false);
  });

  beforeEach(() => {
    // La venta de USDT se reconoce por el tipo de la categoría, no por el nombre (D6)
    win.STATE.categorias = [{ id: 'c1', nombre: 'Ingresos' }, { id: 'cvu', nombre: 'Cripto', tipo: 'venta_usdt' }, { id: 'cnom', nombre: 'Venta USDT' }];
  });

  it('es facturable un movimiento de Venta USDT con ingreso positivo y sin factura emitida', () => {
    win.STATE.facturas = [];
    const mov = { id: 'm1', categoriaId: 'cvu', ingreso: 50000 };
    expect(win.esVentaUsdtFacturable(mov)).toBe(true);
  });

  it('no es facturable si ya tiene una factura emitida en producción', () => {
    win.STATE.facturas = [{ id: 'f1', movimientoId: 'm1', estado: 'emitida', ambiente: 'produccion' }];
    const mov = { id: 'm1', categoriaId: 'cvu', ingreso: 50000 };
    expect(win.esVentaUsdtFacturable(mov)).toBe(false);
  });

  it('sigue siendo facturable si la única factura previa quedó en error (se puede reintentar)', () => {
    win.STATE.facturas = [{ id: 'f1', movimientoId: 'm1', estado: 'error', ambiente: 'produccion' }];
    const mov = { id: 'm1', categoriaId: 'cvu', ingreso: 50000 };
    expect(win.esVentaUsdtFacturable(mov)).toBe(true);
  });

  it('sigue siendo facturable si la única factura emitida fue una prueba en homologación', () => {
    win.STATE.facturas = [{ id: 'f1', movimientoId: 'm1', estado: 'emitida', ambiente: 'homologacion' }];
    const mov = { id: 'm1', categoriaId: 'cvu', ingreso: 50000 };
    expect(win.esVentaUsdtFacturable(mov)).toBe(true);
  });

  it('no es facturable si la categoría no es de tipo Venta de USDT (aunque se llame así) o el ingreso no es positivo', () => {
    win.STATE.facturas = [];
    expect(win.esVentaUsdtFacturable({ id: 'm1', categoriaId: 'c1', ingreso: 50000 })).toBe(false);
    expect(win.esVentaUsdtFacturable({ id: 'm1', categoriaId: 'cnom', ingreso: 50000 })).toBe(false);
    expect(win.esVentaUsdtFacturable({ id: 'm1', categoriaId: 'cvu', ingreso: 0 })).toBe(false);
  });
});

describe('limiteCategoriaB', () => {
  it('lee el valor numérico configurado', () => {
    win.STATE.configuracion = [{ clave: 'monotributo_limite_categoria_b', valor: '1400000' }];
    expect(win.limiteCategoriaB()).toBe(1400000);
  });

  it('devuelve 0 si todavía no está configurado', () => {
    win.STATE.configuracion = [];
    expect(win.limiteCategoriaB()).toBe(0);
  });
});

// abrirComprobante en sí no se testea acá: depende de window.QRCode (cargado por CDN, sacado en
// loadApp.js para no pegarle a la red en los tests) y de window.open/document.write. Lo que sí es
// lógica pura y vale la pena testear es el payload que arma el contenido del QR.
describe('armarPayloadQrFactura', () => {
  it('arma el payload del QR con Consumidor Final fijo y el tipo de comprobante correcto', () => {
    const factura = {
      fecha: '2026-09-01', puntoVenta: 2, numero: 1, tipoComprobante: 'C',
      importe: 635720, cae: '86350846763165',
    };
    expect(win.armarPayloadQrFactura(factura, '27357665278')).toEqual({
      ver: 1, fecha: '2026-09-01', cuit: 27357665278, ptoVta: 2, tipoCmp: 11, nroCmp: 1,
      importe: 635720, moneda: 'PES', ctz: 1, tipoDocRec: 99, nroDocRec: 0,
      tipoCodAut: 'E', codAut: 86350846763165,
    });
  });

  it('redondea el importe a dos decimales', () => {
    const factura = { fecha: '2026-09-01', puntoVenta: 2, numero: 1, tipoComprobante: 'C', importe: 635720.456, cae: '1' };
    expect(win.armarPayloadQrFactura(factura, '27357665278').importe).toBe(635720.46);
  });
});
