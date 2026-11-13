const APP_DIRECTORY_PATTERN = /(^|\/)src\/app\//;
const TEST_FILE_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/;
const NATIVE_INTENT_PATTERN = /(^|\/)\+native-intent\.[cm]?[jt]sx?$/;
const COMPONENT_EXPORT_TYPES = new Set([
  'FunctionDeclaration',
  'ArrowFunctionExpression',
  'FunctionExpression',
  'ClassDeclaration',
  'ClassExpression',
  'Identifier',
]);

/**
 * Tells whether the `export default` declaration exports something that can be a route
 * component: a function, a class or a reference to one.
 *
 * @param {import('estree').ExportDefaultDeclaration} node - Default export node.
 * @returns {boolean} `true` when the exported value can be a component.
 */
function exportsComponent(node) {
  return COMPONENT_EXPORT_TYPES.has(node.declaration.type);
}

/**
 * Tells whether the program exports a function named `redirectSystemPath`, the only export
 * Expo Router expects from `+native-intent`.
 *
 * @param {import('estree').Program} program - Program node.
 * @returns {boolean} `true` when the named export exists.
 */
function exportsRedirectSystemPath(program) {
  return program.body.some((statement) => {
    if (statement.type !== 'ExportNamedDeclaration') {
      return false;
    }
    const declaration = statement.declaration;
    if (declaration?.type === 'FunctionDeclaration') {
      return declaration.id?.name === 'redirectSystemPath';
    }
    if (declaration?.type === 'VariableDeclaration') {
      return declaration.declarations.some(
        (item) => item.id.type === 'Identifier' && item.id.name === 'redirectSystemPath',
      );
    }
    return statement.specifiers.some(
      (specifier) => specifier.exported.name === 'redirectSystemPath',
    );
  });
}

/**
 * ADR-005, ADR-013: `src/app/` holds only routes, because Expo Router treats every file
 * there as a route. Reports tests and any file that is not a route, layout or native intent.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Allow only route files (and no tests) inside `src/app/`.' },
    schema: [],
    messages: {
      testInApp: 'Tests must live outside `src/app/` (use `src/__tests__/`).',
      notARoute:
        'Files in `src/app/` must default-export a route component or layout. Move other code to a feature or to `shared`.',
      missingRedirectSystemPath: '`+native-intent` must export a `redirectSystemPath` function.',
    },
  },
  create(context) {
    const filename = context.filename.replaceAll('\\', '/');
    if (!APP_DIRECTORY_PATTERN.test(filename)) {
      return {};
    }
    return {
      Program(program) {
        if (TEST_FILE_PATTERN.test(filename)) {
          context.report({ node: program, messageId: 'testInApp' });
          return;
        }
        if (NATIVE_INTENT_PATTERN.test(filename)) {
          if (!exportsRedirectSystemPath(program)) {
            context.report({ node: program, messageId: 'missingRedirectSystemPath' });
          }
          return;
        }
        const defaultExport = program.body.find((s) => s.type === 'ExportDefaultDeclaration');
        if (!defaultExport || !exportsComponent(defaultExport)) {
          context.report({ node: program, messageId: 'notARoute' });
        }
      },
    };
  },
};
