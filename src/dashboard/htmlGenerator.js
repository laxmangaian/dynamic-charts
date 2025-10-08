function buildChartHTML(input) {
  const chartType = Array.isArray(input) ? "auto" : (input.chartType || "auto");
  const data = Array.isArray(input) ? input : (input.data || []);
  const options = (input && input.options) || {};
  const safe = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/-->/g, "--\\u003e");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${(options.title || "Chart").replace(/"/g, "&quot;")}</title>
<style>
:root { color-scheme: light white; }
body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; }
.card { max-width: 1180px; margin: 0 auto; }
.muted { color: #6b7280; }
.chart-wrap { width: 100%; }
svg { display: block; width: 100%; height: auto; }
.legend { display:flex; flex-wrap:wrap; gap:8px; align-items:center; font-size:12px; margin-top:8px; }
.legend .item { display:flex; align-items:center; gap:6px; margin-right:10px; }
.legend .swatch { width:12px; height:12px; border-radius:2px; display:inline-block; }
.tooltip { position:fixed; pointer-events:none; background:var(--tbg,rgba(0,0,0,.85)); color:white; padding:6px 8px; border-radius:6px; font-size:12px; z-index:9999; transform:translate(-50%, calc(-100% - 8px)); white-space:nowrap; opacity:0; transition:opacity .1s linear; }
@media (prefers-color-scheme: light) { .tooltip { --tbg: rgba(17,24,39,.92); } }
.up { color: #16a34a; } .down { color: #dc2626; }
</style>
<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3"></script>
<script src="https://d3js.org/d3-hexbin.v0.2.min.js"></script>
<script src="https://unpkg.com/d3-cloud/build/d3.layout.cloud.js"></script>
<script src="https://unpkg.com/d3-sankey@0"></script>
</head>
<body>
<div class="card">
  <h2 style="margin:0 0 12px;">${(options.title || "Chart").replace(/</g, "&lt;")}</h2>
  <p class="muted" style="margin-top:0;">Data driven chart (${chartType}).</p>
  <div class="chart-wrap"><div id="chart" aria-label="chart container"></div></div>
</div>

<script>
(function() {
const INPUT = ${safe({ chartType, data, options })};

const fmt = { dateShort: d3.utcFormat('%b %Y'), dateISO: d3.utcFormat('%Y-%m-%d') };
const parseDate = d3.utcParse('%Y-%m-%d');

function valueOf(d){
  if (typeof d.value === 'number') return d.value;
  if (typeof d.sales === 'number') return d.sales;
  if (typeof d.count === 'number') return d.count;
  const n = +d.value || +d.sales || +d.count;
  return Number.isFinite(n) ? n : NaN;
}
function nameOf(d){ return d.name ?? d.category ?? d.label ?? d.key ?? d.id ?? ''; }
function xNumOf(d){ return (+d.x) || (+d.X) || (+d.lon) || (+d.longitude) || NaN; }
function yNumOf(d){ return (+d.y) || (+d.Y) || (+d.lat) || (+d.latitude) || NaN; }

function normalizeTimeRows(rows){
  return rows.map(function(d){ return {
    date: typeof d.date==='string' ? parseDate(d.date) : d.date,
    value: valueOf(d),
    open:+d.open, high:+d.high, low:+d.low, close:+d.close // for candles
  }; }).filter(function(d){ return d.date instanceof Date && !isNaN(d.date); })
    .sort(function(a,b){ return a.date-b.date; });
}
function normalizeCatRows(rows){
  return rows.map(function(d){ return { key: nameOf(d), value: valueOf(d) }; })
             .filter(function(d){ return d.key!=null && d.key!=='' && Number.isFinite(d.value); });
}
function normalizeXYRows(rows) {
  return rows.map(function (d) {
    const xVal = d.x !== undefined ? d.x : d.xKey;
    const yVal = d.y !== undefined ? d.y : d.yKey;

    return {
      x: (typeof xVal === 'number' ? +xVal : String(xVal)), // keep number or string
      y: (typeof yVal === 'number' ? +yVal : String(yVal)),
      r: (+d.r) || (+d.size) || Math.abs(+d.value) || NaN,
      key: d.key || d.name || ""
    };
  }).filter(function (d) {
    return d.x !== undefined && d.y !== undefined; // allow strings OR numbers
  });
}

function ensureTooltip(){
  var t = document.querySelector('.tooltip');
  if (!t){ t = document.createElement('div'); t.className='tooltip'; document.body.appendChild(t); }
  return t;
}
function showTip(e, html){ var t=ensureTooltip(); t.innerHTML=html; t.style.left=e.clientX+'px'; t.style.top=e.clientY+'px'; t.style.opacity='1'; }
function hideTip(){ var t=document.querySelector('.tooltip'); if(t) t.style.opacity='0'; }

function addLegend(root, items, color){
  var wrap = document.createElement('div'); wrap.className='legend';
  items.forEach(function(k){
    var span = document.createElement('span'); span.className='item';
    span.innerHTML = '<span class="swatch" style="background:'+color(k)+'"></span>'+k;
    wrap.appendChild(span);
  });
  root.appendChild(wrap);
  return wrap;
}

function normalizeDataForMap(rows, features, chartType, dataKeys) {
  const { idKey, nameKey, latKey, lonKey, valueKey } = dataKeys;

  return rows
    .map((d) => {
      // Case 1: explicit lat/lon
      if (latKey in d && lonKey in d) {
        if (chartType === "bubble" || chartType === "spike" || chartType === "hexbin") {
          return {
            name: d[nameKey] || "",
            lat: +d[latKey],
            lon: +d[lonKey],
            value: +d[valueKey] || 0,
          };
        }
        return null;
      }

      // Case 2: countryId/numeric id
      if (idKey && idKey in d) {
        const feature = features.find(
          (f) =>
            f.id == d[idKey] ||
            f.properties?.iso_a3?.toLowerCase() === String(d[idKey]).toLowerCase()
        );
        if (!feature) return null;

        if (chartType === "bubble" || chartType === "spike" || chartType === "hexbin") {
          const [lon, lat] = d3.geoCentroid(feature);
          return { id: feature.id, name: feature.properties.name, lat, lon, value: +d[valueKey] || 0 };
        } else {
          return { id: feature.id, name: feature.properties.name, value: +d[valueKey] || 0 };
        }
      }

      // Case 3: country name
      if (nameKey && nameKey in d) {
        const nameLc = d[nameKey].toLowerCase();
        const feature = features.find(
          (f) => f.properties?.name?.toLowerCase() === nameLc
        );
        if (!feature) return null;

        if (chartType === "bubble" || chartType === "spike" || chartType === "hexbin") {
          const [lon, lat] = d3.geoCentroid(feature);
          return { id: feature.id, name: d[nameKey], lat, lon, value: +d[valueKey] || 0 };
        } else {
          return { id: feature.id, name: d[nameKey], value: +d[valueKey] || 0 };
        }
      }

      return null;
    })
    .filter(Boolean);
}


function render(container, input){
  var root = typeof container==='string' ? document.querySelector(container) : container;
  if (!root) throw new Error('container not found');
  Array.from(root.querySelectorAll('svg, .legend')).forEach(function(n){ n.remove(); });

  var isArray = Array.isArray(input);
  var rows = isArray ? input : (input && input.data) ? input.data : [];
  var type = (!isArray && input && input.chartType) ? input.chartType : (input.chartType || 'auto');
  var opts = (input && input.options) || {};

  var box = root.getBoundingClientRect();
  var width = Math.max(360, opts.width || box.width || 900);
  var height = opts.height || 480;
  var margin = Object.assign({ top: 24, right: 24, bottom: 56, left: 64 }, opts.margin || {});
  var innerW = width - margin.left - margin.right;
  var innerH = height - margin.top - margin.bottom;
  var colorScheme = opts.colorScheme || d3.schemeTableau10;

  var svg = d3.select(root).append('svg')
    .attr('viewBox', '0 0 '+width+' '+height)
    .attr('width', '100%').attr('height', height)
    .attr('role','img').attr('aria-label', type + ' chart');
  var g = svg.append('g').attr('transform', 'translate('+margin.left+','+margin.top+')');

  // dispatch
  if (['line','area','bar','scatter','barline'].includes(type)){ renderTimeLike(g, rows, type, innerW, innerH, { margin: margin, opts: opts, root: root }); return; }
  if (['xy-scatter','bubble'].includes(type)){ renderXYLike(g, rows, type, innerW, innerH, { margin: margin, opts: opts, root: root, colorScheme: colorScheme }); return; }
  if (['pie','donut','arc', 'halfPie'].includes(type)){ renderRadialLike(g, rows, type, innerW, innerH, { opts: opts }); return; }
  if (type==='nested-pies'){ renderNestedPies(g, rows, innerW, innerH, { root: root, opts: opts, colorScheme: colorScheme }); return; }
  if (type==='calendar-heatmap'){ renderCalendarHeatmap(g, rows, innerW, innerH, { opts: opts }); return; }
  if (type==='matrix-heatmap'){ renderMatrixHeatmap(g, rows, innerW, innerH, { margin: margin, colorScheme: colorScheme, root: root, opts: opts }); return; }
  if (type==='tree'){ renderTreeLike(g, input.data, innerW, innerH, { opts: opts }); return; }
  if (type==='dendrogram'){ renderDendrogram(g, input, innerW, innerH, { opts: opts }); return; }
  if (type==='kmeans'){ renderKMeans(g, rows, innerW, innerH, { margin: margin, opts: opts, root: root, colorScheme: colorScheme }); return; }
  if (type==='exp-regression'){ renderExpRegression(g, rows, innerW, innerH, { margin: margin, opts: opts, root: root }); return; }
  if (type==='candlestick'){ renderCandlestick(g, rows, innerW, innerH, { margin: margin, opts: opts, root: root }); return; }
  if (type==='bump'){ renderBump(g, rows, innerW, innerH, { margin: margin, opts: opts, root: root, colorScheme: colorScheme }); return; }
  if (type==='force'){ renderForce(g, input, innerW, innerH, { svg: svg, root: root, opts: opts }); return; }
  if (type==='grouped-bar'){ renderGroupedBar(g, rows, innerW, innerH, { margin, opts: opts, root, colorScheme }); return; }
  if (['stacked-area','stacked-line'].includes(type)){ renderStackedChart(g, rows, type, innerW, innerH, { margin: margin, opts: opts, root: root }); return; }
  if (type === 'sunburst') { renderSunburst(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); }
  if (type==='histogram'){ renderHistogram(g, rows, innerW, innerH, { margin, opts, root }); return; }
  if (type==='treemap'){ renderTreemap(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }
  if (type === 'box-plot') { renderBoxPlot(g, rows, innerW, innerH, { margin, opts, root }); return; }
  if (type ==='radial-area'){ renderRadialAreaChart(g, rows, innerW, innerH, { margin, opts, root }); return; }
  if (type === 'word-cloud') { renderWordCloud(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }
  if (type === 'hexbin'){ renderHexbin(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }
  if (type === 'sankey') { renderSankeyLike(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }
  if (['choropleth-countryname', 'choropleth-countryId'].includes(type)) { renderChoropleth(g, rows, innerW, innerH, { svg: svg, root: root, opts: opts, width: width, height: height, margin: margin, colorScheme: colorScheme }); return; }
  if (['geo-spike-latlon', 'geo-spike-countryId', 'geo-spike-countryname'].includes(type)) { renderSpikeMap(g, rows, innerW, innerH, { svg: svg, root: root, opts: opts, width: width, height: height, margin: margin, colorScheme: colorScheme }); return; }
  if (['geo-bubble-latlon', 'geo-bubble-countryname', 'geo-bubble-countryId'].includes(type)) { renderBubbleMap(g, rows, innerW, innerH, { svg: svg, root: root, opts: opts, width: width, height: height, margin: margin, colorScheme: colorScheme }); return; }
  if (['geo-graph-latlon', 'geo-graph-countryname', 'geo-graph-countryId'].includes(type)) { renderGeoGraph(g, rows, innerW, innerH, { svg: svg, root: root, opts: opts, width: width, height: height, margin: margin }); return; }
  if (['geo-hexbin-latlon', 'geo-hexbin-countryname', 'geo-hexbin-countryId'].includes(type)) { renderHexbinMap(g, rows, innerW, innerH, { svg: svg, root: root, opts: opts, width: width, height: height, margin: margin, colorScheme: colorScheme }); return; }
  if (type === 'circle-pack') { renderPackChart(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }
  if (type === 'chord') { renderChordChart(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }
  if (type === 'arc-diagram') { renderArcDiagram(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }
  if (type === 'qq-plot') { renderQQPlot(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }
  if (type === 'pannable') { renderPannableAreaChart(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }


  // -------- Renderers (existing ones unchanged, some omitted for brevity in comments) --------
  function renderTimeLike(g, rows, type, innerW, innerH, ctx) {
    var margin = ctx.margin, opts = ctx.opts, root = ctx.root;

    var xKey = opts.dataKeys.xKey || "date";
    var yKey = opts.dataKeys.yKey || "value";

    // --- Normalize data ---
    var norm = rows.map(function(d) {
        return { x: d[xKey], y: d[yKey] };
    }).filter(d => d.x != null && d.y != null);

    if (!norm.length) {
        g.append('text')
            .attr('x', innerW/2).attr('y', innerH/2)
            .attr('text-anchor','middle')
            .text('No valid data');
        return;
    }

    // --- Axis type detection ---
    var isDate = norm.every(d => typeof d.x === "string" && !isNaN(Date.parse(d.x)));
    var isYNumeric = norm.every(d => Number.isFinite(+d.y));

    // If numeric y → cast
    if (isYNumeric) {
        norm = norm.map(d => ({ x: d.x, y: +d.y }));
    }

    // --- X scale ---
    var x = isDate
        ? d3.scaleUtc()
            .domain(d3.extent(norm, d => new Date(d.x)))
            .range([0, innerW])
            .nice()
        : d3.scaleBand()
            .domain(norm.map(d => d.x))
            .range([0, innerW])
            .padding(0.2);

    // --- Y scale ---
    var y = isYNumeric
        ? d3.scaleLinear()
            .domain([0, d3.max(norm, d => d.y)]).nice()
            .range([innerH, 0])
        : d3.scaleBand()
            .domain(norm.map(d => d.y))
            .range([innerH, 0])
            .padding(0.2);

    // --- Axes ---
    g.append('g')
        .attr('transform', 'translate(0,'+innerH+')')
        .call(isDate
            ? d3.axisBottom(x).ticks(Math.min(6,norm.length)).tickFormat(d3.utcFormat('%b %d'))
            : d3.axisBottom(x)
        );

    g.append('g')
        .call(isYNumeric
            ? d3.axisLeft(y).ticks(6).tickSizeOuter(0)
            : d3.axisLeft(y)
        );

    if (isYNumeric) {
        g.append('g').attr('stroke-opacity',0.1)
            .call(d3.axisLeft(y).tickSize(-innerW).tickFormat(() => ''));
    }

    // --- Line / Area rendering ---
    var lineCfg = Object.assign({
        stroke: "currentColor",
        strokeWidth: 2,
        pointShow: true,
        pointRadius: 3,
        pointColor: "currentColor"
    }, opts.line || {});

    if (['line','area','barline'].includes(type)) {
        var line = d3.line()
            .x(d => isDate ? x(new Date(d.x)) : x(d.x) + (x.bandwidth ? x.bandwidth()/2 : 0))
            .y(d => isYNumeric ? y(d.y) : y(d.y) + y.bandwidth()/2);

        g.append('path')
            .datum(norm)
            .attr('fill','none')
            .attr('stroke', lineCfg.stroke)
            .attr('stroke-width', lineCfg.strokeWidth)
            .attr('d', line);
    }

    if (type==='area') {
        var area = d3.area()
            .x(d => isDate ? x(new Date(d.x)) : x(d.x) + (x.bandwidth ? x.bandwidth()/2 : 0))
            .y0(y(0))
            .y1(d => isYNumeric ? y(d.y) : y(d.y) + y.bandwidth()/2);

        g.append('path')
            .datum(norm)
            .attr('d', area)
            .attr('fill', lineCfg.stroke)
            .attr('opacity',0.15);
    }

    // --- Bars ---
    if (type==='bar' || type==='barline') {
        var barCfg = Object.assign({
            fill: "currentColor",
            stroke: null,
            strokeWidth: 0,
            opacity: 1,
            cornerRadius: 0,
            hoverFill: null,
            animationDuration: 600
        }, opts.bar || {});

        var bars = g.selectAll('rect.bar').data(norm).join('rect')
            .attr('class','bar')
            .attr('x', d => isDate ? x(new Date(d.x)) : x(d.x))
            .attr('y', innerH) // start at bottom (for animation)
            .attr('width', isDate ? innerW/norm.length * 0.7 : x.bandwidth())
            .attr('height', 0)
            .attr('fill', barCfg.fill)
            .attr('stroke', barCfg.stroke)
            .attr('stroke-width', barCfg.strokeWidth)
            .attr('opacity', barCfg.opacity)
            .on('pointerenter', function(e,d){ 
                if(barCfg.hoverFill) d3.select(this).attr('fill',barCfg.hoverFill);
                showTip(e, d.x+' • '+d.y); 
            })
            .on('pointermove', function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
            .on('pointerleave', function(e,d){ 
                if(barCfg.hoverFill) d3.select(this).attr('fill',barCfg.fill);
                hideTip(); 
            });

        // animate bars growing up
        bars.transition().duration(barCfg.animationDuration)
            .attr('y', d => isYNumeric ? y(Math.max(0,d.y)) : y(d.y))
            .attr('height', d => isYNumeric ? Math.abs(y(d.y)-y(0)) : y.bandwidth())
            .attr('rx', barCfg.cornerRadius)
            .attr('ry', barCfg.cornerRadius);
    }

    // --- Points for line/area ---
    if (lineCfg.pointShow && type!=='bar') {
        g.selectAll('circle.pt').data(norm).join('circle')
            .attr('class','pt')
            .attr('cx', d => isDate ? x(new Date(d.x)) : x(d.x) + (x.bandwidth? x.bandwidth()/2 : 0))
            .attr('cy', d => isYNumeric ? y(d.y) : y(d.y) + y.bandwidth()/2)
            .attr('r', lineCfg.pointRadius)
            .attr('fill', lineCfg.pointColor)
            .on('pointerenter', function(e,d){ showTip(e, d.x+' • '+d.y); })
            .on('pointermove', function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
            .on('pointerleave', hideTip);
    }

    // --- Labels ---
    g.append('text')
        .attr('x', -innerH/2).attr('y', -margin.left+14)
        .attr('transform','rotate(-90)')
        .attr('text-anchor','middle')
        .style('font-size','12px')
        .text(opts.yLabel || yKey);

    g.append('text')
        .attr('x', innerW/2).attr('y', innerH+40)
        .attr('text-anchor','middle')
        .style('font-size','12px')
        .text(opts.xLabel || xKey);

    // --- Legend ---
    addLegend(root, [opts.seriesLabel || 'Series'], function(){ 
        return type==='bar' ? (opts.bar?.fill || "currentColor") : lineCfg.stroke; 
    });
  }


  function renderXYLike(g, rows, type, innerW, innerH, ctx) {
    var margin = ctx.margin,
        opts = ctx.opts,
        root = ctx.root,
        colorScheme = ctx.colorScheme;

    // Resolve dynamic keys from config
    var { xKey, yKey, rKey, keyKey } = opts.dataKeys || {};
    xKey = xKey || "x";
    yKey = yKey || "y";
    rKey = rKey || "r";
    keyKey = keyKey || "key";

    // Normalize with keys
    var norm = rows.map(d => ({
      x: d[xKey],
      y: d[yKey],
      r: d[rKey],
      key: d[keyKey]
    }));

    if (!norm.length) {
      g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH / 2)
        .attr("text-anchor", "middle")
        .text("No valid data");
      return;
    }

    // Determine if x/y are numeric or string
    var xIsNumeric = norm.every(d => typeof d.x === 'number');
    var yIsNumeric = norm.every(d => typeof d.y === 'number');

    // === Scales ===
    var x = xIsNumeric
      ? d3.scaleLinear().domain(opts.xDomain || d3.extent(norm, d => d.x)).nice().range([0, innerW])
      : d3.scaleBand().domain(norm.map(d => d.x)).range([0, innerW]).padding(0.1);

    var y = yIsNumeric
      ? d3.scaleLinear().domain(opts.yDomain || d3.extent(norm, d => d.y)).nice().range([innerH, 0])
      : d3.scaleBand().domain(norm.map(d => d.y)).range([innerH, 0]).padding(0.1);

    // Bubble radius
    var rMax = d3.max(norm, d => Number.isFinite(d.r) ? d.r : (opts.dotRadius || 3)) || (opts.dotRadius || 3);
    var r = d3.scaleSqrt().domain([0, rMax])
      .range([opts.bubbleMinRadius || 3, opts.bubbleMaxRadius || Math.min(innerW, innerH) / 10]);

    var color = d3.scaleOrdinal().domain(norm.map(d => d.key)).range(colorScheme);

    // === Axes ===
    g.append('g')
      .attr('transform', 'translate(0,' + innerH + ')')
      .call(xIsNumeric ? d3.axisBottom(x).ticks(opts.xTicks || 6) : d3.axisBottom(x));

    g.append('g')
      .call(yIsNumeric ? d3.axisLeft(y).ticks(opts.yTicks || 6) : d3.axisLeft(y));

    if (opts.grid && yIsNumeric) {
      g.append('g')
        .attr('stroke-opacity', 0.1)
        .call(d3.axisLeft(y).tickSize(-innerW).tickFormat(() => ''));
    }

    // === Dots / Bubbles ===
    g.selectAll('circle.dot')
      .data(norm)
      .join('circle')
      .attr('class', 'dot')
      .attr('cx', d => xIsNumeric ? x(d.x) : x(d.x) + x.bandwidth()/2)
      .attr('cy', d => yIsNumeric ? y(d.y) : y(d.y) + y.bandwidth()/2)
      .attr('r', d => (type === 'bubble' && Number.isFinite(d.r)) ? r(d.r) : (opts.dotRadius || 4))
      .attr('fill', d => color(d.key || ''))
      .attr('fill-opacity', opts.dotOpacity || 0.85)
      .attr('stroke', opts.dotStroke?.color || null)
      .attr('stroke-width', opts.dotStroke?.width || null)
      .on('pointerenter', (e,d) => showTip(e, 
        (d.key ? d.key + ' • ' : '') + 
        opts.xLabel + '=' + d.x + ', ' + 
        opts.yLabel + '=' + d.y + 
        (type==='bubble' && Number.isFinite(d.r) ? ', r=' + d.r : '')
      ))
      .on('pointermove', e => showTip(e, document.querySelector('.tooltip').innerHTML))
      .on('pointerleave', hideTip);

    // === Axis Labels ===
    g.append('text')
      .attr('x', -innerH/2)
      .attr('y', -margin.left + 14)
      .attr('transform', 'rotate(-90)')
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(opts.yLabel || 'Y');

    g.append('text')
      .attr('x', innerW/2)
      .attr('y', innerH + 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(opts.xLabel || 'X');

    // === Legend ===
    var legendItems = Array.from(new Set(norm.map(d => d.key))).filter(v => !!v);
    if (legendItems.length) addLegend(root, legendItems, k => color(k));
    if (type === 'bubble') addLegend(root, ['Small', 'Large'], k => k==='Small' ? '#a3a3a3' : '#404040');
  }


  function renderRadialLike(g, rows, type, innerW, innerH, ctx){
    var root = ctx.root, colorScheme = ctx.colorScheme;
    var opts = ctx.opts || {};

    var labelKey = opts.dataKeys.labelKey || "label";
    var valueKey = opts.dataKeys.valueKey || "value";
    var norm = rows.map(d => ({ key: d[labelKey], value: +d[valueKey] }))
                .filter(d => d.key != null && Number.isFinite(d.value));

    var cx = innerW/2, cy = innerH/2;
    var R = Math.min(innerW, innerH)/2;
    var innerR = opts.innerRadius ?? (type==='donut' ? R*0.6 : 0);
    var outerR = opts.outerRadius ?? R;
    var cornerRadius = opts.cornerRadius || 0;
    var padAngle = opts.padAngle || 0;
    var hoverFill = opts.hoverFill || null;
    var animDur = opts.animationDuration || 600;

    var color = d3.scaleOrdinal().domain(norm.map(d=>d.key))
                .range(opts.colors || colorScheme);

    if (!norm.length){
        g.append('text').attr('x',cx).attr('y',cy).attr('text-anchor','middle')
        .text('No valid data');
        return;
    }

    // pie generator
    var pie = d3.pie()
        .value(d => d.value)
        .sort(null)
        .padAngle(padAngle);

    // halfPie support
    if (type === "halfPie"){
        pie.startAngle(-Math.PI/2).endAngle(Math.PI/2);
    }

    var arcs = pie(norm);
    var arcGen = d3.arc()
        .innerRadius(innerR)
        .outerRadius(outerR)
        .cornerRadius(cornerRadius);

    g.attr('transform','translate('+cx+','+cy+')');

    var slices = g.selectAll('path.slice').data(arcs).join('path')
        .attr('class','slice')
        .attr('fill', d => color(d.data.key))
        .attr('stroke', opts.stroke || "#fff")
        .attr('stroke-width', opts.strokeWidth || 0)
        .attr('opacity', opts.opacity ?? 1)
        .on('pointerenter', function(e,d){ 
            if (hoverFill) d3.select(this).attr('fill',hoverFill);
            showTip(e, d.data.key+': '+d.data.value);
        })
        .on('pointermove',function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
        .on('pointerleave', function(e,d){ 
            d3.select(this).attr('fill',color(d.data.key));
            hideTip();
        });

    // animate from 0 angle
    slices.transition().duration(animDur)
        .attrTween("d", function(d){
            var i = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d);
            return function(t){ return arcGen(i(t)); };
        });

    // labels
    if (opts.showLabels){
        var labelArc = d3.arc().innerRadius(outerR + (opts.labelOffset || 15))
                                .outerRadius(outerR + (opts.labelOffset || 15));
        g.selectAll("text.label").data(arcs).join("text")
            .attr("class","label")
            .attr("transform", d => "translate("+labelArc.centroid(d)+")")
            .attr("text-anchor","middle")
            .style("font-size", (opts.labelFontSize || 12) + "px")
            .style("font-weight", opts.labelFontWeight || "normal")
            .style("fill", opts.labelColor || "#000")
            .text(d => d.data.key);
    }

    addLegend(root, norm.map(d => d.key), k => color(k));
  }


  function renderGroupedBar(g, rows, innerW, innerH, ctx){
    var margin = ctx.margin, opts = ctx.opts || {}, root = ctx.root;

    // Read dynamic keys from config
    var { xKey, yKey, groupKey } = opts.dataKeys || {};
    xKey = xKey || "x";
    yKey = yKey || "y";
    groupKey = groupKey || "group";

    // Map rows -> canonical {group, series, value}
    var data = rows.map(function(r){
        return {
          group: r[groupKey] ?? nameOf(r),
          series: r[xKey] ?? 'Series',
          value: +r[yKey]
        };
      })
      .filter(function(d){ return d.group != null && d.series != null && Number.isFinite(d.value); });

    if (!data.length){
      g.append('text')
        .attr('x', innerW/2).attr('y', innerH/2).attr('text-anchor','middle')
        .text("Provide {" + groupKey + "," + xKey + "," + yKey + "} rows");
      return;
    }

    var groups = Array.from(new Set(data.map(d => d.group)));
    var series = Array.from(new Set(data.map(d => d.series)));

    // Scales & paddings
    var x0 = d3.scaleBand().domain(groups).range([0, innerW]).padding(opts.groupPadding ?? 0.2);
    var x1 = d3.scaleBand().domain(series).range([0, x0.bandwidth()]).padding(opts.barPadding ?? 0.1);
    var y  = d3.scaleLinear().domain([0, d3.max(data, d => d.value) || 0]).nice().range([innerH, 0]);

    // Color handling
    var color;
    if (Array.isArray(opts.colorBase)) {
      var palette = opts.colorBase.slice();
      while (palette.length < series.length) palette = palette.concat(palette);
      color = d3.scaleOrdinal().domain(series).range(palette.slice(0, series.length));
    } else if (typeof opts.colorBase === 'string') {
      var base = opts.colorBase;
      var palette = series.map(function(_, i){
        var t = series.length === 1 ? 0.5 : (series.length === 2 ? i : i / (series.length - 1));
        return d3.interpolateRgb(base, "#0b0b0b")(t * 0.7);
      });
      color = d3.scaleOrdinal().domain(series).range(palette);
    } else {
      var scheme = ctx.colorScheme || d3.schemeCategory10;
      color = d3.scaleOrdinal().domain(series).range(series.map((_, i) => scheme[i % scheme.length]));
    }

    // Axes
    g.append('g').attr('transform','translate(0,' + innerH + ')').call(d3.axisBottom(x0));
    g.append('g').call(d3.axisLeft(y).ticks(opts.yTicks || 6));
    if (opts.showGrid) {
      g.append('g').attr('stroke-opacity', 0.08)
        .call(d3.axisLeft(y).tickSize(-innerW).tickFormat(() => ''));
    }

    // Bars
    g.selectAll('g.grp').data(groups).join('g')
      .attr('class','grp')
      .attr('transform', d => 'translate(' + x0(d) + ',0)')
      .selectAll('rect')
      .data(d => series.map(s => ({
        group: d,
        series: s,
        value: (data.find(x => x.group === d && x.series === s) || { value: 0 }).value
      })))
      .join('rect')
      .attr('x', d => x1(d.series))
      .attr('y', d => y(d.value))
      .attr('width', x1.bandwidth())
      .attr('height', d => innerH - y(d.value))
      .attr('rx', opts.barRadius ?? 2)
      .attr('ry', opts.barRadius ?? 2)
      .attr('fill', d => color(d.series))
      .attr('fill-opacity', opts.barOpacity ?? 0.95)
      .on('pointerenter', (e,d) => showTip(e, d.group + ' • ' + d.series + ' • ' + d.value))
      .on('pointermove', e => showTip(e, document.querySelector('.tooltip').innerHTML))
      .on('pointerleave', hideTip);

    // Legend
    if (opts.showLegend !== false) {
      addLegend(root, series, k => color(k), opts.legendPosition || 'right');
    }

    // Axis labels
    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 40).attr('text-anchor','middle')
      .style('font-size','12px')
      .text(opts.xLabel || 'Group');

    g.append('text')
      .attr('x', -innerH / 2).attr('y', -margin.left + 14)
      .attr('transform','rotate(-90)')
      .attr('text-anchor','middle').style('font-size','12px')
      .text(opts.yLabel || 'Value');
  }


  function renderHistogram(g, input, innerW, innerH, ctx) {
    const margin = ctx.margin, opts = ctx.opts || {}, root = ctx.root;

    // Extract values from input.data using the key from dataKeys
    const valuesKey = opts.dataKeys?.valuesUnits || 'values';
    const values = (input?.[valuesKey] ?? [])
      .map(v => (typeof v === 'number' ? v : Number(v)))
      .filter(Number.isFinite);

    if (!values.length) {
      g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH / 2)
        .attr("text-anchor", "middle")
        .text("Provide numeric values");
      return;
    }

    // X scale
    const x = d3.scaleLinear()
      .domain(d3.extent(values)).nice()
      .range([0, innerW]);

    // Bins
    const bin = d3.bin()
      .domain(x.domain())
      .thresholds(opts.bins || 20);

    const bins = bin(values);

    // Y scale
    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, b => b.length) || 1]).nice()
      .range([innerH, 0]);

    // Axes
    if (opts.showAxis !== false) {
      g.append("g")
        .attr("transform", "translate(0, " + innerH + ")")
        .call(d3.axisBottom(x).tickFormat(d3.format(".2f")));

      g.append("g")
        .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format("d")));
    }

    // Grid
    if (opts.showGrid) {
      g.append("g")
        .attr("stroke-opacity", 0.08)
        .call(d3.axisLeft(y).tickSize(-innerW).tickFormat(() => ""));
    }

    // Bars
    g.selectAll("rect.bar")
      .data(bins)
      .join("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.x0) + 1)
      .attr("y", d => y(d.length))
      .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr("height", d => innerH - y(d.length))
      .attr("fill", opts.barColor || "currentColor")
      .attr("opacity", opts.barOpacity ?? 0.8)
      .on("pointerenter", (e, d) => {
        const content = "[" + d.x0.toFixed(2) + "," + d.x1.toFixed(2) + ") • n = " + d.length;
        showTip(e, content);
      })
      .on("pointermove", e => showTip(e, document.querySelector(".tooltip").innerHTML))
      .on("pointerleave", hideTip);

    // Axis labels
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 40)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text(opts.xLabel || "Value");

    g.append("text")
      .attr("x", -innerH / 2)
      .attr("y", -margin.left + 14)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text(opts.yLabel || "Count");

    // Optional: mean & median lines
    if (opts.showMean || opts.showMedian) {
      const mean = d3.mean(values);
      const median = d3.median(values);

      const drawLine = val => g.append("line")
        .attr("x1", x(val))
        .attr("x2", x(val))
        .attr("y1", 0)
        .attr("y2", innerH)
        .attr("stroke", opts.meanLineColor || "red")
        .attr("stroke-dasharray", "4,2");

      if (opts.showMean) drawLine(mean);
      if (opts.showMedian) drawLine(median);
    }
  }


  function renderTreemap(g, input, innerW, innerH, ctx) {
    var opts = ctx.opts || {};
    var rootEl = ctx.root;
    var scheme = opts.colorScheme || d3.schemeTableau10;

    var groupKey = (opts.dataKeys && opts.dataKeys.groupKey) || 'group';
    var nameKey = (opts.dataKeys && opts.dataKeys.nameKey) || 'name';
    var valueKey = (opts.dataKeys && opts.dataKeys.valueKey) || 'value';

    // Use input as rows directly if it's an array
    var rows = Array.isArray(input) ? input : (input && input.data) || [];

    if (!rows || !rows.length) {
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH / 2)
        .attr('text-anchor', 'middle')
        .text('No data provided');
      return;
    }

    // Prepare hierarchical tree
    var flat = rows.map(function(r){
      return {
        group: r[groupKey] != null ? r[groupKey] : 'All',
        name: r[nameKey],
        value: +r[valueKey]
      };
    }).filter(function(d){ return d.name != null && Number.isFinite(d.value); });

    if (!flat.length) {
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH / 2)
        .attr('text-anchor', 'middle')
        .text('Provide valid {name,value} data');
      return;
    }

    var byGroup = d3.groups(flat, function(d){ return d.group; })
      .map(function(group){
        return {
          name: group[0],
          children: group[1].map(function(a){ return { name: a.name, value: a.value }; })
        };
      });

    var tree = { name: 'root', children: byGroup };

    // Hierarchy + treemap layout
    var root = d3.hierarchy(tree)
      .sum(function(d){ return d.value || 0; })
      .sort(function(a,b){ return b.value - a.value; });

    d3.treemap()
      .size([innerW, innerH])
      .paddingInner(opts.paddingInner != null ? opts.paddingInner : 2)
      .paddingOuter(opts.paddingOuter != null ? opts.paddingOuter : 0)
      .round(opts.round != null ? opts.round : true)(root);

    var groups = root.children ? root.children.map(function(d){ return d.data.name; }) : [];
    var color = d3.scaleOrdinal(scheme).domain(groups);

    if (groups.length && opts.legend !== false) {
      addLegend(rootEl, groups, function(k){ return color(k); });
    }

    var cells = g.selectAll('g.cell')
      .data(root.leaves())
      .join('g')
      .attr('class', 'cell')
      .attr('transform', function(d){ return 'translate(' + d.x0 + ',' + d.y0 + ')'; });

    cells.append('rect')
      .attr('width', function(d){ return d.x1 - d.x0; })
      .attr('height', function(d){ return d.y1 - d.y0; })
      .attr('fill', function(d){ return color(d.parent ? d.parent.data.name : 'All'); })
      .attr('fill-opacity', opts.cellOpacity != null ? opts.cellOpacity : 0.9)
      .on('pointerenter', function(e,d){
        if (opts.tooltip) showTip(e, d.ancestors().slice(1).map(function(a){ return a.data.name; }).join(' > ') + ' • ' + (d.value || 0));
      })
      .on('pointermove', function(e){
        if (opts.tooltip) showTip(e, document.querySelector('.tooltip').innerHTML);
      })
      .on('pointerleave', function(){
        if (opts.tooltip) hideTip();
      });

    if (opts.showLabels) {
      cells.append('text')
        .attr('x', opts.textPadding != null ? opts.textPadding : 4)
        .attr('y', opts.textYOffset != null ? opts.textYOffset : 14)
        .style('font-size', opts.labelFontSize != null ? opts.labelFontSize : 12)
        .style('fill', opts.labelColor != null ? opts.labelColor : '#fff')
        .text(function(d){ return d.data.name; })
        .attr('pointer-events','none')
        .each(function(d){
          var w = d.x1 - d.x0;
          if (w < (opts.minLabelWidth != null ? opts.minLabelWidth : 40)) this.textContent = null;
        });
    }
  }


  function renderNestedPies(g, rows, innerW, innerH, ctx) {
    var opts = ctx.opts || {};
    var cx = innerW / 2, cy = innerH / 2;
    var R = Math.min(innerW, innerH) / 2;

    // === Extract keys from opts.dataKeys ===
    var levelKey = opts.dataKeys?.levelKey || "level";
    var nameKey  = opts.dataKeys?.nameKey  || "name";
    var valueKey = opts.dataKeys?.valueKey || "value";

    // === Normalize data: flat list → hierarchy ===
    var tree = Array.isArray(rows)
      ? {
          name: "root",
          children: d3.groups(rows, d => d[levelKey])
            .sort((a, b) => d3.ascending(a[0], b[0]))
            .map(level => ({
              name: String(level[0]),
              children: level[1].map(r => ({
                name: r[nameKey],
                value: +r[valueKey]
              }))
            }))
        }
      : rows;

    var rootH = d3.hierarchy(tree).sum(d => d[valueKey] || 0);
    var levels = rootH.height + 1;

    var ringWidth = opts.ringWidth || (R / (levels + 0.5));
    var color = opts.colorByLevel
      ? d3.scaleOrdinal(d3.schemeCategory10).domain(rootH.children.map(d => d.data.name))
      : d3.scaleOrdinal(d3.schemeTableau10);

    g.attr("transform", "translate(" + cx + "," + cy + ")");

    var partition = d3.partition().size([2 * Math.PI, R])(rootH);

    g.selectAll("path")
      .data(partition.descendants().filter(d => d.depth > 0))
      .join("path")
      .attr("d", d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1))
      .attr("fill", d => {
        return opts.colorByLevel
          ? color(d.ancestors()[1]?.data.name || d.data.name)
          : color(d.ancestors().map(a => a.data.name).reverse().join("/"));
      })
      .attr("fill-opacity", opts.fillOpacity ?? 0.9)
      .attr("stroke", opts.strokeColor || "#fff")
      .attr("stroke-width", opts.strokeWidth || 1)
      .on("pointerenter", function (e, d) {
        var label = d.ancestors().map(a => a.data.name).reverse().slice(1).join(" › ");
        showTip(e, (label || "(root)") + ": " + (d.value || 0));
      })
      .on("pointermove", function (e) {
        showTip(e, document.querySelector(".tooltip").innerHTML);
      })
      .on("pointerleave", hideTip);

    // === Labels ===
    if (opts.showLabels) {
      g.selectAll("text.slice-label")
        .data(partition.descendants().filter(d => d.depth > 0))
        .join("text")
        .attr("class", "slice-label")
        .attr("transform", d => {
          const [x, y] = d3.arc().centroid(d);
          return "translate(" + x + "," + y + ")";
        })
        .attr("text-anchor", "middle")
        .style("font-size", opts.labelSize || "10px")
        .text(d => d.data.name);
    }

    // === Title ===
    if (opts.title) {
      g.append("text")
        .attr("x", 0)
        .attr("y", -R - 10)
        .attr("text-anchor", "middle")
        .style("font-size", opts.titleSize || "14px")
        .style("font-weight", "bold")
        .text(opts.title);
    }
  }


  function renderCalendarHeatmap(g, rows, innerW, innerH, ctx) {
    var opts = ctx.opts || {};
    var { dateKey, valueKey } = opts.dataKeys || {};
    dateKey = dateKey || "date";
    valueKey = valueKey || "value";

    // Normalize time rows dynamically
    var norm = rows.map(d => ({
      date: new Date(d[dateKey]),
      value: d[valueKey]
    }));

    if (!norm.length) {
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH / 2)
        .attr('text-anchor', 'middle')
        .text('No valid data');
      return;
    }

    // Common values
    var cell = opts.cellSize || 14;
    var gap = opts.cellGap || 2;
    var baseColor = opts.baseColor || "#1f77b4";
    var maxValue = d3.max(norm, d => d.value) || 1;

    // Color scale
    var color = d3.scaleLinear()
      .domain(opts.colorDomain || [0, maxValue])
      .range(["#e5e7eb", baseColor])
      .interpolate(d3.interpolateLab);

    // Group by year
    var byYear = d3.groups(norm, d => d.date.getUTCFullYear());
    var years = byYear.map(d => d[0]).sort(d3.ascending);

    years.forEach(function (yr, yi) {
      var Y = yi * (cell * 7 + (opts.yearSpacing || 40));
      var data = byYear.find(d => d[0] === yr)[1];
      var map = new Map(data.map(d => [fmt.dateISO(d.date), d.value]));

      // Year label
      g.append('text')
        .attr('x', 0)
        .attr('y', Y + 12)
        .style('font-size', (opts.yearLabelFontSize || 12) + 'px')
        .style('fill', opts.yearLabelColor || "#000")
        .text(yr);

      var first = new Date(Date.UTC(yr, 0, 1));
      var last = new Date(Date.UTC(yr, 11, 31));
      var days = d3.utcDays(first, d3.utcDay.offset(last, 1));

      var group = g.append('g').attr('transform', 'translate(40,' + Y + ')');

      // Month labels
      if (opts.showMonthLabels) {
        var months = d3.utcMonths(first, last);
        group.selectAll("text.month")
          .data(months)
          .join("text")
          .attr("class", "month")
          .attr("x", d => d3.utcWeek.count(d3.utcYear(d), d) * (cell + gap))
          .attr("y", 10)
          .attr("text-anchor", "start")
          .style("font-size", (opts.monthLabelFontSize || 10) + "px")
          .style("fill", opts.monthLabelColor || "#555")
          .text(d3.utcFormat("%b"));
      }

      // Day cells
      var rects = group.selectAll('rect.day')
        .data(days)
        .join('rect')
        .attr('class', 'day')
        .attr('width', cell)
        .attr('height', cell)
        .attr('x', d => d3.utcWeek.count(new Date(Date.UTC(yr, 0, 1)), d) * (cell + gap))
        .attr('y', d => d.getUTCDay() * (cell + gap) + 16)
        .attr('rx', opts.cellRadius ?? 2)
        .attr('ry', opts.cellRadius ?? 2)
        .attr('fill', d => {
          var v = map.get(fmt.dateISO(d)) || 0;
          return v === 0 ? (opts.missingFill || "#e5e7eb") : color(v);
        })
        .on('pointerenter', function (e, d) {
          var v = map.get(fmt.dateISO(d)) || 0;
          showTip(e, fmt.dateISO(d) + ' • ' + v);
        })
        .on('pointermove', function (e) {
          showTip(e, document.querySelector('.tooltip').innerHTML);
        })
        .on('pointerleave', hideTip);

      // Animate
      if (opts.animate ?? true) {
        rects.attr("fill-opacity", 0)
          .transition().duration(500)
          .attr("fill-opacity", 1);
      }
    });
  }


  function renderMatrixHeatmap(g, rows, innerW, innerH, ctx) {
    var opts = ctx.opts || {};
    var { xKey, yKey, valueKey } = opts.dataKeys || {};
    xKey = xKey || "x";
    yKey = yKey || "y";
    valueKey = valueKey || "value";

    // Extract unique X and Y values dynamically
    var xs = Array.from(new Set(rows.map(r => r[xKey])));
    var ys = Array.from(new Set(rows.map(r => r[yKey])));

    if (!xs.length || !ys.length) {
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH / 2)
        .attr('text-anchor', 'middle')
        .text("Provide {" + xKey + "," + yKey + "," + valueKey + "} rows");
      return;
    }

    var xScale = d3.scaleBand().domain(xs).range([0, innerW]).padding(opts.cellPadding ?? 0.05);
    var yScale = d3.scaleBand().domain(ys).range([0, innerH]).padding(opts.cellPadding ?? 0.05);

    var maxV = d3.max(rows, d => +d[valueKey]) || 1;
    var color = d3.scaleLinear()
      .domain([0, maxV])
      .range([d3.color(opts.baseColor || "#2563eb").brighter(2), d3.color(opts.baseColor || "#2563eb").darker(2)]);

    // Axes
    g.append('g')
      .attr('transform', 'translate(0,' + innerH + ')')
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .style("font-size", (opts.xTickSize || 10) + "px")
      .attr("transform", "rotate(" + (opts.xTickRotate || 0) + ")")
      .style("text-anchor", opts.xTickRotate ? "end" : "middle");

    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .style("font-size", (opts.yTickSize || 10) + "px");

    // Cells
    g.selectAll('rect.cell')
      .data(rows)
      .join('rect')
      .attr('class', 'cell')
      .attr('x', d => xScale(d[xKey]))
      .attr('y', d => yScale(d[yKey]))
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('rx', opts.cellRadius ?? 2)
      .attr('ry', opts.cellRadius ?? 2)
      .attr('fill', d => (+d[valueKey] > 0 ? color(+d[valueKey]) : (opts.missingFill || "#e5e7eb")))
      .on('pointerenter', function (e, d) {
        if (opts.tooltip ?? true) showTip(e, d[xKey] + ' x ' + d[yKey] + ' • ' + d[valueKey]);
      })
      .on('pointermove', function (e) {
        if (opts.tooltip ?? true) showTip(e, document.querySelector('.tooltip').innerHTML);
      })
      .on('pointerleave', function () {
        if (opts.tooltip ?? true) hideTip();
      });

    // Legend
    if (opts.legend ?? true) {
      var labels = opts.legendLabels || ["Low", "High"];
      addLegend(ctx.root, labels, k => (k === labels[0] ? color(0) : color(maxV)));
    }

    // Axis labels
    if (opts.xLabel) {
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH + 35)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(opts.xLabel);
    }

    if (opts.yLabel) {
      g.append('text')
        .attr('x', -innerH / 2)
        .attr('y', -35)
        .attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(opts.yLabel);
    }
  }


  function renderDendrogram(g, input, innerW, innerH, ctx){
    var opts = ctx.opts || {};
    var { nameKey, childrenKey } = opts.dataKeys || {};
    nameKey = nameKey || "name";
    childrenKey = childrenKey || "children";

    // Extract tree dynamically
    var tree = (input && input.data && (input.data[childrenKey] || input.data[nameKey])) ? input.data : null;
    if (!tree){
      g.append('text')
        .attr('x', innerW/2)
        .attr('y', innerH/2)
        .attr('text-anchor','middle')
        .text("Provide { " + nameKey + "," + childrenKey + "}");
      return;
    }

    // Build hierarchy dynamically
    function mapHierarchy(node){
      return {
        name: node[nameKey],
        children: node[childrenKey] ? node[childrenKey].map(mapHierarchy) : undefined
      };
    }
    var rootData = mapHierarchy(tree);
    var root = d3.hierarchy(rootData);
    var cluster = d3.cluster();

    // Orientation
    if (opts.orientation === "vertical"){
      cluster.size([innerW, innerH - 160]);
    } else { // default: horizontal
      cluster.size([innerH, innerW - 160]);
    }
    cluster(root);

    // Links
    g.append('g')
      .selectAll('path')
      .data(root.links())
      .join('path')
      .attr('fill','none')
      .attr('stroke', opts.linkColor || "#999")
      .attr('stroke-width', opts.linkWidth || 1.5)
      .attr('stroke-opacity', opts.linkOpacity ?? 0.5)
      .attr('d', opts.orientation === "vertical"
        ? d3.linkVertical().x(d=>d.x).y(d=>d.y)
        : d3.linkHorizontal().x(d=>d.y).y(d=>d.x));

    // Nodes
    var node = g.append('g')
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('transform', d => opts.orientation === "vertical"
        ? "translate(" + d.x + "," + d.y + ")"
        : "translate(" + d.y + "," + d.x + ")");

    node.append('circle')
      .attr('r', opts.nodeRadius || 4)
      .attr('fill', opts.nodeColor || "#333");

    node.append('text')
      .attr('dy','0.32em')
      .attr('x', d => d.children ? -(opts.labelOffset || 6) : (opts.labelOffset || 6))
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .style('font-size', (opts.labelFontSize || 12) + "px")
      .style('fill', opts.labelColor || "#000")
      .text(d => d.data.name ?? '');
  }


  function renderKMeans(g, rows, innerW, innerH, ctx) {
    var margin = ctx.margin,
        opts = ctx.opts || {},
        root = ctx.root,
        colorScheme = ctx.colorScheme;

    // Read dynamic keys
    var { xKey, yKey, clusterKey } = opts.dataKeys || {};
    xKey = xKey || "x";
    yKey = yKey || "y";
    clusterKey = clusterKey || "cluster";

    // Normalize XY rows and keep cluster info
    var norm = rows.map((d) => ({
      x: +d[xKey],
      y: +d[yKey],
      cluster: d[clusterKey],
      key: d.key ?? null
    }));

    if (!norm.length){
      g.append('text')
        .attr('x', innerW/2)
        .attr('y', innerH/2)
        .attr('text-anchor', 'middle')
        .text("Provide {" + xKey + "," + yKey + "," + clusterKey + "} rows");
      return;
    }

    // Scales
    var x = d3.scaleLinear()
      .domain(opts.xDomain || d3.extent(norm, d => d.x)).nice()
      .range([0, innerW]);
    var y = d3.scaleLinear()
      .domain(opts.yDomain || d3.extent(norm, d => d.y)).nice()
      .range([innerH, 0]);

    // Clusters & colors
    var clusters = Array.from(new Set(norm.map(d => d.cluster))).sort(d3.ascending);
    var color = d3.scaleOrdinal().domain(clusters).range(colorScheme);

    // Draw axes
    g.append('g').attr('transform', 'translate(0,'+innerH+')')
      .call(d3.axisBottom(x).ticks(opts.xTicks || 6));
    g.append('g').call(d3.axisLeft(y).ticks(opts.yTicks || 6));

    // Optional grid
    if (opts.showGrid){
      g.append('g')
        .attr('stroke-opacity', 0.1)
        .call(d3.axisLeft(y).tickSize(-innerW).tickFormat(''));
    }

    // Draw points
    g.selectAll('circle.pt').data(norm).join('circle')
      .attr('class','pt')
      .attr('cx', d => x(d.x))
      .attr('cy', d => y(d.y))
      .attr('r', opts.pointRadius || 4)
      .attr('fill', d => color(d.cluster))
      .attr('fill-opacity', opts.pointOpacity ?? 0.85)
      .on('pointerenter', function(e,d){
        showTip(e, (d.key ? d.key + ' • ' : '') + '('+d.x+', '+d.y+') • cluster '+d.cluster);
      })
      .on('pointermove', function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
      .on('pointerleave', hideTip);

    // Compute centroids from data (mean per cluster)
    var centroids = clusters.map(cluster => {
      var pts = norm.filter(d => d.cluster === cluster);
      return {
        cluster: cluster,
        x: d3.mean(pts, d => d.x),
        y: d3.mean(pts, d => d.y)
      };
    });

    // Draw centroids
    g.selectAll('path.cent').data(centroids).join('path')
      .attr('d', d3.symbol().type(d3.symbolCross).size(opts.centroidSize || 160))
      .attr('transform', d => 'translate('+x(d.x)+','+y(d.y)+')')
      .attr('fill', d => color(d.cluster))
      .attr('stroke', opts.centroidStrokeColor || 'white')
      .attr('stroke-width', opts.centroidStrokeWidth || 1.5);

    // Legend
    if (clusters.length){
      addLegend(root, clusters.map(c => 'Cluster '+c), k => color(+k.replace('Cluster ','')));
    }
  }


  function renderExpRegression(g, rows, innerW, innerH, ctx) {
    var opts = ctx.opts || {};
    var root = ctx.root;

    // Read dynamic keys
    var { xKey, yKey } = opts.dataKeys || {};
    xKey = xKey || "x";
    yKey = yKey || "y";

    // Normalize XY rows dynamically
    var pts = rows.map(d => ({
      x: +d[xKey],
      y: +d[yKey],
      key: d.key ?? null
    }));

    if (!pts.length) {
        g.append('text')
            .attr('x', innerW / 2)
            .attr('y', innerH / 2)
            .attr('text-anchor', 'middle')
            .text("Provide {" + xKey + "," + yKey + "} rows");
        return;
    }

    var x = d3.scaleLinear().domain(d3.extent(pts, d => d.x)).nice().range([0, innerW]);
    var y = d3.scaleLinear().domain(d3.extent(pts, d => d.y)).nice().range([innerH, 0]);

    // Axes
    g.append('g')
        .attr('transform', 'translate(0,' + innerH + ')')
        .call(d3.axisBottom(x).ticks(6));
    g.append('g')
        .call(d3.axisLeft(y).ticks(6));

    g.append('g')
        .attr('stroke-opacity', 0.1)
        .call(d3.axisLeft(y).tickSize(-innerW).tickFormat(() => ''));

    // Data points
    g.selectAll('circle')
        .data(pts)
        .join('circle')
        .attr('cx', d => x(d.x))
        .attr('cy', d => y(d.y))
        .attr('r', opts.pointRadius || 3)
        .attr('fill', opts.pointColor || 'currentColor')
        .attr('opacity', 0.8);

    // Fit via exponential regression (ln y = ln a + b x)
    var filtered = pts.filter(p => p.y > 0);
    var n = filtered.length;
    if (n >= 2) {
        var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        filtered.forEach(function (p) {
            var lx = p.x, ly = Math.log(p.y);
            sumX += lx; sumY += ly; sumXY += lx * ly; sumXX += lx * lx;
        });
        var b = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        var lna = (sumY - b * sumX) / n;
        var a = Math.exp(lna);

        // curve
        var xs = d3.range(x.domain()[0], x.domain()[1], (x.domain()[1] - x.domain()[0]) / 200);
        var curve = xs.map(xx => ({ x: xx, y: a * Math.exp(b * xx) }));
        var line = d3.line().x(d => x(d.x)).y(d => y(d.y));

        g.append('path')
            .datum(curve)
            .attr('fill', 'none')
            .attr('stroke', opts.lineColor || 'currentColor')
            .attr('stroke-width', 2)
            .attr('opacity', 0.8)
            .attr('d', line);

        addLegend(root, ['Data', "Fit y = " + a.toFixed(3) + "·e ^(" + b.toFixed(3) + "x)"], k => k === 'Data' ? (opts.pointColor || '#9ca3af') : (opts.lineColor || '#111827'));
    }

    // Axis labels
    g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH + 40)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(opts.xLabel || 'X');

    g.append('text')
        .attr('x', -innerH / 2)
        .attr('y', -40)
        .attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(opts.yLabel || 'Y');
  }


  function renderCandlestick(g, rows, innerW, innerH, ctx){
      var opts = ctx.opts || {};
      var root = ctx.root;

      // Read dynamic keys
      var { dateKey, openKey, highKey, lowKey, closeKey } = opts.dataKeys || {};
      dateKey = dateKey || "date";
      openKey = openKey || "open";
      highKey = highKey || "high";
      lowKey = lowKey || "low";
      closeKey = closeKey || "close";

      // Normalize and filter valid rows
      var norm = normalizeTimeRows(rows).filter(d =>
          Number.isFinite(d[openKey]) &&
          Number.isFinite(d[closeKey]) &&
          Number.isFinite(d[highKey]) &&
          Number.isFinite(d[lowKey])
      );
      if (!norm.length){
          g.append('text')
            .attr('x', innerW/2).attr('y', innerH/2)
            .attr('text-anchor','middle')
            .text("Provide {" + dateKey + "," + openKey + "," + highKey + "," + lowKey + "," + closeKey + " } rows");
          return;
      }

      // Scales
      var x = d3.scaleBand()
          .domain(norm.map(d => +d[dateKey]))
          .range([0, innerW])
          .padding(0.3);

      var y = d3.scaleLinear()
          .domain([d3.min(norm, d => d[lowKey]), d3.max(norm, d => d[highKey])])
          .nice()
          .range([innerH, 0]);

      // Axes
      g.append('g')
          .attr('transform', 'translate(0,'+innerH+')')
          .call(
              d3.axisBottom(
                  d3.scaleUtc().domain(d3.extent(norm, d => d[dateKey])).range([0, innerW])
              ).ticks(6).tickFormat(fmt.dateShort)
          );

      g.append('g').call(d3.axisLeft(y).ticks(6));

      if (opts.showGrid) {
          g.append('g')
              .attr('stroke-opacity', 0.08)
              .call(d3.axisLeft(y).tickSize(-innerW).tickFormat(() => ''));
      }

      // Wicks
      g.selectAll('line.wick')
          .data(norm)
          .join('line')
          .attr('class','wick')
          .attr('x1', d => x(+d[dateKey]) + x.bandwidth()/2)
          .attr('x2', d => x(+d[dateKey]) + x.bandwidth()/2)
          .attr('y1', d => y(d[highKey]))
          .attr('y2', d => y(d[lowKey]))
          .attr('stroke', opts.wickColor || 'currentColor')
          .attr('stroke-width', opts.wickWidth || 1);

      // Bodies
      g.selectAll('rect.body')
          .data(norm)
          .join('rect')
          .attr('class','body')
          .attr('x', d => x(+d[dateKey]))
          .attr('width', x.bandwidth())
          .attr('y', d => y(Math.max(d[openKey], d[closeKey])))
          .attr('height', d => Math.max(1, Math.abs(y(d[openKey]) - y(d[closeKey]))))
          .attr('fill', d => d[closeKey] >= d[openKey] ? (opts.upColor || '#16a34a') : (opts.downColor || '#dc2626'))
          .attr('opacity', opts.bodyOpacity ?? 0.9)
          .on('pointerenter', function(e,d){
              showTip(e, fmt.dateISO(d[dateKey])+' • O:'+d[openKey]+' H:'+d[highKey]+' L:'+d[lowKey]+' C:'+d[closeKey]);
          })
          .on('pointermove', function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
          .on('pointerleave', hideTip);

      // Axis labels
      g.append('text')
          .attr('x', innerW/2)
          .attr('y', innerH + 40)
          .attr('text-anchor','middle')
          .style('font-size','12px')
          .text(opts.xLabel || 'Date');

      g.append('text')
          .attr('x', -innerH/2)
          .attr('y', -40)
          .attr('transform','rotate(-90)')
          .attr('text-anchor','middle')
          .style('font-size','12px')
          .text(opts.yLabel || 'Price');

      // Legend
      addLegend(root, ['Up','Down'], k => k==='Up' ? (opts.upColor || '#16a34a') : (opts.downColor || '#dc2626'));
  }



  // ---- NEW: Bump Chart (ranking over time) ----
  // expects rows: [{date, name, rank}] lower rank = higher line position
  function renderBump(g, rows, innerW, innerH, ctx){
    var margin = ctx.margin, opts = ctx.opts, root = ctx.root, colorScheme = ctx.colorScheme;
    var parsed = rows.map(function(r){ return { date: typeof r.date==='string'? parseDate(r.date) : r.date, name: nameOf(r), rank: +r.rank }; })
      .filter(function(r){ return r.date instanceof Date && !isNaN(r.date) && r.name && Number.isFinite(r.rank); });
    if (!parsed.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Provide {date, name, rank} rows'); return; }
    parsed.sort(function(a,b){ return a.date-b.date; });

    var names = Array.from(new Set(parsed.map(d=>d.name)));
    var byName = d3.group(parsed, d=>d.name);
    var dates = Array.from(new Set(parsed.map(d=>+d.date))).sort(d3.ascending).map(t=>new Date(t));

    var x = d3.scaleUtc().domain(d3.extent(dates)).range([0, innerW]).nice();
    var maxRank = d3.max(parsed, d=>d.rank)||1;
    var y = d3.scaleLinear().domain([1, maxRank]).range([0, innerH]); // rank 1 at top
    var color = d3.scaleOrdinal().domain(names).range(colorScheme);

    g.append('g').attr('transform','translate(0,'+innerH+')').call(d3.axisBottom(x).ticks(Math.min(8,dates.length)).tickFormat(fmt.dateShort));
    g.append('g').call(d3.axisLeft(y).ticks(Math.min(10,maxRank)));
    g.append('g').attr('stroke-opacity',0.08).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(function(){ return ''; }));

    var line = d3.line().x(d=>x(d.date)).y(d=>y(d.rank)).defined(d=>Number.isFinite(d.rank));

    byName.forEach(function(arr, nm){
      arr.sort((a,b)=>a.date-b.date);
      g.append('path').datum(arr).attr('fill','none').attr('stroke',color(nm)).attr('stroke-width',2).attr('d',line).attr('opacity',0.9);
      g.selectAll('circle.'+nm.replace(/\W/g,'')).data(arr).join('circle')
        .attr('cx',d=>x(d.date)).attr('cy',d=>y(d.rank)).attr('r',3).attr('fill',color(nm))
        .on('pointerenter',function(e,d){ showTip(e, nm+' • '+fmt.dateISO(d.date)+' • rank '+d.rank); })
        .on('pointermove',function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
        .on('pointerleave', hideTip);
    });

    addLegend(root, names, function(k){ return color(k); });
  }


  function renderForce(g, input, innerW, innerH, ctx){
    const opts = ctx.opts || {};
    const data = input && input.data ? input.data : null;
    if (!data || !data.nodes || !data.links){
      g.append('text')
        .attr('x', innerW/2).attr('y', innerH/2)
        .attr('text-anchor','middle')
        .text('Provide { nodes, links }');
      return;
    }

    const nodeKeys = opts.dataKeys?.nodes || {};
    const linkKeys = opts.dataKeys?.links || {};

    const color = d3.scaleOrdinal(d3.schemeTableau10);

    // --- Links ---
    const link = g.append('g')
      .attr('stroke', opts.linkColor || 'currentColor')
      .attr('stroke-opacity', opts.linkOpacity ?? 0.3)
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d[linkKeys.valueKey] || 1));

    // --- Nodes ---
    const node = g.append('g')
      .attr('stroke', opts.nodeStroke || '#fff')
      .attr('stroke-width', opts.nodeStrokeWidth || 1.5)
      .selectAll('circle')
      .data(data.nodes)
      .join('circle')
      .attr('r', opts.nodeRadius || 5)
      .attr('fill', d => color(d[nodeKeys.groupKey] ?? 0))
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('pointerenter', (e,d) => showTip(e, d[nodeKeys.idKey] ?? ''))
      .on('pointermove', e => showTip(e, document.querySelector('.tooltip').innerHTML))
      .on('pointerleave', hideTip);

    // --- Simulation ---
    const sim = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links)
        .id(d => d[nodeKeys.idKey])
        .distance(d => (opts.linkDistance || 40) + (d[linkKeys.valueKey] || 0)))
      .force('charge', d3.forceManyBody().strength(opts.chargeStrength || -200))
      .force('center', d3.forceCenter(innerW/2, innerH/2))
      .on('tick', ticked);

    function ticked(){
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
    }

    function dragstarted(event, d){
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event, d){
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event, d){
      if (!event.active) sim.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // --- Legend ---
    if (opts.showLegend !== false){
      const groups = Array.from(new Set(data.nodes.map(n => n[nodeKeys.groupKey])))
        .map(v => v == null ? 'Group' : 'Group '+v);
      addLegend(ctx.root, groups, k => {
        const num = +String(k).replace('Group ','') || 0;
        return color(num);
      });
    }
  }


  function renderStackedChart(g, rows, type, width, height, { margin, opts, root }) {
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    // 1. Extract keys from dataKeys
    const xKey = opts.dataKeys?.xKeys || 'x';
    const yKey = opts.dataKeys?.yKeys || 'y';

    // 2. Extract x values
    const xValues = rows.map(d => d[xKey]);
    const isDate = xValues.every(v => !isNaN(Date.parse(v)));
    const isNumber = xValues.every(v => typeof v === 'number');

    let x, xParser;
    if (isDate) {
      xParser = v => new Date(v);
      x = d3.scaleUtc().domain(d3.extent(xValues, xParser)).range([0, innerW]);
    } else if (isNumber) {
      xParser = v => v;
      x = d3.scaleLinear().domain(d3.extent(xValues)).range([0, innerW]);
    } else {
      xParser = v => v;
      x = d3.scalePoint().domain(xValues).range([0, innerW]);
    }

    // 3. Prepare y-series keys and stack data
    const ySeries = rows[0][yKey].map((_, i) => i); // array of indexes
    const stack = d3.stack().keys(ySeries).value((d, key) => d[yKey][key]);
    const series = stack(rows);

    // 4. Y scale
    const y = d3.scaleLinear()
      .domain([0, d3.max(series[series.length - 1], d => d[1])])
      .nice()
      .range([innerH, 0]);

    // 5. Color scale
    const color = d3.scaleOrdinal()
      .domain(ySeries)
      .range(opts.colors || d3.schemeTableau10);

    // 6. Curve
    const curveType = opts.interpolation ? d3['curve' + capitalize(opts.interpolation)] : d3.curveLinear;
    const area = d3.area()
      .x(d => x(xParser(d.data[xKey])))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(curveType);

    const line = d3.line()
      .x(d => x(xParser(d.data[xKey])))
      .y(d => y(d[1]))
      .curve(curveType);

    // 7. Draw chart
    if (type === 'stacked-area') {
      g.selectAll('path.area')
        .data(series)
        .join('path')
        .attr('class', 'area')
        .attr('fill', (d, i) => color(i))
        .attr('opacity', opts.areaOpacity ?? 0.8)
        .attr('d', area);
    } else if (type === 'stacked-line') {
      g.selectAll('path.line')
        .data(series)
        .join('path')
        .attr('class', 'line')
        .attr('fill', 'none')
        .attr('stroke', (d, i) => color(i))
        .attr('stroke-width', opts.lineWidth ?? 2)
        .attr('d', line);
    }

    // 8. Axes
    if (isDate) {
      g.append('g')
        .attr('transform', 'translate(0,' + innerH + ')')
        .call(d3.axisBottom(x).ticks(6).tickFormat(d3.utcFormat(opts.xTickFormat || '%Y')));
    } else if (isNumber) {
      g.append('g')
        .attr('transform', 'translate(0,' + innerH + ')')
        .call(d3.axisBottom(x).ticks(6).tickFormat(opts.xTickFormat ? d3.format(opts.xTickFormat) : d3.format('')));
    } else {
      g.append('g')
        .attr('transform', 'translate(0,' + innerH + ')')
        .call(d3.axisBottom(x));
    }

    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(opts.yTickFormat || '.2s')));

    // 9. Grid
    if (opts.showGrid) {
      g.append('g')
        .attr('stroke-opacity', 0.08)
        .call(d3.axisLeft(y).tickSize(-innerW).tickFormat(function(){ return ''; }));
    }

    // 10. Legend
    if (opts.showLegend && typeof addLegend === 'function') {
      const labels = opts.labels || ySeries.map(String);
      addLegend(root, labels, label => {
        const idx = labels.indexOf(label);
        return color(idx >= 0 ? idx : label);
      }, opts.legendPosition || 'bottom');
    }

    // 11. Axis labels
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(opts.xLabel || 'X');

    g.append('text')
      .attr('x', -innerH / 2)
      .attr('y', -margin.left + 14)
      .attr('transform', 'rotate(-90)')
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(opts.yLabel || 'Value');

    function capitalize(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
  }



  function renderSunburst(g, rows, innerW, innerH, ctx) {
    const root = ctx.root;
    const opts = ctx.opts || {};
    const colorScheme = opts.colorScheme || ctx.colorScheme || d3.schemeTableau10;

    // Build hierarchy
    const rootNode = d3.hierarchy(rows)
      .sum(d => d.value)
      .sort((a, b) => {
        if (opts.sort === "asc") return a.value - b.value;
        if (opts.sort === "none") return 0;
        return b.value - a.value; // default: desc
      });

    const partition = d3.partition().size([2 * Math.PI, Math.min(innerW, innerH) / 2]);
    partition(rootNode);

    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => d.y0)
      .outerRadius(d => d.y1);

    // Center chart
    g.attr("transform", "translate(" + (innerW / 2) + "," + (innerH / 2) + ")");

    // Segments
    g.selectAll("path")
      .data(rootNode.descendants())
      .join("path")
      .attr("d", arc)
      .attr("fill", d => colorScheme[d.depth % colorScheme.length])
      .attr("stroke", opts.strokeColor || "#fff")
      .attr("stroke-width", opts.strokeWidth || 1)
      .style("opacity", opts.opacity ?? 0.85)
      .on("pointerenter", function (event, d) {
        let content;
        switch (opts.tooltipFormat) {
          case "name":
            content = d.data.name;
            break;
          case "value":
            content = d.value;
            break;
          case "name-value":
          default:
            content = d.data.name + "(" + d.value + ")";
        }
        showTip(event, content);
      })
      .on("pointermove", e => showTip(e, document.querySelector(".tooltip").innerHTML))
      .on("pointerleave", hideTip);

    // Labels
    if (opts.showLabels !== false) {
      g.selectAll("text")
        .data(rootNode.descendants().filter(d => {
          const angle = (d.x1 - d.x0) * (180 / Math.PI);
          return angle > (opts.labelMinAngle || 10); // skip small slices
        }))
        .join("text")
        .attr("transform", d => {
          const [x, y] = arc.centroid(d);
          const angle = ((d.x0 + d.x1) / 2) * 180 / Math.PI - 90;
          return "translate(" + x + "," + y + ") rotate(" + angle + ")";
        })
        .style("text-anchor", "middle")
        .style("font-size", "10px")
        .text(d => {
          switch (opts.labelFormat) {
            case "value": return d.value;
            case "name-value": return d.data.name + "(" + d.value + ")";
            case "name":
            default: return d.data.name;
          }
        });
    }

    // Legend
    if (opts.showLegend && typeof addLegend === "function") {
      const categories = rootNode.descendants()
        .filter(d => d.depth === 1)
        .map(d => d.data.name);
      addLegend(root, categories, name => {
        const i = categories.indexOf(name);
        return colorScheme[i % colorScheme.length];
      });
    }
  }


  function renderBoxPlot(g, rows, innerW, innerH, ctx) {
    const opts = ctx.opts || {};
    const margin = ctx.margin || { top: 20, right: 40, bottom: 40, left: 40 };
    const innerWidth = innerW - margin.left - margin.right;
    const innerHeight = innerH - margin.top - margin.bottom;

    const valueKey = opts.dataKeys?.valueKey || 'value';
    const categoryKey = opts.dataKeys?.categoryKey || 'category';

    // Group rows by category if category exists, otherwise treat as single box
    const categories = Array.from(new Set(rows.map(d => d[categoryKey] ?? 'All')));
    const dataByCategory = categories.map(cat => {
      const values = rows
        .filter(d => (d[categoryKey] ?? 'All') === cat)
        .map(d => +d[valueKey])
        .sort(d3.ascending);

      const q1 = d3.quantile(values, 0.25);
      const median = d3.quantile(values, 0.5);
      const q3 = d3.quantile(values, 0.75);
      const iqr = q3 - q1;
      const lowerWhisker = Math.max(d3.min(values), q1 - 1.5 * iqr);
      const upperWhisker = Math.min(d3.max(values), q3 + 1.5 * iqr);
      const outliers = values.filter(v => v < lowerWhisker || v > upperWhisker);

      return { category: cat, values, q1, median, q3, iqr, lowerWhisker, upperWhisker, outliers };
    });

    // Scales
    const x = d3.scaleBand()
      .domain(categories)
      .range([0, innerWidth])
      .padding(0.4);

    const y = d3.scaleLinear()
      .domain([d3.min(dataByCategory, d => d.lowerWhisker), d3.max(dataByCategory, d => d.upperWhisker)])
      .nice()
      .range([innerHeight, 0]);

    const boxPlot = g.append('g')
      .attr('transform', "translate(" + margin.left + "," + margin.top + ")");

    // Boxes
    boxPlot.selectAll('rect.box')
      .data(dataByCategory)
      .join('rect')
      .attr('class', 'box')
      .attr('x', d => x(d.category))
      .attr('y', d => y(d.q3))
      .attr('height', d => y(d.q1) - y(d.q3))
      .attr('width', x.bandwidth())
      .attr('fill', opts.boxColor || 'steelblue')
      .attr('opacity', 0.7);

    // Median lines
    boxPlot.selectAll('line.median')
      .data(dataByCategory)
      .join('line')
      .attr('class', 'median')
      .attr('x1', d => x(d.category))
      .attr('x2', d => x(d.category) + x.bandwidth())
      .attr('y1', d => y(d.median))
      .attr('y2', d => y(d.median))
      .attr('stroke', opts.medianColor || 'black')
      .attr('stroke-width', 2);

    // Whiskers
    boxPlot.selectAll('line.whisker-top')
      .data(dataByCategory)
      .join('line')
      .attr('class', 'whisker-top')
      .attr('x1', d => x(d.category) + x.bandwidth() / 2)
      .attr('x2', d => x(d.category) + x.bandwidth() / 2)
      .attr('y1', d => y(d.q3))
      .attr('y2', d => y(d.upperWhisker))
      .attr('stroke', 'black')
      .attr('stroke-width', 1.5);

    boxPlot.selectAll('line.whisker-bottom')
      .data(dataByCategory)
      .join('line')
      .attr('class', 'whisker-bottom')
      .attr('x1', d => x(d.category) + x.bandwidth() / 2)
      .attr('x2', d => x(d.category) + x.bandwidth() / 2)
      .attr('y1', d => y(d.q1))
      .attr('y2', d => y(d.lowerWhisker))
      .attr('stroke', 'black')
      .attr('stroke-width', 1.5);

    // Whisker caps
    boxPlot.selectAll('line.cap-top')
      .data(dataByCategory)
      .join('line')
      .attr('class', 'cap-top')
      .attr('x1', d => x(d.category) + x.bandwidth() * 0.25)
      .attr('x2', d => x(d.category) + x.bandwidth() * 0.75)
      .attr('y1', d => y(d.upperWhisker))
      .attr('y2', d => y(d.upperWhisker))
      .attr('stroke', 'black')
      .attr('stroke-width', 1.5);

    boxPlot.selectAll('line.cap-bottom')
      .data(dataByCategory)
      .join('line')
      .attr('class', 'cap-bottom')
      .attr('x1', d => x(d.category) + x.bandwidth() * 0.25)
      .attr('x2', d => x(d.category) + x.bandwidth() * 0.75)
      .attr('y1', d => y(d.lowerWhisker))
      .attr('y2', d => y(d.lowerWhisker))
      .attr('stroke', 'black')
      .attr('stroke-width', 1.5);

    // Outliers
    boxPlot.selectAll('circle.outlier')
      .data(dataByCategory.flatMap(d => d.outliers.map(v => ({ category: d.category, value: v }))))
      .join('circle')
      .attr('class', 'outlier')
      .attr('cx', d => x(d.category) + x.bandwidth() / 2)
      .attr('cy', d => y(d.value))
      .attr('r', 4)
      .attr('fill', opts.outlierColor || 'red');

    // Axes
    const xAxis = d3.axisBottom(x);
    const yAxis = d3.axisLeft(y);

    g.append('g')
      .attr('transform', "translate(" + margin.left + "," + (margin.top + innerHeight) + ")")
      .call(xAxis);

    g.append('g')
      .attr('transform', "translate(" + margin.left + "," + margin.top + ")")
      .call(yAxis);
  }



  function renderWordCloud(g, rows, width, height, ctx) {
    const opts = ctx.opts || {};
    const margin = ctx.margin || { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // --- Extract keys dynamically from config ---
    const dk = (opts.dataKeys || {});
    const textKey = dk.textKey || "text";
    const countKey = dk.countKey || "count";

    // --- Word data prep ---
    const words = rows.map(d => ({
      text: d[textKey],
      size: +d[countKey] || 1
    }));

    // --- Font size scaling ---
    const fontRange = opts.fontRange || [10, 80];
    const fontSizeScale = d3.scaleLinear()
      .domain([d3.min(words, d => d.size), d3.max(words, d => d.size)])
      .range(fontRange);

    // --- Color scale (keeps all words visible) ---
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([d3.min(words, d => d.size), d3.max(words, d => d.size)]);

    // --- Layout ---
    const layout = d3.layout.cloud()
      .size([innerWidth, innerHeight])
      .words(words.map(d => ({
        text: d.text,
        size: fontSizeScale(d.size)
      })))
      .padding(opts.wordPadding || 5)
      .rotate(() => {
        const angles = opts.rotateAngles || [0, 45, -45];
        return angles[Math.floor(Math.random() * angles.length)];
      })
      .font(opts.fontFamily || "Verdana, sans-serif")
      .fontSize(d => d.size)
      .on("end", draw);

    layout.start();

    function draw(words) {
      // Center the word cloud
      const cloudG = g.append("g")
        .attr("transform", "translate(" + (innerWidth / 2) + "," + (innerHeight / 2) + ")");

      cloudG.selectAll("text")
        .data(words)
        .join("text")
        .attr("text-anchor", "middle")
        .attr("transform", d => "translate(" + d.x + "," + d.y + ") rotate(" + d.rotate + ")")
        .style("font-size", d => d.size + "px")
        .style("font-family", opts.fontFamily || "Verdana, sans-serif")
        .style("fill", d => colorScale(d.size))
        .text(d => d.text)
        .on("mouseover", function(event, d) {
          showTip(event, d.text + ": " + d.size);
        })
        .on("mousemove", function(event) {
          showTip(event, document.querySelector(".tooltip").innerHTML);
        })
        .on("mouseleave", hideTip);
    }
  }


  function renderHexbin(svg, data, width, height, ctx = {}) {
    const opts = ctx.opts || {};
    const margin = ctx.margin || { top: 20, right: 20, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const xKey = opts.dataKeys?.xKey || "x";
    const yKey = opts.dataKeys?.yKey || "y";

    const radius = opts.hexRadius || 20;
    const colorInterpolator = opts.colorInterpolator || d3.interpolateBlues;

    // SVG group
    const g = svg.append("g")
      .attr("transform", 'translate(' + margin.left + ',' + margin.top + ')');

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => +d[xKey])])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => +d[yKey])])
      .range([innerHeight, 0]); // y-axis inverted

    // Hexbin generator
    const hexbin = d3.hexbin()
      .radius(radius)
      .extent([[0, 0], [innerWidth, innerHeight]]);

    // Map data through scales
    const points = data.map(d => [xScale(+d[xKey]), yScale(+d[yKey])]);
    const bins = hexbin(points);

    // Auto color scale
    const maxCount = d3.max(bins, d => d.length);
    const color = d3.scaleSequential(colorInterpolator)
      .domain([0, maxCount]);

    // Draw hexagons
    g.selectAll("path.hex")
      .data(bins)
      .join("path")
      .attr("class", "hex")
      .attr("d", d => hexbin.hexagon())
      .attr("transform", d => 'translate(' + d.x + ',' + d.y + ')')
      .attr("fill", d => color(d.length))
      .attr("stroke", opts.strokeColor || "black")
      .attr("stroke-width", opts.strokeWidth ?? 0.5)
      .on("pointerenter", (event, d) => showTip(event, "Count: " + d.length))
      .on("pointermove", event => showTip(event, document.querySelector('.tooltip').innerHTML))
      .on("pointerleave", hideTip);

    // Draw axes
    g.append("g")
      .attr("transform", 'translate(0,' + innerHeight + ')')
      .call(d3.axisBottom(xScale));

    g.append("g")
      .call(d3.axisLeft(yScale));
  }


  function renderBubbleMap(g, rows, innerW, innerH, ctx) {
    const opts = ctx.opts || {};
    const root = ctx.root;
    const chartType = 'bubble';

    d3.json(opts.worldUrl || 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then((topo) => {
        const countries = topojson.feature(topo, topo.objects.countries);
        const proj = d3[opts.projection || 'geoNaturalEarth1']()
          .fitSize([innerW, innerH], countries);
        const path = d3.geoPath(proj);

        // draw base map
        g.append('g')
          .selectAll('path')
          .data(countries.features)
          .join('path')
          .attr('d', path)
          .attr('fill', '#e5e7eb')
          .attr('stroke', '#999')
          .attr('stroke-width', 0.5);

        // normalize rows
        const normRows = normalizeDataForMap(rows, countries.features, chartType, opts.dataKeys);

        // bubble scaling
        const r = d3.scaleSqrt()
          .domain([0, d3.max(normRows, (d) => +d.value) || 1])
          .range([opts.pointMinRadius || 3, opts.pointMaxRadius || 20]);

        g.append('g')
          .selectAll('circle')
          .data(normRows)
          .join('circle')
          .attr('transform', (d) => 'translate(' + proj([d.lon, d.lat]) + ')')
          .attr('r', (d) => r(+d.value))
          .attr('fill', opts.pointColor || 'steelblue')
          .attr('fill-opacity', 0.7)
          .attr('stroke', '#fff')
          .attr('stroke-width', 0.5)
          .on('pointerenter', (e, d) => {
            if (opts.tooltip !== false) showTip(e, d.name + ' • ' + d.value);
          })
          .on('pointerleave', hideTip);
      });
  }


  function renderChoropleth(g, rows, innerW, innerH, ctx) {
    const opts = ctx.opts;
    const root = ctx.root;

    d3.json(opts.worldUrl || "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((topo) => {
        const countries = topojson.feature(topo, topo.objects.countries);
        const proj = d3.geoNaturalEarth1().fitSize([innerW, innerH], countries);
        const path = d3.geoPath(proj);

        // 🔹 normalize rows for choropleth
        const normRows = normalizeDataForMap(rows, countries.features, "choropleth", opts.dataKeys);

        const byId = new Map(normRows.map((d) => [d.id, d.value]));
        const maxVal = d3.max(normRows, (d) => d.value) || 1;

        const color = d3
          .scaleSequential(d3[opts.colorScheme || "interpolateBlues"])
          .domain([0, maxVal]);

        g.append("g")
          .selectAll("path")
          .data(countries.features)
          .join("path")
          .attr("d", path)
          .attr("fill", (d) => {
            const v = byId.get(d.id);
            return v ? color(v) : "#f3f4f6";
          })
          .attr("stroke", "#999")
          .attr("stroke-width", 0.5)
          .on("pointerenter", (e, d) =>
            showTip(e, d.properties.name + " • " + (byId.get(d.id) || "No data"))
          )
          .on("pointerleave", hideTip);

        addLegend(root, ["Low", "High"], (k) =>
          k === "Low" ? color(0) : color(maxVal)
        );
      });
  }


  function renderSpikeMap(g, rows, innerW, innerH, ctx) {
    const opts = ctx.opts;
    const root = ctx.root;

    d3.json(
      opts.worldUrl ||
        "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
    ).then((topo) => {
      const countries = topojson.feature(topo, topo.objects.countries);
      const proj = d3.geoNaturalEarth1().fitSize([innerW, innerH], countries);
      const path = d3.geoPath(proj);

      // Draw map background
      g.append("g")
        .selectAll("path")
        .data(countries.features)
        .join("path")
        .attr("d", path)
        .attr("fill", "#f3f4f6")
        .attr("stroke", "#999")
        .attr("stroke-width", 0.5);

      // 🔹 normalize rows for spike map
      const normRows = normalizeDataForMap(rows, countries.features, "spike", opts.dataKeys);

      // Spike scaling
      const maxVal = d3.max(normRows, (d) => +d.value) || 1;
      const h = d3
        .scaleLinear()
        .domain([0, maxVal])
        .range([0, Math.min(innerH, innerW) / 5]);

      g.append("g")
        .selectAll("line.spike")
        .data(normRows)
        .join("line")
        .attr("class", "spike")
        .attr("x1", (d) => proj([d.lon, d.lat])[0])
        .attr("y1", (d) => proj([d.lon, d.lat])[1])
        .attr("x2", (d) => proj([d.lon, d.lat])[0])
        .attr("y2", (d) => proj([d.lon, d.lat])[1])
        .attr("stroke", opts.spikeColor || "crimson")
        .attr("stroke-width", opts.spikeWidth || 3)
        .on("pointerenter", (e, d) => showTip(e, d.name + " • " + d.value))
        .on("pointerleave", hideTip)
        // transition AFTER listeners
        .transition()
        .duration(800)
        .attr("y2", (d) => proj([d.lon, d.lat])[1] - h(+d.value));
    });
  }


  function renderGeoGraph(g, rows, innerW, innerH, ctx) {
    const opts = ctx.opts;
    const worldUrl = opts.worldUrl || 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

    fetch(worldUrl)
      .then(r => r.json())
      .then(function(topo){
        const countries = topojson.feature(topo, topo.objects.countries);
        const proj = (opts.projection && d3[opts.projection] && typeof d3[opts.projection]==='function')
          ? d3[opts.projection]().fitSize([innerW, innerH], countries)
          : d3.geoNaturalEarth1().fitSize([innerW, innerH], countries);
        const path = d3.geoPath(proj);

        // Draw countries
        g.append('g').selectAll('path.country')
          .data(countries.features)
          .join('path')
          .attr('class','country')
          .attr('d', path)
          .attr('fill', '#e5e7eb')
          .attr('stroke', 'currentColor')
          .attr('stroke-opacity', 0.2);

        // 🔹 Normalize links
        const links = rows.map(r => {
          let sLat = r.sLat, sLon = r.sLon, tLat = r.tLat, tLon = r.tLon;

          // Resolve source by name
          if ((!sLat || !sLon) && r.sourceName) {
            const src = countries.features.find(f => f.properties.name === r.sourceName);
            if (src) [sLon, sLat] = d3.geoCentroid(src);
          }
          // Resolve source by id
          if ((!sLat || !sLon) && r.sourceId) {
            const src = countries.features.find(f => +f.id === +r.sourceId);
            if (src) [sLon, sLat] = d3.geoCentroid(src);
          }

          // Resolve target by name
          if ((!tLat || !tLon) && r.targetName) {
            const tgt = countries.features.find(f => f.properties.name === r.targetName);
            if (tgt) [tLon, tLat] = d3.geoCentroid(tgt);
          }
          // Resolve target by id
          if ((!tLat || !tLon) && r.targetId) {
            const tgt = countries.features.find(f => +f.id === +r.targetId);
            if (tgt) [tLon, tLat] = d3.geoCentroid(tgt);
          }

          if (!Number.isFinite(sLat) || !Number.isFinite(sLon) ||
              !Number.isFinite(tLat) || !Number.isFinite(tLon)) return null;

          return {
            sLat, sLon, tLat, tLon,
            value: +r.value || 1,
            name: r.name || ""
          };
        }).filter(Boolean);

        // Great-circle generator
        function greatCircle(a,b){
          const generator = d3.geoInterpolate(a,b);
          const steps = 64, pts = [];
          for (let i=0;i<=steps;i++) pts.push(generator(i/steps));
          return { type:'LineString', coordinates: pts };
        }

        // Draw links (curved lines)
        g.append('g').selectAll('path.link')
          .data(links)
          .join('path')
          .attr('class','link')
          .attr('d', d => path(greatCircle([d.sLon,d.sLat],[d.tLon,d.tLat])))
          .attr('fill','none')
          .attr('stroke', opts.lineColor || 'currentColor')
          .attr('stroke-opacity', opts.lineOpacity ?? 0.35)
          .attr('stroke-width', d => Math.max(1, Math.sqrt(d.value) * (opts.lineWidthScale || 1)))
          .attr('stroke-dasharray', opts.lineDashArray || null)
          .on('pointerenter', (e,d) => showTip(e, d.name + " • " + d.value))
          .on('pointermove', e => showTip(e, document.querySelector('.tooltip').innerHTML))
          .on('pointerleave', hideTip);

        // Source dots
        g.append('g').selectAll('circle.src')
          .data(links)
          .join('circle')
          .attr('class','src')
          .attr('cx', d => proj([d.sLon, d.sLat])[0])
          .attr('cy', d => proj([d.sLon, d.sLat])[1])
          .attr('r', opts.sourceRadius || 3)
          .attr('fill', opts.sourceColor || 'blue');

        // Target dots
        g.append('g').selectAll('circle.tgt')
          .data(links)
          .join('circle')
          .attr('class','tgt')
          .attr('cx', d => proj([d.tLon, d.tLat])[0])
          .attr('cy', d => proj([d.tLon, d.tLat])[1])
          .attr('r', opts.targetRadius || 3)
          .attr('fill', opts.targetColor || 'red');
      })
      .catch(() => {
        g.append('text')
          .attr('x',innerW/2)
          .attr('y',innerH/2)
          .attr('text-anchor','middle')
          .text('Failed to load world map');
      });
  }

  function renderHexbinMap(g, rows, innerW, innerH, ctx) {
    const opts = ctx.opts || {};
    const chartType = 'hexbin';
    const worldUrl = opts.worldUrl || 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

    d3.json(worldUrl).then((topo) => {
      const countries = topojson.feature(topo, topo.objects.countries);
      const proj = d3[opts.projection || 'geoNaturalEarth1']()
        .fitSize([innerW, innerH], countries);
      const path = d3.geoPath(proj);

      // Draw base map
      g.append('g')
        .selectAll('path')
        .data(countries.features)
        .join('path')
        .attr('d', path)
        .attr('fill', opts.mapFill || '#e5e7eb')
        .attr('stroke', opts.mapStroke || '#999')
        .attr('stroke-width', 0.5);

      // Normalize rows for lat/lon or country keys
      const normRows = normalizeDataForMap(rows, countries.features, chartType, opts.dataKeys);

      // Project points: [x, y, value, name]
      const points = normRows.map(d => [proj([d.lon, d.lat])[0], proj([d.lon, d.lat])[1], +d.value || 1, d.name]);

      // Hexbin generator
      const hexbin = d3.hexbin()
        .x(d => d[0])
        .y(d => d[1])
        .radius(opts.hexRadius || 20)
        .extent([[0, 0], [innerW, innerH]]);

      const bins = hexbin(points);

      // Scales for color and radius based on sum of values
      const maxBinValue = d3.max(bins, b => d3.sum(b, p => p[2]));
      const radiusScale = d3.scaleSqrt()
        .domain([0, maxBinValue])
        .range([opts.minHexRadius || 5, opts.maxHexRadius || 30]);

      const colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, maxBinValue]);

      // Draw hexagons
      g.append('g')
        .selectAll('path')
        .data(bins)
        .join('path')
        .attr('d', d => hexbin.hexagon(radiusScale(d3.sum(d, p => p[2]))))
        .attr('transform', d => "translate(" + d.x + "," + d.y + ")")
        .attr('fill', d => colorScale(d3.sum(d, p => p[2])))
        .attr('stroke', opts.hexStroke || '#fff')
        .attr('stroke-width', 0.5)
        .on('pointerenter', (e, d) => {
          const tooltipText = d.map(p => p[3] + ': ' + p[2]).join('<br>');
          showTip(e, tooltipText);
        })
        .on('pointerleave', hideTip);

    }).catch(() => {
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH / 2)
        .attr('text-anchor', 'middle')
        .text('Failed to load world map');
    });
  }


  function renderSankeyLike(g, data, innerW, innerH, ctx) {
    var margin = ctx.margin,
        opts = ctx.opts,
        root = ctx.root;

    // Sankey generator
    var sankeyGen = d3.sankey()
      .nodeId(d => d.id)
      .nodeWidth(opts.nodeWidth || 20)
      .nodePadding(opts.nodePadding || 15)
      .extent([[0, 0], [innerW, innerH]]);

    // Derive nodes if not provided
    var nodes = Array.from(
      new Set(data.flatMap(l => [l.source, l.target])),
      id => ({ id })
    );

    // Build graph
    var sankeyData = sankeyGen({
      nodes: nodes.map(d => Object.assign({}, d)),
      links: data.map(d => Object.assign({}, d))
    });

    // Color scale
    var color = d3.scaleOrdinal()
      .domain(sankeyData.nodes.map(d => d.id))
      .range(opts.colorScheme || d3.schemeTableau10);

    // Links
    g.append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(sankeyData.links)
      .join("path")
      .attr("d", d3.sankeyLinkHorizontal())
      .attr("stroke", d => opts.linkColor === "source" ? color(d.source.id)
        : opts.linkColor === "target" ? color(d.target.id)
          : opts.linkColor || "#999")
      .attr("stroke-opacity", opts.linkOpacity || 0.5)
      .attr("stroke-width", d => Math.max(1, d.width))
      .on("pointerenter", function (e, d) {
        if (opts.tooltip) {
          showTip(e, d.source.id + " → " + d.target.id + " : " + d.value);
        }
      })
      .on("pointermove", function (e) {
        if (opts.tooltip) {
          showTip(e, document.querySelector(".tooltip").innerHTML);
        }
      })
      .on("pointerleave", hideTip);

    // Nodes
    var node = g.append("g")
      .selectAll("g")
      .data(sankeyData.nodes)
      .join("g");

    node.append("rect")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("height", d => d.y1 - d.y0)
      .attr("width", d => d.x1 - d.x0)
      .attr("fill", d => color(d.id))
      .attr("stroke", opts.nodeStroke || "#000")
      .attr("stroke-width", opts.nodeStrokeWidth || 1)
      .on("pointerenter", function (e, d) {
        if (opts.tooltip) {
          showTip(e, d.id + " : " + d.value);
        }
      })
      .on("pointermove", function (e) {
        if (opts.tooltip) {
          showTip(e, document.querySelector(".tooltip").innerHTML);
        }
      })
      .on("pointerleave", hideTip);

    // Node labels
    if (opts.showLabels !== false) {
      node.append("text")
        .attr("x", d => d.x0 < innerW / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.x0 < innerW / 2 ? "start" : "end")
        .style("font-size", opts.labelFontSize || "12px")
        .text(d => d.id);
    }
  }


  function renderRadialAreaChart(g, rows, innerW, innerH, ctx) {
    const opts = ctx.opts || {};
    const margin = opts.margin || { top: 20, right: 20, bottom: 20, left: 20 };
    const width = innerW - margin.left - margin.right;
    const height = innerH - margin.top - margin.bottom;
    const radius = Math.min(width, height) / 2;

    const innerRadius = opts.innerRadius || 0;
    const outerRadius = opts.outerRadius || radius;

    // Use dataKeys from config
    const angleKey = opts.dataKeys?.angleKey || "angle";
    const valueKey = opts.dataKeys?.valueKey || "value";

    const rScale = d3.scaleLinear()
      .domain([0, d3.max(rows, d => d[valueKey])])
      .range([innerRadius, outerRadius]);

    const angleScale = d3.scaleLinear()
      .domain([0, d3.max(rows, d => d[angleKey])])
      .range([opts.startAngle || 0, opts.endAngle || 2 * Math.PI]);

    const areaGenerator = d3.areaRadial()
      .angle(d => angleScale(d[angleKey]))
      .innerRadius(innerRadius)
      .outerRadius(d => rScale(d[valueKey]))
      .curve(d3.curveCardinalClosed);

    const chartG = g.append("g")
      .attr("transform", "translate(" + (margin.left + width / 2) + "," + (margin.top + height / 2) + ")");

    chartG.append("path")
      .datum(rows)
      .attr("fill", opts.color || "#1f77b4")
      .attr("opacity", 0.7)
      .attr("d", areaGenerator);

    // Optional: draw radial axes
    const ticks = 5;
    const gr = chartG.append("g").attr("class", "r-axis");
    rScale.ticks(ticks).forEach(t => {
      gr.append("circle")
        .attr("r", rScale(t))
        .attr("fill", "none")
        .attr("stroke", "#ccc");
    });

    // Optional: add labels on radial axes
    gr.selectAll("text")
      .data(rScale.ticks(ticks))
      .enter()
      .append("text")
      .attr("y", d => -rScale(d))
      .attr("dy", "-0.35em")
      .attr("text-anchor", "middle")
      .text(d => d);
  }


  function renderPackChart(svg, data, width, height, ctx = {}) {
    const opts = ctx.opts || {};
    const margin = opts.margin || { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Convert flat data into hierarchical structure if needed
    // Expecting data as { name, value, children }
    const root = d3.hierarchy(data)
      .sum(d => +d.value || 0)
      .sort((a, b) => b.value - a.value);

    // Pack layout
    const pack = d3.pack()
      .size([innerWidth, innerHeight])
      .padding(opts.padding || 3);

    pack(root);

    const node = g.selectAll("g.node")
      .data(root.descendants())
      .join("g")
      .attr("class", d => d.children ? "node parent" : "node leaf")
      .attr("transform", d => "translate(" + d.x + "," + d.y + ")");

    node.append("circle")
      .attr("r", d => d.r)
      .attr("fill", d => d.children ? (opts.parentColor || "#69b3a2") : (opts.leafColor || "#40a9f3"))
      .attr("stroke", opts.strokeColor || "#333")
      .attr("stroke-width", 1)
      .on("pointerenter", (event, d) => showTip(event, d.data.name + " • " + d.value))
      .on("pointermove", event => showTip(event, document.querySelector('.tooltip').innerHTML))
      .on("pointerleave", hideTip);

    node.append("text")
      .filter(d => !d.children)
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .style("font-size", d => Math.min(2 * d.r, 12))
      .text(d => d.data.name);
  }


  function renderChordChart(g, rows, innerW, innerH, ctx) {
    const opts = ctx.opts || {};
    const keys = opts.dataKeys || {};
    const sourceKey = keys.sourceKey || "source";
    const targetKey = keys.targetKey || "target";
    const valueKey = keys.valueKey || "value";

    const width = innerW;
    const height = innerH;
    const outerRadius = Math.min(width, height) / 2 - 40;

    const colorBase = opts.colors && opts.colors.length ? opts.colors[0] : null;
    const color = colorBase ? d3.scaleLinear()
                              .domain([0, d3.max(rows, d => d[valueKey])])
                              .range([d3.color(colorBase).brighter(1), d3.color(colorBase).darker(1)])
                            : d3.scaleOrdinal(d3.schemeCategory10);

    // Build unique node list
    const nodes = Array.from(new Set(rows.flatMap(d => [d[sourceKey], d[targetKey]])));
    const index = new Map(nodes.map((d,i) => [d,i]));

    // Build adjacency matrix
    const matrix = Array.from({ length: nodes.length }, () => Array(nodes.length).fill(0));
    rows.forEach(d => {
      matrix[index.get(d[sourceKey])][index.get(d[targetKey])] = d[valueKey];
    });

    const chords = d3.chord().padAngle(opts.padAngle ?? 0.05)(matrix);

    const gCenter = g.append("g")
      .attr("transform", "translate(" + width/2 + "," + height/2 + ")");

    // Groups
    gCenter.append("g")
      .selectAll("path")
      .data(chords.groups)
      .join("path")
      .attr("fill", d => colorBase ? color(d3.max(matrix[d.index])) : color(nodes[d.index]))
      .attr("stroke", d => d3.rgb(color(nodes[d.index])).darker())
      .attr("d", d3.arc().innerRadius(outerRadius-20).outerRadius(outerRadius));

    // Ribbons
    gCenter.append("g")
      .attr("fill-opacity", opts.ribbonOpacity ?? 0.7)
      .selectAll("path")
      .data(chords)
      .join("path")
      .attr("d", d3.ribbon().radius(outerRadius-20))
      .attr("fill", d => colorBase ? color(matrix[d.source.index][d.target.index]) : color(nodes[d.source.index]))
      .attr("stroke", d => d3.rgb(color(nodes[d.source.index])).darker())
      .on("pointerenter", (e,d) => showTip(e, nodes[d.source.index] + " → " + nodes[d.target.index] + " • " + matrix[d.source.index][d.target.index]))
      .on("pointerleave", hideTip);

    // Labels
    gCenter.append("g")
      .selectAll("text")
      .data(chords.groups)
      .join("text")
      .each(d => { d.angle = (d.startAngle + d.endAngle)/2; })
      .attr("dy", ".35em")
      .attr("transform", d => "rotate(" + (d.angle*180/Math.PI - 90) + ") translate(" + (outerRadius+10) + ",0)" + (d.angle > Math.PI ? " rotate(180)" : ""))
      .attr("text-anchor", d => d.angle > Math.PI ? "end" : "start")
      .text(d => nodes[d.index]);
  }


  function renderArcDiagram(g, rows, innerW, innerH, ctx) {
      const opts = ctx.opts || {};
      const keys = opts.dataKeys || { sourceKey: "source", targetKey: "target", valueKey: "value" };
      const margin = ctx.margin || { top: 40, right: 40, bottom: 40, left: 40 };
      const width = innerW - margin.left - margin.right;
      const height = innerH - margin.top - margin.bottom;

      const chartG = g.append("g")
          .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      // Extract unique nodes
      const nodesSet = new Set();
      rows.forEach(d => {
          nodesSet.add(d[keys.sourceKey]);
          nodesSet.add(d[keys.targetKey]);
      });
      const nodes = Array.from(nodesSet);

      // Vertical scale for nodes
      const yScale = d3.scalePoint()
          .domain(nodes)
          .range([0, height])
          .padding(0.5);

      const xCenter = width / 2;

      // Max value for arc scaling
      const maxValue = d3.max(rows, d => +d[keys.valueKey] || 1);
      const arcScale = d3.scaleLinear()
          .domain([0, maxValue])
          .range([10, width / 2 - 20]);

      // Color scale
      let colorScale;
      if (opts.colors && opts.colors.length === 1) {
          colorScale = d3.scaleLinear()
              .domain([0, maxValue])
              .range(["white", opts.colors[0]]);
      } else if (opts.colors && opts.colors.length > 1) {
          colorScale = d3.scaleOrdinal()
              .domain(nodes)
              .range(opts.colors);
      } else {
          colorScale = d3.scaleOrdinal(d3.schemeCategory10)
              .domain(nodes);
      }

      // Draw arcs
      chartG.selectAll("path.arc")
          .data(rows)
          .join("path")
          .attr("class", "arc")
          .attr("fill", "none")
          .attr("stroke", d => {
              if (opts.colors && opts.colors.length === 1) {
                  return colorScale(+d[keys.valueKey] || 1);
              } else {
                  return colorScale(d[keys.sourceKey]);
              }
          })
          .attr("stroke-width", 2)
          .attr("d", d => {
              const r = arcScale(+d[keys.valueKey] || 1);
              const y1 = yScale(d[keys.sourceKey]);
              const y2 = yScale(d[keys.targetKey]);
              const path = d3.path();
              path.moveTo(xCenter, y1);
              path.bezierCurveTo(xCenter + r, (y1 + y2)/2, xCenter + r, (y1 + y2)/2, xCenter, y2);
              return path.toString();
          })
          .on("pointerenter", (e, d) => {
              const content = keys.sourceKey + ": " + d[keys.sourceKey] + "<br>" +
                              keys.targetKey + ": " + d[keys.targetKey] + "<br>" +
                              keys.valueKey + ": " + d[keys.valueKey];
              showTip(e, content);
          })
          .on("pointermove", e => showTip(e, document.querySelector(".tooltip").innerHTML))
          .on("pointerleave", hideTip);

      // Draw nodes
      chartG.selectAll("circle.node")
          .data(nodes)
          .join("circle")
          .attr("class", "node")
          .attr("cx", xCenter)
          .attr("cy", d => yScale(d))
          .attr("r", opts.nodeRadius || 5)
          .attr("fill", d => colorScale(d))
          .attr("stroke", opts.nodeStroke || "#000")
          .attr("stroke-width", opts.nodeStrokeWidth || 1);

      // Draw labels left of nodes with same color as node/arc
      chartG.selectAll("text.label")
          .data(nodes)
          .join("text")
          .attr("class", "label")
          .attr("x", xCenter - (opts.nodeRadius || 5) - 5) // left of circle
          .attr("y", d => yScale(d) + 4) // vertical alignment
          .attr("text-anchor", "end")
          .text(d => d)
          .style("font-family", opts.fontFamily || "Arial, sans-serif")
          .style("font-size", opts.fontSize || "12px")
          .style("fill", d => colorScale(d));
  }


  function renderQQPlot(g, rows, innerW, innerH, ctx) {
    const opts = ctx.opts || {};
    const keys = opts.dataKeys || { xKey: "x", yKey: "y" };
    const margin = ctx.margin || { top: 40, right: 40, bottom: 40, left: 40 };
    const width = innerW - margin.left - margin.right;
    const height = innerH - margin.top - margin.bottom;

    const chartG = g.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Sort values
    const xVals = rows.map(d => +d[keys.xKey]).sort(d3.ascending);
    const yVals = rows.map(d => +d[keys.yKey]).sort(d3.ascending);

    const n = Math.min(xVals.length, yVals.length);
    const quantiles = d3.range(n).map(i => ({
      x: xVals[i],
      y: yVals[i]
    }));

    // Scales
    const x = d3.scaleLinear()
      .domain(d3.extent(quantiles, d => d.x)).nice()
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain(d3.extent(quantiles, d => d.y)).nice()
      .range([height, 0]);

    // Axes
    chartG.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

    chartG.append("g")
      .call(d3.axisLeft(y));

    // Reference line y = x
    chartG.append("line")
      .attr("x1", x(d3.min(x.domain())))
      .attr("y1", y(d3.min(x.domain())))
      .attr("x2", x(d3.max(x.domain())))
      .attr("y2", y(d3.max(x.domain())))
      .attr("stroke", "#999")
      .attr("stroke-dasharray", "4,4");

    // Color scale
    let colorScale;
    if (opts.colors && opts.colors.length === 1) {
      const maxVal = d3.max(quantiles, d => d.y);
      colorScale = d3.scaleLinear().domain([0, maxVal]).range(["white", opts.colors[0]]);
    } else if (opts.colors && opts.colors.length > 1) {
      colorScale = d3.scaleOrdinal().range(opts.colors);
    } else {
      colorScale = () => "steelblue";
    }

    // Points
    chartG.selectAll("circle.point")
      .data(quantiles)
      .join("circle")
      .attr("class", "point")
      .attr("cx", d => x(d.x))
      .attr("cy", d => y(d.y))
      .attr("r", opts.pointRadius || 4)
      .attr("fill", d => colorScale(d.y))
      .on("pointerenter", (e, d) => {
        const content = keys.xKey + ": " + d.x + "<br>" +
                        keys.yKey + ": " + d.y;
        showTip(e, content);
      })
      .on("pointermove", e => showTip(e, document.querySelector(".tooltip").innerHTML))
      .on("pointerleave", hideTip);

    // Title
    if (opts.title) {
      chartG.append("text")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text(opts.title);
    }
  }


  function renderPannableAreaChart(g, rows, innerW, innerH, ctx) {
    const opts = ctx.opts || {};
    const keys = opts.dataKeys || { xKey: "x", yKey: "y" };
    const margin = ctx.margin || { top: 40, right: 40, bottom: 40, left: 40 };
    const width = innerW - margin.left - margin.right;
    const height = innerH - margin.top - margin.bottom;
    const contentWidth = opts.contentWidth || rows.length * 50;

    const chartG = g.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Clip to viewport
    const clipId = "clip-" + Math.random().toString(36).substr(2, 9);
    chartG.append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", width)
      .attr("height", height);

    const drawG = chartG.append("g")
      .attr("clip-path", "url(#" + clipId + ")");

    // Scales
    const x = d3.scaleLinear()
      .domain(d3.extent(rows, d => +d[keys.xKey]))
      .range([0, contentWidth]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(rows, d => +d[keys.yKey])])
      .range([height, 0]);

    // Area generator
    const area = d3.area()
      .x(d => x(d[keys.xKey]))
      .y0(height)
      .y1(d => y(d[keys.yKey]));

    // Area path
    drawG.append("path")
      .datum(rows)
      .attr("fill", ctx.colorScheme || "steelblue")
      .attr("d", area);

    // Axes
    const xAxisG = chartG.append("g")
      .attr("transform", "translate(0, " + height + ")")
      .call(d3.axisBottom(x).ticks(Math.min(rows.length, 10)));

    const yAxisG = chartG.append("g")
      .call(d3.axisLeft(y));

    // Zoom/pan
    const zoom = d3.zoom()
      .scaleExtent([1,1]) // no zooming
      .translateExtent([[0,0],[contentWidth,0]])
      .extent([[0,0],[width,height]])
      .on("zoom", (event) => {
        const t = event.transform;
        drawG.attr("transform", "translate(" + t.x + ", 0)");
        xAxisG.call(d3.axisBottom(t.rescaleX(x)).ticks(Math.min(rows.length,10)));
      });

    (ctx.root || chartG).call(zoom);

    // Title
    if (opts.title) {
      chartG.append("text")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", opts.titleFontSize || "14px")
        .style("font-weight", "bold")
        .text(opts.title);
    }
  }


  function renderTreeLike(g, data, innerW, innerH, ctx) {
    var opts = (ctx && ctx.opts) || {};
    var dataKeys = opts.dataKeys || {};
    var idKey = dataKeys.idKey || "id";
    var parentKey = dataKeys.parentKey || "parent";
    var extraKey = dataKeys.extraKey || "extra";

    // --- Normalize parent
    data.forEach(function (d) {
      if (d[parentKey] === "" || d[parentKey] === undefined) d[parentKey] = null;
    });

    var root = d3.stratify()
      .id(function (d) { return d[idKey]; })
      .parentId(function (d) { return d[parentKey]; })(data);

    var width = opts.width || innerW;
    var height = opts.height || innerH;

    var treeGen = d3.tree().nodeSize([
      opts.nodeSpacingX || 150,
      opts.nodeSpacingY || 120
    ]);

    var treeRoot = treeGen(root);

    // --- Compute bounding box for auto-centering
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    treeRoot.each(function (d) {
      if (d.x < x0) x0 = d.x;
      if (d.x > x1) x1 = d.x;
      if (d.y < y0) y0 = d.y;
      if (d.y > y1) y1 = d.y;
    });

    var treeW = x1 - x0;
    var treeH = y1 - y0;
    var scale = Math.min(width / (treeW + 200), height / (treeH + 200));
    var offsetX = width / 2 - ((x0 + x1) / 2) * scale;
    var offsetY = (opts.topMargin || 80);

    var chartGroup = g.append("g")
      .attr("transform", "translate(" + offsetX + "," + offsetY + ") scale(" + scale + ")");

    var color = d3.scaleOrdinal()
      .domain(treeRoot.descendants().map(function (n) { return n.id; }))
      .range(opts.colorScheme || d3.schemeTableau10);

    // --- Links
    chartGroup.append("g")
      .attr("fill", "none")
      .attr("stroke-opacity", opts.linkOpacity || 0.6)
      .selectAll("path")
      .data(treeRoot.links())
      .join("path")
      .attr("stroke", opts.linkColor || "#999")
      .attr("stroke-width", opts.linkWidth || 2)
      .attr("d", d3.linkVertical()
        .x(function (d) { return d.x; })
        .y(function (d) { return d.y; })
      );

    // --- Nodes
    var nodes = chartGroup.append("g")
      .selectAll("g")
      .data(treeRoot.descendants())
      .join("g")
      .attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      });

    // --- Card setup
    var cardOpts = opts.card || {};
    var cw = cardOpts.width || 140;
    var ch = cardOpts.height || 80;
    var pad = cardOpts.padding || 6;
    var imgSize = cardOpts.imageSize || 36;
    var fontSize = cardOpts.fontSize || "12px";
    var layout = cardOpts.layout || "horizontal"; // "horizontal" | "vertical"
    var fields = Array.isArray(cardOpts.fields) ? cardOpts.fields : [];
    var globalImg = cardOpts.globalImage || null;

    nodes.each(function (d) {
      var group = d3.select(this);
      var datum = d.data;
      var extra = datum[extraKey];
      var hasExtra = !!extra;

      if (hasExtra) {
        // --- Draw card
        group.append("rect")
          .attr("x", -cw / 2)
          .attr("y", -ch / 2)
          .attr("width", cw)
          .attr("height", ch)
          .attr("fill", cardOpts.fill || "#fff")
          .attr("stroke", cardOpts.stroke || "#000")
          .attr("stroke-width", cardOpts.strokeWidth || 1)
          .attr("rx", cardOpts.radius || 6)
          .attr("ry", cardOpts.radius || 6);

        var imgSrc = extra.icon || globalImg;
        var textStartX = -cw / 2 + pad;
        var textStartY = -ch / 2 + pad + 5;

        if (layout === "horizontal") {
          // --- Image on left
          if (imgSrc) {
            group.append("image")
              .attr("xlink:href", imgSrc)
              .attr("x", -cw / 2 + pad)
              .attr("y", -ch / 2 + (ch - imgSize) / 2)
              .attr("width", imgSize)
              .attr("height", imgSize);
            textStartX += imgSize + pad;
          }
          textStartY = -ch / 2 + pad + 5;
        } else {
          // --- Image on top
          if (imgSrc) {
            group.append("image")
              .attr("xlink:href", imgSrc)
              .attr("x", -imgSize / 2)
              .attr("y", -ch / 2 + pad)
              .attr("width", imgSize)
              .attr("height", imgSize);
            textStartY = -ch / 2 + imgSize + pad;
          }
        }

        // --- Title (wrap text inside card)
        var title = extra.title || datum[idKey];
        appendWrappedText(group, title, textStartX, textStartY, cw - pad * 2 - (layout === "horizontal" ? imgSize : 0), fontSize, "bold");

        // --- Render extra fields with spacing after title
        var titleSpacing = cardOpts.titleSpacing || 6;
        var currentY = textStartY + titleSpacing;

        fields.forEach(function (field) {
          if (extra[field] !== undefined && field !== "title" && field !== "icon") {
            appendWrappedText(
              group,
              field + ": " + extra[field],
              textStartX,
              currentY,
              cw - pad * 2 - (layout === "horizontal" ? imgSize : 0),
              fontSize,
              "normal"
            );
            currentY += parseInt(fontSize, 10) * 1.2; // dynamic line height
          }
        });

      } else {
        // --- Simple node
        var icon = datum.icon || (extra && extra.icon);
        if (icon) {
          group.append("image")
            .attr("xlink:href", icon)
            .attr("x", -(opts.iconSize || 12) / 2)
            .attr("y", -(opts.iconSize || 12) / 2)
            .attr("width", opts.iconSize || 12)
            .attr("height", opts.iconSize || 12);
        } else {
          group.append("circle")
            .attr("r", opts.nodeRadius || 8)
            .attr("fill", function (n) { return color(n.id); })
            .attr("stroke", opts.nodeStroke || "#000")
            .attr("stroke-width", opts.nodeStrokeWidth || 1);
        }

        if (opts.showLabels !== false) {
          group.append("text")
            .attr("dy", "-0.8em")
            .attr("text-anchor", "middle")
            .style("font-size", opts.labelFontSize || "12px")
            .text(datum[idKey]);
        }
      }
    });

    // Tooltip
    if (opts.tooltip !== false) {
      nodes.on("pointerenter", (e, d) => {
        const nodeId = d.data[idKey];
        const parentId = d.parent ? d.parent.data[idKey] : "Root";
        const text = nodeId + " → " + parentId;
        showTip(e, text);
      })
      .on("pointermove", e => showTip(e, document.querySelector(".tooltip").innerHTML))
      .on("pointerleave", hideTip);
    }

    // --- helper for wrapped text
    function appendWrappedText(group, text, x, y, maxWidth, fontSize, weight) {
      var words = text.split(/\s+/);
      var line = [];
      var lineHeight = 1.1;
      var dy = 0;
      var tspan = null;
      var textEl = group.append("text")
        .attr("x", x)
        .attr("y", y)
        .attr("text-anchor", "start")
        .style("font-size", fontSize)
        .style("font-weight", weight)
        .style("dominant-baseline", "hanging");

      words.forEach(function (word) {
        line.push(word);
        textEl.text(line.join(" "));
        if (textEl.node().getComputedTextLength() > maxWidth) {
          line.pop();
          textEl.text(line.join(" "));
          line = [word];
          tspan = group.append("text")
            .attr("x", x)
            .attr("y", y + (++dy) * 14)
            .attr("text-anchor", "start")
            .style("font-size", fontSize)
            .style("font-weight", weight)
            .style("dominant-baseline", "hanging")
            .text(word);
        }
      });
    }
  }



}

// boot
render('#chart', INPUT);
})();
</script>
</body>
</html>`;
};



const chartLogic = buildChartHTML({
  "chartType": "tree",
  "data": [
    {
      "id": "CEO",
      "parent": "",
      "extra": {
        "title": "Chief Executive Officer",
        "value": 10,
        "icon": "http://www.bigbiz.com/bigbiz/icons/ultimate/Comic/Comic13.gif",
        "age": 58
      }
    },
    {
      "id": "Manager A",
      "parent": "CEO",
      "extra": {
        "title": "Manager A",
        "value": 5,
        "icon": "http://www.bigbiz.com/bigbiz/icons/ultimate/Comic/Comic41.gif",
        "age": 42
      }
    },
    {
      "id": "Manager B",
      "parent": "CEO",
      "extra": {
        "title": "Manager B",
        "value": 8,
        "age": 45
      }
    },
    {
      "id": "Staff 1",
      "parent": "Manager A",
      "extra": {
        "title": "Staff 1",
        "value": 4,
        "age": 28
      }
    },
    {
      "id": "Staff 2",
      "parent": "Manager A",
      "extra": {
        "title": "Staff 2",
        "value": 6,
        "icon": "http://www.bigbiz.com/bigbiz/icons/ultimate/Comic/Comic114.gif",
        "age": 26
      }
    }
  ],
  "options": {
    "title": "Organization Tree",
    "width": 800,
    "height": 600,
    "colorScheme": ["#1f77b4", "#ff7f0e", "#2ca02c", "#9467bd"],
    "linkColor": "#999",
    "linkOpacity": 0.6,
    "linkWidth": 2,
    "tooltip": true,
    "dataKeys": {
      "idKey": "id",
      "parentKey": "parent",
      "extraKey": "extra"
    },
    "card": {
      "width": 80,
      "height": 50,
      "padding": 8,
      "imageSize": 12,
      "fontSize": "6px",
      "fill": "#ffffff",
      "stroke": "#333333",
      "strokeWidth": 1,
      "radius": 6,
      "titleSpacing": 12,
      "fields": ["title", "value", "age"],
      "globalImage": null,
      "layout": "vertical"
    },
    "nodeRadius": 8,
    "nodeStroke": "#000",
    "nodeStrokeWidth": 1,
    "iconSize": 8
  }
});


console.log(chartLogic);
