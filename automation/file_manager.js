const fs = require("fs");
const path = require("path");

function createFile(filePath, content = "") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  return { success: true, filePath };
}

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function listFiles(dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    isDirectory: entry.isDirectory(),
  }));
}

module.exports = { createFile, readFile, listFiles };
