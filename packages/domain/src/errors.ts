/** Error de regla de negocio. `code` es estable y se traduce en la interfaz. */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'DomainError';
  }
}

export const isDomainError = (e: unknown): e is DomainError =>
  e instanceof Error && e.name === 'DomainError' && typeof (e as DomainError).code === 'string';
