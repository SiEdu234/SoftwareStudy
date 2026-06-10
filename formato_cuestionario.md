# Nuevo Formato de Cuestionario (JSON)

Para aprovechar al máximo las nuevas mejoras en la plataforma y la lógica, el formato JSON de los cuestionarios se ha extendido. Ahora soporta meta-información adicional, un sistema de puntuación, y etiquetas (tags) por pregunta para una mejor organización.

```json
{
  "title": "Nombre del Cuestionario o Materia",
  "description": "Una breve descripción de lo que contiene el archivo (opcional).",
  "version": "2.0",
  "questions": [
    {
      "id": "q_1001",
      "type": "single", 
      "text": "¿Cuál es la capital de Francia?",
      "feedback": "París es la capital y ciudad más poblada de Francia.",
      "points": 10,
      "tags": ["geografía", "europa"],
      "options": [
        { "id": "opt_a", "text": "Madrid", "isCorrect": false },
        { "id": "opt_b", "text": "Londres", "isCorrect": false },
        { "id": "opt_c", "text": "París", "isCorrect": true },
        { "id": "opt_d", "text": "Roma", "isCorrect": false }
      ]
    },
    {
      "id": "q_1002",
      "type": "multiple",
      "text": "Selecciona los lenguajes de programación web:",
      "feedback": "HTML no es un lenguaje de programación propiamente dicho, sino de marcado, aunque a veces se agrupa. Javascript y PHP sí lo son.",
      "points": 15,
      "tags": ["programación", "web"],
      "options": [
        { "id": "opt_a", "text": "JavaScript", "isCorrect": true },
        { "id": "opt_b", "text": "PHP", "isCorrect": true },
        { "id": "opt_c", "text": "HTML", "isCorrect": false }
      ]
    },
    {
      "id": "q_1003",
      "type": "boolean",
      "text": "El sol gira alrededor de la Tierra.",
      "feedback": "Falso. La Tierra gira alrededor del sol (Heliocentrismo).",
      "points": 5,
      "tags": ["astronomía"],
      "options": [
        { "id": "opt_t", "text": "Verdadero", "isCorrect": false },
        { "id": "opt_f", "text": "Falso", "isCorrect": true }
      ]
    }
  ]
}
```

## Novedades del Formato v2.0
1. **Atributos de Raíz**: Ahora puedes incluir un `title`, `description`, y `version` en la raíz del JSON para documentar mejor de qué trata el set de preguntas. La aplicación lo procesará y extraerá las `questions`.
2. **Sistema de Puntos (`points`)**: Permite asignar diferente peso a las preguntas.
3. **Etiquetas (`tags`)**: Un arreglo de strings para clasificar la pregunta. En futuras actualizaciones de la UI permitirá filtrar sesiones de estudio por tags específicos.
4. **Tipos de Pregunta Soportados (`type`)**:
   - `single`: Selección única.
   - `multiple`: Selección múltiple.
   - `boolean`: Verdadero/Falso.
