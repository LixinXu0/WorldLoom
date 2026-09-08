import { useEffect, useState } from "react";
import { getAssetManifest, getWebTextureUrl } from "../../assets/assetManifestClient";

// Prefer production textures; vector placeholders keep the eight existing assets recognizable offline.
export function AssetVisual({ id }: { id: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => { let alive = true; setUrl(undefined); void getAssetManifest().then(m => {
    const asset = m.assets.find(a => a.id === id);
    if (alive && asset) setUrl(getWebTextureUrl(asset) || undefined);
  }).catch(() => undefined); return () => { alive = false; }; }, [id]);
  if (url) return <img className="asset-visual" src={url} alt="" onError={() => setUrl(undefined)} />;
  const block = (x: number, y: number, w: number, h: number, light = "#b4bec4", dark = "#6e7f8b") => <g><path d={`M${x},${y} l${w},-${w/2} l${w},${w/2} l-${w},${w/2}Z`} fill={light}/><path d={`M${x},${y} l${w},${w/2} v${h} l-${w},-${w/2}Z`} fill="#8f9ea8"/><path d={`M${x+w},${y+w/2} l${w},-${w/2} v${h} l-${w},${w/2}Z`} fill={dark}/></g>;
  return <svg className="asset-visual" viewBox="0 0 120 120" aria-hidden="true">
    <path d="M8 91 60 65 112 91 60 117Z" fill="#536f42"/><path d="M8 86 60 60 112 86 60 112Z" fill="#81985b"/>
    {id === "watchtower" ? <>{block(38,36,23,58)}{block(32,30,29,12)}{[32,51,70].map((x,i)=><g key={x}>{block(x,24-Math.abs(i-1)*6,10,13)}</g>)}<path d="M63 56 72 52 72 71 63 75Z" fill="#314b62"/><path d="M50 84Q56 74 60 89V101L50 96Z" fill="#534c41"/></> :
    id === "gate" ? <>{block(23,43,13,47)}{block(72,43,13,47)}{block(23,31,38,13)}</> :
    id === "bridge" ? <><path d="M15 67 49 51 107 81 73 98Z" fill="#9d6b45"/>{[0,1,2,3,4,5].map(i=><path key={i} d={`M${20+i*11} ${69+i*5.5}l30 -15`} stroke="#503f32" strokeWidth="2"/>)}<path d="M18 67v25m55 4v16m31-32v16" stroke="#705036" strokeWidth="6"/></> :
    id === "reward_chest" ? <>{block(33,66,26,20,"#c69760","#92613d")}<path d="M34 65Q35 44 60 52L86 65 60 79Z" fill="#ba8753" stroke="#ccd0cd" strokeWidth="2"/><path d="M58 79v13" stroke="#eddb9a" strokeWidth="5"/></> :
    id === "stone_stair" ? <>{[0,1,2,3,4].map(i=><g key={i}>{block(23+i*10,88-i*10,20,10+i*3)}</g>)}</> :
    id === "barricade" ? <>{[0,1,2].map(i=><g key={i}>{block(20+i*22,67-i*10,14,29)}</g>)}</> :
    <>{block(35,84,25,10)}{block(44,67,16,18)}<path d="M52 66 48 38 56 28 66 28 73 40 68 66Z" fill="#abb6bd"/><path d="M60 30 66 28 73 40 68 66 60 70Z" fill="#788d98"/><circle cx="61" cy="23" r="9" fill="#bdc6ca"/><path d="M43 84 60 93 79 84" fill="none" stroke={id === "enemy_shrine" ? "#f26773" : "#79d99f"} strokeWidth="3"/></>}
  </svg>;
}
