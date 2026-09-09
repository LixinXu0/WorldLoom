import type {
  GameplayGraph,
  GameplayNode,
  GameplayRelation,
  GameplayRoute,
} from "../../core/gameplay/types";

export type GameplayGraphLayerProps = {
  graph: GameplayGraph;
  width: number;
  height: number;

  selectedNodeIds?: string[];
  selectedRelationIds?: string[];
  selectedRouteIds?: string[];

  onSelectNode?: (
    nodeId: string,
    additive: boolean,
  ) => void;

  onSelectRelation?: (
    relationId: string,
    additive: boolean,
  ) => void;

  onSelectRoute?: (
    routeId: string,
    additive: boolean,
  ) => void;
};

function nodeRadius(
  node: GameplayNode,
): number {
  if (
    node.type === "start" ||
    node.type === "goal"
  ) {
    return 15;
  }

  if (
    node.type === "boss" ||
    node.type === "objective"
  ) {
    return 14;
  }

  return 12;
}

function nodeFill(
  node: GameplayNode,
): string {
  switch (node.type) {
    case "start":
      return "#c9ecd7";

    case "goal":
      return "#f7dfa3";

    case "encounter":
    case "boss":
      return "#f1bbb5";

    case "reward":
      return "#f8e7ad";

    case "branch":
      return "#d9cdf9";

    case "gate":
      return "#d8d4cb";

    case "checkpoint":
      return "#cfe2f3";

    case "trigger":
      return "#f4d7b4";

    case "objective":
      return "#d5e5f5";

    default:
      return "#ffffff";
  }
}

function routeStroke(
  route: GameplayRoute,
): string {
  switch (route.type) {
    case "main_route":
      return "#171717";

    case "optional_route":
      return "#686868";

    case "shortcut":
      return "#2869ff";

    case "return_path":
      return "#8a5a00";

    case "gated_route":
      return "#8a3f3f";
  }
}

function routeDash(
  route: GameplayRoute,
): string | undefined {
  switch (route.type) {
    case "optional_route":
      return "7 5";

    case "shortcut":
      return "4 4";

    case "return_path":
      return "9 4";

    case "gated_route":
      return "3 3";

    default:
      return undefined;
  }
}

function relationStroke(
  relation: GameplayRelation,
): string {
  switch (relation.type) {
    case "requires":
    case "blocks":
      return "#8a3f3f";

    case "unlocks":
    case "triggers":
      return "#8a5a00";

    case "rewards":
      return "#7a6810";

    case "reconnects":
      return "#2869ff";

    default:
      return "#686868";
  }
}

function findNode(
  graph: GameplayGraph,
  id: string,
): GameplayNode | undefined {
  return graph.nodes.find(
    (node) => node.id === id,
  );
}

export function GameplayGraphLayer({
  graph,
  width,
  height,
  selectedNodeIds = [],
  selectedRelationIds = [],
  selectedRouteIds = [],
  onSelectNode,
  onSelectRelation,
  onSelectRoute,
}: GameplayGraphLayerProps) {
  const selectedNodes =
    new Set(selectedNodeIds);

  const selectedRelations =
    new Set(selectedRelationIds);

  const selectedRoutes =
    new Set(selectedRouteIds);

  return (
    <svg
      className="gameplay-graph-layer"
      viewBox={`0 0 ${width} ${height}`}
      aria-label="Gameplay graph"
    >
      <defs>
        <marker
          id="gameplay-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M0,0 L8,4 L0,8 Z"
            fill="context-stroke"
          />
        </marker>
      </defs>

      {graph.routes.map((route) => {
        const source =
          findNode(
            graph,
            route.sourceNodeId,
          );

        const target =
          findNode(
            graph,
            route.targetNodeId,
          );

        if (!source || !target) {
          return null;
        }

        const selected =
          selectedRoutes.has(route.id);

        return (
          <g
            key={route.id}
            className={
              selected
                ? "gameplay-route selected"
                : "gameplay-route"
            }
            onPointerDown={(event) => {
              event.stopPropagation();

              onSelectRoute?.(
                route.id,
                event.shiftKey,
              );
            }}
          >
            <line
              x1={source.position.x}
              y1={source.position.y}
              x2={target.position.x}
              y2={target.position.y}
              stroke={routeStroke(route)}
              strokeWidth={
                selected ? 5 : 3
              }
              strokeDasharray={
                routeDash(route)
              }
              opacity={
                route.requirement ===
                "mandatory"
                  ? 0.9
                  : 0.55
              }
              markerEnd="url(#gameplay-arrow)"
            />

            <line
              x1={source.position.x}
              y1={source.position.y}
              x2={target.position.x}
              y2={target.position.y}
              stroke="transparent"
              strokeWidth="14"
            />
          </g>
        );
      })}

      {graph.relations.map(
        (relation) => {
          const source =
            findNode(
              graph,
              relation.sourceNodeId,
            );

          const target =
            findNode(
              graph,
              relation.targetNodeId,
            );

          if (!source || !target) {
            return null;
          }

          const selected =
            selectedRelations.has(
              relation.id,
            );

          return (
            <g
              key={relation.id}
              className={
                selected
                  ? "gameplay-relation selected"
                  : "gameplay-relation"
              }
              onPointerDown={(event) => {
                event.stopPropagation();

                onSelectRelation?.(
                  relation.id,
                  event.shiftKey,
                );
              }}
            >
              <line
                x1={source.position.x}
                y1={source.position.y}
                x2={target.position.x}
                y2={target.position.y}
                stroke={
                  relationStroke(
                    relation,
                  )
                }
                strokeWidth={
                  selected ? 3 : 2
                }
                strokeDasharray="4 4"
                opacity="0.75"
                markerEnd="url(#gameplay-arrow)"
              />

              <line
                x1={source.position.x}
                y1={source.position.y}
                x2={target.position.x}
                y2={target.position.y}
                stroke="transparent"
                strokeWidth="12"
              />
            </g>
          );
        },
      )}

      {graph.nodes.map((node) => {
        const selected =
          selectedNodes.has(node.id);

        const radius =
          nodeRadius(node);

        return (
          <g
            key={node.id}
            className={
              selected
                ? "gameplay-node selected"
                : "gameplay-node"
            }
            transform={
              `translate(${node.position.x} ${node.position.y})`
            }
            onPointerDown={(event) => {
              event.stopPropagation();

              onSelectNode?.(
                node.id,
                event.shiftKey,
              );
            }}
          >
            <circle
              r={radius}
              fill={nodeFill(node)}
              stroke={
                selected
                  ? "#2869ff"
                  : "#171717"
              }
              strokeWidth={
                selected ? 3 : 2
              }
            />

            {node.requirement ===
              "mandatory" && (
              <circle
                r={radius + 4}
                fill="none"
                stroke="#171717"
                strokeWidth="1"
                opacity="0.35"
              />
            )}

            <text
              x={radius + 7}
              y="-2"
              fontSize="11"
              fontWeight="600"
              fill="#171717"
            >
              {node.label}
            </text>

            <text
              x={radius + 7}
              y="11"
              fontSize="9"
              fill="#686868"
            >
              {node.type}
            </text>
          </g>
        );
      })}
    </svg>
  );
}