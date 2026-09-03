import type { AssetDefinition } from "../core/sketch/types";

export const mockAssetLibrary: AssetDefinition[] = [
  {
    id: "watchtower",
    name: "Watchtower",
    category: "structure",
    candidateRoles: ["elevated landmark", "high-ground perch", "observation point"],
    capabilities: ["walkable-top", "vertical landmark", "elevated encounter support"],
    defaultConstraints: { movable: true, duplicable: true, replaceable: false, rotatable: true },
  },
  {
    id: "barricade",
    name: "Barricade",
    category: "cover",
    candidateRoles: ["cover", "boundary", "defensive structure"],
    capabilities: ["blocks movement", "supports cover", "shapes encounter edge"],
    defaultConstraints: { movable: true, duplicable: true, replaceable: true, rotatable: true },
  },
  {
    id: "stone_stair",
    name: "Stone Stair",
    category: "traversal",
    candidateRoles: ["vertical connector", "approach route"],
    capabilities: ["connects elevation", "supports approach", "walkable"],
    defaultConstraints: { movable: true, duplicable: false, replaceable: false, rotatable: true },
  },
  {
    id: "enemy_shrine",
    name: "Enemy Shrine",
    category: "encounter",
    candidateRoles: ["encounter source", "spawn trigger", "danger landmark"],
    capabilities: ["spawns enemies", "marks danger", "anchors encounter"],
    defaultConstraints: { movable: true, duplicable: true, replaceable: true, rotatable: true },
  },
  {
    id: "reward_chest",
    name: "Reward Chest",
    category: "reward",
    candidateRoles: ["optional reward", "objective"],
    capabilities: ["grants reward", "anchors detour", "marks objective"],
    defaultConstraints: { movable: true, duplicable: true, replaceable: true, rotatable: true },
  },
  {
    id: "gate",
    name: "Gate",
    category: "gating",
    candidateRoles: ["gating", "progression control"],
    capabilities: ["blocks until opened", "marks threshold", "supports lock-and-key pacing"],
    defaultConstraints: { movable: true, duplicable: true, replaceable: false, rotatable: true },
  },
  {
    id: "bridge",
    name: "Bridge",
    category: "traversal",
    candidateRoles: ["traversal connector", "chokepoint"],
    capabilities: ["connects gaps", "supports route choice", "creates chokepoint"],
    defaultConstraints: { movable: true, duplicable: false, replaceable: false, rotatable: true },
  },
  {
    id: "healing_shrine",
    name: "Healing Shrine",
    category: "recovery",
    candidateRoles: ["recovery", "safe node", "relief landmark"],
    capabilities: ["restores health", "anchors safe space", "signals relief"],
    defaultConstraints: { movable: true, duplicable: true, replaceable: true, rotatable: true },
  },
];

export function assetById(id: string): AssetDefinition | undefined {
  return mockAssetLibrary.find((asset) => asset.id === id);
}
