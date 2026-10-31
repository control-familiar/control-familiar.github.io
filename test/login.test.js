import { describe, it, expect } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

describe('Login: ojito de la contraseña', () => {
  it('muestra y vuelve a ocultar la contraseña, cambiando el ícono y el texto del botón', () => {
    const win = loadApp();
    const input = win.document.getElementById('login-password');
    const ojo = win.document.getElementById('btnVerPassword');
    input.value = 'secreta';
    expect(input.type).toBe('password');

    ojo.click();
    expect(input.type).toBe('text');
    expect(input.value).toBe('secreta');
    expect(ojo.querySelector('i').className).toContain('bi-eye-slash');
    expect(ojo.getAttribute('aria-label')).toBe('Ocultar contraseña');

    ojo.click();
    expect(input.type).toBe('password');
    expect(ojo.querySelector('i').className).toContain('bi-eye');
    expect(ojo.getAttribute('aria-label')).toBe('Mostrar contraseña');
  });

  it('el botón no envía el formulario (type="button")', () => {
    const win = loadApp();
    expect(win.document.getElementById('btnVerPassword').getAttribute('type')).toBe('button');
  });
});

describe('Login: Recordarme', () => {
  it('viene tildado por defecto', () => {
    const win = loadApp();
    expect(win.document.getElementById('login-recordar').checked).toBe(true);
    expect(win.recordarSesion()).toBe(true);
  });

  it('tildado, la sesión se guarda en el dispositivo (localStorage)', () => {
    const win = loadApp();
    win.ALMACEN_SESION.setItem('sb-sesion', 'token');
    expect(win.localStorage.getItem('sb-sesion')).toBe('token');
    expect(win.sessionStorage.getItem('sb-sesion')).toBe(null);
    expect(win.ALMACEN_SESION.getItem('sb-sesion')).toBe('token');
  });

  it('destildado, la sesión dura hasta cerrar el navegador (sessionStorage)', () => {
    const win = loadApp();
    win.localStorage.setItem('controlRecordarme', 'false');
    win.ALMACEN_SESION.setItem('sb-sesion', 'token');
    expect(win.sessionStorage.getItem('sb-sesion')).toBe('token');
    expect(win.localStorage.getItem('sb-sesion')).toBe(null);
    win.ALMACEN_SESION.removeItem('sb-sesion');
    expect(win.sessionStorage.getItem('sb-sesion')).toBe(null);
  });

  it('al iniciar sesión se guarda la preferencia antes de entrar, y se recuerda la próxima vez', async () => {
    const win = loadApp();
    let preferenciaAlEntrar = null;
    win.sb = { auth: { signInWithPassword: async () => {
      preferenciaAlEntrar = win.localStorage.getItem('controlRecordarme');
      return { error: { message: 'credenciales de prueba' } };
    } } };
    win.document.getElementById('login-email').value = 'a@ejemplo.com';
    win.document.getElementById('login-password').value = 'x';
    win.document.getElementById('login-recordar').checked = false;
    await win.intentarLogin();
    expect(preferenciaAlEntrar).toBe('false');

    const otraVez = loadApp(); // misma "pestaña": jsdom comparte localStorage por origen
    expect(otraVez.document.getElementById('login-recordar').checked).toBe(otraVez.recordarSesion());
  });
});
