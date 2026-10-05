import type { Tx } from '@pluma/db';
import { createChallenge } from '../challenges';

/** Solo para el seed: emite un código de firma sin enviar correo. */
export const createChallengeForSeed = (tx: Tx, email: string, shareId: string) => createChallenge(tx, new Date(), email, 'split_share', shareId);
