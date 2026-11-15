'use client';
import { useEffect } from 'react';
import { useApiResource } from '@/hooks/use-api-resource';
import { DEMO_MODE } from '@/demo/config';
import type { ExperienceData } from './format';
export function useExperience() {
  const resource = useApiResource<ExperienceData>(
    DEMO_MODE ? '/experience' : null,
  );
  useEffect(() => {
    window.addEventListener('aura:updated', resource.refresh);
    return () => window.removeEventListener('aura:updated', resource.refresh);
  }, [resource.refresh]);
  return resource;
}
