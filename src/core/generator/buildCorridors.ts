import type {
  FieldCell,
  GameplayConstraint,
  LevelVariant,
  RoomNode,
  RouteEdge,
  Stroke,
} from "../types";
import type {
  GameplayGraph,
  GameplayNode,
  GameplayRequirement,
  GameplayRouteType,
} from "../gameplay/types";
import { sampleField } from "../field/sampleField";
import type { RandomSource } from "../geometry/seededRandom";

export type GeneratedCorridor = RouteEdge & {
  gameplayRouteType: GameplayRouteType;
  gameplayRequirement: GameplayRequirement;
  sourceGameplayRouteId?: string;
  gateNodeIds: string[];
};

export type CorridorBuildResult = {
  rooms: RoomNode[];
  edges: RouteEdge[];
  corridors: GeneratedCorridor[];
};

function roomCenter(room: RoomNode): { x: number; y: number } {
  return {
    x: room.x + room.width / 2,
    y: room.y + room.height / 2,
  };
}

function distanceToNode(room: RoomNode, node: GameplayNode): number {
  const center = roomCenter(room);
  return Math.hypot(
    center.x - node.position.x,
    center.y - node.position.y,
  );
}

function roleForGameplayNode(node: GameplayNode): RoomNode["role"] {
  switch (node.type) {
    case "start": return "entrance";
    case "goal": return "exit";
    case "encounter":
    case "boss": return "combat";
    case "reward": return "reward";
    case "branch":
    case "gate": return "junction";
    case "checkpoint": return "relief";
    default: return "transition";
  }
}

function intensityForGameplayNode(node: GameplayNode): number {
  switch (node.type) {
    case "boss": return 1;
    case "encounter": return 0.75;
    case "gate": return 0.55;
    case "reward":
    case "checkpoint": return 0.2;
    default: return 0.35;
  }
}

function createRoomForGameplayNode(
  node: GameplayNode,
  width: number,
  height: number,
): RoomNode {
  const roomWidth = node.type === "boss" ? 92 : 64;
  const roomHeight = node.type === "boss" ? 76 : 52;

  return {
    id: `GR-${node.id}`,
    role: roleForGameplayNode(node),
    x: Math.max(16, Math.min(width - roomWidth - 16, node.position.x - roomWidth / 2)),
    y: Math.max(16, Math.min(height - roomHeight - 16, node.position.y - roomHeight / 2)),
    width: roomWidth,
    height: roomHeight,
    intensity: intensityForGameplayNode(node),
    sourceStrokeIds: [],
    sourceConstraintIds: [],
    locked: node.type === "gate",
  };
}

function mapNodesToRooms(
  graph: GameplayGraph,
  initialRooms: RoomNode[],
  width: number,
  height: number,
): { rooms: RoomNode[]; roomIdByNodeId: Map<string, string> } {
  const rooms = initialRooms.map((room) => ({
    ...room,
    sourceStrokeIds: [...room.sourceStrokeIds],
    sourceConstraintIds: [...room.sourceConstraintIds],
  }));
  const roomIdByNodeId = new Map<string, string>();
  const usedRoomIds = new Set<string>();

  for (const node of graph.nodes) {
    const preferredRoom = node.type === "start"
      ? rooms.find((room) => room.role === "entrance" && !usedRoomIds.has(room.id))
      : node.type === "goal"
        ? rooms.find((room) => room.role === "exit" && !usedRoomIds.has(room.id))
        : undefined;

    const nearestRoom = [...rooms]
      .filter((room) => !usedRoomIds.has(room.id))
      .sort((a, b) => distanceToNode(a, node) - distanceToNode(b, node))[0];

    const matchedRoom = preferredRoom ?? (
      nearestRoom && distanceToNode(nearestRoom, node) <= 100
        ? nearestRoom
        : undefined
    );

    if (matchedRoom) {
      usedRoomIds.add(matchedRoom.id);
      roomIdByNodeId.set(node.id, matchedRoom.id);
    } else {
      const generatedRoom = createRoomForGameplayNode(node, width, height);
      rooms.push(generatedRoom);
      usedRoomIds.add(generatedRoom.id);
      roomIdByNodeId.set(node.id, generatedRoom.id);
    }
  }

  return { rooms, roomIdByNodeId };
}

function edgeRoleForRoute(routeType: GameplayRouteType): RouteEdge["role"] {
  switch (routeType) {
    case "optional_route":
    case "shortcut": return "optional";
    case "return_path": return "return";
    default: return "main";
  }
}

function riskForRoute(
  routeType: GameplayRouteType,
  sourceRoom: RoomNode,
  targetRoom: RoomNode,
): number {
  const baseRisk = (sourceRoom.intensity + targetRoom.intensity) / 2;
  if (routeType === "shortcut") return Math.min(1, baseRisk + 0.2);
  if (routeType === "gated_route") return Math.min(1, baseRisk + 0.1);
  if (routeType === "return_path") return Math.max(0.1, baseRisk - 0.2);
  return baseRisk;
}

function gateIdsForRoute(
  graph: GameplayGraph,
  sourceNodeId: string,
  targetNodeId: string,
): string[] {
  const connectedNodeIds = new Set([sourceNodeId, targetNodeId]);

  for (const relation of graph.relations) {
    if (
      relation.type === "blocks" ||
      relation.type === "requires" ||
      relation.type === "unlocks"
    ) {
      if (
        connectedNodeIds.has(relation.sourceNodeId) ||
        connectedNodeIds.has(relation.targetNodeId)
      ) {
        connectedNodeIds.add(relation.sourceNodeId);
        connectedNodeIds.add(relation.targetNodeId);
      }
    }
  }

  return graph.nodes
    .filter((node) => node.type === "gate" && connectedNodeIds.has(node.id))
    .map((node) => node.id);
}

function buildGameplayCorridors(
  rooms: RoomNode[],
  graph: GameplayGraph,
  width: number,
  height: number,
): CorridorBuildResult | null {
  if (graph.nodes.length === 0 || graph.routes.length === 0) return null;

  const mapped = mapNodesToRooms(graph, rooms, width, height);
  const roomById = new Map(mapped.rooms.map((room) => [room.id, room]));
  const corridors: GeneratedCorridor[] = [];

  for (const route of graph.routes) {
    const from = mapped.roomIdByNodeId.get(route.sourceNodeId);
    const to = mapped.roomIdByNodeId.get(route.targetNodeId);
    if (!from || !to || from === to) continue;

    const sourceRoom = roomById.get(from);
    const targetRoom = roomById.get(to);
    if (!sourceRoom || !targetRoom) continue;

    corridors.push({
      id: `GE-${route.id}`,
      from,
      to,
      role: edgeRoleForRoute(route.type),
      risk: riskForRoute(route.type, sourceRoom, targetRoom),
      sourceStrokeIds: [...route.sourceStrokeIds],
      sourceConstraintIds: [...new Set([
        ...sourceRoom.sourceConstraintIds,
        ...targetRoom.sourceConstraintIds,
      ])],
      gameplayRouteType: route.type,
      gameplayRequirement: route.requirement,
      sourceGameplayRouteId: route.id,
      gateNodeIds: route.type === "gated_route"
        ? gateIdsForRoute(graph, route.sourceNodeId, route.targetNodeId)
        : [],
    });
  }

  return {
    rooms: mapped.rooms,
    edges: corridors.map(({ gameplayRouteType: _type, gameplayRequirement: _requirement, sourceGameplayRouteId: _sourceId, gateNodeIds: _gateIds, ...edge }) => edge),
    corridors,
  };
}

function buildLegacyCorridors(
  rooms: RoomNode[],
  strokes: Stroke[],
  constraints: GameplayConstraint[],
  cells: FieldCell[],
  width: number,
  height: number,
  strategy: LevelVariant["strategy"],
  random: RandomSource,
): CorridorBuildResult {
  const edges: RouteEdge[] = [];

  for (let index = 1; index < rooms.length; index += 1) {
    const previous = rooms[index - 1];
    const current = rooms[index];
    edges.push({
      id: `E${index}`,
      from: previous.id,
      to: current.id,
      role: "main",
      risk: (previous.intensity + current.intensity) / 2,
      sourceStrokeIds: [...new Set([...previous.sourceStrokeIds, ...current.sourceStrokeIds])],
      sourceConstraintIds: [...new Set([...previous.sourceConstraintIds, ...current.sourceConstraintIds])],
    });
  }

  const branchStrokes = strokes.filter((stroke) => stroke.enabled && stroke.type === "branch");
  const addedRooms = [...rooms];
  const branchConstraintIds = constraints
    .filter((constraint) => constraint.target === "branching")
    .map((constraint) => constraint.id);

  branchStrokes.forEach((stroke, index) => {
    if (rooms.length < 2) return;

    const anchorIndex = Math.max(0, Math.min(
      rooms.length - 1,
      Math.floor(random.range(1, Math.max(2, rooms.length - 1))),
    ));
    const anchor = rooms[anchorIndex];
    const field = sampleField(cells, roomCenter(anchor), width, height);
    const reward = strategy === "resource" || field.relief > 0.4;
    const branchCount = strategy === "combat" ? 2 : 1;
    let previous = anchor;

    for (let step = 0; step < branchCount; step += 1) {
      const branchRoom: RoomNode = {
        id: `${reward ? "R" : "C"}B${index + 1}-${step + 1}`,
        role: reward && step === branchCount - 1 ? "reward" : "combat",
        x: Math.max(20, Math.min(width - 90, anchor.x + random.range(70, 160))),
        y: Math.max(20, Math.min(
          height - 70,
          anchor.y + random.range(step === 0 ? -110 : 45, step === 0 ? -45 : 120),
        )),
        width: reward ? 64 : 58,
        height: reward ? 44 : 50,
        intensity: reward ? 0.2 : Math.max(0.5, field.pressure),
        sourceStrokeIds: [stroke.id],
        sourceConstraintIds: branchConstraintIds,
      };

      addedRooms.push(branchRoom);
      edges.push({
        id: `B${index + 1}-${step + 1}`,
        from: previous.id,
        to: branchRoom.id,
        role: "optional",
        risk: branchRoom.intensity,
        sourceStrokeIds: [stroke.id],
        sourceConstraintIds: branchConstraintIds,
      });
      previous = branchRoom;
    }

    if (strategy === "spatial" || random.next() > 0.25) {
      const target = rooms[Math.min(rooms.length - 1, anchorIndex + 1)];
      edges.push({
        id: `BR${index + 1}`,
        from: previous.id,
        to: target.id,
        role: "return",
        risk: 0.25,
        sourceStrokeIds: [stroke.id],
        sourceConstraintIds: branchConstraintIds,
      });
    }
  });

  const corridors: GeneratedCorridor[] = edges.map((edge) => ({
    ...edge,
    sourceStrokeIds: [...edge.sourceStrokeIds],
    sourceConstraintIds: [...edge.sourceConstraintIds],
    gameplayRouteType: edge.role === "main"
      ? "main_route"
      : edge.role === "return"
        ? "return_path"
        : "optional_route",
    gameplayRequirement: edge.role === "main" ? "mandatory" : "optional",
    gateNodeIds: [],
  }));

  return { rooms: addedRooms, edges, corridors };
}

export function buildCorridors(
  rooms: RoomNode[],
  strokes: Stroke[],
  constraints: GameplayConstraint[],
  cells: FieldCell[],
  width: number,
  height: number,
  strategy: LevelVariant["strategy"],
  random: RandomSource,
  gameplayGraph?: GameplayGraph,
): CorridorBuildResult {
  if (gameplayGraph) {
    const gameplayResult = buildGameplayCorridors(
      rooms,
      gameplayGraph,
      width,
      height,
    );
    if (gameplayResult) return gameplayResult;
  }

  return buildLegacyCorridors(
    rooms,
    strokes,
    constraints,
    cells,
    width,
    height,
    strategy,
    random,
  );
}
