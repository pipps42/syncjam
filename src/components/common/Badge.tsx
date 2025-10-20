import { type ReactNode } from 'react';
import './Badge.css';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'premium' | 'default';
  size?: 'sm' | 'md';
  children: ReactNode;
  className?: string;
}

export function Badge({
  variant = 'default',
  size = 'md',
  className = '',
  children
}: BadgeProps) {
  const classes = [
    'badge',
    `badge-${variant}`,
    `badge-${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      {children}
    </span>
  );
}
