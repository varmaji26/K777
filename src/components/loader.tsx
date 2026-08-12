'use client';

import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface LoaderProps {
  className?: string;
}

export function Loader({ className }: LoaderProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    // Render a static placeholder on the server and initial client render
    // to avoid hydration mismatch.
    return <div className={cn(className)} />;
  }
  return (
    <div className={cn('bar-spinner', className)}>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>
  );
}
