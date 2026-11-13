/**
 * Babel configuration. `babel-plugin-inline-import` embeds the `.sql` files that
 * `migrations.js` imports, because Metro cannot read the migrations folder at runtime (ADR-006).
 *
 * @param {import('@babel/core').ConfigAPI} api - Babel API used to cache the configuration.
 * @returns {import('@babel/core').TransformOptions} Babel options.
 */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
