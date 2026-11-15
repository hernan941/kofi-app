const ts = require('typescript');

/**
 * Evaluates the source of the generated module (TypeScript with only type imports) and returns
 * its exports. Used by the check and by the freshness test, which run without compiling the app.
 *
 * @param {string} source
 * @returns {{ THIRD_PARTY_NOTICES: object[], LICENSE_TEXTS: Record<string, string> }}
 */
function loadGeneratedModule(source) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exported = {};
  new Function('exports', outputText)(exported);
  return exported;
}

module.exports = { loadGeneratedModule };
