/** Datos base compartidos entre los tests de UI: dos centros, categorías normales + una TEC, subcategorías. */
export function seedBase(win) {
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
