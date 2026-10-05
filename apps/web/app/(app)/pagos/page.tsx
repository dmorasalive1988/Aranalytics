import { getTranslations } from 'next-intl/server';
import { Wallet } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export async function generateMetadata() {
  return { title: (await getTranslations('nav'))('payments') };
}

/** Pagos y statements (fase b). */
export default function Payments() {
  return <ComingSoon section="payments" icon={<Wallet size={28} strokeWidth={2} aria-hidden />} />;
}
