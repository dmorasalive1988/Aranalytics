/** Pantallas sin sesión: columna móvil centrada. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-5 pb-10 pt-8">{children}</main>;
}
