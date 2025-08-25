/**
 * Return a complete HTML document that renders a time-series chart using D3.
 * @param {Array|Object} input  Either an array of rows, or { chartType, data }
 *                              chartType: "auto"|"line"|"bar"|"area"|"scatter"
 *                              rows use: { date: "YYYY-MM-DD", sales|value: number }
 */
function buildChartHTML(input) {
    // embed safely inside <script>
    const safe = (v) =>
        JSON.stringify(v).replace(/</g, "\\u003c").replace(/-->/g, "--\\u003e");

    // infer chartType + rows exactly from the provided input
    const chartType = Array.isArray(input) ? "auto" : (input.chartType || "auto");
    const rows = Array.isArray(input) ? input : (input.data || []);

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Time Series Chart</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; }
    .card { max-width: 980px; margin: 0 auto; }
    .muted { color: #6b7280; }
    .chart-wrap { width: 100%; }
    svg { display: block; width: 100%; height: auto; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
</head>
<body>
  <div class="card">
    <h2 style="margin:0 0 12px;">Time Series Chart</h2>
    <p class="muted" style="margin-top:0;">Data driven chart (${chartType}).</p>
    <div class="chart-wrap"><div id="chart" aria-label="chart container"></div></div>
  </div>

  <script>
    // Plain JS D3 renderer
    function renderTimeChart(container, input, chartType = "auto", options = {}) {
      const d3 = window.d3;
      const root = typeof container === "string" ? document.querySelector(container) : container;
      if (!root) throw new Error("renderTimeChart: container not found");
      Array.from(root.querySelectorAll("svg")).forEach(s => s.remove());

      // support array or { chartType, data }
      let rows = Array.isArray(input) ? input : (input && input.data) ? input.data : [];
      const typeFromInput = !Array.isArray(input) && input && input.chartType;

      const parseDate = d3.utcParse("%Y-%m-%d");
      const norm = rows.map(d => ({
          date: typeof d.date === "string" ? parseDate(d.date) : d.date,
          value: typeof d.sales === "number" ? d.sales :
                 (typeof d.value === "number" ? d.value : (+d.sales || +d.value || NaN))
        }))
        .filter(d => d.date instanceof Date && !isNaN(d.date) && Number.isFinite(d.value))
        .sort((a,b) => a.date - b.date);

      const finalType = chartType !== "auto" ? chartType : (typeFromInput || "line");

      const containerBox = root.getBoundingClientRect();
      const width = Math.max(320, options.width || containerBox.width || 640);
      const height = options.height || 360;
      const margin = Object.assign({ top: 24, right: 24, bottom: 48, left: 56 }, options.margin || {});
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const svg = d3.select(root).append("svg")
        .attr("viewBox", \`0 0 \${width} \${height}\`)
        .attr("width", "100%").attr("height", height)
        .attr("role", "img").attr("aria-label", finalType + " chart of values over time");

      const g = svg.append("g").attr("transform", \`translate(\${margin.left},\${margin.top})\`);

      if (!norm.length) {
        g.append("text").attr("x", innerW/2).attr("y", innerH/2).attr("text-anchor","middle")
          .style("font","14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif").text("No valid data to display");
        return svg.node();
      }

      const x = d3.scaleUtc().domain(d3.extent(norm, d => d.date)).range([0, innerW]).nice();
      const y = d3.scaleLinear().domain([0, d3.max(norm, d => d.value) || 0]).nice().range([innerH, 0]);

      g.append("g").attr("transform", \`translate(0,\${innerH})\`)
        .call(d3.axisBottom(x).ticks(Math.min(6,norm.length)).tickFormat(d3.utcFormat("%b %Y")))
        .selectAll("text").style("font-size","12px");
      g.append("g").call(d3.axisLeft(y).ticks(6).tickSizeOuter(0)).selectAll("text").style("font-size","12px");

      g.append("g").attr("stroke-opacity",0.1)
        .call(d3.axisLeft(y).tickSize(-innerW).tickFormat(()=>""))
        .selectAll(".tick line").attr("shape-rendering","crispEdges");

      if (finalType==="line"||finalType==="area") {
        const line=d3.line().x(d=>x(d.date)).y(d=>y(d.value)).defined(d=>Number.isFinite(d.value));
        if (finalType==="area") {
          const area=d3.area().x(d=>x(d.date)).y0(y(0)).y1(d=>y(d.value)).defined(d=>Number.isFinite(d.value));
          g.append("path").datum(norm).attr("d",area).attr("fill","currentColor").attr("opacity",0.15);
        }
        g.append("path").datum(norm).attr("fill","none").attr("stroke","currentColor").attr("stroke-width",2).attr("d",line);
        g.selectAll("circle.point").data(norm).join("circle").attr("class","point").attr("cx",d=>x(d.date)).attr("cy",d=>y(d.value)).attr("r",3).attr("fill","currentColor")
          .append("title").text(d=>d3.utcFormat("%Y-%m-%d")(d.date)+" • "+d.value);
      } else if (finalType==="bar") {
        const bandwidth=Math.max(8,Math.min(48,innerW/norm.length-6));
        const xBand=d3.scaleBand().domain(norm.map(d=>+d.date)).range([0,innerW]).padding(0.2);
        g.selectAll("rect.bar").data(norm).join("rect").attr("class","bar")
          .attr("x",d=>xBand(+d.date)+(xBand.bandwidth()-bandwidth)/2).attr("y",d=>y(Math.max(0,d.value)))
          .attr("width",bandwidth).attr("height",d=>Math.abs(y(d.value)-y(0))).attr("fill","currentColor")
          .append("title").text(d=>d3.utcFormat("%Y-%m-%d")(d.date)+" • "+d.value);
      } else if (finalType==="scatter") {
        g.selectAll("circle.dot").data(norm).join("circle").attr("class","dot")
          .attr("cx",d=>x(d.date)).attr("cy",d=>y(d.value)).attr("r",4).attr("fill","currentColor").attr("fill-opacity",0.9)
          .append("title").text(d=>d3.utcFormat("%Y-%m-%d")(d.date)+" • "+d.value);
      }

      g.append("text").attr("x",-innerH/2).attr("y",-margin.left+14).attr("transform","rotate(-90)").attr("text-anchor","middle").style("font-size","12px").text("Sales");
      g.append("text").attr("x",innerW/2).attr("y",innerH+36).attr("text-anchor","middle").style("font-size","12px").text("Date");
      return svg.node();
    }

    // Boot with your provided input
    const INPUT = ${safe({ chartType, data: rows })};
    renderTimeChart("#chart", INPUT, "${chartType}");
  </script>
</body>
</html>`;
}






const data = {
    chartType: "bar",
    data: [
        { date: "2023-01-01", sales: 20 },
        { date: "2023-02-01", sales: 120 },
        { date: "2023-03-01", sales: 150 },
        { date: "2023-04-01", sales: 90 }
    ]
};

const html = buildChartHTML(data);
// paste `html` into your editor, or:
console.log(html);
// const blob = new Blob([html], { type: "text/html" });
// window.open(URL.createObjectURL(blob), "_blank");



// ------------------>>>>>>>>>>>>>>>>>>>>>>>


/**
 * Build HTML (no scripts) for a chart container, based on the input's chartType.
 * - input: array of rows OR { chartType, data }
 * - options.id: optional container id (default "chart")
 * Returns an HTML string you can paste/insert anywhere.
 */
function buildChartContainerHTML(input, options = {}) {
    const id = options.id || "chart";
    const isArray = Array.isArray(input);
    const type = isArray ? (options.chartType || "line") : (input.chartType || "line");

    const title = (type.charAt(0).toUpperCase() + type.slice(1)) + " Chart";

    return `
<div class="card" style="max-width:980px;margin:0 auto;">
  <h2 style="margin:0 0 12px;">${title}</h2>
  <p class="muted" style="margin:0 0 12px;color:#6b7280;">
    Container ready. Render separately with <code>renderTimeChart("#${id}", input, "${type}")</code>.
  </p>
  <div class="chart-wrap" style="width:100%;">
    <div id="${id}" class="time-chart" role="img" aria-label="${type} chart container"></div>
  </div>
</div>`;
}



const input = {
    chartType: "bar",
    data: [
        { date: "2023-01-01", sales: 20 },
        { date: "2023-02-01", sales: 120 },
        { date: "2023-03-01", sales: 150 },
        { date: "2023-04-01", sales: 90 }
    ]
};


function renderTimeChart(container, input, chartType = "auto", options = {}) {
    const d3 = window.d3;
    const root = typeof container === "string" ? document.querySelector(container) : container;
    if (!root) throw new Error("renderTimeChart: container not found");
    Array.from(root.querySelectorAll("svg")).forEach(s => s.remove());

    // support array or { chartType, data }
    let rows = Array.isArray(input) ? input : (input && input.data) ? input.data : [];
    const typeFromInput = !Array.isArray(input) && input && input.chartType;

    const parseDate = d3.utcParse("%Y-%m-%d");
    const norm = rows.map(d => ({
        date: typeof d.date === "string" ? parseDate(d.date) : d.date,
        value: typeof d.sales === "number" ? d.sales :
            (typeof d.value === "number" ? d.value : (+d.sales || +d.value || NaN))
    }))
        .filter(d => d.date instanceof Date && !isNaN(d.date) && Number.isFinite(d.value))
        .sort((a, b) => a.date - b.date);

    const finalType = chartType !== "auto" ? chartType : (typeFromInput || "line");

    const containerBox = root.getBoundingClientRect();
    const width = Math.max(320, options.width || containerBox.width || 640);
    const height = options.height || 360;
    const margin = Object.assign({ top: 24, right: 24, bottom: 48, left: 56 }, options.margin || {});
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(root).append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%").attr("height", height)
        .attr("role", "img").attr("aria-label", finalType + " chart of values over time");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (!norm.length) {
        g.append("text").attr("x", innerW / 2).attr("y", innerH / 2).attr("text-anchor", "middle")
            .style("font", "14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif").text("No valid data to display");
        return svg.node();
    }

    const x = d3.scaleUtc().domain(d3.extent(norm, d => d.date)).range([0, innerW]).nice();
    const y = d3.scaleLinear().domain([0, d3.max(norm, d => d.value) || 0]).nice().range([innerH, 0]);

    g.append("g").attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(Math.min(6, norm.length)).tickFormat(d3.utcFormat("%b %Y")))
        .selectAll("text").style("font-size", "12px");
    g.append("g").call(d3.axisLeft(y).ticks(6).tickSizeOuter(0)).selectAll("text").style("font-size", "12px");

    g.append("g").attr("stroke-opacity", 0.1)
        .call(d3.axisLeft(y).tickSize(-innerW).tickFormat(() => ""))
        .selectAll(".tick line").attr("shape-rendering", "crispEdges");

    if (finalType === "line" || finalType === "area") {
        const line = d3.line().x(d => x(d.date)).y(d => y(d.value)).defined(d => Number.isFinite(d.value));
        if (finalType === "area") {
            const area = d3.area().x(d => x(d.date)).y0(y(0)).y1(d => y(d.value)).defined(d => Number.isFinite(d.value));
            g.append("path").datum(norm).attr("d", area).attr("fill", "currentColor").attr("opacity", 0.15);
        }
        g.append("path").datum(norm).attr("fill", "none").attr("stroke", "currentColor").attr("stroke-width", 2).attr("d", line);
        g.selectAll("circle.point").data(norm).join("circle").attr("class", "point").attr("cx", d => x(d.date)).attr("cy", d => y(d.value)).attr("r", 3).attr("fill", "currentColor")
            .append("title").text(d => d3.utcFormat("%Y-%m-%d")(d.date) + " • " + d.value);
    } else if (finalType === "bar") {
        const bandwidth = Math.max(8, Math.min(48, innerW / norm.length - 6));
        const xBand = d3.scaleBand().domain(norm.map(d => +d.date)).range([0, innerW]).padding(0.2);
        g.selectAll("rect.bar").data(norm).join("rect").attr("class", "bar")
            .attr("x", d => xBand(+d.date) + (xBand.bandwidth() - bandwidth) / 2).attr("y", d => y(Math.max(0, d.value)))
            .attr("width", bandwidth).attr("height", d => Math.abs(y(d.value) - y(0))).attr("fill", "currentColor")
            .append("title").text(d => d3.utcFormat("%Y-%m-%d")(d.date) + " • " + d.value);
    } else if (finalType === "scatter") {
        g.selectAll("circle.dot").data(norm).join("circle").attr("class", "dot")
            .attr("cx", d => x(d.date)).attr("cy", d => y(d.value)).attr("r", 4).attr("fill", "currentColor").attr("fill-opacity", 0.9)
            .append("title").text(d => d3.utcFormat("%Y-%m-%d")(d.date) + " • " + d.value);
    }

    g.append("text").attr("x", -innerH / 2).attr("y", -margin.left + 14).attr("transform", "rotate(-90)").attr("text-anchor", "middle").style("font-size", "12px").text("Sales");
    g.append("text").attr("x", innerW / 2).attr("y", innerH + 36).attr("text-anchor", "middle").style("font-size", "12px").text("Date");
    return svg.node();
}



const html = buildChartContainerHTML(input, { id: "chart" });
// Paste/insert `html` into your page, then render with your existing function:
renderTimeChart("#chart", input, input.chartType);
