# pluma

> Donde nacen las canciones. **Escribe. Firma. Cobra.** · *Write it. Own it. Get paid.* · *Escreva. Assine. Receba.*

Editora musical digital para compositores, productores y artistas latinos de LatAm y del mercado US Latin: administración editorial, red de colaboración con splits firmados, catálogo A&R y sync.

## Estado

| Fase | Alcance | Estado |
|---|---|---|
| 0 | Monorepo, sistema de diseño, i18n, base de datos, RLS, auditoría | ✅ |
| a | Onboarding y membresía, obras y splits, firma de coautores, back-office de obras | ✅ |
| b | Statements, dashboard y retiros (con archivo ficticio) | ✅ |
| c | Notificaciones: correo, push, WhatsApp opcional y centro in-app, con preferencias y seguimiento de envíos | ✅ |
| d | Red Pluma | Siguiente |
| e | Catálogo A&R y Sync | Pendiente |

Plan, modelo de datos y pantallas en [`docs/`](docs/).

## Estructura

```
apps/web       App del autor (PWA, es/en/pt-BR) + firma de coautores · Next.js 16
apps/admin     Back-office (tema claro, 2FA en producción) · Next.js 16
apps/worker    Outbox de eventos y tareas programadas (pg-boss)
packages/domain    Reglas de negocio puras (splits, membresía, estados…)
packages/db        Migraciones SQL, RLS, auditoría encadenada, cliente Drizzle
packages/services  Casos de uso (onboarding, membresía, obras, firmas, back-office, notificaciones)
packages/connectors Conectores de statements (mapeo declarativo por proveedor)
packages/pdf       Statement oficial en PDF con la marca
packages/adapters  Stripe, Postmark, Supabase Auth/Storage, RFC 3161, KYC
packages/emails    Correos transaccionales trilingües
packages/ui        Sistema de diseño Pluma (tokens, logo, componentes)
packages/i18n      Textos es / en / pt-BR
```

## Correr en local

Requisitos: Node 22, pnpm 10 y PostgreSQL 16 (local o en Docker). No hace falta Supabase: el modo de desarrollo trae autenticación, pagos simulados, correo y almacenamiento locales.

```bash
pnpm install
cp .env.example .env            # ajusta DATABASE_URL y pon un PLUMA_SIGNING_SECRET
createdb pluma                  # o: docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
pnpm db:migrate                 # migraciones + capa de compatibilidad con Supabase
pnpm db:seed                    # datos de ejemplo en los tres idiomas
pnpm dev                        # web :3000 · admin :3001 · worker
```

Cuentas de ejemplo (contraseña `pluma-dev-2026`):

| Cuenta | Qué ves |
|---|---|
| `valentina@pluma.test` | Autora Pro (es), obra registrada con 4 coautores |
| `diego@pluma.test` | Autor Socio (es), obra en disputa |
| `sam@pluma.test` | Autora Pro (en), obra esperando firmas |
| `camila@pluma.test` | Autora Socio (pt-BR), obra en borrador |
| `admin@pluma.test` | Back-office, super admin |
| `operaciones@pluma.test` / `aprobaciones@pluma.test` | Back-office, operador / aprobador |

- Los correos (códigos de verificación, invitaciones a firmar) quedan en `.dev-mail/`, como `.json` y `.html`.
- El pago abre un checkout simulado en `/dev/checkout`.
- Statements: el seed deja **2026-Q1 publicado** y **2026-Q2 cargado**. Para procesarlo entra al back-office como `operaciones@pluma.test` → Statements → 2026-Q2: registra la tasa EUR (1,0850), resuelve las 2 líneas de Matching, calcula con USD 1.442,17 (prueba antes 1.442,16 para ver el bloqueo) y luego entra como `aprobaciones@pluma.test` para aprobar y publicar. Detalle del archivo en [`fixtures/statements/`](fixtures/statements/README.md).
- `pnpm db:reset` borra todo y vuelve a migrar.

## Pruebas

```bash
# Unitarias e integración (necesitan PostgreSQL en localhost:5432, usuario postgres/postgres)
for p in domain db adapters emails connectors pdf services ui i18n; do (cd packages/$p && pnpm vitest run); done

# Criterios de aceptación de punta a punta (levanta su propio servidor y base pluma_e2e)
pnpm e2e
```

Qué cubren:

- **Criterio 1:** onboarding completo en es, en y pt-BR en menos de 5 minutos. Un autor Socio no puede activar sync ni A&R hasta mejorar a Pro (validado en la interfaz, el servicio y la base de datos).
- **Criterio 2:** una obra con 4 coautores no se envía con 99,99 %. No pasa a registro hasta la última firma.
- **Criterio 7:** toda acción sobre dinero, splits y contratos queda en una auditoría de solo inserción, encadenada por hash. Hay una prueba que simula una manipulación y la detecta.
- **Criterio 3:** el statement ficticio se ingiere, normaliza, casa y concilia; con un centavo de diferencia (USD 1.442,16 en lugar de 1.442,17) la aprobación y la publicación quedan bloqueadas.
- **Criterio 4:** al publicar, cada autor recibe un único correo en su idioma con su neto; el PDF sale del mismo modelo que el dashboard y el ledger se acredita por el mismo monto. Publicar dos veces no duplica nada.
- Distribución y conciliación (entregable 4): reparto por mayor residuo, negativos, retenidos, suspenso, FX, reproducibilidad; retiros con doble aprobación y datos bancarios cifrados.
- Contraste de todos los pares de color, paridad de textos entre idiomas y ausencia de nombres de proveedores en textos visibles.

## Desplegar en producción

1. **Supabase**: crea el proyecto y aplica las migraciones con `DATABASE_URL=<conexión directa> pnpm db:migrate`. En el entorno local la capa de compatibilidad solo se aplica si no existe el esquema `auth`; en Supabase no se aplica.
   - Auth: activa correo con código (en la plantilla de confirmación usa `{{ .Token }}`), Google, Apple y MFA TOTP.
   - Storage: crea los buckets privados `audio-originals`, `audio-previews`, `documents`, `statements-raw` y `kyc`.
2. **Stripe**: crea dos precios anuales (Socio USD 20 y Pro USD 50). Pon sus IDs en `STRIPE_PRICE_SOCIO`, `STRIPE_PRICE_PRO` y en `plan_prices.stripe_price_id` (desde Configuración en el back-office). Crea un webhook hacia `https://app.<dominio>/api/webhooks/stripe` con los eventos `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` y `customer.subscription.deleted`.
3. **Postmark**: verifica el dominio de envío y configura `POSTMARK_TOKEN` y `PLUMA_EMAIL_FROM`. Crea un webhook hacia `https://pluma:<POSTMARK_WEBHOOK_SECRET>@app.<dominio>/api/webhooks/postmark` con los eventos Delivery, Open, Bounce y Spam Complaint: actualizan el seguimiento de envíos y suprimen las direcciones con rebote permanente.
   - **Push**: genera las claves VAPID una vez (`npx web-push generate-vapid-keys`) y configura `PLUMA_VAPID_PUBLIC`, `PLUMA_VAPID_PRIVATE` y `PLUMA_VAPID_SUBJECT`. Son obligatorias en producción.
   - **WhatsApp** (opcional, apagado por defecto): con `PLUMA_WHATSAPP=meta`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_TOKEN` de la WhatsApp Cloud API. Antes, aprueba en Meta las plantillas `pluma_statement_published`, `pluma_payout_sent`, `pluma_payment_failed` y `pluma_split_invitation` en es, en_US y pt_BR.
4. **Vercel**: crea dos proyectos, `apps/web` (app.<dominio>) y `apps/admin` (admin.<dominio>), con las variables de `.env.example`:
   - `NODE_ENV=production`, `PLUMA_AUTH_MODE=supabase`, `PLUMA_PAYMENTS=stripe`, `PLUMA_EMAIL=postmark`, `PLUMA_STORAGE=supabase`, `PLUMA_INLINE_DISPATCH=0`.
   - `DATABASE_URL` debe apuntar al pooler de Supabase (puerto 6543).
   - En producción la app se niega a arrancar con pagos simulados, correo local o autenticación de desarrollo.
5. **Clave de datos**: `PLUMA_DATA_KEY` (32 bytes en base64, `openssl rand -base64 32`) cifra el ID fiscal y los datos bancarios. Guárdala en el gestor de secretos: sin ella esos datos no se pueden leer.
6. **Worker**: despliega `apps/worker` como proceso permanente (Fly.io o Railway; `pnpm --filter @pluma/worker start`) con las mismas variables. Despacha las notificaciones cada 5 s, reintenta cada hora los envíos fallidos (hasta 5 intentos), corre las tareas diarias (recordatorios de firma, vencimientos, renovaciones, suspensiones, verificación de la auditoría), publica los statements programados y genera los PDF. Necesita acceso a `packages/pdf/fonts` (o `PLUMA_PDF_FONTS_DIR`).
7. **Sello de tiempo**: define `PLUMA_TSA_URL` (por ejemplo, la de un proveedor RFC 3161 calificado) para sellar la prueba de autoría.
8. **Personal interno**: crea la cuenta desde la app y asígnale el rol con SQL la primera vez (`insert into user_roles (user_id, role) values ('<id>', 'super_admin')`); después, desde Usuarios internos.
