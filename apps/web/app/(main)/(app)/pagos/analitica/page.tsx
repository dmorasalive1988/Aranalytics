import { redirect } from 'next/navigation';

/** La analítica ahora tiene su propia entrada en el menú. */
export default function OldAnalytics() {
  redirect('/analitica');
}
