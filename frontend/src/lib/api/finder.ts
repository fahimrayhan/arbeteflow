import type { JobMarketHealth, JobMarketResults, JobSearchFilters } from '../types';
import { jsonBody, request } from './client';

export function getJobMarketHealth(): Promise<JobMarketHealth> {
  return request<JobMarketHealth>('/api/finder/health');
}

export function searchJobMarket(
  query: string,
  limit = 10,
  filters: JobSearchFilters = {},
): Promise<JobMarketResults> {
  return request<JobMarketResults>(
    '/api/finder/search',
    jsonBody('POST', { query, limit, ...filters }),
  );
}

export function recommendJobMarket(
  input: { limit?: number } & JobSearchFilters = {},
): Promise<JobMarketResults> {
  return request<JobMarketResults>('/api/finder/recommend', jsonBody('POST', input));
}

export function syncJobMarket(
  queries?: string[],
  limit = 30,
): Promise<{ message?: string; status: string }> {
  return request('/api/finder/sync', jsonBody('POST', { queries, limit }));
}
