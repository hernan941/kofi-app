import { uuidSchema, type IdGenerator, type Uuid } from '../ids';

const COUNTER_DIGITS = 12;

/**
 * Ids deterministas con forma UUIDv7 válida y creciente
 * (`00000000-0000-7000-8000-000000000001`, ...), aceptados por `uuidSchema`.
 */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  next(): Uuid {
    this.counter += 1;
    const suffix = this.counter.toString(16).padStart(COUNTER_DIGITS, '0');
    return uuidSchema.parse(`00000000-0000-7000-8000-${suffix}`);
  }
}
