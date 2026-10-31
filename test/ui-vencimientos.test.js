import { describe, it, expect, beforeEach } from 'vitest';
import { loadApp, mockNow } from './helpers/loadApp.js';
import { seedBase } from './helpers/fixtures.js';
import { mockSb } from './helpers/mockSb.js';

describe('Vencimientos', () => {
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.activeTab = 'vencimientos';
    win.render();
  });

  it('valida concepto y fecha obligatorios', async () => {
    win.document.getElementById('f-venc-concepto').value = '';
    win.document.getElementById('f-venc-fecha').value = '';
    await win.handleAction('save-venc', '');
    expect(win.STATE.vencFormMsg).toMatch(/completá/i);
    expect(win.STATE.vencimientos).toHaveLength(0);
  });

  it('agrega un vencimiento nuevo, con estado "pendiente" por defecto', async () => {
    win.document.getElementById('f-venc-concepto').value = 'Tarjeta Visa';
    win.document.getElementById('f-venc-fecha').value = '2026-08-20';
    win.document.getElementById('f-venc-monto').value = '150000';
    win.document.getElementById('f-venc-centro').value = 'c-ef';
    await win.handleAction('save-venc', '');
    expect(win.STATE.vencimientos).toHaveLength(1);
    expect(win.STATE.vencimientos[0]).toMatchObject({ concepto: 'Tarjeta Visa', monto: 150000, estado: 'pendiente' });
  });

  it('"marcar pagado" / "marcar pendiente" alternan el estado y persisten via update', async () => {
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Luz', fecha: '2026-08-20', monto: 5000, centroId: 'c-ef', estado: 'pendiente' }];
    win.render();
    await win.handleAction('toggle-venc-estado', 'v1');
    expect(win.STATE.vencimientos[0].estado).toBe('pagado');
    expect(sbMock.calls[0]).toMatchObject({ op: 'update', table: 'vencimientos', val: 'v1' });
    await win.handleAction('toggle-venc-estado', 'v1');
    expect(win.STATE.vencimientos[0].estado).toBe('pendiente');
  });

  it('"cargar como movimiento" crea un egreso a partir del vencimiento', async () => {
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Luz', fecha: '2026-08-20', monto: 5000, centroId: 'c-ef', estado: 'pendiente' }];
    win.render();
    await win.handleAction('venc-a-movimiento', 'v1');
    expect(win.STATE.movimientos).toHaveLength(1);
    expect(win.STATE.movimientos[0]).toMatchObject({ proveedor: 'Luz', egreso: 5000, centroId: 'c-ef' });
  });

  it('"marcar pagado" abre un modal para elegir si también se carga como movimiento', async () => {
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Luz', fecha: '2026-08-20', monto: 5000, centroId: 'c-ef', estado: 'pendiente' }];
    win.render();
    await win.handleAction('pagar-venc', 'v1');
    expect(win.STATE.vencPagarState).toMatchObject({ id: 'v1' });
  });

  it('pagar-venc-sin-mov marca pagado sin crear movimiento y cierra el modal', async () => {
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Luz', fecha: '2026-08-20', monto: 5000, centroId: 'c-ef', estado: 'pendiente' }];
    win.render();
    await win.handleAction('pagar-venc', 'v1');
    await win.handleAction('pagar-venc-sin-mov', 'v1');
    expect(win.STATE.vencimientos[0].estado).toBe('pagado');
    expect(win.STATE.movimientos).toHaveLength(0);
    expect(win.STATE.vencPagarState).toBeNull();
  });

  it('pagar-venc-con-mov marca pagado y crea el movimiento', async () => {
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Luz', fecha: '2026-08-20', monto: 5000, centroId: 'c-ef', estado: 'pendiente' }];
    win.render();
    await win.handleAction('pagar-venc', 'v1');
    await win.handleAction('pagar-venc-con-mov', 'v1');
    expect(win.STATE.vencimientos[0].estado).toBe('pagado');
    expect(win.STATE.movimientos).toHaveLength(1);
    expect(win.STATE.movimientos[0]).toMatchObject({ proveedor: 'Luz', egreso: 5000, centroId: 'c-ef' });
    expect(win.STATE.vencPagarState).toBeNull();
  });

  it('un vencimiento pagado no aparece más en la tabla principal de Vencimientos', () => {
    win.STATE.vencimientos = [
      { id: 'v1', concepto: 'Luz pendiente', fecha: '2026-08-20', monto: 5000, centroId: 'c-ef', estado: 'pendiente' },
      { id: 'v2', concepto: 'Gas ya pagado', fecha: '2026-08-10', monto: 3000, centroId: 'c-ef', estado: 'pagado' }
    ];
    win.render();
    const html = win.document.getElementById('app').innerHTML;
    expect(html).toContain('Luz pendiente');
    expect(html).toContain('Gas ya pagado'); // sigue disponible en la sección colapsable de pagados
    expect(html).toContain('Vencimientos pagados');
  });

  it('editar un vencimiento y marcarlo pagado con "cargar también como movimiento" crea el movimiento', async () => {
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Luz', fecha: '2026-08-20', monto: 5000, centroId: 'c-ef', estado: 'pendiente' }];
    win.render();
    win.handleAction('edit-venc', 'v1');
    win.render();
    win.document.getElementById('f-venc-concepto').value = 'Luz';
    win.document.getElementById('f-venc-fecha').value = '2026-08-20';
    win.document.getElementById('f-venc-monto').value = '5000';
    win.document.getElementById('f-venc-estado').value = 'pagado';
    win.document.getElementById('f-venc-crear-mov').checked = true;
    await win.handleAction('save-venc', 'v1');
    expect(win.STATE.vencimientos[0].estado).toBe('pagado');
    expect(win.STATE.movimientos).toHaveLength(1);
    expect(win.STATE.movimientos[0]).toMatchObject({ proveedor: 'Luz', egreso: 5000 });
  });

  it('borra un vencimiento', async () => {
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Luz', fecha: '2026-08-20', monto: 5000, centroId: 'c-ef', estado: 'pendiente' }];
    win.render();
    win.handleAction('del-venc', 'v1');
    await win.handleAction('confirm-yes');
    expect(win.STATE.vencimientos).toHaveLength(0);
  });

  it('un movimiento con fecha futura aparece en la lista de pendientes de Vencimientos', () => {
    const restore = mockNow(win, '2026-07-31T12:00:00');
    win.STATE.movimientos = [
      { id: 'm1', fecha: '2026-09-01', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Cuota 2/3 Heladera', ingreso: 0, egreso: 30000, tarjeta: true },
      { id: 'm2', fecha: '2026-06-01', centroId: 'c-ef', categoriaId: 'cat-super', proveedor: 'Ya pasó', ingreso: 0, egreso: 100 }
    ];
    win.render();
    const html = win.document.getElementById('app').innerHTML;
    expect(html).toContain('Cuota 2/3 Heladera');
    expect(html).not.toContain('Ya pasó');
    restore();
  });
});

describe('Vencimientos: saltear y categoría', () => {
  let win, sbMock;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.activeTab = 'vencimientos';
    win.render();
  });

  it('"saltear" saca el vencimiento de los pendientes y lo deja en el historial como Salteado; "marcar pendiente" lo vuelve', async () => {
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Patín', fecha: '2026-08-10', monto: 25000, centroId: 'c-ef', estado: 'pendiente' }];
    win.render();
    await win.handleAction('saltear-venc', 'v1');
    expect(win.STATE.vencimientos[0].estado).toBe('salteado');
    expect(sbMock.calls[0]).toMatchObject({ op: 'update', table: 'vencimientos', fields: { estado: 'salteado' }, val: 'v1' });
    expect(win.document.querySelector('[data-action="pagar-venc"][data-id="v1"]')).toBe(null);
    expect(win.document.getElementById('app').innerHTML).toContain('Vencimientos pagados y salteados (1)');
    expect(win.document.getElementById('app').textContent).toContain('Salteado');
    await win.handleAction('toggle-venc-estado', 'v1');
    expect(win.STATE.vencimientos[0].estado).toBe('pendiente');
  });

  it('un vencimiento salteado no aparece en el aviso de próximos', () => {
    const restore = mockNow(win, new win.Date(2026, 7, 9));
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Patín', fecha: '2026-08-10', monto: 25000, centroId: 'c-ef', estado: 'salteado' }];
    win.STATE.activeTab = 'resumen';
    win.render();
    expect(win.document.getElementById('app').innerHTML).not.toContain('Vencimientos próximos');
    restore();
  });

  it('al pagarlo y cargarlo como movimiento, el movimiento sale con la categoría y subcategoría del vencimiento', async () => {
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Verdulería', fecha: '2026-08-10', monto: 900, centroId: 'c-ef',
      categoriaId: 'cat-super', subcategoriaId: 'sub-verd', estado: 'pendiente' }];
    await win.handleAction('pagar-venc-con-mov', 'v1');
    expect(win.STATE.movimientos[0]).toMatchObject({ proveedor: 'Verdulería', egreso: 900, categoriaId: 'cat-super', subcategoriaId: 'sub-verd' });
  });

  it('al cambiar la categoría del formulario se conservan los datos tipeados y se ofrecen sus subcategorías', () => {
    const doc = win.document;
    doc.getElementById('f-venc-concepto').value = 'Feria';
    doc.getElementById('f-venc-monto').value = '1200';
    const cat = doc.getElementById('f-venc-categoria');
    cat.value = 'cat-super';
    cat.dispatchEvent(new win.Event('change'));
    expect(doc.getElementById('f-venc-concepto').value).toBe('Feria');
    expect(doc.getElementById('f-venc-monto').value).toBe('1200');
    const subs = [...doc.getElementById('f-venc-subcategoria').options].map(o => o.value);
    expect(subs).toEqual(['', 'sub-carn', 'sub-verd']);
  });
});

describe('Vencimientos: aviso de movimiento ya cargado (V6)', () => {
  let win;
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    win.sb = mockSb().client;
    win.STATE.activeTab = 'vencimientos';
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Verdulería', fecha: '2026-10-10', monto: 900, centroId: 'c-ef',
      categoriaId: 'cat-super', subcategoriaId: 'sub-verd', estado: 'pendiente' }];
  });

  it('si en el mes del vencimiento ya hay un egreso de esa categoría y subcategoría, lo avisa y ofrece marcarlo pagado', async () => {
    win.STATE.movimientos = [{ id: 'm1', fecha: '2026-10-05', centroId: 'c-ef', categoriaId: 'cat-super', subcategoriaId: 'sub-verd', proveedor: 'Don Pepe', ingreso: 0, egreso: 950 }];
    win.render();
    const aviso = win.document.querySelector('.venc-ya-cargado');
    expect(aviso.textContent).toContain('05/10/2026');
    expect(aviso.textContent).toContain('Don Pepe');
    await win.handleAction('pagar-venc', 'v1');
    expect(win.document.body.innerHTML).toContain('va a quedar dos veces');
    win.document.querySelector('.venc-ya-cargado [data-action="pagar-venc-sin-mov"]').click();
    await new Promise(r => setTimeout(r, 0));
    expect(win.STATE.vencimientos[0].estado).toBe('pagado');
    expect(win.STATE.movimientos).toHaveLength(1);
  });

  it('no avisa por movimientos de otro mes, otra subcategoría o ingresos', () => {
    win.STATE.movimientos = [
      { id: 'm1', fecha: '2026-09-05', categoriaId: 'cat-super', subcategoriaId: 'sub-verd', ingreso: 0, egreso: 950 },
      { id: 'm2', fecha: '2026-10-05', categoriaId: 'cat-super', subcategoriaId: 'sub-carn', ingreso: 0, egreso: 950 },
      { id: 'm3', fecha: '2026-10-05', categoriaId: 'cat-super', subcategoriaId: 'sub-verd', ingreso: 950, egreso: 0 }
    ];
    win.render();
    expect(win.document.querySelector('.venc-ya-cargado')).toBe(null);
  });

  it('si el vencimiento no tiene subcategoría, alcanza con la categoría; sin categoría no avisa', () => {
    win.STATE.movimientos = [{ id: 'm2', fecha: '2026-10-05', categoriaId: 'cat-super', subcategoriaId: 'sub-carn', ingreso: 0, egreso: 950 }];
    win.STATE.vencimientos[0].subcategoriaId = '';
    win.render();
    expect(win.document.querySelector('.venc-ya-cargado')).not.toBe(null);
    win.STATE.vencimientos[0].categoriaId = '';
    win.render();
    expect(win.document.querySelector('.venc-ya-cargado')).toBe(null);
  });
});

describe('Vencimientos recurrentes', () => {
  let win;
  function abrirYCompletar(valores) {
    win.handleAction('nuevo-vrec', '');
    const doc = win.document;
    for (const [campo, valor] of Object.entries(valores)) doc.getElementById('f-vrec-' + campo).value = valor;
  }
  beforeEach(() => {
    win = loadApp();
    seedBase(win);
    win.STATE.activeTab = 'vencimientos';
    win.render();
  });

  it('crea la plantilla (meses con día 1) y pide a la base que genere; si generó algo, recarga los vencimientos', async () => {
    const generado = { id: 'v9', concepto: 'Patín', fecha: '2026-10-10', monto: 25000, centro_id: 'c-ef', estado: 'pendiente',
      recurrente_id: 'x', periodo: '2026-10-01' };
    const sbMock = mockSb({ vencimientos: [generado] }, { generar_vencimientos_recurrentes: { data: 1, error: null } });
    win.sb = sbMock.client;
    const restore = mockNow(win, new win.Date(2026, 9, 31));
    abrirYCompletar({ concepto: 'Patín', dia: '10', monto: '25000', centro: 'c-ef', categoria: 'cat-super', desde: '2026-10' });
    await win.handleAction('save-vrec', '');
    restore();
    const insert = sbMock.calls.find(c => c.op === 'insert');
    expect(insert.table).toBe('vencimientos_recurrentes');
    expect(insert.rows).toMatchObject({ concepto: 'Patín', dia: 10, monto: 25000, centro_id: 'c-ef', categoria_id: 'cat-super', desde: '2026-10-01', hasta: null });
    expect(sbMock.calls.find(c => c.op === 'rpc')).toMatchObject({ nombre: 'generar_vencimientos_recurrentes', args: { p_hoy: '2026-10-31' } });
    expect(win.STATE.vencRecurrentes).toHaveLength(1);
    expect(win.STATE.vencimientos.map(v => v.id)).toEqual(['v9']);
    expect(win.STATE.editing).toBe(null);
    const html = win.document.getElementById('app').innerHTML;
    expect(html).toContain('Vencimientos recurrentes (1)');
    expect(html).toContain('bi-arrow-repeat'); // el vencimiento generado se marca como recurrente
  });

  it('valida los datos obligatorios y que "Hasta" no sea anterior a "Desde", sin perder lo tipeado', async () => {
    const sbMock = mockSb();
    win.sb = sbMock.client;
    abrirYCompletar({ concepto: 'Patín', dia: '10', desde: '2026-10', hasta: '2026-09' });
    await win.handleAction('save-vrec', '');
    expect(win.STATE.vrecFormMsg).toMatch(/hasta/i);
    expect(win.document.getElementById('f-vrec-concepto').value).toBe('Patín');
    win.document.getElementById('f-vrec-dia').value = '32';
    win.document.getElementById('f-vrec-hasta').value = '';
    await win.handleAction('save-vrec', '');
    expect(win.STATE.vrecFormMsg).toMatch(/entre 1 y 31/);
    expect(sbMock.calls).toHaveLength(0);
  });

  it('editar cambia la plantilla; si la base no generó nada, no recarga los vencimientos', async () => {
    const sbMock = mockSb();
    win.sb = sbMock.client;
    win.STATE.vencRecurrentes = [{ id: 'r1', concepto: 'Patín', monto: 25000, dia: 10, centroId: 'c-ef', categoriaId: '', subcategoriaId: '', desde: '2026-03', hasta: '' }];
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Patín', fecha: '2026-10-10', monto: 25000, centroId: 'c-ef', estado: 'pendiente', recurrenteId: 'r1' }];
    win.handleAction('edit-vrec', 'r1');
    win.document.getElementById('f-vrec-monto').value = '30000';
    await win.handleAction('save-vrec', 'r1');
    expect(sbMock.calls.find(c => c.op === 'update')).toMatchObject({ table: 'vencimientos_recurrentes', val: 'r1', fields: { monto: 30000, desde: '2026-03-01' } });
    expect(sbMock.selects).toHaveLength(0);
    expect(win.STATE.vencimientos[0].monto).toBe(25000); // los ya generados no cambian
  });

  it('borrar la plantilla deja los vencimientos ya generados como sueltos', async () => {
    win.sb = mockSb().client;
    win.STATE.vencRecurrentes = [{ id: 'r1', concepto: 'Patín', monto: 25000, dia: 10, centroId: '', categoriaId: '', subcategoriaId: '', desde: '2026-03', hasta: '' }];
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Patín', fecha: '2026-10-10', monto: 25000, centroId: '', estado: 'pendiente', recurrenteId: 'r1' }];
    win.handleAction('del-vrec', 'r1');
    await win.handleAction('confirm-yes');
    expect(win.STATE.vencRecurrentes).toHaveLength(0);
    expect(win.STATE.vencimientos).toHaveLength(1);
    expect(win.STATE.vencimientos[0].recurrenteId).toBe('');
  });

  it('al cargar, un miembro genera los recurrentes y el superadmin (solo lectura) no', async () => {
    const sbMock = mockSb();
    win.sb = sbMock.client;
    await win.cargarTodo();
    expect(sbMock.calls.filter(c => c.op === 'rpc' && c.nombre === 'generar_vencimientos_recurrentes')).toHaveLength(1);
    win.STATE.soloLectura = true;
    await win.cargarTodo();
    expect(sbMock.calls.filter(c => c.op === 'rpc' && c.nombre === 'generar_vencimientos_recurrentes')).toHaveLength(1);
  });

  it('si la generación falla, la carga sigue', async () => {
    const sbMock = mockSb({ vencimientos: [{ id: 'v1', concepto: 'Luz', fecha: '2026-10-10', monto: 1, estado: 'pendiente' }] },
      { generar_vencimientos_recurrentes: { data: null, error: { message: 'boom' } } });
    win.sb = sbMock.client;
    await win.cargarTodo();
    expect(win.STATE.vencimientos).toHaveLength(1);
  });
});

describe('Aviso de vencimientos próximos', () => {
  it('se ve en Movimientos y en Resumen (que ya no tiene la tarjeta "Próximo vencimiento")', () => {
    const win = loadApp();
    seedBase(win);
    const restoreNow = mockNow(win, new win.Date(2026, 7, 9)); // hoy = 2026-08-09
    win.STATE.vencimientos = [{ id: 'v1', concepto: 'Expensas', fecha: '2026-08-10', monto: 50000, centroId: 'c-ef', estado: 'pendiente' }];
    for (const tab of ['movimientos', 'resumen']) {
      win.STATE.activeTab = tab;
      win.render();
      const html = win.document.getElementById('app').innerHTML;
      expect(html, tab).toContain('Vencimientos próximos');
      expect(html, tab).toContain('Expensas');
    }
    expect(win.document.getElementById('app').innerHTML).not.toContain('Próximo vencimiento');
    restoreNow();
  });
});
