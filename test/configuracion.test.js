import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

const CATALOGO = [
  { clave: 'monotributo_limite_categoria_b', tipo: 'numero', descripcion: 'Tope', valor_default: null, grupo: 'Facturación', orden: 3 },
  { clave: 'arca_cuit', tipo: 'texto', descripcion: 'CUIT del emisor', valor_default: null, grupo: 'Facturación', orden: 1 },
  { clave: 'redondeo', tipo: 'numero', descripcion: 'Redondeo', valor_default: '10', grupo: 'General', orden: 1 },
  { clave: 'mostrar_extra', tipo: 'booleano', descripcion: 'Algo opcional', valor_default: 'false', grupo: 'General', orden: 2 }
];
const FAMILIAS = [{ id: 'fa', nombre: 'Familia A' }, { id: 'fb', nombre: 'Familia B' }];

describe('Configuración: valor efectivo', () => {
  let win;
  beforeEach(async () => {
    win = loadApp();
    win.sb = mockSb({ config_catalogo: CATALOGO, familia_config: [{ familia_id: 'fa', clave: 'redondeo', valor: '100' }] }).client;
    await win.cargarTodo();
  });

  it('ordena el catálogo por grupo y orden', () => {
    expect(win.STATE.configCatalogo.map(c => c.clave)).toEqual(['arca_cuit', 'monotributo_limite_categoria_b', 'redondeo', 'mostrar_extra']);
  });

  it('el valor de la familia gana; si no tiene, el default; si no hay default, null', () => {
    expect(win.configuracionValor('redondeo')).toBe('100');
    expect(win.configuracionValor('mostrar_extra')).toBe('false');
    expect(win.configuracionValor('arca_cuit')).toBe(null);
    expect(win.configuracionValor('no_existe')).toBe(null);
  });

  it('valida igual que la base: números con punto decimal y booleanos true/false', () => {
    expect(win.valorConfigValido('numero', '1400000')).toBe(true);
    expect(win.valorConfigValido('numero', '-12.5')).toBe(true);
    expect(win.valorConfigValido('numero', '1.400.000')).toBe(false);
    expect(win.valorConfigValido('numero', '12,5')).toBe(false);
    expect(win.valorConfigValido('booleano', 'true')).toBe(true);
    expect(win.valorConfigValido('booleano', 'si')).toBe(false);
    expect(win.valorConfigValido('texto', 'cualquier cosa')).toBe(true);
  });
});

describe('Configuración: el superadmin la edita en Administración', () => {
  let win, sbMock;
  beforeEach(async () => {
    win = loadApp();
    seedBase(win);
    sbMock = mockSb(
      { superadmins: [{ user_id: 's1' }], familias: FAMILIAS, config_catalogo: CATALOGO,
        familia_config: [{ familia_id: 'fa', clave: 'redondeo', valor: '100' }, { familia_id: 'fb', clave: 'redondeo', valor: '5' }] },
      { admin_miembros: { data: [], error: null } }
    );
    win.sb = sbMock.client;
    await win.cargarPerfil();
    await win.cargarTodo();
    win.STATE.ready = true;
    win.STATE.activeTab = 'admin';
    win.render();
  });

  it('carga la configuración de la familia elegida (el catálogo, sin filtrar)', () => {
    expect(win.STATE.configuracion).toEqual([{ clave: 'redondeo', valor: '100' }]);
    expect(sbMock.selects.find(s => s.table === 'familia_config').filtros).toEqual([['familia_id', 'fa']]);
    expect(sbMock.selects.find(s => s.table === 'config_catalogo').filtros).toEqual([]);
  });

  it('muestra cada clave con su descripción, agrupada, y si usa el default', () => {
    const texto = win.document.getElementById('app').textContent;
    expect(texto).toContain('Configuración de Familia A');
    expect(texto).toContain('Facturación');
    expect(texto).toContain('CUIT del emisor');
    expect(win.document.getElementById('cfg-redondeo').value).toBe('100');
    expect(win.document.getElementById('cfg-arca_cuit').getAttribute('placeholder')).toBe('Sin valor por defecto');
    expect(win.document.getElementById('cfg-mostrar_extra').tagName).toBe('SELECT');
    // "Usar default" solo para las claves que la familia tiene propias
    const conDefault = [...win.document.querySelectorAll('[data-action="config-default"]')].map(b => b.getAttribute('data-id'));
    expect(conDefault).toEqual(['redondeo']);
  });

  it('guardar hace upsert en la familia elegida, aunque el superadmin esté en solo lectura', async () => {
    win.document.getElementById('cfg-arca_cuit').value = ' 20111111112 ';
    await win.handleAction('config-guardar', 'arca_cuit');
    const upsert = sbMock.calls.find(c => c.op === 'upsert');
    expect(upsert).toMatchObject({ table: 'familia_config', rows: { familia_id: 'fa', clave: 'arca_cuit', valor: '20111111112' }, opciones: { onConflict: 'familia_id,clave' } });
    expect(win.configuracionValor('arca_cuit')).toBe('20111111112');
    expect(win.STATE.configMsg.type).toBe('ok');
  });

  it('un número mal escrito no se guarda y se explica por qué', async () => {
    win.document.getElementById('cfg-monotributo_limite_categoria_b').value = '1.400.000';
    await win.handleAction('config-guardar', 'monotributo_limite_categoria_b');
    expect(sbMock.calls.filter(c => c.op !== 'rpc')).toHaveLength(0);
    expect(win.STATE.configMsg.type).toBe('err');
    expect(win.STATE.configMsg.text).toContain('sin separador de miles');
  });

  it('"Usar default" (o guardar vacío) borra el valor propio de esa familia', async () => {
    await win.handleAction('config-default', 'redondeo');
    const borrado = sbMock.calls.find(c => c.op === 'delete');
    expect(borrado).toMatchObject({ table: 'familia_config', filtros: [['familia_id', 'fa'], ['clave', 'redondeo']] });
    expect(win.configuracionValor('redondeo')).toBe('10');
  });

  it('al cambiar de familia muestra la configuración de la otra', async () => {
    await win.elegirFamilia('fb');
    expect(win.document.getElementById('cfg-redondeo').value).toBe('5');
    expect(win.document.getElementById('app').textContent).toContain('Configuración de Familia B');
  });
});

describe('Configuración: la familia no la ve ni la edita (C1, S4)', () => {
  it('un miembro no tiene la pantalla y no puede disparar el guardado', async () => {
    const win = loadApp();
    seedBase(win);
    const sbMock = mockSb({ superadmins: [], familias: [FAMILIAS[0]], config_catalogo: CATALOGO });
    win.sb = sbMock.client;
    await win.cargarPerfil();
    await win.cargarTodo();
    win.STATE.ready = true;
    win.STATE.activeTab = 'abm';
    win.render();
    expect(win.document.querySelector('[id^="cfg-"]')).toBe(null);
    const llamadasAntes = sbMock.calls.length; // la carga ya generó los vencimientos recurrentes
    await win.handleAction('config-guardar', 'arca_cuit');
    expect(sbMock.calls.slice(llamadasAntes)).toHaveLength(0);
  });
});
