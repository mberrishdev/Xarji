import React from "react";
import {
  Area,
  AreaChart as RAreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export interface AreaDatum {
  label: string;
  value: number;
}

export function AreaChart({
  data,
  width = 640,
  height = 180,
  stroke,
  fill,
  strokeWidth = 1.5,
  showGrid = true,
  gridColor = "rgba(0,0,0,0.06)",
  showAxes = true,
  axisColor = "rgba(0,0,0,0.4)",
  axisFont = "ui-monospace, monospace",
  formatY = (n: number) => n.toFixed(0),
  cornerRadius = 0,
  padding = { top: 18, right: 12, bottom: 22, left: 42 },
}: {
  data: AreaDatum[];
  width?: number;
  height?: number;
  stroke: string;
  fill?: string;
  strokeWidth?: number;
  showGrid?: boolean;
  gridColor?: string;
  showAxes?: boolean;
  axisColor?: string;
  axisFont?: string;
  formatY?: (n: number) => string;
  cornerRadius?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
}) {
  const gradientId = React.useId();
  const clipId = React.useId();
  if (!data || data.length === 0) return null;

  const chartMargin = {
    top: padding.top,
    right: padding.right,
    bottom: showAxes ? Math.max(0, padding.bottom - 18) : padding.bottom,
    left: showAxes ? Math.max(0, padding.left - 30) : padding.left,
  };

  const tickEvery = data.length > 14 ? Math.ceil(data.length / 7) : 1;
  const xTickFormatter = (label: string, index: number) => {
    if (index === data.length - 1 || index % tickEvery === 0) return label;
    return "";
  };

  return (
    <div style={{ width, height, maxWidth: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <RAreaChart data={data} margin={chartMargin}>
          {fill && (
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fill} stopOpacity={1} />
                <stop offset="100%" stopColor={fill} stopOpacity={0.6} />
              </linearGradient>
              {cornerRadius > 0 && (
                <clipPath id={clipId}>
                  <rect x="0" y="0" width="100%" height="100%" rx={cornerRadius} ry={cornerRadius} />
                </clipPath>
              )}
            </defs>
          )}
          {showGrid && <CartesianGrid stroke={gridColor} vertical={false} />}
          <XAxis
            dataKey="label"
            hide={!showAxes}
            tick={{ fill: axisColor, fontSize: 10, fontFamily: axisFont }}
            tickFormatter={xTickFormatter}
            interval={0}
            axisLine={false}
            tickLine={false}
            padding={{ left: 0, right: 0 }}
          />
          <YAxis
            hide={!showAxes}
            tick={{ fill: axisColor, fontSize: 10, fontFamily: axisFont }}
            tickFormatter={formatY}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={fill ? `url(#${gradientId})` : "none"}
            isAnimationActive={false}
            clipPath={cornerRadius > 0 && fill ? `url(#${clipId})` : undefined}
          />
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({
  segments,
  size = 200,
  thickness = 28,
  gap = 2,
  centerLabel,
  centerValue,
  centerColor = "#333",
  labelFont = "ui-monospace, monospace",
}: {
  segments: { value: number; color: string }[];
  size?: number;
  thickness?: number;
  gap?: number;
  centerLabel?: string;
  centerValue?: string;
  centerColor?: string;
  labelFont?: string;
}) {
  const inner = Math.max(0, size / 2 - thickness);
  const outer = size / 2;
  const data = segments.map((s, i) => ({ name: String(i), value: s.value, color: s.color }));
  const hasData = data.some((d) => d.value > 0);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={hasData ? data : [{ name: "empty", value: 1, color: "transparent" }]}
          dataKey="value"
          cx="50%"
          cy="50%"
          innerRadius={inner}
          outerRadius={outer}
          paddingAngle={hasData ? gap : 0}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          isAnimationActive={false}
        >
          {(hasData ? data : [{ color: "transparent" }]).map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
      {(centerLabel || centerValue) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {centerLabel && (
            <span
              style={{
                fontSize: 11,
                fontFamily: labelFont,
                color: centerColor,
                opacity: 0.55,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                lineHeight: 1.2,
              }}
            >
              {centerLabel}
            </span>
          )}
          {centerValue && (
            <span
              style={{
                fontSize: 22,
                fontFamily: labelFont,
                color: centerColor,
                fontWeight: 600,
                marginTop: 2,
                lineHeight: 1.1,
              }}
            >
              {centerValue}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function Sparkline({
  values,
  width = 80,
  height = 24,
  stroke,
  strokeWidth = 1.25,
  fill = "none",
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const gradientId = React.useId();
  if (!values || values.length === 0) return null;
  const data = values.map((v, i) => ({ i, value: v }));
  const usesFill = fill && fill !== "none";

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RAreaChart data={data} margin={{ top: 1, right: 0, bottom: 1, left: 0 }}>
          {usesFill && (
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fill} stopOpacity={1} />
                <stop offset="100%" stopColor={fill} stopOpacity={0.6} />
              </linearGradient>
            </defs>
          )}
          <XAxis dataKey="i" hide />
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={usesFill ? `url(#${gradientId})` : "none"}
            isAnimationActive={false}
          />
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBar({
  fraction,
  height = 6,
  color,
  bgColor = "rgba(0,0,0,0.06)",
  radius = 3,
}: {
  fraction: number;
  height?: number;
  color: string;
  bgColor?: string;
  radius?: number;
}) {
  return (
    <div style={{ width: "100%", height, background: bgColor, borderRadius: radius, overflow: "hidden" }}>
      <div
        style={{
          width: `${Math.min(100, Math.max(0, fraction * 100))}%`,
          height: "100%",
          background: color,
          borderRadius: radius,
          transition: "width .3s ease",
        }}
      />
    </div>
  );
}
