import type { CameraResult, LibraryPick, PhotoPicker } from '../domain';

/**
 * Doble de {@link PhotoPicker} con respuestas programables y un registro de llamadas.
 * Por defecto la galería devuelve una lista vacía (cancelada); si se programan más URIs que el cupo, recorta como el adaptador real y la cámara `cancelled`.
 */
export class FakePhotoPicker implements PhotoPicker {
  /** Cupos pedidos en cada llamada a `pickFromLibrary`. */
  readonly libraryCalls: number[] = [];
  /** Cantidad de llamadas a `takePhoto`. */
  cameraCalls = 0;
  private libraryResponse: readonly string[] | Error = [];
  private cameraResponse: CameraResult | Error = { kind: 'cancelled' };

  /** Programa las URIs que devuelve la galería, o un error. */
  willPick(response: readonly string[] | Error): void {
    this.libraryResponse = response;
  }

  /** Programa la respuesta de la cámara, o un error. */
  willTake(response: CameraResult | Error): void {
    this.cameraResponse = response;
  }

  pickFromLibrary(maxCount: number): Promise<LibraryPick> {
    this.libraryCalls.push(maxCount);
    if (this.libraryResponse instanceof Error) {
      return Promise.reject(this.libraryResponse);
    }
    const uris = this.libraryResponse.slice(0, Math.max(0, maxCount));
    return Promise.resolve({ uris, droppedCount: this.libraryResponse.length - uris.length });
  }

  takePhoto(): Promise<CameraResult> {
    this.cameraCalls += 1;
    return this.cameraResponse instanceof Error
      ? Promise.reject(this.cameraResponse)
      : Promise.resolve(this.cameraResponse);
  }
}
