# Pluma: sistema de diseño (v0.1)

Fuente: lienzo **"Pluma — Identidad de marca"** (claude.ai/artifact/Te3bC84hRfCrxfb51KzwZU). Tableros revisados:

| Página | Tablero | Uso en la construcción |
|---|---|---|
| Marca | Logo y concepto | Geometría exacta del símbolo, íconos de app, taglines |
| Marca | Paleta y tipografía | Tokens base y escala tipográfica |
| Marca | App — Dashboard del autor | Referencia estática (navegación desactualizada, ver §8) |
| Marca | Post de lanzamiento | Piezas de marketing, fuera del MVP |
| Prototipo MVP | App del autor (navegable) | **Referencia principal** de la app del autor: bienvenida, registro, plan, inicio, obras, nueva obra, detalle de obra, statement, red, solicitud, publicar, sync |
| Prototipo MVP | Back-office de statements | Referencia del pipeline (E2–E9) |
| Prototipo MVP | Pluma Sync | Referencia del portal (D2–D6) |

Este documento convierte esos tableros en tokens y reglas implementables en `packages/ui`. Donde el lienzo y el brief no coinciden, o donde un color no cumple el contraste exigido, lo señalo en §8 con la resolución que propongo.

---

## 1. Color

### Tokens base (del brief y del lienzo)

| Token | Valor | Uso |
|---|---|---|
| `tinta` | `#0E1020` | Fondo principal (oscuro); texto sobre Ámbar y en tema claro |
| `noche` | `#1B1E33` | Tarjetas, superficies, campos |
| `papel` | `#F4EFE6` | Texto sobre oscuro; fondo del tema claro |
| `ambar` | `#F2A541` | Acento, botones primarios, período actual en gráficas |
| `coral` | `#FF6B57` | Alertas y pendientes |
| `verde` | `#7BD389` | Confirmaciones y firmado |
| `niebla` | `#A8A6B8` | Texto secundario **solo en tema oscuro** |

### Tokens derivados (extraídos del prototipo y nombrados)

| Token | Valor | Uso en el prototipo |
|---|---|---|
| `nav` | `#14172A` | Barra de navegación inferior |
| `linea` | `#23263D` | Divisores y etiquetas de catálogo sobre Noche |
| `elevado` | `#2A2D45` | Botón de reproducir y superficies sobre Noche |
| `borde` | `#3A3D57` | Botón secundario, campos, chips inactivos, interruptor apagado, barras de gráfica |
| `papel-2` | `#C9C6D6` | Texto terciario sobre oscuro (descripciones largas) |
| `ambar-hover` | `#FFD08A` | Hover de enlaces Ámbar |
| `alerta-fondo` | `#2A1A22` | Fondo de alerta (borde Coral) |
| `ok-fondo` | `#17301F` | Fondo de confirmación (borde Verde) |

### Tema claro (back-office)

| Token | Valor | Nota |
|---|---|---|
| `fondo` | `#F4EFE6` (Papel) | |
| `tarjeta` | `#FFFFFF` | |
| `texto` | `#0E1020` (Tinta) | |
| `texto-2` | `#55536A` | Reemplaza a Niebla, que sobre Papel da 2,08:1 |
| `borde-claro` | `#D9D3C7` · `#E6E0D4` · `#F0EBE1` | Fuerte, tabla y fila |
| `ambar-texto` | **`#9A5B00`** | El prototipo usa `#B86E00` (3,99:1 sobre blanco, no cumple); ver §8 |
| `coral-texto` | `#C23A28` | 5,34:1 sobre blanco |
| `barra-lateral` | `#0E1020` con activo en Noche + texto Ámbar | |

### Contraste verificado (WCAG 2.x)

| Par | Ratio | Cumple 4,5:1 |
|---|---:|:-:|
| Papel sobre Tinta | 16,46 | ✓ |
| Papel sobre Noche | 14,32 | ✓ |
| Niebla sobre Tinta / Noche / nav | 7,91 / 6,88 / 7,43 | ✓ |
| Tinta sobre Ámbar (botón primario, tarjeta de saldo) | 9,19 | ✓ |
| Ámbar sobre Noche (enlaces, nav activo) | 7,99 | ✓ |
| Coral sobre fondo de alerta | 5,90 | ✓ |
| Verde sobre fondo de confirmación | 7,79 | ✓ |
| Tinta sobre píldoras Coral / Niebla / Verde | 6,73 / 7,91 / 10,35 | ✓ |
| `#55536A` sobre Papel / blanco | 6,48 / 7,42 | ✓ |
| `#9A5B00` sobre blanco / Papel | 5,43 / 4,74 | ✓ |
| Niebla sobre Papel | 2,08 | ✗ no usar |
| Ámbar o Coral como texto sobre blanco | 2,05 / 2,80 | ✗ no usar |
| `#B86E00` sobre blanco (prototipo) | 3,99 | ✗ reemplazado |

La prueba de contraste se automatiza en CI sobre los pares de tokens: un cambio de color que rompa un par falla el build.

## 2. Tipografía

| Rol | Fuente | Peso | Tamaño / interletrado | Ejemplo en el lienzo |
|---|---|---|---|---|
| Wordmark | Bricolage Grotesque | 800 | −0,04 em | "pluma" 132 px |
| Display | Bricolage Grotesque | 800 | 44–64 px, −0,03 em | "Tu canción, tu firma." |
| H1 | Bricolage Grotesque | 800 | 28–34 px | "Procesar statement" |
| H2 / nombre | Bricolage Grotesque | 600–800 | 22–24 px | Saludo del autor |
| Cuerpo | DM Sans | 400–500 | 15–17 px, interlineado 1,5 | |
| Etiqueta / dato | DM Sans | 500–700 | 13–14 px | |
| Micro (nav, píldora) | DM Sans | 700 | 11 px | |
| Overline | DM Sans | 400–700 | 12 px, +0,14 em, mayúsculas | "TITULARES · BRICOLAGE" |
| Monto destacado | DM Sans | 700 | 36–44 px, −0,02 em, **`tabular-nums`** | "USD 1.284,50" |

Todas las cifras en DM Sans con `font-variant-numeric: tabular-nums`. Las fuentes se sirven con `next/font` (autohospedadas, sin llamada a Google en tiempo de ejecución).

**Formato de montos**: el lienzo muestra `USD 1.284,50`, que es correcto para es-CO y pt-BR pero no para es-MX ni en-US (`USD 1,284.50`). Se formatea con `Intl.NumberFormat` según idioma + país del perfil, siempre con el código de moneda delante.

## 3. Logo

Geometría tomada literalmente del tablero "Logo y concepto" (lienzo 220 × 220, grupo rotado `−42°` sobre `110,110`):

- **Raquis**: `M8 110 L22 104 L196 108 L196 112 L22 116 Z`, color Papel (Tinta en la versión sobre Ámbar). La punta queda abajo a la izquierda tras la rotación.
- **Barbas**: 12 rectángulos de 7 px de ancho, `rx 3.5`, separación 12 px (x = 43, 55, … 175), centrados verticalmente en y = 110, alturas 18, 30, 44, 58, 70, 80, 86, 84, 76, 62, 44, 24, color Ámbar.
- **Ícono de app**: 7 barras de 9 px (`rx 4.5`, x = 55 … 163, alturas 30, 52, 70, 84, 84, 68, 44), contenedor de 88 px con radio 22 px. Variante A: fondo Ámbar y barras + raquis en Tinta. Variante B: fondo Noche, barras Ámbar y raquis Papel.
- **Wordmark**: "pluma" en minúsculas, Bricolage Grotesque 800, −0,04 em, a la derecha del símbolo.
- Sublogos: "pluma **sync**" (sync en Ámbar) para el portal y "pluma ADMIN" (12 px, 600, +0,08 em, Ámbar) para el back-office.

Se implementa como componentes `<PlumaSymbol>`, `<PlumaAppIcon variant>` y `<PlumaLogo product?>` generados desde una sola definición de geometría, y se exportan los íconos PWA (192, 512, maskable) y el favicon.

## 4. Componentes

| Componente | Especificación implementable |
|---|---|
| Botón primario | Ámbar, texto Tinta 700 15 px, alto 52, radio 14, ancho completo en móvil |
| Botón secundario | Transparente, borde 1 px `borde`, texto Papel, alto 52, radio 14 |
| Botón compacto | Alto 44, radio 12, para acciones dentro de tarjetas (p. ej. Retirar / Ver statement en la tarjeta de saldo); sobre Ámbar se invierte: fondo Tinta o borde Tinta 1,5 px |
| Botón de ícono | 44 × 44 circular, fondo Noche, `aria-label` obligatorio |
| Botón de contorno Ámbar | Borde 1 px Ámbar, texto Ámbar, alto 44, radio 10 ("Licenciar") |
| Tarjeta | Noche, radio 16–20, padding 18–22, sin sombra ni borde lateral de color |
| Tarjeta de saldo | Ámbar, texto Tinta, radio 20, monto 36–44 px tabular |
| Campo | Noche, borde 1 px `borde`, alto 48, radio 12, etiqueta visible encima (13 px); foco: anillo 2 px Ámbar |
| Búsqueda grande (Sync) | Alto 56, radio 14, 16 px |
| Chip de filtro | Alto 40, radio 20, 13 px 700; activo Ámbar + Tinta, inactivo borde `borde` + texto Papel; carrusel horizontal en móvil |
| Selector de idioma | Píldoras de 44 px de alto, mínimo 48 de ancho, mismo esquema que los chips |
| Píldora de estado | 11 px 700, padding 5 × 10, radio 12, texto Tinta |
| Alerta | `alerta-fondo`, borde 1 px Coral, radio 16, ícono Coral |
| Confirmación | `ok-fondo`, borde 1 px Verde, radio 14 |
| Interruptor | 52 × 32, radio 16, padding 3; activo Ámbar, inactivo `borde`, perilla Papel de 26 px; con `role="switch"` y `aria-checked` |
| Interruptor bloqueado (Socio) | Interruptor deshabilitado + ícono de candado + enlace "Mejorar a Pro" |
| Navegación inferior | `nav`, borde superior 1 px `linea`, 5 destinos (Inicio, Obras, Red, Sync, Pagos), ícono 22 px + etiqueta 11 px, objetivo mínimo 62 × 48, activo Ámbar 700 |
| Línea de tiempo de obra | Punto de 14 px: completado Ámbar, pendiente con borde 2 px `borde` |
| Fila de split | Nombre, %, estado Firmado (Verde) o Pendiente (Coral) |
| Tabla (back-office) | Encabezado 12 px +0,06 em `texto-2`, filas 14 px con divisor `#F0EBE1`, desplazamiento horizontal dentro de su caja |
| Stepper del pipeline | 5 tarjetas: hecho Tinta/Papel, actual Ámbar/Tinta, pendiente blanco/`texto-2` |
| Fila de resultado Sync | Noche, radio 16, reproducir + título + metadatos + etiquetas (`linea`, 11 px) + ONE-STOP (Ámbar) + Licenciar; seleccionada: fondo `linea` y contorno 2 px Ámbar |

Construidos sobre primitivas sin estilo (Radix) para foco, teclado y lectores de pantalla; ninguna apariencia por defecto de librería.

### Píldoras de estado de obra

| Estado | Color | Nota |
|---|---|---|
| Borrador | Contorno 1 px Niebla, texto Niebla | No aparece en el prototipo; propuesta |
| Esperando firmas | Coral | |
| Splits firmados | Ámbar | |
| Enviada a Warner Chappell / En registro | Niebla | |
| Registrada | Verde | |
| En disputa | Coral + ícono de alerta | Mismo color que "pendiente"; el ícono y el texto la distinguen (nunca solo el color) |

## 5. Iconografía

Trazo de 2 px, `stroke-linecap/linejoin: round`, lienzo de 24 px; los trazados del prototipo son de la familia **Lucide**, que se usa como fuente de íconos (es un set de SVG, no una librería de componentes). Nunca emoji. Los íconos decorativos llevan `aria-hidden`.

## 6. Gráficas

Barras con radio 6, en `borde` (`#3A3D57`); el período actual en Ámbar y su etiqueta en Papel (las demás, en Niebla, 11 px). Sin degradados ni sombras. Los valores exactos van en un tooltip y en una tabla accesible oculta.

## 7. Temas y superficies

| Superficie | Tema | Ancho de diseño |
|---|---|---|
| App del autor | Oscuro | 390 px (móvil primero), escala hasta tablet |
| Firma de coautor | Oscuro | Móvil primero |
| Portal A&R | Oscuro | Escritorio y móvil |
| Pluma Sync | Oscuro (como el prototipo) | 1280–1440 px, contenedor máximo 1360 |
| Back-office | Claro | 1440 px, barra lateral de 220–260 px que se apila en pantallas angostas |

Implementación: variables CSS en `:root` (oscuro) y `[data-theme="light"]`, mapeadas al tema de Tailwind v4 (`@theme`). Ninguna clase de color "cruda" en las pantallas: solo tokens.

## 8. Diferencias encontradas y resolución propuesta

| # | Diferencia | Propuesta |
|---|---|---|
| 1 | El tablero estático "App — Dashboard" tiene navegación Inicio, Obras, **Sesiones**, Sync, **Perfil**; el prototipo navegable y el brief dicen Inicio, Obras, **Red**, Sync, **Pagos** | Seguir el prototipo y el brief; el perfil se abre desde el avatar |
| 2 | El tablero de paleta no incluye Verde `#7BD389` | Se incluye como token del sistema (está en el brief y en el prototipo) |
| 3 | Ámbar como texto en el back-office (`#B86E00`) da 3,99:1 | `#9A5B00` (5,43:1); el tono sigue siendo ámbar |
| 4 | Back-office: el paso 4 dice "comisión del 20%" | Mostrar la comisión por plan (20% Socio / 15% Pro) y el total ponderado |
| 5 | Back-office: "Publicar statements" se habilita justo después de conciliar | Agregar el paso de aprobación por una persona distinta (pantalla E8) y la vista previa de envío (E9) |
| 6 | Back-office: la barra lateral incluye **Soporte**, que no estaba en mi lista de pantallas | Se agrega E23 "Soporte" (casos por autor con historial) |
| 7 | Pluma Sync: "recibes la licencia firmada y la factura en un solo paso" | En el MVP la negociación y la emisión las hace un operador. Texto propuesto: "Solicitud enviada. Los autores la revisan desde su app y un especialista de Pluma te contacta para cerrar la licencia." |
| 8 | Red: los chips del prototipo son Beats / Letras / Sesiones; el brief define 4 tipos | Chips: Todo + Beat busca topliner, Busca productor, Busca verso o coro, Sesión o writing camp (con nombres cortos por idioma) |
| 9 | Botones de 44 px con radio 12 dentro de la tarjeta de saldo, frente a 52/14 del brief | Se formaliza como variante "compacto" (sigue cumpliendo los 44 px táctiles) |
| 10 | Montos siempre como `1.284,50` | Formato según idioma y país (ver §2) |
| 11 | Código de idioma `pt` en el prototipo | `pt-BR` en rutas, mensajes y perfil |
| 12 | El borde de campo `#3A3D57` sobre Noche da 1,55:1; WCAG 1.4.11 pide 3:1 para el contorno de un campo | Mantener el borde de marca y reforzar con etiqueta visible y foco Ámbar de 2 px (opción A), o subir el borde de campos a `#6B6E8C` (3,31:1) (opción B). Recomiendo B solo para campos de formulario |
