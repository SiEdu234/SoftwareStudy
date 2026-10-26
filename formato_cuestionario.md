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
     },
     {
       "id": "q_1004",
       "type": "single",
       "isCode": true,
       "text": "function sum(a, b) { return a + b; }\nconsole.log(sum(2, 3));",
       "feedback": "El código define una función de suma y la llama con 2 y 3, por lo que imprime 5.",
       "points": 10,
       "tags": ["programación", "javascript"],
       "options": [
         { "id": "opt_a", "text": "3", "isCorrect": false },
         { "id": "opt_b", "text": "5", "isCorrect": true },
         { "id": "opt_c", "text": "Error", "isCorrect": false }
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
 5. **Indicador de Código (`isCode`)**: (Opcional) Un campo booleano que indica si la pregunta contiene código fuente puro. Si es `true`, el sistema resaltará automáticamente el bloque de texto con estilo de código e incluirá una anotación de la IA.
 
 ## Formato XML Soportado
Además del formato JSON, el sistema ha sido actualizado para inyectar archivos `.xml`. La estructura es muy similar y cuenta con el mismo soporte para Markdown/código en el interior de los nodos:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<quiz>
    <title>Nombre del Cuestionario o Materia</title>
    <question id="q_1001" type="single" points="10">
        <text>¿Cuál es la capital de Francia?</text>
        <feedback>París es la capital de Francia.</feedback>
        <option id="opt_a" isCorrect="false">Madrid</option>
        <option id="opt_b" isCorrect="true">París</option>
    </question>
    
    <question id="q_1002" type="multiple" points="15">
        <text>
            Selecciona los lenguajes de programación web:
            ```javascript
            console.log("Soporta código Markdown aquí también");
            ```
        </text>
        <feedback>HTML es de marcado, los otros sí.</feedback>
        <option id="opt_x" isCorrect="true">JavaScript</option>
        <option id="opt_y" isCorrect="false">HTML</option>
    </question>
</quiz>
```
Nota: `points`, `id`, `type` e `isCorrect` son atributos XML, mientras que `<text>`, `<feedback>` y el valor de `<option>` son nodos de texto.

---

# Guía de Generación de Preguntas con IA (Prompts Específicos)

Esta sección explica cómo convertir tus archivos de estudio (**PDFs, Words, PowerPoints, código o apuntes**) en cuestionarios compatibles con Estudien Vagos utilizando modelos de IA generativa (ChatGPT, Claude, Gemini o DeepSeek).

## ¿Cómo Funciona el Flujo de Trabajo?

1. **Prepara tu material**: Ten a mano tu archivo de estudio (un PDF denso, una presentación en PowerPoint `.pptx`, un documento en Word `.docx` o apuntes).
2. **Selecciona y copia el prompt adecuado**: Elige el prompt específico según el tipo de documento (ver abajo).
3. **Pega en la IA**: Abre ChatGPT, Claude, Gemini o DeepSeek, sube tu archivo adjunto y pega el prompt.
4. **Guarda el resultado**: Copia la respuesta JSON generada, pégala en un editor de texto (como el Bloc de Notas o VS Code) y guárdala con extensión `.json` (ejemplo: `preguntas_tema1.json`) con codificación UTF-8.
5. **Sube a la plataforma**: En Estudien Vagos, entra en la materia correspondiente, presiona el botón **"Subir preguntas"** y selecciona tu archivo. ¡Listo para estudiar en modo Práctica o Repaso!

---

## 1. Prompt para PDFs, Libros y Papers Académicos

> **Ideal para:** Capítulos de libros, artículos científicos (papers), guías docentes y manuales técnicos extensos.

```text
Actúa como un profesor universitario y examinador académico titular.
He adjuntado un documento PDF (libro, paper de investigación, guía técnica o normativa).
Tu misión es analizar exhaustivamente TODO el contenido del PDF y generar un banco de preguntas riguroso en formato JSON válido para la plataforma "Estudien Vagos".

Instrucciones prioritarias para este PDF:
1. Cobertura distribuida: No te concentres únicamente en las primeras páginas. Distribuye las preguntas a lo largo de todo el documento (inicio, desarrollo, metodologías, ejemplos y conclusiones).
2. Profundidad académica: Diseña preguntas que evalúen comprensión conceptual (30%), análisis causa-efecto o contrastes teóricos (40%), y resolución de casos o escenarios de aplicación (30%).
3. Feedback fundamentado: En el campo "feedback", explica con detalle la razón pedagógica y técnica de la respuesta correcta citando o parafraseando la tesis del texto, y aclara el error de las alternativas falsas.
4. Diversidad de preguntas:
   - "single": Para conceptos nucleares con 4 opciones (1 correcta).
   - "multiple": Para características, condiciones o principios con 2 o más opciones correctas.
   - "boolean": Para postulados clave o afirmaciones con matices técnicos (Verdadero/Falso).
5. Salida estricta: Devuelve EXCLUSIVAMENTE el bloque JSON válido, sin texto adicional antes ni después.

Estructura JSON:
{
  "title": "Tema extraído del PDF",
  "description": "Evaluación basada en el documento PDF adjunto",
  "version": "2.0",
  "questions": [
    {
      "id": "q_pdf_1",
      "type": "single",
      "text": "¿Pregunta académica basada en el contenido del PDF?",
      "feedback": "Justificación fundamentada en el texto del documento que explica la respuesta correcta.",
      "points": 10,
      "tags": ["capitulo_o_seccion", "concepto_clave"],
      "options": [
        { "id": "opt_a", "text": "Distractor verosímil A", "isCorrect": false },
        { "id": "opt_b", "text": "Respuesta correcta B", "isCorrect": true },
        { "id": "opt_c", "text": "Distractor conceptual C", "isCorrect": false },
        { "id": "opt_d", "text": "Distractor común D", "isCorrect": false }
      ]
    }
  ]
}

Genera [20] preguntas cubriendo de forma equilibrada todo el PDF adjunto.
```

---

## 2. Prompt para Documentos Word (.docx), Resúmenes y Apuntes

> **Ideal para:** Apuntes tomados en clase, resúmenes estudiantiles, guías de examen y tablas comparativas.

```text
Actúa como un tutor universitario y diseñador de simulacros de examen.
He adjuntado un documento de Word (.docx o resumen de apuntes tomados en clase).
Tu objetivo es convertir estos apuntes en un banco de preguntas tipo test de alto impacto en formato JSON para la plataforma "Estudien Vagos".

Instrucciones específicas para apuntes y resúmenes:
1. Énfasis de cátedra: Identifica los conceptos donde el profesor o autor puso mayor énfasis (definiciones destacadas, advertencias típicas de examen "¡ojo con esto!", listas y comparativas).
2. Claridad y precisión: Corrige posibles frases informales o esquemáticas de los apuntes para redactar preguntas con enunciados formales, inequívocos y profesionales.
3. Distractores realistas: En las opciones erróneas, incluye las confusiones y malas interpretaciones más frecuentes entre los alumnos en este tema.
4. Feedback de refuerzo: El campo "feedback" debe funcionar como una mini-lección que recuerde la regla nemotécnica, principio o resumen clave.
5. Salida estricta: Devuelve ÚNICAMENTE el código JSON válido.

Estructura JSON:
{
  "title": "Nombre de la Materia - Unidad",
  "description": "Simulacro de examen basado en apuntes de clase",
  "version": "2.0",
  "questions": [
    {
      "id": "q_doc_1",
      "type": "single",
      "text": "¿Enunciado formulado a partir de los apuntes?",
      "feedback": "Explicación que resuelve la duda y refuerza la regla clave vista en clase.",
      "points": 10,
      "tags": ["unidad_estudio", "apuntes"],
      "options": [
        { "id": "opt_a", "text": "Opción correcta fundamentada", "isCorrect": true },
        { "id": "opt_b", "text": "Confusión típica del alumno", "isCorrect": false },
        { "id": "opt_c", "text": "Concepto de otro tema", "isCorrect": false },
        { "id": "opt_d", "text": "Afirmación parcialmente cierta pero incompleta", "isCorrect": false }
      ]
    }
  ]
}

Genera [20] preguntas a partir del archivo Word adjunto.
```

---

## 3. Prompt para Diapositivas PowerPoint (.pptx o Slides PDF)

> **Ideal para:** Presentaciones con viñetas esquemáticas, diagramas, esquemas y poco texto corrido.

```text
Actúa como un profesor universitario preparando el examen oficial de su cátedra a partir de las diapositivas de clase (PowerPoint / Keynote).
He adjuntado la presentación. Dado que las diapositivas suelen contener viñetas esquemáticas, frases cortas y diagramas, tu labor es reconstruir e inferir el contexto completo de la explicación docente y generar preguntas de examen sólidas en formato JSON para "Estudien Vagos".

Instrucciones esenciales para Diapositivas:
1. Reconstrucción contextual: No te limites a copiar y pegar las viñetas en la pregunta. Profundiza en el concepto integral detrás de cada diapositiva y explica la lógica de los diagramas o flujos expuestos.
2. Relación y síntesis: Diseña preguntas que conecten ideas de varias diapositivas (comparación de arquitecturas, ventajas vs inconvenientes, fases de un proceso o taxonomías).
3. Feedback ampliado: Ya que la diapositiva original carece de texto explicativo continuo, usa el campo "feedback" para proveer la explicación completa y enriquecida que el profesor daría oralmente en clase.
4. Formato estricto: Devuelve ÚNICAMENTE el bloque JSON válido, sin bloques de texto conversacional.

Estructura JSON:
{
  "title": "Tema de la Presentación",
  "description": "Cuestionario de estudio generado a partir de diapositivas",
  "version": "2.0",
  "questions": [
    {
      "id": "q_ppt_1",
      "type": "single",
      "text": "¿Pregunta que evalúa el fondo conceptual de la lámina?",
      "feedback": "Explicación integral que profundiza y contextualiza la viñeta de la diapositiva.",
      "points": 10,
      "tags": ["modulo", "presentacion"],
      "options": [
        { "id": "opt_a", "text": "Alternativa A", "isCorrect": false },
        { "id": "opt_b", "text": "Alternativa B (Correcta)", "isCorrect": true },
        { "id": "opt_c", "text": "Alternativa C", "isCorrect": false },
        { "id": "opt_d", "text": "Alternativa D", "isCorrect": false }
      ]
    }
  ]
}

Genera [15 a 20] preguntas profundas a partir de las diapositivas adjuntas.
```

---

## 4. Prompt para Programación, Algoritmos & Código

> **Ideal para:** Materias de informática, sistemas, desarrollo de software, algoritmos y bases de datos.

```text
Actúa como un evaluador técnico senior y profesor de Ciencias de la Computación / Ingeniería de Software.
A partir del documento o temario adjunto, genera un examen técnico en formato JSON válido para la plataforma "Estudien Vagos".

Instrucciones para preguntas con código:
1. Snippets con Markdown: Envuelve los fragmentos de código dentro del campo "text" usando triples comillas invertidas y el lenguaje (ej: ```javascript ... ``` o ```python ... ```).
2. Campo isCode: Cuando la pregunta contenga un fragmento de código principal para analizar, incluye `"isCode": true`.
3. Variedad de retos técnicos:
   - Salida por consola ("¿Qué imprime el siguiente código?").
   - Detección y corrección de bugs ("¿Cuál es el error en la función?").
   - Complejidad algorítmica (Notación Big-O en tiempo y espacio).
   - Patrones de diseño, concurrencia o buenas prácticas de refactorización.
4. Traza detallada en Feedback: Explica paso a paso la ejecución del código en el campo "feedback" para entender el flujo mental.
5. Salida estricta: Devuelve ÚNICAMENTE el JSON válido.

Estructura JSON:
{
  "title": "Evaluación Técnica de Programación",
  "description": "Preguntas con análisis de código y buenas prácticas",
  "version": "2.0",
  "questions": [
    {
      "id": "q_code_1",
      "type": "single",
      "isCode": true,
      "text": "¿Cuál es la salida del siguiente código?\n```javascript\nconst nums = [10, 20, 30];\nconst res = nums.filter(n => n > 15).map(n => n * 2);\nconsole.log(res[0]);\n```",
      "feedback": "El método filter conserva [20, 30]. Luego map multiplica por 2 obteniendo [40, 60]. El primer elemento res[0] es 40.",
      "points": 10,
      "tags": ["javascript", "arrays", "programacion"],
      "options": [
        { "id": "opt_a", "text": "20", "isCorrect": false },
        { "id": "opt_b", "text": "40", "isCorrect": true },
        { "id": "opt_c", "text": "30", "isCorrect": false },
        { "id": "opt_d", "text": "NaN", "isCorrect": false }
      ]
    }
  ]
}

Genera [15] preguntas técnicas a partir del material proporcionado.
```

---

## 5. Consejos Clave para Trabajar con la IA

- **Tamaño de lote:** Pide entre 15 y 25 preguntas por prompt. Pedir más de 30 puede provocar que la IA alcance su límite de tokens de respuesta y corte el JSON.
- **Si el JSON se corta:** Si la IA se detiene antes de cerrar el corchete `]}` final, dile:
  `"Continúa exactamente desde donde te quedaste, sin repetir nada anterior y asegurándote de cerrar la estructura JSON válidamente"`.
- **Validación del JSON:** Si quieres asegurarte de que la IA no dejó comas sueltas o caracteres extraños, puedes pegar el resultado en [JSONLint](https://jsonlint.com/) o directamente arrastrarlo al importador de Estudien Vagos; si hay algún error de sintaxis, la plataforma te indicará exactamente qué ocurrió.

