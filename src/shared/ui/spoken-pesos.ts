const AMOUNT_IN_TEXT = /(-)?\$(\d{1,3}(?:\.\d{3})+|\d+)/g;

/**
 * Text as a screen reader should say it: every CLP amount written with `$` (`$15.000`)
 * becomes "15.000 pesos" (`$1` becomes "1 peso", `-$5.000` becomes "menos 5.000 pesos").
 * Many Spanish voices read a raw `$` as "dólares". Only the label handed to the reader
 * changes; the visible text keeps the `$`.
 */
export function spokenPesos(text: string): string {
  return text.replaceAll(AMOUNT_IN_TEXT, (_match, minus: string | undefined, digits: string) => {
    const unit = digits === '1' ? 'peso' : 'pesos';
    return `${minus === undefined ? '' : 'menos '}${digits} ${unit}`;
  });
}
