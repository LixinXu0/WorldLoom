import type { DesignRevision, WorldloomProject } from "../types";
import { createRevision } from "./createRevision";

export function restoreRevision(current: WorldloomProject, revision: DesignRevision): WorldloomProject {
  const restored = { ...revision.projectSnapshot, revisions: current.revisions, activeRevisionId: current.activeRevisionId };
  const restoreMarker = createRevision(restored, `Restored ${revision.label}`, [], undefined);
  return { ...restored, revisions: [...current.revisions, restoreMarker], activeRevisionId: restoreMarker.id, metadata: { ...restored.metadata, updatedAt: Date.now() } };
}