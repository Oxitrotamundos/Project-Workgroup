import React from 'react';
import { X } from 'lucide-react';
import MemberManagement from './MemberManagement';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  isOwner?: boolean;
}

const MemberModal: React.FC<MemberModalProps> = ({ isOpen, onClose, projectId, projectName, isOwner = false }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2 className="ttl">Gestión de Miembros</h2>
            <p
              style={{
                font: '400 var(--t-small)/1.3 var(--font-sans)',
                color: 'var(--ink-2)',
                margin: '4px 0 0',
              }}
            >
              {projectName}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="modal-body">
          <MemberManagement projectId={projectId} isOwner={isOwner} />
        </div>
      </div>
    </div>
  );
};

export default MemberModal;
