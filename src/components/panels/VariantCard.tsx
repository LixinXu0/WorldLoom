import type { KeyboardEvent } from "react";
import type { LevelVariant } from "../../core/types";
import { useWorldloomStore } from "../../store/useWorldloomStore";

export function VariantCard({ variant, onOpen }: { variant: LevelVariant; onOpen: () => void }) {
  const { project, setActiveVariant, setWorkingVariant } = useWorldloomStore();
  const active = project.activeVariantId === variant.id;
  const working = project.workingVariantId === variant.id;
  const openVariant = () => {
    setActiveVariant(variant.id);
    onOpen();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openVariant();
    }
  };
  return <article className={`variant-card ${active ? "active" : ""}`} role="button" tabIndex={0} onClick={openVariant} onKeyDown={handleKeyDown}>
    <strong>{variant.name}{working ? " / Working" : ""}{variant.modified ? " / modified" : ""}</strong><span>{variant.strategy}</span><span>Fit {variant.intentFit}</span><span>{variant.validation.reachable ? "Reachable" : "Invalid"}</span><span>Path {variant.validation.criticalPathLength}</span><span>{variant.rooms.length} rooms / {variant.validation.optionalBranchCount} branches</span><span>{variant.revisionCount ?? project.revisions.length} revisions</span><button type="button" onClick={(event) => { event.stopPropagation(); setWorkingVariant(variant.id); }}>Set Working</button>
  </article>;
}