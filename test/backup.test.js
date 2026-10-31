import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadApp } from './helpers/loadApp.js';
import { mockSb } from './helpers/mockSb.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tablasDelScriptDiario() {
  const fuente = readFileSync(path.join(ROOT, 'scripts', 'backup-a-drive', 'backup.js'), 'utf8');
  const lista = fuente.match(/const TABLAS = \[([^\]]*)\]/)[1];
  return lista.match(/'[^']+'/g).map(s => s.slice(1, -1));
}

describe('Backup: tablas incluidas', () => {
  it('el backup diario a Drive y el de la app guardan las mismas tablas, en el mismo orden', () => {
    const win = loadApp();
    expect(tablasDelScriptDiario()).toEqual(Array.from(win.TABLAS_BACKUP));
  });

  it('incluye todas las tablas del schema salvo arca_ta (token temporal)', () => {
    const win = loadApp();
    const schema = readFileSync(path.join(ROOT, 'schema.sql'), 'utf8');
    // familias/miembros/superadmins: el backup global del superadmin (fase 2, ver docs/MULTI-FAMILIA.md) las va a sumar
    const fueraDelBackup = ['arca_ta', 'familias', 'miembros', 'superadmins'];
    const tablasSchema = [...schema.matchAll(/create table (\w+)/g)].map(m => m[1]).filter(t => !fueraDelBackup.includes(t));
    expect([...win.TABLAS_BACKUP].sort()).toEqual(tablasSchema.sort());
  });
});

describe('Backup: armar (descargar)', () => {
  it('lee cada tabla de la base, tal cual, paginando más allá de 1000 filas', async () => {
    const win = loadApp();
    const movimientos = Array.from({ length: 1500 }, (_, i) => ({ id: 'm' + i, ingreso: 1, created_at: '2026-01-01' }));
    win.sb = mockSb({
      movimientos,
      usdt_movimientos: [{ id: 'u1', tipo: 'ingreso', cantidad: 10 }],
      configuracion: [{ clave: 'arca_cuit', valor: '1' }]
    }).client;
    const backup = await win.armarBackup();
    expect(backup.version).toBe(2);
    expect(backup.movimientos).toHaveLength(1500);
    expect(backup.movimientos[0]).toEqual(movimientos[0]); // filas crudas, con created_at
    expect(backup.usdt_movimientos).toHaveLength(1);
    expect(backup.configuracion[0].clave).toBe('arca_cuit');
    for (const t of win.TABLAS_BACKUP) expect(Array.isArray(backup[t])).toBe(true);
  });
});

describe('Backup: restaurar', () => {
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    sbMock = mockSb();
    win.sb = sbMock.client;
  });

  it('versión 2: upsertea las filas crudas en orden de dependencias y en lotes', async () => {
    const movimientos = Array.from({ length: 1200 }, (_, i) => ({ id: 'm' + i, moneda: i % 2 ? 'USD' : 'ARS' }));
    await win.restaurarBackup({
      version: 2,
      configuracion: [{ clave: 'x', valor: '1' }],
      usdt_movimientos: [{ id: 'u1', movimiento_id: 'm1' }],
      movimientos,
      centros: [{ id: 'c1', codigo: 'MP', nombre: 'Mercado Pago' }]
    });
    const tablas = sbMock.calls.map(c => c.table);
    expect(tablas).toEqual(['centros', 'movimientos', 'movimientos', 'movimientos', 'usdt_movimientos', 'configuracion']);
    expect(sbMock.calls.filter(c => c.table === 'movimientos').map(c => c.rows.length)).toEqual([500, 500, 200]);
    expect(sbMock.calls[0].rows[0]).toEqual({ id: 'c1', codigo: 'MP', nombre: 'Mercado Pago' });
  });

  it('versión 1 (backups viejos de la app): pasa por los mappers y separa pesos de dólares', async () => {
    await win.restaurarBackup({
      version: 1,
      subcategorias: [{ id: 's1', categoriaId: 'cat1', nombre: 'Super' }],
      movimientos: [
        { id: 'm1', fecha: '2026-01-01', centroId: 'c1', ingreso: 10, egreso: 0, moneda: 'ARS' },
        { id: 'm2', fecha: '2026-01-02', centroId: 'c1', ingreso: 5, egreso: 0, moneda: 'USD' }
      ]
    });
    expect(sbMock.calls[0]).toMatchObject({ table: 'subcategorias', rows: [{ id: 's1', categoria_id: 'cat1', nombre: 'Super' }] });
    const movs = sbMock.calls.filter(c => c.table === 'movimientos');
    expect(movs).toHaveLength(2);
    expect(movs[0].rows.map(r => r.id)).toEqual(['m1']);
    expect(movs[0].rows[0].centro_id).toBe('c1');
    expect(movs[1].rows.map(r => r.id)).toEqual(['m2']);
    expect(movs[1].rows[0].moneda).toBe('USD');
  });
});
