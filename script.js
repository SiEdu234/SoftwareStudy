document.addEventListener('DOMContentLoaded', () => {
    // State
    let allQuestions = []; // Pool of all questions from loaded files
    let currentQuizQuestions = []; // Questions for the current session (subset or all)
    let currentQuestionIndex = 0;
    let score = 0;
    let userAnswers = []; // Store user selected option IDs for current question
    let currentMode = 'test'; // 'test' or 'study'

    // DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-upload');
    const uploadSection = document.getElementById('upload-section');
    const setupSection = document.getElementById('setup-section');
    const quizSection = document.getElementById('quiz-section');
    const resultsSection = document.getElementById('results-section');
    const questionContainer = document.getElementById('question-container');
    const progressBar = document.getElementById('progress-bar');
    const submitBtn = document.getElementById('submit-btn');
    const nextBtn = document.getElementById('next-btn');
    const restartBtn = document.getElementById('restart-btn');
    const totalQuestionsCountEl = document.getElementById('total-questions-count');

    // Event Listeners
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Setup Screen Actions
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const count = e.target.dataset.count;
            startSession(action, count);
        });
    });

    submitBtn.addEventListener('click', checkAnswer);
    nextBtn.addEventListener('click', nextQuestion);
    restartBtn.addEventListener('click', restartApp);

    function handleFiles(files) {
        if (!files || files.length === 0) return;

        allQuestions = []; // Reset global pool
        let filesProcessed = 0;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    if (json.questions && Array.isArray(json.questions)) {
                        allQuestions = allQuestions.concat(json.questions);
                    }
                } catch (err) {
                    console.error("Error parsing file:", file.name, err);
                    alert(`Error leyendo ${file.name}. Verifica el formato JSON.`);
                } finally {
                    filesProcessed++;
                    if (filesProcessed === files.length) {
                        onFilesLoaded();
                    }
                }
            };
            reader.readAsText(file);
        });
    }

    function onFilesLoaded() {
        if (allQuestions.length === 0) {
            alert('No se encontraron preguntas válidas en los archivos.');
            return;
        }

        totalQuestionsCountEl.textContent = allQuestions.length;
        uploadSection.classList.add('hidden');
        setupSection.classList.remove('hidden');
    }

    function shuffleArray(array) {
        // Create a copy to shuffle
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    function startSession(mode, countStr) {
        currentMode = mode;
        setupSection.classList.add('hidden');
        quizSection.classList.remove('hidden');

        // Prepare Questions
        let questionsToUse = shuffleArray(allQuestions); // Always random pool base

        if (mode === 'test') {
            if (countStr !== 'all') {
                const count = parseInt(countStr);
                questionsToUse = questionsToUse.slice(0, count);
            }

            // Randomize options for each question in the subset
            questionsToUse.forEach(q => {
                if (q.options) {
                    q.options = shuffleArray(q.options);
                }
            });

            currentQuizQuestions = questionsToUse;
            currentQuestionIndex = 0;
            score = 0;
            renderQuestion();

        } else if (mode === 'study') {
            currentQuizQuestions = allQuestions; // Study all
            renderStudyMode();
        }
    }

    // --- TEST MODE LOGIC ---

    function renderQuestion() {
        const question = currentQuizQuestions[currentQuestionIndex];
        userAnswers = [];

        // Update progress
        const progress = ((currentQuestionIndex) / currentQuizQuestions.length) * 100;
        progressBar.style.width = `${progress}%`;

        // Reset UI
        submitBtn.classList.remove('hidden');
        nextBtn.classList.add('hidden');
        questionContainer.classList.remove('study-mode-container'); // Ensure standard view

        // Type label
        const typeLabels = { 'single': 'Opción Única', 'multiple': 'Opción Múltiple', 'boolean': 'Verdadero / Falso' };
        const typeLabel = typeLabels[question.type] || 'Pregunta';

        let html = `
            <div class="question-header">
                <span class="question-number">Pregunta ${currentQuestionIndex + 1} de ${currentQuizQuestions.length}</span>
                <span class="question-type-badge">${typeLabel}</span>
            </div>
            <h2 class="question-text">${question.text}</h2>
            <div class="options-grid">
        `;

        question.options.forEach(opt => {
            html += `
                <div class="option-item" data-id="${opt.id}" onclick="selectOption('${opt.id}', '${question.type}', this)">
                    <div class="option-content">${opt.text}</div>
                </div>
            `;
        });

        html += `</div><div id="feedback-container"></div>`;
        questionContainer.innerHTML = html;

        // Re-bind click event
        const optionsGrid = questionContainer.querySelector('.options-grid');
        optionsGrid.addEventListener('click', (e) => {
            const item = e.target.closest('.option-item');
            if (item) {
                handleSelection(item.dataset.id, question.type, item);
            }
        });
    }

    function handleSelection(id, type, element) {
        if (submitBtn.classList.contains('hidden')) return;

        if (type === 'single' || type === 'boolean') {
            document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
            userAnswers = [id];
            element.classList.add('selected');
        } else if (type === 'multiple') {
            const index = userAnswers.indexOf(id);
            if (index === -1) {
                userAnswers.push(id);
                element.classList.add('selected');
            } else {
                userAnswers.splice(index, 1);
                element.classList.remove('selected');
            }
        }
    }

    function checkAnswer() {
        const question = currentQuizQuestions[currentQuestionIndex];
        const correctIds = question.options.filter(o => o.isCorrect).map(o => o.id);

        let isCorrect = false;
        if (correctIds.length === 0) {
            isCorrect = userAnswers.length === 0;
        } else {
            if (userAnswers.length === correctIds.length) {
                isCorrect = userAnswers.every(ans => correctIds.includes(ans));
            }
        }

        if (isCorrect) score++;

        // Visual Feedback
        document.querySelectorAll('.option-item').forEach(el => {
            const id = el.dataset.id;
            const isSelected = userAnswers.includes(id);
            const isActuallyCorrect = correctIds.includes(id);

            if (isActuallyCorrect) {
                el.classList.add('correct');
            } else if (isSelected && !isActuallyCorrect) {
                el.classList.add('incorrect');
            }
            el.style.cursor = 'default';
        });

        // Feedback Text
        const feedbackContainer = document.getElementById('feedback-container');
        const feedbackMsg = isCorrect ? '¡Correcto!' : 'Incorrecto';

        feedbackContainer.innerHTML = `
            <div class="feedback-text ${isCorrect ? 'correct-msg' : 'incorrect-msg'}">
                <strong>${feedbackMsg}</strong>
                <p>${question.feedback || ''}</p>
            </div>`;

        submitBtn.classList.add('hidden');
        nextBtn.classList.remove('hidden');
    }

    function nextQuestion() {
        // Progress Alert roughly every 10 questions
        const questionsAnswered = currentQuestionIndex + 1;
        if (questionsAnswered % 10 === 0 && questionsAnswered < currentQuizQuestions.length) {
            alert(`--- PROGRESO ---\nHas contestado ${questionsAnswered} preguntas.\nPuntuación parcial: ${score}/${questionsAnswered} (${Math.round((score / questionsAnswered) * 100)}%)`);
        }

        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuizQuestions.length) {
            renderQuestion();
        } else {
            showResults();
        }
    }

    function showResults() {
        quizSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');

        const percentage = Math.round((score / currentQuizQuestions.length) * 100) || 0;
        document.getElementById('score-value').textContent = percentage;

        document.getElementById('score-details').textContent =
            `Has acertado ${score} de ${currentQuizQuestions.length} preguntas.`;
    }

    // --- STUDY MODE LOGIC ---

    function renderStudyMode() {
        // Hide standard controls
        submitBtn.classList.add('hidden');
        nextBtn.classList.add('hidden');
        progressBar.style.width = '100%';

        questionContainer.innerHTML = '';

        let htmlContent = '<div class="study-list">';

        currentQuizQuestions.forEach((q, index) => {
            const correctOpts = q.options.filter(o => o.isCorrect).map(o => o.text).join(', ');
            // If no correct options (trick question)
            const answerText = correctOpts || "Ninguna opción es correcta (Selección Vacía)";

            htmlContent += `
                <div class="study-item">
                    <h3>${index + 1}. ${q.text}</h3>
                    <ul>
                        ${q.options.map(o => `<li style="${o.isCorrect ? 'color: var(--success); font-weight:bold;' : ''}">${o.text}</li>`).join('')}
                    </ul>
                    <div class="correct-answer">Respuesta Correcta: ${answerText}</div>
                    <p class="feedback-text" style="background:#f1f5f9; padding:0.5rem; font-size:0.9rem;">${q.feedback || ''}</p>
                </div>
            `;
        });

        htmlContent += '</div>';
        questionContainer.innerHTML = htmlContent;

        // Add a "Finish" button at the bottom of the container?
        // Or just leave the restart button used in results.
        // We can show the results section directly? Or just a button to go back.
        // Let's add a "Volver" button at the bottom of the study list
        const backBtn = document.createElement('button');
        backBtn.className = 'btn primary';
        backBtn.textContent = 'Volver al Inicio';
        backBtn.style.marginTop = '2rem';
        backBtn.onclick = restartApp;
        questionContainer.appendChild(backBtn);
    }

    function restartApp() {
        allQuestions = [];
        currentQuizQuestions = [];
        resultsSection.classList.add('hidden');
        quizSection.classList.add('hidden');
        setupSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        fileInput.value = '';
    }
});
