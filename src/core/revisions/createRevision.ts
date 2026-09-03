import { nanoid } from "nanoid";
import type { DesignRevision, EditScope, ProjectSnapshot, WorldloomProject } from "../types";

export function createProjectSnapshot(project: WorldloomProject): ProjectSnapshot {
  return { ...project, revisions: [] };
}

export function createRevision(project: WorldloomProject, label: string, sourceEditIds: string[], scope: EditScope | undefined, beforeFit?: number, beforeValid?: boolean): DesignRevision {
  const active = project.variants.find((variant) => variant.id === project.activeVariantId) ?? project.variants[0];
  return {
    id: `REV-${nanoid(5)}`,
    parentRevisionId: project.activeRevisionId,
    label,
    timestamp: Date.now(),
    sourceEditIds,
    projectSnapshot: createProjectSnapshot(project),
    activeVariantId: project.activeVariantId,
    scope,
    affectedObjectCount: sourceEditIds.length,
    intentFitBefore: beforeFit,
    intentFitAfter: active?.intentFit,
    validationBefore: beforeValid,
    validationAfter: active?.validation.reachable,
  };
}