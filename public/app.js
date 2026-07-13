const UI = {
    form: document.getElementById('ats-engine-form'),
    jdInput: document.getElementById('jd-input'),
    cvInput: document.getElementById('cv-input'),
    dropZone: document.getElementById('drop-zone'),
    fileStatus: document.getElementById('file-status-label'),
    trigger: document.getElementById('execution-trigger'),
    errorBox: document.getElementById('runtime-error-box'),
    errorMsg: document.getElementById('error-string'),
    outputGrid: document.getElementById('analysis-output-grid'),
    score: document.getElementById('ui-metric-score'),
    recommendation: document.getElementById('ui-metric-recommendation'),
    strengths: document.getElementById('ui-list-strengths'),
    missing: document.getElementById('ui-list-missing')
};

// Handle Native Drag-and-Drop Form Interactivities
UI.dropZone.addEventListener('click', () => UI.cvInput.click());
UI.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); UI.dropZone.classList.add('border-blue-500', 'bg-blue-50/10'); });
UI.dropZone.addEventListener('dragleave', () => { UI.dropZone.classList.remove('border-blue-500', 'bg-blue-50/10'); });
UI.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    UI.dropZone.classList.remove('border-blue-500', 'bg-blue-50/10');
    if (e.dataTransfer.files.length) {
        UI.cvInput.files = e.dataTransfer.files;
        handleFileSelection(e.dataTransfer.files[0]);
    }
});
UI.cvInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelection(e.target.files[0]); });

function handleFileSelection(file) {
    if (file.type !== "application/pdf") {
        alert("Validation rejection: Only standard structural PDF documents are permitted.");
        UI.cvInput.value = "";
        UI.fileStatus.innerHTML = `Drag & drop your CV here, or <span class="text-blue-600">browse files</span>`;
        return;
    }
    UI.fileStatus.innerHTML = `Selected Document Target: <strong class="text-slate-900">${file.name}</strong> (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
}

// Form Execution Orchestration
UI.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const targetFile = UI.cvInput.files[0];
    if (!targetFile) return;

    // Mutate UI state into execution loading presentation
    UI.errorBox.classList.add('hidden');
    UI.outputGrid.classList.add('hidden');
    UI.trigger.disabled = true;
    UI.trigger.textContent = "Invoking Cloud Infrastructure Workers Pipeline...";

    try {
        const base64Payload = await convertToCompressedBase64(targetFile);
        const cleanBase64 = base64Payload.split(',')[1];

        let retryAttempts = 0;
        let fetchSuccess = false;
        let apiDataResponse = null;

        // Exponential Backoff Implementation over Edge Isolates
        while (retryAttempts < 3 && !fetchSuccess) {
            const runtimeResponse = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jdText: UI.jdInput.value,
                    cvBase64: cleanBase64,
                    mimeType: targetFile.type
                })
            });

            if (runtimeResponse.status === 429) {
                retryAttempts++;
                UI.trigger.textContent = `Concurrency rate limit hit. Rescheduling backoff slot (Attempt ${retryAttempts}/3)...`;
                await new Promise(res => setTimeout(res, retryAttempts * 2500));
                continue;
            }

            if (!runtimeResponse.ok) {
                const failurePayload = await runtimeResponse.json();
                throw new Error(failurePayload.error || "Edge Processing pipeline returned an unexpected failure vector.");
            }

            apiDataResponse = await runtimeResponse.json();
            fetchSuccess = true;
        }

        if (!fetchSuccess) throw new Error("Upstream traffic conditions are saturated. Try submitting this execution request again.");

        // Mount and present analytical data down to DOM
        UI.score.textContent = `${apiDataResponse.matchPercentage}%`;
        UI.recommendation.textContent = apiDataResponse.recommendation;
        
        renderListElements(UI.strengths, apiDataResponse.strengths, "emerald");
        renderListElements(UI.missing, apiDataResponse.missing, "amber");

        UI.outputGrid.classList.remove('hidden');
        window.scrollTo({ top: UI.outputGrid.offsetTop - 40, behavior: 'smooth' });

    } catch (err) {
        UI.errorMsg.textContent = err.message;
        UI.errorBox.classList.remove('hidden');
    } finally {
        UI.trigger.disabled = false;
        UI.trigger.textContent = "Execute Engine Processing";
    }
});

// Helper: Client-Side FileReader Conversion Module
function convertToCompressedBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Helper: Custom Production Semantic DOM List Builder
function renderListElements(targetListContainer, stringArrayData, schemaColor) {
    targetListContainer.innerHTML = '';
    if (!stringArrayData || stringArrayData.length === 0) {
        targetListContainer.innerHTML = `<li class="text-xs italic text-slate-400">Zero data values returned.</li>`;
        return;
    }
    stringArrayData.forEach(textStr => {
        const itemNode = document.createElement('li');
        itemNode.className = "flex items-start text-xs text-slate-600 bg-white border border-slate-100 p-2.5 rounded-lg shadow-sm";
        itemNode.innerHTML = `
            <svg class="h-4 w-4 text-${schemaColor}-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
            </svg>
            <span>${textStr}</span>
        `;
        targetListContainer.appendChild(itemNode);
    });
}
