import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/StatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';

describe('StatusBadge Component', () => {
  it('renders healthy status with appropriate label', () => {
    render(<StatusBadge status="healthy" />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('renders degraded status label', () => {
    render(<StatusBadge status="degraded" />);
    expect(screen.getByText('Degraded')).toBeInTheDocument();
  });

  it('renders unhealthy status label', () => {
    render(<StatusBadge status="unhealthy" />);
    expect(screen.getByText('Unhealthy')).toBeInTheDocument();
  });

  it('renders unknown status label when status is unknown', () => {
    render(<StatusBadge status="unknown" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});

describe('SeverityBadge Component', () => {
  it('renders CRITICAL badge', () => {
    render(<SeverityBadge severity="CRITICAL" />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('renders HIGH badge', () => {
    render(<SeverityBadge severity="HIGH" />);
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('renders MEDIUM badge', () => {
    render(<SeverityBadge severity="MEDIUM" />);
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
  });
});
