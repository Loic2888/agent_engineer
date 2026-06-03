const jobs = new Map();

export function createJob(id) {
  jobs.set(id, { id, messages: [], result: null, error: null, done: false, clients: [] });
}

export function emitMessage(jobId, text) {
  const job = jobs.get(jobId);
  if (!job) return;
  const payload = JSON.stringify({ type: 'progress', message: text });
  job.messages.push(text);
  job.clients.forEach(res => res.write(`data: ${payload}\n\n`));
}

export function finishJob(jobId, result) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.done = true;
  job.result = result;
  const payload = JSON.stringify({ type: 'done', result });
  job.clients.forEach(res => { res.write(`data: ${payload}\n\n`); res.end(); });
  setTimeout(() => jobs.delete(jobId), 120_000);
}

export function failJob(jobId, error) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.done = true;
  job.error = error;
  const payload = JSON.stringify({ type: 'error', error });
  job.clients.forEach(res => { res.write(`data: ${payload}\n\n`); res.end(); });
  setTimeout(() => jobs.delete(jobId), 120_000);
}

export function addClient(jobId, res) {
  const job = jobs.get(jobId);
  if (!job) return false;
  // Replay past messages for late connections
  job.messages.forEach(msg => res.write(`data: ${JSON.stringify({ type: 'progress', message: msg })}\n\n`));
  if (job.done) {
    const payload = job.error
      ? JSON.stringify({ type: 'error', error: job.error })
      : JSON.stringify({ type: 'done', result: job.result });
    res.write(`data: ${payload}\n\n`);
    res.end();
  } else {
    job.clients.push(res);
  }
  return true;
}

export function removeClient(jobId, res) {
  const job = jobs.get(jobId);
  if (job) job.clients = job.clients.filter(c => c !== res);
}
