import { Request, Response, NextFunction } from 'express';
import si from 'systeminformation';

export async function getSystemInfo(_req: Request, res: Response, next: NextFunction) {
  try {
    const [cpu, mem, time] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.time(),
    ]);

    return res.json({
      cpu: cpu.currentLoad,
      ram: {
        used: mem.used,
        total: mem.total,
        free: mem.free,
      },
      uptime: time.uptime,
      platform: process.platform,
    });
  } catch (err) {
    next(err);
  }
}

export async function getProcesses(_req: Request, res: Response, next: NextFunction) {
  try {
    const procs = await si.processes();
    // Return only top 20 by CPU, with minimal info (no sensitive data)
    const top = procs.list
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 20)
      .map(({ pid, name, cpu, mem }) => ({ pid, name, cpu, mem }));
    return res.json({ processes: top });
  } catch (err) {
    next(err);
  }
}

export async function getHealth(_req: Request, res: Response) {
  return res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}
