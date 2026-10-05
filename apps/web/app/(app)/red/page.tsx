import { getTranslations } from 'next-intl/server';
import { Users } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';

export async function generateMetadata() {
  return { title: (await getTranslations('nav'))('network') };
}

/** Red Pluma (fase d). */
export default function Network() {
  return <ComingSoon section="network" icon={<Users size={28} strokeWidth={2} aria-hidden />} />;
}
