import React from 'react';
import type { TaskStats } from './useTaskStats';

interface Props {
  stats: TaskStats;
}

const TasksFooter: React.FC<Props> = ({ stats }) => (
  <footer className="tv-footer">
    <span className="tv-footer-stat">
      Total · <span className="tv-footer-stat-val">{stats.total}</span>
    </span>
    <span className="tv-footer-stat">
      En curso · <span className="tv-footer-stat-val">{stats.inProgress}</span>
    </span>
    <span className="tv-footer-stat">
      Hechas · <span className="tv-footer-stat-val">{stats.done}</span>
    </span>
    <span className="tv-footer-stat">
      Bloqueadas · <span className="tv-footer-stat-val">{stats.blocked}</span>
    </span>
    <span className="tv-footer-stat" style={{ marginLeft: 'auto' }}>
      Esfuerzo total ·{' '}
      <span className="tv-footer-stat-val">{stats.totalHours.toLocaleString('es')} h</span>
    </span>
  </footer>
);

export default TasksFooter;
