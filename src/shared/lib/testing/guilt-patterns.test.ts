import { GUILT_PATTERNS, findGuiltPattern } from './guilt-patterns';

describe('findGuiltPattern', () => {
  test.each([
    'Llevas 3 semanas sin registrar',
    'Otra vez sin ventas',
    'Deberías anotar tus ventas',
    'Todavía no hay ventas esta semana',
    'Olvidaste registrar tu venta',
    'Fallaste esta semana',
    'Hubo un error',
    'Lo hiciste mal',
    'Perdiste tu racha',
    'Tienes que registrar más',
    'Aún no registras ventas',
    'No has registrado nada',
    'Dejaste de anotar',
    'Te falta anotar costos',
    'Te faltan costos',
    'Hace 3 días que no registras',
    'Hace dos semanas que no vendes',
    'Deberias anotar tus ventas',
    'TODAVIA NO hay ventas',
  ])('detects "%s"', (text) => {
    expect(findGuiltPattern(text)).not.toBeNull();
  });

  test.each([
    'Semana tranquila por ahora, tu próxima venta cuenta',
    'Aquí vas a ver cuánto vendes',
    'Tu racha ya va en 3 semanas',
    'Animal, formal y normal no son palabras de culpa',
    'Errores de cálculo comunes',
    'Hace 3 días registraste una venta',
    'Tu falta de tiempo no importa',
  ])('accepts "%s"', (text) => {
    expect(findGuiltPattern(text)).toBeNull();
  });

  test('ignores letter casing', () => {
    expect(findGuiltPattern('LLEVAS tiempo')).not.toBeNull();
  });

  test('patterns are not stateful', () => {
    expect(GUILT_PATTERNS.every((pattern) => !pattern.global && !pattern.sticky)).toBe(true);
    expect(findGuiltPattern('llevas')).not.toBeNull();
    expect(findGuiltPattern('llevas')).not.toBeNull();
  });
});
