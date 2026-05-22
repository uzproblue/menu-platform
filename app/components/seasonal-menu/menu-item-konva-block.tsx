"use client";

import useImage from "use-image";
import { Group, Image, Rect, Text } from "react-konva";
import type { EditorMenuItemNode } from "@/lib/seasonal-menu/stage-json";

type MenuItemKonvaBlockProps = {
  node: EditorMenuItemNode;
  selected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
};

function MenuItemPhoto({
  url,
  x,
  y,
  size,
}: {
  url: string;
  x: number;
  y: number;
  size: number;
}) {
  const [image] = useImage(url, "anonymous");
  if (!image) return null;
  // eslint-disable-next-line jsx-a11y/alt-text -- Konva canvas node, not a DOM <img>
  return <Image image={image} x={x} y={y} width={size} height={size} listening={false} />;
}

export function MenuItemKonvaBlock({
  node,
  selected,
  onSelect,
  onDragEnd,
}: MenuItemKonvaBlockProps) {
  const hasImage = Boolean(node.imageUrl);
  const textX = hasImage ? 100 : 8;
  const textWidth = node.width - textX - 8;
  let textY = 8;

  return (
    <Group
      id={node.id}
      x={node.x}
      y={node.y}
      width={node.width}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onDragEnd(e.target.x(), e.target.y());
      }}
    >
      <Rect
        width={node.width}
        height={hasImage ? 120 : 90}
        fill={selected ? "#f0f9ff" : "#ffffff"}
        stroke={selected ? "#2563eb" : "#e5e7eb"}
        strokeWidth={selected ? 2 : 1}
        cornerRadius={8}
        shadowColor="#000000"
        shadowBlur={4}
        shadowOpacity={0.08}
      />
      {hasImage && node.imageUrl ? (
        <MenuItemPhoto url={node.imageUrl} x={8} y={8} size={84} />
      ) : null}
      <Text
        x={textX}
        y={textY}
        width={textWidth}
        text={node.name}
        fontSize={18}
        fontStyle="bold"
        fill="#111111"
        wrap="word"
      />
      <Text
        x={textX}
        y={(textY += 28)}
        width={textWidth}
        text={node.price}
        fontSize={16}
        fill="#333333"
      />
      {node.gramm ? (
        <Text
          x={textX}
          y={(textY += 22)}
          width={textWidth}
          text={node.gramm}
          fontSize={13}
          fill="#666666"
        />
      ) : null}
      {node.description ? (
        <Text
          x={textX}
          y={(textY += node.gramm ? 20 : 22)}
          width={textWidth}
          text={node.description}
          fontSize={13}
          fill="#444444"
          wrap="word"
        />
      ) : null}
    </Group>
  );
}
