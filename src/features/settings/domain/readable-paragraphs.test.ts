import { toReadableParagraphs } from './readable-paragraphs';
import { LICENSE_TEXTS } from './third-party-notices.generated';

const MIT = `MIT License

Copyright (c) 2020 Dustin Do

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED.`;

function words(text: string): string[] {
  return text.split(/\s+/).filter((word) => word !== '');
}

describe('toReadableParagraphs', () => {
  it('joins the lines cut by hand inside each paragraph', () => {
    const paragraphs = toReadableParagraphs(MIT);

    expect(paragraphs).toHaveLength(4);
    expect(paragraphs[2]).toBe(
      'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.',
    );
    for (const paragraph of paragraphs) {
      expect(paragraph).not.toContain('\n');
    }
  });

  it.each([
    ['dash', '- one\n- two'],
    ['asterisk', '* one\n* two'],
    ['number', '1. one\n2. two'],
    ['letter in parentheses', '(a) one\n(b) two'],
  ])('does not join the lines of a list with a %s', (_name, list) => {
    const paragraphs = toReadableParagraphs(`Intro line\nsecond line\n${list}`);

    expect(paragraphs[0]).toBe('Intro line second line');
    expect(paragraphs.slice(1)).toHaveLength(2);
  });

  it('starts a paragraph when the indentation grows and joins lines with the same indentation', () => {
    const paragraphs = toReadableParagraphs('Header\n    indented line\n    second line');

    expect(paragraphs).toEqual(['Header', 'indented line second line']);
  });

  it('joins the lines that hang under a list item', () => {
    const paragraphs = toReadableParagraphs(
      '(a) You must give\n    a copy of this; and\n(b) You must',
    );

    expect(paragraphs).toEqual(['(a) You must give a copy of this; and', '(b) You must']);
  });

  it('removes the leading spaces of every paragraph', () => {
    expect(toReadableParagraphs('   indented\n   same')).toEqual(['indented same']);
  });

  it('treats CRLF like LF', () => {
    expect(toReadableParagraphs(MIT.replace(/\n/g, '\r\n'))).toEqual(toReadableParagraphs(MIT));
  });

  it('keeps every word of the original, in order', () => {
    expect(words(toReadableParagraphs(MIT).join(' '))).toEqual(words(MIT));
  });

  it('gives no paragraphs for an empty text', () => {
    expect(toReadableParagraphs('  \n \n')).toEqual([]);
  });

  describe('with the real Apache 2.0 text', () => {
    const apache = Object.values(LICENSE_TEXTS).find((text) => text.includes('Apache License'));

    it('makes far fewer paragraphs than lines, none starting with a space', () => {
      const lines = (apache ?? '').split('\n').filter((line) => line.trim() !== '');
      const paragraphs = toReadableParagraphs(apache ?? '');

      expect(apache).toBeDefined();
      expect(paragraphs.length).toBeLessThan(lines.length / 2);
      for (const paragraph of paragraphs) {
        expect(paragraph).not.toMatch(/^\s/);
      }
    });

    it('keeps every word, in order', () => {
      expect(words(toReadableParagraphs(apache ?? '').join(' '))).toEqual(words(apache ?? ''));
    });
  });
});
