import { useId } from 'react';
import { LOGO_PATH_D } from '@app/constants/logo-path';

interface DodoLogoProps {
  size?: number;
}

export function DodoLogo({ size = 28 }: DodoLogoProps) {
  const gradientId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="70%" stopColor="#10b943" />
        </linearGradient>
      </defs>
      <path fill={`url(#${gradientId})`} d={LOGO_PATH_D} fillRule="evenodd" />
    </svg>
  );
}
