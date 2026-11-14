import type { MissionStatusResponse } from '@/types';
import { apiClient } from './client';

export async function getCurrentMissionStatus(): Promise<MissionStatusResponse> {
  const { data } = await apiClient.get<MissionStatusResponse>('/missions/current');
  return data;
}
