export type SketchSemantic = "main-route" | "optional-path" | "region-contour" | "conflict-zone" | "uncertain-bypass" | "note-arrow";
export const sketchStyles: Record<SketchSemantic, {label:string; color:string; dash?:string; arrow?:boolean}> = {
  "main-route": {label:"Main route",color:"var(--text)"},
  "optional-path": {label:"Optional path",color:"var(--flow)",dash:"9 6"},
  "region-contour": {label:"Region contour",color:"var(--branch)",dash:"7 5"},
  "conflict-zone": {label:"Conflict zone",color:"var(--invalid)",dash:"9 5"},
  "uncertain-bypass": {label:"Uncertain bypass",color:"var(--warning)",dash:"7 5",arrow:true},
  "note-arrow": {label:"Note arrow",color:"var(--text)",arrow:true},
};
export function strokeStyle(value?: string) { return sketchStyles[value as SketchSemantic] ?? sketchStyles["main-route"]; }
export type SemanticItem = {
  id:string; kind:"question"|"reading"|"constraint"|"uncertainty"|"conflict";
  targetId:string; text:string; source:"demo"|"model"|"user";
  offset:{x:number;y:number};
};
