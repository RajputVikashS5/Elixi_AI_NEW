import React from 'react';
import { ShieldAlert, Terminal, CheckCircle, XCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface PermissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onDeny: () => void;
  command: string;
  tier: number;
  preview?: string;
}

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  2: { label: 'Standard', color: 'text-blue-400' },
  3: { label: 'Elevated', color: 'text-yellow-400' },
  4: { label: 'Restricted', color: 'text-orange-400' },
};

export const PermissionDialog: React.FC<PermissionDialogProps> = ({
  isOpen,
  onClose,
  onApprove,
  onDeny,
  command,
  tier,
  preview,
}) => {
  const tierInfo = TIER_LABELS[tier] || { label: 'Unknown', color: 'text-elixi-muted' };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Permission Required" size="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-elixi-bg border border-elixi-border">
          <ShieldAlert size={18} className={tierInfo.color} />
          <div>
            <p className="text-sm font-medium text-elixi-text">{command}</p>
            <p className="text-xs text-elixi-muted mt-0.5">Permission tier: <span className={tierInfo.color}>{tierInfo.label}</span></p>
          </div>
        </div>

        {preview && (
          <div className="p-3 rounded-lg bg-elixi-bg border border-elixi-border">
            <div className="flex items-center gap-1.5 mb-2 text-xs text-elixi-muted">
              <Terminal size={11} />
              <span>ELIXI will:</span>
            </div>
            <p className="text-sm text-elixi-text font-mono">{preview}</p>
          </div>
        )}

        <p className="text-xs text-elixi-muted">
          ELIXI is requesting permission to perform this action. You can revoke it anytime in Settings.
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="danger" size="sm" onClick={onDeny}>
            <XCircle size={13} />
            Deny
          </Button>
          <Button size="sm" onClick={onApprove}>
            <CheckCircle size={13} />
            Approve
          </Button>
        </div>
      </div>
    </Modal>
  );
};
