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
