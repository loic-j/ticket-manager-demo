export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

/** Runs several adapter calls atomically (inbox claim + notification write). */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}
