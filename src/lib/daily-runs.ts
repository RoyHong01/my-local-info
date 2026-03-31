import fs from 'fs/promises';
import path from 'path';

export interface DailyRunStage {
  key: string;
  title: string;
  status: string;
  deployUrl?: string;
  steps: Record<string, string>;
}

export interface DailyRunReport {
  reportDateKst: string;
  generatedAtUtc: string;
  workflow: {
    name: string;
    repository: string;
    runId: string;
    runNumber: number;
    runAttempt: number;
    eventName: string;
    runUrl: string;
    runStartedAtUtc?: string;
    headSha?: string;
  };
  stages: DailyRunStage[];
  commits: Array<{
    sha: string;
    subject: string;
    authoredAt?: string;
    files: string[];
  }>;
  changes: {
    totalChangedFiles: number;
    dataChangedFiles: string[];
    generatedBlogPosts: string[];
    generatedLifePosts: string[];
    allChangedFiles: string[];
  };
}

export interface DailyRunIndexItem {
  date: string;
  runId: string;
  runNumber: number;
  runAttempt: number;
  eventName: string;
  runUrl: string;
  stageStatuses: Array<{ key: string; status: string }>;
  generatedBlogCount: number;
  generatedLifeCount: number;
  totalChangedFiles: number;
  generatedAtUtc: string;
}

interface DailyRunIndex {
  reports: DailyRunIndexItem[];
}

function runsDailyDir() {
  return path.join(process.cwd(), 'runs', 'daily');
}

async function safeReadJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getDailyRunIndex(): Promise<DailyRunIndexItem[]> {
  const indexPath = path.join(runsDailyDir(), 'index.json');
  const parsed = await safeReadJson<DailyRunIndex>(indexPath, { reports: [] });
  const list = Array.isArray(parsed.reports) ? parsed.reports : [];
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getDailyRunReports(limit = 30): Promise<DailyRunReport[]> {
  const index = await getDailyRunIndex();
  const targets = index.slice(0, limit);

  const reports = await Promise.all(
    targets.map(async (item) => {
      const reportPath = path.join(runsDailyDir(), `${item.date}.json`);
      return safeReadJson<DailyRunReport | null>(reportPath, null);
    })
  );

  return reports.filter((report): report is DailyRunReport => Boolean(report));
}
