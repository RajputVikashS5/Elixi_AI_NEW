const killPort = require('kill-port');

const ports = [3001, 5173, 8000, 8001];

async function main() {
  for (const port of ports) {
    try {
      await killPort(port, 'tcp');
      process.stdout.write(`[predev] freed tcp:${port}\n`);
    } catch {
      process.stdout.write(`[predev] tcp:${port} was not in use\n`);
    }
  }
}

main().catch((error) => {
  process.stderr.write(`[predev] failed: ${error?.message || String(error)}\n`);
  process.exit(1);
});
