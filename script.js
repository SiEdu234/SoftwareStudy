// API URL
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : '/api';

document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page || 'dashboard';

    // Configurar marked únicamente si está cargado en esta página (quiz / resultados)
    if (typeof marked !== 'undefined') {
        marked.use({
            breaks: true,
            gfm: true
        });
    }

    // === SHARED UTILITIES ===
    function parseMd(text) {
        if (!text) return '';
        const processed = String(text).replace(/\\n/g, '\n');
        if (typeof marked !== 'undefined') {
            return marked.parse(processed);
        }
        return escapeHtml(processed).replace(/\n/g, '<br>');
    }

    function parseMdInline(text) {
        if (!text) return '';
        const processed = String(text).replace(/\\n/g, '\n');
        if (typeof marked !== 'undefined') {
            return marked.parseInline(processed);
        }
        return escapeHtml(processed);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function highlightCodeIn(container) {
        if (!container || typeof hljs === 'undefined') return;
        container.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }

    let toastTimeout = null;
    function showToast(msg, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        const span = toast.querySelector('.toast-msg');
        const icon = toast.querySelector('i');
        if (span) span.textContent = msg;
        if (icon) icon.className = type === 'error' ? 'ph ph-warning-circle' : 'ph ph-info';

        toast.className = `sys-toast visible ${type}`;
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3000);
    }

    function cloneQuestionForSession(question) {
        return {
            ...question,
            options: Array.isArray(question.options)
                ? question.options.map(option => ({ ...option }))
                : []
        };
    }

    function randomIndex(maxInclusive) {
        if (window.crypto?.getRandomValues) {
            const range = maxInclusive + 1;
            const max = 0xFFFFFFFF - (0xFFFFFFFF % range);
            const buffer = new Uint32Array(1);
            do {
                window.crypto.getRandomValues(buffer);
            } while (buffer[0] >= max);
            return buffer[0] % range;
        }
        return Math.floor(Math.random() * (maxInclusive + 1));
    }

    function shuffleArray(arr) {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = randomIndex(i);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    function parseXMLQuiz(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('FORMATO XML INVÁLIDO');
        }

        const titleNode = xmlDoc.querySelector('title');
        const title = titleNode ? titleNode.textContent : '';

        const questions = [];
        const qNodes = xmlDoc.querySelectorAll('question');

        if (qNodes.length === 0) {
            throw new Error('No se encontraron nodos <question> en el XML');
        }

        qNodes.forEach((qNode, i) => {
            const id = qNode.getAttribute('id') || `q_${i}`;
            const type = qNode.getAttribute('type') || 'single';
            const points = parseInt(qNode.getAttribute('points') || '1', 10);
            const isCode = qNode.getAttribute('isCode') === 'true';
            const textNode = qNode.querySelector('text');
            const text = textNode ? textNode.textContent : '';
            const feedbackNode = qNode.querySelector('feedback');
            const feedback = feedbackNode ? feedbackNode.textContent : '';

            const options = [];
            const optNodes = qNode.querySelectorAll('option');
            optNodes.forEach((oNode, j) => {
                const optId = oNode.getAttribute('id') || `o_${i}_${j}`;
                const isCorrect = oNode.getAttribute('isCorrect') === 'true';
                options.push({
                    id: optId,
                    text: oNode.textContent,
                    isCorrect
                });
            });

            questions.push({ id, type, points, text, feedback, options, isCode });
        });

        return { title, questions };
    }

    // Router multipágina: ejecuta únicamente la lógica de la página actual
    switch (page) {
        case 'dashboard':
            initDashboardPage();
            break;
        case 'subject':
            initSubjectPage();
            break;
        case 'quiz':
            initQuizPage();
            break;
        case 'results':
            initResultsPage();
            break;
        case 'prompts':
            initPromptsPage();
            break;
    }

    // =========================================================================
    // 1. PÁGINA: DASHBOARD (index.html)
    // =========================================================================
    function initDashboardPage() {
        const subjectsGrid = document.getElementById('subjects-grid');
        const statsEl = document.getElementById('dashboard-stats');
        const searchInput = document.getElementById('search-subjects');
        const toggleCreateBtn = document.getElementById('btn-toggle-create');
        const createForm = document.getElementById('create-subject-form');
        const newSubjectInput = document.getElementById('new-subject-name');
        const cancelSubjectBtn = document.getElementById('btn-cancel-subject');

        let subjects = [];

        function openCreateBar() {
            createForm.classList.remove('hidden');
            newSubjectInput.focus();
        }

        function closeCreateBar() {
            createForm.classList.add('hidden');
            newSubjectInput.value = '';
        }

        if (toggleCreateBtn) {
            toggleCreateBtn.addEventListener('click', () => {
                if (createForm.classList.contains('hidden')) {
                    openCreateBar();
                } else {
                    closeCreateBar();
                }
            });
        }

        if (cancelSubjectBtn) {
            cancelSubjectBtn.addEventListener('click', closeCreateBar);
        }

        if (createForm) {
            createForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = newSubjectInput.value.trim();
                if (!name) return;

                const submitBtn = document.getElementById('btn-submit-subject');
                if (submitBtn) submitBtn.disabled = true;

                try {
                    const id = crypto.randomUUID();
                    const res = await fetch(`${API_URL}/subjects`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, name })
                    });
                    if (!res.ok) throw new Error('Error creando materia');
                    closeCreateBar();
                    showToast(`Materia creada: ${name}`);
                    await loadSubjects();
                } catch (err) {
                    console.error(err);
                    showToast('No se pudo crear la materia', 'error');
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                renderSubjects(searchInput.value.trim().toLowerCase());
            });
        }

        async function loadSubjects() {
            try {
                const res = await fetch(`${API_URL}/subjects`);
                if (!res.ok) throw new Error('Network error');
                subjects = await res.json();
                updateStats();
                renderSubjects(searchInput ? searchInput.value.trim().toLowerCase() : '');
            } catch (err) {
                console.error('Error cargando materias:', err);
                if (statsEl) statsEl.textContent = 'Sin conexión con el servidor';
                showToast('FALLO_DE_CONEXIÓN', 'error');
            }
        }

        function updateStats() {
            if (!statsEl) return;
            const totalSubjects = subjects.length;
            const totalFiles = subjects.reduce((acc, s) => acc + (s.fileCount ?? (s.files ? s.files.length : 0)), 0);
            const totalQuestions = subjects.reduce((acc, s) => acc + (s.questionCount ?? 0), 0);
            statsEl.textContent = `${totalSubjects} materia(s) · ${totalFiles} archivo(s) · ${totalQuestions} pregunta(s)`;
        }

        function renderSubjects(query = '') {
            if (!subjectsGrid) return;
            subjectsGrid.innerHTML = '';

            const filtered = query
                ? subjects.filter(s => s.name.toLowerCase().includes(query))
                : subjects;

            if (subjects.length === 0) {
                subjectsGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="ph ph-folder-dashed"></i>
                        <h3>Sin materias todavía</h3>
                        <p class="sys-text">Crea tu primera materia con el botón "Nueva materia" para subir cuestionarios.</p>
                    </div>`;
                return;
            }

            if (filtered.length === 0) {
                subjectsGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="ph ph-magnifying-glass"></i>
                        <h3>Sin coincidencias</h3>
                        <p class="sys-text">No se encontraron materias para "${escapeHtml(query)}".</p>
                    </div>`;
                return;
            }

            filtered.forEach(subject => {
                const fileCount = subject.fileCount ?? (subject.files ? subject.files.length : 0);
                const questionCount = subject.questionCount ?? 0;

                const card = document.createElement('a');
                card.href = `materia.html?id=${encodeURIComponent(subject.id)}`;
                card.className = 'sys-card fade-in';
                card.innerHTML = `
                    <i class="ph ph-book-open-text card-icon"></i>
                    <h3>${escapeHtml(subject.name)}</h3>
                    <div class="card-meta">
                        <span><i class="ph ph-files"></i> ${fileCount} archivo(s)</span>
                        <span><i class="ph ph-list-numbers"></i> ${questionCount} preg.</span>
                    </div>
                `;

                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'btn-icon-danger';
                delBtn.title = 'Eliminar materia';
                delBtn.innerHTML = '<i class="ph ph-trash"></i>';
                delBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm(`¿Eliminar la materia "${subject.name}" y todos sus archivos permanentemente?`)) {
                        try {
                            await fetch(`${API_URL}/subjects/${encodeURIComponent(subject.id)}`, { method: 'DELETE' });
                            showToast('Materia eliminada');
                            await loadSubjects();
                        } catch (err) {
                            console.error(err);
                            showToast('No se pudo eliminar', 'error');
                        }
                    }
                });

                card.appendChild(delBtn);
                subjectsGrid.appendChild(card);
            });
        }

        loadSubjects();
    }

    // =========================================================================
    // 2. PÁGINA: MATERIA (materia.html?id=<subjectId>)
    // =========================================================================
    function initSubjectPage() {
        const params = new URLSearchParams(window.location.search);
        const subjectId = params.get('id');

        if (!subjectId) {
            window.location.replace('index.html');
            return;
        }

        const subjectTitle = document.getElementById('subject-title');
        const filesSummaryText = document.getElementById('files-summary-text');
        const filesList = document.getElementById('files-list');
        const importInput = document.getElementById('import-file');
        const dropZone = document.getElementById('drop-zone');
        const selectAllBtn = document.getElementById('btn-select-all');
        const deleteSubjectBtn = document.getElementById('btn-delete-subject');
        const startSessionBtn = document.getElementById('btn-start-session');
        const selectedFilesCountEl = document.getElementById('selected-files-count');
        const selectedQuestionsCountEl = document.getElementById('selected-questions-count');
        const linkPromptsHeader = document.getElementById('link-prompts-header');
        const linkPromptsSubject = document.getElementById('link-prompts-subject');

        // Actualizar enlaces a Prompts para que puedan volver directo a esta materia
        const promptsHref = `prompts.html?subject=${encodeURIComponent(subjectId)}`;
        if (linkPromptsHeader) linkPromptsHeader.href = promptsHref;
        if (linkPromptsSubject) linkPromptsSubject.href = promptsHref;

        const prefsKey = `vagos_prefs_${subjectId}`;
        let subjectData = null;
        let selectedFiles = [];
        let sessionCount = 'all';
        let sessionMode = 'test';

        // Restaurar preferencias guardadas de esta materia
        try {
            const savedPrefs = JSON.parse(sessionStorage.getItem(prefsKey) || 'null');
            if (savedPrefs) {
                if (Array.isArray(savedPrefs.selectedFiles)) selectedFiles = savedPrefs.selectedFiles;
                if (savedPrefs.sessionCount) sessionCount = savedPrefs.sessionCount;
                if (savedPrefs.sessionMode) sessionMode = savedPrefs.sessionMode;
            }
        } catch (_) {}

        function savePrefs() {
            sessionStorage.setItem(prefsKey, JSON.stringify({
                selectedFiles,
                sessionCount,
                sessionMode
            }));
        }

        // Inicializar botones de configuración
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.count === sessionCount);
            btn.addEventListener('click', () => {
                document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                sessionCount = btn.dataset.count;
                savePrefs();
                updateSelectionSummary();
            });
        });

        document.querySelectorAll('.segment').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === sessionMode);
            btn.addEventListener('click', () => {
                document.querySelectorAll('.segment').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                sessionMode = btn.dataset.mode;
                savePrefs();
                updateSelectionSummary();
            });
        });

        if (importInput) {
            importInput.addEventListener('change', (e) => {
                if (e.target.files?.length) {
                    uploadFiles(e.target.files);
                    importInput.value = '';
                }
            });
        }

        // Soporte Drag & Drop para subir JSON/XML rápidamente
        if (dropZone) {
            ['dragenter', 'dragover'].forEach(evt => {
                dropZone.addEventListener(evt, (e) => {
                    e.preventDefault();
                    dropZone.classList.add('drag-over');
                });
            });
            ['dragleave', 'drop'].forEach(evt => {
                dropZone.addEventListener(evt, (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('drag-over');
                });
            });
            dropZone.addEventListener('drop', (e) => {
                const droppedFiles = e.dataTransfer?.files;
                if (droppedFiles?.length) {
                    uploadFiles(droppedFiles);
                }
            });
        }

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                if (!subjectData?.files?.length) return;
                const allIds = subjectData.files.map(f => f.id);
                if (selectedFiles.length === allIds.length) {
                    selectedFiles = [];
                } else {
                    selectedFiles = [...allIds];
                }
                savePrefs();
                renderFiles();
            });
        }

        if (deleteSubjectBtn) {
            deleteSubjectBtn.addEventListener('click', async () => {
                if (!subjectData) return;
                if (confirm(`¿Eliminar la materia "${subjectData.name}" permanentemente?`)) {
                    try {
                        await fetch(`${API_URL}/subjects/${encodeURIComponent(subjectId)}`, { method: 'DELETE' });
                        window.location.href = 'index.html';
                    } catch (err) {
                        console.error(err);
                        showToast('No se pudo eliminar la materia', 'error');
                    }
                }
            });
        }

        if (startSessionBtn) {
            startSessionBtn.addEventListener('click', () => {
                if (selectedFiles.length === 0) return;
                // Limpiar sesión previa en curso para iniciar una nueva
                sessionStorage.removeItem('vagos_active_quiz');
                const query = new URLSearchParams({
                    subject: subjectId,
                    files: selectedFiles.join(','),
                    mode: sessionMode,
                    count: sessionCount
                });
                window.location.href = `quiz.html?${query.toString()}`;
            });
        }

        async function loadSubjectDetail() {
            try {
                const res = await fetch(`${API_URL}/subjects/${encodeURIComponent(subjectId)}`);
                if (res.status === 404) {
                    showToast('La materia no existe', 'error');
                    setTimeout(() => window.location.replace('index.html'), 900);
                    return;
                }
                if (!res.ok) throw new Error('Error al cargar materia');
                subjectData = await res.json();

                document.title = `${subjectData.name} | Estudien Vagos`;
                if (subjectTitle) subjectTitle.textContent = subjectData.name;

                // Si no había archivos seleccionados aún y solo hay 1 archivo en la materia, pre-seleccionarlo
                const validIds = new Set(subjectData.files.map(f => f.id));
                selectedFiles = selectedFiles.filter(id => validIds.has(id));
                if (selectedFiles.length === 0 && subjectData.files.length === 1) {
                    selectedFiles = [subjectData.files[0].id];
                }
                savePrefs();
                renderFiles();
            } catch (err) {
                console.error(err);
                showToast('Error al cargar la materia', 'error');
            }
        }

        function renderFiles() {
            if (!filesList || !subjectData) return;
            filesList.innerHTML = '';

            const files = subjectData.files || [];
            if (filesSummaryText) {
                filesSummaryText.textContent = `${files.length} archivo(s) · ${subjectData.questionCount || 0} pregunta(s) en total`;
            }

            if (selectAllBtn) {
                if (files.length > 0) {
                    selectAllBtn.classList.remove('hidden');
                    selectAllBtn.textContent = selectedFiles.length === files.length
                        ? 'Quitar selección'
                        : 'Seleccionar todos';
                } else {
                    selectAllBtn.classList.add('hidden');
                }
            }

            if (files.length === 0) {
                filesList.innerHTML = `
                    <div class="empty-files-box">
                        <i class="ph ph-file-arrow-up"></i>
                        <p>Esta materia aún no tiene cuestionarios.</p>
                        <span class="sys-text">Sube un archivo <code>.json</code> o <code>.xml</code> o arrástralo aquí.</span>
                    </div>`;
                updateSelectionSummary();
                return;
            }

            files.forEach(file => {
                const isSelected = selectedFiles.includes(file.id);
                const qCount = file.questionCount ?? (Array.isArray(file.data) ? file.data.length : 0);

                const row = document.createElement('div');
                row.className = `file-row ${isSelected ? 'selected' : ''}`;

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'sys-checkbox';
                checkbox.checked = isSelected;
                checkbox.addEventListener('change', () => toggleFile(file.id));

                const info = document.createElement('div');
                info.className = 'file-info';
                info.innerHTML = `
                    <strong>${escapeHtml(file.name)}</strong>
                    <span><i class="ph ph-list-checks"></i> ${qCount} pregunta(s)</span>
                `;

                const trash = document.createElement('button');
                trash.type = 'button';
                trash.className = 'btn text-only alert small';
                trash.title = 'Eliminar archivo';
                trash.innerHTML = '<i class="ph ph-trash"></i>';
                trash.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`¿Eliminar el archivo "${file.name}" permanentemente?`)) {
                        try {
                            await fetch(`${API_URL}/files/${encodeURIComponent(file.id)}`, { method: 'DELETE' });
                            selectedFiles = selectedFiles.filter(id => id !== file.id);
                            savePrefs();
                            showToast('Archivo eliminado');
                            await loadSubjectDetail();
                        } catch (err) {
                            console.error(err);
                            showToast('No se pudo eliminar el archivo', 'error');
                        }
                    }
                });

                row.appendChild(checkbox);
                row.appendChild(info);
                row.appendChild(trash);

                row.addEventListener('click', (e) => {
                    if (e.target !== checkbox && e.target !== trash && !trash.contains(e.target)) {
                        toggleFile(file.id);
                    }
                });

                filesList.appendChild(row);
            });

            updateSelectionSummary();
        }

        function toggleFile(fileId) {
            if (selectedFiles.includes(fileId)) {
                selectedFiles = selectedFiles.filter(id => id !== fileId);
            } else {
                selectedFiles.push(fileId);
            }
            savePrefs();
            renderFiles();
        }

        function updateSelectionSummary() {
            const files = subjectData?.files || [];
            const chosenFiles = files.filter(f => selectedFiles.includes(f.id));
            const totalAvailableQuestions = chosenFiles.reduce(
                (acc, f) => acc + (f.questionCount ?? (Array.isArray(f.data) ? f.data.length : 0)),
                0
            );

            if (selectedFilesCountEl) {
                selectedFilesCountEl.textContent = `${chosenFiles.length} archivo(s) seleccionado(s)`;
            }
            if (selectedQuestionsCountEl) {
                const effectiveCount = sessionCount === 'all'
                    ? totalAvailableQuestions
                    : Math.min(parseInt(sessionCount, 10), totalAvailableQuestions);
                selectedQuestionsCountEl.textContent = chosenFiles.length > 0
                    ? `${totalAvailableQuestions} disponibles · Sesión de ${effectiveCount} pregunta(s)`
                    : 'Selecciona al menos un archivo de la lista';
            }

            if (startSessionBtn) {
                if (chosenFiles.length > 0 && totalAvailableQuestions > 0) {
                    startSessionBtn.disabled = false;
                    const modeLabel = sessionMode === 'study' ? 'Iniciar Repaso' : 'Comenzar Práctica';
                    startSessionBtn.innerHTML = `<i class="ph ph-power"></i> ${modeLabel} (${chosenFiles.length})`;
                } else {
                    startSessionBtn.disabled = true;
                    startSessionBtn.textContent = 'Selecciona archivos para comenzar';
                }
            }
        }

        async function uploadFiles(fileList) {
            let addedCount = 0;
            const newIds = [];
            showToast('Subiendo preguntas...');

            for (const file of fileList) {
                try {
                    const text = await file.text();
                    let questions = [];
                    let title = file.name.replace(/\.(json|xml)$/i, '');

                    if (file.name.toLowerCase().endsWith('.xml')) {
                        const parsedXml = parseXMLQuiz(text);
                        questions = parsedXml.questions;
                        if (parsedXml.title) title = parsedXml.title;
                    } else {
                        const json = JSON.parse(text);
                        if (Array.isArray(json)) {
                            questions = json;
                        } else if (json.questions && Array.isArray(json.questions)) {
                            questions = json.questions;
                            if (json.title) title = json.title;
                        } else {
                            throw new Error('Formato inválido: se requiere un array de preguntas.');
                        }
                    }

                    const fileId = crypto.randomUUID();
                    const res = await fetch(`${API_URL}/subjects/${encodeURIComponent(subjectId)}/files`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: fileId, name: title, data: questions })
                    });
                    if (!res.ok) throw new Error('Error guardando archivo en el servidor');

                    addedCount++;
                    newIds.push(fileId);
                } catch (err) {
                    console.error(err);
                    showToast(`Error en ${file.name}: ${err.message}`, 'error');
                }
            }

            if (addedCount > 0) {
                selectedFiles = Array.from(new Set([...selectedFiles, ...newIds]));
                savePrefs();
                await loadSubjectDetail();
                showToast(`${addedCount} archivo(s) subido(s) correctamente`);
            }
        }

        loadSubjectDetail();
    }

    // =========================================================================
    // 3. PÁGINA: QUIZ / REPASO (quiz.html)
    // =========================================================================
    function initQuizPage() {
        const params = new URLSearchParams(window.location.search);
        const subjectId = params.get('subject');
        const filesParam = params.get('files') || '';
        const mode = params.get('mode') === 'study' ? 'study' : 'test';
        const countParam = params.get('count') || 'all';
        const retryFailed = params.get('retryFailed') === '1';

        if (!subjectId) {
            window.location.replace('index.html');
            return;
        }

        const exitQuizBtn = document.getElementById('btn-exit-quiz');
        const subjectBadge = document.getElementById('quiz-subject-badge');
        const modeLabel = document.getElementById('hud-mode-label');
        const scoreLabel = document.getElementById('hud-score-label');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('quiz-progress-text');
        const questionContainer = document.getElementById('question-container');
        const quizControls = document.getElementById('quiz-controls');
        const submitBtn = document.getElementById('submit-btn');
        const nextBtn = document.getElementById('next-btn');
        const studyToolbar = document.getElementById('study-toolbar');
        const searchStudyInput = document.getElementById('search-study-questions');
        const switchToTestBtn = document.getElementById('btn-switch-to-test');

        const subjectUrl = `materia.html?id=${encodeURIComponent(subjectId)}`;
        if (exitQuizBtn) {
            exitQuizBtn.href = subjectUrl;
            exitQuizBtn.addEventListener('click', (e) => {
                if (mode === 'test' && quizState.questions.length > 0 && quizState.currentIndex > 0) {
                    if (!confirm('¿Salir de la sesión actual y volver a la materia?')) {
                        e.preventDefault();
                        return;
                    }
                }
                sessionStorage.removeItem('vagos_active_quiz');
            });
        }

        const sessionSignature = window.location.search;
        let quizState = {
            signature: sessionSignature,
            subjectId,
            subjectName: 'Materia',
            filesParam,
            mode,
            countParam,
            questions: [],
            currentIndex: 0,
            score: 0,
            maxScore: 0,
            userAnswers: [],
            isAnswerSubmitted: false,
            history: []
        };

        function saveQuizSession() {
            sessionStorage.setItem('vagos_active_quiz', JSON.stringify(quizState));
        }

        async function bootstrapQuiz() {
            // 1. Verificar si hay una sesión activa idéntica en curso (ej. al recargar la página)
            try {
                const saved = JSON.parse(sessionStorage.getItem('vagos_active_quiz') || 'null');
                if (saved && saved.signature === sessionSignature && Array.isArray(saved.questions) && saved.questions.length > 0) {
                    quizState = saved;
                    updateHeaderMeta();
                    startModeView();
                    return;
                }
            } catch (_) {}

            // 2. Si viene de "Practicar falladas" en resultados.html
            if (retryFailed) {
                try {
                    const lastResults = JSON.parse(sessionStorage.getItem('vagos_last_results') || 'null');
                    if (lastResults && Array.isArray(lastResults.failedQuestions) && lastResults.failedQuestions.length > 0) {
                        const pool = shuffleArray(lastResults.failedQuestions.map(cloneQuestionForSession));
                        pool.forEach(q => {
                            if (q.options) q.options = shuffleArray(q.options);
                        });
                        quizState.subjectName = lastResults.subjectName || 'Materia';
                        quizState.questions = pool;
                        quizState.maxScore = pool.reduce((acc, q) => acc + (q.points || 1), 0);
                        saveQuizSession();
                        updateHeaderMeta();
                        startModeView();
                        return;
                    }
                } catch (_) {}
            }

            // 3. Descargar únicamente las preguntas de los archivos seleccionados
            try {
                const res = await fetch(
                    `${API_URL}/subjects/${encodeURIComponent(subjectId)}/questions?files=${encodeURIComponent(filesParam)}`
                );
                if (!res.ok) throw new Error('Error descargando preguntas');
                const payload = await res.json();

                quizState.subjectName = payload.subject?.name || 'Materia';

                let pool = [];
                (payload.files || []).forEach(f => {
                    if (Array.isArray(f.data)) {
                        pool = pool.concat(f.data.map(cloneQuestionForSession));
                    }
                });

                if (pool.length === 0) {
                    questionContainer.innerHTML = `
                        <div class="empty-state">
                            <i class="ph ph-warning-circle"></i>
                            <h3>No hay preguntas en los archivos seleccionados</h3>
                            <p class="sys-text"><a href="${subjectUrl}" class="btn primary small" style="margin-top:0.8rem;">Volver a la materia</a></p>
                        </div>`;
                    if (quizControls) quizControls.classList.add('hidden');
                    return;
                }

                pool = shuffleArray(pool);

                if (countParam !== 'all') {
                    const limit = parseInt(countParam, 10);
                    if (!isNaN(limit) && limit > 0 && limit < pool.length) {
                        pool = pool.slice(0, limit);
                    }
                }

                pool.forEach(q => {
                    if (q.options) q.options = shuffleArray(q.options);
                });

                quizState.questions = pool;
                quizState.currentIndex = 0;
                quizState.score = 0;
                quizState.maxScore = pool.reduce((acc, q) => acc + (q.points || 1), 0);
                quizState.userAnswers = [];
                quizState.isAnswerSubmitted = false;
                quizState.history = [];

                saveQuizSession();
                updateHeaderMeta();
                startModeView();
            } catch (err) {
                console.error(err);
                showToast('Error al cargar el cuestionario', 'error');
            }
        }

        function updateHeaderMeta() {
            document.title = `${quizState.subjectName} — ${mode === 'study' ? 'Repaso' : 'Práctica'} | Estudien Vagos`;
            if (subjectBadge) subjectBadge.textContent = quizState.subjectName;
            if (modeLabel) modeLabel.textContent = mode === 'study' ? 'MODO REPASO' : 'MODO PRÁCTICA';
            if (scoreLabel) {
                scoreLabel.textContent = mode === 'study'
                    ? `${quizState.questions.length} preguntas`
                    : `${quizState.score} / ${quizState.maxScore} PTS`;
            }
        }

        function startModeView() {
            if (mode === 'study') {
                if (quizControls) quizControls.classList.add('hidden');
                if (studyToolbar) studyToolbar.classList.remove('hidden');
                renderStudyMode();
            } else {
                if (quizControls) quizControls.classList.remove('hidden');
                if (studyToolbar) studyToolbar.classList.add('hidden');
                renderQuestion();
            }
        }

        // --- MODO PRÁCTICA ---
        function renderQuestion() {
            const q = quizState.questions[quizState.currentIndex];
            if (!q) return;

            const total = quizState.questions.length;
            const currentNum = quizState.currentIndex + 1;
            const progress = ((quizState.currentIndex) / total) * 100;

            if (progressBar) progressBar.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${currentNum} / ${total}`;
            if (scoreLabel) scoreLabel.textContent = `${quizState.score} / ${quizState.maxScore} PTS`;

            submitBtn.classList.remove('hidden');
            nextBtn.classList.add('hidden');
            questionContainer.classList.remove('study-mode');

            questionContainer.style.animation = 'none';
            questionContainer.offsetHeight;
            questionContainer.style.animation = null;

            const typeLabels = { single: 'SELECCIÓN ÚNICA', multiple: 'SELECCIÓN MÚLTIPLE', boolean: 'VERDADERO / FALSO' };
            const pts = q.points || 1;
            const questionTextHtml = parseMd(q.text);

            questionContainer.innerHTML = `
                <div class="q-card-header">
                    <div>
                        <span class="q-eyebrow">Pregunta ${currentNum} de ${total}</span>
                        <span class="q-badge">${typeLabels[q.type] || 'PREGUNTA'}</span>
                    </div>
                    <div class="q-points">${pts} PTS</div>
                </div>
                <div class="q-text">${questionTextHtml}</div>
                <div class="opts-grid ${q.options.length <= 2 ? 'cols-2' : ''}">
                    ${q.options.map((opt, i) => `
                        <div class="opt-box" data-id="${escapeHtml(opt.id)}" data-index="${i}">
                            <div class="opt-idx">${String.fromCharCode(65 + i)}</div>
                            <div class="opt-txt">${parseMdInline(opt.text)}</div>
                        </div>
                    `).join('')}
                </div>
                <div id="feedback-area"></div>
            `;

            highlightCodeIn(questionContainer);

            questionContainer.querySelectorAll('.opt-box').forEach(item => {
                item.addEventListener('click', () => handleOptionClick(item, q.type));
            });

            if (quizState.isAnswerSubmitted) {
                applyFeedbackVisuals(q);
            } else if (quizState.userAnswers.length > 0) {
                questionContainer.querySelectorAll('.opt-box').forEach(item => {
                    if (quizState.userAnswers.includes(item.dataset.id)) {
                        item.classList.add('selected');
                    }
                });
            }
        }

        function handleOptionClick(item, type) {
            if (quizState.isAnswerSubmitted) return;

            const id = item.dataset.id;
            if (type === 'single' || type === 'boolean') {
                questionContainer.querySelectorAll('.opt-box').forEach(el => el.classList.remove('selected'));
                quizState.userAnswers = [id];
                item.classList.add('selected');
            } else if (type === 'multiple') {
                if (quizState.userAnswers.includes(id)) {
                    quizState.userAnswers = quizState.userAnswers.filter(a => a !== id);
                    item.classList.remove('selected');
                } else {
                    quizState.userAnswers.push(id);
                    item.classList.add('selected');
                }
            }
            saveQuizSession();
        }

        function evaluateQuestion(q, userAnswers) {
            const correctIds = q.options.filter(o => o.isCorrect).map(o => o.id);
            if (correctIds.length === 0) {
                return userAnswers.length === 0;
            }
            return userAnswers.length === correctIds.length &&
                userAnswers.every(ans => correctIds.includes(ans));
        }

        function applyFeedbackVisuals(q) {
            const correctIds = q.options.filter(o => o.isCorrect).map(o => o.id);
            const isCorrect = evaluateQuestion(q, quizState.userAnswers);

            questionContainer.querySelectorAll('.opt-box').forEach(item => {
                const id = item.dataset.id;
                const isSelected = quizState.userAnswers.includes(id);
                const isReal = correctIds.includes(id);

                if (isReal) item.classList.add('correct');
                else if (isSelected) item.classList.add('incorrect');

                item.style.pointerEvents = 'none';
            });

            const fbArea = document.getElementById('feedback-area');
            if (fbArea) {
                fbArea.innerHTML = `
                    <div class="feedback-alert ${isCorrect ? 'correct' : 'incorrect'} fade-in">
                        <i class="ph ${isCorrect ? 'ph-check-circle' : 'ph-x-circle'}"></i>
                        <div class="feedback-content">
                            <strong>${isCorrect ? 'RESPUESTA CORRECTA' : 'RESPUESTA INCORRECTA'}</strong>
                            ${q.feedback ? `<div class="feedback-body sys-text">${parseMd(q.feedback)}</div>` : ''}
                        </div>
                    </div>
                `;
                highlightCodeIn(fbArea);
            }

            submitBtn.classList.add('hidden');
            nextBtn.classList.remove('hidden');
            nextBtn.innerHTML = quizState.currentIndex + 1 < quizState.questions.length
                ? 'Siguiente <i class="ph ph-arrow-right"></i>'
                : 'Ver resultados <i class="ph ph-flag-checkered"></i>';
        }

        function checkAnswer() {
            const q = quizState.questions[quizState.currentIndex];
            if (!q) return;

            if (quizState.userAnswers.length === 0) {
                showToast('Selecciona al menos una opción', 'error');
                return;
            }

            if (!quizState.isAnswerSubmitted) {
                const isCorrect = evaluateQuestion(q, quizState.userAnswers);
                const pts = q.points || 1;
                if (isCorrect) quizState.score += pts;

                quizState.history[quizState.currentIndex] = {
                    question: q,
                    userAnswers: [...quizState.userAnswers],
                    isCorrect,
                    pointsEarned: isCorrect ? pts : 0
                };

                quizState.isAnswerSubmitted = true;
                if (scoreLabel) scoreLabel.textContent = `${quizState.score} / ${quizState.maxScore} PTS`;
                saveQuizSession();
            }

            applyFeedbackVisuals(q);
        }

        function nextQuestion() {
            quizState.currentIndex++;
            quizState.isAnswerSubmitted = false;
            quizState.userAnswers = [];

            if (quizState.currentIndex < quizState.questions.length) {
                saveQuizSession();
                renderQuestion();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                finishQuiz();
            }
        }

        function finishQuiz() {
            const history = quizState.history.filter(Boolean);
            const correctCount = history.filter(h => h.isCorrect).length;
            const incorrectCount = history.length - correctCount;
            const failedQuestions = history.filter(h => !h.isCorrect).map(h => h.question);

            const resultsPayload = {
                subjectId: quizState.subjectId,
                subjectName: quizState.subjectName,
                filesParam: quizState.filesParam,
                countParam: quizState.countParam,
                score: quizState.score,
                maxScore: quizState.maxScore,
                totalQuestions: quizState.questions.length,
                correctCount,
                incorrectCount,
                history,
                failedQuestions,
                completedAt: new Date().toISOString()
            };

            sessionStorage.setItem('vagos_last_results', JSON.stringify(resultsPayload));
            sessionStorage.removeItem('vagos_active_quiz');
            window.location.href = `resultados.html?subject=${encodeURIComponent(subjectId)}`;
        }

        if (submitBtn) submitBtn.addEventListener('click', checkAnswer);
        if (nextBtn) nextBtn.addEventListener('click', nextQuestion);

        // Atajos de teclado en modo práctica
        window.addEventListener('keydown', (e) => {
            if (mode !== 'test') return;
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            if (e.key === 'Enter') {
                e.preventDefault();
                if (!quizState.isAnswerSubmitted) {
                    checkAnswer();
                } else {
                    nextQuestion();
                }
                return;
            }

            if (!quizState.isAnswerSubmitted) {
                const keyUpper = e.key.toUpperCase();
                let optIndex = -1;
                if (e.key >= '1' && e.key <= '9') {
                    optIndex = parseInt(e.key, 10) - 1;
                } else if (keyUpper >= 'A' && keyUpper <= 'I') {
                    optIndex = keyUpper.charCodeAt(0) - 65;
                }

                if (optIndex >= 0) {
                    const boxes = questionContainer.querySelectorAll('.opt-box');
                    if (optIndex < boxes.length) {
                        const q = quizState.questions[quizState.currentIndex];
                        if (q) handleOptionClick(boxes[optIndex], q.type);
                    }
                }
            }
        });

        // --- MODO REPASO ---
        function renderStudyMode(filterQuery = '') {
            if (progressBar) progressBar.style.width = '100%';
            if (progressText) progressText.textContent = `${quizState.questions.length} preg.`;

            const normalizedFilter = filterQuery.trim().toLowerCase();
            const filteredQuestions = normalizedFilter
                ? quizState.questions.filter(q =>
                    String(q.text || '').toLowerCase().includes(normalizedFilter) ||
                    String(q.feedback || '').toLowerCase().includes(normalizedFilter) ||
                    (q.options || []).some(o => String(o.text || '').toLowerCase().includes(normalizedFilter))
                )
                : quizState.questions;

            let html = '<div class="study-list fade-in">';
            if (filteredQuestions.length === 0) {
                html += `
                    <div class="empty-state">
                        <i class="ph ph-magnifying-glass"></i>
                        <h3>Sin preguntas que coincidan</h3>
                        <p class="sys-text">Prueba con otro término de búsqueda.</p>
                    </div>`;
            } else {
                filteredQuestions.forEach((q, idx) => {
                    const correctOpts = (q.options || []).filter(o => o.isCorrect);
                    const correctText = correctOpts.length > 0
                        ? correctOpts.map(o => `<div class="study-correct-line"><i class="ph-bold ph-check"></i> ${parseMdInline(o.text)}</div>`).join('')
                        : 'Sin respuesta marcada';

                    const questionTextHtml = parseMd(q.text);

                    html += `
                        <div class="study-item">
                            <div class="study-badge">${escapeHtml(q.type)} // ${q.points || 1} PTS</div>
                            <div class="study-q"><span class="study-q-num">#${idx + 1}</span> ${questionTextHtml}</div>
                            <div class="study-ans">
                                <span class="study-ans-lbl">Respuesta correcta:</span>
                                ${correctText}
                            </div>
                            ${q.feedback ? `<div class="study-expl sys-text">${parseMd(q.feedback)}</div>` : ''}
                        </div>`;
                });
            }
            html += '</div>';

            html += `
                <div style="margin-top: 1.4rem; text-align:center;">
                    <a href="${subjectUrl}" class="btn primary huge">
                        <i class="ph ph-check-circle"></i> Finalizar repaso y volver a la materia
                    </a>
                </div>`;

            questionContainer.innerHTML = html;
            highlightCodeIn(questionContainer);
            questionContainer.style.background = 'transparent';
            questionContainer.style.border = 'none';
            questionContainer.style.padding = '0';
        }

        if (searchStudyInput) {
            searchStudyInput.addEventListener('input', () => {
                renderStudyMode(searchStudyInput.value);
            });
        }

        if (switchToTestBtn) {
            switchToTestBtn.addEventListener('click', () => {
                sessionStorage.removeItem('vagos_active_quiz');
                const nextParams = new URLSearchParams(window.location.search);
                nextParams.set('mode', 'test');
                window.location.href = `quiz.html?${nextParams.toString()}`;
            });
        }

        bootstrapQuiz();
    }

    // =========================================================================
    // 4. PÁGINA: RESULTADOS (resultados.html)
    // =========================================================================
    function initResultsPage() {
        const params = new URLSearchParams(window.location.search);
        const subjectIdParam = params.get('subject');

        let results = null;
        try {
            results = JSON.parse(sessionStorage.getItem('vagos_last_results') || 'null');
        } catch (_) {}

        if (!results) {
            window.location.replace(subjectIdParam ? `materia.html?id=${encodeURIComponent(subjectIdParam)}` : 'index.html');
            return;
        }

        const subjectId = results.subjectId || subjectIdParam;
        const subjectUrl = subjectId ? `materia.html?id=${encodeURIComponent(subjectId)}` : 'index.html';

        const pctEl = document.getElementById('result-percentage');
        const scoreCircle = document.getElementById('score-circle-path');
        const subjectNameEl = document.getElementById('result-subject-name');
        const headlineEl = document.getElementById('result-headline');
        const detailsEl = document.getElementById('result-details');
        const statCorrect = document.getElementById('stat-correct');
        const statIncorrect = document.getElementById('stat-incorrect');
        const statPoints = document.getElementById('stat-points');
        const returnSubjectBtn = document.getElementById('btn-return-subject');
        const retryBtn = document.getElementById('btn-retry');
        const retryFailedBtn = document.getElementById('btn-retry-failed');
        const reviewSection = document.getElementById('review-section');
        const reviewList = document.getElementById('review-list');

        const max = results.maxScore > 0 ? results.maxScore : 1;
        const pct = Math.round((results.score / max) * 100);

        document.title = `Resultados (${pct}%) — ${results.subjectName || 'Estudien Vagos'}`;
        if (subjectNameEl) subjectNameEl.textContent = results.subjectName || 'MATERIA';
        if (pctEl) pctEl.textContent = `${pct}%`;

        if (headlineEl) {
            if (pct >= 85) headlineEl.textContent = '¡Dominio sobresaliente!';
            else if (pct >= 60) headlineEl.textContent = 'Sesión completada';
            else headlineEl.textContent = 'Sesión finalizada — Sigue practicando';
        }

        if (detailsEl) {
            detailsEl.innerHTML = `Respondiste correctamente <strong style="color:var(--fg-primary)">${results.correctCount} de ${results.totalQuestions}</strong> preguntas.`;
        }

        if (statCorrect) statCorrect.textContent = String(results.correctCount ?? 0);
        if (statIncorrect) statIncorrect.textContent = String(results.incorrectCount ?? 0);
        if (statPoints) statPoints.textContent = `${results.score} / ${results.maxScore}`;

        if (scoreCircle) {
            const circumference = 283;
            const offset = circumference - (pct / 100) * circumference;
            setTimeout(() => {
                scoreCircle.style.strokeDashoffset = String(offset);
            }, 80);
        }

        if (returnSubjectBtn) {
            returnSubjectBtn.href = subjectUrl;
        }

        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                sessionStorage.removeItem('vagos_active_quiz');
                const query = new URLSearchParams({
                    subject: subjectId,
                    files: results.filesParam || '',
                    mode: 'test',
                    count: results.countParam || 'all'
                });
                window.location.href = `quiz.html?${query.toString()}`;
            });
        }

        if (retryFailedBtn && Array.isArray(results.failedQuestions) && results.failedQuestions.length > 0) {
            retryFailedBtn.classList.remove('hidden');
            retryFailedBtn.innerHTML = `<i class="ph ph-warning-octagon"></i> Practicar ${results.failedQuestions.length} fallada(s)`;
            retryFailedBtn.addEventListener('click', () => {
                sessionStorage.removeItem('vagos_active_quiz');
                const query = new URLSearchParams({
                    subject: subjectId,
                    retryFailed: '1',
                    mode: 'test'
                });
                window.location.href = `quiz.html?${query.toString()}`;
            });
        }

        // Renderizar revisión de respuestas
        if (reviewSection && reviewList && Array.isArray(results.history) && results.history.length > 0) {
            reviewSection.classList.remove('hidden');

            function renderReview(filter = 'all') {
                reviewList.innerHTML = '';
                const items = results.history.filter(item => {
                    if (filter === 'incorrect') return !item.isCorrect;
                    if (filter === 'correct') return item.isCorrect;
                    return true;
                });

                if (items.length === 0) {
                    reviewList.innerHTML = `
                        <div class="empty-state">
                            <p class="sys-text">No hay preguntas en esta categoría.</p>
                        </div>`;
                    return;
                }

                items.forEach((entry, idx) => {
                    const q = entry.question;
                    const userOpts = (q.options || []).filter(o => (entry.userAnswers || []).includes(o.id));
                    const correctOpts = (q.options || []).filter(o => o.isCorrect);

                    const userText = userOpts.length > 0
                        ? userOpts.map(o => parseMdInline(o.text)).join(' · ')
                        : 'Sin respuesta';
                    const correctText = correctOpts.length > 0
                        ? correctOpts.map(o => parseMdInline(o.text)).join(' · ')
                        : 'N/A';

                    const card = document.createElement('div');
                    card.className = `study-item review-card ${entry.isCorrect ? 'is-correct' : 'is-incorrect'}`;
                    card.innerHTML = `
                        <div class="study-badge ${entry.isCorrect ? 'badge-success' : 'badge-danger'}">
                            ${entry.isCorrect ? 'CORRECTA' : 'INCORRECTA'} // ${entry.pointsEarned}/${q.points || 1} PTS
                        </div>
                        <div class="study-q"><span class="study-q-num">#${idx + 1}</span> ${parseMd(q.text)}</div>
                        <div class="review-answers-grid">
                            <div class="review-ans-box ${entry.isCorrect ? 'correct' : 'incorrect'}">
                                <span class="study-ans-lbl">Tu respuesta:</span>
                                <div>${userText}</div>
                            </div>
                            ${!entry.isCorrect ? `
                                <div class="review-ans-box correct">
                                    <span class="study-ans-lbl">Respuesta correcta:</span>
                                    <div>${correctText}</div>
                                </div>
                            ` : ''}
                        </div>
                        ${q.feedback ? `<div class="study-expl sys-text">${parseMd(q.feedback)}</div>` : ''}
                    `;
                    reviewList.appendChild(card);
                });

                highlightCodeIn(reviewList);
            }

            document.querySelectorAll('.review-filters .segment').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.review-filters .segment').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderReview(btn.dataset.filter);
                });
            });

            renderReview('all');
        }
    }

    // =========================================================================
    // 5. PÁGINA: PROMPTS & GUÍA IA (prompts.html)
    // =========================================================================
    function initPromptsPage() {
        const params = new URLSearchParams(window.location.search);
        const fromSubject = params.get('subject');
        const initialTab = params.get('tab');

        const backBtn = document.getElementById('btn-back-from-prompts');
        if (backBtn && fromSubject) {
            backBtn.href = `materia.html?id=${encodeURIComponent(fromSubject)}`;
            backBtn.innerHTML = '<i class="ph ph-arrow-left"></i> Volver a la materia';
        }

        function activateTab(tabName) {
            const tabs = document.querySelectorAll('.modal-tab');
            const panes = document.querySelectorAll('.modal-pane');
            tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
            panes.forEach(p => p.classList.toggle('active', p.dataset.pane === tabName));
        }

        if (initialTab) {
            activateTab(initialTab);
        }

        document.querySelectorAll('.modal-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                activateTab(tab.dataset.tab);
            });
        });

        document.querySelectorAll('.btn-copy').forEach(btn => {
            btn.addEventListener('click', async () => {
                const targetId = btn.dataset.target;
                const targetEl = document.getElementById(targetId);
                if (!targetEl) return;

                const textToCopy = targetEl.textContent;
                try {
                    if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(textToCopy);
                    } else {
                        const ta = document.createElement('textarea');
                        ta.value = textToCopy;
                        ta.style.position = 'fixed';
                        ta.style.left = '-9999px';
                        document.body.appendChild(ta);
                        ta.focus();
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                    }

                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<i class="ph-bold ph-check"></i> ¡Copiado!';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.classList.remove('copied');
                    }, 2000);
                    showToast('¡Copiado al portapapeles!');
                } catch (err) {
                    console.error('Error al copiar:', err);
                    showToast('No se pudo copiar automáticamente', 'error');
                }
            });
        });

        function downloadTemplateFile(elementId, filename, mimeType) {
            const el = document.getElementById(elementId);
            if (!el) return;
            const blob = new Blob([el.textContent], { type: `${mimeType};charset=utf-8` });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast(`Plantilla descargada: ${filename}`);
        }

        const downloadJsonBtn = document.getElementById('btn-download-json-template');
        if (downloadJsonBtn) {
            downloadJsonBtn.addEventListener('click', () => {
                downloadTemplateFile('code-template-json', 'plantilla_cuestionario.json', 'application/json');
            });
        }

        const downloadXmlBtn = document.getElementById('btn-download-xml-template');
        if (downloadXmlBtn) {
            downloadXmlBtn.addEventListener('click', () => {
                downloadTemplateFile('code-template-xml', 'plantilla_cuestionario.xml', 'application/xml');
            });
        }
    }
});
