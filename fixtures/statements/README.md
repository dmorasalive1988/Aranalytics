# Statements ficticios

Archivos para probar el pipeline de statements con los datos de ejemplo (`pnpm db:seed`). Usan el formato provisional `primary_administrator/v1` (ver `packages/connectors/mappings/`). Cuando llegue una muestra real del administrador asociado, solo cambia ese mapeo.

## `2026-Q2.csv`: recorre todos los casos

| Línea | Caso | Resultado esperado |
|---:|---|---|
| 2–4 | *Luna de Medellín* por código de obra | Match automático (código). 4 coautores: Valentina 40 % (Pro), Diego 30 % (Socio), 2 externos al 15 % → suspenso |
| 5 | *Luna de Medellín* solo con ISWC | Match automático (ISWC) |
| 6 | *Cumbia del Río Grande* | Match por código; 100 % Valentina |
| 7 | *Cumbia* en EUR 40,00 | Conversión con la tasa cargada para el período (prueba: 1,0850 → USD 43,40) |
| 8 | *Midnight in Wynwood* por código | Sam 50 %, Valentina 25 %, externo 25 % → suspenso |
| 9 | *Midnight* solo con ISWC | Match automático (ISWC) |
| 10 | *Corrido del Desvelo* por IPI + título | Match automático; la obra está en disputa → **retenido** |
| 11 | *LUNA DE MEDELLIN (EN VIVO)* con código desconocido | Cola de revisión con sugerencia (*Luna de Medellín*) |
| 12 | *CANCION QUE NO EXISTE* con el IPI de Diego | Cola de revisión sin sugerencia → suspenso. Al publicar, Diego recibe el aviso de **regalías sin reclamar** |
| 13 | Reverso de −15,00 del período 2026-Q1 | Ajuste negativo que descuenta a los autores de *Luna* |
| 14–15 | Totales de control | USD 1.398,77 y EUR 40,00 |

**Monto recibido para cuadrar:** USD 1.442,17 (1.398,77 + 40,00 × 1,0850). Si cargas USD 1.442,16, la conciliación queda descuadrada por un centavo y la publicación se bloquea.

## `2026-Q1.csv`

Período anterior, pequeño (USD 650,65). El seed lo procesa y publica para que el dashboard tenga historia.
