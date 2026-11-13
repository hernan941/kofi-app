import { tipIdSchema, type Tip, type TipCategory, type TipTrigger } from '../tip';

const CATEGORY_BY_SLUG: Readonly<Record<string, TipCategory>> = {
  registro: 'recording',
  costos: 'costs',
  precios: 'pricing',
  ferias: 'fairs',
  redes: 'social_media',
  'flujo-de-dinero': 'money_flow',
};

const TRIGGER_BY_SLUG: Readonly<Record<string, TipTrigger>> = {
  'sin-costos': 'no_costs',
  'primera-venta': 'first_sale',
  racha: 'streak',
  'sin-canal': 'no_channel',
  'venta-feria': 'fair_sale',
};

const CARD_HEADING = /^### `([^`]+)`\s*$/;
const FIELD_LINE = /^- \*\*([a-z]+)\*\*:\s*(.*)$/;
const REQUIRED_FIELDS = ['categoria', 'titulo', 'cuerpo'] as const;

function translate<Code>(table: Readonly<Record<string, Code>>, slug: string, what: string): Code {
  const code = table[slug];
  if (code === undefined) {
    throw new Error(`Unknown ${what}: ${slug}`);
  }
  return code;
}

function buildTip(id: string, fields: ReadonlyMap<string, string>): Tip {
  for (const field of REQUIRED_FIELDS) {
    if (!fields.has(field)) {
      throw new Error(`Tip ${id} lacks the field ${field}`);
    }
  }
  const trigger = fields.get('contexto');
  return {
    id: tipIdSchema.parse(id),
    category: translate(CATEGORY_BY_SLUG, fields.get('categoria') ?? '', 'category'),
    title: fields.get('titulo') ?? '',
    body: fields.get('cuerpo') ?? '',
    trigger: trigger === undefined ? null : translate(TRIGGER_BY_SLUG, trigger, 'context'),
  };
}

/**
 * Interpreta las fichas de `docs/content/consejos.md` (`### \`id\`` y líneas `- **campo**: valor`)
 * y traduce los slugs de categoría y contexto a los códigos de la app. Solo lo usan los tests.
 * @throws {Error} Si una ficha usa un slug desconocido o le falta un campo obligatorio.
 */
export function parseTipsMarkdown(markdown: string): readonly Tip[] {
  const tips: Tip[] = [];
  let currentId: string | null = null;
  let fields = new Map<string, string>();
  const flush = (): void => {
    if (currentId !== null) {
      tips.push(buildTip(currentId, fields));
    }
  };
  for (const line of markdown.split('\n')) {
    const heading = CARD_HEADING.exec(line);
    if (heading !== null) {
      flush();
      currentId = heading[1] ?? null;
      fields = new Map();
      continue;
    }
    const field = FIELD_LINE.exec(line);
    if (currentId !== null && field?.[1] !== undefined && field[1] !== 'fuentes') {
      fields.set(field[1], (field[2] ?? '').trim());
    }
  }
  flush();
  return tips;
}
