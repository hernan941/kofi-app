/**
 * Licenses that the app may distribute without asking (ADR-018). A package with another
 * license stops the generator until the person decides.
 *
 * @type {readonly string[]}
 */
const ALLOWED_LICENSES = [
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'BlueOak-1.0.0',
  'OFL-1.1',
  'CC0-1.0',
  'Unlicense',
];

module.exports = { ALLOWED_LICENSES };
