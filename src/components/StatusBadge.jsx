import React from 'react';

export default function StatusBadge({ status }) {
  let color = '';
  let bgColor = '';
  let label = '';

  switch (status) {
    case 'draft':
      color = 'var(--text-secondary)';
      bgColor = 'rgba(255, 255, 255, 0.1)';
      label = 'Draft';
      break;
    case 'submitted':
      color = 'var(--accent-color)';
      bgColor = 'rgba(99, 102, 241, 0.1)';
      label = 'Submitted';
      break;
    case 'under_review':
      color = 'var(--warning-color)';
      bgColor = 'rgba(245, 158, 11, 0.1)';
      label = 'Under Review';
      break;
    case 'approved':
      color = 'var(--success-color)';
      bgColor = 'rgba(16, 185, 129, 0.1)';
      label = 'Approved';
      break;
    case 'rejected':
      color = 'var(--error-color)';
      bgColor = 'rgba(239, 68, 68, 0.1)';
      label = 'Rejected';
      break;
    default:
      color = 'white';
      bgColor = 'transparent';
      label = status;
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.25rem 0.75rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: '600',
      color: color,
      backgroundColor: bgColor,
      border: `1px solid ${color}`,
      textTransform: 'capitalize'
    }}>
      {label}
    </span>
  );
}
