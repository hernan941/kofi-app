import type { DocumentPicker, PickedDocument } from '../domain/ports';

/**
 * `DocumentPicker` de test: devuelve el documento configurado (o `null`, como si la persona
 * cancelara) y registra los tipos pedidos. `failure` hace que el selector falle.
 */
export class FakeDocumentPicker implements DocumentPicker {
  readonly requests: (readonly string[])[] = [];
  picked: PickedDocument | null = null;
  failure: Error | null = null;

  pickSingle(options: { readonly mimeTypes: readonly string[] }): Promise<PickedDocument | null> {
    this.requests.push(options.mimeTypes);
    return this.failure === null ? Promise.resolve(this.picked) : Promise.reject(this.failure);
  }
}
