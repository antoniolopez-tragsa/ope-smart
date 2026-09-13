# OPE Smart Study — Web Edition

## Cómo ejecutar

Opción 1:
- Abrir `index.html` directamente.

Opción 2 (recomendado):
- Usar VSCode + Live Server.

## Funciones

- Modo estudio por bloques.
- Modo test configurable: 20, 50 o 100 preguntas.
- Filtro de test: parte común, parte específica o todo el temario.
- Modo entrenamiento con corrección inmediata.
- Navegación anterior/siguiente dentro del test.
- Marcar preguntas para revisión.
- Finalización anticipada del test.
- Resultado final con aciertos, fallos y preguntas sin responder.
- Historial de hasta 50 tests.
- Repaso inteligente basado en rendimiento.
- Estadísticas por pregunta y globales.
- Persistencia local mediante `localStorage`.
- Migración compatible con el progreso antiguo guardado en `opeFails`.
- Responsive para escritorio y móvil.

## Estructura relevante

- `assets/data/comun.json` — 300 preguntas de la parte común.
- `assets/data/especifica.json` — 200 preguntas de la parte específica.
- `assets/js/app.js` — navegación y vistas principales.
- `assets/js/services/jsonLoader.js` — carga de preguntas.
- `assets/js/services/storage.js` — persistencia y migración.
- `assets/js/services/progress.js` — progreso individual por pregunta.
- `assets/js/services/stats.js` — métricas derivadas.
- `assets/js/services/test.js` — historial de tests.
- `assets/js/utils.js` — utilidades, escape HTML y Fisher-Yates.

## Modelo de progreso

El estado principal se guarda bajo la clave `opeSmartState` y mantiene:

- `questions`: estadísticas individuales de cada pregunta.
- `tests`: historial de resultados de tests.
- `sessions`: reservado para futuras sesiones persistentes.

Cada pregunta dispone de un identificador estable, por ejemplo `comun-001` o `especifica-001`.

## Fase 4

El motor de test mantiene el progreso existente: cada respuesta se registra una sola vez por pregunta durante el test. Volver atrás no genera respuestas duplicadas. Las preguntas marcadas se mantienen durante la sesión y el resultado se incorpora al historial al finalizar.

## Fase 5 — Modo examen

El motor de test incorpora un modo examen además del entrenamiento:

- 20, 50 o 100 preguntas.
- Filtros Todo, Común o Específica.
- Temporizador de 1 minuto por pregunta en modo examen.
- Sin corrección inmediata en examen.
- Navegación anterior/siguiente y marcado de preguntas.
- Entrega manual o automática al agotarse el tiempo.
- Corrección final pregunta a pregunta.
- Registro del resultado, duración y motivo de finalización en el historial.
- Las respuestas de examen se incorporan al progreso únicamente al entregar el examen, evitando duplicados al navegar.

El temporizador es deliberadamente un valor base de 60 segundos por pregunta; podrá sustituirse por el tiempo oficial de una convocatoria cuando se conozcan sus reglas.

## Fase 6 · Explicaciones y referencias

Las preguntas incluyen ahora los campos `explanation` y `reference`. La interfaz los muestra en:

- Estudio, después de responder.
- Repaso inteligente, después de responder.
- Entrenamiento de tests, después de responder.
- Corrección final de exámenes y tests.
- Resultados de bloques fallados.

Las referencias externas no se inventan. Cuando los datos originales no incluyen una fuente normativa o documental concreta, se muestra explícitamente que la referencia externa está pendiente. Esto permite añadir posteriormente referencias oficiales (ley, artículo, BOE, documentación técnica, URL, etc.) sin cambiar el motor.

## Fase 7 — Categorías y mapa de conocimientos

El banco de preguntas incorpora una categoría temática estable por pregunta. Las categorías se utilizan para calcular métricas independientes y construir un mapa de conocimientos en Estadísticas.

- Rendimiento por tema.
- Preguntas practicadas y pendientes por categoría.
- Precisión por categoría.
- Botón para iniciar un repaso limitado a una categoría.
- Las categorías se mantienen en los JSON para que el banco siga siendo portable.
- Se evita mezclar el cálculo de métricas con la persistencia del progreso.

El etiquetado inicial se ha realizado a partir de la estructura temática del banco existente. Se puede refinar posteriormente pregunta a pregunta sin modificar el motor.
