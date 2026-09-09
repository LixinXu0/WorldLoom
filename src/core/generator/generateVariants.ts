import type {
  FieldCell,
  GameplayConstraint,
  LevelVariant,
  RoomNode,
  RouteEdge,
  Stroke,
} from "../types";
import type { SharedLevelDesignState } from "../shared-state/types";
import { seededRandom } from "../geometry/seededRandom";
import { buildMainPath } from "./buildTopology";
import { placeRooms, separateRooms } from "./placeRooms";
import { buildCorridors } from "./buildCorridors";
import { validateReachability } from "../validator/validateReachability";
import { calculateIntentFit } from "../validator/calculateIntentFit";

const names: Record<LevelVariant["strategy"], string> = {
  spatial: "Variant A",
  combat: "Variant B",
  resource: "Variant C",
};

export type LocalRegenerationOptions = {
  mode: "full" | "local";
  previousVariants?: LevelVariant[];
  targetRoomIds?: string[];
  targetEdgeIds?: string[];
  targetSceneElementIds?: string[];
  targetGameplayNodeIds?: string[];
  lockedRoomIds?: string[];
  lockedEdgeIds?: string[];
};

export type GenerateVariantsOptions = {
  sharedState?: SharedLevelDesignState;
  regeneration?: LocalRegenerationOptions;
};

function cloneRoom(room: RoomNode): RoomNode {
  return {
    ...room,
    sourceStrokeIds: [...room.sourceStrokeIds],
    sourceConstraintIds: [...room.sourceConstraintIds],
  };
}

function cloneEdge(edge: RouteEdge): RouteEdge {
  return {
    ...edge,
    sourceStrokeIds: [...edge.sourceStrokeIds],
    sourceConstraintIds: [...edge.sourceConstraintIds],
  };
}

function distanceBetweenRoomAndPoint(
  room: RoomNode,
  point: { x: number; y: number },
): number {
  return Math.hypot(
    room.x + room.width / 2 - point.x,
    room.y + room.height / 2 - point.y,
  );
}

function lockedGameplayNodeIds(
  sharedState: SharedLevelDesignState | undefined,
  regeneration: LocalRegenerationOptions,
): Set<string> {
  const ids = new Set(
    regeneration.targetGameplayNodeIds ?? [],
  );

  if (!sharedState) return ids;

  const preservedElementIds = new Set([
    ...sharedState.scene.elements
      .filter((element) => element.preserved)
      .map((element) => element.id),
    ...sharedState.spatial.constraints
      .filter(
        (constraint) =>
          constraint.enabled &&
          constraint.status === "committed" &&
          (
            constraint.mode === "exact" ||
            constraint.preserveOnRegeneration
          ),
      )
      .map(
        (constraint) =>
          constraint.targetElementId,
      ),
  ]);

  for (const node of sharedState.gameplay.graph.nodes) {
    if (
      [...node.sourceObjectIds, ...node.sourceAssetIds]
        .some((id) => preservedElementIds.has(id))
    ) {
      ids.add(node.id);
    }
  }

  return ids;
}

function resolveLockedRoomIds(
  previous: LevelVariant,
  sharedState: SharedLevelDesignState | undefined,
  regeneration: LocalRegenerationOptions,
): Set<string> {
  const ids = new Set(regeneration.lockedRoomIds ?? []);

  for (const room of previous.rooms) {
    if (room.locked || room.manual) ids.add(room.id);
  }

  if (!sharedState) return ids;

  const nodeIds = lockedGameplayNodeIds(
    sharedState,
    regeneration,
  );

  for (const node of sharedState.gameplay.graph.nodes) {
    if (!nodeIds.has(node.id)) continue;

    const generatedRoomId = `GR-${node.id}`;
    const generatedRoom = previous.rooms.find(
      (room) => room.id === generatedRoomId,
    );

    if (generatedRoom) {
      ids.add(generatedRoom.id);
      continue;
    }

    const nearestRoom = [...previous.rooms].sort(
      (a, b) =>
        distanceBetweenRoomAndPoint(a, node.position) -
        distanceBetweenRoomAndPoint(b, node.position),
    )[0];

    if (
      nearestRoom &&
      distanceBetweenRoomAndPoint(
        nearestRoom,
        node.position,
      ) <= 100
    ) {
      ids.add(nearestRoom.id);
    }
  }

  return ids;
}

function mergeRoomsForLocalRegeneration(
  generated: RoomNode[],
  previous: LevelVariant,
  sharedState: SharedLevelDesignState | undefined,
  regeneration: LocalRegenerationOptions,
): RoomNode[] {
  const targetIds = new Set(
    regeneration.targetRoomIds ?? [],
  );
  const lockedIds = resolveLockedRoomIds(
    previous,
    sharedState,
    regeneration,
  );
  const generatedById = new Map(
    generated.map((room) => [room.id, cloneRoom(room)]),
  );

  for (const room of previous.rooms) {
    const isOutsideExplicitScope =
      targetIds.size > 0 && !targetIds.has(room.id);

    if (
      lockedIds.has(room.id) ||
      isOutsideExplicitScope
    ) {
      generatedById.set(room.id, cloneRoom(room));
    }
  }

  return [...generatedById.values()];
}

function mergeEdgesForLocalRegeneration(
  generated: RouteEdge[],
  previous: LevelVariant,
  preservedRoomIds: Set<string>,
  regeneration: LocalRegenerationOptions,
): RouteEdge[] {
  const targetIds = new Set(
    regeneration.targetEdgeIds ?? [],
  );
  const lockedIds = new Set(
    regeneration.lockedEdgeIds ?? [],
  );
  const generatedById = new Map(
    generated.map((edge) => [edge.id, cloneEdge(edge)]),
  );

  for (const edge of previous.edges) {
    const isOutsideExplicitScope =
      targetIds.size > 0 && !targetIds.has(edge.id);
    const connectsPreservedRooms =
      preservedRoomIds.has(edge.from) &&
      preservedRoomIds.has(edge.to);

    if (
      lockedIds.has(edge.id) ||
      isOutsideExplicitScope ||
      connectsPreservedRooms
    ) {
      generatedById.set(edge.id, cloneEdge(edge));
    }
  }

  return [...generatedById.values()];
}

function applyLocalRegeneration(
  generated: LevelVariant,
  previous: LevelVariant | undefined,
  strokes: Stroke[],
  sharedState: SharedLevelDesignState | undefined,
  regeneration: LocalRegenerationOptions | undefined,
): LevelVariant {
  if (
    !previous ||
    !regeneration ||
    regeneration.mode !== "local"
  ) {
    return generated;
  }

  const rooms = mergeRoomsForLocalRegeneration(
    generated.rooms,
    previous,
    sharedState,
    regeneration,
  );
  const previousRoomIds = new Set(
    previous.rooms.map((room) => room.id),
  );
  const targetRoomIds = new Set(
    regeneration.targetRoomIds ?? [],
  );
  const preservedRoomIds = new Set(
    rooms
      .filter(
        (room) =>
          previousRoomIds.has(room.id) &&
          (
            targetRoomIds.size === 0 ||
            !targetRoomIds.has(room.id) ||
            room.locked ||
            room.manual
          ),
      )
      .map((room) => room.id),
  );
  const edges = mergeEdgesForLocalRegeneration(
    generated.edges,
    previous,
    preservedRoomIds,
    regeneration,
  ).filter(
    (edge) =>
      rooms.some((room) => room.id === edge.from) &&
      rooms.some((room) => room.id === edge.to),
  );
  const validation = validateReachability(rooms, edges);
  const intentFitBreakdown = calculateIntentFit(
    {
      rooms,
      edges,
      strategy: generated.strategy,
    },
    strokes,
  );

  return {
    ...generated,
    rooms,
    edges,
    validation,
    intentFit: intentFitBreakdown.total,
    intentFitBreakdown,
    modified: true,
    revisionCount:
      (previous.revisionCount ?? 0) + 1,
  };
}

export function generateVariants(
  strokes: Stroke[],
  constraints: GameplayConstraint[],
  cells: FieldCell[],
  seed: number,
  width: number,
  height: number,
  options: GenerateVariantsOptions = {},
): LevelVariant[] {
  const gameplayGraph =
    options.sharedState?.gameplay.graph;
  const spatialConstraints =
    options.sharedState?.spatial.constraints ?? [];

  return (
    ["spatial", "combat", "resource"] as const
  ).map((strategy, index) => {
    const random = seededRandom(
      seed + index * 9973,
    );
    const topology = buildMainPath(
      strokes,
      constraints,
      width,
      height,
      gameplayGraph,
      spatialConstraints,
    );
    const mainRooms = separateRooms(
      placeRooms(
        topology,
        cells,
        width,
        height,
        strategy,
        random,
        constraints,
      ),
    );
    const { rooms, edges } = buildCorridors(
      mainRooms,
      strokes,
      constraints,
      cells,
      width,
      height,
      strategy,
      random,
      gameplayGraph,
    );
    const validation = validateReachability(
      rooms,
      edges,
    );

    const hasGameplayPath = Boolean(
      gameplayGraph &&
      gameplayGraph.nodes.some(
        (node) => node.type === "start",
      ) &&
      gameplayGraph.nodes.some(
        (node) => node.type === "goal",
      ),
    );

    if (
      !hasGameplayPath &&
      !strokes.some(
        (stroke) =>
          stroke.enabled && stroke.type === "flow",
      )
    ) {
      validation.warnings.push(
        "No Gameplay path or Flow stroke supplied; generated from the default entrance-to-exit path.",
      );
    }

    const intentFitBreakdown = calculateIntentFit(
      { rooms, edges, strategy },
      strokes,
    );
    const generated: LevelVariant = {
      id: `variant-${strategy}`,
      name: names[strategy],
      strategy,
      seed,
      rooms,
      edges,
      validation,
      intentFit: intentFitBreakdown.total,
      intentFitBreakdown,
    };
    const previous =
      options.regeneration?.previousVariants?.find(
        (variant) => variant.id === generated.id,
      );

    return applyLocalRegeneration(
      generated,
      previous,
      strokes,
      options.sharedState,
      options.regeneration,
    );
  });
}
