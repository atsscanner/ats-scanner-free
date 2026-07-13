let selectedInputMode = 'upload';

const Tabs = {
    btnUpload: document.getElementById('tab-upload'),
    btnPaste: document.getElementById('tab-paste'),
    viewUpload: document.getElementById('wrapper-upload'),
    viewPaste: document.getElementById('wrapper-paste')
};

const Inputs = {
    form: document.getElementById('ats-unified-form'),
    jd: document.getElementById('jd-input'),
    file: document.getElementById('cv-file-input'),
    text: document.getElementById('cv-text-input'),
    trigger: document.getElementById('submit-trigger'),
    error: document.getElementById('error-output'),
    results: document.getElementById('results-dashboard'),
    fileLabel: document.getElementById('file-label-status')
};

Tabs.btnUpload.addEventListener('click', () => toggleInputMode('upload'));
Tabs.btnPaste.addEventListener('click', () => toggleInputMode('paste'));
Tabs.viewUpload.addEventListener('click', () => Inputs.file.click());

Inputs.file.addEventListener('change', (e) => {
    if (e.target.files.length) {
        Inputs.fileLabel.innerHTML = `Loaded: <strong class="text-slate-900">${e.target.files[0].name}</strong>`;
    }
});

function toggleInputMode(mode) {
    selectedInputMode = mode;
    if (mode === 'upload') {
        Tabs.btnUpload.className = "py-2 px-4 text-blue-600 border-b-2 border-blue-600 focus:outline-none";
        Tabs.btnPaste.className = "py-2 px-4 text-slate-500 hover:text-slate-700 focus:outline-none";
        Tabs.viewUpload.classList.remove('hidden');
        Tabs.viewPaste.classList.add('hidden');
        Inputs.text.removeAttribute('required');
    } else {
        Tabs.btnPaste.className = "py-2 px-4 text-blue-600 border-b-2 border-blue-600 focus:outline-none";
        Tabs.btnUpload.className = "py-2 px-4 text-slate-500 hover:text-slate-700 focus:outline-none";
        Tabs.viewPaste.classList.remove('hidden');
        Tabs.viewUpload.classList.add('hidden');
        Inputs.text.setAttribute('required', 'true');
    }
}

Inputs.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    Inputs.error.classList.add('hidden');
    Inputs.results.classList.add('hidden');
    Inputs.trigger.disabled = true;
    Inputs.trigger.textContent = "Processing payload...";

    try {
        let cvContent = "";
        let mimeType = "text/plain";

        if (selectedInputMode === 'upload') {
            const activeFile = Inputs.file.files[0];
            if (!activeFile) throw new Error("Please upload a file.");

            if (activeFile.name.endsWith('.docx')) {
                const arrayBuffer = await activeFile.arrayBuffer();
                const parseResult = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                cvContent = parseResult.value;
            } else if (activeFile.type === 'application/pdf') {
                const base64Str = await readAsBase64(activeFile);
                cvContent = base64Str.split(',')[1];
                mimeType = "application/pdf";
            } else {
                throw new Error("Invalid format. Only PDF or DOCX.");
            }
        } else {
            cvContent = Inputs.text.value;
        }

        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jdText: Inputs.jd.value,
                cvType: selectedInputMode === 'upload' && mimeType === 'application/pdf' ? 'file' : 'text',
                cvContent,
                mimeType
            })
        });

        if (!res.ok) throw new Error(res.status === 429 ? "Server busy. Try again." : "Processing error.");

        const data = await res.json();
        
        document.getElementById('ui-score').textContent = `${data.matchPercentage || 0}%`;
        document.getElementById('ui-recommendation').textContent = data.recommendation || "No recommendation provided.";
        populateList('ui-strengths', data.strengths);
        populateList('ui-missing', data.missingKeywords);

        Inputs.results.classList.remove('hidden');

    } catch (err) {
        Inputs.error.textContent = err.message;
        Inputs.error.classList.remove('hidden');
    } finally {
        Inputs.trigger.disabled = false;
        Inputs.trigger.textContent = "Analyze ATS Fitment Matrix";
    }
});

function readAsBase64(file) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.readAsDataURL(file);
        r.onload = () => res(r.result);
        r.onerror = e => rej(e);
    });
}

function populateList(id, arr) {
    const el = document.getElementById(id);
    el.innerHTML = '';
    (arr && arr.length ? arr : ["None"]).forEach(txt => {
        const li = document.createElement('li');
        li.textContent = txt;
        el.appendChild(li);
    });
}
