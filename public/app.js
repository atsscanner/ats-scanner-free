document.addEventListener("DOMContentLoaded", () => {
    // 1. DOM Elements Mapping
    const Inputs = {
        form: document.getElementById('ats-unified-form'),
        jd: document.getElementById('jd-input'),
        file: document.getElementById('cv-file-input'),
        text: document.getElementById('cv-text-input'),
        trigger: document.getElementById('submit-trigger'),
        error: document.getElementById('error-output'),
        errorText: document.getElementById('error-text'),
        results: document.getElementById('results-dashboard'),
        wrapperUpload: document.getElementById('wrapper-upload'),
        wrapperPaste: document.getElementById('wrapper-paste'),
        tabUpload: document.getElementById('tab-upload'),
        tabPaste: document.getElementById('tab-paste'),
        fileLabelStatus: document.getElementById('file-label-status')
    };

    let selectedInputMode = 'upload'; // Default state

    // 2. Interface State Management (Syncs with HTML script behavior)
    Inputs.tabUpload.addEventListener('click', () => {
        selectedInputMode = 'upload';
    });

    Inputs.tabPaste.addEventListener('click', () => {
        selectedInputMode = 'paste';
    });

    // 3. File Input Interaction & Validation
    Inputs.wrapperUpload.addEventListener('click', () => {
        Inputs.file.click();
    });

    Inputs.file.addEventListener('change', (e) => {
        const activeFile = e.target.files[0];
        if (activeFile) {
            // Update UI to show selected file name
            Inputs.fileLabelStatus.innerHTML = `Loaded payload: <span class="text-indigo-600 font-bold">${activeFile.name}</span>`;
            
            // Basic client-side validation
            if (!activeFile.name.endsWith('.docx') && activeFile.type !== 'application/pdf') {
                showError("Invalid signature format tracking. Use PDF or DOCX strictly.");
                Inputs.file.value = ""; // Reset file
                Inputs.fileLabelStatus.innerHTML = `Load target payload profile (<span class="text-rose-600 underline">Invalid File</span>)`;
            } else {
                Inputs.error.classList.add('hidden');
            }
        } else {
            Inputs.fileLabelStatus.innerHTML = `Load target payload profile (<span class="text-indigo-600 underline">PDF / DOCX</span>)`;
        }
    });

    // 4. File Encoding Helper
    function readAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }

    // 5. Dynamic List Population Helper
    function populateList(elementId, items) {
        const ul = document.getElementById(elementId);
        ul.innerHTML = ''; // Clear previous results
        
        if (!items || items.length === 0) {
            ul.innerHTML = '<li class="text-slate-400 italic text-xs">No specific vectors identified.</li>';
            return;
        }

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = "flex items-start gap-2";
            li.innerHTML = `
                <svg class="w-3 h-3 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
                </svg> 
                <span>${item}</span>
            `;
            ul.appendChild(li);
        });
    }

    // 6. UI Number Counter Animation
    function animateValue(id, start, end, duration) {
        if (start === end) {
            document.getElementById(id).textContent = end + "%";
            return;
        }
        let range = end - start;
        let current = start;
        let increment = end > start ? 1 : -1;
        let stepTime = Math.abs(Math.floor(duration / range));
        let obj = document.getElementById(id);
        let timer = setInterval(function() {
            current += increment;
            obj.textContent = current + "%";
            if (current == end) {
                clearInterval(timer);
            }
        }, stepTime);
    }

    // 7. Error Handling Helper
    function showError(message) {
        Inputs.errorText.textContent = message;
        Inputs.error.classList.remove('hidden');
        Inputs.trigger.disabled = false;
        document.getElementById('loading-spinner').classList.add('hidden');
        document.getElementById('btn-text').textContent = "Initialize Structural Evaluation";
    }

    // 8. Core Submission & Execution Engine
    Inputs.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Reset states
        Inputs.error.classList.add('hidden');
        Inputs.results.classList.add('hidden');
        Inputs.trigger.disabled = true;
        
        // Animate loaders
        document.getElementById('loading-spinner').classList.remove('hidden');
        document.getElementById('btn-text').textContent = "Processing Extraction Arrays...";

        try {
            let cvContent = "";
            let mimeType = "text/plain";
            const jdText = Inputs.jd.value.trim();

            if (!jdText) throw new Error("Target Job Profile Specifications are mandatory.");

            if (selectedInputMode === 'upload') {
                const activeFile = Inputs.file.files[0];
                if (!activeFile) throw new Error("Please upload a functional workspace asset file (PDF/DOCX).");

                if (activeFile.name.endsWith('.docx')) {
                    const arrayBuffer = await activeFile.arrayBuffer();
                    const parseResult = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    cvContent = parseResult.value;
                } else if (activeFile.type === 'application/pdf') {
                    const base64Str = await readAsBase64(activeFile);
                    cvContent = base64Str.split(',')[1];
                    mimeType = "application/pdf";
                } else {
                    throw new Error("Invalid format footprint. Engine requires PDF or DOCX files.");
                }
            } else {
                cvContent = Inputs.text.value.trim();
                if (!cvContent) throw new Error("String Input matrix cannot be empty. Please paste your document content.");
            }

            // Dispatch to API
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jdText: jdText,
                    cvType: selectedInputMode === 'upload' && mimeType === 'application/pdf' ? 'file' : 'text',
                    cvContent,
                    mimeType
                })
            });

            if (!res.ok) {
                if (res.status === 429) throw new Error("Rate restrictions met. Try subsequent interval.");
                if (res.status === 400) throw new Error("Bad Request: Verify payload format.");
                throw new Error("Upstream engine exception. Server failed to respond.");
            }

            const data = await res.json();
            
            // Map Data to UI
            document.getElementById('ui-recommendation').textContent = data.recommendation || "No evaluation data mapped.";
            populateList('ui-strengths', data.strengths);
            populateList('ui-missing', data.missingKeywords);
            
            // Reveal Dashboard
            Inputs.results.classList.remove('hidden');
            
            // Smooth scroll to results block
            Inputs.results.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Trigger score animation after UI resolves layout
            setTimeout(() => {
                animateValue("ui-score", 0, data.matchPercentage || 0, 1500);
            }, 300);

        } catch (err) {
            showError(err.message);
        } finally {
            // Restore button state
            Inputs.trigger.disabled = false;
            document.getElementById('loading-spinner').classList.add('hidden');
            document.getElementById('btn-text').textContent = "Initialize Structural Evaluation";
        }
    });
});
