const AMOUNT_CHARACTERS = /^[\d.]*$/;
const PLAIN_DIGITS = /^\d+$/;
const GROUPED_DIGITS = /^\d{1,3}(\.\d{3})+$/;
const LEADING_ZEROS = /^0+(?=\d)/;

/** Removes the spaces and a leading `$`, which the field shows on its own. */
function normalize(text: string): string {
  return text.replace(/\s+/g, '').replace(/^\$/, '');
}

/** Groups a string of digits with `.` every three figures, without leading zeros. */
function groupDigits(digits: string): string {
  return digits.replace(LEADING_ZEROS, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Tells whether a text is empty, plain digits or digits well grouped by thousands. */
function isWellFormed(text: string): boolean {
  return text === '' || PLAIN_DIGITS.test(text) || GROUPED_DIGITS.test(text);
}

/** Counts the thousands separators of a text. */
function countDots(text: string): number {
  return text.split('.').length - 1;
}

/**
 * Tells whether a change is the user typing or deleting a digit over a well formed text:
 * at most one digit of difference and the same separators. A point that appears, moves or
 * disappears and leaves a malformed grouping (`1` to `1.5`) is not a typing edit and is
 * kept so validation can reject it.
 */
function isDigitEdit(previous: string, text: string): boolean {
  const before = normalize(previous);
  if (before === '' || !isWellFormed(before) || countDots(text) !== countDots(before)) {
    return false;
  }
  const digitDifference = Math.abs(
    text.replaceAll('.', '').length - before.replaceAll('.', '').length,
  );
  return digitDifference <= 1;
}

/**
 * Text of a money field after a change, with thousands grouped while typing. A change of
 * one digit over a well formed previous text (typing or deleting) is regrouped, and so is a
 * pasted amount that is already well formed. Any other text is kept as is, so that
 * `parseClpInput` rejects it with a reason instead of guessing (ADR-010).
 */
export function nextAmountText(previous: string, next: string): string {
  const text = normalize(next);
  if (!AMOUNT_CHARACTERS.test(text)) {
    return next;
  }
  if (isWellFormed(text) || isDigitEdit(previous, text)) {
    return groupDigits(text.replaceAll('.', ''));
  }
  return next;
}
