const { execFile } = require("child_process");

function openApp(appName) {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let cmd;
    let args;

    if (platform === "win32") {
      cmd = "cmd";
      args = ["/c", "start", "", appName];
    } else if (platform === "darwin") {
      cmd = "open";
      args = ["-a", appName];
    } else {
      cmd = "xdg-open";
      args = [appName];
    }

    execFile(cmd, args, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ success: true, appName });
    });
  });
}

module.exports = { openApp };
