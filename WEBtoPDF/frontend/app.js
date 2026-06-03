let selectedMode = null;
let selectedFiles = [];

const $ = id => document.getElementById(id);

function showSection(id) {
  ['mode-select', 'upload-section', 'progress-section', 'result-section', 'error-section'].forEach(s => {
    $(s).classList.toggle('hidden', s !== id);
  });
}

// Mode selection
document.querySelectorAll('.card[data-mode]').forEach(card => {
  card.addEventListener('click', () => {
    selectedMode = card.dataset.mode;
    selectedFiles = [];
    $('file-list').innerHTML = '';
    $('btn-convert').disabled = true;

    if (selectedMode === 'html-to-pdf') {
      $('upload-title').textContent = 'Upload HTML/CSS files';
      $('upload-hint').textContent = 'Select one .html file and optionally one or more .css files.';
      $('file-input').accept = '.html,.css';
      $('file-input').multiple = true;
    } else {
      $('upload-title').textContent = 'Upload a PDF file';
      $('upload-hint').textContent = 'Select a single .pdf file to convert to HTML+CSS.';
      $('file-input').accept = '.pdf';
      $('file-input').multiple = false;
    }
    showSection('upload-section');
  });
});

$('back-btn').addEventListener('click', () => { selectedMode = null; selectedFiles = []; showSection('mode-select'); });

// Dropzone
const dropzone = $('dropzone');
const fileInput = $('file-input');
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

function handleFiles(files) {
  selectedFiles = Array.from(files);
  const list = $('file-list');
  list.innerHTML = '';
  selectedFiles.forEach(f => {
    const li = document.createElement('li');
    li.textContent = `📎 ${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
    list.appendChild(li);
  });
  $('btn-convert').disabled = selectedFiles.length === 0;
}

// Convert
$('btn-convert').addEventListener('click', async () => {
  if (!selectedMode || selectedFiles.length === 0) return;

  $('agent-log').innerHTML = '';
  showSection('progress-section');

  const form = new FormData();
  selectedFiles.forEach(f => form.append('files', f));

  let jobId;
  try {
    const res = await fetch(`/convert?mode=${selectedMode}`, { method: 'POST', body: form });
    const data = await res.json();
    if (!data.jobId) throw new Error(data.error || 'No jobId returned');
    jobId = data.jobId;
  } catch (err) {
    $('error-box').textContent = err.message;
    showSection('error-section');
    return;
  }

  // SSE — écoute le stream d'événements
  const es = new EventSource(`/status/${jobId}`);

  es.onmessage = (e) => {
    const event = JSON.parse(e.data);

    if (event.type === 'progress') {
      appendLog(event.message);
    }

    if (event.type === 'done') {
      es.close();
      const data = event.result;

      const linksContainer = $('download-links');
      linksContainer.innerHTML = '';
      data.downloadUrls.forEach((url, i) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = data.outputFiles[i];
        a.textContent = `⬇ Download ${a.download}`;
        linksContainer.appendChild(a);
      });

      const warnBox = $('warnings-box');
      if (data.warnings && data.warnings.length > 0) {
        warnBox.textContent = '⚠ ' + data.warnings.join('\n⚠ ');
        warnBox.classList.remove('hidden');
      } else {
        warnBox.classList.add('hidden');
      }

      if (data.score !== null && data.score !== undefined) {
        $('score-badge').textContent = `Score: ${data.score}/100`;
        $('score-badge').className = 'score-badge ' + (data.score >= 80 ? 'good' : data.score >= 60 ? 'medium' : 'low');
        $('score-badge').classList.remove('hidden');
      }

      showSection('result-section');
    }

    if (event.type === 'error') {
      es.close();
      $('error-box').textContent = event.error;
      showSection('error-section');
    }
  };

  es.onerror = () => {
    es.close();
    $('error-box').textContent = 'Connection lost. Please try again.';
    showSection('error-section');
  };
});

function appendLog(message) {
  const log = $('agent-log');
  const line = document.createElement('div');
  line.className = 'log-line';
  line.textContent = message;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

// Restart buttons
[$('btn-restart'), $('btn-error-restart')].forEach(btn => {
  btn.addEventListener('click', () => { selectedMode = null; selectedFiles = []; showSection('mode-select'); });
});
