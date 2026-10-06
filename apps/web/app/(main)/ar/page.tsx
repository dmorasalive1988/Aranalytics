import { redirect } from 'next/navigation';

/** Entrada del portal A&R (también ar.<dominio>): lleva al catálogo, que pide sesión e invitación. */
export default function ArPortalHome() {
  redirect('/ar/catalogo');
}
