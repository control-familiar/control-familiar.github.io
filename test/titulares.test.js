import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

// D5: el titular de cada Centro de Costo es un usuario de la familia (miembros), con el nombre que se
// le cargó en alta_miembro.sql. Nada sale del código ni del email.

describe('Titulares: carga', () => {
  it('trae los miembros de la familia ordenados por nombre (el superadmin, los de la familia elegida)', async () => {
    const win = loadApp();
    const sbMock = mockSb({
      superadmins: [{ user_id: 's1' }],
      familias: [{ id: 'fa', nombre: 'Familia A' }],
      miembros: [
        { user_id: 'u2', familia_id: 'fa', nombre: 'Zoe' },
        { user_id: 'u1', familia_id: 'fa', nombre: 'ana' },
        { user_id: 'u3', familia_id: 'fb', nombre: 'De otra familia' }
      ],
      centros: [{ id: 'c1', familia_id: 'fa', codigo: 'X', nombre: 'Caja', titular_id: 'u2' }]
    }, { admin_miembros: { data: [], error: null } });
    win.sb = sbMock.client;
    await win.cargarPerfil();
    await win.cargarTodo();
    expect(win.STATE.miembrosFamilia).toEqual([{ userId: 'u1', nombre: 'ana' }, { userId: 'u2', nombre: 'Zoe' }]);
    expect(win.STATE.centros[0].titularId).toBe('u2');
    expect(sbMock.selects.find(s => s.table === 'miembros').filtros).toEqual([['familia_id', 'fa']]);
  });
});

describe('Titulares: ABM de centros', () => {
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.activeTab = 'abm';
    win.STATE.abmSubTab = 'centros';
    win.render();
  });

  it('el listado muestra el titular de cada centro', () => {
    const texto = win.document.getElementById('app').textContent;
    expect(texto).toContain('Titular');
    expect(texto).toContain('Franco');
  });

  it('el formulario ofrece los miembros de la familia y "Sin titular"', () => {
    const opciones = [...win.document.querySelectorAll('#f-centro-titular option')].map(o => o.textContent);
    expect(opciones).toEqual(['Sin titular', 'Ana', 'Franco']);
  });

  it('al editar se puede cambiar el titular o sacarlo', async () => {
    await win.handleAction('edit-centro', 'c-ef');
    expect(win.document.getElementById('f-centro-titular').value).toBe('u-franco');
    win.document.getElementById('f-centro-titular').value = 'u-ana';
    await win.handleAction('save-centro', 'c-ef');
    expect(sbMock.calls[0].fields.titular_id).toBe('u-ana');
    expect(win.STATE.centros.find(c => c.id === 'c-ef').titularId).toBe('u-ana');

    await win.handleAction('edit-centro', 'c-ef');
    win.document.getElementById('f-centro-titular').value = '';
    await win.handleAction('save-centro', 'c-ef');
    expect(sbMock.calls[1].fields.titular_id).toBe(null);
  });

  it('un centro nuevo se guarda con su titular', async () => {
    win.document.getElementById('f-centro-codigo').value = 'NV';
    win.document.getElementById('f-centro-nombre').value = 'Nueva cuenta';
    win.document.getElementById('f-centro-titular').value = 'u-ana';
    await win.handleAction('save-centro', '');
    expect(sbMock.calls[0]).toMatchObject({ op: 'insert', table: 'centros', rows: { codigo: 'NV', titular_id: 'u-ana' } });
  });
});

describe('Titulares: Saldos', () => {
  it('un grupo por titular y "Sin titular" con los centros sin titular y lo que no tiene centro', () => {
    const win = loadApp();
    seedBase(win);
    win.STATE.centros.push({ id: 'c-comp', codigo: 'CO', nombre: 'Compartida' });
    win.STATE.movimientos = [
      { id: 'm1', fecha: '2026-01-01', centroId: 'c-ef', ingreso: 100, egreso: 0 },
      { id: 'm2', fecha: '2026-01-01', centroId: 'c-comp', ingreso: 30, egreso: 0 },
      { id: 'm3', fecha: '2026-01-01', centroId: '', ingreso: 5, egreso: 0 }
    ];
    win.STATE.activeTab = 'saldos';
    win.render();
    const titulos = [...win.document.querySelectorAll('.saldos-grupo-titulo')].map(t => t.textContent);
    expect(titulos).toEqual(['Ana', 'Franco', 'Sin titular']);
    const sinTitular = [...win.document.querySelectorAll('.saldos-grupo')].pop().textContent;
    expect(sinTitular).toContain('Compartida');
    expect(sinTitular).toContain('Movimientos sin Centro de Costo asignado');
    expect(sinTitular).toContain('35,00');
  });
});

describe('Efectivo: centro por defecto (R5)', () => {
  it('recuerda en el dispositivo el último centro usado, si sigue existiendo', async () => {
    const win = loadApp();
    seedBase(win);
    win.sb = mockSb().client;
    expect(win.centroEfectivoRecordado()).toBe('');

    await win.handleAction('abrir-efectivo');
    win.document.getElementById('ef-fecha').value = '2026-10-01';
    win.document.getElementById('ef-centro').value = 'c-ea';
    win.document.getElementById('ef-monto').value = '500';
    await win.handleAction('guardar-efectivo');
    expect(win.centroEfectivoRecordado()).toBe('c-ea');

    await win.handleAction('abrir-efectivo');
    expect(win.document.getElementById('ef-centro').value).toBe('c-ea');

    win.STATE.centros = win.STATE.centros.filter(c => c.id !== 'c-ea');
    expect(win.centroEfectivoRecordado()).toBe('');
  });
});
