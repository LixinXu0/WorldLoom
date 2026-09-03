import { useWorldloomStore } from "../../store/useWorldloomStore";
import { VariantCard } from "../panels/VariantCard";

export function BottomVariantTray() {
  const { project, setMode, addOptionalRoom, editorSubmode } = useWorldloomStore();
  return <footer className="variant-tray"><div className="tray-actions"><strong>Variants</strong>{editorSubmode === "edit" && project.variants.length > 0 && <button onClick={addOptionalRoom}>Add optional room</button>}</div>{project.variants.map((variant) => <VariantCard key={variant.id} variant={variant} onOpen={() => setMode("level")} />)}</footer>;
}