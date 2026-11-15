import type { FileSharer } from '../domain/ports';

/** Archivo que se mandó al menú de compartir. */
export interface SharedFile {
  readonly fileUri: string;
  readonly mimeType: string;
  readonly uti?: string;
}

/** `FileSharer` de test: registra lo compartido y permite apagar el menú o hacerlo fallar. */
export class FakeFileSharer implements FileSharer {
  readonly shared: SharedFile[] = [];
  available = true;
  shareFailure: Error | null = null;

  isAvailable(): Promise<boolean> {
    return Promise.resolve(this.available);
  }

  share(
    fileUri: string,
    options: { readonly mimeType: string; readonly uti?: string },
  ): Promise<void> {
    if (this.shareFailure !== null) {
      return Promise.reject(this.shareFailure);
    }
    this.shared.push({ fileUri, ...options });
    return Promise.resolve();
  }
}
