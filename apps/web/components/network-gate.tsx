import { getTranslations } from 'next-intl/server';
import { isDomainError } from '@pluma/domain';
import { Notice } from '@pluma/ui';
import { CircleAlert } from 'lucide-react';
import { network } from '@pluma/services';
import { deps } from '@/lib/server';

/** Comprueba el acceso a la red (plan vigente y mayoría de edad). Devuelve el aviso si no hay acceso. */
export async function networkGate(userId: string) {
  try {
    return { member: await network.assertNetworkMember(deps(), userId), notice: null };
  } catch (e) {
    if (!isDomainError(e)) throw e;
    const t = await getTranslations('network');
    return { member: null, notice: <Notice tone="alert" icon={<CircleAlert size={20} strokeWidth={2} />} title={e.code === 'NETWORK_MINOR' ? t('minor') : t('inactive')} /> };
  }
}
