import type { TimelinePoint } from "../../core/types";

function path(points: TimelinePoint[], key: "pressure" | "relief", width: number, height: number): string {
  if (points.length === 0) return "";
  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - point[key] * (height - 12) - 6;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function ExperienceTimeline({ title, points }: { title: string; points: TimelinePoint[] }) {
  const width = 286;
  const height = 70;
  return <section className="timeline-panel"><h4>{title}</h4><svg viewBox={`0 0 ${width} ${height}`} role="img"><line x1="0" y1={height - 8} x2={width} y2={height - 8} stroke="#d8d4cb" /><path d={path(points, "pressure", width, height)} fill="none" stroke="#e24a3b" strokeWidth="2" /><path d={path(points, "relief", width, height)} fill="none" stroke="#28a56a" strokeWidth="2" />{points.map((point, index) => { const x = points.length === 1 ? width / 2 : (index / Math.max(1, points.length - 1)) * width; return <g key={`${point.id}-${index}`}><circle cx={x} cy={height - 8} r={point.feedbackCategories?.length ? 4 : 2.5} fill={point.feedbackCategories?.length ? "#f2a93b" : "#171717"} /><text x={x + 3} y={height - 14} fontSize="8" fill="#686868">{point.label}</text></g>; })}</svg><div className="timeline-legend"><span className="pressure">Pressure</span><span className="relief">Relief</span></div></section>;
}