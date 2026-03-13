const si = require("systeminformation");

async function getSystemInfo() {
  const [cpu, mem, osInfo] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.osInfo(),
  ]);

  return {
    cpu: { load: cpu.currentLoad },
    memory: {
      total: mem.total,
      used: mem.used,
      free: mem.free,
    },
    os: {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
    },
  };
}

module.exports = { getSystemInfo };
