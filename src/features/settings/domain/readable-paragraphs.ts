const LIST_ITEM = /^(?:[-*•]|\d+[.)]|\([a-z0-9]{1,3}\))\s/i;
const LEADING_SPACES = /^ */;

/** Number of spaces at the start of a line. */
function indentOf(line: string): number {
  return LEADING_SPACES.exec(line)?.[0].length ?? 0;
}

/** The line that opened the paragraph being built and the indentation of its last line. */
interface OpenParagraph {
  readonly text: string;
  readonly indent: number;
  readonly isListItem: boolean;
  readonly hasContinuation: boolean;
}

/**
 * Whether `line` goes on the open paragraph: it has the same indentation as the previous line,
 * or it is the first, more indented line that hangs under a list item. A list item or any
 * other increase of indentation starts a paragraph.
 */
function continuesParagraph(open: OpenParagraph, line: string): boolean {
  if (LIST_ITEM.test(line.trimStart())) {
    return false;
  }
  const indent = indentOf(line);
  const isHanging = open.isListItem && !open.hasContinuation && indent > open.indent;
  return indent <= open.indent || isHanging;
}

/**
 * Paragraphs to show a license text on a phone. Lines that were cut by hand to fit 80 columns
 * are joined inside each paragraph; a blank line, a list item (`-`, `*`, `1.`, `(a)`) or an
 * increase of indentation starts a new one. Leading spaces are removed. The words and their
 * order do not change.
 */
export function toReadableParagraphs(text: string): readonly string[] {
  const paragraphs: string[] = [];
  let open = null as OpenParagraph | null;

  const flush = () => {
    if (open !== null) {
      paragraphs.push(open.text);
      open = null;
    }
  };

  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();
    if (line === '') {
      flush();
      continue;
    }
    const content = line.trimStart();
    const indent = indentOf(line);
    if (open !== null && continuesParagraph(open, line)) {
      open = {
        ...open,
        text: `${open.text} ${content}`,
        indent,
        hasContinuation: true,
      };
    } else {
      flush();
      open = {
        text: content,
        indent,
        isListItem: LIST_ITEM.test(content),
        hasContinuation: false,
      };
    }
  }
  flush();
  return paragraphs;
}
