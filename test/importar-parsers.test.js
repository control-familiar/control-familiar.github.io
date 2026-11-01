import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';

// La mayoría de estos fixtures son reconstrucciones a mano del formato de texto que se pega al
// importar (copiado de la web/app de cada banco o tarjeta), armadas leyendo línea por línea la
// regex/máquina de estados de cada parser en app.js — no son capturas reales de las páginas de los
// bancos. Si alguna vez se cuenta con un pegado real (con montos/nombres inventados), conviene
// reemplazar el fixture correspondiente por ese texto real para subir la confianza del test.
// Excepción: los fixtures de parseTarjetaResumen (Nación/Santander) sí son texto real de resúmenes
// (con montos/comercios reales, a pedido de quien pidió esta migración), no reconstrucciones.

let win;
beforeEach(() => { win = loadApp(); });

describe('reconstructMontos', () => {
  it('reconstruye un monto partido en líneas "$" / dígitos / "," / decimales (sin separador de miles)', () => {
    const out = win.reconstructMontos(['$', '1.234', ',', '56']);
    expect(out).toEqual(['$1234,56']);
  });
  it('preserva el signo cuando viene en línea propia', () => {
    expect(win.reconstructMontos(['-', '$', '999', ',', '00'])).toEqual(['-$999,00']);
  });
  it('deja intactas las líneas que no son parte de un monto partido', () => {
    expect(win.reconstructMontos(['hola', 'chau'])).toEqual(['hola', 'chau']);
  });
});

describe('joinFechaLines', () => {
  it('colapsa un encabezado de fecha + Disponible + saldo en un token __FECHA__', () => {
    const out = win.joinFechaLines(['9 de agosto', 'Disponible', '$48.765,44', '10:30', 'Proveedor']);
    expect(out).toEqual(['__FECHA__9__agosto', '10:30', 'Proveedor']);
  });
  it('colapsa "Hoy" + Disponible + saldo en __HOY__', () => {
    const out = win.joinFechaLines(['Hoy', 'Disponible', '$100,00', '10:30']);
    expect(out).toEqual(['__HOY__', '10:30']);
  });
});

describe('procesarTexto (movimientos de cuenta, ej. Mercado Pago)', () => {
  it('arma un movimiento a partir de fecha + hora + proveedor + tipo + monto', () => {
    const raw = [
      '9 de agosto',
      'Disponible',
      '$48.765,44',
      '10:30',
      'Juan Perez',
      'Transferencia enviada',
      'Movimiento ...',
      '-$1.234,56',
    ].join('\n');
    expect(win.procesarTexto(raw, '26')).toEqual([{
      fecha: '09-08-26', proveedor: 'Juan Perez', tipo: 'Transferencia enviada',
      monto: -1234.56, ingreso: '', egreso: '1.234,56',
    }]);
  });

  it('usa la fecha de hoy y el tipo por defecto cuando el monto sigue directo al proveedor', () => {
    const restoreNow = mockNow(win, new win.Date(2026, 7, 9));
    try {
      const raw = ['Hoy', 'Disponible', '$50.000,00', '15:45', 'Kiosco Las Flores', '$2.500,00'].join('\n');
      expect(win.procesarTexto(raw, '26')).toEqual([{
        fecha: '09-08-26', proveedor: 'Kiosco Las Flores', tipo: 'Transferencia enviada',
        monto: 2500, ingreso: '2.500,00', egreso: '',
      }]);
    } finally {
      restoreNow();
    }
  });
});

// Estructura real de lo copiado de Actividad de Mercado Pago (con nombres y montos inventados).
describe('parseMercadoPago (Actividad)', () => {
  const raw = [
    '30 de octubre',
    'Juana Perez', '11:38', 'Juana Perez', 'Juana Perez', 'Transferencia recibida', 'Aprobado', '+', '$', '13.500',
    'Kiosco Uno', '07:42', 'Kiosco Uno', 'Kiosco Uno', 'Pago en tienda física', 'Dinero disponible', 'Aprobado', '-', '$', '15.100',
    '29 de octubre',
    'Pedro Gomez', '18:32', 'Pedro GomezPedro Gomez', 'Pedro Gomez', 'Transferencia enviada', 'Dinero disponible', 'Aprobado', '-', '$', '300.000',
    'Almacen Dos', '08:51', 'Almacen DosAlmacen Dos', 'Almacen Dos', 'Pago en tienda física', 'Mastercard crédito', 'Aprobado', '-', '$', '35.034', ',', '89',
    '27 de octubre',
    'Tienda Online', '20:03', 'Tienda OnlineTienda Online', 'Tienda Online', 'Devolución de dinero', '+', '$', '79.900',
    'Tienda Online', '19:57', 'Tienda OnlineTienda Online', 'Tienda Online', 'Compra', 'Mastercard crédito', 'Devuelto', '-', '$', '79.900',
    'Musica Online', '02:11', 'Musica OnlineMusica Online', 'Musica Online', 'Pago', 'Dinero disponible', 'Aprobado', '-', 'US$', '0', ',', '99',
    'Kiosco Uno', '01:10', 'Kiosco Uno', 'Kiosco Uno', 'Pago en tienda física', 'Dinero disponible', 'Aprobado', '-', '$', '1.250', ',', '50',
  ].join('\n');

  it('arma los movimientos de la cuenta y omite tarjeta, devolución con su compra y dólares', () => {
    const restoreNow = mockNow(win, new win.Date(2026, 9, 31));
    try {
      const res = win.parseMercadoPago(raw);
      expect(res.rows).toEqual([
        { fecha: '30-10-26', proveedor: 'Juana Perez', tipo: 'Transferencia recibida', monto: 13500, ingreso: '13.500,00', egreso: '' },
        { fecha: '30-10-26', proveedor: 'Kiosco Uno', tipo: 'Pago en tienda física', monto: -15100, ingreso: '', egreso: '15.100,00' },
        { fecha: '29-10-26', proveedor: 'Pedro Gomez', tipo: 'Transferencia enviada', monto: -300000, ingreso: '', egreso: '300.000,00' },
        { fecha: '27-10-26', proveedor: 'Kiosco Uno', tipo: 'Pago en tienda física', monto: -1250.5, ingreso: '', egreso: '1.250,50' },
      ]);
      expect(res.omitidas).toBe(4);
      expect(res.omitidasTexto).toContain('1 con tarjeta de crédito');
      expect(res.omitidasTexto).toContain('2 entre compras devueltas y sus devoluciones');
      expect(res.omitidasTexto).toContain('1 en dólares');
    } finally {
      restoreNow();
    }
  });

  it('una devolución sin compra devuelta al lado entra como ingreso', () => {
    const restoreNow = mockNow(win, new win.Date(2026, 9, 31));
    try {
      const solo = ['27 de octubre', 'Tienda Online', '20:03', 'Tienda Online', 'Tienda Online', 'Devolución de dinero', '+', '$', '5.000'].join('\n');
      expect(win.parseMercadoPago(solo).rows).toEqual([
        { fecha: '27-10-26', proveedor: 'Tienda Online', tipo: 'Devolución de dinero', monto: 5000, ingreso: '5.000,00', egreso: '' },
      ]);
    } finally {
      restoreNow();
    }
  });

  it('sin año en el encabezado, una fecha posterior a hoy es del año anterior', () => {
    const restoreNow = mockNow(win, new win.Date(2027, 0, 5));
    try {
      const dic = ['28 de diciembre', 'Juana Perez', '11:38', 'Juana Perez', 'Juana Perez', 'Transferencia recibida', 'Aprobado', '+', '$', '100'].join('\n');
      expect(win.parseMercadoPago(dic).rows[0].fecha).toBe('28-12-26');
    } finally {
      restoreNow();
    }
  });

  it('sigue aceptando lo copiado de Movimientos (formato anterior)', () => {
    const viejo = ['9 de agosto', 'Disponible', '$48.765,44', '10:30', 'Juan Perez', 'Transferencia enviada', '-$1.234,56'].join('\n');
    expect(win.parseMercadoPago(viejo).rows).toEqual([{
      fecha: '09-08-' + win.anioActualCorto(), proveedor: 'Juan Perez', tipo: 'Transferencia enviada',
      monto: -1234.56, ingreso: '', egreso: '1.234,56',
    }]);
  });
});

// Fixtures armados a partir de resúmenes reales de Santander y Nación (misma estructura de línea
// en los dos bancos: "dd/mm/aa detalle  [C.NN/MM]  comprobante  monto"), con comercios inventados y
// montos cambiados para no dejar información financiera real en un repo público — la estructura
// (cuotas, comprobante terminado en "*"/letra, fila con importe en USD, "SU PAGO EN PESOS" y
// "TOTAL TARJETA" a descartar, filas de impuestos/percepciones con números-señuelo en el medio del
// texto) es la misma que la de los resúmenes reales.
describe('parseTarjetaResumen (Nación/Santander)', () => {
  it('parsea un resumen de Santander: cuotas, comprobante, y descarta pago y subtotal', () => {
    const raw = [
      '07/08/26 SU PAGO EN PESOS         12.345, TC1000,000    50000,00-       10,00-',
      '04/04/26 COMERCIO UNO                C.05/06  111111*    12345,67              ',
      '21/07/26 COMERCIO DOS EJEMPLO        C.02/09  222222*   200000,00              ',
      '29/07/26 COMERCIO TRES DE PRUEBA     C.02/06  333333*    60000,00              ',
      '15/08/26 COMERCIO CUATRO             C.01/03  444444*    80000,50              ',
      '16/08/26 COMERCIO CINCO SA                    555555*    45678,90              ',
      '26/08/26 TIENDA*ONLINE                        666666K    99999,99              ',
      ' TOTAL TARJETA  0000 XXXX XXXX 0000  ......       497.424,06 *                 ',
      '27/08/26 IMPUESTO DE SELLOS        $                      6000,00',
    ].join('\n');
    const rows = win.parseTarjetaResumen(raw, '2026-08-10');
    expect(rows).toEqual([
      { fecha: '10-08-26', fechaConsumo: '04-04-26', proveedor: 'COMERCIO UNO', tipo: '', cuota: '05/06', monto: -12345.67, ingreso: '', egreso: '12.345,67' },
      { fecha: '10-08-26', fechaConsumo: '21-07-26', proveedor: 'COMERCIO DOS EJEMPLO', tipo: '', cuota: '02/09', monto: -200000, ingreso: '', egreso: '200.000,00' },
      { fecha: '10-08-26', fechaConsumo: '29-07-26', proveedor: 'COMERCIO TRES DE PRUEBA', tipo: '', cuota: '02/06', monto: -60000, ingreso: '', egreso: '60.000,00' },
      { fecha: '10-08-26', fechaConsumo: '15-08-26', proveedor: 'COMERCIO CUATRO', tipo: '', cuota: '01/03', monto: -80000.50, ingreso: '', egreso: '80.000,50' },
      { fecha: '10-08-26', fechaConsumo: '16-08-26', proveedor: 'COMERCIO CINCO SA', tipo: '', cuota: '', monto: -45678.90, ingreso: '', egreso: '45.678,90' },
      { fecha: '10-08-26', fechaConsumo: '26-08-26', proveedor: 'TIENDA*ONLINE', tipo: '', cuota: '', monto: -99999.99, ingreso: '', egreso: '99.999,99' },
      { fecha: '10-08-26', fechaConsumo: '27-08-26', proveedor: 'IMPUESTO DE SELLOS', tipo: '', cuota: '', monto: -6000, ingreso: '', egreso: '6.000,00' },
    ]);
  });

  it('parsea un resumen de Nación: fila con importe en USD y filas de impuestos/percepciones', () => {
    const raw = [
      '05/08/26 SU PAGO EN PESOS         11.111, TC1000,000    40000,00-       10,00-',
      '14/03/26 TIENDA EJEMPLO WEB           C.06/18  100001*    15000,25              ',
      '16/03/26 TIENDA EJEMPLO WEB           C.06/18  100002*   123456,78              ',
      '11/05/26 COMERCIO HOGAR               C.04/06  100003*     8888,88              ',
      '06/06/26 COMERCIO JUGUETES            C.03/03  100004*    25000,00              ',
      '25/06/26 COMERCIO ROPA                C.02/03  100005*    31000,00              ',
      '23/07/26 COMERCIO VARIOS SUC 100               100006*   150000,00              ',
      '28/07/26 BILLETERA*SERVICIOVARIOS              100007K    77777,77              ',
      '08/08/26 SERVICIO CLOUD SUBS USD      15,00 100008K                    15,00 ',
      '12/08/26 Musica Streaming                      100009V     4999,00              ',
      ' TOTAL TARJETA  0000 XXXX XXXX 0000  ......       436.137,68 *          15,00 *',
      '20/08/26 IMPUESTO DE SELLOS        $                      6500,00              ',
      '20/08/26 IMPUESTO DE SELLOS      P $                       400,00              ',
      '20/08/26 IIBB PERCEP-BSAS 2,00%(    0)                     120,00              ',
      '20/08/26 IVA RG 4240 21%(    5000,00)                     1050,00              ',
      '20/08/26 DB.RG 5617  30% (    30000,00 )                  9000,00              ',
      'Plan V: abonando el pago mínimo de $       50000,00 usted puede cancelar en cuo',
      'fijas su saldo financiable de $      300000,00 en:',
    ].join('\n');
    const rows = win.parseTarjetaResumen(raw, '2026-08-25');
    expect(rows).toEqual([
      { fecha: '25-08-26', fechaConsumo: '14-03-26', proveedor: 'TIENDA EJEMPLO WEB', tipo: '', cuota: '06/18', monto: -15000.25, ingreso: '', egreso: '15.000,25' },
      { fecha: '25-08-26', fechaConsumo: '16-03-26', proveedor: 'TIENDA EJEMPLO WEB', tipo: '', cuota: '06/18', monto: -123456.78, ingreso: '', egreso: '123.456,78' },
      { fecha: '25-08-26', fechaConsumo: '11-05-26', proveedor: 'COMERCIO HOGAR', tipo: '', cuota: '04/06', monto: -8888.88, ingreso: '', egreso: '8.888,88' },
      { fecha: '25-08-26', fechaConsumo: '06-06-26', proveedor: 'COMERCIO JUGUETES', tipo: '', cuota: '03/03', monto: -25000, ingreso: '', egreso: '25.000,00' },
      { fecha: '25-08-26', fechaConsumo: '25-06-26', proveedor: 'COMERCIO ROPA', tipo: '', cuota: '02/03', monto: -31000, ingreso: '', egreso: '31.000,00' },
      { fecha: '25-08-26', fechaConsumo: '23-07-26', proveedor: 'COMERCIO VARIOS SUC 100', tipo: '', cuota: '', monto: -150000, ingreso: '', egreso: '150.000,00' },
      { fecha: '25-08-26', fechaConsumo: '28-07-26', proveedor: 'BILLETERA*SERVICIOVARIOS', tipo: '', cuota: '', monto: -77777.77, ingreso: '', egreso: '77.777,77' },
      { fecha: '25-08-26', fechaConsumo: '08-08-26', proveedor: 'SERVICIO CLOUD SUBS', tipo: '', cuota: '', monto: -15, ingreso: '', egreso: '15,00' },
      { fecha: '25-08-26', fechaConsumo: '12-08-26', proveedor: 'Musica Streaming', tipo: '', cuota: '', monto: -4999, ingreso: '', egreso: '4.999,00' },
      { fecha: '25-08-26', fechaConsumo: '20-08-26', proveedor: 'IMPUESTO DE SELLOS', tipo: '', cuota: '', monto: -6500, ingreso: '', egreso: '6.500,00' },
      { fecha: '25-08-26', fechaConsumo: '20-08-26', proveedor: 'IMPUESTO DE SELLOS P', tipo: '', cuota: '', monto: -400, ingreso: '', egreso: '400,00' },
      { fecha: '25-08-26', fechaConsumo: '20-08-26', proveedor: 'IIBB PERCEP-BSAS 2,00%( 0)', tipo: '', cuota: '', monto: -120, ingreso: '', egreso: '120,00' },
      { fecha: '25-08-26', fechaConsumo: '20-08-26', proveedor: 'IVA RG 4240 21%( 5000,00)', tipo: '', cuota: '', monto: -1050, ingreso: '', egreso: '1.050,00' },
      { fecha: '25-08-26', fechaConsumo: '20-08-26', proveedor: 'DB.RG 5617 30% ( 30000,00 )', tipo: '', cuota: '', monto: -9000, ingreso: '', egreso: '9.000,00' },
    ]);
  });
});

describe('parseTarjeta (Provincia)', () => {
  it('separa fecha, comprobante, detalle y monto de una línea de consumo', () => {
    const raw = '09.08.26 123456 SUPERMERCADO LA ANONIMA $1.234,56';
    const rows = win.parseTarjeta(raw, '2026-08-15');
    expect(rows).toEqual([{
      fecha: '15-08-26', fechaConsumo: '09-08-26', proveedor: 'SUPERMERCADO LA ANONIMA',
      tipo: '', cuota: '', monto: -1234.56, ingreso: '', egreso: '1.234,56',
    }]);
  });

  it('descarta las líneas de pago del resumen ("Su pago...") para no contarlas como consumo', () => {
    const raw = '10.07.26 SU PAGO EN PESOS $50.000,00-';
    expect(win.parseTarjeta(raw, '2026-08-15')).toEqual([]);
  });

  it('un monto con signo "-" al final indica un crédito/devolución (queda como ingreso)', () => {
    const raw = '11.07.26 DEVOLUCION TIENDA $500,00-';
    const rows = win.parseTarjeta(raw, '2026-08-15');
    expect(rows).toEqual([{
      fecha: '15-08-26', fechaConsumo: '11-07-26', proveedor: 'DEVOLUCION TIENDA',
      tipo: '', cuota: '', monto: 500, ingreso: '500,00', egreso: '',
    }]);
  });

  it('preserva la cuota en el campo "cuota" en vez de descartarla (formato "Cuota N/M" o "C.N/M")', () => {
    const rawLargo = '12.08.26 123456 SUPERMERCADO LA ANONIMA Cuota 2/5 $1.234,56';
    expect(win.parseTarjeta(rawLargo, '2026-08-15')).toEqual([{
      fecha: '15-08-26', fechaConsumo: '12-08-26', proveedor: 'SUPERMERCADO LA ANONIMA',
      tipo: '', cuota: '2/5', monto: -1234.56, ingreso: '', egreso: '1.234,56',
    }]);

    const rawCorto = '13.08.26 123456 NETFLIX.COM C.1/3 $890,00';
    expect(win.parseTarjeta(rawCorto, '2026-08-15')).toEqual([{
      fecha: '15-08-26', fechaConsumo: '13-08-26', proveedor: 'NETFLIX.COM',
      tipo: '', cuota: '1/3', monto: -890, ingreso: '', egreso: '890,00',
    }]);
  });
});

describe('parseTarjetaMercadoPago', () => {
  // Regresión del bug corregido en el commit 7ae1005: la fecha del MOVIMIENTO debe salir del
  // vencimiento tipeado (fechaOut, igual para todas las filas), y la fecha de CONSUMO debe salir
  // de la fecha propia de cada fila del resumen (distinta fila a fila).
  it('usa el vencimiento como fecha del movimiento y la fecha de la fila como fecha de consumo; omite filas en dólares', () => {
    const raw = '09/ago Supermercado La Anonima 1 de 3 4521 $ 1.234,56 '
      + '10/ago Netflix 998877 $ 890,00 '
      + '11/ago Amazon Compras 55443 US$ 12,50';
    const { rows, omitidas } = win.parseTarjetaMercadoPago(raw, '2026', '2026-08-20');

    expect(rows).toEqual([
      { fecha: '20-08-26', fechaConsumo: '09-08-26', proveedor: 'Supermercado La Anonima', tipo: '', monto: -1234.56, ingreso: '', egreso: '1.234,56' },
      { fecha: '20-08-26', fechaConsumo: '10-08-26', proveedor: 'Netflix', tipo: '', monto: -890, ingreso: '', egreso: '890,00' },
    ]);
    expect(omitidas).toBe(1);
    // la fecha del movimiento es la misma (vencimiento) en todas las filas, distinta de la de consumo
    expect(new Set(rows.map(function(r){ return r.fecha; })).size).toBe(1);
    expect(rows[0].fecha).not.toBe(rows[0].fechaConsumo);
  });
});

describe('parseProvincia', () => {
  it('lee bloques fecha + detalle + "Saldo:" + saldo + monto con signo', () => {
    const raw = [
      '09/08/2026', 'Transferencia recibida', 'Juan Perez', 'Saldo:', '$50.000,00', '$1.234,56',
      '10/08/2026', 'Pago de servicios', 'Saldo:', '$48.765,44', '-$500,00',
    ].join('\n');
    expect(win.parseProvincia(raw)).toEqual([
      { fecha: '09-08-26', proveedor: 'Transferencia recibida Juan Perez', tipo: '', monto: 1234.56, ingreso: '1.234,56', egreso: '' },
      { fecha: '10-08-26', proveedor: 'Pago de servicios', tipo: '', monto: -500, ingreso: '', egreso: '500,00' },
    ]);
  });
});

describe('parseNacion', () => {
  it('separa columnas por tab, ignora comprobantes numéricos y toma el signo del monto', () => {
    const raw = [
      '09/08/2026\t001\tTransferencia a Juan Perez\t$1.234,56',
      '10/08/2026\t002\tPago Edenor\t-$890,00',
    ].join('\n');
    expect(win.parseNacion(raw)).toEqual([
      { fecha: '09-08-26', proveedor: 'Transferencia a Juan Perez', tipo: '', monto: 1234.56, ingreso: '1.234,56', egreso: '' },
      { fecha: '10-08-26', proveedor: 'Pago Edenor', tipo: '', monto: -890, ingreso: '', egreso: '890,00' },
    ]);
  });
});

describe('parseMacro', () => {
  it('lee la tabla copiada del home banking: ignora el encabezado, el Nro. de transacción y el Saldo', () => {
    const raw = [
      'Fecha\tNro. transacción\tDescripción\tImporte\tSaldo\t',
      '30/10/2026\t1949283848\tCAPITALIZACION AH\t$ 100,79\t$ 487.767,67\t ',
      '21/10/2026\t1004048069\tTR ANSES SUAF 33637617449 881253246300826\t$ 113.829,00\t$ 487.666,88\t ',
      '14/10/2026\t973653\tMETROGAS\t-$ 8.239,33\t$ 373.837,88\t ',
      '13/10/2026\t316700\tRENTAS PROVINCIA BS.AS. INMOBI\t-$ 22.299,70\t$ 717.015,67',
    ].join('\r\n');
    expect(win.parseMacro(raw)).toEqual([
      { fecha: '30-10-26', proveedor: 'CAPITALIZACION AH', tipo: '', monto: 100.79, ingreso: '100,79', egreso: '' },
      { fecha: '21-10-26', proveedor: 'TR ANSES SUAF 33637617449 881253246300826', tipo: '', monto: 113829, ingreso: '113.829,00', egreso: '' },
      { fecha: '14-10-26', proveedor: 'METROGAS', tipo: '', monto: -8239.33, ingreso: '', egreso: '8.239,33' },
      { fecha: '13-10-26', proveedor: 'RENTAS PROVINCIA BS.AS. INMOBI', tipo: '', monto: -22299.7, ingreso: '', egreso: '22.299,70' },
    ]);
  });
});

describe('parseTarjetaGalicia', () => {
  // Mismo formato que el resumen real (copiado del PDF), con datos de personas inventados.
  const raw = [
    'DETALLE DEL CONSUMO',
    'FECHA REFERENCIA CUOTA COMPROBANTE PESOS DÓLARES',
    '25-09-26 SOUTH AMERICAN COPACAB BRL 495,72 013435 96,98',
    '27-09-26 K DL*UberRides BRL 20,94 386386 4,09',
    '13-10-26 K SUPERMERCADO DON LUIS 111955 17.462,75',
    '',
    'TARJETA 1111 Total Consumos de JUANA PEREZ 17.462,75 101,07',
    '',
    '07-08-26 * LIBRERIA NORTE-NORTELASH 03/03 465539 51.233,00',
    '',
    'Resumen N° VI00000000000000000',
    'Tarjeta Crédito VISA',
    'Página 2 / 6',
    '',
    'DETALLE DEL CONSUMO',
    '27-09-26 K OPENAI *CHATGPT in1UKGsbCUSD 6,00 794253 6,00',
    'TARJETA 2222 Total Consumos de ANA GOMEZ 51.233,00 6,00',
    '',
    '01-10-26 K CORRESUR 000000370484837 000001 3.574,20',
    '04-10-26 F UBER *TRIP HELP.UBER.COM EUR 19,75 720722 22,51',
    '11-10-26 K NETFLIX.COM 705960431USD 16,92 728209 16,92',
    '15-10-26 * SAN CRISTOBAL 1010132065921-001-007 080853 84.009,00',
    '',
    'TARJETA 3333 Total Consumos de LUIS GOMEZ 87.583,20 39,43',
    '',
    '22-10-26 IMPUESTO DE SELLOS $ 4.244,70',
    '22-10-26 IIBB PERCEP-BSAS 2,00%( 28856,66) 577,13',
    '22-10-26 IVA RG 4240 21%( 28856,66) 6.059,89',
    '22-10-26 DB.RG 5617 30% ( 337291,78 ) 101.187,53',
    'TOTAL A PAGAR 362.013,88 221,03',
  ].join('\n');

  it('importa los consumos en pesos con fecha de consumo, cuota y titular en el Detalle, y los impuestos uno por línea', () => {
    const res = win.parseTarjetaGalicia(raw, '2026-11-05');
    const resumen = res.rows.map(r => [r.fechaConsumo, r.proveedor, r.cuota, r.monto, r.tipo]);
    expect(resumen).toEqual([
      ['13-10-26', 'SUPERMERCADO DON LUIS', '', -17462.75, 'Tarjeta 1111 · JUANA PEREZ'],
      ['07-08-26', 'LIBRERIA NORTE-NORTELASH', '3/3', -51233, 'Tarjeta 2222 · ANA GOMEZ'],
      ['01-10-26', 'CORRESUR', '', -3574.2, 'Tarjeta 3333 · LUIS GOMEZ'],
      ['15-10-26', 'SAN CRISTOBAL', '', -84009, 'Tarjeta 3333 · LUIS GOMEZ'],
      ['22-10-26', 'IMPUESTO DE SELLOS', '', -4244.7, ''],
      ['22-10-26', 'IIBB PERCEP-BSAS 2,00%', '', -577.13, ''],
      ['22-10-26', 'IVA RG 4240 21%', '', -6059.89, ''],
      ['22-10-26', 'DB.RG 5617 30%', '', -101187.53, ''],
    ]);
    expect(res.rows.every(r => r.fecha === '05-11-26')).toBe(true);
    expect(res.rows[0]).toMatchObject({ egreso: '17.462,75', ingreso: '' });
  });

  it('omite los consumos en dólares (cualquier moneda extranjera) y los cuenta', () => {
    expect(win.parseTarjetaGalicia(raw, '2026-11-05').omitidas).toBe(5);
  });

  it('una devolución (importe con "-") entra como ingreso', () => {
    const res = win.parseTarjetaGalicia('20-10-26 K DEVOLUCION TIENDA 123456 -1.500,00', '2026-11-05');
    expect(res.rows[0]).toMatchObject({ proveedor: 'DEVOLUCION TIENDA', monto: 1500, ingreso: '1.500,00' });
  });
});

describe('parseGalicia (cuenta)', () => {
  it('separa el texto pegado por fecha, toma el importe con "$" e ignora el repetido y los "Saldo parcial"', () => {
    const raw = 'FechaDescripciónMonto\n' +
      '02/11/2026Transferencia a terceros-$53.000,00-53.000,00 Pesos 30/10/2026Rescate fima$2.092.975,082.092.975,08 Pesos ' +
      '16/10/2026Interes capitalizado$4,124,12 Pesos 05/10/2026Transferencia a terceros-$75.772,00\n' +
      'Saldo parcial: $50.171,93\n' +
      '-75.772,00 Pesos 28/09/2026Rescate fima$426.662,51';
    const res = win.parseGalicia(raw);
    expect(res.omitidas).toBe(0);
    expect(res.rows.map(r => [r.fecha, r.proveedor, r.monto])).toEqual([
      ['02-11-26', 'Transferencia a terceros', -53000],
      ['30-10-26', 'Rescate fima', 2092975.08],
      ['16-10-26', 'Interes capitalizado', 4.12],
      ['05-10-26', 'Transferencia a terceros', -75772],
      ['28-09-26', 'Rescate fima', 426662.51],
    ]);
    expect(res.rows[0]).toMatchObject({ tipo: '', ingreso: '', egreso: '53.000,00' });
    expect(res.rows[1]).toMatchObject({ ingreso: '2.092.975,08', egreso: '' });
  });

  it('omite y cuenta los movimientos en dólares', () => {
    const res = win.parseGalicia('02/11/2026Compra-$10,00-10,00 Dólares 01/11/2026Kiosco-$500,00-500,00 Pesos');
    expect(res.omitidas).toBe(1);
    expect(res.rows.map(r => r.proveedor)).toEqual(['Kiosco']);
  });
});

describe('parseSantander (cuenta)', () => {
  it('agrupa por bloques de fecha y extrae proveedor desde "De X/Y" o desde el tipo', () => {
    const raw = [
      '09/08/2026', 'Transferencia enviada', 'De Juan Perez/CBU1234',
      'Debito por transferencia en pesos argentino -$1.234,56',
      '10/08/2026', 'Compra', 'Pago con tarjeta en pesos argentino +$500,00',
    ].join('\n');
    expect(win.parseSantander(raw)).toEqual([
      { fecha: '09-08-26', proveedor: 'Juan Perez', tipo: 'Transferencia enviada', monto: -1234.56, ingreso: '', egreso: '1.234,56' },
      { fecha: '10-08-26', proveedor: 'Compra', tipo: 'Compra', monto: 500, ingreso: '500,00', egreso: '' },
    ]);
  });
});

describe('parseExcelHistorico', () => {
  it('ignora la fila de encabezado y mapea las 10 columnas esperadas', () => {
    const raw = [
      'Periodo\tTipo\tCategoria\tSubcategoria\tCC\tFecha\tProveedor\tDetalle\tIngresos\tEgresos',
      '2026-08\tEgreso\tComida\tSupermercado\tEF\t09/08/2026\tLa Anonima\tCompra semanal\t\t1234,56',
    ].join('\n');
    expect(win.parseExcelHistorico(raw)).toEqual([{
      fecha: '2026-08-09', cc: 'EF', categoria: 'Comida', subcategoria: 'Supermercado',
      proveedor: 'La Anonima', detalle: 'Compra semanal', ingreso: 0, egreso: 1234.56,
    }]);
  });
});
