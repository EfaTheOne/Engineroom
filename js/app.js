document.addEventListener('DOMContentLoaded', () => {

    /* --- Global: Auth Check & Active Nav --- */
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    // 1. Critical Security Check (Anti-Flash)
    if (currentPath.includes('dashboard.html')) {
        checkAuthSecure();
    }

    // Highlight Nav
    document.querySelectorAll('nav a').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.style.color = 'var(--primary)';
        }
    });

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            performLogout();
        });
    }

    /* --- Page Specific Logic --- */

    // 1. Dashboard Logic
    if (document.querySelector('.kanban-board')) {
        initDashboard();
    }

    // 2. Wizard Logic (Apply Page)
    if (document.getElementById('application-form')) {
        initWizard(document.getElementById('application-form'));
    }

    // 3. Login Logic
    if (document.getElementById('login-form')) {
        initLogin(document.getElementById('login-form'));
    }

    // Smooth Scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});

/* --- Security Functions --- */

// Fix for Back-Button Cache (BFCache)
window.addEventListener('pageshow', (event) => {
    if (event.persisted && window.location.pathname.includes('dashboard.html')) {
        checkAuthSecure();
    }
});

function checkAuthSecure() {
    // SWITCH TO SESSION STORAGE (Stricter Security)
    const authData = sessionStorage.getItem('engineRoomAuth');

    if (!authData) {
        window.location.href = 'login.html';
        return;
    }

    // Check Expiry (30 mins)
    const { timestamp } = JSON.parse(authData);
    const now = Date.now();
    const thirtyMins = 30 * 60 * 1000;

    if (now - timestamp > thirtyMins) {
        alert('Session expired. Please log in again.');
        performLogout();
        return;
    }

    // Update Timestamp (Sliding Expiry)
    sessionStorage.setItem('engineRoomAuth', JSON.stringify({ timestamp: now, user: 'admin' }));

    // Valid - Reveal Body
    const body = document.getElementById('dashboard-body');
    if (body) body.style.display = 'block';
}

function performLogout() {
    sessionStorage.removeItem('engineRoomAuth');
    // Also clear localStorage just in case from old version
    localStorage.removeItem('engineRoomAuth');
    window.location.href = 'index.html';
}

/* --- Toast Notification System --- */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <strong>${type === 'error' ? 'Error' : 'Notification'}</strong>
            <div>${message}</div>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* --- Dashboard Functions --- */

const COLUMNS = {
    'New': 'Inbox',
    'Review': 'In Review',
    'Interview': 'Interview',
    'Accepted': 'Accepted',
    'Archived': 'Archived'
};

function initDashboard() {
    refreshBoard();

    // Setup Modal Close
    document.querySelector('.close-modal').onclick = closeModal;
    document.getElementById('modal-save-btn').onclick = saveAppChanges;

    // Search Listener
    const searchInput = document.getElementById('dashboard-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            refreshBoard(e.target.value);
        });
        searchInput.focus();
    }

    // Export Listener
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportCSV);
    }

    // Settings Modal Logic
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const saveSettings = document.getElementById('save-settings-btn');
    const keyInput = document.getElementById('api-key-input');
    const modelInput = document.getElementById('api-model-input');

    if (settingsBtn) {
        settingsBtn.onclick = () => {
            keyInput.value = localStorage.getItem('geminiApiKey') || '';
            modelInput.value = localStorage.getItem('geminiModel') || 'gemini-1.5-flash';
            settingsModal.classList.add('open');
        };
        closeSettings.onclick = () => settingsModal.classList.remove('open');
        saveSettings.onclick = () => {
            const key = keyInput.value.trim();
            const model = modelInput.value.trim() || 'gemini-1.5-flash';

            if (key) {
                localStorage.setItem('geminiApiKey', key);
                localStorage.setItem('geminiModel', model);
                showToast(`Settings Saved. Model: ${model}`, 'success');
            } else {
                localStorage.removeItem('geminiApiKey');
                localStorage.removeItem('geminiModel');
                showToast('API Key removed. Reverting to Simulation Mode.', 'info');
            }
            settingsModal.classList.remove('open');
        };

        // Test Connection Logic
        if (testBtn) {
            testBtn.onclick = async () => {
                const key = keyInput.value.trim();
                const model = modelInput.value.trim() || 'gemini-1.5-flash';

                if (!key) {
                    showToast('Please enter an API Key first.', 'error');
                    return;
                }

                testBtn.innerText = 'Testing...';
                testBtn.disabled = true;

                try {
                    // Simple ping: Generate 1 token
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: "Ping" }] }]
                        })
                    });

                    if (response.ok) {
                        showToast('Connection Successful', 'success');
                        testBtn.innerText = 'Connection Verified';
                        testBtn.style.color = '#00e676';
                        testBtn.style.borderColor = '#00e676';
                    } else {
                        const err = await response.json();
                        throw new Error(err.error?.message || 'Unknown Error');
                    }
                } catch (e) {
                    console.error('Test Failed:', e);
                    showToast(`Connection Failed: ${e.message}`, 'error');
                    testBtn.innerText = 'Test Failed';
                    testBtn.style.color = '#ff1744';
                    testBtn.style.borderColor = '#ff1744';
                } finally {
                    setTimeout(() => {
                        testBtn.disabled = false;
                        if (testBtn.innerText !== 'Connection Verified') {
                            testBtn.innerText = 'Test Connection';
                            testBtn.style.color = '';
                            testBtn.style.borderColor = '';
                        }
                    }, 3000);
                }
            };
        }

        // Close on outside click
        settingsModal.onclick = (e) => {
            if (e.target === settingsModal) settingsModal.classList.remove('open');
        };
    }
}

/* --- AI Logic (Real & Simulated) --- */

async function generateAIReport(app) {
    const btn = document.getElementById('ai-generate-btn');
    const content = document.getElementById('ai-content');
    const scoreEl = document.getElementById('ai-score');
    const verdictEl = document.getElementById('ai-verdict');
    const summaryEl = document.getElementById('ai-summary');

    // UI Reset
    btn.innerHTML = 'Analyzing...';
    btn.disabled = true;
    content.style.display = 'none';

    const apiKey = localStorage.getItem('geminiApiKey');
    const model = localStorage.getItem('geminiModel') || 'gemini-1.5-flash';

    if (apiKey) {
        // --- REAL AI MODE ---
        try {
            console.log(`Attempting AI Analysis using ${model}`);

            const prompt = `
            You are an expert venture capitalist analyst. Analyze this startup:
            Name: ${app['business-name'] || app.name}
            Stage: ${app.stage}
            Description: ${app.description}
            
            Provide a JSON response with these keys:
            - score: A number between 0-100 representing investment fit.
            - verdict: A short 2-3 word category (e.g. "Strong Contender", "High Risk").
            - summary: A 2-sentence executive summary.
            
            Do not include emojis. Keep it professional. Do not include markdown formatting, just raw JSON.
            `;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Gemini API Error Details:', errorData);
                throw new Error(errorData.error?.message || 'API Request Failed');
            }

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) throw new Error('No content generated');

            // Clean markdown jsons if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanText);

            finalizeAI(data.score, data.verdict, data.summary, btn, content, scoreEl, verdictEl, summaryEl);
            showToast('Analysis complete', 'success');

        } catch (error) {
            console.error('AI Integration Error:', error);
            showToast(`AI Error: ${error.message}. Switching to Simulation.`, 'error');
            setTimeout(() => {
                runSimulation(app, btn, content, scoreEl, verdictEl, summaryEl);
            }, 5000);
        }
    } else {
        // --- SIMULATION MODE ---
        runSimulation(app, btn, content, scoreEl, verdictEl, summaryEl);
    }
}

function runSimulation(app, btn, content, scoreEl, verdictEl, summaryEl) {
    // 1. Calculate Score (Heuristic)
    let score = 0;
    const textBlob = (app.description + ' ' + (app.revenue_model || '')).toLowerCase();

    // Stage Score
    if (app.stage === 'scaling') score += 40;
    else if (app.stage === 'revenue') score += 30;
    else if (app.stage === 'mvp') score += 20;
    else score += 10;

    // Keyword Score
    ['revenue', 'users', 'patent', 'team', 'growth', 'ai', 'crypto'].forEach(k => {
        if (textBlob.includes(k)) score += 5;
    });

    // Length Score
    if (app.description.length > 50) score += 10;

    score = Math.min(score, 94); // Humans aren't perfect

    // Verdict
    let verdict = 'DRAFT';
    if (score > 80) verdict = 'TOP TIER CANDIDATE';
    else if (score > 60) verdict = 'STRONG POTENTIAL';
    else if (score > 40) verdict = 'WATCHLIST';
    else verdict = 'HIGH RISK';

    // Summary Template
    const summary = `
        ${app['business-name'] || 'This venture'} is a ${app.stage} stage project. 
        The founder describes it as: "${app.description.substring(0, 50)}...".
        Based on the ${app.stage} status${textBlob.includes('revenue') ? ' and revenue focus' : ''}, it shows ${score > 60 ? 'good' : 'early'} promise.
    `;

    setTimeout(() => {
        finalizeAI(score, verdict, summary, btn, content, scoreEl, verdictEl, summaryEl);
    }, 1500); // Fake delay
}

function finalizeAI(score, verdict, summary, btn, content, scoreEl, verdictEl, summaryEl) {
    content.style.display = 'block';
    btn.innerHTML = 'Regenerate';
    btn.disabled = false;

    // Animate Score
    animateValue(scoreEl, 0, score, 1000);
    verdictEl.innerText = verdict;
    verdictEl.style.color = score > 60 ? '#00e676' : '#ff1744';

    // Type Summary
    typeText(summaryEl, summary.replace(/\s+/g, ' ').trim());
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function typeText(element, text) {
    element.innerHTML = '';
    let i = 0;
    const speed = 15;
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

function getApps() {
    return JSON.parse(localStorage.getItem('engineRoomApps') || '[]');
}

function saveApps(apps) {
    localStorage.setItem('engineRoomApps', JSON.stringify(apps));
}

function refreshBoard(filterText = '') {
    const apps = getApps();
    const board = document.querySelector('.kanban-board');
    if (!board) return;
    board.innerHTML = '';

    updateStats(apps);

    const filteredApps = filterText
        ? apps.filter(a =>
            (a.name && a.name.toLowerCase().includes(filterText.toLowerCase())) ||
            (a['business-name'] && a['business-name'].toLowerCase().includes(filterText.toLowerCase()))
        )
        : apps;

    Object.keys(COLUMNS).forEach(statusKey => {
        const colDiv = document.createElement('div');
        colDiv.className = 'kanban-column';

        const colApps = filteredApps.filter(a => a.status === statusKey);

        colDiv.innerHTML = `
            <div class="column-header">
                <h3>${COLUMNS[statusKey]}</h3>
                <span class="column-count">${colApps.length}</span>
            </div>
            <div class="column-body ${colApps.length === 0 ? 'empty' : ''}" id="col-${statusKey}" ondrop="drop(event)" ondragover="allowDrop(event)" data-status="${statusKey}">
            </div>
        `;

        const body = colDiv.querySelector('.column-body');

        if (colApps.length === 0) {
            body.innerHTML = `<div style="text-align: center; color: var(--text-muted); opacity: 0.5; padding-top: 2rem; pointer-events: none;">No Items</div>`;
        } else {
            colApps.forEach(app => {
                const card = document.createElement('div');
                card.className = 'kanban-card';
                card.draggable = true;
                card.id = `card-${app.id}`;
                card.dataset.id = app.id;

                card.ondragstart = drag;

                card.onclick = (e) => {
                    if (window.getSelection().toString().length === 0) {
                        openAppModal(app.id);
                    }
                };

                card.innerHTML = `
                    <h4>${app['business-name'] || app.name}</h4>
                    <p style="font-size: 0.9rem; margin-bottom: 0.5rem; color: #ccc;">${app.name}</p>
                    <div class="meta">
                        <span class="tag">${app.stage}</span>
                        <span>${app.date}</span>
                    </div>
                `;
                body.appendChild(card);
            });
        }

        board.appendChild(colDiv);
    });
}

function updateStats(apps) {
    const total = apps.length;
    const pending = apps.filter(a => a.status === 'New').length;
    const accepted = apps.filter(a => a.status === 'Accepted').length;
    const rate = total > 0 ? Math.round((accepted / total) * 100) : 0;

    const pipeline = apps.reduce((sum, app) => {
        if (app.stage === 'revenue') return sum + 50000;
        if (app.stage === 'scaling') return sum + 100000;
        return sum + 10000;
    }, 0);

    const statTotal = document.getElementById('stat-total');
    if (statTotal) statTotal.innerText = total;

    const statPending = document.getElementById('stat-pending');
    if (statPending) statPending.innerText = pending;

    const statRate = document.getElementById('stat-rate');
    if (statRate) statRate.innerText = rate + '%';

    const statPipeline = document.getElementById('stat-pipeline');
    if (statPipeline) statPipeline.innerText = '$' + (pipeline / 1000).toFixed(0) + 'k';
}

function exportCSV() {
    const apps = getApps();
    if (apps.length === 0) {
        showToast('No data to export.', 'error');
        return;
    }

    const headers = Object.keys(apps[0]).join(',');

    const rows = apps.map(app => {
        return Object.values(app).map(val => {
            const strStr = String(val).replace(/"/g, '""');
            return `"${strStr}"`;
        }).join(',');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `engine_room_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Export successfully downloaded!', 'success');
}

/* --- Drag & Drop Handlers --- */
function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.dataset.id);
}

function drop(ev) {
    ev.preventDefault();
    const id = parseInt(ev.dataTransfer.getData("text"));
    let target = ev.target;
    while (!target.classList.contains('column-body')) {
        target = target.parentElement;
        if (!target) return;
    }
    const newStatus = target.dataset.status;
    const apps = getApps();
    const appIndex = apps.findIndex(a => a.id === id);
    if (appIndex > -1 && apps[appIndex].status !== newStatus) {
        apps[appIndex].status = newStatus;
        saveApps(apps);
        refreshBoard(document.getElementById('dashboard-search')?.value || '');
        showToast(`Moved application to ${COLUMNS[newStatus]}`, 'success');
    }
}

/* --- Modal Logic --- */
let currentAppId = null;

function openAppModal(id) {
    currentAppId = id;
    const apps = getApps();
    const app = apps.find(a => a.id === id);
    if (!app) return;

    document.getElementById('modal-title').innerText = app['business-name'] || 'Application';
    document.getElementById('modal-founder').innerText = app.name;
    document.getElementById('modal-contact').innerText = `${app.email} | ${app.phone}`;
    document.getElementById('modal-business').innerText = app['business-name'] || 'N/A';
    document.getElementById('modal-stage').innerText = app.stage.toUpperCase();
    document.getElementById('modal-pitch').innerText = app.description;

    const answersHtml = `
        <p><strong>Customer:</strong><br>${app.customers || 'N/A'}</p>
        <p><strong>Revenue Model:</strong><br>${app.revenue_model || 'N/A'}</p>
        <p><strong>Competitors:</strong><br>${app.competitors || 'N/A'}</p>
        <p><strong>Funding:</strong><br>${app.funding || 'N/A'}</p>
    `;
    document.getElementById('modal-answers').innerHTML = answersHtml;

    document.getElementById('modal-notes').value = app.notes || '';
    document.getElementById('modal-status-select').value = app.status;

    // Reset AI Section
    document.getElementById('ai-content').style.display = 'none';
    const aiBtn = document.getElementById('ai-generate-btn');
    aiBtn.innerText = 'Generate Report';
    aiBtn.disabled = false;

    // Attach AI Handler
    aiBtn.onclick = () => generateAIReport(app);

    document.getElementById('app-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('app-modal').classList.remove('open');
    currentAppId = null;
}

function saveAppChanges() {
    if (!currentAppId) return;
    const apps = getApps();
    const appIndex = apps.findIndex(a => a.id === currentAppId);
    if (appIndex > -1) {
        apps[appIndex].notes = document.getElementById('modal-notes').value;
        apps[appIndex].status = document.getElementById('modal-status-select').value;
        saveApps(apps);
        closeModal();
        refreshBoard(document.getElementById('dashboard-search')?.value || '');
        showToast('Application updated successfully', 'success');
    }
}


/* --- Other Page Logic (Wizard/Login) --- */

function initLogin(form) {
    // Clear old auth
    sessionStorage.removeItem('engineRoomAuth');
    localStorage.removeItem('engineRoomAuth');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = form.username.value;
        const password = form.password.value;

        if (username === 'admin' && password === 'admin') {
            const authData = {
                timestamp: Date.now(),
                user: 'admin'
            };
            sessionStorage.setItem('engineRoomAuth', JSON.stringify(authData));
            window.location.href = 'dashboard.html';
        } else {
            const errorMsg = document.getElementById('login-error');
            errorMsg.style.display = 'block';
        }
    });
}

function initWizard(form) {
    const fieldsets = Array.from(form.querySelectorAll('fieldset'));
    const formActions = form.querySelector('.form-actions');
    let currentStep = 0;

    const btnContainer = document.createElement('div');
    btnContainer.className = 'wizard-nav form-actions';
    btnContainer.style.width = '100%';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'btn btn-outline';
    prevBtn.innerText = 'Back';
    prevBtn.style.visibility = 'hidden';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'btn btn-primary';
    nextBtn.innerText = 'Next Step';

    btnContainer.appendChild(prevBtn);
    btnContainer.appendChild(nextBtn);
    formActions.innerHTML = '';
    formActions.appendChild(btnContainer);

    showStep(currentStep);

    nextBtn.addEventListener('click', () => {
        if (validateStep(currentStep)) {
            if (currentStep < fieldsets.length - 1) {
                currentStep++;
                showStep(currentStep);
            } else {
                submitApplication(form, nextBtn);
            }
        }
    });

    prevBtn.addEventListener('click', () => {
        currentStep--;
        showStep(currentStep);
    });

    function showStep(index) {
        fieldsets.forEach((fieldset, i) => {
            if (i === index) {
                fieldset.style.display = 'block';
                fieldset.style.opacity = 0;
                setTimeout(() => fieldset.style.opacity = 1, 50);
            } else {
                fieldset.style.display = 'none';
            }
        });

        const steps = document.querySelectorAll('.wizard-progress .step');
        if (steps.length > 0) {
            steps.forEach((step, i) => {
                if (i < index) {
                    step.classList.add('completed');
                    step.classList.remove('active');
                } else if (i === index) {
                    step.classList.add('active');
                    step.classList.remove('completed');
                } else {
                    step.classList.remove('active', 'completed');
                }
            });
        }

        prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
        if (index === fieldsets.length - 1) {
            nextBtn.innerText = 'Submit Application';
            nextBtn.classList.remove('btn-outline');
            nextBtn.classList.add('btn-primary');
        } else {
            nextBtn.innerText = 'Next Step';
            nextBtn.classList.add('btn-primary');
        }
    }

    function validateStep(index) {
        const currentFieldset = fieldsets[index];
        const inputs = currentFieldset.querySelectorAll('input, select, textarea');
        let valid = true;
        inputs.forEach(input => {
            if (input.hasAttribute('required') && !input.value.trim()) {
                valid = false;
                input.style.borderColor = 'red';
                input.addEventListener('input', function () { this.style.borderColor = ''; }, { once: true });
            }
        });
        if (!valid) alert('Please fill in all required fields.');
        return valid;
    }
}

function submitApplication(form, btn) {
    btn.innerText = 'Sending...';
    btn.disabled = true;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.id = Date.now();
    data.date = new Date().toLocaleDateString();
    data.status = 'New';
    data.notes = '';

    const apps = JSON.parse(localStorage.getItem('engineRoomApps') || '[]');
    apps.push(data);
    localStorage.setItem('engineRoomApps', JSON.stringify(apps));

    setTimeout(() => {
        const wrapper = form.closest('.application-wrapper');
        wrapper.innerHTML = `
            <div class="text-center" style="padding: 3rem;">
                <div class="success-checkmark" style="font-size: 4rem; color: var(--primary); margin-bottom: 2rem;">
                     ✓
                </div>
                <h2>Application Received</h2>
                <p>Thank you for submitting your application to The Engine Room.</p>
                <p>We will review your submission and contact you within 5 business days.</p>
                <div style="margin-top: 2rem;">
                    <a href="index.html" class="btn btn-primary">Return Home</a>
                </div>
            </div>
        `;
    }, 1500);
}
