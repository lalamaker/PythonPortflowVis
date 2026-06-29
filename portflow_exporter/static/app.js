document.addEventListener('DOMContentLoaded', () => {
    let globalToken = '';
    let fetchedStudents = {};
    let exportResults = [];

    // DOM Elements
    const btnAuth = document.getElementById('btn-auth');
    const tokenInput = document.getElementById('bearer-token');
    const authError = document.getElementById('auth-error');
    const stepStudents = document.getElementById('step-students');
    const stepExport = document.getElementById('step-export');
    
    const fetchMethod = document.getElementById('fetch-method');
    const sectionSelector = document.getElementById('section-selector');
    const sectionId = document.getElementById('section-id');
    const btnFetchStudents = document.getElementById('btn-fetch-students');
    const studentsListContainer = document.getElementById('students-list-container');
    const studentCount = document.getElementById('student-count');
    const selectAllStudents = document.getElementById('select-all-students');
    const studentSearch = document.getElementById('student-search');
    const studentsList = document.getElementById('students-list');
    const studentsError = document.getElementById('students-error');

    const timeRange = document.getElementById('time-range');
    const timeRangeInputs = document.getElementById('time-range-inputs');
    const includeReviewer = document.getElementById('include-reviewer');
    const btnExport = document.getElementById('btn-export');
    const btnDownloadCsv = document.getElementById('btn-download-csv');
    const exportError = document.getElementById('export-error');

    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    const resultsSection = document.getElementById('results-section');
    const resultsContainer = document.getElementById('results-container');

    // Utility: Format Date
    const formatDate = (isoString) => {
        if (!isoString) return 'Unknown Date';
        const d = new Date(isoString);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Utility: Show Loading
    const showLoading = (text) => {
        loadingText.textContent = text;
        loadingOverlay.classList.remove('hidden');
    };

    const hideLoading = () => {
        loadingOverlay.classList.add('hidden');
    };

    // Step 1: Authentication
    btnAuth.addEventListener('click', async () => {
        const tokenRaw = tokenInput.value.trim();
        if (!tokenRaw) return;

        // Try to extract bearer if they pasted the whole header
        let token = tokenRaw;
        const match = tokenRaw.match(/bearer\s+([A-Za-z0-9\-\._~\+\/]+=*)/i);
        if (match) token = match[1];

        showLoading('Validating token...');
        authError.classList.add('hidden');

        try {
            const res = await fetch('/api/check-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Authentication failed');

            globalToken = token;
            document.getElementById('step-auth').classList.remove('active');
            stepStudents.classList.remove('hidden');
            setTimeout(() => stepStudents.classList.add('active'), 50);
            
            // Pre-load sections in background
            loadSections();
            
        } catch (err) {
            authError.textContent = err.message;
            authError.classList.remove('hidden');
        } finally {
            hideLoading();
        }
    });

    // Handle Fetch Method Change
    fetchMethod.addEventListener('change', (e) => {
        if (e.target.value === 'section_select') {
            sectionSelector.classList.remove('hidden');
        } else {
            sectionSelector.classList.add('hidden');
        }
    });

    async function loadSections() {
        try {
            const res = await fetch('/api/sections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: globalToken })
            });
            const data = await res.json();
            
            sectionId.innerHTML = '';
            if (data.categories) {
                Object.keys(data.categories).forEach(cat => {
                    if (data.categories[cat].length > 0) {
                        const optgroup = document.createElement('optgroup');
                        optgroup.label = cat;
                        data.categories[cat].forEach(sec => {
                            const opt = document.createElement('option');
                            opt.value = sec.id;
                            opt.textContent = sec.name;
                            optgroup.appendChild(opt);
                        });
                        sectionId.appendChild(optgroup);
                    }
                });
            }
        } catch (e) {
            console.error('Failed to load sections', e);
        }
    }

    // Step 2: Fetch Students
    btnFetchStudents.addEventListener('click', async () => {
        showLoading('Fetching students...');
        studentsError.classList.add('hidden');
        studentsListContainer.classList.add('hidden');

        const payload = {
            token: globalToken,
            method: fetchMethod.value
        };

        if (payload.method === 'section_select') {
            payload.section_id = sectionId.value;
        }

        try {
            const res = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch students');

            fetchedStudents = data.students || {};
            const count = Object.keys(fetchedStudents).length;
            
            studentCount.textContent = count;
            studentsList.innerHTML = '';
            
            Object.keys(fetchedStudents).sort().forEach(name => {
                const div = document.createElement('div');
                div.className = 'student-item';
                div.dataset.name = name.toLowerCase();
                
                const label = document.createElement('label');
                label.className = 'checkbox-label';
                
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'student-checkbox';
                cb.value = name;
                // Unchecked by default
                cb.checked = false;
                
                label.appendChild(cb);
                label.appendChild(document.createTextNode(' ' + name));
                div.appendChild(label);
                
                studentsList.appendChild(div);
            });

            selectAllStudents.checked = false;
            studentSearch.value = '';
            updateExportButtonCount();

            studentsListContainer.classList.remove('hidden');

            if (count > 0) {
                stepExport.classList.remove('hidden');
                setTimeout(() => stepExport.classList.add('active'), 50);
            }

        } catch (err) {
            studentsError.textContent = err.message;
            studentsError.classList.remove('hidden');
        } finally {
            hideLoading();
        }
    });

    function updateExportButtonCount() {
        const selected = document.querySelectorAll('.student-checkbox:checked').length;
        btnExport.textContent = `Export Results (${selected} selected)`;
    }

    // Student list search filter
    studentSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.student-item').forEach(item => {
            if (item.dataset.name.includes(query)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // Select all toggle (only affects visible items)
    selectAllStudents.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.student-item').forEach(item => {
            if (item.style.display !== 'none') {
                const cb = item.querySelector('.student-checkbox');
                if (cb) cb.checked = isChecked;
            }
        });
        updateExportButtonCount();
    });

    // Listen to individual checkbox changes
    studentsList.addEventListener('change', (e) => {
        if (e.target.classList.contains('student-checkbox')) {
            updateExportButtonCount();
            
            // Uncheck "Select All" if a checkbox is manually unchecked
            if (!e.target.checked) {
                selectAllStudents.checked = false;
            }
        }
    });

    // Time Range Dynamic Inputs
    timeRange.addEventListener('change', (e) => {
        const val = e.target.value;
        timeRangeInputs.innerHTML = '';
        if (val === 'last') {
            timeRangeInputs.innerHTML = `
                <div class="form-group">
                    <label>Number of Days</label>
                    <input type="number" id="tr-days" value="30" min="1">
                </div>
            `;
            timeRangeInputs.classList.remove('hidden');
        } else if (val === 'between') {
            timeRangeInputs.innerHTML = `
                <div class="form-group">
                    <label>Start Date</label>
                    <input type="date" id="tr-start">
                </div>
                <div class="form-group">
                    <label>End Date</label>
                    <input type="date" id="tr-end">
                </div>
            `;
            timeRangeInputs.classList.remove('hidden');
        } else if (val === 'since') {
            timeRangeInputs.innerHTML = `
                <div class="form-group">
                    <label>Start Date</label>
                    <input type="date" id="tr-start">
                </div>
            `;
            timeRangeInputs.classList.remove('hidden');
        } else {
            timeRangeInputs.classList.add('hidden');
        }
    });

    // Checker UI Helpers
    function buildRequirementsSection(title, sectionData) {
    if (sectionData.isInfo) return `<div style="margin-bottom: 1rem;"><div style="font-weight: 600; font-size: 0.95em; color: #4b5563; margin-bottom: 0.5rem;">${title}:</div><div style="padding-left: 1.5rem; color: #374151;">${sectionData.text}</div></div>`;
    
    let html = `<div style="margin-bottom: 1rem;">
        <div style="font-weight: 600; font-size: 0.95em; color: #4b5563; margin-bottom: 0.5rem;">${title}:</div>
        <div style="padding-left: 1.5rem; display: flex; flex-direction: column; gap: 0.4rem; line-height: 1.4;">`;
        
    if (sectionData.items && sectionData.items.length > 0) {
        sectionData.items.forEach(item => {
            if (item.isBooleanTarget) {
                html += `<div style="color: #374151;">${item.label}</div>`;
            } else if (item.target !== undefined) {
                html += `<div style="color: #374151;">${item.label}: <strong>${item.target}</strong></div>`;
            }
        });
    }
    html += `</div></div>`;
    return html;
}

function buildStatusSection(title, sectionData) {
        if (!sectionData) return '';
        
        if (sectionData.isInfo) {
            return `<div style="margin-bottom: 0.75rem;">
                <div style="font-weight: 600; font-size: 0.95em; color: #4b5563;">${title}:</div>
                <div style="margin: 0.25rem 0 0 0; padding-left: 1.5rem; color: #6b7280; font-style: italic;">
                    ${sectionData.text} ℹ️
                </div>
            </div>`;
        }
        
        let statusIcon = sectionData.isPassed ? 
            '<span style="background: #10b981; color: white; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; margin-left: 8px; font-weight: bold;">✓</span>' : 
            '<span style="background: #ef4444; color: white; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; margin-left: 8px; font-weight: bold;">✕</span>';

        let html = `<div style="margin-bottom: 0.75rem;">
            <div style="font-weight: 600; font-size: 0.95em; color: #4b5563; display: flex; align-items: center;">
                ${title}: ${statusIcon}
            </div>
            <ul style="margin: 0.25rem 0 0 0; padding-left: 1.5rem; line-height: 1.5; list-style: none;">`;
        
        sectionData.items.forEach(item => {
            let icon = '';
            let missingHtml = '';
            if (item.isPassed === true) {
                icon = '<span style="color: #10b981; font-size: 13px; margin-left: 6px; font-weight: bold;">✓</span>';
            } else if (item.isPassed === false) {
                icon = '<span style="color: #ef4444; font-size: 13px; margin-left: 6px; font-weight: bold;">✕</span>';
                if (item.missingText) {
                    missingHtml = `<span style="color: #9ca3af; font-size: 0.85em; font-style: italic; margin-left: 6px;">(${item.missingText})</span>`;
                }
            }

            html += `<li style="margin-bottom: 4px;"><span style="color: #4b5563;">${item.label}:</span> <span style="font-weight: 700; color: #111827; margin-left: 4px;">${item.value}</span>${icon}${missingHtml}</li>`;
        });
        
        html += `</ul></div>`;
        return html;
    }

    // Helper to generate dynamic items for EXACT counts per level
    function buildItems(obj, kpmLvl = null) {
        const items = [];
        const levels = [4, 3, 2, 1, 0]; // Check all possible levels highest to lowest
        let total = 0;
        levels.forEach(lvl => {
            const count = Object.values(obj).filter(l => l === lvl).length;
            if (count > 0) {
                items.push({ label: lvl === 0 ? 'Op start niveau' : `Op niveau ${lvl}`, value: count });
                total += count;
            }
        });
        
        if (total === 0) {
            items.push({ label: 'Geen beoordelingen', value: '-' });
        }
        
        if (kpmLvl !== null) {
            const kpm = obj['kwalitatief product maken'] >= kpmLvl;
            items.push({ label: `Kwalitatief Product Maken ≥ ${kpmLvl}`, value: kpm ? 'Ja' : 'Nee' });
        }
        return items;
    }

    // Semester Requirements Map
    const reqData = {
        "j1s1": {
            title: "Jaar 1 - Semester 1 (Propedeuse Prod & Dev 1)",
            check: (v, h) => {
                const v1_total = Object.values(v).filter(l => l >= 1).length;
                const kpm = v['kwalitatief product maken'] >= 1;
                return {
                    vaardigheden: { 
                        isPassed: v1_total >= 4 && kpm, 
                        items: [
                            { label: 'Op niveau 1', value: v1_total, target: 4, isPassed: v1_total >= 4, missingText: v1_total < 4 ? `mist er ${4 - v1_total}` : '' },
                            { label: 'Kwalitatief Product Maken ≥ 1', value: kpm ? 'Ja' : 'Nee', isBooleanTarget: true, isPassed: kpm, missingText: !kpm ? 'vereist' : '' }
                        ]
                    },
                    hboi: { isInfo: true, text: 'Wordt opgeteld in Semester 2' }
                };
            }
        },
        "j1s2": {
            title: "Jaar 1 - Semester 2 (Propedeuse Prod & Dev 2)",
            check: (v, h) => {
                const v0_exact = Object.values(v).filter(l => l === 0).length; // 0 is start
                const v0_total = Object.values(v).filter(l => l >= 0).length;
                const v1_total = Object.values(v).filter(l => l >= 1).length;
                const h1_total = Object.values(h).filter(l => l >= 1).length;
                
                const v1_surplus = Math.max(0, v1_total - 7);
                const v0_eff = v0_exact + v1_surplus;
                
                const kpm = v['kwalitatief product maken'] >= 1;
                return {
                    vaardigheden: { 
                        isPassed: v1_total >= 7 && kpm && v0_total >= 9, 
                        items: [
                            { label: 'Op niveau 1', value: v1_total, target: 7, isPassed: v1_total >= 7, missingText: v1_total < 7 ? `mist er ${7 - v1_total}` : '' },
                            { label: 'Op start niveau', value: v0_exact, target: 2, isPassed: v0_eff >= 2, missingText: v0_eff < 2 ? `mist er ${2 - v0_eff}` : '' },
                            { label: 'Kwalitatief Product Maken ≥ 1', value: kpm ? 'Ja' : 'Nee', isBooleanTarget: true, isPassed: kpm, missingText: !kpm ? 'vereist' : '' }
                        ]
                    },
                    hboi: { 
                        isPassed: h1_total >= 4, 
                        items: [
                            { label: 'Op niveau 1', value: h1_total, target: 4, isPassed: h1_total >= 4, missingText: h1_total < 4 ? `mist er ${4 - h1_total}` : '' }
                        ]
                    }
                };
            }
        },
        "j2s1": {
            title: "Jaar 2 - Semester 1 (Open Projecten 1)",
            check: (v, h) => {
                const v1_exact = Object.values(v).filter(l => l === 1).length;
                const v1_total = Object.values(v).filter(l => l >= 1).length;
                const v2_total = Object.values(v).filter(l => l >= 2).length;
                const h1_total = Object.values(h).filter(l => l >= 1).length;
                
                const v2_surplus = Math.max(0, v2_total - 3);
                const v1_eff = v1_exact + v2_surplus;
                
                const kpm = v['kwalitatief product maken'] >= 1;
                return {
                    vaardigheden: { 
                        isPassed: v2_total >= 3 && v1_total >= 9 && kpm, 
                        items: [
                            { label: 'Op niveau 2', value: v2_total, target: 3, isPassed: v2_total >= 3, missingText: v2_total < 3 ? `mist er ${3 - v2_total}` : '' },
                            { label: 'Op niveau 1', value: v1_exact, target: 6, isPassed: v1_eff >= 6, missingText: v1_eff < 6 ? `mist er ${6 - v1_eff}` : '' },
                            { label: 'Kwalitatief Product Maken ≥ 1', value: kpm ? 'Ja' : 'Nee', isBooleanTarget: true, isPassed: kpm, missingText: !kpm ? 'vereist' : '' }
                        ]
                    },
                    hboi: { 
                        isPassed: h1_total >= 6, 
                        items: [
                            { label: 'Op niveau 1', value: h1_total, target: 6, isPassed: h1_total >= 6, missingText: h1_total < 6 ? `mist er ${6 - h1_total}` : '' }
                        ]
                    }
                };
            }
        },
        "j2s2": {
            title: "Jaar 2 - Semester 2 (Open Projecten 2)",
            check: (v, h) => {
                const v1_exact = Object.values(v).filter(l => l === 1).length;
                const v1_total = Object.values(v).filter(l => l >= 1).length;
                const v2_total = Object.values(v).filter(l => l >= 2).length;
                const h1_exact = Object.values(h).filter(l => l === 1).length;
                const h1_total = Object.values(h).filter(l => l >= 1).length;
                const h2_total = Object.values(h).filter(l => l >= 2).length;
                
                const v2_surplus = Math.max(0, v2_total - 7);
                const v1_eff = v1_exact + v2_surplus;
                
                const h2_surplus = Math.max(0, h2_total - 4);
                const h1_eff = h1_exact + h2_surplus;
                
                const kpm = v['kwalitatief product maken'] >= 2;
                return {
                    vaardigheden: { 
                        isPassed: v2_total >= 7 && v1_total >= 9 && kpm, 
                        items: [
                            { label: 'Op niveau 2', value: v2_total, target: 7, isPassed: v2_total >= 7, missingText: v2_total < 7 ? `mist er ${7 - v2_total}` : '' },
                            { label: 'Op niveau 1', value: v1_exact, target: 2, isPassed: v1_eff >= 2, missingText: v1_eff < 2 ? `mist er ${2 - v1_eff}` : '' },
                            { label: 'Kwalitatief Product Maken ≥ 2', value: kpm ? 'Ja' : 'Nee', isBooleanTarget: true, isPassed: kpm, missingText: !kpm ? 'vereist' : '' }
                        ]
                    },
                    hboi: { 
                        isPassed: h2_total >= 4 && h1_total >= 6, 
                        items: [
                            { label: 'Op niveau 2', value: h2_total, target: 4, isPassed: h2_total >= 4, missingText: h2_total < 4 ? `mist er ${4 - h2_total}` : '' },
                            { label: 'Op niveau 1', value: h1_exact, target: 2, isPassed: h1_eff >= 2, missingText: h1_eff < 2 ? `mist er ${2 - h1_eff}` : '' }
                        ]
                    }
                };
            }
        },
        "j3oi1": {
            title: "Jaar 3 - Open Innovation 1",
            check: (v, h) => {
                const v2_exact = Object.values(v).filter(l => l === 2).length;
                const v2_total = Object.values(v).filter(l => l >= 2).length;
                const v3_total = Object.values(v).filter(l => l >= 3).length;
                const h2_exact = Object.values(h).filter(l => l === 2).length;
                const h2_total = Object.values(h).filter(l => l >= 2).length;
                const h3_total = Object.values(h).filter(l => l >= 3).length;
                
                const v3_surplus = Math.max(0, v3_total - 1);
                const v2_eff = v2_exact + v3_surplus;
                
                const h3_surplus = Math.max(0, h3_total - 1);
                const h2_eff = h2_exact + h3_surplus;

                const kpm = v['kwalitatief product maken'] >= 2;
                return {
                    vaardigheden: { 
                        isPassed: v3_total >= 1 && v2_total >= 9 && kpm, 
                        items: [
                            { label: 'Op niveau 3', value: v3_total, target: 1, isPassed: v3_total >= 1, missingText: v3_total < 1 ? `mist er ${1 - v3_total}` : '' },
                            { label: 'Op niveau 2', value: v2_exact, target: 8, isPassed: v2_eff >= 8, missingText: v2_eff < 8 ? `mist er ${8 - v2_eff}` : '' },
                            { label: 'Kwalitatief Product Maken ≥ 2', value: kpm ? 'Ja' : 'Nee', isBooleanTarget: true, isPassed: kpm, missingText: !kpm ? 'vereist' : '' }
                        ]
                    },
                    hboi: { 
                        isPassed: h3_total >= 1 && h2_total >= 5, 
                        items: [
                            { label: 'Op niveau 3', value: h3_total, target: 1, isPassed: h3_total >= 1, missingText: h3_total < 1 ? `mist er ${1 - h3_total}` : '' },
                            { label: 'Op niveau 2', value: h2_exact, target: 4, isPassed: h2_eff >= 4, missingText: h2_eff < 4 ? `mist er ${4 - h2_eff}` : '' }
                        ]
                    }
                };
            }
        },
        "j3oi2": {
            title: "Jaar 3/4 - Open Innovation 2",
            check: (v, h) => {
                const v2_exact = Object.values(v).filter(l => l === 2).length;
                const v2_total = Object.values(v).filter(l => l >= 2).length;
                const v3_total = Object.values(v).filter(l => l >= 3).length;
                const h2_exact = Object.values(h).filter(l => l === 2).length;
                const h2_total = Object.values(h).filter(l => l >= 2).length;
                const h3_total = Object.values(h).filter(l => l >= 3).length;
                
                const v3_surplus = Math.max(0, v3_total - 3);
                const v2_eff = v2_exact + v3_surplus;
                
                const h3_surplus = Math.max(0, h3_total - 2);
                const h2_eff = h2_exact + h3_surplus;

                const kpm = v['kwalitatief product maken'] >= 3;
                return {
                    vaardigheden: { 
                        isPassed: v3_total >= 3 && v2_total >= 9 && kpm, 
                        items: [
                            { label: 'Op niveau 3', value: v3_total, target: 3, isPassed: v3_total >= 3, missingText: v3_total < 3 ? `mist er ${3 - v3_total}` : '' },
                            { label: 'Op niveau 2', value: v2_exact, target: 6, isPassed: v2_eff >= 6, missingText: v2_eff < 6 ? `mist er ${6 - v2_eff}` : '' },
                            { label: 'Kwalitatief Product Maken ≥ 3', value: kpm ? 'Ja' : 'Nee', isBooleanTarget: true, isPassed: kpm, missingText: !kpm ? 'vereist' : '' }
                        ]
                    },
                    hboi: { 
                        isPassed: h3_total >= 2 && h2_total >= 6, 
                        items: [
                            { label: 'Op niveau 3', value: h3_total, target: 2, isPassed: h3_total >= 2, missingText: h3_total < 2 ? `mist er ${2 - h3_total}` : '' },
                            { label: 'Op niveau 2', value: h2_exact, target: 4, isPassed: h2_eff >= 4, missingText: h2_eff < 4 ? `mist er ${4 - h2_eff}` : '' }
                        ]
                    }
                };
            }
        },
        "j3oi3": {
            title: "Jaar 3/4 - Open Innovation 3",
            check: (v, h) => {
                const v2_exact = Object.values(v).filter(l => l === 2).length;
                const v2_total = Object.values(v).filter(l => l >= 2).length;
                const v3_total = Object.values(v).filter(l => l >= 3).length;
                const h2_exact = Object.values(h).filter(l => l === 2).length;
                const h2_total = Object.values(h).filter(l => l >= 2).length;
                const h3_total = Object.values(h).filter(l => l >= 3).length;
                
                const v3_surplus = Math.max(0, v3_total - 5);
                const v2_eff = v2_exact + v3_surplus;
                
                const h3_surplus = Math.max(0, h3_total - 2);
                const h2_eff = h2_exact + h3_surplus;

                const kpm = v['kwalitatief product maken'] >= 3;
                return {
                    vaardigheden: { 
                        isPassed: v3_total >= 5 && v2_total >= 9 && kpm, 
                        items: [
                            { label: 'Op niveau 3', value: v3_total, target: 5, isPassed: v3_total >= 5, missingText: v3_total < 5 ? `mist er ${5 - v3_total}` : '' },
                            { label: 'Op niveau 2', value: v2_exact, target: 4, isPassed: v2_eff >= 4, missingText: v2_eff < 4 ? `mist er ${4 - v2_eff}` : '' },
                            { label: 'Kwalitatief Product Maken ≥ 3', value: kpm ? 'Ja' : 'Nee', isBooleanTarget: true, isPassed: kpm, missingText: !kpm ? 'vereist' : '' }
                        ]
                    },
                    hboi: { 
                        isPassed: h3_total >= 2 && h2_total >= 6, 
                        items: [
                            { label: 'Op niveau 3', value: h3_total, target: 2, isPassed: h3_total >= 2, missingText: h3_total < 2 ? `mist er ${2 - h3_total}` : '' },
                            { label: 'Op niveau 2', value: h2_exact, target: 4, isPassed: h2_eff >= 4, missingText: h2_eff < 4 ? `mist er ${4 - h2_eff}` : '' }
                        ]
                    }
                };
            }
        },
        "j4s2": {
            title: "Jaar 4 - Afstuderen",
            check: (v, h) => {
                const reqs = ['vakbekwaamheid', 'onderzoekend', 'interactief', 'organiserend', 'lerend'];
                let items = [];
                let allPassed = true;
                
                reqs.forEach(r => {
                    let rKey = Object.keys(h).find(k => k.includes(r));
                    let val = rKey ? h[rKey] : 0;
                    let isPassed = val >= 3; // level 3 is normally minimum level for graduation
                    
                    let textVal = 'Geen';
                    if (val === 4) textVal = 'Boven niveau';
                    else if (val === 3) textVal = 'Op niveau';
                    else if (val > 0) textVal = 'Nog niet op niveau';
                    
                    if (!isPassed) {
                        allPassed = false;
                    }
                    items.push({
                        label: r.charAt(0).toUpperCase() + r.slice(1),
                        value: textVal,
                        isBooleanTarget: true,
                        isPassed: isPassed,
                        missingText: !isPassed ? 'vereist' : ''
                    });
                });
                
                return {
                    vaardigheden: { isPassed: allPassed, items: items }
                };
            }
        }
    };
    
    // Hide Names Toggle
    const hideNamesToggle = document.getElementById('hide-names-toggle');
    if (hideNamesToggle) {
        hideNamesToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('hide-names');
            } else {
                document.body.classList.remove('hide-names');
            }
        });
    }

    // Step 3: Export Results
    btnExport.addEventListener('click', async () => {
        const selectedCheckboxes = document.querySelectorAll('.student-checkbox:checked');
        const studentNames = Array.from(selectedCheckboxes).map(cb => cb.value);
        if (studentNames.length === 0) {
            exportError.textContent = 'Please select at least one student.';
            exportError.classList.remove('hidden');
            return;
        }

        exportError.classList.add('hidden');
        resultsSection.classList.add('hidden');
        resultsSection.classList.remove('active');
        btnDownloadCsv.classList.add('hidden');
        exportResults = [];
        resultsContainer.innerHTML = '';
        
        // Define the expected order of Vaardigheden (Product, Social, Personal)
        const vaardighedenOrder = [
            'overzicht creëren', 'kritisch oordelen', 'juiste kennis ontwikkelen', 'kwalitatief product maken',
            'plannen', 'boodschap delen', 'samenwerken',
            'flexibel opstellen', 'pro-actief handelen', 'reflecteren'
        ];

        let processedCount = 0;
        showLoading(`Starting export... (0/${studentNames.length})`);

        for (const name of studentNames) {
            processedCount++;
            showLoading(`Fetching evaluations for ${name}... (${processedCount}/${studentNames.length})`);
            
            const singleStudentData = {};
            singleStudentData[name] = fetchedStudents[name];

            const payload = {
                token: globalToken,
                students: singleStudentData,
                include_reviewer: includeReviewer.checked,
                time_range: timeRange.value
            };

            if (timeRange.value === 'last') {
                payload.days = document.getElementById('tr-days')?.value;
            } else if (timeRange.value === 'between') {
                payload.start_date = document.getElementById('tr-start')?.value;
                payload.end_date = document.getElementById('tr-end')?.value;
            } else if (timeRange.value === 'since') {
                payload.start_date = document.getElementById('tr-start')?.value;
            }

            try {
                const res = await fetch('/api/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Export failed');

                if (data.results && data.results.length > 0) {
                    data.results.forEach(r => {
                        const gl = r.goal_name.toLowerCase();
                        const isV = vaardighedenOrder.some(v => gl.includes(v));
                        if (!isV) {
                            // Strip trailing numbers and whitespace for HBO-i goals
                            r.goal_name = r.goal_name.replace(/\s+\d+$/, '');
                        }
                    });

                    exportResults.push(...data.results);
                    
                    // Group results by goal for this student
                    const studentGoals = {};
                    data.results.forEach(r => {
                        if (!studentGoals[r.goal_name]) studentGoals[r.goal_name] = [];
                        studentGoals[r.goal_name].push(r);
                    });

                    // Sort evaluations by date for each goal
                    Object.keys(studentGoals).forEach(goal => {
                        studentGoals[goal].sort((a, b) => {
                            if (!a.date) return 1;
                            if (!b.date) return -1;
                            return new Date(a.date) - new Date(b.date);
                        });
                    });

                    // Group results by collection (using portfolio_id to separate distinct portfolios even if they share the same template name)
                    const collectionsMap = {};
                    data.results.forEach(r => {
                        const collId = r.portfolio_id || r.collection_name; // Fallback to name if id is missing
                        const collName = (r.collection_name && r.collection_name !== 'Unknown') ? r.collection_name : 'Overige Evaluaties';
                        
                        if (!collectionsMap[collId]) {
                            collectionsMap[collId] = {
                                name: collName,
                                results: []
                            };
                        }
                        collectionsMap[collId].results.push(r);
                    });

                    // Sort collections by most recent evaluation date descending
                    const sortedCollections = Object.keys(collectionsMap).sort((a, b) => {
                        const maxDateA = Math.max(...collectionsMap[a].results.map(r => r.date ? new Date(r.date).getTime() : 0));
                        const maxDateB = Math.max(...collectionsMap[b].results.map(r => r.date ? new Date(r.date).getTime() : 0));
                        return maxDateB - maxDateA;
                    });

                    const studentDiv = document.createElement('div');
                    studentDiv.className = 'student-result-card';
                    
                    const h3 = document.createElement('h3');
                    h3.style.display = 'flex';
                    h3.style.justifyContent = 'space-between';
                    h3.style.alignItems = 'center';
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'student-name-display';
                    nameSpan.textContent = name;
                    
                    h3.appendChild(nameSpan);
                    studentDiv.appendChild(h3);

                    sortedCollections.forEach((collId, collIndex) => {
                        const collectionObj = collectionsMap[collId];
                        const collectionName = collectionObj.name;
                        const collectionResults = collectionObj.results;
                        
                        if (collIndex > 0) {
                            const separator = document.createElement('hr');
                            separator.style.margin = '2rem 0 1rem 0';
                            separator.style.border = 'none';
                            separator.style.borderTop = '2px dashed var(--border-color)';
                            studentDiv.appendChild(separator);
                        }
                        // We will print the collection name per cycle instead of once here
                        const allGoalsList = [...new Set(collectionResults.map(r => r.goal_name))];
                        const vGoals = [];
                        let hGoals = [];

                        allGoalsList.forEach(g => {
                            const gl = g.toLowerCase();
                            const isV = vaardighedenOrder.some(v => gl.includes(v));
                            if (isV) {
                                vGoals.push(g);
                            } else {
                                hGoals.push(g);
                            }
                        });

                        // Sort Vaardigheden according to the official order
                        vGoals.sort((a, b) => {
                            const ai = vaardighedenOrder.findIndex(v => a.toLowerCase().includes(v));
                            const bi = vaardighedenOrder.findIndex(v => b.toLowerCase().includes(v));
                            return ai - bi;
                        });
                        
                        // Sort HBO-i alphabetically
                        hGoals.sort();

                        // Group results into Evaluation Sessions (by Date Day + Reviewer)
                        const sessionsMap = {};
                        collectionResults.forEach(r => {
                            const day = r.date ? new Date(r.date).toDateString() : 'unknown';
                            const reviewer = r.reviewer_name || '';
                            const key = `${day}_${reviewer}`;
                            
                            if (!sessionsMap[key]) {
                                sessionsMap[key] = {
                                    date: r.date,
                                    reviewer: reviewer,
                                    day: day,
                                    evals: {}
                                };
                            }
                            
                            if (!sessionsMap[key].evals[r.goal_name]) {
                                sessionsMap[key].evals[r.goal_name] = r;
                            } else {
                                const existingEval = parseInt(sessionsMap[key].evals[r.goal_name].evaluation);
                                const newEval = parseInt(r.evaluation);
                                if (!isNaN(newEval) && !isNaN(existingEval) && newEval > existingEval) {
                                    sessionsMap[key].evals[r.goal_name] = r;
                                }
                            }
                        });

                        const sortedSessions = Object.values(sessionsMap).sort((a, b) => {
                            if (!a.date) return 1;
                            if (!b.date) return -1;
                            return new Date(a.date) - new Date(b.date);
                        });

                        // Determine Assessment status and Assign Labels
                        let evalCounter = 1;
                        const cycles = [];
                        let currentCycle = [];

                        sortedSessions.forEach(session => {
                            const vGoalsEvaluated = vGoals.filter(g => session.evals[g]).length;
                            
                            // If it evaluates all (or nearly all) vaardigheden, it's an assessment
                            if (vGoalsEvaluated >= vGoals.length - 1 && vGoals.length > 2) {
                                session.isAssessment = true;
                                session.label = 'Assessment';
                            } else {
                                session.isAssessment = false;
                                session.label = `Eval ${evalCounter}`;
                                evalCounter++;
                            }
                            
                            currentCycle.push(session);
                            if (session.isAssessment) {
                                cycles.push(currentCycle);
                                currentCycle = [];
                                evalCounter = 1; // Reset for next group
                            }
                        });
                        if (currentCycle.length > 0) {
                            cycles.push(currentCycle);
                        }

                        // Reusable function to build a table
                        const buildTable = (title, goalList, cycleSessions, containerDiv) => {
                            const targetDiv = containerDiv || studentDiv;
                            if (goalList.length === 0) return;

                            // Only show sessions that have at least one evaluation in this table
                            const activeSessions = cycleSessions.filter(s => {
                                return goalList.some(g => s.evals[g]);
                            });

                            if (activeSessions.length === 0) return;

                            const sectionTitle = document.createElement('h4');
                            sectionTitle.textContent = title;
                            sectionTitle.style.marginTop = '1rem';
                            sectionTitle.style.marginBottom = '0.5rem';
                            sectionTitle.style.color = 'var(--text-secondary)';
                            targetDiv.appendChild(sectionTitle);

                            const table = document.createElement('table');
                            table.className = 'student-result-table';
                            
                            // Header (Empty first cell + Goals)
                            const thead = document.createElement('thead');
                            const trHead = document.createElement('tr');
                            
                            const thEmpty = document.createElement('th');
                            thEmpty.className = 'row-header-col';
                            trHead.appendChild(thEmpty);

                            goalList.forEach(g => {
                                const th = document.createElement('th');
                                th.textContent = g;
                                trHead.appendChild(th);
                            });
                            thead.appendChild(trHead);
                            table.appendChild(thead);
                            
                            const tbody = document.createElement('tbody');
                            
                            // Generate Rows (Eval 1, Eval 2, ..., Assessment) based on Sessions
                            activeSessions.forEach(session => {
                                const tr = document.createElement('tr');
                                
                                const thRow = document.createElement('th');
                                thRow.className = session.isAssessment ? 'row-header assessment-header' : 'row-header';
                                
                                let rowHeaderHtml = `<div>${session.label}</div>`;
                                let extraInfo = '';
                                if (session.reviewer && session.reviewer !== 'Unknown' && session.reviewer.toLowerCase() !== 'unknown') {
                                    extraInfo += `${session.reviewer}<br>`;
                                }
                                if (session.date) {
                                    extraInfo += `${formatDate(session.date)}`;
                                }
                                if (extraInfo) {
                                    rowHeaderHtml += `<div style="font-size: 0.85em; font-weight: normal; margin-top: 4px; line-height: 1.2;">${extraInfo}</div>`;
                                }
                                thRow.innerHTML = rowHeaderHtml;
                                
                                tr.appendChild(thRow);

                                goalList.forEach(g => {
                                    const td = document.createElement('td');
                                    const r = session.evals[g];
                                    
                                    if (r) {
                                        td.innerHTML = `<div style="text-align: center; font-weight: 700; font-size: 1.1em; color: var(--text-primary);">${r.evaluation}</div>`;
                                    } else {
                                        td.innerHTML = '<span class="empty-eval">-</span>';
                                    }

                                    if (session.isAssessment) {
                                        td.className = 'assessment-cell';
                                    }

                                    tr.appendChild(td);
                                });
                                tbody.appendChild(tr);
                            });

                            table.appendChild(tbody);
                            
                            const tableContainer = document.createElement('div');
                            tableContainer.className = 'table-container';
                            tableContainer.style.width = '100%';
                            tableContainer.style.maxWidth = '100%';
                            tableContainer.appendChild(table);
                            
                            targetDiv.appendChild(tableContainer);
                        };
                        // Reverse cycles so most recent is at top
                        cycles.reverse();

                        cycles.forEach((cycleSessions, idx) => {
                            const actualIdx = cycles.length - idx; // original chronological number
                            
                            const cycleHeader = document.createElement('h3');
                            cycleHeader.textContent = cycles.length > 1 ? `${collectionName} (Deel ${actualIdx})` : collectionName;
                            cycleHeader.style.marginTop = (idx === 0 && collIndex === 0) ? '1rem' : '0';
                            cycleHeader.style.color = 'var(--primary-color)';
                            cycleHeader.style.fontSize = '1.1rem';
                            cycleHeader.style.display = 'inline-block';
                            
                            // Create dropdown container
                            const reqContainer = document.createElement('div');
                            reqContainer.style.display = 'flex';
                            reqContainer.style.alignItems = 'center';
                            reqContainer.style.gap = '1rem';
                            reqContainer.style.marginTop = '0.5rem';
                            reqContainer.style.marginBottom = '1rem';
                            
                            const selectLabel = document.createElement('label');
                            selectLabel.textContent = 'Toon eisen voor:';
                            selectLabel.style.fontWeight = '500';
                            selectLabel.style.fontSize = '0.9rem';
                            
                            const select = document.createElement('select');
                            select.className = 'form-select';
                            select.style.width = 'auto';
                            select.style.paddingTop = '0.25rem';
                            select.style.paddingBottom = '0.25rem';
                            
                            const options = [
                                { val: 'none', text: '-- Selecteer Semester --' },
                                { val: 'j1s1', text: 'Jaar 1 - Semester 1' },
                                { val: 'j1s2', text: 'Jaar 1 - Semester 2' },
                                { val: 'j2s1', text: 'Jaar 2 - Semester 1' },
                                { val: 'j2s2', text: 'Jaar 2 - Semester 2' },
                                { val: 'j3oi1', text: 'Jaar 3 - Open Innovation 1' },
                                { val: 'j3oi2', text: 'Jaar 3/4 - Open Innovation 2' },
                                { val: 'j3oi3', text: 'Jaar 3/4 - Open Innovation 3' },
                                { val: 'j4s2', text: 'Jaar 4 - Afstuderen' }
                            ];
                            
                            // Auto-detect semester from collection name
                            let autoSelectVal = 'none';
                            const tName = collectionName.toLowerCase();
                            if (tName.includes('afstuderen')) autoSelectVal = 'j4s2';
                            else if (tName.includes('open innovation 3') || tName.includes('oi3') || tName.includes('oi 3')) autoSelectVal = 'j3oi3';
                            else if (tName.includes('open innovation 2') || tName.includes('oi2') || tName.includes('oi 2')) autoSelectVal = 'j3oi2';
                            else if (tName.includes('open innovation') || tName.includes('oi1') || tName.includes('oi 1')) autoSelectVal = 'j3oi1';
                            else if (tName.includes('open projecten')) {
                                if (tName.includes('semester 2') || tName.includes(' 2') || tName.includes('deel 2')) autoSelectVal = 'j2s2';
                                else autoSelectVal = 'j2s1';
                            } else if (tName.includes('propedeuse') || tName.includes('prod & dev') || tName.includes('prod en dev')) {
                                if (tName.includes('semester 2') || tName.includes(' 2')) autoSelectVal = 'j1s2';
                                else autoSelectVal = 'j1s1';
                            } else if (tName.includes('jaar 1') || tName.includes('year 1')) {
                                if (tName.includes('semester 2')) autoSelectVal = 'j1s2';
                                else autoSelectVal = 'j1s1';
                            } else if (tName.includes('jaar 2') || tName.includes('year 2')) {
                                if (tName.includes('semester 2')) autoSelectVal = 'j2s2';
                                else autoSelectVal = 'j2s1';
                            } else {
                                if (tName.includes('semester 2')) autoSelectVal = 'j1s2'; // generic fallback
                                else if (tName.includes('semester 1')) autoSelectVal = 'j1s1';
                            }
                            
                            options.forEach(opt => {
                                const o = document.createElement('option');
                                o.value = opt.val;
                                o.textContent = opt.text;
                                if (opt.val === autoSelectVal) {
                                    o.selected = true;
                                }
                                select.appendChild(o);
                            });
                            
                            reqContainer.appendChild(selectLabel);
                            reqContainer.appendChild(select);
                            
                            const reqTextDiv = document.createElement('div');
                            reqTextDiv.className = 'hidden';
                            reqTextDiv.style.background = '#eef2ff';
                            reqTextDiv.style.padding = '1rem';
                            reqTextDiv.style.borderRadius = '6px';
                            reqTextDiv.style.border = '1px solid #c7d2fe';
                            reqTextDiv.style.marginBottom = '1.5rem';
                            reqTextDiv.style.fontSize = '0.95rem';
                            reqTextDiv.style.color = '#3730a3';
                            reqTextDiv.style.lineHeight = '1.5';
                            
                            select.addEventListener('change', (e) => {
                                const val = e.target.value;
                                if (val === 'none') {
                                    reqTextDiv.classList.add('hidden');
                                    reqTextDiv.innerHTML = '';
                                } else {
                                    const req = reqData[val];
                                    if (req) {
                                        // Calculate current levels for this cycle
                                        const vLevels = {};
                                        const hLevels = {};
                                        
                                        vGoals.forEach(g => {
                                            let maxLevel = -1;
                                            let assessmentLevel = -1;
                                            cycleSessions.forEach(s => {
                                                if (s.evals[g]) {
                                                    let v = parseInt(s.evals[g].evaluation);
                                                    if (isNaN(v)) {
                                                        const evStr = s.evals[g].evaluation.toString().toLowerCase();
                                                        if (evStr.includes('boven niveau')) v = 4;
                                                        else if (evStr.includes('nog niet op niveau')) v = 2;
                                                        else if (evStr.includes('op niveau')) v = 3;
                                                    }
                                                    if (!isNaN(v)) {
                                                        maxLevel = Math.max(maxLevel, v);
                                                        if (s.isAssessment) assessmentLevel = v;
                                                    }
                                                }
                                            });
                                            const finalLevel = assessmentLevel > -1 ? assessmentLevel : maxLevel;
                                            if (finalLevel > -1) vLevels[g.toLowerCase()] = finalLevel;
                                        });
                                        
                                        hGoals.forEach(g => {
                                            let maxLevel = -1;
                                            let assessmentLevel = -1;
                                            cycleSessions.forEach(s => {
                                                if (s.evals[g]) {
                                                    let v = parseInt(s.evals[g].evaluation);
                                                    if (isNaN(v)) {
                                                        const evStr = s.evals[g].evaluation.toString().toLowerCase();
                                                        if (evStr.includes('boven niveau')) v = 4;
                                                        else if (evStr.includes('nog niet op niveau')) v = 2;
                                                        else if (evStr.includes('op niveau')) v = 3;
                                                    }
                                                    if (!isNaN(v)) {
                                                        if (s.isAssessment) {
                                                            assessmentLevel = v;
                                                        } else {
                                                            maxLevel = Math.max(maxLevel, v);
                                                        }
                                                    }
                                                }
                                            });
                                            const finalLevel = assessmentLevel > -1 ? assessmentLevel : maxLevel;
                                            if (finalLevel > -1) hLevels[g.toLowerCase()] = finalLevel;
                                        });
                                        
                                        const checkRes = req.check(vLevels, hLevels);
                                        
                                        if (req.id !== 'j4s2') {
                                            ['vaardigheden', 'hboi'].forEach(domain => {
                                                let section = checkRes[domain];
                                                if (!section || section.isInfo) return;
                                                
                                                let map = domain === 'vaardigheden' ? vLevels : hLevels;
                                                
                                                section.items.forEach(item => {
                                                    let match = item.label.match(/Op niveau (\d)/);
                                                    if (match) {
                                                        let lvl = parseInt(match[1]);
                                                        item.value = Object.values(map).filter(l => l === lvl).length;
                                                    } else if (item.label === 'Op start niveau') {
                                                        item.value = Object.values(map).filter(l => l === 0).length;
                                                    }
                                                });
                                
                                                let newItems = [];
                                                [3, 2, 1, 0].forEach(lvl => {
                                                    let label = lvl === 0 ? 'Op start niveau' : `Op niveau ${lvl}`;
                                                    let existingItem = section.items.find(i => i.label === label);
                                                    let count = Object.values(map).filter(l => l === lvl).length;
                                                    
                                                    if (existingItem) {
                                                        newItems.push(existingItem);
                                                    } else if (count > 0) {
                                                        newItems.push({ label: label, value: count });
                                                    }
                                                });
                                                
                                                section.items.forEach(item => {
                                                    if (!item.label.startsWith('Op niveau') && item.label !== 'Op start niveau') {
                                                        newItems.push(item);
                                                    }
                                                });
                                                
                                                section.items = newItems;
                                            });
                                        }
                                        let textHtml = '';
                                        
                                        if (checkRes.vaardigheden) {
                                            textHtml += buildRequirementsSection('Vaardigheden', checkRes.vaardigheden);
                                        }
                                        if (checkRes.hboi) {
                                            textHtml += buildRequirementsSection('HBO-i', checkRes.hboi);
                                        }

                                        // Right side: Results
                                        let resultsHtml = '';
                                        if (checkRes.vaardigheden) {
                                            resultsHtml += buildStatusSection('Vaardigheden', checkRes.vaardigheden);
                                        }
                                        if (checkRes.hboi) {
                                            resultsHtml += buildStatusSection('HBO-i', checkRes.hboi);
                                        }

                                        let layoutHtml = `<div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                                            <div style="flex: 1; min-width: 280px; padding: 1.25rem; background: rgba(255, 255, 255, 0.4); border-radius: 8px;">
                                                <div style="font-weight: 700; color: #3730a3; margin-bottom: 1rem; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px; border-bottom: 1px solid rgba(55, 48, 163, 0.2); padding-bottom: 0.5rem;">Nodig voor ${req.title}</div>
                                                ${textHtml}
                                            </div>
                                            <div style="flex: 1; min-width: 280px; padding: 1.25rem; background: rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                                <div style="font-weight: 700; color: #3730a3; margin-bottom: 1rem; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px; border-bottom: 1px solid rgba(55, 48, 163, 0.2); padding-bottom: 0.5rem;">Huidige Status Student</div>
                                                ${resultsHtml}
                                                <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(0,0,0,0.05); font-size: 0.8em; color: #6b7280; font-style: italic;">
                                                    * Let op: Dit is een benadering. Het uiteindelijke niveau wordt holistisch bepaald tijdens het assessment op basis van het gehele semester.
                                                </div>
                                            </div>
                                        </div>`;
                                        
                                        reqTextDiv.innerHTML = layoutHtml;
                                        reqTextDiv.classList.remove('hidden');
                                    }
                                }
                                
                                if (typeof updateTables === 'function') {
                                    updateTables(val);
                                }
                            });
                            
                            if (autoSelectVal !== 'none') {
                                setTimeout(() => select.dispatchEvent(new Event('change')), 10);
                            }
                            
                            studentDiv.appendChild(cycleHeader);
                            studentDiv.appendChild(reqContainer);
                            studentDiv.appendChild(reqTextDiv);
                            
                            const tablesWrapper = document.createElement('div');
                            studentDiv.appendChild(tablesWrapper);

                            var updateTables = (selectedVal) => {
                                tablesWrapper.innerHTML = '';
                                let currentHTitle = 'HBO-i';
                                let currentHGoals = [...hGoals];

                                const gradKeywords = ['vakbekwaamheid', 'onderzoekend', 'interactie', 'interactief', 'organiserend', 'lerend'];
                                
                                if (selectedVal === 'j4s2') {
                                    const hasGraduationGoals = currentHGoals.some(g => {
                                        const gl = g.toLowerCase();
                                        return gradKeywords.some(kw => gl.includes(kw)) && !gl.includes('gebruikersinteractie');
                                    });

                                    if (hasGraduationGoals) {
                                        currentHTitle = 'Leeruitkomsten';
                                        currentHGoals = currentHGoals.filter(g => {
                                            const gl = g.toLowerCase();
                                            return gradKeywords.some(kw => gl.includes(kw)) && !gl.includes('gebruikersinteractie');
                                        });
                                    }
                                } else {
                                    currentHGoals = currentHGoals.filter(g => {
                                        const gl = g.toLowerCase();
                                        const isGradGoal = gradKeywords.some(kw => gl.includes(kw)) && !gl.includes('gebruikersinteractie');
                                        return !isGradGoal;
                                    });
                                }

                                buildTable('Vaardigheden', vGoals, cycleSessions, tablesWrapper);
                                buildTable(currentHTitle, currentHGoals, cycleSessions, tablesWrapper);
                            };
                            
                            updateTables(autoSelectVal);
                            
                            // Add separator if it's not the absolute last cycle of the last collection
                            if (idx < cycles.length - 1 || collIndex < sortedCollections.length - 1) {
                                const separator = document.createElement('hr');
                                separator.style.margin = '2rem 0 1rem 0';
                                separator.style.border = 'none';
                                separator.style.borderTop = '2px dashed var(--border-color)';
                                studentDiv.appendChild(separator);
                            }
                        });

                        if (vGoals.length === 0 && hGoals.length === 0) {
                            const p = document.createElement('p');
                            p.textContent = 'No evaluations found in this collection.';
                            studentDiv.appendChild(p);
                        }
                    });

                    resultsContainer.appendChild(studentDiv);
                }
            } catch (err) {
                console.error(`Error processing ${name}:`, err);
                if (err.message.toLowerCase().includes('token expired') || err.message.toLowerCase().includes('expired during fetch')) {
                    exportError.textContent = 'Your session expired. Please refresh the page and enter a new token.';
                    exportError.classList.remove('hidden');
                    break;
                }
                // We don't abort everything for other random errors, we just log it and continue
            }
        }
        
        hideLoading();

        if (exportResults.length === 0) {
            resultsContainer.innerHTML = '<p style="text-align:center; padding: 2rem;">No evaluations found for the selected students in this time range.</p>';
        } else {
            btnDownloadCsv.classList.remove('hidden');
        }

        resultsSection.classList.remove('hidden');
        resultsSection.classList.add('active');
        if (semesterSelect) semesterSelect.disabled = false;
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    });

    // Download CSV
    btnDownloadCsv.addEventListener('click', () => {
        if (!exportResults || exportResults.length === 0) return;
        
        // Pivot data into wide format
        const dataByStudent = {};
        const allGoals = new Set();

        exportResults.forEach(r => {
            if (!dataByStudent[r.student_name]) {
                dataByStudent[r.student_name] = {};
            }
            if (!dataByStudent[r.student_name][r.goal_name]) {
                dataByStudent[r.student_name][r.goal_name] = [];
            }
            let evalStr = r.evaluation;
            if (r.reviewer_name) evalStr += ` (${r.reviewer_name})`;
            
            dataByStudent[r.student_name][r.goal_name].push(evalStr);
            allGoals.add(r.goal_name);
        });

        const sortedGoals = Array.from(allGoals).sort();
        const header = ['Student', ...sortedGoals];
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += header.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + "\r\n";

        Object.keys(dataByStudent).sort().forEach(student => {
            const row = [student];
            sortedGoals.forEach(g => {
                const evals = dataByStudent[student][g] || [];
                row.push(evals.join(', '));
            });
            csvContent += row.map(v => `"${v.replace(/"/g, '""')}"`).join(',') + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "portflow_results.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});
