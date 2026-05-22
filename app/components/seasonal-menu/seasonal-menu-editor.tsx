"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { Layer, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { A4_HEIGHT_PX, A4_WIDTH_PX } from "@/lib/seasonal-menu/a4-dimensions";
import type { EditorNode, EditorTextNode } from "@/lib/seasonal-menu/stage-json";
import { MenuItemKonvaBlock } from "@/app/components/seasonal-menu/menu-item-konva-block";

export type SeasonalMenuEditorHandle = {
  getStage: () => Konva.Stage | null;
};

type SeasonalMenuEditorProps = {
  nodes: EditorNode[];
  selectedId: string | null;
  onNodesChange: (nodes: EditorNode[]) => void;
  onSelect: (id: string | null) => void;
};

export const SeasonalMenuEditor = forwardRef<SeasonalMenuEditorHandle, SeasonalMenuEditorProps>(
  function SeasonalMenuEditor({ nodes, selectedId, onNodesChange, onSelect }, ref) {
    const stageRef = useRef<Konva.Stage>(null);
    const transformerRef = useRef<Konva.Transformer>(null);

    useImperativeHandle(ref, () => ({
      getStage: () => stageRef.current,
    }));

    const updateNodePosition = useCallback(
      (id: string, x: number, y: number) => {
        onNodesChange(nodes.map((n) => (n.id === id ? { ...n, x, y } : n)));
      },
      [nodes, onNodesChange],
    );

    useEffect(() => {
      const tr = transformerRef.current;
      const stage = stageRef.current;
      if (!tr || !stage) return;

      if (!selectedId) {
        tr.nodes([]);
        tr.getLayer()?.batchDraw();
        return;
      }

      const node = stage.findOne(`#${selectedId}`);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
      }
    }, [selectedId, nodes]);

    return (
      <div className="overflow-auto rounded-xl border border-foreground/10 bg-neutral-200/80 p-4">
        <Stage
          ref={stageRef}
          width={A4_WIDTH_PX}
          height={A4_HEIGHT_PX}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) {
              onSelect(null);
            }
          }}
          onTouchStart={(e) => {
            if (e.target === e.target.getStage()) {
              onSelect(null);
            }
          }}
          className="mx-auto bg-white shadow-lg"
          style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX }}
        >
          <Layer listening={false}>
            <Rect
              x={0}
              y={0}
              width={A4_WIDTH_PX}
              height={A4_HEIGHT_PX}
              fill="#ffffff"
            />
          </Layer>
          <Layer>
            {nodes.map((node) => {
              if (node.kind === "menuItem") {
                return (
                  <MenuItemKonvaBlock
                    key={node.id}
                    node={node}
                    selected={selectedId === node.id}
                    onSelect={() => onSelect(node.id)}
                    onDragEnd={(x, y) => updateNodePosition(node.id, x, y)}
                  />
                );
              }
              const textNode = node as EditorTextNode;
              return (
                <Text
                  key={textNode.id}
                  id={textNode.id}
                  x={textNode.x}
                  y={textNode.y}
                  width={textNode.width}
                  text={textNode.text}
                  fontSize={textNode.fontSize}
                  fill="#111111"
                  draggable
                  onClick={() => onSelect(textNode.id)}
                  onTap={() => onSelect(textNode.id)}
                  onDragEnd={(e) => {
                    updateNodePosition(textNode.id, e.target.x(), e.target.y());
                  }}
                />
              );
            })}
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 40 || newBox.height < 20) return oldBox;
                return newBox;
              }}
              rotateEnabled
              enabledAnchors={[
                "top-left",
                "top-right",
                "bottom-left",
                "bottom-right",
                "middle-left",
                "middle-right",
              ]}
            />
          </Layer>
        </Stage>
      </div>
    );
  },
);
