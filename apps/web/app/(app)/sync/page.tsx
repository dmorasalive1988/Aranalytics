import { redirect } from 'next/navigation';

/** Sync del autor: empieza en licencias (A33). */
export default function Sync() {
  redirect('/sync/licencias');
}
