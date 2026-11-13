throw new Error(
  'React Native cannot be loaded in the `node` Jest project (ADR-005, ADR-013). ' +
    'Move this test to a ui location (hooks, components, screens, adapters) or remove the import.',
);
