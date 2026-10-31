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

  it('incluye todas las tablas del schema salvo arca_ta (token temporal) y superadmins', () => {
    const win = loadApp();
    const schema = readFileSync(path.join(ROOT, 'schema.sql'), 'utf8');
    const fueraDelBackup = ['arca_ta', 'superadmins'];
    const tablasSchema = [...schema.matchAll(/create table (\w+)/g)].map(m => m[1]).filter(t => !fueraDelBackup.includes(t));
    expect([...win.TABLAS_BACKUP].sort()).toEqual(tablasSchema.sort());
  });

  it('TABLAS_DE_FAMILIA coincide con las tablas que restaura restaurar_familia() en la base, en el mismo orden', () => {
    const win = loadApp();
    const schema = readFileSync(path.join(ROOT, 'schema.sql'), 'utf8');
    const funcion = schema.slice(schema.indexOf('create function restaurar_familia'));
    const lista = funcion.match(/tablas text\[\] := array\[([^\]]*)\]/)[1].match(/'[^']+'/g).map(s => s.slice(1, -1));
    expect(Array.from(win.TABLAS_DE_FAMILIA)).toEqual(lista);
  });
});

describe('Backup: armar (descargar)', () => {
  it('versión 3: lee cada tabla de la base, tal cual y de todas las familias, paginando más allá de 1000 filas', async () => {
    const win = loadApp();
    const movimientos = Array.from({ length: 1500 }, (_, i) => ({ id: 'm' + i, familia_id: i % 2 ? 'fa' : 'fb', ingreso: 1, created_at: '2026-01-01' }));
    const sbMock = mockSb({
      familias: [{ id: 'fa', nombre: 'A' }, { id: 'fb', nombre: 'B' }],
      miembros: [{ user_id: 'u1', familia_id: 'fa' }],
      movimientos,
      configuracion: [{ familia_id: 'fa', clave: 'arca_cuit', valor: '1' }]
    });
    win.sb = sbMock.client;
    // El superadmin está mirando la familia A, pero el backup lleva todas.
    win.STATE.esSuperadmin = true;
    win.STATE.familiaSeleccionadaId = 'fa';
    const backup = await win.armarBackup();
    expect(backup.version).toBe(3);
    expect(backup.familias).toHaveLength(2);
    expect(backup.miembros).toHaveLength(1);
    expect(backup.movimientos).toHaveLength(1500);
    expect(backup.movimientos[0]).toEqual(movimientos[0]); // filas crudas, con created_at y familia_id
    expect(backup.configuracion[0].clave).toBe('arca_cuit');
    for (const t of win.TABLAS_BACKUP) expect(Array.isArray(backup[t])).toBe(true);
    expect(sbMock.selects.every(s => s.filtros.length === 0)).toBe(true);
  });
});

describe('Backup: restaurar una familia', () => {
  const backup = {
    version: 3,
    exportadoEn: '2026-10-01T10:00:00Z',
    familias: [{ id: 'fa', nombre: 'Familia A' }, { id: 'fb', nombre: 'Familia B' }],
    miembros: [{ user_id: 'u1', familia_id: 'fa' }],
    centros: [{ id: 'ca', familia_id: 'fa', codigo: 'A' }, { id: 'cb', familia_id: 'fb', codigo: 'B' }],
    movimientos: [{ id: 'ma', familia_id: 'fa' }, { id: 'mb1', familia_id: 'fb' }, { id: 'mb2', familia_id: 'fb' }],
    configuracion: [{ familia_id: 'fb', clave: 'arca_cuit', valor: '2' }]
  };
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    sbMock = mockSb({}, { restaurar_familia: { data: { centros: 1, movimientos: 2, configuracion: 1 }, error: null } });
    win.sb = sbMock.client;
  });

  it('lista las familias del archivo con cuántas filas trae cada una', () => {
    expect(win.familiasEnBackup(backup).map(f => [f.id, f.nombre, f.filas])).toEqual([
      ['fa', 'Familia A', 2],
      ['fb', 'Familia B', 4]
    ]);
  });

  it('manda a restaurar_familia() solo las filas de la familia elegida', async () => {
    const resultado = await win.restaurarFamilia(backup, 'fb');
    expect(resultado).toEqual({ centros: 1, movimientos: 2, configuracion: 1 });
    expect(sbMock.calls).toHaveLength(1);
    const { nombre, args } = sbMock.calls[0];
    expect(nombre).toBe('restaurar_familia');
    expect(args.p_familia_id).toBe('fb');
    expect(args.p_datos.familia).toEqual({ id: 'fb', nombre: 'Familia B' });
    expect(args.p_datos.centros.map(r => r.id)).toEqual(['cb']);
    expect(args.p_datos.movimientos.map(r => r.id)).toEqual(['mb1', 'mb2']);
    expect(args.p_datos.configuracion).toHaveLength(1);
    expect(args.p_datos.miembros).toBeUndefined(); // los miembros no se restauran (dependen de auth.users)
    for (const t of win.TABLAS_DE_FAMILIA) expect(Array.isArray(args.p_datos[t])).toBe(true);
  });

  it('si la base rechaza la restauración, el error llega tal cual', async () => {
    sbMock = mockSb({}, { restaurar_familia: { data: null, error: new Error('El backup tiene filas de otra familia en centros') } });
    win.sb = sbMock.client;
    await expect(win.restaurarFamilia(backup, 'fa')).rejects.toThrow('filas de otra familia');
  });
});
