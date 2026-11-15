const { lockFingerprint } = require('./render');

/**
 * Checks that the generated list of licenses still matches the project (ADR-018, 4.3).
 *
 * @param {{
 *   packageJson: { dependencies?: Record<string, string> },
 *   lock: object,
 *   from: { lockFingerprint: string },
 *   notices: { packageName: string, texts: { spdxId: string, textKey: string }[] }[],
 *   texts: Record<string, string>,
 *   notShipped: Record<string, string>,
 *   allowed: readonly string[],
 * }} input
 * @returns {string[]} One message per problem; empty when everything is up to date.
 */
function findFreshnessProblems({ packageJson, lock, from, notices, texts, notShipped, allowed }) {
  const problems = [];
  const direct = Object.keys(packageJson.dependencies ?? {});
  const noticed = new Set(notices.map((notice) => notice.packageName));

  if (lockFingerprint(lock) !== from.lockFingerprint) {
    problems.push('Las dependencias de producción cambiaron: ejecuta `npm run licenses:generate`.');
  }
  for (const name of direct) {
    if (!noticed.has(name) && notShipped[name] === undefined) {
      problems.push(
        `La dependencia ${name} no tiene su licencia en la lista generada: ejecuta \`npm run licenses:generate\`.`,
      );
    }
  }
  for (const name of Object.keys(notShipped)) {
    if (!direct.includes(name)) {
      problems.push(`La excepción notShipped de ${name} quedó obsoleta: ya no es una dependencia.`);
    }
    if (noticed.has(name)) {
      problems.push(`${name} está marcado como no distribuido pero tiene un aviso.`);
    }
  }
  for (const notice of notices) {
    for (const { spdxId, textKey } of notice.texts) {
      if (!allowed.includes(spdxId)) {
        problems.push(`${notice.packageName}: la licencia ${spdxId} no está permitida.`);
      }
      const text = texts[textKey];
      if (text === undefined) {
        problems.push(`${notice.packageName}: falta el texto ${textKey}.`);
      } else if (text.trim() === '') {
        problems.push(`${notice.packageName}: el texto ${textKey} está vacío.`);
      }
    }
  }
  return problems;
}

module.exports = { findFreshnessProblems };
