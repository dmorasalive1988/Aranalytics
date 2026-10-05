# Pluma: lista de pantallas (v0.1, para aprobación)

Referencia visual: [sistema de diseño](./05-sistema-de-diseno.md) y el prototipo navegable del lienzo de marca. Las pantallas que ya tienen tablero en el prototipo se marcan con ◆.

Prioridad: **P0** = necesaria para un criterio de aceptación · **P1** = parte del MVP · **P2** = puede llegar en la misma fase si hay tiempo.
Fase según el plan: a, b, c, d, e (0 = base).

## A. App del autor: PWA, móvil primero, tema oscuro

Navegación inferior: **Inicio · Obras · Red · Sync · Pagos** (perfil desde el avatar en la cabecera).

### Onboarding y membresía

| # | Pantalla | Contenido clave | Fase | P |
|---|---|---|---|---|
| A1 | Bienvenida ◆ | Logo, "Donde nacen las canciones", tagline en el idioma, selector ES / EN / PT | a | P0 |
| A2 | Crear cuenta / Entrar ◆ | Correo + contraseña, Google, Apple | a | P0 |
| A3 | Verifica tu correo | Código o enlace, reenviar | a | P0 |
| A4 | Tus datos | Nombre legal, artístico, país, fecha de nacimiento (activa el flujo de tutor) | a | P0 |
| A5 | Tu sociedad | SAYCO, SACM, APDAYC, SAYCE, ASCAP, BMI, UBC u otra, IPI opcional con ayuda | a | P0 |
| A6 | Tutor legal (menores) | Datos y documento del tutor, invitación para que firme | a | P1 |
| A7 | Elige tu plan ◆ | Tabla comparativa Socio / Pro, comisión explicada con un ejemplo de USD 100 | a | P0 |
| A8 | Contrato de administración | Resumen en lenguaje claro + documento completo, firma con código | a | P0 |
| A9 | Pago anual | Stripe Payment Element con estilo Pluma, resumen del cargo y la renovación | a | P0 |
| A10 | ¡Listo! | Próximos pasos: registra tu primera obra | a | P0 |
| A11 | Datos fiscales y cobro | Residencia fiscal, ID, formularios, método de payout | b | P0 |
| A12 | Verificación de identidad | Flujo del proveedor KYC embebido, estado | b | P0 |

Meta del criterio 1: A1 → A10 en menos de 5 minutos. A11 y A12 se piden antes del primer retiro, no en el onboarding.

### Inicio y dinero

| # | Pantalla | Contenido clave | Fase | P |
|---|---|---|---|---|
| A13 | Inicio ◆ | Tarjeta Ámbar de saldo, próximo statement oficial (calendario oficial de pagos), alertas, pendientes de firma, actividad de la red | b | P0 |
| A14 | Pagos: resumen | Saldo, histórico por período (barras, actual en Ámbar), botón Retirar | b | P0 |
| A15 | Statement del período ◆ | Totales, desglose por obra, fuente, territorio y tipo de ingreso; PDF y CSV | b | P0 |
| A16 | Detalle de obra en statement | Líneas y cálculo transparente: bruto, comisión, retención, FX, neto | b | P1 |
| A17 | Retirar saldo | Monto, método, comisión del proveedor, confirmación | b | P0 |
| A18 | Certificados de retención | Lista por año y país | b | P1 |
| A19 | Analítica (Pro) | Tendencias por obra, comparación entre períodos, proyección marcada como estimado. En Socio: bloqueada con invitación | b | P1 |
| A20 | Alertas | Regalías sin reclamar, obras sin ingresos en 2 períodos, territorio nuevo | b | P1 |

### Obras y splits

| # | Pantalla | Contenido clave | Fase | P |
|---|---|---|---|---|
| A21 | Obras: lista ◆ | Búsqueda, filtro por estado, píldoras de estado | a | P0 |
| A22 | Nueva obra: datos | Título, alternos, idioma, género, letra, declaración de IA | a | P0 |
| A23 | Nueva obra: archivos | Demo de audio, ISRC de grabaciones existentes | a | P0 |
| A24 | Nueva obra: coautores ◆ | Socio por búsqueda o externo por nombre y correo, rol, %, contador "faltan 12,5%" que bloquea Enviar | a | P0 |
| A25 | Revisar y enviar | Resumen, prueba de autoría, alerta de conflicto si existe | a | P0 |
| A26 | Detalle de obra ◆ | Estado, línea de tiempo, firmas por coautor (reenviar recordatorio), grabaciones, ingresos | a | P0 |
| A27 | Historial de splits | Versiones, quién firmó y cuándo, certificado de evidencia | a | P1 |
| A28 | Editar splits | Crea versión nueva, advierte que todos deben volver a firmar | a | P1 |
| A29 | Firmar mi split (socio) | Documento, porcentaje, código, firmar o reclamar | a | P0 |
| A30 | Reclamar / disputa | Motivo, evidencia, efecto en los pagos explicado | a | P1 |
| A31 | Opciones de catálogo ◆ | Interruptores A&R y Sync (Pro) o bloqueados con invitación (Socio), one-stop, metadatos (mood, BPM, voz, instrumental) | e | P0 |
| A32 | Solicitudes de hold | Aprobar o rechazar 30/60/90 días | e | P0 |
| A33 | Solicitudes de licencia | Uso, territorio, plazo, cotización, aprobar o rechazar | e | P0 |

### Red Pluma

| # | Pantalla | Contenido clave | Fase | P |
|---|---|---|---|---|
| A34 | Tablero ◆ | Chips de tipo, filtros por género, idioma, ciudad y modalidad; Pro destacados | d | P0 |
| A35 | Detalle de solicitud ◆ | Descripción, BPM, split ofrecido, demo protegido, publicador | d | P0 |
| A36 | Publicar solicitud ◆ | Tipo, descripción, género, BPM, split, demo | d | P0 |
| A37 | Postularse | Mensaje, aceptación del split, muestra opcional, cupo restante del día | d | P0 |
| A38 | Mis solicitudes | Postulaciones recibidas con tarjeta del postulante; Aceptar / Ver perfil / Declinar | d | P0 |
| A39 | Mis postulaciones | Estado y vencimiento | d | P1 |
| A40 | Colaboración aceptada ◆ | Contactos revelados, split pre-acordado, enlace a sesión, botón **Cerrar canción** | d | P0 |
| A41 | Perfil público | Créditos verificados, ciudad, idiomas, historial en Pluma | d | P0 |
| A42 | Editar mi perfil | Bio, enlaces DSP, créditos para verificar | d | P1 |

### Sync (autor Pro)

| # | Pantalla | Contenido clave | Fase | P |
|---|---|---|---|---|
| A43 | Sync: inicio ◆ | Mis obras en catálogo, briefs abiertos, licencias en curso (Socio: bloqueado con invitación) | e | P1 |
| A44 | Brief ◆ | Detalle y envío de obras con un clic | e | P1 |

### Cuenta

| # | Pantalla | Contenido clave | Fase | P |
|---|---|---|---|---|
| A45 | Perfil y cuenta | Idioma, datos, sociedad, seguridad | a | P0 |
| A46 | Mi plan | Plan actual, renovación, mejorar a Pro (prorrateo visible), bajar a Socio, facturas | a | P0 |
| A47 | Notificaciones | Preferencias por categoría y canal, push | c | P1 |
| A48 | Privacidad | Descargar mis datos, solicitudes de titular, consentimientos | a | P1 |
| A49 | Centro de notificaciones | Bandeja in-app | c | P2 |

## B. Firma de coautor invitado (sin cuenta)

| # | Pantalla | Fase | P |
|---|---|---|---|
| B1 | Invitación: obra, quién invita, su porcentaje, resumen del split completo | a | P0 |
| B2 | Verificación por código al correo | a | P0 |
| B3 | Revisar y firmar / Reclamar | a | P0 |
| B4 | Firmado: comprobante + invitación opcional (no obligatoria) a hacerse socio | a | P0 |
| B5 | Enlace vencido o versión reemplazada | a | P1 |

## C. Portal A&R (solo invitación, escritorio y móvil)

| # | Pantalla | Fase | P |
|---|---|---|---|
| C1 | Aceptar invitación y crear acceso | e | P0 |
| C2 | Catálogo: búsqueda y filtros, escucha protegida | e | P0 |
| C3 | Obra: ficha, extracto de letra, "Me interesa grabarla", pedir hold 30/60/90 | e | P0 |
| C4 | Mis intereses y holds | e | P1 |

## D. Pluma Sync (escritorio)

| # | Pantalla | Fase | P |
|---|---|---|---|
| D1 | Landing + registro de comprador (empresa, tipo, país) | e | P0 |
| D2 | Búsqueda en lenguaje natural + filtros (mood, género, BPM, idioma, voz, instrumental, one-stop) ◆ | e | P0 |
| D3 | Resultados con reproductor, etiquetas y forma de onda ◆ | e | P0 |
| D4 | Ficha de obra | e | P0 |
| D5 | Cotizador: uso, territorio, plazo → rango de tarifa ◆ | e | P0 |
| D6 | Solicitud de licencia: proyecto, confirmación y seguimiento ◆ | e | P0 |
| D7 | Mis solicitudes | e | P1 |
| D8 | Publicar brief / mis briefs y obras recibidas | e | P1 |

## E. Back-office (escritorio, tema claro, 2FA)

Barra lateral en Tinta: Inicio · Statements · Matching · Autores · Obras · Disputas · Pagos · Soporte · Red · Sync · Notificaciones · Auditoría · Configuración.

| # | Pantalla | Rol | Fase | P |
|---|---|---|---|---|
| E1 | Inicio operativo: colas pendientes (matching, firmas, disputas, payouts, licencias) | Op | b | P1 |
| E2 | Períodos de statements: calendario oficial de pagos y estado ◆ | Op | b | P0 |
| E3 | Cargar archivo: proveedor, período, total recibido; versión y sha256 ◆ | Op | b | P0 |
| E4 | Archivo: resultado del parseo, errores por línea, totales de control | Op | b | P0 |
| E5 | Cola de matching: línea, sugerencias por similitud, asignar o mandar a suspenso ◆ | Op | b | P0 |
| E6 | Corrida de cálculo: parámetros (tasas FX, reglas fiscales, comisiones), recalcular ◆ | Op | b | P0 |
| E7 | Conciliación: ecuación al centavo, diferencias, drill-down ◆ | Op/Ap | b | P0 |
| E8 | Aprobación: revisar y aprobar o rechazar (aprobador ≠ operador) | Ap | b | P0 |
| E9 | Publicación: vista previa (autores, saldo cero), envío de prueba, programar, Publicar ◆ | Op/Ap | c | P0 |
| E10 | Seguimiento de envío: entregas, rebotes, aperturas | Op | c | P1 |
| E11 | Autores: lista y ficha (perfil, KYC, plan, obras, saldo, ledger, contratos) | Op | a | P0 |
| E12 | Obras: lista, ficha, cambio de estado, código de obra del administrador e ISWC | Op | a | P0 |
| E13 | Exportar altas para registro | Op | a | P0 |
| E14 | Conflictos y disputas | Op | a | P1 |
| E15 | Payouts: armar lote, aprobar (doble aprobación), enviar, conciliar | Op/Ap | b | P0 |
| E16 | Red: moderación de solicitudes y verificación de créditos | Op | d | P1 |
| E17 | Sync: licencias (negociar, emitir), briefs, tarifas | Op | e | P0 |
| E18 | A&R: invitaciones y holds | Op | e | P1 |
| E19 | Auditoría: búsqueda por actor, entidad, acción; verificación de cadena | Todos | 0 | P0 |
| E20 | Configuración: planes, precios por región, comisiones, límites, tasas, reglas fiscales | SA | a | P0 |
| E21 | Usuarios internos y roles, 2FA | SA | 0 | P0 |
| E22 | Casos especiales: salidas de autores, herederos, solicitudes de privacidad | Op | b | P1 |
| E23 | Soporte: casos por autor con historial y vínculo a obras, statements y pagos | Op | b | P1 |

## F. Correos y push (plantillas, por idioma)

Invitación a firmar · recordatorio · firma confirmada · split completo · obra enviada / registrada / en disputa · conflicto detectado · postulación recibida (tarjeta del postulante) · postulación enviada · recordatorio 72 h · postulación vencida · postulación aceptada (contactos) · statement publicado · statement en cero · regalías sin reclamar · hold solicitado / decidido · licencia solicitada / decidida · renovación en 15 días · pago fallido · fin de gracia · retiro enviado.

**Total MVP**: 49 pantallas de autor, 5 de firma, 4 de A&R, 8 de Sync, 23 de back-office y unas 25 plantillas.
