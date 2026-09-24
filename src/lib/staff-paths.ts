/** Staff app URL surface. Public site stays at `/`. */
export const STAFF_BASE = "/staff";
export const STAFF_LOGIN = `${STAFF_BASE}/login`;
export const STAFF_HOME = `${STAFF_BASE}/jobs`;

export const staffPath = {
  home: STAFF_HOME,
  login: STAFF_LOGIN,
  jobs: `${STAFF_BASE}/jobs`,
  job: (id: string) => `${STAFF_BASE}/jobs/${id}`,
  jobEdit: (id: string) => `${STAFF_BASE}/jobs/${id}/edit`,
  jobNew: `${STAFF_BASE}/jobs/new`,
  approvals: `${STAFF_BASE}/approvals`,
  payouts: `${STAFF_BASE}/payouts`,
  expenses: `${STAFF_BASE}/expenses`,
  dashboard: `${STAFF_BASE}/dashboard`,
  settings: `${STAFF_BASE}/settings`,
} as const;
