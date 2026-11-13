import { parseTipsMarkdown } from './parse-tips-markdown';

const SAMPLE = `# Consejos

## Formato de cada ficha

- \`id\`: slug.
- \`categoria\`: \`registro\`.

---

## Registro

### \`registro-uno\`
- **categoria**: registro
- **titulo**: Primero
- **cuerpo**: Texto con $15.000 y dos frases. Otra.
- **contexto**: primera-venta
- **fuentes**:
  - https://example.com (consultada el 2026-11-13)

### \`flujo-dos\`
- **categoria**: flujo-de-dinero
- **titulo**: Segundo
- **cuerpo**: Otro texto.
- **fuentes**:
  - https://example.com (consultada el 2026-11-13)
`;

describe('parseTipsMarkdown', () => {
  test('reads each card in order with translated codes', () => {
    expect(parseTipsMarkdown(SAMPLE)).toEqual([
      {
        id: 'registro-uno',
        category: 'recording',
        title: 'Primero',
        body: 'Texto con $15.000 y dos frases. Otra.',
        trigger: 'first_sale',
      },
      {
        id: 'flujo-dos',
        category: 'money_flow',
        title: 'Segundo',
        body: 'Otro texto.',
        trigger: null,
      },
    ]);
  });

  test('throws on an unknown category', () => {
    const broken = SAMPLE.replace('categoria**: registro', 'categoria**: magia');
    expect(() => parseTipsMarkdown(broken)).toThrow(/magia/);
  });

  test('throws on an unknown context', () => {
    const broken = SAMPLE.replace('primera-venta', 'luna-llena');
    expect(() => parseTipsMarkdown(broken)).toThrow(/luna-llena/);
  });

  test('throws when a card lacks a required field', () => {
    const broken = SAMPLE.replace('- **titulo**: Primero\n', '');
    expect(() => parseTipsMarkdown(broken)).toThrow(/titulo/);
  });
});
