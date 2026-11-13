const DIRECTIVE_PATTERN =
  /^\s*(eslint-(disable|enable)(-next-line|-line)?\b|eslint-env\b|@ts-(expect-error|ignore|nocheck|check)\b|prettier-ignore\b)/;
const TRIPLE_SLASH_PATTERN = /^\/\s*</;

/**
 * Tells whether a comment is a tool directive (ESLint, TypeScript or Prettier) or a
 * triple-slash reference, which are allowed because they are instructions, not prose.
 *
 * @param {import('estree').Comment} comment - Comment node from the source code.
 * @returns {boolean} `true` when the comment is a directive.
 */
function isDirective(comment) {
  if (comment.type === 'Line' && TRIPLE_SLASH_PATTERN.test(comment.value)) {
    return true;
  }
  return DIRECTIVE_PATTERN.test(comment.value);
}

/**
 * Tells whether a comment is a `/** ... *\/` docstring that starts its own line.
 *
 * @param {import('estree').Comment} comment - Comment node from the source code.
 * @param {import('eslint').SourceCode} sourceCode - Source code being linted.
 * @returns {boolean} `true` when the comment is a docstring placed on its own line.
 */
function isStandaloneDocstring(comment, sourceCode) {
  if (comment.type !== 'Block' || !comment.value.startsWith('*')) {
    return false;
  }
  const lineStart = sourceCode.lines[comment.loc.start.line - 1].slice(0, comment.loc.start.column);
  return lineStart.trim() === '';
}

const DOCUMENTABLE_NODES = new Set([
  'FunctionDeclaration',
  'ClassDeclaration',
  'VariableDeclaration',
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSEnumDeclaration',
  'TSModuleDeclaration',
  'TSDeclareFunction',
  'ExportNamedDeclaration',
  'ExportDefaultDeclaration',
  'MethodDefinition',
  'PropertyDefinition',
  'TSAbstractMethodDefinition',
  'TSAbstractPropertyDefinition',
  'TSPropertySignature',
  'TSMethodSignature',
  'TSIndexSignature',
  'TSEnumMember',
  'Property',
]);

/**
 * Tells whether a node is an assignment to `module.exports` or `exports.*`, the CommonJS
 * form of an export declaration.
 *
 * @param {import('estree').Node} node - Candidate node.
 * @returns {boolean} `true` for a CommonJS export assignment statement.
 */
function isCommonJsExport(node) {
  if (node.type !== 'ExpressionStatement' || node.expression.type !== 'AssignmentExpression') {
    return false;
  }
  const { left } = node.expression;
  const root = left.type === 'MemberExpression' ? left.object : left;
  return (
    (left.type === 'MemberExpression' &&
      left.object.name === 'module' &&
      left.property.name === 'exports') ||
    (root.type === 'Identifier' && root.name === 'exports') ||
    (root.type === 'MemberExpression' &&
      root.object.name === 'module' &&
      root.property.name === 'exports')
  );
}

/**
 * Tells whether the code that follows a comment starts a declaration (or a member of one):
 * climbs from the node at the next token while the parent starts at the same position.
 *
 * @param {import('estree').Comment} comment - Docstring being checked.
 * @param {import('eslint').SourceCode} sourceCode - Source code being linted.
 * @returns {boolean} `true` when the docstring documents a declaration.
 */
function documentsDeclaration(comment, sourceCode) {
  const token = sourceCode.getTokenAfter(comment, { includeComments: false });
  if (!token) {
    return false;
  }
  let node = sourceCode.getNodeByRangeIndex(token.range[0]);
  while (node && node.type !== 'Program') {
    if (DOCUMENTABLE_NODES.has(node.type) || isCommonJsExport(node)) {
      return true;
    }
    if (!node.parent || node.parent.range[0] !== node.range[0]) {
      return false;
    }
    node = node.parent;
  }
  return false;
}

/**
 * ADR-003: reports every comment that is not a TSDoc docstring above a declaration or a tool
 * directive.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Allow only `/** */` docstrings and tool directives as comments (ADR-003).',
    },
    schema: [],
    messages: {
      notDocstring:
        'Only TSDoc docstrings (`/** */`) directly above a declaration are allowed; extract the code into a named function instead.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (
            isDirective(comment) ||
            (isStandaloneDocstring(comment, sourceCode) &&
              documentsDeclaration(comment, sourceCode))
          ) {
            continue;
          }
          context.report({ loc: comment.loc, messageId: 'notDocstring' });
        }
      },
    };
  },
};
