const { RuleTester } = require('eslint');
const tsParser = require('typescript-eslint').parser;

const rule = require('./docstring-only-comments');

const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module' },
});

ruleTester.run('docstring-only-comments', rule, {
  valid: [
    { code: '/** Adds numbers. */\nexport function add(a, b) { return a + b; }' },
    { code: '/**\n * Multi-line docstring.\n *\n * @param a - First.\n */\nconst x = 1;' },
    { code: 'function f() {\n  /** Documented local. */\n  const y = 2;\n  return y;\n}' },
    { code: '// eslint-disable-next-line no-console\nconsole.log(1);' },
    {
      code: '/* eslint-disable no-console -- justified */\nconsole.log(1);\n/* eslint-enable no-console */',
    },
    { code: 'const a = 1; // eslint-disable-line no-unused-vars' },
    { code: '// @ts-expect-error intentionally wrong\nconst n: number = "a";' },
    { code: '// @ts-ignore\nconst n = 1;' },
    { code: '// prettier-ignore\nconst m = [1,   2];' },
    { code: '/// <reference types="expo/types" />\nexport {};' },
    { code: 'const noComments = 1;' },
    {
      code: '/** Shape. */\ninterface Shape {\n  /** Size. */\n  size: number;\n  /** Grows. */\n  grow(): void;\n}',
    },
    {
      code: '/** Holder. */\nclass Holder {\n  /** Value. */\n  value = 1;\n  /** Reads. */\n  read() { return 1; }\n}',
    },
    {
      code: '/** Kind. */\nexport type Kind = "a";\n/** Mode. */\nexport default function mode() {}',
    },
    { code: 'const config = {\n  /** Port. */\n  port: 1,\n};' },
    { code: '/** Config. */\nmodule.exports = { a: 1 };' },
  ],
  invalid: [
    {
      code: '// stray comment\nconst a = 1;',
      errors: [{ messageId: 'notDocstring' }],
    },
    {
      code: 'function f() {\n  // inside body\n  return 1;\n}',
      errors: [{ messageId: 'notDocstring' }],
    },
    {
      code: 'const a = 1; // trailing\n',
      errors: [{ messageId: 'notDocstring' }],
    },
    {
      code: '/* plain block */\nconst a = 1;',
      errors: [{ messageId: 'notDocstring' }],
    },
    {
      code: 'const a = 1; /** trailing docstring */\n',
      errors: [{ messageId: 'notDocstring' }],
    },
    {
      code: 'function f() {\n  /** over a return */\n  return 1;\n}',
      errors: [{ messageId: 'notDocstring' }],
    },
    {
      code: '/** over a call */\nrun();',
      errors: [{ messageId: 'notDocstring' }],
    },
    {
      code: 'function f() {\n  /** over an if */\n  if (a) { b(); }\n}',
      errors: [{ messageId: 'notDocstring' }],
    },
    {
      code: 'const a = 1;\n/** dangling at the end */',
      errors: [{ messageId: 'notDocstring' }],
    },
    {
      code: '// one\n// two\nconst a = 1;',
      errors: [{ messageId: 'notDocstring' }, { messageId: 'notDocstring' }],
    },
    {
      code: '// eslint-disable-next-line no-console\n// but this is not\nconsole.log(1);',
      errors: [{ messageId: 'notDocstring', line: 2 }],
    },
  ],
});
