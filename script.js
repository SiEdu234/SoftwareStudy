const STORAGE_KEY = 'studyflow_data_v1';

document.addEventListener('DOMContentLoaded', () => {
    // === STATE ===
    const state = {
        data: { subjects: [] }, // { subjects: [ { id, name, files: [] } ] }
        currentSubjectId: null,
        selectedFiles: [],
        sessionQuestions: [],
        currentQuestionIndex: 0,
        score: 0,
        userAnswers: [],
        sessionMode: 'test',
        sessionCount: 'all'
    };

    // === DOM ELEMENTS ===
    const views = {
        dashboard: document.getElementById('dashboard-view'),
        subject: document.getElementById('subject-view'),
        quiz: document.getElementById('quiz-view'),
        results: document.getElementById('results-view')
    };

    const els = {
        createSubjectBtn: document.getElementById('btn-create-subject'),
        subjectsGrid: document.getElementById('subjects-grid'),
        backDashboardBtn: document.getElementById('btn-back-dashboard'),
        subjectTitle: document.getElementById('subject-title'),
        importInput: document.getElementById('import-file'),
        filesList: document.getElementById('files-list'),
        startSessionBtn: document.getElementById('btn-start-session'),
        questionContainer: document.getElementById('question-container'),
        progressBar: document.getElementById('progress-bar'),
        progressText: document.getElementById('quiz-progress-text'),
        submitBtn: document.getElementById('submit-btn'),
        nextBtn: document.getElementById('next-btn'),
        exitQuizBtn: document.getElementById('btn-exit-quiz'),
        resultPercentage: document.getElementById('result-percentage'),
        resultDetails: document.getElementById('result-details'),
        scoreCircle: document.getElementById('score-circle-path'),
        returnSubjectBtn: document.getElementById('btn-return-subject'),
        retryBtn: document.getElementById('btn-retry'),
        toast: document.getElementById('toast')
    };

    // === INITIALIZATION ===
    loadData();
    renderDashboard();

    // === EVENT LISTENERS ===

    // Dashboard
    els.createSubjectBtn.addEventListener('click', () => {
        const name = prompt("Nombre de la nueva materia:");
        if (name && name.trim()) {
            createSubject(name.trim());
        }
    });

    els.backDashboardBtn.addEventListener('click', () => switchView('dashboard'));

    // Subject View
    els.importInput.addEventListener('change', handleImport);

    // Session Config
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.sessionCount = e.target.dataset.count;
        });
    });

    document.querySelectorAll('.segment').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.segment').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.sessionMode = e.target.dataset.mode;
        });
    });

    els.startSessionBtn.addEventListener('click', startSession);

    // Quiz Navigation
    els.submitBtn.addEventListener('click', checkAnswer);
    els.nextBtn.addEventListener('click', nextQuestion);

    els.exitQuizBtn.addEventListener('click', () => {
        if (confirm("¿Seguro que quieres salir? Se perderá el progreso actual.")) {
            switchView('subject');
        }
    });

    els.returnSubjectBtn.addEventListener('click', () => switchView('subject'));
    els.retryBtn.addEventListener('click', startSession);

    // === STORAGE MGR ===
    function loadData() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try {
                state.data = JSON.parse(raw);
                if (!state.data.subjects) state.data.subjects = [];
            } catch (e) {
                console.error("Data corrupt, resetting", e);
                state.data = { subjects: [] };
            }
        }
    }

    function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    }

    // === LOGIC ===

    function createSubject(name) {
        const newSubject = {
            id: crypto.randomUUID(),
            name: name,
            files: []
        };
        state.data.subjects.push(newSubject);
        saveData();
        renderDashboard();
        showToast(`Materia "${name}" creada`);
    }

    function deleteSubject(id) {
        if (confirm("¿Eliminar materia y todos sus archivos?")) {
            state.data.subjects = state.data.subjects.filter(s => s.id !== id);
            saveData();
            renderDashboard();
        }
    }

    function openSubject(id) {
        state.currentSubjectId = id;
        const subject = state.data.subjects.find(s => s.id === id);
        if (!subject) return;

        els.subjectTitle.textContent = subject.name;
        state.selectedFiles = []; // Reset selection
        renderFilesList();
        switchView('subject');
    }

    async function handleImport(e) {
        const files = e.target.files;
        if (!files.length) return;

        const subjectIndex = state.data.subjects.findIndex(s => s.id === state.currentSubjectId);
        if (subjectIndex === -1) return;

        let addedCount = 0;
        for (const file of files) {
            try {
                const text = await file.text();
                const json = JSON.parse(text);

                if (!json.questions || !Array.isArray(json.questions)) {
                    throw new Error("Formato inválido");
                }

                const newFile = {
                    id: crypto.randomUUID(),
                    name: file.name.replace('.json', ''),
                    data: json.questions, // Store only questions array to save space? Or full obj
                    date: new Date().toISOString()
                };

                state.data.subjects[subjectIndex].files.push(newFile);
                addedCount++;
            } catch (err) {
                console.error(err);
                showToast(`Error en ${file.name}`, 'error');
            }
        }

        if (addedCount > 0) {
            saveData();
            renderFilesList();
            showToast(`${addedCount} archivos subidos`);
        }
        els.importInput.value = '';
    }

    function deleteFile(fileId) {
        const subjectIndex = state.data.subjects.findIndex(s => s.id === state.currentSubjectId);
        if (subjectIndex === -1) return;

        if (confirm("¿Eliminar archivo?")) {
            state.data.subjects[subjectIndex].files = state.data.subjects[subjectIndex].files.filter(f => f.id !== fileId);
            saveData();
            renderFilesList();
        }
    }

    // === RENDERERS ===

    function renderDashboard() {
        els.subjectsGrid.innerHTML = '';

        if (state.data.subjects.length === 0) {
            els.subjectsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="icon-box"><span class="material-icons-round">folder_off</span></div>
                    <h3>No tienes materias</h3>
                    <p>Agrega una materia para empezar.</p>
                </div>`;
            return;
        }

        state.data.subjects.forEach(subject => {
            const card = document.createElement('div');
            card.className = 'quiz-card fade-in';
            card.innerHTML = `
                <h3>${subject.name}</h3>
                <div class="card-meta">${subject.files.length} archivos</div>
            `;

            // Delete Subject Button (Top Right)
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '<span class="material-icons-round">delete</span>';
            delBtn.className = 'delete-btn';
            delBtn.style.position = 'absolute';
            delBtn.style.top = '1rem';
            delBtn.style.right = '1rem';
            delBtn.onclick = (e) => { e.stopPropagation(); deleteSubject(subject.id); };

            card.appendChild(delBtn);

            card.addEventListener('click', () => openSubject(subject.id));
            els.subjectsGrid.appendChild(card);
        });
    }

    function renderFilesList() {
        const subject = state.data.subjects.find(s => s.id === state.currentSubjectId);
        if (!subject) return;

        els.filesList.innerHTML = '';
        state.selectedFiles = []; // Reset logic
        updateStartButton();

        if (subject.files.length === 0) {
            els.filesList.innerHTML = `<p style="text-align:center; color:var(--text-secondary); padding:2rem;">No hay archivos. ¡Sube uno!</p>`;
            return;
        }

        subject.files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = file.id;
            checkbox.addEventListener('change', () => toggleFileSelection(file.id));

            const label = document.createElement('span');
            label.textContent = `${file.name} (${file.data.length} pgs)`;
            label.style.flex = 1;

            const trash = document.createElement('button');
            trash.className = 'delete-btn';
            trash.innerHTML = '<span class="material-icons-round">delete</span>';
            trash.onclick = (e) => { e.stopPropagation(); deleteFile(file.id); };

            item.appendChild(checkbox);
            item.appendChild(label);
            item.appendChild(trash);

            // Click row to toggle
            item.addEventListener('click', (e) => {
                if (e.target !== checkbox && e.target !== trash && !trash.contains(e.target)) {
                    checkbox.checked = !checkbox.checked;
                    toggleFileSelection(file.id);
                }
            });

            els.filesList.appendChild(item);
        });
    }

    function toggleFileSelection(fileId) {
        if (state.selectedFiles.includes(fileId)) {
            state.selectedFiles = state.selectedFiles.filter(id => id !== fileId);
        } else {
            state.selectedFiles.push(fileId);
        }
        updateStartButton();
    }

    function updateStartButton() {
        const count = state.selectedFiles.length;
        if (count > 0) {
            els.startSessionBtn.disabled = false;
            els.startSessionBtn.textContent = `Comenzar con ${count} archivos`;
        } else {
            els.startSessionBtn.disabled = true;
            els.startSessionBtn.textContent = 'Selecciona archivos';
        }
    }

    // === SESSION LOGIC ===

    function startSession() {
        const subject = state.data.subjects.find(s => s.id === state.currentSubjectId);
        if (!subject) return;

        // Gather questions
        let pool = [];
        subject.files.forEach(f => {
            if (state.selectedFiles.includes(f.id)) {
                pool = pool.concat(f.data);
            }
        });

        // Shuffle
        pool = shuffleArray(pool);

        // Limit
        if (state.sessionCount !== 'all') {
            const limit = parseInt(state.sessionCount);
            if (limit < pool.length) {
                pool = pool.slice(0, limit);
            }
        }

        // Shuffle Options
        pool.forEach(q => {
            if (q.options) q.options = shuffleArray(q.options);
        });

        state.sessionQuestions = pool;
        state.currentQuestionIndex = 0;
        state.score = 0;
        state.userAnswers = [];

        switchView('quiz');

        if (state.sessionMode === 'test') {
            renderQuestion();
        } else {
            renderStudyMode();
        }
    }

    function renderQuestion() {
        const q = state.sessionQuestions[state.currentQuestionIndex];
        state.userAnswers = [];

        const progress = ((state.currentQuestionIndex) / state.sessionQuestions.length) * 100;
        els.progressBar.style.width = `${progress}%`;
        els.progressText.textContent = `${state.currentQuestionIndex + 1}/${state.sessionQuestions.length}`;

        els.submitBtn.classList.remove('hidden');
        els.nextBtn.classList.add('hidden');
        els.questionContainer.classList.remove('study-mode');

        const typeLabels = { 'single': 'Opción Única', 'multiple': 'Opción Múltiple', 'boolean': 'V/F' };

        els.questionContainer.innerHTML = `
            <div class="question-header">
                <span class="question-type-badge">${typeLabels[q.type] || 'Pregunta'}</span>
            </div>
            <h2 class="question-text">${q.text}</h2>
            <div class="options-grid">
                ${q.options.map(opt => `
                    <div class="option-item" data-id="${opt.id}">
                        ${opt.text}
                    </div>
                `).join('')}
            </div>
            <div id="feedback-area"></div>
        `;

        els.questionContainer.querySelectorAll('.option-item').forEach(item => {
            item.addEventListener('click', () => handleOptionClick(item, q.type));
        });
    }

    function handleOptionClick(item, type) {
        if (els.submitBtn.classList.contains('hidden')) return;

        const id = item.dataset.id;
        if (type === 'single' || type === 'boolean') {
            els.questionContainer.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
            state.userAnswers = [id];
            item.classList.add('selected');
        } else if (type === 'multiple') {
            if (state.userAnswers.includes(id)) {
                state.userAnswers = state.userAnswers.filter(a => a !== id);
                item.classList.remove('selected');
            } else {
                state.userAnswers.push(id);
                item.classList.add('selected');
            }
        }
    }

    function checkAnswer() {
        const q = state.sessionQuestions[state.currentQuestionIndex];
        const correctIds = q.options.filter(o => o.isCorrect).map(o => o.id);

        let isCorrect = false;
        if (correctIds.length === 0) {
            isCorrect = state.userAnswers.length === 0;
        } else {
            if (state.userAnswers.length === correctIds.length) {
                isCorrect = state.userAnswers.every(ans => correctIds.includes(ans));
            }
        }

        if (isCorrect) state.score++;

        els.questionContainer.querySelectorAll('.option-item').forEach(item => {
            const id = item.dataset.id;
            const isSelected = state.userAnswers.includes(id);
            const isReal = correctIds.includes(id);

            if (isReal) item.classList.add('correct');
            else if (isSelected) item.classList.add('incorrect');
            item.style.cursor = 'default';
        });

        const fbArea = document.getElementById('feedback-area');
        fbArea.innerHTML = `
            <div class="feedback-text ${isCorrect ? 'correct-msg' : 'incorrect-msg'}">
                <strong>${isCorrect ? '¡Correcto!' : 'Incorrecto'}</strong>
                <p>${q.feedback || ''}</p>
            </div>
        `;

        els.submitBtn.classList.add('hidden');
        els.nextBtn.classList.remove('hidden');
    }

    function nextQuestion() {
        state.currentQuestionIndex++;
        if (state.currentQuestionIndex < state.sessionQuestions.length) {
            renderQuestion();
        } else {
            showResults();
        }
    }

    function renderStudyMode() {
        els.progressBar.style.width = '100%';
        els.progressText.textContent = 'Modo Estudio';
        els.submitBtn.classList.add('hidden');
        els.nextBtn.classList.add('hidden');

        let html = '<div class="study-list">';
        state.sessionQuestions.forEach((q, i) => {
            const correctText = q.options.filter(o => o.isCorrect).map(o => o.text).join(', ') || "Ninguna";
            html += `
                <div class="study-item card" style="margin-bottom:1rem; border:1px solid var(--surface-border)">
                    <h3>${i + 1}. ${q.text}</h3>
                    <ul style="padding-left:1.5rem; margin-bottom:0.5rem">
                        ${q.options.map(o => `<li style="${o.isCorrect ? 'color:var(--success);font-weight:700' : ''}">${o.text}</li>`).join('')}
                    </ul>
                    <div style="font-size:0.9rem; color:var(--text-secondary)">Respuesta: ${correctText}</div>
                    <p style="background:#f1f5f9; padding:0.5rem; margin-top:0.5rem; border-radius:4px">${q.feedback || ''}</p>
                </div>`;
        });
        html += '</div>';

        // Add giant finish button
        html += `<div style="text-align:center; padding:2rem"><button class="btn primary" onclick="document.getElementById('btn-exit-quiz').click()">Terminar Repaso</button></div>`;

        els.questionContainer.innerHTML = html;
        els.questionContainer.style.background = 'transparent';
        els.questionContainer.style.boxShadow = 'none';
        els.questionContainer.style.border = 'none';
    }

    function showResults() {
        switchView('results');
        const pct = Math.round((state.score / state.sessionQuestions.length) * 100) || 0;
        const offset = 100 - (pct);
        els.scoreCircle.style.strokeDashoffset = offset;
        els.resultPercentage.textContent = `${pct}%`;
        els.resultDetails.textContent = `Acertaste ${state.score} de ${state.sessionQuestions.length}`;
    }

    // === UTILS ===
    function showToast(msg, type = 'info') {
        els.toast.textContent = msg;
        els.toast.classList.add('visible');
        setTimeout(() => els.toast.classList.remove('visible'), 3000);
    }

    function switchView(name) {
        Object.values(views).forEach(el => el.classList.remove('active'));
        views[name].classList.add('active');
    }

    function shuffleArray(arr) {
        return [...arr].sort(() => Math.random() - 0.5);
    }
});
