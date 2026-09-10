import { useWorldloomStore } from "../../store/useWorldloomStore";

export function AssetLibraryPanel() {
  const { assetLibrary, placeAssetInstance, loadV4DemoScene } = useWorldloomStore();
  return <aside className="asset-library" aria-label="Asset Library">
    <h3>Asset Library</h3>
    <div className="asset-list">
      {assetLibrary.map((asset) => <button
        key={asset.id}
        draggable
        onDragStart={(event) => event.dataTransfer.setData("application/worldloom-asset", asset.id)}
        onClick={() => placeAssetInstance(asset.id)}
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
