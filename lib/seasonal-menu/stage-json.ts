import type { MenuItem } from "@/lib/data/global-menu-types";
import { A4_HEIGHT_PX, A4_WIDTH_PX } from "@/lib/seasonal-menu/a4-dimensions";
import { formatMenuItemPrice } from "@/lib/seasonal-menu/menu-item-format";
import { resolveMenuImageUrlForCanvas } from "@/lib/seasonal-menu/resolve-menu-image-url";
import { createEmptyStageJson } from "@/lib/seasonal-menu/empty-document";
import type { EditorNodeStyle } from "@/lib/seasonal-menu/templates/types";

export type { EditorNodeStyle };

export type EditorTextNode = {
  id: string;
  kind: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  width: number;
  style?: EditorNodeStyle;
  align?: "left" | "center" | "right";
  fontStyle?: string;
};

export type EditorMenuItemNode = {
  id: string;
  kind: "menuItem";
  x: number;
  y: number;
  width: number;
  name: string;
  price: string;
  description?: string;
  gramm?: string;
  imageUrl?: string;
  menuItemId?: string;
  style?: EditorNodeStyle;
};

export type EditorNode = EditorTextNode | EditorMenuItemNode;

function randomNodeId(): string {
  return `n_${crypto.randomUUID().slice(0, 8)}`;
}

export function createTextNode(
  x: number,
  y: number,
  text: string,
  options?: {
    fontSize?: number;
    width?: number;
    style?: EditorNodeStyle;
    align?: "left" | "center" | "right";
    fontStyle?: string;
  },
): EditorTextNode {
  return {
    id: randomNodeId(),
    kind: "text",
    x,
    y,
    text,
    fontSize: options?.fontSize ?? 24,
    width: options?.width ?? 400,
    style: options?.style,
    align: options?.align,
    fontStyle: options?.fontStyle,
  };
}

export function createMenuItemNode(
  item: MenuItem,
  x: number,
  y: number,
  options?: { width?: number; style?: EditorNodeStyle },
): EditorMenuItemNode {
  const image =
    resolveMenuImageUrlForCanvas(item.resolvedImage ?? item.image) ?? undefined;
  return {
    id: randomNodeId(),
    kind: "menuItem",
    x,
    y,
    width: options?.width ?? 320,
    name: item.name,
    price: formatMenuItemPrice(item),
    description: item.description,
    gramm: item.resolvedGramm ?? item.gramm,
    imageUrl: image,
    menuItemId: item.id,
    style: options?.style,
  };
}

function menuItemGroupHeight(node: EditorMenuItemNode): number {
  const hasImage = Boolean(node.imageUrl);
  let h = 28 + 22;
  if (node.gramm) h += 20;
  if (node.description) h += 36;
  return hasImage ? Math.max(h, 108) + 16 : h + 16;
}

function menuItemToKonvaChildren(node: EditorMenuItemNode): Record<string, unknown>[] {
  const s = node.style;
  const children: Record<string, unknown>[] = [];
  let y = 0;
  const innerWidth = node.width - 16;
  const textX = node.imageUrl ? 100 : 12;

  if (node.imageUrl) {
    children.push({
      attrs: {
        x: 8,
        y: 8,
        width: 84,
        height: 84,
        imageUrl: node.imageUrl,
        listening: false,
      },
      className: "Image",
    });
    y = 8;
  }

  children.push({
    attrs: {
      x: textX,
      y,
      width: innerWidth - (textX - 8),
      text: node.name,
      fontSize: 20,
      fontStyle: "600",
      fontFamily: s?.bodyFontFamily,
      fill: s?.nameColor ?? "#111111",
      wrap: "word",
    },
    className: "Text",
  });
  y += 30;

  children.push({
    attrs: {
      x: textX,
      y,
      width: innerWidth - (textX - 8),
      text: node.price,
      fontSize: 18,
      fontFamily: s?.bodyFontFamily,
      fill: s?.priceColor ?? "#333333",
    },
    className: "Text",
  });
  y += 24;

  if (node.gramm) {
    children.push({
      attrs: {
        x: textX,
        y,
        width: innerWidth - (textX - 8),
        text: node.gramm,
        fontSize: 14,
        fontFamily: s?.bodyFontFamily,
        fill: s?.grammColor ?? s?.descriptionColor ?? "#666666",
      },
      className: "Text",
    });
    y += 20;
  }

  if (node.description) {
    children.push({
      attrs: {
        x: textX,
        y,
        width: innerWidth - (textX - 8),
        text: node.description,
        fontSize: 14,
        fontFamily: s?.bodyFontFamily,
        fill: s?.descriptionColor ?? "#444444",
        wrap: "word",
      },
      className: "Text",
    });
  }

  return children;
}

export function editorNodesToStageJson(
  nodes: EditorNode[],
  backgroundLayer?: Record<string, unknown>,
): Record<string, unknown> {
  const bg =
    backgroundLayer ??
    (createEmptyStageJson().children as Record<string, unknown>[])[0];

  const konvaChildren: Record<string, unknown>[] = nodes.map((node) => {
    if (node.kind === "text") {
      const s = node.style;
      return {
        attrs: {
          id: node.id,
          x: node.x,
          y: node.y,
          width: node.width,
          text: node.text,
          fontSize: node.fontSize,
          fontFamily: s?.titleFontFamily ?? s?.bodyFontFamily,
          fontStyle: node.fontStyle ?? "normal",
          fill: s?.titleColor ?? "#111111",
          align: node.align ?? "left",
          draggable: true,
          name: "editor-text",
          ...(s ? { styleSnapshot: s } : {}),
        },
        className: "Text",
      };
    }
    const h = menuItemGroupHeight(node);
    const s = node.style;
    return {
      attrs: {
        id: node.id,
        x: node.x,
        y: node.y,
        width: node.width,
        height: h,
        draggable: true,
        name: "editor-menu-item",
        menuItemId: node.menuItemId,
        ...(s ? { styleSnapshot: s } : {}),
      },
      className: "Group",
      children: [
        {
          attrs: {
            x: 0,
            y: 0,
            width: node.width,
            height: h,
            fill: s?.cardFill ?? "#ffffff",
            stroke: s?.cardStroke ?? "#e5e7eb",
            strokeWidth: 1,
            cornerRadius: 8,
            listening: false,
          },
          className: "Rect",
        },
        ...menuItemToKonvaChildren(node),
      ],
    };
  });

  return {
    attrs: { width: A4_WIDTH_PX, height: A4_HEIGHT_PX },
    className: "Stage",
    children: [
      bg,
      {
        attrs: { name: "content" },
        className: "Layer",
        children: konvaChildren,
      },
    ],
  };
}

export function parseBackgroundLayerFromStageJson(
  stageJson: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!stageJson || !Array.isArray(stageJson.children)) return undefined;
  const layers = stageJson.children as Record<string, unknown>[];
  const bg = layers.find(
    (l) => (l.attrs as Record<string, unknown> | undefined)?.name === "background",
  );
  return bg;
}

function parseStyleFromAttrs(attrs: Record<string, unknown>): EditorNodeStyle | undefined {
  if (typeof attrs.styleSnapshot !== "object" || attrs.styleSnapshot === null) {
    return undefined;
  }
  return attrs.styleSnapshot as EditorNodeStyle;
}

export function parseEditorNodesFromStageJson(
  stageJson: Record<string, unknown> | undefined,
): EditorNode[] {
  if (!stageJson || !Array.isArray(stageJson.children)) return [];

  const layers = stageJson.children as Record<string, unknown>[];
  const contentLayer = layers.find(
    (l) => (l.attrs as Record<string, unknown> | undefined)?.name === "content",
  );
  if (!contentLayer || !Array.isArray(contentLayer.children)) return [];

  const nodes: EditorNode[] = [];

  for (const child of contentLayer.children as Record<string, unknown>[]) {
    const attrs = (child.attrs ?? {}) as Record<string, unknown>;
    const id = typeof attrs.id === "string" ? attrs.id : randomNodeId();
    const style = parseStyleFromAttrs(attrs);

    if (child.className === "Text" && attrs.name === "editor-text") {
      nodes.push({
        id,
        kind: "text",
        x: Number(attrs.x) || 0,
        y: Number(attrs.y) || 0,
        text: String(attrs.text ?? ""),
        fontSize: Number(attrs.fontSize) || 24,
        width: Number(attrs.width) || 400,
        style,
        align: (attrs.align as EditorTextNode["align"]) ?? "left",
        fontStyle: typeof attrs.fontStyle === "string" ? attrs.fontStyle : undefined,
      });
      continue;
    }

    if (child.className === "Group" && attrs.name === "editor-menu-item") {
      const texts: Array<{ text: string; fill?: string }> = [];
      let imageUrl: string | undefined;
      if (Array.isArray(child.children)) {
        for (const sub of child.children as Record<string, unknown>[]) {
          const sa = (sub.attrs ?? {}) as Record<string, unknown>;
          if (sub.className === "Text" && typeof sa.text === "string") {
            texts.push({ text: sa.text, fill: typeof sa.fill === "string" ? sa.fill : undefined });
          }
          if (sub.className === "Image" && typeof sa.imageUrl === "string") {
            imageUrl = sa.imageUrl;
          }
        }
      }
      const contentTexts = texts.filter((t) => t.text.length);
      const name = contentTexts[0]?.text ?? "";
      const price = contentTexts[1]?.text ?? "";
      const gramm = contentTexts[2]?.text;
      const description = contentTexts[3]?.text;

      nodes.push({
        id,
        kind: "menuItem",
        x: Number(attrs.x) || 0,
        y: Number(attrs.y) || 0,
        width: Number(attrs.width) || 320,
        name,
        price,
        gramm: gramm && gramm !== name ? gramm : undefined,
        description,
        imageUrl,
        menuItemId: typeof attrs.menuItemId === "string" ? attrs.menuItemId : undefined,
        style,
      });
    }
  }

  return nodes;
}

export function attachStyleSnapshotToStageJson(
  stageJson: Record<string, unknown>,
  theme?: EditorNodeStyle,
): Record<string, unknown> {
  if (!theme || !Array.isArray(stageJson.children)) return stageJson;

  const contentLayer = (stageJson.children as Record<string, unknown>[]).find(
    (l) => (l.attrs as Record<string, unknown> | undefined)?.name === "content",
  );
  if (!contentLayer?.children) return stageJson;

  for (const child of contentLayer.children as Record<string, unknown>[]) {
    const attrs = (child.attrs ?? {}) as Record<string, unknown>;
    if (attrs.name === "editor-text" || attrs.name === "editor-menu-item") {
      attrs.styleSnapshot = theme;
    }
  }

  return stageJson;
}

export function syncNodePosition(
  nodes: EditorNode[],
  id: string,
  x: number,
  y: number,
): EditorNode[] {
  return nodes.map((n) => (n.id === id ? { ...n, x, y } : n));
}

export { A4_WIDTH_PX, A4_HEIGHT_PX };
