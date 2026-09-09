import type { WorldloomProject } from "../types";
import type { SemanticItem } from "./semanticStyles";
import type { ResearchEventType } from "../../research/interactionLogger";

export function traceSemantic(
  type: ResearchEventType
):
  | "interpretation"
  | "spatial"
  | "question"
  | "conflict"
  | "confirmed" {
  if (/conflict|repair_started/.test(type)) {
    return "conflict";
  }

  if (
    /committed|confirmed|accepted|locked|applied/.test(type) &&
    !/unlocked/.test(type)
  ) {
    return "confirmed";
  }

  if (/clarification|question/.test(type)) {
    return "question";
  }

  if (
    /interpretation|hypothesis|role_proposed|convention_proposed|gesture_candidate/.test(
      type
    )
  ) {
    return "interpretation";
  }

  return "spatial";
}

export function semanticItemsFor(
  project: WorldloomProject
): SemanticItem[] {
  if (project.researchMode === "c1-ai-opaque") {
    return [];
  }

  const h = project.compositionHypothesis;
  const assets = project.sketchState.assetInstances;

  const hidden = new Set(
    project.hiddenSemanticItemIds ?? []
  );

  const items = (
    project.sketchState.semanticItems ?? []
  ).filter(
    (n) =>
      !hidden.has(n.id) &&
      n.status !== "hidden" &&
      assets.some((a) => a.id === n.targetId) &&
      !(
        h &&
        n.source === "demo" &&
        ["question", "reading", "uncertainty"].includes(
          n.kind
        )
      )
  );

  const question =
    h?.clarificationRequests.find(
      (q) =>
        !h.clarificationAnswers.some(
          (a) => a.requestId === q.id
        )
    );

  const target =
    assets.find((a) =>
      question?.targetSketchIds.includes(a.id)
    ) ??
    assets.find((a) =>
      project.sketchSelection.ids.includes(a.id)
    ) ??
    assets[0];

  if (
    question &&
    target &&
    !hidden.has(question.id) &&
    !items.some(
      (item) => item.id === question.id
    )
  ) {
    items.push({
      id: question.id,
      kind: "question",
      targetId: target.id,
      text: question.question,
      source: "model",
      offset: {
        x: 70,
        y: 0,
      },
    });
  }

  const candidate = assets.find((a) =>
    h?.assetRoles.some(
      (r) => r.assetInstanceId === a.id
    )
  );

  if (
    h &&
    h.status !== "committed" &&
    candidate &&
    !hidden.has(h.id + "reading") &&
    !items.some(
      (item) => item.id === h.id + "reading"
    )
  ) {
    items.push({
      id: h.id + "reading",
      kind: "reading",
      targetId: candidate.id,
      text:
        h.alternatives[0]?.summary ??
        h.summary,
      source: "model",
      offset: {
        x: 65,
        y: 60,
      },
    });
  }

  if (h?.status === "committed") {
    for (const role of h.assetRoles) {
      const asset = assets.find(
        (a) =>
          a.id === role.assetInstanceId
      );

      if (
        asset &&
        !hidden.has(
          `${h.id}-${asset.id}-commit`
        ) &&
        !items.some(
          (n) =>
            n.kind === "constraint" &&
            n.targetId === asset.id
        )
      ) {
        items.push({
          id: `${h.id}-${asset.id}-commit`,
          kind: "constraint",
          targetId: asset.id,
          text: `Committed interpretation: ${role.proposedRole}.`,
          source: "model",
          offset: {
            x: 65,
            y: 0,
          },
        });
      }
    }
  }

  for (const a of assets.filter(
    (a) => a.locked || a.preserve
  )) {
    if (
      !items.some(
        (n) =>
          n.kind === "constraint" &&
          n.targetId === a.id
      )
    ) {
      items.push({
        id: a.id + "constraint",
        kind: "constraint",
        targetId: a.id,
        text: `${a.assetDefinitionId}: ${
          a.locked
            ? "position locked"
            : "preserve exact asset, approximate placement"
        }.`,
        source: "user",
        offset: {
          x: 65,
          y: 0,
        },
      });
    }
  }

  return items;
}