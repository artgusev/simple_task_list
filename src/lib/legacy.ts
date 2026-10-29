import type { AppData } from '../types';

/** Where the first, server-less version of the app kept its data. */
const LEGACY_KEY = 'working-stack:v1';

/** Data left in this browser by the localStorage version, or null when there is none worth importing. */
export function readLegacyLocalData(): AppData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppData> | null;
    const projects = Array.isArray(parsed?.projects) ? parsed.projects : [];
    const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    if (projects.length === 0) return null;
    return { projects, tasks };
  } catch {
    return null;
  }
}
