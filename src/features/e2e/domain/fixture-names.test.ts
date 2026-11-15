import { e2eFixtureNameSchema, seedRouteParamsSchema } from './fixture-names';

describe('e2eFixtureNameSchema', () => {
  it.each(['basic', 'large'])('accepts %s', (name) => {
    expect(e2eFixtureNameSchema.safeParse(name).success).toBe(true);
  });

  it.each(['', 'BASIC', '../basic', 'basic.zip', 'huge', 1, undefined])('rejects %j', (name) => {
    expect(e2eFixtureNameSchema.safeParse(name).success).toBe(false);
  });

  it('requires the fixture parameter of the route', () => {
    expect(seedRouteParamsSchema.safeParse({}).success).toBe(false);
    expect(seedRouteParamsSchema.safeParse({ fixture: 'large' }).success).toBe(true);
  });
});
