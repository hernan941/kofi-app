/**
 * Local ESLint plugin (`local/*`) with the project rules that no standard rule covers.
 */
module.exports = {
  rules: {
    'docstring-only-comments': require('./docstring-only-comments'),
    'routes-only-in-app': require('./routes-only-in-app'),
  },
};
