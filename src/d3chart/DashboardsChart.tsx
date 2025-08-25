import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

/**
 * Smart D3 Chart Playground (JSX version)
 * - Fixes: (1) misclassification of categorical as histogram
 *          (2) donut/pie on wide data (sums series per category)
 * - Pure JSX/JS (no TypeScript annotations, no generics, no "as" casts)
 */

const CHARTS_BY_SCHEMA = {
  timeseries: ["line", "area", "bar", "scatter", "step"],
  categorical: ["bar", "pie", "donut", "groupedBar", "stackedBar"],
  xy: ["scatter", "bubble"],
  histogram: ["histogram"],
  heatmap: ["heatmap"],
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

  const parseDate = d3.utcParse("%Y-%m-%d");
  const fmtDate = d3.utcFormat("%Y-%m-%d");

  function toNumber(v) {
    return typeof v === "number" ? v : v == null ? NaN : +v;
  }

  function inferSchemaAndNormalize(parsed) {
    // returns { schema, chartTypeFromText, rows, geo, seriesKeys, errors[] }
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
      if (!rows.length && parsed.type === "FeatureCollection") {
        geo = parsed; // allow bare GeoJSON
      }
    } else {
      errors.push("JSON must be an array or object.");
    }

    // Geo
    if (geo && geo.type === "FeatureCollection" && Array.isArray(geo.features)) {
      return { schema: "geo", chartTypeFromText, rows: Array.isArray(rows) ? rows : [], geo, seriesKeys: [], errors };
    }

    if (!Array.isArray(rows)) {
      errors.push("`data` must be an array.");
      return { schema: null, chartTypeFromText, rows: [], geo: null, seriesKeys: [], errors };
    }

    const firstRow = rows.find((r) => r && typeof r === "object") || {};

    // ✅ Make sure categorical isn't mistaken for histogram
    const looksCategorical =
      ("category" in firstRow || "label" in firstRow || "name" in firstRow) &&
      ("value" in firstRow || "sales" in firstRow ||
        Object.keys(firstRow).filter(
          (k) => !["category", "label", "name"].includes(k) && Number.isFinite(toNumber(firstRow[k]))
        ).length >= 2);

    // Timeseries
    if ("date" in firstRow && ("value" in firstRow || "sales" in firstRow)) {
      const norm = rows
        .map((d) => ({
          date: typeof d.date === "string" ? parseDate(d.date) : d.date,
          value: toNumber(d.value ?? d.sales),
        }))
        .filter((d) => d.date instanceof Date && !isNaN(d.date) && Number.isFinite(d.value))
        .sort((a, b) => a.date - b.date);
      return { schema: "timeseries", chartTypeFromText, rows: norm, geo: null, seriesKeys: [], errors };
    }

    // Categorical — long (category+series+value)
    if (("series" in firstRow || "key" in firstRow) && ("category" in firstRow || "label" in firstRow || "name" in firstRow) && ("value" in firstRow || "sales" in firstRow)) {
      const catKey = "category" in firstRow ? "category" : "label" in firstRow ? "label" : "name";
      const serKey = "series" in firstRow ? "series" : "key";
      const valKey = "value" in firstRow ? "value" : "sales";
      const norm = rows
        .map((d) => ({ category: String(d[catKey]), series: String(d[serKey]), value: toNumber(d[valKey]) }))
        .filter((d) => d.category && d.series && Number.isFinite(d.value));
      const seriesKeys = Array.from(new Set(norm.map((d) => d.series)));
      return { schema: "categorical", chartTypeFromText, rows: norm, geo: null, seriesKeys, errors, longForm: true };
    }

    // Categorical — wide (category + multiple numeric keys)
    if (("category" in firstRow || "label" in firstRow || "name" in firstRow) && !("value" in firstRow) && !("sales" in firstRow)) {
      const catKey = "category" in firstRow ? "category" : "label" in firstRow ? "label" : "name";
      const numericKeys = Object.keys(firstRow).filter((k) => k !== catKey && Number.isFinite(toNumber(firstRow[k])));
      if (numericKeys.length >= 2) {
        const norm = rows.map((r) => ({ category: String(r[catKey]), ...r }));
        return { schema: "categorical", chartTypeFromText, rows: norm, geo: null, seriesKeys: numericKeys, errors, wideForm: true, catKey };
      }
    }

    // Categorical — single
    if (looksCategorical || (("category" in firstRow || "label" in firstRow || "name" in firstRow) && ("value" in firstRow || "sales" in firstRow))) {
      const catKey = "category" in firstRow ? "category" : "label" in firstRow ? "label" : "name";
      const valKey = "value" in firstRow ? "value" : "sales";
      const norm = rows
        .map((d) => ({ category: String(d[catKey]), value: toNumber(d[valKey]) }))
        .filter((d) => d.category && Number.isFinite(d.value));
      return { schema: "categorical", chartTypeFromText, rows: norm, geo: null, seriesKeys: [], errors };
    }

    // Histogram — only if primitives or {value} objects with no category-like keys
    const primitiveNumbersCandidate = rows.length && (
      typeof rows[0] === "number" ||
      (rows[0] && typeof rows[0] === "object" && "value" in rows[0] && typeof rows[0].value === "number" && !("category" in rows[0]) && !("label" in rows[0]) && !("name" in rows[0]))
    );
    if (primitiveNumbersCandidate) {
      const primitiveNumbers = rows.map((d) => (typeof d === "number" ? d : d.value)).map(toNumber);
      if (primitiveNumbers.every(Number.isFinite)) {
        return { schema: "histogram", chartTypeFromText, rows: primitiveNumbers, geo: null, seriesKeys: [], errors };
      }
    }

    // XY / bubble
    if ("x" in firstRow && "y" in firstRow) {
      const norm = rows
        .map((d) => ({ x: toNumber(d.x), y: toNumber(d.y), r: toNumber(d.r) }))
        .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y));
      return { schema: "xy", chartTypeFromText, rows: norm, geo: null, seriesKeys: [], errors };
    }

    return { schema: null, chartTypeFromText, rows: [], geo: null, seriesKeys: [], errors: ["Could not infer schema."] };
  }

  const parsedState = useMemo(() => {
    try {
      const parsed = JSON.parse(rawText);
      return { ...inferSchemaAndNormalize(parsed), parseError: null };
    } catch (e) {
      return { schema: null, chartTypeFromText: null, rows: [], geo: null, seriesKeys: [], errors: [], parseError: e.message };
    }
  }, [rawText]);

  const { schema, chartTypeFromText, rows, geo, errors, seriesKeys, parseError } = parsedState;

  const compatible = schema ? CHARTS_BY_SCHEMA[schema] : Object.values(CHARTS_BY_SCHEMA).flat();
  const chartType = useMemo(() => {
    if (dropdownType !== "auto") return dropdownType;
    if (chartTypeFromText && compatible.includes(chartTypeFromText)) return chartTypeFromText;
    return (
      {
        timeseries: "line",
        categorical: "bar",
        xy: "scatter",
        histogram: "histogram",
        heatmap: "heatmap",
        geo: "choropleth",
      }[schema] || "line"
    );
  }, [dropdownType, chartTypeFromText, schema, compatible]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current) return;

    svg.selectAll("*").remove();
    const containerW = wrapperRef.current?.getBoundingClientRect().width || 800;
    const width = Math.max(360, containerW);
    const height = 440;
    const margin = { top: 24, right: 24, bottom: 56, left: 64 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (parseError) {
      g.append("text").attr("x", innerW / 2).attr("y", innerH / 2).attr("text-anchor", "middle").text(`Invalid JSON: ${parseError}`);
      return;
    }
    if (!schema) {
      g.append("text").attr("x", innerW / 2).attr("y", innerH / 2).attr("text-anchor", "middle").text(errors.join("; ") || "Unrecognized data.");
      return;
    }
    if (!rows || (Array.isArray(rows) && rows.length === 0)) {
      if (chartType !== "choropleth") {
        g.append("text").attr("x", innerW / 2).attr("y", innerH / 2).attr("text-anchor", "middle").text("No data.");
        return;
      }
    }

    const R = {
      timeseries(kind) {
        const x = d3.scaleUtc().domain(d3.extent(rows, (d) => d.date)).range([0, innerW]).nice();
        const y = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.value) || 0]).nice().range([innerH, 0]);

        const xAxis = d3.axisBottom(x).ticks(Math.min(6, rows.length)).tickFormat(d3.utcFormat("%b %Y"));
        const yAxis = d3.axisLeft(y).ticks(6).tickSizeOuter(0);

        g.append("g").attr("transform", `translate(0,${innerH})`).call(xAxis);
        g.append("g").call(yAxis);
        g.append("g").attr("stroke-opacity", 0.1).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(() => ""));

        if (kind === "bar") {
          const xBand = d3.scaleBand().domain(rows.map((d) => +d.date)).range([0, innerW]).padding(0.2);
          const bw = Math.max(8, Math.min(48, xBand.bandwidth()));
          g.selectAll("rect.bar")
            .data(rows)
            .join("rect")
            .attr("class", "bar")
            .attr("x", (d) => (xBand(+d.date) || 0) + (xBand.bandwidth() - bw) / 2)
            .attr("y", (d) => y(Math.max(0, d.value)))
            .attr("width", bw)
            .attr("height", (d) => Math.abs(y(d.value) - y(0)))
            .attr("fill", "currentColor")
            .append("title").text((d) => `${fmtDate(d.date)} • ${d.value}`);
          return;
        }

        if (kind === "scatter") {
          g.selectAll("circle.dot")
            .data(rows)
            .join("circle")
            .attr("class", "dot")
            .attr("cx", (d) => x(d.date))
            .attr("cy", (d) => y(d.value))
            .attr("r", 4)
            .attr("fill", "currentColor")
            .append("title").text((d) => `${fmtDate(d.date)} • ${d.value}`);
          return;
        }

        const line = d3
          .line()
          .x((d) => x(d.date))
          .y((d) => y(d.value))
          .curve(kind === "step" ? d3.curveStep : d3.curveLinear);

        if (kind === "area") {
          const area = d3
            .area()
            .x((d) => x(d.date))
            .y0(y(0))
            .y1((d) => y(d.value))
            .curve(d3.curveLinear);
          g.append("path").datum(rows).attr("d", area).attr("fill", "currentColor").attr("opacity", 0.15);
        }

        g.append("path").datum(rows).attr("fill", "none").attr("stroke", "currentColor").attr("stroke-width", 2).attr("d", line);

        g.selectAll("circle.point")
          .data(rows)
          .join("circle")
          .attr("cx", (d) => x(d.date))
          .attr("cy", (d) => y(d.value))
          .attr("r", 3)
          .attr("fill", "currentColor")
          .append("title").text((d) => `${fmtDate(d.date)} • ${d.value}`);
      },

      categorical(kind) {
        const isLong = rows[0] && "series" in rows[0];
        const categories = Array.from(new Set(rows.map((d) => (isLong ? d.category : d.category))));

        // ✅ Donut/Pie also work for wide/long by summing series per category
        if (kind === "pie" || kind === "donut") {
          const isWide = !isLong && Array.isArray(seriesKeys) && seriesKeys.length > 0;
          let entries;
          if (isLong) {
            entries = Array.from(
              d3.rollup(rows, (v) => d3.sum(v, (d) => +d.value || 0), (d) => d.category),
              ([category, value]) => ({ category, value: Number(value) })
            );
          } else if (isWide) {
            entries = rows.map((r) => ({ category: r.category, value: d3.sum(seriesKeys, (k) => +r[k] || 0) }));
          } else {
            entries = rows.map((r) => ({ category: r.category, value: +r.value || 0 }));
          }
          entries = entries.filter((e) => Number.isFinite(e.value));

          const radius = Math.min(innerW, innerH) / 2;
          const pieG = g.append("g").attr("transform", `translate(${innerW / 2},${innerH / 2})`);
          const pie = d3.pie().value((d) => d.value);
          const arc = d3.arc().innerRadius(kind === "donut" ? radius * 0.5 : 0).outerRadius(radius);

          pieG
            .selectAll("path.slice")
            .data(pie(entries))
            .join("path")
            .attr("class", "slice")
            .attr("d", arc)
            .attr("fill", "currentColor")
            .attr("opacity", 0.9)
            .append("title").text((d) => `${d.data.category} • ${d.data.value}`);
          return;
        }

        // Bars
        const x = d3.scaleBand().domain(categories).range([0, innerW]).padding(0.2);

        let seriesK = [];
        let stackedData = null;
        let maxY = d3.max(rows, (d) => (isLong ? d.value : d.value ?? d3.max(seriesKeys || [], (k) => +d[k] || 0))) || 0;

        if (isLong) {
          seriesK = Array.from(new Set(rows.map((d) => d.series)));
          if (kind === "stackedBar") {
            const wide = d3.rollup(
              rows,
              (v) => {
                const obj = { category: v[0].category };
                seriesK.forEach((s) => (obj[s] = 0));
                v.forEach((d) => (obj[d.series] += d.value));
                return obj;
              },
              (d) => d.category
            );
            const asArray = Array.from(wide.values());
            stackedData = d3.stack().keys(seriesK)(asArray);
            maxY = d3.max(stackedData[stackedData.length - 1], (d) => d[1]) || 0;
          }
        } else if (seriesKeys && seriesKeys.length && (kind === "groupedBar" || kind === "stackedBar")) {
          seriesK = seriesKeys;
          const asArray = rows.map((r) => {
            const o = { category: r.category };
            seriesK.forEach((s) => (o[s] = toNumber(r[s])));
            return o;
          });
          if (kind === "stackedBar") {
            stackedData = d3.stack().keys(seriesK)(asArray);
            maxY = d3.max(stackedData[stackedData.length - 1], (d) => d[1]) || 0;
          } else {
            maxY = d3.max(seriesK, (s) => d3.max(asArray, (r) => toNumber(r[s]))) || 0;
          }
        }

        const y = d3.scaleLinear().domain([0, maxY]).nice().range([innerH, 0]);

        const xAxis = d3.axisBottom(x);
        const yAxis = d3.axisLeft(y).ticks(6).tickSizeOuter(0);
        g.append("g").attr("transform", `translate(0,${innerH})`).call(xAxis);
        g.append("g").call(yAxis);
        g.append("g").attr("stroke-opacity", 0.1).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(() => ""));

        if (kind === "bar") {
          const data = rows.map((d) => ({ category: d.category, value: d.value }));
          g.selectAll("rect.bar")
            .data(data)
            .join("rect")
            .attr("class", "bar")
            .attr("x", (d) => x(d.category))
            .attr("y", (d) => y(Math.max(0, d.value)))
            .attr("width", x.bandwidth())
            .attr("height", (d) => Math.abs(y(d.value) - y(0)))
            .attr("fill", "currentColor")
            .append("title").text((d) => `${d.category} • ${d.value}`);
          return;
        }

        if (kind === "groupedBar") {
          const x1 = d3.scaleBand().domain(seriesK).range([0, x.bandwidth()]).padding(0.1);
          const grouped = isLong
            ? d3.groups(rows, (d) => d.category)
            : rows.map((r) => [r.category, seriesK.map((s) => ({ series: s, value: toNumber(r[s] || 0), category: r.category }))]);

          g.append("g")
            .selectAll("g")
            .data(grouped)
            .join("g")
            .attr("transform", ([cat]) => `translate(${x(cat)},0)`)
            .selectAll("rect")
            .data(([, arr]) => (isLong ? arr : arr))
            .join("rect")
            .attr("x", (d) => x1(isLong ? d.series : d.series))
            .attr("y", (d) => y(Math.max(0, d.value)))
            .attr("width", x1.bandwidth())
            .attr("height", (d) => Math.abs(y(d.value) - y(0)))
            .attr("fill", "currentColor")
            .append("title").text((d) => `${d.category} • ${d.series}: ${d.value}`);
          return;
        }

        if (kind === "stackedBar") {
          const cats = categories;
          const base =
            stackedData ||
            d3.stack().keys(seriesK)(
              rows.map((r) => {
                const obj = { category: r.category };
                seriesK.forEach((k) => (obj[k] = toNumber(r[k] || 0)));
                return obj;
              })
            );

        g.append("g")
          .selectAll("g")
          .data(base)
          .join("g")
          .attr("class", "layer")
          .selectAll("rect")
          .data((layer) => layer.map((d, i) => ({ cat: cats[i], y0: d[0], y1: d[1] })))
          .join("rect")
          .attr("x", (d) => x(d.cat))
          .attr("y", (d) => y(d.y1))
          .attr("width", x.bandwidth())
          .attr("height", (d) => Math.max(0, y(d.y0) - y(d.y1)))
          .attr("fill", "currentColor")
          .attr("opacity", 0.9);
          return;
        }
      },

      xy(kind) {
        const x = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.x) || 0]).nice().range([0, innerW]);
        const y = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.y) || 0]).nice().range([innerH, 0]);

        const xAxis = d3.axisBottom(x).ticks(6);
        const yAxis = d3.axisLeft(y).ticks(6).tickSizeOuter(0);
        g.append("g").attr("transform", `translate(0,${innerH})`).call(xAxis);
        g.append("g").call(yAxis);
        g.append("g").attr("stroke-opacity", 0.1).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(() => ""));

        g.selectAll("circle.dot")
          .data(rows)
          .join("circle")
          .attr("class", "dot")
          .attr("cx", (d) => x(d.x))
          .attr("cy", (d) => y(d.y))
          .attr("r", (d) => (kind === "bubble" && Number.isFinite(d.r) ? Math.max(3, d.r) : 4))
          .attr("fill", "currentColor")
          .append("title").text((d) => `x: ${d.x} • y: ${d.y}${Number.isFinite(d.r) ? ` • r: ${d.r}` : ""}`);
      },

      histogram() {
        const values = rows;
        const x = d3.scaleLinear().domain(d3.extent(values)).nice().range([0, innerW]);
        const bins = d3.bin().domain(x.domain()).thresholds(20)(values);
        const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length) || 0]).nice().range([innerH, 0]);

        const xAxis = d3.axisBottom(x).ticks(10);
        const yAxis = d3.axisLeft(y).ticks(6).tickSizeOuter(0);
        g.append("g").attr("transform", `translate(0,${innerH})`).call(xAxis);
        g.append("g").call(yAxis);
        g.append("g").attr("stroke-opacity", 0.1).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(() => ""));

        g.selectAll("rect.bar")
          .data(bins)
          .join("rect")
          .attr("x", (d) => x(d.x0))
          .attr("y", (d) => y(d.length))
          .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 1))
          .attr("height", (d) => innerH - y(d.length))
          .attr("fill", "currentColor")
          .append("title").text((d) => `${d.x0}–${d.x1}: ${d.length}`);
      },

      heatmap() {
        const X = Array.from(new Set(rows.map((d) => String(d.x))));
        const Y = Array.from(new Set(rows.map((d) => String(d.y))));
        const x = d3.scaleBand().domain(X).range([0, innerW]).padding(0.03);
        const y = d3.scaleBand().domain(Y).range([innerH, 0]).padding(0.03);
        const v = rows.map((d) => toNumber(d.value)).filter(Number.isFinite);
        const color = d3.scaleSequential(d3.interpolateViridis).domain(d3.extent(v.length ? v : [0, 1]));

        const xAxis = d3.axisBottom(x);
        const yAxis = d3.axisLeft(y);
        g.append("g").attr("transform", `translate(0,${innerH})`).call(xAxis);
        g.append("g").call(yAxis);

        g.selectAll("rect.cell")
          .data(rows)
          .join("rect")
          .attr("class", "cell")
          .attr("x", (d) => x(String(d.x)))
          .attr("y", (d) => y(String(d.y)))
          .attr("width", x.bandwidth())
          .attr("height", y.bandwidth())
          .attr("fill", (d) => color(toNumber(d.value)))
          .append("title").text((d) => `${d.x} • ${d.y}: ${d.value}`);
      },

      geo() {
        const valueById = new Map();
        for (const r of rows || []) {
          const id = r.id ?? r.code ?? r.name;
          const val = toNumber(r.value ?? r.sales ?? r.metric);
          if (id != null && Number.isFinite(val)) valueById.set(String(id), val);
        }
        const features = (geo && geo.features) || [];
        const vals = features
          .map((f) => valueById.get(String(f.id ?? f.properties?.id ?? f.properties?.iso_a3 ?? f.properties?.name)))
          .filter(Number.isFinite);
        const color = d3.scaleSequential(d3.interpolateBlues).domain(d3.extent(vals.length ? vals : [0, 1]));
        const path = d3.geoPath(d3.geoMercator().fitSize([innerW, innerH], geo));

        g.selectAll("path.feature")
          .data(features)
          .join("path")
          .attr("class", "feature")
          .attr("d", path)
          .attr("fill", (d) => {
            const id = String(d.id ?? d.properties?.id ?? d.properties?.iso_a3 ?? d.properties?.name ?? "");
            const v = valueById.get(id);
            return Number.isFinite(v) ? color(v) : "#eee";
          })
          .attr("stroke", "#999")
          .attr("stroke-width", 0.5);
      },
    };

    if (schema === "timeseries") R.timeseries(chartType);
    else if (schema === "categorical") R.categorical(chartType);
    else if (schema === "xy") R.xy(chartType);
    else if (schema === "histogram") R.histogram();
    else if (schema === "heatmap") R.heatmap();
    else if (schema === "geo") R.geo();
  }, [schema, chartType, rows, geo, seriesKeys, rawText]);

  const showTypeGuard =
    schema && dropdownType === "auto" && chartTypeFromText && !CHARTS_BY_SCHEMA[schema]?.includes(chartTypeFromText);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 12px" }}>Smart D3 Chart Playground (Fixed, JSX)</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div>
          <label style={{ fontSize: 12, display: "block", marginBottom: 8 }}>Data JSON</label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            spellCheck={false}
            style={{ width: "100%", height: 360, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 12, padding: 12, borderRadius: 8, border: "1px solid #d0d7de", outline: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
            aria-label="Chart data JSON"
          />

          <details style={{ marginTop: 12 }}>
            <summary>More examples</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{`// Donut (categorical)
{ "chartType":"donut", "data":[
  { "category":"A", "value":30 },
  { "category":"B", "value":70 }
]}

// Grouped bar (wide)
{ "chartType":"groupedBar", "data":[
  { "category":"Q1", "ProductA": 10, "ProductB": 15 },
  { "category":"Q2", "ProductA": 8,  "ProductB": 20 }
]}

// Stacked bar (long)
{ "chartType":"stackedBar", "data":[
  { "category":"Q1", "series":"A", "value": 10 },
  { "category":"Q1", "series":"B", "value": 15 },
  { "category":"Q2", "series":"A", "value": 8  },
  { "category":"Q2", "series":"B", "value": 20 }
]}

// Histogram
{ "chartType":"histogram", "data":[ 3, 4, 7, 7, 8, 2, 5, 6, 10, 12 ] }

// Heatmap
{ "chartType":"heatmap", "data":[
  { "x":"Jan", "y":"North", "value": 10 },
  { "x":"Jan", "y":"South", "value": 5  },
  { "x":"Feb", "y":"North", "value": 12 },
  { "x":"Feb", "y":"South", "value": 7  }
]}

// Bubble (XY + radius)
{ "chartType":"bubble", "data":[
  { "x": 10, "y": 20, "r": 6 },
  { "x": 12, "y": 18, "r": 12 }
]}`}</pre>
          </details>
        </div>

        <div>
          <label style={{ fontSize: 12, display: "block", marginBottom: 8 }}>Chart type</label>
          <select
            value={dropdownType}
            onChange={(e) => setDropdownType(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d0d7de", marginBottom: 8, background: "white" }}
          >
            <option value="auto">Auto (infer from data)</option>
            <option value="line">Line</option>
            <option value="area">Area</option>
            <option value="bar">Bar</option>
            <option value="scatter">Scatter</option>
            <option value="step">Step line</option>
            <option value="pie">Pie</option>
            <option value="donut">Donut</option>
            <option value="groupedBar">Grouped bar</option>
            <option value="stackedBar">Stacked bar</option>
            <option value="bubble">Bubble</option>
            <option value="histogram">Histogram</option>
            <option value="heatmap">Heatmap</option>
            <option value="choropleth">Choropleth</option>
          </select>

          {schema && (
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              Detected schema: <b>{schema}</b> • Compatible: {CHARTS_BY_SCHEMA[schema].join(", ")}
            </div>
          )}
          {showTypeGuard && (
            <div style={{ fontSize: 12, color: "#b45309", marginBottom: 8 }}>
              Requested type isn’t compatible with detected "<b>{schema}</b>". Using <b>{chartType}</b> instead.
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