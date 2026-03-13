const { execFile } = require("child_process");

const ALLOWED_COMMANDS = new Set(["ipconfig", "whoami", "echo", "dir", "systeminfo"]);

function executeSafe(command, args = []) {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_COMMANDS.has(command.toLowerCase())) {
      reject(new Error(`Command not allowed: ${command}`));
      return;
    }

    execFile(command, args, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

module.exports = { executeSafe, ALLOWED_COMMANDS };
