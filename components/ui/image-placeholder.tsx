'use client';

import { cn } from '@/lib/utils';

type ImagePlaceholderProps = {
  label: string;
  className?: string;
  textClassName?: string;
};

export function ImagePlaceholder({ label, className, textClassName }: ImagePlaceholderProps) {
  const initial = label?.trim()?.charAt(0)?.toUpperCase() || '?';

  return (
    <div
      className={cn(
        'w-full h-full flex items-center justify-center bg-muted text-muted-foreground border border-border',
        className
      )}
      aria-hidden="true"
    >
      <span className={cn('text-5xl font-black opacity-40', textClassName)}>
        {initial}
      </span>
    </div>
  );
}

