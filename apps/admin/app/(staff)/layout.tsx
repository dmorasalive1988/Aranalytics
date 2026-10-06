import { PlumaLogo } from '@pluma/ui';
import { Sidebar } from '@/components/sidebar';
import { isDemoMode } from '@pluma/db/env';
import { deps, requireStaff } from '@/lib/server';
import { signOutAction } from '../entrar/actions';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const sa = staff.roles.includes('super_admin');
  return (
    <div className="flex min-h-dvh flex-wrap">
      {isDemoMode() && (
        <div role="note" className="flex w-full flex-wrap items-center justify-center gap-x-3 bg-ambar px-4 py-1.5 text-center text-xs font-bold text-tinta">
          <span>Demo de Pluma · datos ficticios, sin pagos ni correos reales</span>
          <a href={`${deps().appUrl}/demo/correo`} className="text-tinta underline">Ver correos enviados</a>
        </div>
      )}
      <aside data-theme="dark" className="flex w-full flex-col gap-6 bg-tinta px-5 py-7 text-papel md:sticky md:top-0 md:h-dvh md:w-[248px]">
        <PlumaLogo size={24} product="admin" />
        <nav aria-label="Back-office">
          <Sidebar
            items={[
              { href: '/', label: 'Inicio' },
              { href: '/autores', label: 'Autores' },
              { href: '/obras', label: 'Obras' },
              { href: '/exportar', label: 'Exportar para registro' },
              { href: '/disputas', label: 'Disputas y conflictos' },
              { href: '/statements', label: 'Statements' },
              { href: '/matching', label: 'Matching' },
              { href: '/pagos', label: 'Retiros' },
              { href: '/red', label: 'Red' },
              { href: '/sync', label: 'Sync' },
              { href: '/ar', label: 'A&R' },
              { href: '/notificaciones', label: 'Notificaciones' },
              { href: '/auditoria', label: 'Auditoría' },
              ...(sa ? [{ href: '/configuracion', label: 'Configuración' }, { href: '/usuarios', label: 'Usuarios internos' }] : []),
            ]}
          />
        </nav>
        <div className="mt-auto flex flex-col gap-2 text-xs text-[#C9C6D6]">
          <span className="truncate">{staff.email}</span>
          <span>{staff.roles.join(' · ')}</span>
          <form action={signOutAction}><button className="min-h-11 text-left font-bold text-ambar">Cerrar sesión</button></form>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-8 md:px-10">{children}</main>
    </div>
  );
}
