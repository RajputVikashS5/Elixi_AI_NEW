import React, { useEffect, useState } from 'react';
import { Cpu, MemoryStick, HardDrive, Activity, MessageSquare, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface SystemInfo {
  cpu: number;
  ram: { used: number; total: number };
  uptime: number;
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await api.get<SystemInfo>('/api/system/info');
        setSystemInfo(res.data);
      } catch {
        // Backend may not be running yet
      }
    };
    fetchInfo();
    const interval = setInterval(fetchInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatBytes = (bytes: number) => {
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  };

  const quickActions = [
    { label: 'Start Chat', icon: MessageSquare, path: '/chat' },
    { label: 'Run Workflow', icon: Zap, path: '/automation' },
    { label: 'View Memory', icon: Activity, path: '/memory' },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-elixi-text">Dashboard</h1>
        <p className="text-sm text-elixi-muted mt-0.5">System overview and quick access</p>
      </div>

      {/* System stats */}
      <section>
        <h2 className="text-sm font-semibold text-elixi-muted uppercase tracking-wider mb-3">System</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Cpu}
            label="CPU Usage"
            value={systemInfo ? `${systemInfo.cpu.toFixed(1)}%` : '—'}
          />
          <StatCard
            icon={MemoryStick}
            label="RAM"
            value={systemInfo ? `${formatBytes(systemInfo.ram.used)} / ${formatBytes(systemInfo.ram.total)}` : '—'}
          />
          <StatCard
            icon={HardDrive}
            label="Uptime"
            value={systemInfo ? formatUptime(systemInfo.uptime) : '—'}
          />
          <StatCard
            icon={Activity}
            label="AI Engine"
            value="Connected"
            valueColor="text-green-400"
          />
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="text-sm font-semibold text-elixi-muted uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map(({ label, icon: Icon, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="flex flex-col items-center gap-2 p-4 rounded-card bg-elixi-surface border border-elixi-border hover:border-elixi-primary/50 hover:bg-elixi-primary/5 transition-all duration-200 no-drag"
            >
              <Icon size={20} className="text-elixi-primary" />
              <span className="text-xs text-elixi-muted">{label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  valueColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, valueColor = 'text-elixi-text' }) => (
  <div className="flex items-center gap-3 p-4 rounded-card bg-elixi-surface border border-elixi-border">
    <div className="w-9 h-9 rounded-lg bg-elixi-primary/10 flex items-center justify-center">
      <Icon size={16} className="text-elixi-primary" />
    </div>
    <div>
      <p className="text-xs text-elixi-muted">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${valueColor}`}>{value}</p>
    </div>
  </div>
);

export default DashboardPage;
