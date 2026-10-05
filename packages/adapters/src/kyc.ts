/** Verificación de identidad. En el MVP: revisión manual del operador (MetaMap se conecta detrás de esta interfaz). */
export interface KycProvider {
  readonly kind: 'manual' | 'metamap';
  start(userId: string): Promise<{ providerRef: string; redirectUrl: string | null }>;
}

export class ManualKyc implements KycProvider {
  readonly kind = 'manual' as const;
  async start(userId: string) {
    return { providerRef: `manual-${userId}`, redirectUrl: null };
  }
}
