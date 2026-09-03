import { Circle, Text } from "react-konva";

export function AnchorLayer({ width, height }: { width: number; height: number }) {
  return <>
    <Circle x={64} y={height / 2} radius={8} fill="#28a56a" stroke="#171717" strokeWidth={1} />
    <Text x={78} y={height / 2 - 8} text="Entrance" fontSize={11} fill="#171717" />
    <Circle x={width - 64} y={height / 2} radius={8} fill="#fbfaf6" stroke="#171717" strokeWidth={2} />
    <Text x={width - 126} y={height / 2 - 8} text="Exit" fontSize={11} fill="#171717" />
  </>;
}
