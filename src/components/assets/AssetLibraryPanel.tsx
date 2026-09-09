import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useWorldloomStore } from "../../store/useWorldloomStore";

export function AssetLibraryPanel() {
  const { assetLibrary, placeAssetInstance, loadV4DemoScene, project } = useWorldloomStore();
  const suppressClickRef = useRef(false);
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
        placeAssetInstance(assetId, { x: ((upEvent.clientX - rect.left) / rect.width) * project.metadata.canvasWidth, y: ((upEvent.clientY - rect.top) / rect.height) * project.metadata.canvasHeight, time: Date.now() });
      }
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return <aside className="asset-library" aria-label="Asset Library">
    <h3>Asset Library</h3>
    <div className="asset-list">
      {assetLibrary.map((asset) => <button
        key={asset.id}
        draggable
        onDragStart={(event) => event.dataTransfer.setData("application/worldloom-asset", asset.id)}
        onPointerDown={(event) => beginDrag(asset.id, event)}
        onClick={() => {
          if (!suppressClickRef.current) placeAssetInstance(asset.id);
        }}
      >
        <span className="asset-thumb">{asset.name.slice(0, 2)}</span>
        <strong>{asset.name}</strong>
        <small>{asset.category}</small>
      </button>)}
    </div>
    <h4>Demo Scenes</h4>
    <button onClick={() => loadV4DemoScene("high-ground")}>Demo A High-Ground</button>
    <button onClick={() => loadV4DemoScene("gated-recovery")}>Demo B Gated Recovery</button>
    <button onClick={() => loadV4DemoScene("optional-detour")}>Demo C Optional Detour</button>
  </aside>;
}
