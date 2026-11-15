import { spokenPesos } from './spoken-pesos';

describe('spokenPesos', () => {
  it('reads a grouped amount as pesos', () => {
    expect(spokenPesos('Se borra la venta por $45.000. No se puede deshacer.')).toBe(
      'Se borra la venta por 45.000 pesos. No se puede deshacer.',
    );
  });

  it('reads one peso in the singular and a small amount in plural', () => {
    expect(spokenPesos('Cobra $1 o $500')).toBe('Cobra 1 peso o 500 pesos');
  });

  it('reads a negative amount as "menos"', () => {
    expect(spokenPesos('Quedó en -$5.000')).toBe('Quedó en menos 5.000 pesos');
  });

  it('reads several amounts in the same text', () => {
    expect(spokenPesos('De $1.000 a $2.500')).toBe('De 1.000 pesos a 2.500 pesos');
  });

  it('leaves text without amounts as it is', () => {
    expect(spokenPesos('Anota lo que vendes')).toBe('Anota lo que vendes');
  });

  it('does not touch a lone dollar sign', () => {
    expect(spokenPesos('El signo $ va antes')).toBe('El signo $ va antes');
  });
});
