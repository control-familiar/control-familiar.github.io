/**
 * Catálogo de configuración con todas las funciones opcionales prendidas y la regla del sueldo en 3 días:
 * la app tal como era en el proyecto original, que es lo que asumen la mayoría de los tests.
 */
export function catalogoTodoPrendido() {
  return [
    ...['usdt', 'dolares', 'flujo_caja', 'facturacion_arca', 'tarjetas'].map((f, i) => (
      { clave: 'feature.' + f, tipo: 'booleano', descripcion: f, valorDefault: 'true', grupo: 'Funciones', orden: i }
    )),
    { clave: 'sueldo_dias_mes_siguiente', tipo: 'numero', descripcion: 'Sueldo', valorDefault: '3', grupo: 'Reglas', orden: 1 }
  ];
}
export function prenderTodo(win) {
  win.STATE.configCatalogo = catalogoTodoPrendido();
  return win.STATE;
}

/** Datos base compartidos entre los tests de UI: dos centros, categorías normales + una TEC, subcategorías. */
export function seedBase(win) {
  prenderTodo(win);
  win.STATE.centros = [
    { id: 'c-ef', codigo: 'EF', nombre: 'Efectivo Franco' },
    { id: 'c-ea', codigo: 'EA', nombre: 'Efectivo Ana' }
  ];
  win.STATE.categorias = [
    { id: 'cat-super', nombre: 'Supermercado', tipo: 'normal' },
    { id: 'cat-suel', nombre: 'Sueldo', tipo: 'sueldo' },
    { id: 'cat-tec', nombre: 'Transferencia entre centros', tipo: 'tec' }
  ];
  win.STATE.subcategorias = [
    { id: 'sub-verd', categoriaId: 'cat-super', nombre: 'Verduleria' },
    { id: 'sub-carn', categoriaId: 'cat-super', nombre: 'Carniceria' }
  ];
  win.STATE.movimientos = [];
  win.STATE.vencimientos = [];
  win.STATE.ready = true;
  win.STATE.usuarioEmail = 'fhsantarelli@gmail.com';
  return win.STATE;
}
