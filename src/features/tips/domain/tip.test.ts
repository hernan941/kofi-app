import {
  TIP_BODY_MAX_LENGTH,
  TIP_CATEGORIES,
  TIP_TITLE_MAX_LENGTH,
  TIP_TRIGGERS,
  tipIdSchema,
} from './tip';

describe('tipIdSchema', () => {
  test.each(['costos-tu-tiempo', 'registro', 'a1-b2'])('accepts %s', (value) => {
    expect(tipIdSchema.safeParse(value).success).toBe(true);
  });

  test.each(['Costos', 'costos_tu', '-costos', 'costos--x', 'costos-', '', 'a'.repeat(81)])(
    'rejects "%s"',
    (value) => {
      expect(tipIdSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe('tip constants', () => {
  test('exposes the approved categories, triggers and limits', () => {
    expect(TIP_CATEGORIES).toEqual([
      'recording',
      'costs',
      'pricing',
      'fairs',
      'social_media',
      'money_flow',
    ]);
    expect(TIP_TRIGGERS).toEqual(['no_costs', 'first_sale', 'streak', 'no_channel', 'fair_sale']);
    expect(TIP_TITLE_MAX_LENGTH).toBe(50);
    expect(TIP_BODY_MAX_LENGTH).toBe(240);
  });
});
