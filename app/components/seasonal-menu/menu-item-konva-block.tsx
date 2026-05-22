"use client";

import useImage from "use-image";
import { Group, Image, Rect, Text } from "react-konva";
import { toCanvasMenuImageProxyUrl } from "@/lib/menu-image-proxy";
import type { EditorMenuItemNode } from "@/lib/seasonal-menu/stage-json";

function canvasImageSrc(url: string): string {
  if (url.startsWith("/api/settings/menu-image-proxy")) return url;
  return toCanvasMenuImageProxyUrl(url);
}

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
  const [image] = useImage(canvasImageSrc(url));
  if (!image) return null;
  // eslint-disable-next-line jsx-a11y/alt-text -- Konva canvas node
  return <Image image={image} x={x} y={y} width={size} height={size} listening={false} />;
}

export function MenuItemKonvaBlock({
  node,
  selected,
  onSelect,
  onDragEnd,
}: MenuItemKonvaBlockProps) {
  const s = node.style;
  const hasImage = Boolean(node.imageUrl);
  const textX = hasImage ? 100 : 12;
  const textWidth = node.width - textX - 8;
  const cardH = hasImage ? 120 : 96;
  let textY = 12;

  const cardFill = s?.cardFill ?? (selected ? "#f0f9ff" : "#ffffff");
  const cardStroke = selected ? (s?.accentColor ?? "#2563eb") : (s?.cardStroke ?? "#e5e7eb");

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
        height={cardH}
        fill={cardFill}
        stroke={cardStroke}
        strokeWidth={selected ? 2 : 1}
        cornerRadius={8}
        shadowColor="#000000"
        shadowBlur={6}
        shadowOpacity={0.1}
      />
      {hasImage && node.imageUrl ? (
        <MenuItemPhoto url={node.imageUrl} x={10} y={10} size={80} />
      ) : null}
      <Text
        x={textX}
        y={textY}
        width={textWidth}
        text={node.name}
        fontSize={20}
        fontStyle="600"
        fontFamily={s?.bodyFontFamily}
        fill={s?.nameColor ?? "#111111"}
        wrap="word"
      />
      <Text
        x={textX}
        y={(textY += 30)}
        width={textWidth}
        text={node.price}
        fontSize={18}
        fontFamily={s?.bodyFontFamily}
        fill={s?.priceColor ?? "#333333"}
      />
      {node.gramm ? (
        <Text
          x={textX}
          y={(textY += 24)}
          width={textWidth}
          text={node.gramm}
          fontSize={14}
          fontFamily={s?.bodyFontFamily}
          fill={s?.grammColor ?? s?.descriptionColor ?? "#666666"}
        />
      ) : null}
      {node.description ? (
        <Text
          x={textX}
          y={(textY += node.gramm ? 20 : 24)}
          width={textWidth}
          text={node.description}
          fontSize={14}
          fontFamily={s?.bodyFontFamily}
          fill={s?.descriptionColor ?? "#444444"}
          wrap="word"
        />
      ) : null}
    </Group>
  );
}
