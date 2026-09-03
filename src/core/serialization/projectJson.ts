import type { WorldloomProject } from "../types";
import { migrateProject } from "../migration/migrateProject";

export function exportProject(project: WorldloomProject): string {
  const revisions = project.revisions.map((revision) => ({ ...revision, projectSnapshot: { ...revision.projectSnapshot, revisions: [] } }));
  return JSON.stringify({ ...project, version: "4.0.0", revisions, metadata: { ...project.metadata, updatedAt: Date.now() } }, null, 2);
}

export function importProjectJson(text: string): { ok: true; project: WorldloomProject } | { ok: false; error: string } {
  try {
    return migrateProject(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, error: "The selected file is not valid JSON." };
  }
}
