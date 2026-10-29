import { uid } from './id';
import { shiftISODate, todayISO } from './dates';
import type { AppData, Project, ProjectColor, Task } from '../types';

const DAY_MS = 86_400_000;

/** Example projects and tasks, dated relative to today so the deadlines stay meaningful. */
export function buildSampleData(): AppData {
  const today = todayISO();
  const now = Date.now();
  const iso = (daysAgo: number, hour = 10, minute = 0) => {
    const d = new Date(now - daysAgo * DAY_MS);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const project = (name: string, color: ProjectColor): Project => ({
    id: uid(),
    name,
    color,
    createdAt: iso(30),
  });

  const atlas = project('Atlas API', 'blue');
  const mobile = project('Mobile App', 'orange');
  const pipeline = project('Data Pipeline', 'teal');
  const website = project('Website', 'purple');

  let order = 0;
  const task = (
    p: Project,
    title: string,
    description: string,
    dueInDays: number | null,
    daysInWork: number,
    context = '',
    comments: Array<[daysAgo: number, hour: number, minute: number, text: string]> = [],
  ): Task => ({
    id: uid(),
    projectId: p.id,
    title,
    description,
    deadline: dueInDays === null ? null : shiftISODate(today, dueInDays),
    startedAt: shiftISODate(today, -daysInWork),
    createdAt: iso(daysInWork, 9, 30),
    context,
    comments: comments.map(([daysAgo, hour, minute, text]) => ({ id: uid(), text, createdAt: iso(daysAgo, hour, minute) })),
    doneAt: null,
    order: order++,
  });

  const tasks: Task[] = [
    task(
      atlas,
      'Rate limiting for public endpoints',
      'Token bucket per API key, return 429 with Retry-After.',
      6,
      6,
      'Public endpoints are getting hammered by two integrations that retry without backoff. Add a token bucket per API key (100 req/min, burst 20), return 429 with Retry-After, and expose the remaining quota in X-RateLimit-* headers. Internal service keys stay unlimited.',
      [
        [5, 10, 12, 'Checked the gateway logs: most of the traffic comes from two keys. Limiting per key is enough for now.'],
        [2, 16, 40, 'Draft middleware is on the branch. Need to decide if limits are per key or per key and endpoint.'],
        [0, 9, 5, 'Going with per key. Endpoint-level limits can be a follow-up.'],
      ],
    ),
    task(atlas, 'Fix pagination off-by-one on /orders', 'Last page repeats the final item of the previous page.', 1, 11),
    task(atlas, 'Migrate auth to JWT refresh tokens', 'Keep the cookie path alive for two releases.', 14, 3),
    task(atlas, 'OpenAPI spec for v2', 'Generate from annotations, publish to the docs site.', 22, 1),
    task(mobile, 'Crash on rotate in Settings', 'Reproduces on Pixel 7, Android 14.', -1, 4),
    task(mobile, 'Offline mode for task list', 'Cache the last sync, queue mutations until online.', 9, 9),
    task(mobile, 'Push notification opt-in screen', 'Ask after the first completed task, not at launch.', 17, 2),
    task(pipeline, 'Backfill September events', 'Re-run ingest with the fixed schema.', 3, 14),
    task(pipeline, 'Alert on late partitions', 'Page on-call if a partition is more than 2h late.', 11, 5),
    task(pipeline, 'Dedupe users table', 'Merge by email, keep the earliest created_at.', 20, 0),
    task(website, 'Pricing page redesign', 'Three tiers, annual toggle, FAQ below.', 8, 8),
    task(website, 'Fix broken anchors in docs', 'Headings were renamed in the last release.', 2, 2),
  ];

  return { projects: [atlas, mobile, pipeline, website], tasks };
}
