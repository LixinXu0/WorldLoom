import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useWorldloomStore } from "../../store/useWorldloomStore";
import { AssetVisual } from "./AssetVisual";

export function AssetLibraryPanel({ onPlaced }: { onPlaced?: () => void } = {}) {
  const { assetLibrary, placeAssetInstance, loadV4DemoScene, project } = useWorldloomStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const suppressClickRef = useRef(false);
  const categories = ["all", "Architecture", "Props", "Nature"];
  const categoryFor = (value: string) => ["structure", "cover", "traversal", "gating"].includes(value) ? "Architecture" : value === "nature" ? "Nature" : "Props";
  const visibleAssets = assetLibrary.filter((asset) => (category === "all" || categoryFor(asset.category) === category) && `${asset.name} ${asset.category}`.toLowerCase().includes(query.toLowerCase()));
  const place = (assetId: string, position?: Parameters<typeof placeAssetInstance>[1]) => { placeAssetInstance(assetId, position); onPlaced?.(); };
  const beginDrag = (assetId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const start = { x: event.clientX, y: event.clientY };
    let moved = false;
    const move = (moveEvent: PointerEvent) => {
      if (Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) > 8) moved = true;
    };
    const up = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      suppressClickRef.current = moved;
      const canvas = document.querySelector(".asset-sandbox-canvas");
      const rect = canvas?.getBoundingClientRect();
      if (moved && rect && upEvent.clientX >= rect.left && upEvent.clientX <= rect.right && upEvent.clientY >= rect.top && upEvent.clientY <= rect.bottom) {
        place(assetId, { x: ((upEvent.clientX - rect.left) / rect.width) * project.metadata.canvasWidth, y: ((upEvent.clientY - rect.top) / rect.height) * project.metadata.canvasHeight, time: Date.now() });
      }
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return <aside className="asset-library" aria-label="Asset Library">
    
    <input className="asset-search" value={query} aria-label="Search assets" placeholder="Search assets…" onChange={(event) => setQuery(event.target.value)} />
    <div className="asset-categories">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item === "all" ? "All" : item}</button>)}</div>
    <div className="asset-list">
      {visibleAssets.map((asset) => <button
        key={asset.id}
        draggable
        onDragStart={(event) => event.dataTransfer.setData("application/worldloom-asset", asset.id)}
        onPointerDown={(event) => beginDrag(asset.id, event)}
        onClick={() => {
          if (!suppressClickRef.current) place(asset.id);
        }}
      >
        <span className="asset-thumb"><AssetVisual id={asset.id} /></span>
        <strong>{asset.name}</strong>
        <small>{asset.category}</small>
      </button>)}
    </div>
    {visibleAssets.length === 0 && <p className="empty-assets">No assets in this category.</p>}
    <details className="demo-scenes"><summary>Example compositions</summary>
    <button onClick={() => loadV4DemoScene("high-ground")}>Demo A High-Ground</button>
    <button onClick={() => loadV4DemoScene("gated-recovery")}>Demo B Gated Recovery</button>
    <button onClick={() => loadV4DemoScene("optional-detour")}>Demo C Optional Detour</button>
    </details>
  </aside>;
}
