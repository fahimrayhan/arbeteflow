import type { JobApplication, JobApplicationInput, JobStatus } from '../types';
import { jsonBody, request } from './client';

type ApiJob = Record<string, unknown>;

function jobFromApi(job: ApiJob): JobApplication {
  return {
    id: String(job.id),
    company: String(job.company ?? ''),
    role: String(job.role ?? ''),
    location: String(job.location ?? ''),
    status: job.status as JobStatus,
    salary: String(job.salary ?? ''),
    appliedDate: String(job.appliedDate ?? ''),
    deadline: String(job.deadline ?? ''),
    notes: String(job.notes ?? ''),
    url: String(job.url ?? ''),
    jobDescription: String(job.jobDescription ?? ''),
  };
}

export async function getJobs(): Promise<JobApplication[]> {
  const response = await request<{ jobs: ApiJob[] }>('/api/jobs');
  return response.jobs.map(jobFromApi);
}

export async function createJob(input: JobApplicationInput): Promise<JobApplication> {
  const response = await request<{ job: ApiJob }>('/api/jobs', jsonBody('POST', input));
  return jobFromApi(response.job);
}

export async function updateJob(
  jobId: string,
  input: Partial<JobApplicationInput>,
): Promise<JobApplication> {
  const response = await request<{ job: ApiJob }>(
    `/api/jobs/${encodeURIComponent(jobId)}`,
    jsonBody('PATCH', input),
  );
  return jobFromApi(response.job);
}

export async function deleteJob(jobId: string): Promise<void> {
  await request<void>(`/api/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
}
