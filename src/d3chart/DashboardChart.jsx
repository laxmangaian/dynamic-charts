// ChartPlayground.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

/**
 * Paste JSON in the textarea in either format:
 *   1) Array only:
 *      [ { "date": "2023-01-01", "sales": 100 }, ... ]
 *   2) Object with chartType:
 *      { "chartType": "bar", "data": [ { "date": "2023-01-01", "sales": 100 }, ... ] }
 *
 * Or just use the dropdown to pick a chart type.
 */
export default function DashboardChart() {
  const defaultText = JSON.stringify(
    {
      chartType: "line",
      data: [
        { date: "2023-01-01", sales: 100 },
        { date: "2023-02-01", sales: 120 },
        { date: "2023-03-01", sales: 150 },
        { date: "2023-04-01", sales: 90 },
      ],
    },
    null,
    2
  );

  const [rawText, setRawText] = useState(defaultText);
  const [dropdownType, setDropdownType] = useState("auto"); // auto | line | bar | area | scatter
  const svgRef = useRef(null);
  const wrapperRef = useRef(null);

  // Parse & normalize input
  const { data, typeFromText, parseError } = useMemo(() => {
    try {
      const parsed = JSON.parse(rawText);
      let rows = [];
      let t = undefined;
      if (Array.isArray(parsed)) {
        rows = parsed;
      } else if (parsed && typeof parsed === "object") {
        rows = parsed.data || [];
        t = parsed.chartType;
      }

      // normalize rows: parse date & value
      const parseDate = d3.utcParse("%Y-%m-%d");
      const norm = rows
        .map((d) => ({
          date: typeof d.date === "string" ? parseDate(d.date) : d.date,
          value:
            typeof d.sales === "number"
              ? d.sales
              : typeof d.value === "number"
              ? d.value
              : +d.sales || +d.value || NaN,
          __raw: d,
        }))
        .filter((d) => d.date instanceof Date && !isNaN(d.date) && !isNaN(d.value))
        .sort((a, b) => a.date - b.date);

      return { data: norm, typeFromText: t, parseError: null };
    } catch (e) {
      return { data: [], typeFromText: undefined, parseError: e.message };
    }
  }, [rawText]);

  // Decide final chart type
  const chartType = useMemo(() => {
    if (dropdownType !== "auto") return dropdownType;
    if (typeFromText) return typeFromText;
    return "line";
  }, [dropdownType, typeFromText]);

  // Render chart on changes
  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;

    // Clear previous drawing
    d3.select(svgRef.current).selectAll("*").remove();

    const container = wrapperRef.current.getBoundingClientRect();
    const width = Math.max(320, container.width);
    const height = 360;

    const margin = { top: 24, right: 24, bottom: 48, left: 56 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .attr("role", "img")
      .attr("aria-label", `${chartType} chart of values over time`);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // If no data or parsing error, show message
    if (!data.length) {
      g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH / 2)
        .attr("text-anchor", "middle")
        .style("font", "14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif")
        .text(parseError ? `Invalid JSON: ${parseError}` : "No valid data to display");
      return;
    }

    // Scales
    const x = d3
      .scaleUtc()
      .domain(d3.extent(data, (d) => d.date))
      .range([0, innerW])
      .nice();

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.value) || 0])
      .nice()
      .range([innerH, 0]);

    // Axes
    const xAxis = d3.axisBottom(x).ticks(Math.min(6, data.length)).tickFormat(d3.utcFormat("%b %Y"));
    const yAxis = d3.axisLeft(y).ticks(6).tickSizeOuter(0);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", "12px");

    g.append("g").call(yAxis).selectAll("text").style("font-size", "12px");

    // Gridlines
    g.append("g")
      .attr("stroke-opacity", 0.1)
      .call(d3.axisLeft(y).tickSize(-innerW).tickFormat(() => ""))
      .selectAll(".tick line")
      .attr("shape-rendering", "crispEdges");

    // Draw by chart type
    if (chartType === "line" || chartType === "area") {
      const line = d3
        .line()
        .x((d) => x(d.date))
        .y((d) => y(d.value))
        .defined((d) => Number.isFinite(d.value));

      if (chartType === "area") {
        const area = d3
          .area()
          .x((d) => x(d.date))
          .y0(y(0))
          .y1((d) => y(d.value))
          .defined((d) => Number.isFinite(d.value));

        g.append("path")
          .datum(data)
          .attr("d", area)
          .attr("fill", "currentColor")
          .attr("opacity", 0.15);
      }

      g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "currentColor")
        .attr("stroke-width", 2)
        .attr("d", line);

      // Points for accessibility / hover targets
      g.selectAll("circle.point")
        .data(data)
        .join("circle")
        .attr("class", "point")
        .attr("cx", (d) => x(d.date))
        .attr("cy", (d) => y(d.value))
        .attr("r", 3)
        .attr("fill", "currentColor")
        .append("title")
        .text((d) => `${d3.utcFormat("%Y-%m-%d")(d.date)} • ${d.value}`);
    } else if (chartType === "bar") {
      const bandwidth = Math.max(8, Math.min(48, innerW / data.length - 6));
      const xBand = d3
        .scaleBand()
        .domain(data.map((d) => +d.date)) // band needs discrete domain; use timestamp
        .range([0, innerW])
        .padding(0.2);

      g.selectAll("rect.bar")
        .data(data)
        .join("rect")
        .attr("class", "bar")
        .attr("x", (d) => xBand(+d.date) + (xBand.bandwidth() - bandwidth) / 2)
        .attr("y", (d) => y(Math.max(0, d.value)))
        .attr("width", bandwidth)
        .attr("height", (d) => Math.abs(y(d.value) - y(0)))
        .attr("fill", "currentColor")
        .append("title")
        .text((d) => `${d3.utcFormat("%Y-%m-%d")(d.date)} • ${d.value}`);
    } else if (chartType === "scatter") {
      g.selectAll("circle.dot")
        .data(data)
        .join("circle")
        .attr("class", "dot")
        .attr("cx", (d) => x(d.date))
        .attr("cy", (d) => y(d.value))
        .attr("r", 4)
        .attr("fill", "currentColor")
        .attr("fill-opacity", 0.9)
        .append("title")
        .text((d) => `${d3.utcFormat("%Y-%m-%d")(d.date)} • ${d.value}`);
    }

    // Axis labels
    g.append("text")
      .attr("x", -innerH / 2)
      .attr("y", -margin.left + 14)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Sales");

    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 36)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Date");
  }, [data, chartType]);

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        padding: 16,
        maxWidth: 1000,
        margin: "0 auto",
      }}
    >
      <h2 style={{ margin: "0 0 12px" }}>D3 Chart Playground</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div>
          <label style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
            Data JSON (array or object with <code>chartType</code> + <code>data</code>)
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            spellCheck={false}
            style={{
              width: "100%",
              height: 280,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: 12,
              padding: 12,
              borderRadius: 8,
              border: "1px solid #d0d7de",
              outline: "none",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
            aria-label="Chart data JSON"
          />
          {parseError && (
            <div style={{ color: "#b42318", marginTop: 8, fontSize: 12 }}>
              ⚠️ {parseError}
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
            Chart type
          </label>
          <select
            value={dropdownType}
            onChange={(e) => setDropdownType(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #d0d7de",
              marginBottom: 12,
              background: "white",
            }}
          >
            <option value="auto">Auto (use textarea if provided)</option>
            <option value="line">Line</option>
            <option value="bar">Bar</option>
            <option value="area">Area</option>
            <option value="scatter">Scatter</option>
          </select>

          <div ref={wrapperRef} style={{ width: "100%" }}>
            <svg ref={svgRef} />
          </div>

          <small style={{ display: "block", marginTop: 8, color: "#6b7280" }}>
            Tip: set <code>{"{\"chartType\":\"bar\", \"data\": [...]}"}</code> in the textarea and keep the
            dropdown on <b>Auto</b>, or force a type with the dropdown.
          </small>
        </div>
      </div>
    </div>
  );
}
