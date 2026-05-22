import type { MenuItem } from "@/lib/data/global-menu-types";
import { A4_HEIGHT_PX, A4_WIDTH_PX } from "@/lib/seasonal-menu/a4-dimensions";
import { formatMenuItemPrice } from "@/lib/seasonal-menu/menu-item-format";
import { resolveMenuImageUrlForCanvas } from "@/lib/seasonal-menu/resolve-menu-image-url";
import { createEmptyStageJson } from "@/lib/seasonal-menu/empty-document";

export type EditorTextNode = {
  id: string;
  kind: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  width: number;
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
};

export type EditorNode = EditorTextNode | EditorMenuItemNode;

function randomNodeId(): string {
  return `n_${crypto.randomUUID().slice(0, 8)}`;
}

export function createTextNode(x: number, y: number, text: string): EditorTextNode {
  return {
    id: randomNodeId(),
    kind: "text",
    x,
    y,
    text,
    fontSize: 24,
    width: 400,
  };
}

export function createMenuItemNode(
  item: MenuItem,
  x: number,
  y: number,
): EditorMenuItemNode {
  const image =
    resolveMenuImageUrlForCanvas(item.resolvedImage ?? item.image) ?? undefined;
  return {
    id: randomNodeId(),
    kind: "menuItem",
    x,
    y,
    width: 320,
    name: item.name,
    price: formatMenuItemPrice(item),
    description: item.description,
    gramm: item.resolvedGramm ?? item.gramm,
    imageUrl: image,
    menuItemId: item.id,
  };
}

function menuItemGroupHeight(node: EditorMenuItemNode): number {
  const hasImage = Boolean(node.imageUrl);
  let h = 28 + 22;
  if (node.description) h += 36;
  if (node.gramm) h += 20;
  return hasImage ? Math.max(h, 100) + 12 : h;
}

function menuItemToKonvaChildren(node: EditorMenuItemNode): Record<string, unknown>[] {
  const children: Record<string, unknown>[] = [];
  let y = 0;
  const innerWidth = node.width - 16;

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
    y = 100;
  }

  children.push({
    attrs: {
      x: 8,
      y,
      width: innerWidth,
      text: node.name,
      fontSize: 18,
      fontStyle: "bold",
      fill: "#111111",
      wrap: "word",
    },
    className: "Text",
  });
  y += 28;

  children.push({
    attrs: {
      x: 8,
      y,
      width: innerWidth,
      text: node.price,
      fontSize: 16,
      fill: "#333333",
    },
    className: "Text",
  });
  y += 22;

  if (node.gramm) {
    children.push({
      attrs: {
        x: 8,
        y,
        width: innerWidth,
        text: node.gramm,
        fontSize: 13,
        fill: "#666666",
      },
      className: "Text",
    });
    y += 20;
  }

  if (node.description) {
    children.push({
      attrs: {
        x: 8,
        y,
        width: innerWidth,
        text: node.description,
        fontSize: 13,
        fill: "#444444",
        wrap: "word",
      },
      className: "Text",
    });
  }

  return children;
}

export function editorNodesToStageJson(nodes: EditorNode[]): Record<string, unknown> {
  const base = createEmptyStageJson();
  const contentLayer = (base.children as Record<string, unknown>[])[1];
  const konvaChildren: Record<string, unknown>[] = nodes.map((node) => {
    if (node.kind === "text") {
      return {
        attrs: {
          id: node.id,
          x: node.x,
          y: node.y,
          width: node.width,
          text: node.text,
          fontSize: node.fontSize,
          fill: "#111111",
          draggable: true,
          name: "editor-text",
        },
        className: "Text",
      };
    }
    const h = menuItemGroupHeight(node);
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
      },
      className: "Group",
      children: menuItemToKonvaChildren(node),
    };
  });

  contentLayer.children = konvaChildren;
  return base;
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

    if (child.className === "Text") {
      nodes.push({
        id,
        kind: "text",
        x: Number(attrs.x) || 0,
        y: Number(attrs.y) || 0,
        text: String(attrs.text ?? ""),
        fontSize: Number(attrs.fontSize) || 24,
        width: Number(attrs.width) || 400,
      });
      continue;
    }

    if (child.className === "Group" && attrs.name === "editor-menu-item") {
      const texts: string[] = [];
      let imageUrl: string | undefined;
      if (Array.isArray(child.children)) {
        for (const sub of child.children as Record<string, unknown>[]) {
          const sa = (sub.attrs ?? {}) as Record<string, unknown>;
          if (sub.className === "Text" && typeof sa.text === "string") {
            texts.push(sa.text);
          }
          if (sub.className === "Image" && typeof sa.imageUrl === "string") {
            imageUrl = sa.imageUrl;
          }
        }
      }
      const name = texts[0] ?? "";
      const price = texts[1] ?? "";
      const gramm = texts[2] && !texts[2].includes("\n") && texts.length > 3 ? texts[2] : undefined;
      const description =
        texts.length > 3 ? texts.slice(3).join(" ") : texts[2] && texts.length === 3 ? texts[2] : undefined;

      nodes.push({
        id,
        kind: "menuItem",
        x: Number(attrs.x) || 0,
        y: Number(attrs.y) || 0,
        width: Number(attrs.width) || 320,
        name,
        price,
        gramm,
        description: description && description !== gramm ? description : undefined,
        imageUrl,
        menuItemId: typeof attrs.menuItemId === "string" ? attrs.menuItemId : undefined,
      });
    }
  }

  return nodes;
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
