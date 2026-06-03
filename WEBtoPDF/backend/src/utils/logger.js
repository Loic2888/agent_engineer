export function log(agent, ...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${agent}]`, ...args);
}

export function error(agent, ...args) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] [${agent}] ERROR`, ...args);
}
