/**
 * Cliente Supabase falso para tests: soporta insert/update/delete/upsert (lo que usa
 * dbInsert/dbUpdate/dbDelete/dbUpsert en app.js), sin pegarle a la red. Cada llamada
 * queda registrada en `calls` para poder assertear qué se intentó persistir.
 * `tablas` (opcional) son las filas que devuelve select() por tabla, paginadas con range() como
 * lo pide dbFetchAll (con eq() filtra, como el filtro por familia del superadmin; cada lectura queda
 * en `selects`). `rpcs` (opcional): respuesta de cada función de la base, por nombre ({ data, error }).
 */
export function mockSb(tablas = {}, rpcs = {}) {
  const calls = [];
  const selects = [];
  function from(table) {
    return {
      select() {
        const filtros = [];
        const consulta = {
          eq: (col, val) => { filtros.push([col, val]); return consulta; },
          order: () => consulta,
          range: async (desde, hasta) => {
            selects.push({ table, filtros });
            const filas = (tablas[table] || []).filter(r => filtros.every(([col, val]) => r[col] === val));
            return { data: filas.slice(desde, hasta + 1), error: null };
          }
        };
        return consulta;
      },
      insert(rows) {
        calls.push({ op: 'insert', table, rows });
        return { select: async () => ({ data: Array.isArray(rows) ? rows : [rows], error: null }) };
      },
      update(fields) {
        return {
          eq: async (col, val) => {
            calls.push({ op: 'update', table, fields, val });
            return { error: null };
          }
        };
      },
      delete() {
        return {
          eq: async (col, val) => {
            calls.push({ op: 'delete', table, val });
            return { error: null };
          }
        };
      },
      upsert(rows) {
        calls.push({ op: 'upsert', table, rows });
        return { select: async () => ({ data: rows, error: null }) };
      }
    };
  }
  async function rpc(nombre, args) {
    calls.push({ op: 'rpc', nombre, args });
    return rpcs[nombre] || { data: null, error: null };
  }
  return { calls, selects, client: { from, rpc } };
}
