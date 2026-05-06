// API URL
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000/api' : '/api';

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

    // === API / DATA LOGIC ===
    
    async function loadData() {
        try {
            const res = await fetch(`${API_URL}/subjects`);
            if (!res.ok) throw new Error('Error de red');
            const subjects = await res.json();
            state.data.subjects = subjects;
            renderDashboard();
        } catch (err) {
            console.error("No se pudo cargar la info de la BD:", err);
            showToast("Error de conexión con el servidor", "error");
        }
    }

    async function createSubject(name) {
        const id = crypto.randomUUID();
        try {
            await fetch(`${API_URL}/subjects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name })
            });
            await loadData();
            showToast(`Materia "${name}" creada`);
        } catch (err) {
            console.error(err);
            showToast("Error al crear materia", "error");
        }
    }

    async function deleteSubject(id) {
        if (confirm("¿Eliminar materia y todos sus archivos de forma permanente?")) {
            try {
                await fetch(`${API_URL}/subjects/${id}`, { method: 'DELETE' });
                if (state.currentSubjectId === id) switchView('dashboard');
                await loadData();
                showToast("Materia eliminada");
            } catch (err) {
                console.error(err);
                showToast("Error al eliminar", "error");
            }
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
        showToast("Subiendo archivos...");
        
        for (const file of files) {
            try {
                const text = await file.text();
                const json = JSON.parse(text);

                if (!json.questions || !Array.isArray(json.questions)) {
                    throw new Error("Formato inválido. Debe tener un arreglo 'questions'.");
                }

                const fileId = crypto.randomUUID();
                const payload = {
                    id: fileId,
                    name: file.name.replace('.json', ''),
                    data: json.questions
                };

                await fetch(`${API_URL}/subjects/${state.currentSubjectId}/files`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                addedCount++;
            } catch (err) {
                console.error(err);
                showToast(`Error en ${file.name}: ${err.message}`, 'error');
            }
        }

        if (addedCount > 0) {
            await loadData();
            // Refrescar vista
            renderFilesList();
            showToast(`${addedCount} archivos subidos correctamente`);
        }
        els.importInput.value = '';
    }

    async function deleteFile(fileId) {
        if (confirm("¿Eliminar archivo permanentemente?")) {
            try {
                await fetch(`${API_URL}/files/${fileId}`, { method: 'DELETE' });
                await loadData();
                renderFilesList();
                showToast("Archivo eliminado");
            } catch (err) {
                console.error(err);
                showToast("Error al eliminar", "error");
            }
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
                <div class="card-icon"><span class="material-icons-round">auto_stories</span></div>
                <h3>${subject.name}</h3>
                <div class="card-meta">${subject.files.length} cuestionario${subject.files.length !== 1 ? 's' : ''}</div>
            `;

            // Delete Subject Button
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '<span class="material-icons-round">delete_outline</span>';
            delBtn.className = 'delete-btn';
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
        
        // Remove deleted files from selection
        state.selectedFiles = state.selectedFiles.filter(id => subject.files.some(f => f.id === id));
        updateStartButton();

        if (subject.files.length === 0) {
            els.filesList.innerHTML = `<p style="text-align:center; color:var(--text-secondary); padding:2rem;">No hay cuestionarios. ¡Sube un JSON estructurado!</p>`;
            return;
        }

        subject.files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item';
            
            if (state.selectedFiles.includes(file.id)) {
                item.classList.add('selected');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = file.id;
            checkbox.checked = state.selectedFiles.includes(file.id);
            checkbox.addEventListener('change', () => toggleFileSelection(file.id, item));

            const labelInfo = document.createElement('div');
            labelInfo.className = 'file-info';
            labelInfo.innerHTML = `<strong>${file.name}</strong><span>${file.data.length} preguntas</span>`;

            const trash = document.createElement('button');
            trash.className = 'delete-btn small';
            trash.innerHTML = '<span class="material-icons-round">delete</span>';
            trash.onclick = (e) => { e.stopPropagation(); deleteFile(file.id); };

            item.appendChild(checkbox);
            item.appendChild(labelInfo);
            item.appendChild(trash);

            // Click row to toggle
            item.addEventListener('click', (e) => {
                if (e.target !== checkbox && e.target !== trash && !trash.contains(e.target)) {
                    checkbox.checked = !checkbox.checked;
                    toggleFileSelection(file.id, item);
                }
            });

            els.filesList.appendChild(item);
        });
    }

    function toggleFileSelection(fileId, itemEl) {
        if (state.selectedFiles.includes(fileId)) {
            state.selectedFiles = state.selectedFiles.filter(id => id !== fileId);
            if(itemEl) itemEl.classList.remove('selected');
        } else {
            state.selectedFiles.push(fileId);
            if(itemEl) itemEl.classList.add('selected');
        }
        updateStartButton();
    }

    function updateStartButton() {
        const count = state.selectedFiles.length;
        if (count > 0) {
            els.startSessionBtn.disabled = false;
            els.startSessionBtn.textContent = `Comenzar con ${count} cuestionarios`;
            els.startSessionBtn.classList.add('pulse');
        } else {
            els.startSessionBtn.disabled = true;
            els.startSessionBtn.textContent = 'Selecciona cuestionarios';
            els.startSessionBtn.classList.remove('pulse');
        }
    }

    // === SESSION LOGIC ===

    function startSession() {
        const subject = state.data.subjects.find(s => s.id === state.currentSubjectId);
        if (!subject) return;

        let pool = [];
        subject.files.forEach(f => {
            if (state.selectedFiles.includes(f.id)) {
                pool = pool.concat(f.data);
            }
        });

        if (pool.length === 0) return;

        pool = shuffleArray(pool);

        if (state.sessionCount !== 'all') {
            const limit = parseInt(state.sessionCount);
            if (limit < pool.length) pool = pool.slice(0, limit);
        }

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
        els.questionContainer.classList.add('fade-in');

        // Reiniciar animacion fade
        els.questionContainer.style.animation = 'none';
        els.questionContainer.offsetHeight; // trigger reflow
        els.questionContainer.style.animation = null; 

        const typeLabels = { 'single': 'Respuesta Única', 'multiple': 'Selección Múltiple', 'boolean': 'Verdadero o Falso' };

        els.questionContainer.innerHTML = `
            <div class="question-header">
                <span class="question-type-badge ${q.type}">${typeLabels[q.type] || 'Pregunta'}</span>
            </div>
            <h2 class="question-text">${q.text}</h2>
            <div class="options-grid ${q.options.length <= 2 ? 'two-cols' : ''}">
                ${q.options.map((opt, i) => `
                    <div class="option-item" data-id="${opt.id}">
                        <div class="option-letter">${String.fromCharCode(65 + i)}</div>
                        <div class="option-content">${opt.text}</div>
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
        if (els.submitBtn.classList.contains('hidden')) return; // Ya se respondió

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
        
        // Si no hay respuesta del usuario, no hacer nada (opcional: forzar a que elija)
        if (state.userAnswers.length === 0) {
            showToast('Selecciona al menos una respuesta', 'error');
            return;
        }

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
            
            // Disable clicks
            item.style.pointerEvents = 'none';
        });

        const fbArea = document.getElementById('feedback-area');
        fbArea.innerHTML = `
            <div class="feedback-text ${isCorrect ? 'correct-msg' : 'incorrect-msg'} fade-in">
                <div class="feedback-icon">
                    <span class="material-icons-round">${isCorrect ? 'check_circle' : 'cancel'}</span>
                </div>
                <div class="feedback-content">
                    <strong>${isCorrect ? '¡Excelente!' : 'Respuesta Incorrecta'}</strong>
                    ${q.feedback ? `<p>${q.feedback}</p>` : ''}
                </div>
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
        els.progressText.textContent = 'Modo Estudio Activo';
        els.submitBtn.classList.add('hidden');
        els.nextBtn.classList.add('hidden');

        let html = '<div class="study-list fade-in">';
        state.sessionQuestions.forEach((q, i) => {
            const correctOpts = q.options.filter(o => o.isCorrect);
            const correctText = correctOpts.length > 0 
                ? correctOpts.map(o => `• ${o.text}`).join('<br>') 
                : "Ninguna";

            html += `
                <div class="study-item card">
                    <div class="study-badge ${q.type}">${q.type === 'single' ? 'Respuesta Única' : 'Múltiple'}</div>
                    <h3>${i + 1}. ${q.text}</h3>
                    <div class="study-answer">
                        <strong>Respuesta correcta:</strong><br>
                        ${correctText}
                    </div>
                    ${q.feedback ? `
                    <div class="study-feedback">
                        <strong>Explicación:</strong>
                        <p>${q.feedback}</p>
                    </div>` : ''}
                </div>`;
        });
        html += '</div>';

        html += `<div style="text-align:center; padding:2rem"><button class="btn primary large pulse" onclick="document.getElementById('btn-exit-quiz').click()">Terminar Repaso</button></div>`;

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
        els.resultDetails.innerHTML = `Has acertado <strong>${state.score}</strong> de <strong>${state.sessionQuestions.length}</strong> preguntas.`;
    }

    // === UTILS ===
    function showToast(msg, type = 'info') {
        els.toast.textContent = msg;
        els.toast.className = `toast visible ${type}`;
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
