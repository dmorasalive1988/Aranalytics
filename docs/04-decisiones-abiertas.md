# Pluma: decisiones abiertas

Para avanzar necesito tu respuesta o tu visto bueno en estos puntos. Al lado de cada uno va mi propuesta por defecto: si estás de acuerdo, basta con "ok".

## Bloqueantes para la fase a

| # | Pregunta | Propuesta por defecto |
|---|---|---|
| 1 | ¿Apruebas los 5 ajustes al stack (Drizzle, pg-boss, Postmark, KYC regional, búsqueda híbrida con Claude + Voyage)? | Sí |
| 2 | Dominios: ¿`pluma.mu` u otro? ¿Subdominios por superficie? | `app.`, `firma.`, `ar.`, `sync.`, `admin.` sobre el dominio que elijas |
| 3 | Proveedor de KYC | MetaMap (cobertura CO, MX, PE, EC, BR, US); en el MVP queda un *stub* con aprobación manual del operador |
| 4 | Texto legal del contrato de administración y términos (ES/EN/PT) | Lo aporta tu equipo legal; uso un borrador marcado "BORRADOR" mientras tanto |
| 5 | Edad mínima sin tutor | Según el país de residencia (18 por defecto; tabla configurable) |

## Bloqueantes para la fase b (statements)

| # | Pregunta | Propuesta por defecto |
|---|---|---|
| 6 | Formato del archivo de Chappell | Construyo el conector con un mapeo declarativo y un CSV ficticio con columnas típicas; se ajusta al recibir una muestra real |
| 7 | Base de la comisión | Sobre el **neto que Chappell paga a Pluma** por la línea (después del fee de Chappell) |
| 8 | Split aplicable a una línea | Versión firmada vigente al **último día del período de explotación** |
| 9 | Comisión de un autor con membresía suspendida o cancelada al publicar | Comisión del **último plan que tuvo** (si nunca tuvo Pro, 20%) |
| 10 | Moneda de los statements y del saldo | USD; conversión a la moneda local solo al pagar, con la tasa documentada |
| 11 | Fuente de tasas FX | Tasa del proveedor de payouts al momento del pago + ECB diaria como referencia |
| 12 | Proveedor de payouts | Wise Business (Payoneer como segunda opción) |
| 13 | Monto mínimo de retiro | USD 20 |
| 14 | Retenciones fiscales por país | Tabla inicial vacía y configurable; necesito los porcentajes que defina tu asesor fiscal |
| 15 | ¿Chappell paga solo las partes administradas o el 100% de la obra? | Solo las administradas; si llega el 100%, lo no administrado va a suspenso |

## Fases d y e

| # | Pregunta | Propuesta por defecto |
|---|---|---|
| 16 | Límite diario de postulaciones: N (Socio) y M (Pro) | N = 3, M = 10 (configurables) |
| 17 | Vigencia de una solicitud en la red | 30 días, renovable |
| 18 | Comisión de Pluma en sync | 30% de la parte editorial (configurable) |
| 19 | Tabla de tarifas de sync | Rangos ficticios marcados "referencial" hasta tener la tabla real |
| 20 | Quién invita a los A&R | Operadores de Pluma y, en el futuro, autores Pro |
| 21 | ¿Las solicitudes de licencia necesitan la aprobación de **todos** los socios de la obra o de la mayoría? | De todos los socios; los externos se informan |

## Diseño

| # | Pregunta | Propuesta por defecto |
|---|---|---|
| 22 | ~~Capturas del lienzo de marca y del prototipo~~ | **Resuelto**: lienzo recibido y traducido a [05-sistema-de-diseno.md](./05-sistema-de-diseno.md) |
| 23 | Modo claro en la app del autor | Solo oscuro en el MVP; el back-office, claro |
| 24 | Borde de campos de formulario (contraste 1.4.11) | Opción B: `#6B6E8C` solo en campos; el resto conserva `#3A3D57` |
| 25 | Texto Ámbar en el back-office | `#9A5B00` en lugar de `#B86E00` del prototipo |
| 26 | Copia de Pluma Sync tras solicitar licencia | "Un especialista de Pluma te contacta para cerrar la licencia" (el MVP no emite licencia automática) |
| 27 | Pluma Sync en tema oscuro, como el prototipo | Sí |
