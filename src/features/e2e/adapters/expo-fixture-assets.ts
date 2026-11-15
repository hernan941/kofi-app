import { Asset } from 'expo-asset';

import type { E2eFixtureName } from '../domain/fixture-names';
import { E2E_FIXTURE_MODULES } from '../fixtures';

/**
 * Deja el ZIP del fixture como un archivo local legible: `Asset.downloadAsync` lo copia a la
 * caché desde el APK (en `release` el recurso vive dentro del paquete) o desde Metro (en
 * desarrollo). Devuelve la URI `file://`.
 * @throws {Error} Si el sistema no deja la copia local.
 */
export async function materializeFixture(name: E2eFixtureName): Promise<string> {
  const asset = Asset.fromModule(E2E_FIXTURE_MODULES[name]);
  await asset.downloadAsync();
  if (asset.localUri === null) {
    throw new Error(`The fixture ${name} has no local copy.`);
  }
  return asset.localUri;
}
