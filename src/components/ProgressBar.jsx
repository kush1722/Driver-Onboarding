import React from 'react';
import { Check } from 'lucide-react';

export default function ProgressBar({ currentStep, steps }) {
  return (
    <div style={{ width: '100%', marginBottom: '2rem' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        position: 'relative',
        marginBottom: '1rem'
      }}>
        {/* Background track line */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '0',
          right: '0',
          height: '2px',
          background: 'var(--surface-border)',
          transform: 'translateY(-50%)',
          zIndex: 0
        }} />
        
        {/* Active progress line */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '0',
          height: '2px',
          background: 'var(--accent-color)',
          transform: 'translateY(-50%)',
          zIndex: 0,
          transition: 'width 0.3s ease',
          width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`
        }} />

        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isPast = stepNumber < currentStep;

          return (
            <div 
              key={stepNumber}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 1,
                gap: '0.5rem'
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                background: isPast ? 'var(--accent-color)' : isActive ? 'var(--bg-color)' : 'var(--surface-color)',
                border: `2px solid ${isPast || isActive ? 'var(--accent-color)' : 'var(--surface-border)'}`,
                color: isPast ? 'white' : isActive ? 'var(--accent-color)' : 'var(--text-secondary)'
              }}>
                {isPast ? <Check size={16} /> : stepNumber}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Step Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {steps.map((step, index) => {
          const isActive = (index + 1) === currentStep;
          return (
            <div key={index} style={{
              fontSize: '0.75rem',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: isActive ? '600' : '400',
              textAlign: 'center',
              width: '60px', // Prevent label from shifting container
              marginLeft: index === 0 ? '-14px' : '0',
              marginRight: index === steps.length - 1 ? '-14px' : '0'
            }}>
              {step.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
