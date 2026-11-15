const BOM = '﻿';
const SEPARATOR = ';';
const LINE_BREAK = '\r\n';
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);
const NEEDS_QUOTES = /[;"\r\n]/;

/**
 * Escapa una celda: antepone `'` si empieza como una fórmula (`=`, `+`, `-`, `@`, tabulación o
 * retorno de carro) y después aplica las comillas de RFC 4180 si contiene `;`, `"`, CR o LF.
 */
export function escapeCsvCell(value: string): string {
  const safe = FORMULA_TRIGGERS.has(value.charAt(0)) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Serializa filas de celdas: BOM, `;` entre celdas y CRLF al final de cada fila (D-10). */
export function serializeCsv(rows: readonly (readonly string[])[]): string {
  const body = rows.map((row) => `${row.map(escapeCsvCell).join(SEPARATOR)}${LINE_BREAK}`).join('');
  return `${BOM}${body}`;
}
