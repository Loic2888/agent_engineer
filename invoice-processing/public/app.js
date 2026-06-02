const dropZone    = document.getElementById('drop-zone');
const fileInput   = document.getElementById('file-input');
const statusBox   = document.getElementById('upload-status');
const statusText  = document.getElementById('status-text');
const resultBox   = document.getElementById('result-box');
const invoiceList = document.getElementById('invoice-list');
const refreshBtn  = document.getElementById('refresh-btn');

// Drag & drop
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
});

dropZone.addEventListener('click', e => {
  if (e.target.tagName === 'LABEL' || e.target.tagName === 'INPUT') return;
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) uploadFile(fileInput.files[0]);
});

refreshBtn.addEventListener('click', loadInvoices);

// Upload
async function uploadFile(file) {
  resultBox.className = 'result-box hidden';
  statusBox.classList.remove('hidden');
  statusText.textContent = `Analyse de "${file.name}"…`;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/invoices/upload', { method: 'POST', body: formData });
    const data = await res.json();
    statusBox.classList.add('hidden');
    showResult(res.ok, data);
    if (res.ok && data.status === 'recorded') loadInvoices();
  } catch (err) {
    statusBox.classList.add('hidden');
    showResult(false, { error: 'Erreur réseau : ' + err.message });
  } finally {
    fileInput.value = '';
  }
}

function showResult(ok, data) {
  resultBox.classList.remove('hidden', 'success', 'skipped', 'error');

  if (!ok || data.error) {
    resultBox.classList.add('error');
    resultBox.innerHTML = `<h3>Erreur</h3><p>${data.error}</p>`;
    return;
  }

  if (data.status === 'skipped') {
    resultBox.classList.add('skipped');
    resultBox.innerHTML = `<h3>Document ignoré</h3><p>${data.reason}</p>`;
    return;
  }

  const f = data.fields;
  resultBox.classList.add('success');
  resultBox.innerHTML = `
    <h3>Facture enregistrée (#${data.invoice_id})</h3>
    <table>
      <tr><td>Émetteur</td><td>${f.issuer}</td></tr>
      ${f.address ? `<tr><td>Adresse</td><td>${f.address}</td></tr>` : ''}
      <tr><td>Montant dû</td><td>${formatAmount(f.amount_due, f.currency)}</td></tr>
      <tr><td>Échéance</td><td>${f.due_date}</td></tr>
    </table>`;
}

// Invoice list
async function loadInvoices() {
  invoiceList.innerHTML = '<p class="empty-msg">Chargement…</p>';
  try {
    const res = await fetch('/invoices');
    const data = await res.json();
    renderList(data);
  } catch {
    invoiceList.innerHTML = '<p class="empty-msg">Impossible de charger les factures.</p>';
  }
}

function renderList(invoices) {
  if (!invoices.length) {
    invoiceList.innerHTML = '<p class="empty-msg">Aucune facture pour le moment.</p>';
    return;
  }

  const rows = invoices.map(inv => `
    <tr>
      <td><span class="badge">#${inv.id}</span></td>
      <td>${inv.issuer}</td>
      <td>${formatAmount(inv.amount_due, inv.currency)}</td>
      <td>${inv.due_date}</td>
      <td>${inv.file_name || '—'}</td>
      <td>${inv.created_at.slice(0, 10)}</td>
    </tr>`).join('');

  invoiceList.innerHTML = `
    <table class="invoice-table">
      <thead>
        <tr>
          <th>ID</th><th>Émetteur</th><th>Montant</th>
          <th>Échéance</th><th>Fichier</th><th>Créée le</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function formatAmount(amount, currency) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'USD' }).format(amount);
}

// Initial load
loadInvoices();
