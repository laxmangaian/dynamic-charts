import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

/**
 *
 * 1) Array of rows (timeseries)
 *    [ { "date":"2023-01-01", "value":100 }, ... ]
 *    // "sales" also supported as the value key
 *
 * 2) Array of rows (categorical)
 *    [ { "category":"A", "value":30 }, { "label":"B", "value":70 } ]
 *    // "name" also supported in place of category/label; "sales" for value
 *
 * 3) Array of rows (xy scatter)
 *    [ { "x": 10, "y": 20 }, { "x": 12, "y": 18 } ]
 *
 * 4) Object with chartType + data
 *    { "chartType":"pie", "data":[ ...rows... ] }
 *
 * 5) Choropleth (GeoJSON + values)
 *    {
 *      "chartType": "choropleth",
 *      "geo": { "type":"FeatureCollection", "features":[ ... ] },
 *      "data": [ { "id":"IND", "value": 42 }, { "id":"USA", "value": 99 } ]
 *      // Each feature should have feature.id or feature.properties.id / iso_a3 / name to match.
 *    }
 *
 */

const CHARTS_BY_SCHEMA = {
  timeseries: ["line", "area", "bar", "scatter"],
  categorical: ["bar", "pie"],
  xy: ["scatter"],
  geo: ["choropleth"],
};

export default function SmartChartPlayground() {
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
  const [dropdownType, setDropdownType] = useState("auto");
  const svgRef = useRef(null);
  const wrapperRef = useRef(null);

  // ---------- Helpers to sniff schema ----------
  const parseDate = d3.utcParse("%Y-%m-%d");

  function inferSchemaAndNormalize(parsed) {
    // Returns: { schema, chartTypeFromText, rows, geo, errors[] }
    let chartTypeFromText;
    let rows = [];
    let geo = null;
    const errors = [];

    if (Array.isArray(parsed)) {
      rows = parsed;
    } else if (parsed && typeof parsed === "object") {
      chartTypeFromText = parsed.chartType;
      rows = parsed.data ?? [];
      geo = parsed.geo ?? null;
      // Also allow plain GeoJSON
      if (
        !rows.length &&
        parsed.type === "FeatureCollection" &&
        Array.isArray(parsed.features)
      ) {
        geo = parsed;
      }
    } else {
      errors.push("JSON must be an array or object.");
    }

    // Geo?
    if (
      geo &&
      geo.type === "FeatureCollection" &&
      Array.isArray(geo.features)
    ) {
      // Optional: rows might provide id->value pairs
      const normalizedRows = Array.isArray(rows) ? rows : [];
      return {
        schema: "geo",
        chartTypeFromText,
        rows: normalizedRows,
        geo,
        errors,
      };
    }

    // If rows aren't array, bail
    if (!Array.isArray(rows)) {
      errors.push("`data` must be an array.");
      return { schema: null, chartTypeFromText, rows: [], geo: null, errors };
    }

    // Peek keys
    const first = rows.find((r) => r && typeof r === "object") || {};
    const hasDate = "date" in first;
    const hasValue = "value" in first || "sales" in first;
    const hasCategory =
      "category" in first || "label" in first || "name" in first;
    const hasXY = "x" in first && "y" in first;

    if (hasXY && typeof first.x === "number" && typeof first.y === "number") {
      // XY scatter
      const norm = rows
        .map((d) => ({
          x: +d.x,
          y: +d.y,
        }))
        .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));
      return { schema: "xy", chartTypeFromText, rows: norm, geo: null, errors };
    }

    if (hasDate && hasValue) {
      const norm = rows
        .map((d) => ({
          date: typeof d.date === "string" ? parseDate(d.date) : d.date,
          value:
            typeof d.value === "number"
              ? d.value
              : typeof d.sales === "number"
              ? d.sales
              : +d.value || +d.sales || NaN,
        }))
        .filter(
          (d) =>
            d.date instanceof Date && !isNaN(d.date) && Number.isFinite(d.value)
        )
        .sort((a, b) => a.date - b.date);
      return {
        schema: "timeseries",
        chartTypeFromText,
        rows: norm,
        geo: null,
        errors,
      };
    }

    if (hasCategory && hasValue) {
      const catKey =
        "category" in first ? "category" : "label" in first ? "label" : "name";
      const valKey = "value" in first ? "value" : "sales";
      const norm = rows
        .map((d) => ({
          category: String(d[catKey]),
          value: +d[valKey],
        }))
        .filter((d) => d.category && Number.isFinite(d.value));
      return {
        schema: "categorical",
        chartTypeFromText,
        rows: norm,
        geo: null,
        errors,
      };
    }

    // Heuristics: all have date? treat as timeseries if value-ish key exists.
    const keys = new Set(rows.flatMap((r) => (r ? Object.keys(r) : [])));
    if (keys.has("date") && (keys.has("value") || keys.has("sales"))) {
      const norm = rows
        .map((d) => ({
          date: typeof d.date === "string" ? parseDate(d.date) : d.date,
          value: +d.value || +d.sales || NaN,
        }))
        .filter((d) => d.date instanceof Date && Number.isFinite(d.value));
      return {
        schema: "timeseries",
        chartTypeFromText,
        rows: norm,
        geo: null,
        errors,
      };
    }

    return {
      schema: null,
      chartTypeFromText,
      rows: [],
      geo: null,
      errors: ["Could not infer schema."],
    };
  }

  const parsedState = useMemo(() => {
    try {
      const parsed = JSON.parse(rawText);
      return { ...inferSchemaAndNormalize(parsed), parseError: null };
    } catch (e) {
      return {
        schema: null,
        chartTypeFromText: null,
        rows: [],
        geo: null,
        errors: [],
        parseError: e.message,
      };
    }
  }, [rawText]);

  const { schema, chartTypeFromText, rows, geo, errors, parseError } =
    parsedState;

  // Decide chart type and filter options by schema
  const compatibleTypes = schema
    ? CHARTS_BY_SCHEMA[schema]
    : Object.values(CHARTS_BY_SCHEMA).flat();
  const chartType = useMemo(() => {
    if (dropdownType !== "auto") return dropdownType;
    if (
      chartTypeFromText &&
      (!schema || compatibleTypes.includes(chartTypeFromText))
    ) {
      return chartTypeFromText;
    }
    // sensible defaults
    if (schema === "timeseries") return "line";
    if (schema === "categorical") return "bar";
    if (schema === "xy") return "scatter";
    if (schema === "geo") return "choropleth";
    return "line";
  }, [dropdownType, chartTypeFromText, schema, compatibleTypes]);

  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;

    // clear
    d3.select(svgRef.current).selectAll("*").remove();

    const container = wrapperRef.current.getBoundingClientRect();
    const width = Math.max(360, container.width);
    const height = 420;
    const margin = { top: 24, right: 24, bottom: 48, left: 56 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .attr("role", "img")
      .attr("aria-label", `${chartType} chart`);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Show issues
    if (parseError) {
      g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH / 2)
        .attr("text-anchor", "middle")
        .style(
          "font",
          "14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        )
        .text(`Invalid JSON: ${parseError}`);
      return;
    }
    if (!schema) {
      g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH / 2)
        .attr("text-anchor", "middle")
        .style(
          "font",
          "14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        )
        .text(errors.join("; ") || "Unrecognized data.");
      return;
    }
    if (!rows.length && chartType !== "choropleth") {
      g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH / 2)
        .attr("text-anchor", "middle")
        .style(
          "font",
          "14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        )
        .text("No rows to visualize.");
      return;
    }

    // ---- Renderers ----
    function renderTimeseries(kind) {
      const x = d3
        .scaleUtc()
        .domain(d3.extent(rows, (d) => d.date))
        .range([0, innerW])
        .nice();
      const y = d3
        .scaleLinear()
        .domain([0, d3.max(rows, (d) => d.value) || 0])
        .nice()
        .range([innerH, 0]);

      const xAxis = d3
        .axisBottom(x)
        .ticks(Math.min(6, rows.length))
        .tickFormat(d3.utcFormat("%b %Y"));
      const yAxis = d3.axisLeft(y).ticks(6).tickSizeOuter(0);

      g.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(xAxis)
        .selectAll("text")
        .style("font-size", 12);
      g.append("g").call(yAxis).selectAll("text").style("font-size", 12);

      g.append("g")
        .attr("stroke-opacity", 0.1)
        .call(
          d3
            .axisLeft(y)
            .tickSize(-innerW)
            .tickFormat(() => "")
        );

      if (kind === "bar") {
        const xBand = d3
          .scaleBand()
          .domain(rows.map((d) => +d.date))
          .range([0, innerW])
          .padding(0.2);
        const bw = Math.max(8, Math.min(48, xBand.bandwidth()));
        g.selectAll("rect.bar")
          .data(rows)
          .join("rect")
          .attr("class", "bar")
          .attr("x", (d) => xBand(+d.date) + (xBand.bandwidth() - bw) / 2)
          .attr("y", (d) => y(Math.max(0, d.value)))
          .attr("width", bw)
          .attr("height", (d) => Math.abs(y(d.value) - y(0)))
          .attr("fill", "currentColor")
          .append("title")
          .text((d) => `${d3.utcFormat("%Y-%m-%d")(d.date)} • ${d.value}`);
      } else if (kind === "scatter") {
        g.selectAll("circle.dot")
          .data(rows)
          .join("circle")
          .attr("class", "dot")
          .attr("cx", (d) => x(d.date))
          .attr("cy", (d) => y(d.value))
          .attr("r", 4)
          .attr("fill", "currentColor")
          .append("title")
          .text((d) => `${d3.utcFormat("%Y-%m-%d")(d.date)} • ${d.value}`);
      } else {
        const line = d3
          .line()
          .x((d) => x(d.date))
          .y((d) => y(d.value));
        if (kind === "area") {
          const area = d3
            .area()
            .x((d) => x(d.date))
            .y0(y(0))
            .y1((d) => y(d.value));
          g.append("path")
            .datum(rows)
            .attr("d", area)
            .attr("fill", "currentColor")
            .attr("opacity", 0.15);
        }
        g.append("path")
          .datum(rows)
          .attr("fill", "none")
          .attr("stroke", "currentColor")
          .attr("stroke-width", 2)
          .attr("d", line);
        g.selectAll("circle.point")
          .data(rows)
          .join("circle")
          .attr("cx", (d) => x(d.date))
          .attr("cy", (d) => y(d.value))
          .attr("r", 3)
          .attr("fill", "currentColor")
          .append("title")
          .text((d) => `${d3.utcFormat("%Y-%m-%d")(d.date)} • ${d.value}`);
      }

      // Labels
      g.append("text")
        .attr("x", -innerH / 2)
        .attr("y", -margin.left + 14)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .style("font-size", 12)
        .text("Value");
      g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH + 36)
        .attr("text-anchor", "middle")
        .style("font-size", 12)
        .text("Date");
    }

    function renderCategorical(kind) {
      const xCats = rows.map((d) => d.category);
      const x = d3.scaleBand().domain(xCats).range([0, innerW]).padding(0.2);
      const y = d3
        .scaleLinear()
        .domain([0, d3.max(rows, (d) => d.value) || 0])
        .nice()
        .range([innerH, 0]);

      const xAxis = d3.axisBottom(x);
      const yAxis = d3.axisLeft(y).ticks(6).tickSizeOuter(0);
      g.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(xAxis)
        .selectAll("text")
        .style("font-size", 12);
      g.append("g").call(yAxis).selectAll("text").style("font-size", 12);
      g.append("g")
        .attr("stroke-opacity", 0.1)
        .call(
          d3
            .axisLeft(y)
            .tickSize(-innerW)
            .tickFormat(() => "")
        );

      if (kind === "bar") {
        g.selectAll("rect.bar")
          .data(rows)
          .join("rect")
          .attr("class", "bar")
          .attr("x", (d) => x(d.category))
          .attr("y", (d) => y(Math.max(0, d.value)))
          .attr("width", x.bandwidth())
          .attr("height", (d) => Math.abs(y(d.value) - y(0)))
          .attr("fill", "currentColor")
          .append("title")
          .text((d) => `${d.category} • ${d.value}`);
      } else if (kind === "pie") {
        // Pie ignores axes — clear them and recenter
        g.selectAll("*").remove();
        const radius = Math.min(innerW, innerH) / 2;
        const pieG = g
          .append("g")
          .attr("transform", `translate(${innerW / 2},${innerH / 2})`);

        const pie = d3.pie().value((d) => d.value);
        const arc = d3.arc().innerRadius(0).outerRadius(radius);
        const arcs = pie(rows);

        pieG
          .selectAll("path.slice")
          .data(arcs)
          .join("path")
          .attr("class", "slice")
          .attr("d", arc)
          .attr("fill", "currentColor")
          .attr("opacity", 0.85)
          .append("title")
          .text((d) => `${d.data.category} • ${d.data.value}`);

        // Legends (simple)
        const legend = g.append("g").attr("transform", `translate(0,0)`);
        const itemH = 18;
        rows.forEach((r, i) => {
          legend
            .append("rect")
            .attr("x", 0)
            .attr("y", i * itemH)
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", "currentColor")
            .attr("opacity", 0.85);
          legend
            .append("text")
            .attr("x", 18)
            .attr("y", i * itemH + 10)
            .style("font-size", 12)
            .text(`${r.category} (${r.value})`);
        });
      }
    }

    function renderXY() {
      const x = d3
        .scaleLinear()
        .domain([0, d3.max(rows, (d) => d.x) || 0])
        .nice()
        .range([0, innerW]);
      const y = d3
        .scaleLinear()
        .domain([0, d3.max(rows, (d) => d.y) || 0])
        .nice()
        .range([innerH, 0]);

      const xAxis = d3.axisBottom(x).ticks(6);
      const yAxis = d3.axisLeft(y).ticks(6).tickSizeOuter(0);

      g.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(xAxis)
        .selectAll("text")
        .style("font-size", 12);
      g.append("g").call(yAxis).selectAll("text").style("font-size", 12);
      g.append("g")
        .attr("stroke-opacity", 0.1)
        .call(
          d3
            .axisLeft(y)
            .tickSize(-innerW)
            .tickFormat(() => "")
        );

      g.selectAll("circle.dot")
        .data(rows)
        .join("circle")
        .attr("class", "dot")
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", 4)
        .attr("fill", "currentColor")
        .append("title")
        .text((d) => `x: ${d.x} • y: ${d.y}`);

      g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH + 36)
        .attr("text-anchor", "middle")
        .style("font-size", 12)
        .text("x");
      g.append("text")
        .attr("x", -innerH / 2)
        .attr("y", -margin.left + 14)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .style("font-size", 12)
        .text("y");
    }

    function renderChoropleth() {
      if (!geo || !geo.features?.length) {
        g.append("text")
          .attr("x", innerW / 2)
          .attr("y", innerH / 2)
          .attr("text-anchor", "middle")
          .style(
            "font",
            "14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          )
          .text("GeoJSON missing or invalid.");
        return;
      }

      // Build id->value map from rows (if provided)
      const valueById = new Map();
      for (const r of rows) {
        const id = r.id ?? r.code ?? r.name;
        const v = r.value ?? r.sales ?? r.metric;
        if (id != null && Number.isFinite(+v)) valueById.set(String(id), +v);
      }

      // Try to infer an identifier from features
      function featureId(f) {
        return (
          f.id ??
          f.properties?.id ??
          f.properties?.iso_a3 ??
          f.properties?.ISO_A3 ??
          f.properties?.name ??
          f.properties?.NAME
        );
      }

      const values = [];
      for (const f of geo.features) {
        const id = String(featureId(f) ?? "");
        const v = valueById.get(id);
        if (Number.isFinite(v)) values.push(v);
      }

      const color = d3
        .scaleSequential()
        .domain(d3.extent(values.length ? values : [0, 1]))
        .interpolator(d3.interpolateBlues);

      // Fit projection to the GeoJSON
      const projection = d3.geoMercator();
      const path = d3.geoPath(projection);
      // fitSize can be simulated:
      const bounds = d3
        .geoPath(projection.fitSize([innerW, innerH], geo))
        .bounds(geo);
      // (fitSize already applied by the time bounds() is called)

      // Draw
      g.selectAll("path.feature")
        .data(geo.features)
        .join("path")
        .attr("class", "feature")
        .attr("d", path)
        .attr("fill", (d) => {
          const id = String(featureId(d) ?? "");
          const v = valueById.get(id);
          return Number.isFinite(v) ? color(v) : "#eee";
        })
        .attr("stroke", "#999")
        .attr("stroke-width", 0.5)
        .append("title")
        .text((d) => {
          const id = String(featureId(d) ?? "");
          const v = valueById.get(id);
          const name = d.properties?.name ?? d.properties?.NAME ?? id;
          return Number.isFinite(v) ? `${name}: ${v}` : `${name}: n/a`;
        });

      // Simple color legend
      const legendW = 160;
      const legendH = 10;
      const legendX = innerW - legendW;
      const legendY = innerH + 24;

      const legendScale = d3
        .scaleLinear()
        .domain(color.domain())
        .range([0, legendW]);
      const legendAxis = d3.axisBottom(legendScale).ticks(5).tickSize(legendH);

      const lg = svg
        .append("g")
        .attr(
          "transform",
          `translate(${margin.left + legendX},${margin.top + innerH})`
        );
      const gradientId = "choro-grad";
      const defs = svg.append("defs");
      const gradient = defs
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("x2", "100%");
      const stops = d3.range(0, 1.0001, 0.2);
      stops.forEach((t) => {
        gradient
          .append("stop")
          .attr("offset", `${t * 100}%`)
          .attr("stop-color", color(d3.interpolate(...color.domain())(t)));
      });

      lg.append("rect")
        .attr("width", legendW)
        .attr("height", legendH)
        .attr("fill", `url(#${gradientId})`);
      lg.append("g")
        .attr("transform", `translate(0,${0})`)
        .call(legendAxis)
        .call((s) => s.select(".domain").remove());
    }

    // dispatch
    if (schema === "timeseries") renderTimeseries(chartType);
    else if (schema === "categorical") renderCategorical(chartType);
    else if (schema === "xy") renderXY();
    else if (schema === "geo") renderChoropleth();
  }, [schema, rows, geo, chartType, rawText]);

  // UI
  const showTypeWarning =
    schema &&
    dropdownType === "auto" &&
    chartTypeFromText &&
    !CHARTS_BY_SCHEMA[schema]?.includes(chartTypeFromText);

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        padding: 16,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <h2 style={{ margin: "0 0 12px" }}> D3 Chart</h2>

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
            Data JSON
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            spellCheck={false}
            style={{
              width: "100%",
              height: 340,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
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

          <details style={{ marginTop: 12 }}>
            <summary>Examples</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {`// Timeseries
{ "chartType":"area", "data":[
  { "date":"2023-01-01", "value":100 },
  { "date":"2023-02-01", "value":120 },
  { "date":"2023-03-01", "value":150 }
]}

// Categorical
{ "chartType":"pie", "data":[
  { "category":"A", "value":30 },
  { "category":"B", "value":70 }
]}

// XY scatter
{ "chartType":"scatter", "data":[
  { "x": 10, "y": 20 },
  { "x": 12, "y": 18 }
]}

// Choropleth (GeoJSON + values)
{
  "chartType":"choropleth",
  "geo": {
    "type":"FeatureCollection",
    "features":[
      { "type":"Feature", "id":"USA", "properties":{ "name":"United States" }, "geometry":{ "type":"Polygon", "coordinates":[[[-101,40],[-100,40],[-100,41],[-101,41],[-101,40]]] } },
      { "type":"Feature", "id":"MEX", "properties":{ "name":"Mexico" }, "geometry":{ "type":"Polygon", "coordinates":[[[-99,19],[-98,19],[-98,20],[-99,20],[-99,19]]] } }
    ]
  },
  "data":[
    { "id":"USA", "value": 80 },
    { "id":"MEX", "value": 50 }
  ]
}`}
            </pre>
          </details>
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
              marginBottom: 8,
              background: "white",
            }}
          >
            <option value="auto">Auto (infer from data)</option>
            {/* Only show generic options; the component will guard incompatibles */}
            <option value="line">Line</option>
            <option value="area">Area</option>
            <option value="bar">Bar</option>
            <option value="scatter">Scatter</option>
            <option value="pie">Pie</option>
            <option value="choropleth">Choropleth (GeoJSON)</option>
          </select>

          {schema && (
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              Detected schema: <b>{schema}</b> • Compatible types:{" "}
              {CHARTS_BY_SCHEMA[schema].join(", ")}
            </div>
          )}
          {showTypeWarning && (
            <div style={{ fontSize: 12, color: "#b45309", marginBottom: 8 }}>
              Note: Requested type "{chartTypeFromText}" isn't compatible with
              detected schema "{schema}". Using <b>{chartType}</b> instead.
            </div>
          )}

          <div ref={wrapperRef} style={{ width: "100%" }}>
            <svg ref={svgRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
