import { getRandomBytes } from 'expo-crypto';

import { createUuidV7Generator, type IdGenerator } from '@/shared/domain/ids';
import type { Clock } from '@/shared/domain/calendar/clock';

/**
 * Generador de ids real: UUIDv7 con los bytes aleatorios de `expo-crypto`, sin depender de
 * `crypto.getRandomValues` global (ADR-006). Solo conecta la fuente; la lógica es del dominio.
 */
export function createDeviceIdGenerator(clock: Clock): IdGenerator {
  return createUuidV7Generator(clock, (length) => getRandomBytes(length));
}
