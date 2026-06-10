// API URL
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000/api' : '/api';

document.addEventListener('DOMContentLoaded', () => {
    // Configurar marked para que los saltos de línea simples se conviertan en <br>
    marked.use({
        breaks: true,
        gfm: true
    });

    // Helper para procesar el texto y arreglar los \n literales
    function parseMd(text) {
        if (!text) return '';
        // Si el JSON trae "\\n" literal (2 caracteres), lo convertimos a un salto real
        const processed = text.replace(/\\n/g, '\n');
        return marked.parse(processed);
    }
    
    function parseMdInline(text) {
        if (!text) return '';
        const processed = text.replace(/\\n/g, '\n');
        return marked.parseInline(processed);
    }

    // === STATE ===
    const state = {
        data: { subjects: [] }, 
        currentSubjectId: null,
        selectedFiles: [],
        sessionQuestions: [],
        currentQuestionIndex: 0,
        score: 0,
        maxScore: 0, // Nuevo: calculamos puntos totales
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
    els.createSubjectBtn.addEventListener('click', () => {
        const name = prompt("INGRESAR_IDENTIFICADOR_NUEVA_MATERIA:");
        if (name && name.trim()) {
            createSubject(name.trim());
        }
    });

    els.backDashboardBtn.addEventListener('click', () => switchView('dashboard'));
    els.importInput.addEventListener('change', handleImport);

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
    els.submitBtn.addEventListener('click', checkAnswer);
    els.nextBtn.addEventListener('click', nextQuestion);
    
    els.exitQuizBtn.addEventListener('click', () => {
        if (confirm("¿CONFIRMAR ABORTO DE SESIÓN? LOS DATOS SERÁN PURGADOS.")) {
            switchView('subject');
        }
    });

    els.returnSubjectBtn.addEventListener('click', () => switchView('subject'));
    els.retryBtn.addEventListener('click', startSession);

    // === API LOGIC ===
    
    async function loadData() {
        try {
            const res = await fetch(`${API_URL}/subjects`);
            if (!res.ok) throw new Error('Network err');
            const subjects = await res.json();
            state.data.subjects = subjects;
            renderDashboard();
        } catch (err) {
            console.error("Error BD:", err);
            showToast("FALLO_DE_CONEXIÓN", "error");
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
            showToast(`NODO [${name}] INICIALIZADO`);
        } catch (err) {
            console.error(err);
            showToast("ERROR_DE_CREACIÓN", "error");
        }
    }

    async function deleteSubject(id) {
        if (confirm("¿PURGAR NODO PERMANENTEMENTE?")) {
            try {
                await fetch(`${API_URL}/subjects/${id}`, { method: 'DELETE' });
                if (state.currentSubjectId === id) switchView('dashboard');
                await loadData();
                showToast("NODO PURGADO");
            } catch (err) {
                console.error(err);
                showToast("ERROR_PURGA", "error");
            }
        }
    }

    function openSubject(id) {
        state.currentSubjectId = id;
        const subject = state.data.subjects.find(s => s.id === id);
        if (!subject) return;

        els.subjectTitle.textContent = subject.name;
        els.subjectTitle.setAttribute('data-text', subject.name);
        state.selectedFiles = [];
        renderFilesList();
        switchView('subject');
    }

    async function handleImport(e) {
        const files = e.target.files;
        if (!files.length) return;

        const subjectIndex = state.data.subjects.findIndex(s => s.id === state.currentSubjectId);
        if (subjectIndex === -1) return;

        let addedCount = 0;
        showToast("INYECCIÓN_EN_PROGRESO...");
        
        for (const file of files) {
            try {
                const text = await file.text();
                let questions = [];
                let title = file.name.replace(/\.(json|xml)$/i, '');

                if (file.name.toLowerCase().endsWith('.xml')) {
                    const parsedXml = parseXMLQuiz(text);
                    questions = parsedXml.questions;
                    if (parsedXml.title) title = parsedXml.title;
                } else {
                    let json = JSON.parse(text);
                    if (Array.isArray(json)) {
                        questions = json;
                    } else if (json.questions && Array.isArray(json.questions)) {
                        questions = json.questions;
                        if (json.title) title = json.title;
                    } else {
                        throw new Error("FORMATO_CORRUPTO: Se requiere un array de preguntas.");
                    }
                }

                const fileId = crypto.randomUUID();
                const payload = {
                    id: fileId,
                    name: title,
                    data: questions
                };

                await fetch(`${API_URL}/subjects/${state.currentSubjectId}/files`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                addedCount++;
            } catch (err) {
                console.error(err);
                showToast(`ERROR_INYECCIÓN [${file.name}]: ${err.message}`, 'error');
            }
        }

        if (addedCount > 0) {
            await loadData();
            renderFilesList();
            showToast(`${addedCount} SETS INYECTADOS`);
        }
        els.importInput.value = '';
    }

    async function deleteFile(fileId) {
        if (confirm("¿PURGAR ARCHIVO PERMANENTEMENTE?")) {
            try {
                await fetch(`${API_URL}/files/${fileId}`, { method: 'DELETE' });
                await loadData();
                renderFilesList();
                showToast("ARCHIVO PURGADO");
            } catch (err) {
                console.error(err);
                showToast("ERROR_PURGA", "error");
            }
        }
    }

    // === RENDERERS ===

    function renderDashboard() {
        els.subjectsGrid.innerHTML = '';

        if (state.data.subjects.length === 0) {
            els.subjectsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-folder-dashed"></i>
                    <h3>SISTEMA_VACÍO</h3>
                    <p class="sys-text">Agrega una materia para inicializar.</p>
                </div>`;
            return;
        }

        state.data.subjects.forEach(subject => {
            const card = document.createElement('div');
            card.className = 'sys-card fade-in';
            card.innerHTML = `
                <i class="ph ph-book-open-text card-icon"></i>
                <h3>${subject.name}</h3>
                <div class="card-meta"><i class="ph ph-files"></i> ${subject.files.length} SETS</div>
            `;

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '<i class="ph ph-trash"></i>';
            delBtn.className = 'btn-icon-danger';
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
        state.selectedFiles = state.selectedFiles.filter(id => subject.files.some(f => f.id === id));
        updateStartButton();

        if (subject.files.length === 0) {
            els.filesList.innerHTML = `<p class="sys-text" style="padding:1rem; text-align:center;">SIN DATOS. REQUIERE INYECCIÓN JSON.</p>`;
            return;
        }

        subject.files.forEach(file => {
            const row = document.createElement('div');
            row.className = 'file-row';
            if (state.selectedFiles.includes(file.id)) row.classList.add('selected');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'sys-checkbox';
            checkbox.value = file.id;
            checkbox.checked = state.selectedFiles.includes(file.id);
            checkbox.addEventListener('change', () => toggleFileSelection(file.id, row));

            const info = document.createElement('div');
            info.className = 'file-info';
            info.innerHTML = `<strong>${file.name}</strong><span>${file.data.length} NODOS</span>`;

            const trash = document.createElement('button');
            trash.className = 'btn text-only alert small';
            trash.innerHTML = '<i class="ph ph-trash"></i>';
            trash.onclick = (e) => { e.stopPropagation(); deleteFile(file.id); };

            row.appendChild(checkbox);
            row.appendChild(info);
            row.appendChild(trash);

            row.addEventListener('click', (e) => {
                if (e.target !== checkbox && e.target !== trash && !trash.contains(e.target)) {
                    checkbox.checked = !checkbox.checked;
                    toggleFileSelection(file.id, row);
                }
            });

            els.filesList.appendChild(row);
        });
    }

    function toggleFileSelection(fileId, rowEl) {
        if (state.selectedFiles.includes(fileId)) {
            state.selectedFiles = state.selectedFiles.filter(id => id !== fileId);
            if(rowEl) rowEl.classList.remove('selected');
        } else {
            state.selectedFiles.push(fileId);
            if(rowEl) rowEl.classList.add('selected');
        }
        updateStartButton();
    }

    function updateStartButton() {
        const count = state.selectedFiles.length;
        if (count > 0) {
            els.startSessionBtn.disabled = false;
            els.startSessionBtn.innerHTML = `<i class="ph ph-power"></i> INICIALIZAR [${count}]`;
        } else {
            els.startSessionBtn.disabled = true;
            els.startSessionBtn.textContent = 'SELECCIONA NODOS';
        }
    }

    // === SESSION LOGIC ===

    function startSession() {
        const subject = state.data.subjects.find(s => s.id === state.currentSubjectId);
        if (!subject) return;

        let pool = [];
        subject.files.forEach(f => {
            if (state.selectedFiles.includes(f.id)) pool = pool.concat(f.data);
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
        state.maxScore = pool.reduce((acc, q) => acc + (q.points || 1), 0);
        state.userAnswers = [];

        switchView('quiz');

        if (state.sessionMode === 'test') renderQuestion();
        else renderStudyMode();
    }

    function renderQuestion() {
        const q = state.sessionQuestions[state.currentQuestionIndex];
        state.userAnswers = [];

        const progress = ((state.currentQuestionIndex) / state.sessionQuestions.length) * 100;
        els.progressBar.style.width = `${progress}%`;
        els.progressText.textContent = `${state.currentQuestionIndex + 1} / ${state.sessionQuestions.length}`;

        els.submitBtn.classList.remove('hidden');
        els.nextBtn.classList.add('hidden');
        els.questionContainer.classList.remove('study-mode');
        
        // Re-trigger animation
        els.questionContainer.style.animation = 'none';
        els.questionContainer.offsetHeight; 
        els.questionContainer.style.animation = null; 

        const typeLabels = { 'single': 'ÚNICA', 'multiple': 'MÚLTIPLE', 'boolean': 'BINARIO' };
        const pts = q.points || 1;

        els.questionContainer.innerHTML = `
            <div class="q-badge">${typeLabels[q.type] || 'NODO'} // ${pts} PTS</div>
            <div class="q-text">${parseMd(q.text)}</div>
            <div class="opts-grid ${q.options.length <= 2 ? 'cols-2' : ''}">
                ${q.options.map((opt, i) => `
                    <div class="opt-box" data-id="${opt.id}">
                        <div class="opt-idx">[${String.fromCharCode(65 + i)}]</div>
                        <div class="opt-txt">${parseMdInline(opt.text)}</div>
                    </div>
                `).join('')}
            </div>
            <div id="feedback-area"></div>
        `;

        // Highlight code blocks
        els.questionContainer.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

        els.questionContainer.querySelectorAll('.opt-box').forEach(item => {
            item.addEventListener('click', () => handleOptionClick(item, q.type));
        });
    }

    function handleOptionClick(item, type) {
        if (els.submitBtn.classList.contains('hidden')) return; 

        const id = item.dataset.id;
        if (type === 'single' || type === 'boolean') {
            els.questionContainer.querySelectorAll('.opt-box').forEach(el => el.classList.remove('selected'));
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
        
        if (state.userAnswers.length === 0) {
            showToast('DEBES SELECCIONAR UN NODO', 'error');
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

        const pts = q.points || 1;
        if (isCorrect) state.score += pts;

        els.questionContainer.querySelectorAll('.opt-box').forEach(item => {
            const id = item.dataset.id;
            const isSelected = state.userAnswers.includes(id);
            const isReal = correctIds.includes(id);

            if (isReal) item.classList.add('correct');
            else if (isSelected) item.classList.add('incorrect');
            
            item.style.pointerEvents = 'none';
        });

        const fbArea = document.getElementById('feedback-area');
        fbArea.innerHTML = `
            <div class="feedback-alert ${isCorrect ? 'correct' : 'incorrect'} fade-in">
                <i class="ph ${isCorrect ? 'ph-check-circle' : 'ph-x-circle'}"></i>
                <div class="feedback-content">
                    <strong>${isCorrect ? 'RESULTADO_POSITIVO' : 'RESULTADO_NEGATIVO'}</strong>
                    ${q.feedback ? `<div class="feedback-body sys-text">${parseMd(q.feedback)}</div>` : ''}
                </div>
            </div>
        `;
        
        // Highlight code blocks in feedback
        fbArea.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

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
        els.progressText.textContent = 'MODO_INSPECCIÓN';
        els.submitBtn.classList.add('hidden');
        els.nextBtn.classList.add('hidden');

        let html = '<div class="study-list fade-in">';
        state.sessionQuestions.forEach((q, i) => {
            const correctOpts = q.options.filter(o => o.isCorrect);
            const correctText = correctOpts.length > 0 
                ? correctOpts.map(o => `> ${parseMdInline(o.text)}`).join('<br>') 
                : "NULL";

            html += `
                <div class="study-item">
                    <div class="study-badge">[${q.type}] // ${q.points || 1} PTS</div>
                    <div class="study-q">${i + 1}. ${parseMd(q.text)}</div>
                    <div class="study-ans">
                        <span class="study-ans-lbl">DATO_CORRECTO:</span>
                        ${correctText}
                    </div>
                    ${q.feedback ? `<div class="study-expl sys-text">${parseMd(q.feedback)}</div>` : ''}
                </div>`;
        });
        html += '</div>';

        html += `<div style="margin-top: 3rem; text-align:center;"><button class="btn primary huge" onclick="document.getElementById('btn-exit-quiz').click()">FINALIZAR_INSPECCIÓN</button></div>`;

        els.questionContainer.innerHTML = html;
        
        // Highlight code blocks in study mode
        els.questionContainer.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

        els.questionContainer.style.background = 'transparent';
        els.questionContainer.style.border = 'none';
        els.questionContainer.style.padding = '0';
    }

    function showResults() {
        switchView('results');
        const max = state.maxScore > 0 ? state.maxScore : 1;
        const pct = Math.round((state.score / max) * 100);
        
        // 2 * PI * r (r=45) = ~283
        const circumference = 283;
        const offset = circumference - (pct / 100) * circumference;
        
        setTimeout(() => {
            els.scoreCircle.style.strokeDashoffset = offset;
        }, 100);
        
        els.resultPercentage.textContent = `${pct}%`;
        els.resultDetails.innerHTML = `SCORE OBTENIDO: <strong style="color:var(--fg-primary)">${state.score} / ${state.maxScore}</strong> PTS.`;
    }

    // === UTILS ===
    function showToast(msg, type = 'info') {
        const span = els.toast.querySelector('.toast-msg');
        const icon = els.toast.querySelector('i');
        span.textContent = msg;
        icon.className = type === 'error' ? 'ph ph-warning-circle' : 'ph ph-info';
        
        els.toast.className = `sys-toast visible ${type}`;
        setTimeout(() => els.toast.classList.remove('visible'), 3000);
    }

    function switchView(name) {
        Object.values(views).forEach(el => el.classList.remove('active'));
        views[name].classList.add('active');
        
        // Reset canvas styles if leaving quiz
        if (name !== 'quiz') {
            els.questionContainer.style = '';
        }
    }

    function shuffleArray(arr) {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    function parseXMLQuiz(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
            throw new Error("FORMATO XML INVÁLIDO");
        }

        const titleNode = xmlDoc.querySelector("title");
        const title = titleNode ? titleNode.textContent : "";
        
        const questions = [];
        const qNodes = xmlDoc.querySelectorAll("question");
        
        if (qNodes.length === 0) {
            throw new Error("No se encontraron nodos <question> en el XML");
        }

        qNodes.forEach((qNode, i) => {
            const id = qNode.getAttribute("id") || `q_${i}`;
            const type = qNode.getAttribute("type") || "single";
            const points = parseInt(qNode.getAttribute("points") || "1");
            const textNode = qNode.querySelector("text");
            const text = textNode ? textNode.textContent : "";
            const feedbackNode = qNode.querySelector("feedback");
            const feedback = feedbackNode ? feedbackNode.textContent : "";
            
            const options = [];
            const optNodes = qNode.querySelectorAll("option");
            optNodes.forEach((oNode, j) => {
                const optId = oNode.getAttribute("id") || `o_${i}_${j}`;
                const isCorrect = oNode.getAttribute("isCorrect") === "true";
                options.push({
                    id: optId,
                    text: oNode.textContent,
                    isCorrect: isCorrect
                });
            });

            questions.push({ id, type, points, text, feedback, options });
        });

        return { title, questions };
    }
});
