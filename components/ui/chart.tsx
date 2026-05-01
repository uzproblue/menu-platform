"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextValue = { config: ChartConfig };

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return ctx;
}

function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string,
): ChartConfig[string] | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const p = payload as Record<string, unknown>;
  const nested =
    "payload" in p && typeof p.payload === "object" && p.payload !== null
      ? (p.payload as Record<string, unknown>)
      : undefined;
  let configLabelKey = key;
  if (key in p && typeof p[key] === "string") {
    configLabelKey = p[key] as string;
  } else if (
    nested &&
    key in nested &&
    typeof nested[key] === "string"
  ) {
    configLabelKey = nested[key] as string;
  }
  return configLabelKey in config ? config[configLabelKey] : config[key];
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const entries = Object.entries(config).filter(
    ([, v]) =>
      ("color" in v && v.color) ||
      ("theme" in v && v.theme),
  );
  if (!entries.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${entries
  .map(([key, itemConfig]) => {
    const color =
      "theme" in itemConfig && itemConfig.theme
        ? itemConfig.theme[theme as keyof typeof itemConfig.theme]
        : "color" in itemConfig
          ? itemConfig.color
          : undefined;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .filter(Boolean)
  .join("\n")}
}`,
          )
          .join("\n"),
      }}
    />
  );
};

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uid = React.useId();
  const chartId = `chart-${id ?? uid.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-auto w-full justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-foreground/55 [&_.recharts-cartesian-grid_line]:stroke-foreground/10 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-foreground/15 [&_.recharts-layer]:outline-none [&_.recharts-reference-line_line]:stroke-foreground/15 [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "ChartContainer";

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
      hideLabel?: boolean;
      hideIndicator?: boolean;
      indicator?: "line" | "dot" | "dashed";
      nameKey?: string;
      labelKey?: string;
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref,
  ) => {
    const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) return null;
      const [item] = payload;
      const key = `${labelKey ?? item?.dataKey ?? item?.name ?? "value"}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === "string"
          ? (config[label as keyof ChartConfig]?.label ?? label)
          : itemConfig?.label;

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>
            {labelFormatter(value, payload)}
          </div>
        );
      }
      if (!value) return null;
      return <div className={cn("font-medium", labelClassName)}>{value}</div>;
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      config,
      labelKey,
    ]);

    if (!active || !payload?.length) return null;

    const nestLabel = payload.length === 1 && indicator !== "dot";

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[9rem] items-start gap-1.5 rounded-xl border border-foreground/10 bg-background/95 px-2.5 py-2 text-xs shadow-lg ring-1 ring-foreground/5 backdrop-blur-md",
          className,
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload
            .filter((item) => item.type !== "none")
            .map((item, index) => {
              const key = `${nameKey ?? item.name ?? item.dataKey ?? "value"}`;
              const itemConfig = getPayloadConfigFromPayload(config, item, key);
              const indicatorColor =
                color ?? (item.payload as { fill?: string })?.fill ?? item.color;

              return (
                <div
                  key={String(item.dataKey ?? index)}
                  className={cn(
                    "flex w-full flex-wrap gap-2 [&>svg]:size-2.5 [&>svg]:text-foreground/55",
                    indicator === "dot" && "items-center",
                  )}
                >
                  {formatter &&
                  item?.value !== undefined &&
                  item.name !== undefined ? (
                    formatter(
                      item.value as number,
                      item.name,
                      item,
                      index,
                      item.payload,
                    )
                  ) : (
                    <>
                      {!hideIndicator && (
                        <div
                          className={cn(
                            "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                            indicator === "dot" && "size-2.5",
                            indicator === "line" && "h-2.5 w-1",
                            indicator === "dashed" &&
                              "h-0 w-0 border border-dashed bg-transparent p-[3px]",
                            nestLabel &&
                              indicator === "dashed" &&
                              "my-0.5 mx-0.5",
                          )}
                          style={
                            {
                              "--color-bg": indicatorColor,
                              "--color-border": indicatorColor,
                            } as React.CSSProperties
                          }
                        />
                      )}
                      <div
                        className={cn(
                          "flex flex-1 justify-between gap-2 leading-none",
                          nestLabel ? "items-end" : "items-center",
                        )}
                      >
                        <div className="grid gap-1">
                          {nestLabel ? tooltipLabel : null}
                          <span className="text-foreground/65">
                            {itemConfig?.label ?? item.name}
                          </span>
                        </div>
                        {item.value != null && (
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {typeof item.value === "number"
                              ? item.value.toLocaleString()
                              : String(item.value)}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    );
  },
);
ChartTooltipContent.displayName = "ChartTooltip";

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartStyle };
