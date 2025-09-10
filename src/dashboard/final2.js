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
function normalizeXYRows(rows){
  return rows.map(function(d){ return { x: xNumOf(d), y: yNumOf(d), r: (+d.r) || (+d.size) || Math.abs(+d.value)||NaN, key: nameOf(d) }; })
    .filter(function(d){ return Number.isFinite(d.x) && Number.isFinite(d.y); });
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
  if (['pie','donut','arc','radial'].includes(type)){ renderRadialLike(g, rows, type, innerW, innerH, { root: root, colorScheme: colorScheme }); return; }
  if (type==='nested-pies'){ renderNestedPies(g, rows, innerW, innerH, { root: root, colorScheme: colorScheme }); return; }
  if (type==='heatmap'){ renderCalendarHeatmap(g, rows, innerW, innerH); return; }
  if (type==='matrix-heatmap'){ renderMatrixHeatmap(g, rows, innerW, innerH, { margin: margin, colorScheme: colorScheme, root: root }); return; }
  if (type==='dendrogram'){ renderDendrogram(g, input, innerW, innerH); return; }
  if (type==='kmeans'){ renderKMeans(g, rows, innerW, innerH, { margin: margin, opts: opts, root: root, colorScheme: colorScheme }); return; }
  if (type==='exp-regression'){ renderExpRegression(g, rows, innerW, innerH, { margin: margin, opts: opts, root: root }); return; }
  if (type==='candlestick'){ renderCandlestick(g, rows, innerW, innerH, { margin: margin, opts: opts, root: root }); return; }
  if (type==='bump'){ renderBump(g, rows, innerW, innerH, { margin: margin, opts: opts, root: root, colorScheme: colorScheme }); return; }
  if (type==='force'){ renderForce(g, input, innerW, innerH, { svg: svg, root: root }); return; }
  if (type==='geo'){ renderGeo(g, rows, innerW, innerH, { svg: svg, root: root, opts: opts, width: width, height: height, margin: margin, colorScheme: colorScheme }); return; }
  if (type==='geo-graph'){ renderGeoGraph(g, rows, innerW, innerH, { svg: svg, root: root, opts: opts, width: width, height: height, margin: margin }); return; }
  if (type==='grouped-bar'){ renderGroupedBar(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }
  if (['stackedArea','stackedLine'].includes(type)){ renderStackedBar(g, rows, type, innerW, innerH, { margin: margin, opts: opts, root: root }); return; }
  if (type==='stacked-area'){ renderStackedArea(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }
  if (type==='histogram'){ renderHistogram(g, rows, innerW, innerH, { margin, opts, root }); return; }
  if (type==='treemap'){ renderTreemap(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }
  if (type === 'sunburst') { renderSunburst(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); }
  if (type === 'boxPlot') { renderBoxPlot(g, rows, innerW, innerH, { margin, opts, root }); return; }
  if (type ==='radial-area'){ renderRadialAreaChart(g, rows, innerW, innerH, { margin, opts, root }); return; }
  if (type === 'wordCloud') { renderWordCloud(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }
  if (type==='hexbin'){ renderHexbin(g, rows, innerW, innerH, { margin, opts, root, colorScheme }); return; }
  if(type==='choropleth'){ renderChoropleth(g, rows, innerW, innerH, { svg: svg, root: root, opts: opts, width: width, height: height, margin: margin, colorScheme: colorScheme }); return; }


  g.append('text').attr('x', innerW/2).attr('y', innerH/2).attr('text-anchor','middle')
   .style('font','14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif')
   .text('Unsupported chartType: ' + type);

  // -------- Renderers (existing ones unchanged, some omitted for brevity in comments) --------
  function renderTimeLike(g, rows, type, innerW, innerH, ctx){
    var norm = normalizeTimeRows(rows);
    var margin = ctx.margin, opts = ctx.opts, root = ctx.root;
    if (!norm.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('No valid data'); return; }
    var x = d3.scaleUtc().domain(d3.extent(norm, function(d){ return d.date; })).range([0, innerW]).nice();
    var yDomMax = d3.max(norm, function(d){ return Number.isFinite(d.value)? d.value : Math.max(d.open||0,d.high||0,d.low||0,d.close||0); }) || 0;
    var y = d3.scaleLinear().domain([0, yDomMax]).nice().range([innerH,0]);
    g.append('g').attr('transform', 'translate(0,'+innerH+')').call(d3.axisBottom(x).ticks(Math.min(6,norm.length)).tickFormat(fmt.dateShort));
    g.append('g').call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));
    g.append('g').attr('stroke-opacity',0.1).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(function(){ return ''; }));

    var line = d3.line().x(function(d){ return x(d.date); }).y(function(d){ return y(d.value); }).defined(function(d){ return Number.isFinite(d.value); });
    if (type==='area'){
      var area = d3.area().x(function(d){ return x(d.date); }).y0(y(0)).y1(function(d){ return y(d.value); }).defined(function(d){ return Number.isFinite(d.value); });
      g.append('path').datum(norm).attr('d', area).attr('fill','currentColor').attr('opacity',0.15);
    }
    if (type==='line'||type==='area'||type==='barline'){
      g.append('path').datum(norm).attr('fill','none').attr('stroke','currentColor').attr('stroke-width',2).attr('d', line);
    }
    if (type==='bar'||type==='barline'){
      var xBand = d3.scaleBand().domain(norm.map(function(d){ return +d.date; })).range([0, innerW]).padding(0.2);
      g.selectAll('rect.bar').data(norm.filter(function(d){ return Number.isFinite(d.value); })).join('rect').attr('class','bar')
        .attr('x',function(d){ return xBand(+d.date); }).attr('y',function(d){ return y(Math.max(0,d.value)); })
        .attr('width',xBand.bandwidth()).attr('height',function(d){ return Math.abs(y(d.value)-y(0)); })
        .attr('fill','currentColor').attr('opacity', type==='barline'?0.35:1)
        .on('pointerenter',function(e,d){ showTip(e, fmt.dateISO(d.date)+' • '+d.value); })
        .on('pointermove',function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
        .on('pointerleave',hideTip);
    }
    if (type!=='bar'){
      g.selectAll('circle.pt').data(norm.filter(function(d){ return Number.isFinite(d.value); })).join('circle').attr('class','pt')
        .attr('cx',function(d){ return x(d.date); }).attr('cy',function(d){ return y(d.value); }).attr('r',3).attr('fill','currentColor')
        .on('pointerenter',function(e,d){ showTip(e, fmt.dateISO(d.date)+' • '+d.value); })
        .on('pointermove',function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
        .on('pointerleave',hideTip);
    }
    g.append('text').attr('x',-innerH/2).attr('y',-margin.left+14).attr('transform','rotate(-90)').attr('text-anchor','middle').style('font-size','12px').text(opts.yLabel||'Value');
    g.append('text').attr('x',innerW/2).attr('y',innerH+40).attr('text-anchor','middle').style('font-size','12px').text(opts.xLabel||'Date');
    addLegend(root, [opts.seriesLabel || 'Series'], function(){ return 'currentColor'; });
  }

  function renderXYLike(g, rows, type, innerW, innerH, ctx){
    var margin = ctx.margin, opts = ctx.opts, root = ctx.root, colorScheme = ctx.colorScheme;
    var norm = normalizeXYRows(rows);
    if (!norm.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('No valid data'); return; }
    var x = d3.scaleLinear().domain(d3.extent(norm, function(d){ return d.x; })).nice().range([0, innerW]);
    var y = d3.scaleLinear().domain(d3.extent(norm, function(d){ return d.y; })).nice().range([innerH, 0]);
    var rMax = d3.max(norm, function(d){ return Number.isFinite(d.r)? d.r : 3; }) || 3;
    var r = d3.scaleSqrt().domain([0, rMax]).range([3, Math.min(innerW, innerH)/10]);
    var color = d3.scaleOrdinal().domain(norm.map(function(d){ return d.key; })).range(colorScheme);

    g.append('g').attr('transform','translate(0,'+innerH+')').call(d3.axisBottom(x).ticks(6));
    g.append('g').call(d3.axisLeft(y).ticks(6));
    g.append('g').attr('stroke-opacity',0.1).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(function(){ return ''; }));

    g.selectAll('circle.dot').data(norm).join('circle').attr('class','dot')
      .attr('cx', function(d){ return x(d.x); }).attr('cy', function(d){ return y(d.y); })
      .attr('r', function(d){ return (type==='bubble' && Number.isFinite(d.r)) ? r(d.r) : 4; })
      .attr('fill', function(d){ return color(d.key || ''); })
      .attr('fill-opacity', 0.85)
      .on('pointerenter', function(e,d){ showTip(e, (d.key? d.key+' • ' : '') + 'x=' + d.x + ', y=' + d.y + (type==='bubble' && Number.isFinite(d.r) ? ', r=' + d.r : '')); })
      .on('pointermove', function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
      .on('pointerleave', hideTip);

    g.append('text').attr('x',-innerH/2).attr('y',-margin.left+14).attr('transform','rotate(-90)').attr('text-anchor','middle').style('font-size','12px').text(opts.yLabel||'Y');
    g.append('text').attr('x',innerW/2).attr('y',innerH+40).attr('text-anchor','middle').style('font-size','12px').text(opts.xLabel||'X');

    var legendItems = Array.from(new Set(norm.map(function(d){ return d.key; }))).filter(function(v){ return !!v; });
    if (legendItems.length){ addLegend(root, legendItems, function(k){ return color(k); }); }
    if (type==='bubble'){ addLegend(root, ['Small','Large'], function(k){ return k==='Small'? '#a3a3a3' : '#404040'; }); }
  }

  function renderRadialLike(g, rows, type, innerW, innerH, ctx){
    var root = ctx.root, colorScheme = ctx.colorScheme;
    var cx=innerW/2, cy=innerH/2; var R=Math.min(innerW, innerH)/2;
    var norm = normalizeCatRows(rows);
    var color = d3.scaleOrdinal().domain(norm.map(function(d){ return d.key; })).range(colorScheme);
    if (type==='arc'){
      var v = norm.length? norm[0].value : 0;
      var max = (rows[0] && typeof rows[0].max==='number')? rows[0].max : 100;
      var k = Math.max(0, Math.min(1, v/max));
      var ir=R*0.7; var start=-Math.PI; var end=0; var arc=d3.arc().innerRadius(ir).outerRadius(R).startAngle(start);
      g.attr('transform','translate('+cx+','+cy+')');
      g.append('path').attr('d', arc.endAngle(end)).attr('fill','currentColor').attr('opacity',0.15);
      g.append('path').attr('d', arc.endAngle(start+(end-start)*k)).attr('fill','currentColor');
      g.append('text').attr('text-anchor','middle').attr('dy','0.35em').style('font-weight','600').text(Math.round(k*100)+'%');
      addLegend(root, [ (rows[0] && rows[0].name) ? rows[0].name : 'Value' ], function(){ return 'currentColor'; });
      return;
    }
    if (!norm.length){ g.append('text').attr('x',cx).attr('y',cy).attr('text-anchor','middle').text('No valid data'); return; }

    if (type==='radial'){
      var a = d3.scaleBand().domain(norm.map(function(x){ return x.key; })).range([0,2*Math.PI]).padding(0.1);
      var r = d3.scaleLinear().domain([0, d3.max(norm,function(x){ return x.value; })||1]).range([R*0.25,R]);
      g.attr('transform','translate('+cx+','+cy+')');
      g.selectAll('path.rad').data(norm).join('path').attr('class','rad')
        .attr('d', function(d){ return d3.arc().innerRadius(R*0.25).outerRadius(r(d.value)).startAngle(a(d.key)).endAngle(a(d.key)+a.bandwidth())(); })
        .attr('fill', function(d){ return color(d.key); })
        .on('pointerenter',function(e,d){ showTip(e, d.key+': '+d.value); })
        .on('pointermove',function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
        .on('pointerleave',hideTip);
      addLegend(root, norm.map(function(d){ return d.key; }), function(k){ return color(k); });
      return;
    }

    var pie = d3.pie().value(function(d){ return d.value; }).sort(null);
    var arcs = pie(norm);
    var innerR = (type==='donut') ? R*0.6 : 0;
    g.attr('transform','translate('+cx+','+cy+')');
    g.selectAll('path.slice').data(arcs).join('path').attr('class','slice')
      .attr('d', d3.arc().innerRadius(innerR).outerRadius(R))
      .attr('fill', function(d){ return color(d.data.key); })
      .on('pointerenter',function(e,d){ showTip(e, d.data.key+': '+d.data.value); })
      .on('pointermove',function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
      .on('pointerleave',hideTip);
    addLegend(root, norm.map(function(d){ return d.key; }), function(k){ return color(k); });
  }

  // ---- Grouped Bar ----
  // expects rows: [{ group, series, value }]
  function renderGroupedBar(g, rows, innerW, innerH, ctx){
  var margin=ctx.margin, opts=ctx.opts, root=ctx.root, scheme=ctx.colorScheme;
  var data = rows.map(r=>({ group: r.group ?? r.category ?? r.x ?? nameOf(r),
                              series: r.series ?? r.name ?? r.key ?? 'Series',
                              value: +valueOf(r) }))
                  .filter(d=>d.group!=null && d.series!=null && Number.isFinite(d.value));
  if (!data.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Provide {group, series, value}'); return; }

  var groups = Array.from(new Set(data.map(d=>d.group)));
  var series = Array.from(new Set(data.map(d=>d.series)));
  var x0 = d3.scaleBand().domain(groups).range([0,innerW]).padding(0.2);
  var x1 = d3.scaleBand().domain(series).range([0, x0.bandwidth()]).padding(0.1);
  var y  = d3.scaleLinear().domain([0, d3.max(data,d=>d.value)||0]).nice().range([innerH,0]);
  var color = d3.scaleOrdinal().domain(series).range(scheme);

  g.append('g').attr('transform','translate(0,'+innerH+')').call(d3.axisBottom(x0));
  g.append('g').call(d3.axisLeft(y).ticks(6));
  g.append('g').attr('stroke-opacity',0.08).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(()=>''))

  g.selectAll('g.grp').data(groups).join('g').attr('class','grp')
      .attr('transform',d=>'translate('+x0(d)+',0)')
      .selectAll('rect').data(d=>series.map(s=>({ group:d, series:s, value:(data.find(x=>x.group===d && x.series===s)||{value:0}).value })))
      .join('rect')
      .attr('x',d=>x1(d.series)).attr('y',d=>y(d.value))
      .attr('width',x1.bandwidth()).attr('height',d=>innerH-y(d.value))
      .attr('fill',d=>color(d.series))
      .on('pointerenter', (e,d)=>{ showTip(e, d.group+' • '+d.series+' • '+d.value); })
      .on('pointermove', e=>showTip(e, document.querySelector('.tooltip').innerHTML))
      .on('pointerleave', hideTip);

  addLegend(root, series, k=>color(k));
  g.append('text').attr('x',innerW/2).attr('y',innerH+40).attr('text-anchor','middle').style('font-size','12px').text(opts.xLabel||'Group');
  g.append('text').attr('x',-innerH/2).attr('y',-margin.left+14).attr('transform','rotate(-90)').attr('text-anchor','middle').style('font-size','12px').text(opts.yLabel||'Value');
  }

  // ---- Stacked Area (time) ----
  // expects rows: [{ date, name (series), value }]
  function renderStackedArea(g, rows, innerW, innerH, ctx){
  var margin=ctx.margin, opts=ctx.opts, root=ctx.root, scheme=ctx.colorScheme;
  var parsed = rows.map(r=>({ date: (typeof r.date==='string')? d3.utcParse('%Y-%m-%d')(r.date) : r.date, name: nameOf(r), value:+valueOf(r) }))
                  .filter(r=>r.date instanceof Date && !isNaN(r.date) && r.name && Number.isFinite(r.value))
                  .sort((a,b)=>a.date-b.date);
  if (!parsed.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Provide {date, name, value}'); return; }

  var names = Array.from(new Set(parsed.map(d=>d.name)));
  var dates = Array.from(new Set(parsed.map(d=>+d.date))).sort(d3.ascending).map(t=>new Date(t));
  // pivot: [{date, A:.., B:..}]
  var wide = dates.map(dt=>{
      var row = { date: dt };
      names.forEach(n=>{ var rec = parsed.find(p=>+p.date===+dt && p.name===n); row[n] = rec ? rec.value : 0; });
      return row;
  });

  var x = d3.scaleUtc().domain(d3.extent(dates)).range([0, innerW]);
  var stack = d3.stack().keys(names).order(d3.stackOrderNone).offset(d3.stackOffsetNone);
  var stacked = stack(wide);
  var y = d3.scaleLinear().domain([0, d3.max(stacked[stacked.length-1], d=>d[1])]).nice().range([innerH,0]);
  var color = d3.scaleOrdinal().domain(names).range(scheme);

  g.append('g').attr('transform','translate(0,'+innerH+')').call(d3.axisBottom(x).ticks(Math.min(8,dates.length)).tickFormat(d3.utcFormat('%b %Y')));
  g.append('g').call(d3.axisLeft(y).ticks(6));
  g.append('g').attr('stroke-opacity',0.08).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(()=>''))

  var area = d3.area().x(d=>x(d.data.date)).y0(d=>y(d[0])).y1(d=>y(d[1]));
  g.selectAll('path.layer').data(stacked).join('path').attr('class','layer')
      .attr('d',area).attr('fill',d=>color(d.key)).attr('fill-opacity',0.8)
      .on('pointerenter', (e,d)=>{ showTip(e, d.key); })
      .on('pointermove', e=>showTip(e, document.querySelector('.tooltip').innerHTML))
      .on('pointerleave', hideTip);

  addLegend(root, names, k=>color(k));
  g.append('text').attr('x',innerW/2).attr('y',innerH+40).attr('text-anchor','middle').style('font-size','12px').text(opts.xLabel||'Date');
  g.append('text').attr('x',-innerH/2).attr('y',-margin.left+14).attr('transform','rotate(-90)').attr('text-anchor','middle').style('font-size','12px').text(opts.yLabel||'Total');
  }

  // ---- Histogram ----
  // accepts rows: array of numbers OR objects with {value} (or your usual valueOf)
  function renderHistogram(g, rows, innerW, innerH, ctx){
  var margin=ctx.margin, opts=ctx.opts, root=ctx.root;
  var values = (Array.isArray(rows) ? rows : []).map(v => (typeof v==='number'? v : valueOf(v))).filter(Number.isFinite);
  if (!values.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Provide numeric values'); return; }

  var x = d3.scaleLinear().domain(d3.extent(values)).nice().range([0, innerW]);
  var bin = d3.bin().domain(x.domain()).thresholds(opts.bins || 20);
  var bins = bin(values);
  var y = d3.scaleLinear().domain([0, d3.max(bins, b=>b.length)||1]).nice().range([innerH,0]);

  g.append('g').attr('transform','translate(0,'+innerH+')').call(d3.axisBottom(x));
  g.append('g').call(d3.axisLeft(y).ticks(6));
  g.append('g').attr('stroke-opacity',0.08).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(()=>''))

  g.selectAll('rect.bar').data(bins).join('rect').attr('class','bar')
      .attr('x',d=>x(d.x0)+1).attr('y',d=>y(d.length)).attr('width',d=>Math.max(0, x(d.x1)-x(d.x0)-1)).attr('height',d=>innerH-y(d.length))
      .attr('fill','currentColor').attr('opacity',0.8)
      .on('pointerenter', (e,d)=>{ showTip(e, '['+d.x0.toFixed(2)+', '+d.x1.toFixed(2)+') • n='+d.length); })
      .on('pointermove', e=>showTip(e, document.querySelector('.tooltip').innerHTML))
      .on('pointerleave', hideTip);

  g.append('text').attr('x',innerW/2).attr('y',innerH+40).attr('text-anchor','middle').style('font-size','12px').text(opts.xLabel||'Value');
  g.append('text').attr('x',-innerH/2).attr('y',-margin.left+14).attr('transform','rotate(-90)').attr('text-anchor','middle').style('font-size','12px').text(opts.yLabel||'Count');
  }

  // ---- Treemap ----
  // accepts tree { name, children:[...] } OR flat [{group?, name, value}]
  function renderTreemap(g, rows, innerW, innerH, ctx){
  var rootEl=ctx.root, scheme=ctx.colorScheme;
  var tree;
  if (rows && rows.name && rows.children){ tree = rows; }
  else {
      var flat = rows.map(r=>({ group: r.group ?? r.category ?? 'All', name: nameOf(r), value: +valueOf(r) }))
                  .filter(d=>d.name && Number.isFinite(d.value));
      if (!flat.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Provide {name,value} or hierarchical data'); return; }
      var byGroup = d3.groups(flat, d=>d.group).map(([gname, arr]) => ({ name: gname, children: arr.map(a=>({ name:a.name, value:a.value })) }));
      tree = { name:'root', children: byGroup };
  }
  var root = d3.hierarchy(tree).sum(d=>d.value||0).sort((a,b)=>b.value-a.value);
  d3.treemap().size([innerW, innerH]).paddingInner(2)(root);
  var color = d3.scaleOrdinal(scheme);
  var groups = Array.from(new Set(root.children?.map(d=>d.data.name) || []));
  if (groups.length){ addLegend(rootEl, groups, k=>color(k)); }

  var cells = g.selectAll('g.cell').data(root.leaves()).join('g').attr('class','cell')
      .attr('transform',d=>'translate('+d.x0+','+d.y0+')');

  cells.append('rect')
      .attr('width',d=>d.x1-d.x0).attr('height',d=>d.y1-d.y0)
      .attr('fill',d=>color(d.parent? d.parent.data.name : ''))
      .attr('fill-opacity',0.9)
      .on('pointerenter', (e,d)=>{ showTip(e, (d.ancestors().slice(1).map(a=>a.data.name).join(' › '))+' • '+(d.value||0)); })
      .on('pointermove', e=>showTip(e, document.querySelector('.tooltip').innerHTML))
      .on('pointerleave', hideTip);

  cells.append('text')
      .attr('x',4).attr('y',14).style('font-size','12px').style('fill','white')
      .text(d=>d.data.name)
      .attr('pointer-events','none')
      .each(function(d){
      // hide labels that don't fit
      var w = d.x1-d.x0, el = this; if (el.getComputedTextLength() > w-8) el.textContent='';
      });
  }


  // ---- NEW: Nested Pies (concentric levels) ----
  function renderNestedPies(g, rows, innerW, innerH, ctx){
    var root = ctx.root, colorScheme = ctx.colorScheme;
    var cx=innerW/2, cy=innerH/2; var R=Math.min(innerW, innerH)/2;
    // accepts either flat rows with {level, name, value} or tree { name, children }
    var tree = Array.isArray(rows)
      ? { name:'root', children: d3.groups(rows, d=>d.level).sort((a,b)=>d3.ascending(a[0],b[0]))
          .map(function(level){ return { name: String(level[0]), children: level[1].map(function(r){ return { name: nameOf(r), value: +r.value }; }) }; }) }
      : rows;
    var rootH = d3.hierarchy(tree).sum(d=>d.value||0);
    var levels = rootH.height + 1;
    var ringWidth = R / (levels + 0.5);
    var color = d3.scaleOrdinal(colorScheme);

    g.attr('transform','translate('+cx+','+cy+')');
    var partition = d3.partition().size([2*Math.PI, R])(rootH);
    g.selectAll('path').data(partition.descendants().filter(d=>d.depth>0)).join('path')
      .attr('d', d3.arc().startAngle(d=>d.x0).endAngle(d=>d.x1)
                       .innerRadius(d=>d.y0).outerRadius(d=>d.y1))
      .attr('fill', d=>color(d.ancestors().map(a=>a.data.name).reverse().join('/')))
      .attr('fill-opacity', 0.9)
      .on('pointerenter', function(e,d){
        var label = d.ancestors().map(a=>a.data.name).reverse().slice(1).join(' › ');
        showTip(e, (label||'(root)') + ': ' + (d.value||0));
      })
      .on('pointermove', function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
      .on('pointerleave', hideTip);
  }

  function renderCalendarHeatmap(g, rows, innerW, innerH){
    var norm = normalizeTimeRows(rows);
    if (!norm.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('No valid data'); return; }
    var byYear = d3.groups(norm, function(d){ return d.date.getUTCFullYear(); });
    var years = byYear.map(function(d){ return d[0]; }).sort(d3.ascending);
    var cell=14, gap=2; var color = d3.scaleSequential(d3.interpolateTurbo).domain([0, d3.max(norm,function(d){ return d.value; })||1]);
    years.forEach(function(yr, yi){
      var Y = yi * (cell*7 + 24 + 20);
      var data = byYear.find(function(d){ return d[0]===yr; })[1];
      var map = new Map(data.map(function(d){ return [fmt.dateISO(d.date), d.value]; }));
      g.append('text').attr('x',0).attr('y',Y+12).style('font-size','12px').text(yr);
      var first=new Date(Date.UTC(yr,0,1)), last=new Date(Date.UTC(yr,11,31));
      var days=d3.utcDays(first, d3.utcDay.offset(last,1));
      var group=g.append('g').attr('transform','translate(40,'+Y+')');
      group.selectAll('rect.day').data(days).join('rect').attr('class','day')
        .attr('width',cell).attr('height',cell)
        .attr('x',function(d){ return d3.utcWeek.count(new Date(Date.UTC(yr,0,1)), d) * (cell+gap); })
        .attr('y',function(d){ return d.getUTCDay() * (cell+gap) + 16; })
        .attr('rx',2).attr('ry',2)
        .attr('fill', function(d){ var v = map.get(fmt.dateISO(d))||0; return v===0 ? '#e5e7eb' : color(v); })
        .on('pointerenter',function(e,d){ var v=map.get(fmt.dateISO(d))||0; showTip(e, fmt.dateISO(d)+' • '+v); })
        .on('pointermove',function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
        .on('pointerleave',hideTip);
    });
  }

  function renderMatrixHeatmap(g, rows, innerW, innerH, ctx){
    var xs = Array.from(new Set(rows.map(function(r){ return r.x; })));
    var ys = Array.from(new Set(rows.map(function(r){ return r.y; })));
    if (!xs.length || !ys.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Provide {x,y,value} rows'); return; }
    var xScale = d3.scaleBand().domain(xs).range([0, innerW]).padding(0.05);
    var yScale = d3.scaleBand().domain(ys).range([0, innerH]).padding(0.05);
    var maxV = d3.max(rows, function(d){ return +d.value; })||1;
    var color = d3.scaleSequential(d3.interpolateTurbo).domain([0, maxV]);
    g.append('g').attr('transform','translate(0,'+innerH+')').call(d3.axisBottom(xScale));
    g.append('g').call(d3.axisLeft(yScale));
    g.selectAll('rect.cell').data(rows).join('rect').attr('class','cell')
      .attr('x', function(d){ return xScale(d.x); }).attr('y', function(d){ return yScale(d.y); })
      .attr('width', xScale.bandwidth()).attr('height', yScale.bandwidth())
      .attr('rx',2).attr('ry',2).attr('fill', function(d){ return color(+d.value); })
      .on('pointerenter', function(e,d){ showTip(e, d.x+' × '+d.y+' • '+d.value); })
      .on('pointermove', function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
      .on('pointerleave', hideTip);
    addLegend(ctx.root, ['Low','High'], function(k){ return k==='Low' ? color(0) : color(maxV); });
  }

  function renderDendrogram(g, input, innerW, innerH){
    var tree = (input && input.data && (input.data.children || input.data.name)) ? input.data : null;
    if (!tree){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Provide { name, children }'); return; }
    var root = d3.hierarchy(tree);
    var cluster = d3.cluster().size([innerH, innerW - 160]);
    cluster(root);
    g.append('g').selectAll('path').data(root.links()).join('path')
      .attr('fill','none').attr('stroke','currentColor').attr('stroke-opacity',0.4)
      .attr('d', d3.linkHorizontal().x(function(d){ return d.y; }).y(function(d){ return d.x; }));
    var node = g.append('g').selectAll('g').data(root.descendants()).join('g')
      .attr('transform', function(d){ return 'translate(' + d.y + ',' + d.x + ')'; });
    node.append('circle').attr('r',3).attr('fill','currentColor');
    node.append('text').attr('dy','0.32em').attr('x', function(d){ return d.children?-8:8; })
      .attr('text-anchor', function(d){ return d.children?'end':'start'; }).style('font-size','12px')
      .text(function(d){ return d.data.name ?? d.data.id ?? ''; });
  }

  // ---- NEW: Clustering Process (K-means style, static snapshot) ----
  // expects rows: [{x,y, cluster: 0..K-1, name?}], and optional opts.centroids=[{x,y,cluster}]
  function renderKMeans(g, rows, innerW, innerH, ctx){
    var margin = ctx.margin, opts = ctx.opts, root = ctx.root, colorScheme = ctx.colorScheme;
    var norm = normalizeXYRows(rows).map(function(d,i){ d.cluster = rows[i].cluster; return d; });
    if (!norm.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Provide {x,y,cluster} rows'); return; }
    var x = d3.scaleLinear().domain(d3.extent(norm, d=>d.x)).nice().range([0, innerW]);
    var y = d3.scaleLinear().domain(d3.extent(norm, d=>d.y)).nice().range([innerH,0]);
    var clusters = Array.from(new Set(norm.map(d=>d.cluster))).sort(d3.ascending);
    var color = d3.scaleOrdinal().domain(clusters).range(colorScheme);

    g.append('g').attr('transform','translate(0,'+innerH+')').call(d3.axisBottom(x).ticks(6));
    g.append('g').call(d3.axisLeft(y).ticks(6));
    g.append('g').attr('stroke-opacity',0.1).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(function(){ return ''; }));

    g.selectAll('circle.pt').data(norm).join('circle').attr('class','pt')
      .attr('cx', d=>x(d.x)).attr('cy', d=>y(d.y)).attr('r',4)
      .attr('fill', d=>color(d.cluster)).attr('fill-opacity',0.85)
      .on('pointerenter', function(e,d){ showTip(e, (d.key? d.key+' • ':'')+'('+d.x+', '+d.y+') • cluster '+d.cluster); })
      .on('pointermove', function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
      .on('pointerleave', hideTip);

    var cents = (opts.centroids||[]).map(c=>({x:+c.x, y:+c.y, cluster:+c.cluster})).filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.y));
    g.selectAll('path.cent').data(cents).join('path').attr('d', d3.symbol().type(d3.symbolCross).size(160))
      .attr('transform', d=>'translate('+x(d.x)+','+y(d.y)+')')
      .attr('fill', d=>color(d.cluster)).attr('stroke','white').attr('stroke-width',1.5);

    if (clusters.length){ addLegend(root, clusters.map(c=>'Cluster '+c), function(k){ return color(+k.replace('Cluster ','')); }); }
  }

  // ---- NEW: Exponential Regression over XY ----
  // expects rows: [{x, y}] ; draws scatter + fitted curve y = a*e^(b x)
  function renderExpRegression(g, rows, innerW, innerH, ctx){
    var margin = ctx.margin, opts = ctx.opts, root = ctx.root;
    var pts = normalizeXYRows(rows);
    if (!pts.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Provide {x,y} rows'); return; }
    var x = d3.scaleLinear().domain(d3.extent(pts,d=>d.x)).nice().range([0, innerW]);
    var y = d3.scaleLinear().domain(d3.extent(pts,d=>d.y)).nice().range([innerH,0]);

    g.append('g').attr('transform','translate(0,'+innerH+')').call(d3.axisBottom(x).ticks(6));
    g.append('g').call(d3.axisLeft(y).ticks(6));
    g.append('g').attr('stroke-opacity',0.1).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(function(){ return ''; }));

    g.selectAll('circle').data(pts).join('circle').attr('cx',d=>x(d.x)).attr('cy',d=>y(d.y)).attr('r',3).attr('fill','currentColor').attr('opacity',0.8);

    // fit via linear regression on ln(y): ln y = ln a + b x
    var filtered = pts.filter(p=>p.y>0);
    var n=filtered.length;
    if (n>=2){
      var sumX=0,sumY=0,sumXY=0,sumXX=0;
      filtered.forEach(function(p){ var lx=p.x, ly=Math.log(p.y); sumX+=lx; sumY+=ly; sumXY+=lx*ly; sumXX+=lx*lx; });
      var b = (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX);
      var lna = (sumY - b*sumX)/n;
      var a = Math.exp(lna);

      // curve
      var xs = d3.range(x.domain()[0], x.domain()[1], (x.domain()[1]-x.domain()[0])/200);
      var curve = xs.map(function(xx){ return {x:xx, y:a*Math.exp(b*xx)}; });
      var line = d3.line().x(d=>x(d.x)).y(d=>y(d.y));
      g.append('path').datum(curve).attr('fill','none').attr('stroke','currentColor').attr('stroke-width',2).attr('opacity',0.8).attr('d', line);
      addLegend(root, ['Data','Fit y='+a.toFixed(3)+'·e^(' + b.toFixed(3) + 'x)'], function(k){ return k==='Data' ? '#9ca3af' : '#111827'; });
    }
    g.append('text').attr('x',innerW/2).attr('y',innerH+40).attr('text-anchor','middle').style('font-size','12px').text(opts.xLabel||'X');
    g.append('text').attr('x',-innerH/2).attr('y',-margin.left+14).attr('transform','rotate(-90)').attr('text-anchor','middle').style('font-size','12px').text(opts.yLabel||'Y');
  }

  // ---- NEW: Basic Candlestick ----
  // expects time rows {date, open, high, low, close}
  function renderCandlestick(g, rows, innerW, innerH, ctx){
    var margin = ctx.margin, opts = ctx.opts, root = ctx.root;
    var norm = normalizeTimeRows(rows).filter(d => Number.isFinite(d.open) && Number.isFinite(d.close) && Number.isFinite(d.high) && Number.isFinite(d.low));
    if (!norm.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Provide {date,open,high,low,close} rows'); return; }
    var x = d3.scaleBand().domain(norm.map(d=>+d.date)).range([0, innerW]).padding(0.3);
    var y = d3.scaleLinear().domain([d3.min(norm,d=>d.low), d3.max(norm,d=>d.high)]).nice().range([innerH,0]);

    g.append('g').attr('transform','translate(0,'+innerH+')').call(d3.axisBottom(d3.scaleUtc().domain(d3.extent(norm,d=>d.date)).range([0, innerW])).ticks(6).tickFormat(fmt.dateShort));
    g.append('g').call(d3.axisLeft(y).ticks(6));
    g.append('g').attr('stroke-opacity',0.08).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(function(){ return ''; }));

    // wicks
    g.selectAll('line.wick').data(norm).join('line').attr('class','wick')
      .attr('x1',d=>x(+d.date)+x.bandwidth()/2).attr('x2',d=>x(+d.date)+x.bandwidth()/2)
      .attr('y1',d=>y(d.high)).attr('y2',d=>y(d.low)).attr('stroke','currentColor').attr('stroke-width',1);

    // bodies
    g.selectAll('rect.body').data(norm).join('rect').attr('class','body')
      .attr('x',d=>x(+d.date)).attr('width',x.bandwidth())
      .attr('y',d=>y(Math.max(d.open,d.close)))
      .attr('height',d=>Math.max(1, Math.abs(y(d.open)-y(d.close))))
      .attr('fill',d=>d.close>=d.open ? '#16a34a' : '#dc2626')
      .on('pointerenter',function(e,d){ showTip(e, fmt.dateISO(d.date)+' • O:'+d.open+' H:'+d.high+' L:'+d.low+' C:'+d.close); })
      .on('pointermove',function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
      .on('pointerleave',hideTip);

    addLegend(root, ['Up','Down'], function(k){ return k==='Up' ? '#16a34a' : '#dc2626'; });
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
    var data = input && input.data && input.data.nodes ? input.data : null;
    if (!data){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Provide { nodes, links }'); return; }
    var color = d3.scaleOrdinal(d3.schemeTableau10);
    var link = g.append('g').attr('stroke','currentColor').attr('stroke-opacity',0.3)
      .selectAll('line').data(data.links).join('line').attr('stroke-width', function(d){ return Math.sqrt(d.value||1); });
    var node = g.append('g').attr('stroke','#fff').attr('stroke-width',1.5)
      .selectAll('circle').data(data.nodes).join('circle').attr('r',5).attr('fill', function(d){ return color(d.group||0); })
      .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended))
      .on('pointerenter',function(e,d){ showTip(e, d.id); })
      .on('pointermove',function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
      .on('pointerleave',hideTip);

    var sim = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(function(d){ return d.id; }).distance(function(d){ return 40+(d.value||0); }))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(innerW/2, innerH/2))
      .on('tick', ticked);

    function ticked(){
      link.attr('x1', function(d){ return d.source.x; }).attr('y1', function(d){ return d.source.y; }).attr('x2', function(d){ return d.target.x; }).attr('y2', function(d){ return d.target.y; });
      node.attr('cx', function(d){ return d.x; }).attr('cy', function(d){ return d.y; });
    }
    function dragstarted(event, d){ if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
    function dragged(event, d){ d.fx = event.x; d.fy = event.y; }
    function dragended(event, d){ if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }

    var groups = Array.from(new Set(data.nodes.map(function(n){ return n.group; }))).map(function(v){ return v==null ? 'Group' : 'Group '+v; });
    addLegend(ctx.root, groups, function(k){ var num = +String(k).replace('Group ','')||0; return color(num); });
  }

  // ---- UPDATED: Geo to support BOTH choropleth + scatter in one run ----
  function renderGeo(g, rows, innerW, innerH, ctx){
    var root = ctx.root, opts = ctx.opts;
    var worldUrl = opts.worldUrl || 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

    fetch(worldUrl).then(function(r){ return r.json(); }).then(function(topo){
      if (!topo || !topo.objects || !topo.objects.countries){
        g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Failed to load world map'); return;
      }
      var countries = topojson.feature(topo, topo.objects.countries);
      var proj = (opts.projection && d3[opts.projection] && typeof d3[opts.projection]==='function')
        ? d3[opts.projection]().fitSize([innerW, innerH], countries)
        : d3.geoNaturalEarth1().fitSize([innerW, innerH], countries);
      var path = d3.geoPath(proj);

      g.append('g').selectAll('path.country').data(countries.features).join('path')
        .attr('class','country').attr('d', path).attr('fill', '#e5e7eb').attr('stroke', 'currentColor').attr('stroke-opacity', 0.2);

      // split rows into country values vs points
      var countryRows = rows.filter(function(d){ return (d.iso3||d.id||d.code||d.name) && !Number.isFinite(+d.lat||+d.latitude) && !Number.isFinite(+d.lon||+d.longitude); });
      var pointRows = rows.filter(function(d){ return Number.isFinite(+d.lat||+d.latitude) && Number.isFinite(+d.lon||+d.longitude); });

      if (countryRows.length){
        var byId = new Map();
        countryRows.forEach(function(d){
          var id = (d.iso3 || d.id || d.code || '').toString().toUpperCase();
          if (id) byId.set(id, (+d.value) || (+d.count) || 0);
        });
        var byName = new Map(countryRows.filter(function(d){ return d.name; }).map(function(d){ return [d.name.toString().toLowerCase(), (+d.value) || (+d.count) || 0]; }));
        var values = [];
        countries.features.forEach(function(f){
          var iso3 = f.properties.iso_a3 || f.id || '';
          var nm = (f.properties.name || '').toLowerCase();
          var v = byId.get(String(iso3).toUpperCase());
          if (v==null) v = byName.get(nm);
          if (v==null) v = 0;
          f.__value = v; values.push(v);
        });
        var maxV = d3.max(values)||1;
        var color = d3.scaleSequential(d3.interpolateTurbo).domain([0, maxV]);

        g.selectAll('path.country-fill').data(countries.features).join('path')
          .attr('class','country-fill')
          .attr('d', path)
          .attr('fill', function(d){ return d.__value ? color(d.__value) : '#f3f4f6'; })
          .attr('stroke', 'currentColor').attr('stroke-opacity', 0.15)
          .on('pointerenter', function(e,d){ showTip(e, d.properties.name + ' • ' + (d.__value||0)); })
          .on('pointermove', function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
          .on('pointerleave', hideTip);

        addLegend(root, ['Low','High'], function(k){ return k==='Low'? color(0) : color(maxV); });
      }

      if (pointRows.length){
        var pts = pointRows.map(function(d){ return {
          lat: (+d.lat) || (+d.latitude),
          lon: (+d.lon) || (+d.longitude),
          r: (+d.r) || (+d.size) || (+d.value) || 1,
          name: d.name || d.label || ''
        }; });
        var r = d3.scaleSqrt().domain([0, d3.max(pts, function(d){ return d.r; })||1]).range([2, Math.min(innerW, innerH)/20]);

        g.append('g').selectAll('circle.pin').data(pts).join('circle').attr('class','pin')
          .attr('transform', function(d){ var p = proj([d.lon,d.lat]); return 'translate(' + p[0] + ',' + p[1] + ')'; })
          .attr('r', function(d){ return r(d.r); })
          .attr('fill', 'currentColor').attr('fill-opacity', 0.6).attr('stroke', 'white').attr('stroke-width', 0.5)
          .on('pointerenter', function(e,d){ showTip(e, (d.name||'') + ' ' + d.lat.toFixed(2) + ', ' + d.lon.toFixed(2) + ' • ' + d.r); })
          .on('pointermove', function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
          .on('pointerleave', hideTip);
      }
    }).catch(function(){
      g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Failed to load world map');
    });
  }

  // ---- NEW: Geo Graph (links between coords) ----
  // expects rows: { source:{lat,lon}, target:{lat,lon}, value?, name? } OR {sLat,sLon,tLat,tLon}
  function renderGeoGraph(g, rows, innerW, innerH, ctx){
    var opts = ctx.opts;
    var worldUrl = opts.worldUrl || 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
    fetch(worldUrl).then(r=>r.json()).then(function(topo){
      var countries = topojson.feature(topo, topo.objects.countries);
      var proj = (opts.projection && d3[opts.projection] && typeof d3[opts.projection]==='function')
        ? d3[opts.projection]().fitSize([innerW, innerH], countries)
        : d3.geoNaturalEarth1().fitSize([innerW, innerH], countries);
      var path = d3.geoPath(proj);

      g.append('g').selectAll('path.country').data(countries.features).join('path')
        .attr('class','country').attr('d', path).attr('fill', '#e5e7eb').attr('stroke', 'currentColor').attr('stroke-opacity', 0.2);

      var links = rows.map(function(r){
        var sLat = (r.source && +r.source.lat) || +r.sLat, sLon = (r.source && +r.source.lon) || +r.sLon;
        var tLat = (r.target && +r.target.lat) || +r.tLat, tLon = (r.target && +r.target.lon) || +r.tLon;
        if (!Number.isFinite(sLat)||!Number.isFinite(sLon)||!Number.isFinite(tLat)||!Number.isFinite(tLon)) return null;
        return { s:[sLon,sLat], t:[tLon,tLat], value:(+r.value)||1, name:r.name||'' };
      }).filter(Boolean);

      var geoLine = d3.geoGreatArc ? d3.geoGreatArc() : null;
      // simple great-circle generator
      function greatCircle(a,b){
        var generator = d3.geoInterpolate(a,b);
        var steps = 64, pts = [];
        for (var i=0;i<=steps;i++){ var p = generator(i/steps); pts.push(p); }
        return { type:'LineString', coordinates: pts };
      }

      g.append('g').selectAll('path.link').data(links).join('path').attr('class','link')
        .attr('d', function(d){ return path(greatCircle(d.s, d.t)); })
        .attr('fill','none').attr('stroke','currentColor').attr('stroke-opacity',0.35)
        .attr('stroke-width', d=>Math.max(1, Math.sqrt(d.value)))
        .on('pointerenter', function(e,d){ showTip(e, (d.name||'Link') + ' • ' + d.value); })
        .on('pointermove', function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
        .on('pointerleave', hideTip);
    }).catch(function(){
      g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Failed to load world map');
    });
  }

  // ---- Stacked Bar ----
  function renderStackedBar(g, rows, type, width, height, { margin, opts, root }) {
    // inner chart size
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    // 1. Extract keys (all fields except x/date/year)
    const keys = opts.keys || Object.keys(rows[0]).filter(k => !['x','date','year'].includes(k));

    // 2. Stack the data
    const stack = d3.stack().keys(keys);
    const series = stack(rows);

    // 3. Setup scales
    const x = d3.scalePoint()
      .domain(rows.map(d => d.x || d.year || d.data))
      .range([0, innerW])        // cover full width
      .padding(0);               // no extra space at ends

    const y = d3.scaleLinear()
      .domain([0, d3.max(series[series.length - 1], d => d[1])])
      .nice()
      .range([innerH, 0]);       // bottom → top

    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(keys);

    // 4. Define generators
    const area = d3.area()
      .x(d => x(d.data.x || d.data.year || d.data.date))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]));

    const line = d3.line()
      .x(d => x(d.data.x || d.data.year || d.data.date))
      .y(d => y(d[1]));

    // 5. Draw layers
    if (type === "stackedArea") {
      g.selectAll("path.area")
        .data(series)
        .join("path")
        .attr("class", "area")
        .attr("fill", d => color(d.key))
        .attr("d", area)
        .append("title")
        .text(d => d.key);
    } else if (type === "stackedLine") {
      g.selectAll("path.line")
        .data(series)
        .join("path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", d => color(d.key))
        .attr("stroke-width", 2)
        .attr("d", line)
        .append("title")
        .text(d => d.key);
    }

    // 6. Axes (✅ use innerH for bottom placement)
    g.append("g")
      .attr("transform", "translate(0," + innerH + ")")
      .call(d3.axisBottom(x));

    g.append("g")
      .call(d3.axisLeft(y));

    // 7. Legend (if you already have a legend helper)
    if (typeof legend === "function") {
      legend(color);
    }
  }

    //   Sunburst Chart
  function renderSunburst(g, rows, innerW, innerH, ctx) {
    var root = ctx.root;
    var margin = ctx.margin;
    var colorScheme = ctx.colorScheme;

    // Create a hierarchy from the flat sequence data
    var rootNode = d3.hierarchy(rows)
        .sum(function(d) { return d.value; }) // Calculate the size of each segment
        .sort(function(a, b) { return b.value - a.value; }); // Sort segments by size

    // Set up partition layout for the sunburst
    var partition = d3.partition().size([2 * Math.PI, Math.min(innerW, innerH) / 2]);

    partition(rootNode);

    var arc = d3.arc()
        .startAngle(function(d) { return d.x0; })
        .endAngle(function(d) { return d.x1; })
        .innerRadius(function(d) { return d.y0; })
        .outerRadius(function(d) { return d.y1; });

    // Center the sunburst chart
    var cx = innerW / 2;
    var cy = innerH / 2;
    
    g.attr('transform', 'translate(' + cx + ',' + cy + ')');
    
    // Draw the sequence segments (paths)
    g.selectAll('path')
        .data(rootNode.descendants())
        .join('path')
        .attr('d', arc)
        .attr('fill', function(d, i) {
        // Sequential coloring: Highlight the sequence in flow
        return colorScheme[d.depth % colorScheme.length]; // Color based on depth/sequence level
        })
        .attr('stroke', '#fff') // Stroke for each segment
        .attr('stroke-width', 1)
        .style('opacity', 0.8)
        .on('pointerenter', function(event, d) {
        // Tooltip on hover: Show step sequence info
        showTip(event, 'Step ' + (d.depth + 1) + ':' + d.data.name + '(' + d.value + ' visits)'); 
        })
        .on('pointermove', function(event) {
        showTip(event, document.querySelector('.tooltip').innerHTML); // Update tooltip position
        })
        .on('pointerleave', hideTip); // Hide tooltip on pointer leave

    // Add labels for each segment
    g.selectAll('text')
        .data(rootNode.descendants())
        .join('text')
        .attr('transform', function(d) {
        var angle = (d.x0 + d.x1) / 2;
        var radius = (d.y0 + d.y1) / 2;
        return 'translate(' + arc.centroid(d) + ') rotate(' + (angle * 180 / Math.PI - 90) + ')';
        })
        .style('text-anchor', 'middle')
        .text(function(d) {
        return d.data.name; // Show the name of the step in the sequence
        });

    // Add sequence interaction functionality (optional)
    if (typeof addSequenceInteraction === 'function') {
        addSequenceInteraction(rootNode); // Example: Highlight the current sequence or path
    }

    // Add sequence-specific interaction (e.g., highlight or display current step)
    function addSequenceInteraction(rootNode) {
        // Example logic to highlight or track the current sequence path
        rootNode.each(function(d) {
        if (d.depth === 0) {
            // Highlight the root or starting point (e.g., "home")
            d3.select(this).select('path').style('fill', 'yellow');
        }
        });
    }
  }

  //Box-plot Chart
  function renderBoxPlot(g, rows, innerW, innerH, ctx) {
    const margin = ctx.margin || { top: 20, right: 40, bottom: 40, left: 40 };
    const opts = ctx.opts || {};
    
    const innerWidth = innerW - margin.left - margin.right;
    const innerHeight = innerH - margin.top - margin.bottom;
    
    // Process data for the box plot
    const data = rows.map(row => row.value).flat();  // Flattening the values into a single array
    
    // Calculate the quartiles
    const q1 = d3.quantile(data, 0.25);  // 25th percentile
    const median = d3.quantile(data, 0.5);  // 50th percentile (median)
    const q3 = d3.quantile(data, 0.75);  // 75th percentile
    
    const iqr = q3 - q1;  // Interquartile range
    const lowerWhisker = Math.max(d3.min(data), q1 - 1.5 * iqr);  // Lower whisker
    const upperWhisker = Math.min(d3.max(data), q3 + 1.5 * iqr);  // Upper whisker
    
    // Find outliers
    const outliers = rows.filter(d => d.value < lowerWhisker || d.value > upperWhisker);
    
    // Create scales
    const x = d3.scaleBand()
      .domain(rows.map((d, i) => 'Box ' + (i + 1)))
      .range([0, innerWidth])
      .padding(0.3);
    
    const y = d3.scaleLinear()
      .domain([d3.min(data), d3.max(data)])
      .range([innerHeight, 0]);
    
    // Create the box plot container
    const boxPlot = g.append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    
    // Box (rectangle) for the IQR
    boxPlot.selectAll('.box')
      .data(rows)
      .enter().append('rect')
      .attr('class', 'box')
      .attr('x', (d, i) => x('Box ' + (i + 1)))
      .attr('y', d => y(q3))  // Top of the box is the Q3
      .attr('height', d => y(q1) - y(q3))  // Height of the box is IQR (Q3 - Q1)
      .attr('width', x.bandwidth())
      .attr('fill', 'steelblue')
      .attr('opacity', 0.7);
    
    // Median line inside the box
    boxPlot.selectAll('.median')
      .data(rows)
      .enter().append('line')
      .attr('class', 'median')
      .attr('x1', (d, i) => x('Box ' + (i + 1)))
      .attr('x2', (d, i) => x('Box ' + (i + 1)) + x.bandwidth())
      .attr('y1', d => y(median))  // Median line is at the value of the median
      .attr('y2', d => y(median))
      .attr('stroke', 'black')
      .attr('stroke-width', 2);
    
    // Whiskers
    boxPlot.selectAll('.whisker')
      .data(rows)
      .enter().append('line')
      .attr('class', 'whisker')
      .attr('x1', (d, i) => x('Box ' + (i + 1)) + x.bandwidth() / 2)  // Position at the center of the box
      .attr('x2', (d, i) => x('Box ' + (i + 1)) + x.bandwidth() / 2)
      .attr('y1', d => y(lowerWhisker))  // Whisker goes from lower whisker to Q1
      .attr('y2', d => y(upperWhisker))  // Whisker goes from Q3 to upper whisker
      .attr('stroke', 'black')
      .attr('stroke-width', 2);
    
    // Outliers (dots)
    boxPlot.selectAll('.outlier')
      .data(outliers)
      .enter().append('circle')
      .attr('class', 'outlier')
      .attr('cx', (d, i) => x('Box ' + (i + 1)) + x.bandwidth() / 2)
      .attr('cy', d => y(d.value))
      .attr('r', 5)
      .attr('fill', 'red');
    
    // X and Y axis
    g.append('g')
      .attr('transform', 'translate(' + margin.left + ',' + (margin.top + innerHeight) + ')')
      .call(d3.axisBottom(x));
    
    g.append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
      .call(d3.axisLeft(y));
    
    // Add labels
    g.append('text')
      .attr('x', innerWidth / 2 + margin.left)
      .attr('y', margin.top + innerHeight + 25)
      .style('text-anchor', 'middle')
      .text(opts.xLabel || 'Category');
    
    g.append('text')
      .attr('x', -(innerHeight / 2) - margin.top)
      .attr('y', margin.left - 10)
      .style('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .text(opts.yLabel || 'Value');
  }

  // word-cloud chart---
  function renderWordCloud(g, rows, width, height, ctx) {
    const margin = ctx.margin || { top: 20, right: 40, bottom: 40, left: 40 };
    const opts = ctx.opts || {};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Prepare data for word cloud (assuming rows have 'text' and 'count' fields)
    const words = rows.map(d => ({
      text: d.text,
      size: d.count, // Size based on frequency or importance
    }));

    // Create a scale for font size based on word count
    const fontSizeScale = d3.scaleLinear()
      .domain([d3.min(words, d => d.size), d3.max(words, d => d.size)])
      .range([10, 100]); // Set the font size range

    // Create a layout for the word cloud using d3.layout.cloud
    const layout = d3.layout.cloud()
      .size([innerWidth, innerHeight]) // Set word cloud size
      .words(words.map(d => ({
        text: d.text,
        size: fontSizeScale(d.size), // Use font size scale for sizing
      })))
      .padding(5) // Space between words
      .rotate(() => Math.random() > 0.5 ? 0 : 90) // Randomly rotate words (0 or 90 degrees)
      .fontSize(d => d.size) // Apply size
      .on("end", draw); // When layout is done, call the draw function

    // Start the word cloud layout
    layout.start();

    // Function to draw the word cloud
    function draw(words) {
      g.selectAll("text")
        .data(words) // Bind the data (words) to the text elements
        .join("text") // Join the data with <text> elements
        .attr("text-anchor", "middle") // Center the text
        .attr("transform", d => 'translate(' + d.x + ', ' + d.y + ') rotate(' + d.rotate + ')') // Position and rotate words
        .style("font-size", d => d.size + 'px') // Set font size
        .style("font-family", "Arial, sans-serif") // Set font family
        .style("fill", (d, i) => d3.schemeCategory10[i % 10]) // Color scheme (10 colors)
        .text(d => d.text) // Set the text of each word
        .on('mouseover', function(event, d) { // Show tooltip on mouseover
          showTip(event, d.text + ': ' + d.size + ' occurrences');
        })
        .on('mousemove', function(event) { // Keep tooltip with the mouse
          showTip(event, document.querySelector('.tooltip').innerHTML);
        })
        .on('mouseleave', hideTip); // Hide tooltip on mouse leave
    }

    // Optional: Handle resizing of the word cloud if the window is resized
    window.addEventListener("resize", function() {
      layout.size([innerWidth, innerHeight]).start();
    });

    // Optional: Add a title or label if provided in options
    if (opts.title) {
      g.append("text")
        .attr("x", innerWidth / 2 + margin.left)
        .attr("y", margin.top)
        .style("text-anchor", "middle")
        .style("font-size", "16px")
        .text(opts.title); // Title passed via opts
    }
  }

  //---hexbin chart---
  function renderHexbin(svg, data, width, height, ctx = {}) {
    const margin = ctx.margin || { top: 20, right: 20, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG group element
    const g = svg.append("g")
      .attr("transform", 'translate(' + margin.left + ',' + margin.top + ')');

    // Create hexbin generator
    const hexbin = d3.hexbin()
      .radius(20)
      .extent([[0, 0], [innerWidth, innerHeight]]);

    // Create color scale
    const color = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, 100]);

    // Prepare data for hexbin
    const points = data.map(d => [d.x, d.y]);

    // Compute hexbin data
    const bins = hexbin(points);

    // Draw hexagons
    g.selectAll("path")
      .data(bins)
      .enter().append("path")
      .attr("d", d => hexbin.hexagon())
      .attr("transform", d => 'translate(' + d.x + ',' + d.y + ')')
      .attr("fill", d => color(d.length))
      .attr("stroke", "black")
      .attr("stroke-width", 0.5);

    // Optional: Add axes
    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.x)])
      .range([0, innerWidth]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.y)])
      .range([innerHeight, 0]);

    g.append("g")
      .attr("transform", 'translate(0,' + innerHeight + ')')
      .call(d3.axisBottom(x));

    g.append("g")
      .call(d3.axisLeft(y));
  }

  // ---- Choropleth (topojson or geojson) ----
  function renderChoropleth(g, rows, innerW, innerH, ctx){
    const rootEl = ctx.root;
    const width  = ctx.width;
    const height = ctx.height;
    const opts   = ctx.opts || {};

    // --- Accessors & options (safe defaults) ---
    const featureId = opts.featureId || (f => f.id);
    const idAcc     = opts.id        || (d => d.id);
    const valAcc    = opts.value     || (d => d.value);

    // Build data map: id -> numeric value
    const dataMap = new Map(rows.map(d => [String(idAcc(d)), +valAcc(d)]));

    // Domain
    const autoMin = d3.min(rows, d => +valAcc(d));
    const autoMax = d3.max(rows, d => +valAcc(d));
    const domain  = (opts.domain && Array.isArray(opts.domain)) ? opts.domain : [autoMin ?? 0, autoMax ?? 1];

    // Scale function from string name, default quantize
    const scaleName  = typeof opts.scale === 'string' ? opts.scale : 'scaleQuantize';
    const scaleFn    = (d3[scaleName] && typeof d3[scaleName] === 'function') ? d3[scaleName] : d3.scaleQuantize;

    // Color range: allow string ("schemeBlues"/"Blues") or explicit array
    function resolveColorRange(r, classes){
      if (Array.isArray(r)) return r;
      if (typeof r === 'string'){
        // try exact name, then "scheme" + Name, then shorthand like "Blues"
        if (d3[r]) return Array.isArray(d3[r]) ? (Array.isArray(d3[r][0]) ? (d3[r][classes||9] || d3[r][d3[r].length-1]) : d3[r]) : null;
        const schemeKey = r.startsWith('scheme') ? r : ('scheme' + r[0].toUpperCase() + r.slice(1));
        if (d3[schemeKey]) return Array.isArray(d3[schemeKey]) ? (Array.isArray(d3[schemeKey][0]) ? (d3[schemeKey][classes||9] || d3[schemeKey][d3[schemeKey].length-1]) : d3[schemeKey]) : null;
      }
      return d3.schemeBlues[9];
    }
    const colorRange = resolveColorRange(opts.range, opts.classes);
    const colorScale = scaleFn().domain(domain).range(colorRange);

    // Legend (quantized ramp)
    function drawQuantLegendChoro(host, color, label, w){
      const widthL = w || 240, bandH = 12, heightL = 46;
      const svg = d3.select(host).append('svg').attr('width', widthL).attr('height', heightL);
      const r = color.range();
      const x = d3.scaleLinear().domain(color.domain()).range([0, widthL]);
      // gradient blocks
      const n = r.length;
      svg.selectAll('rect.sw').data(r).join('rect')
        .attr('x',(d,i)=>i*(widthL/n)).attr('y',0)
        .attr('width',widthL/n).attr('height',bandH)
        .attr('fill', d=>d);
      // axis
      svg.append('g')
        .attr('transform', 'translate(0,'+(bandH+2)+')')
        .call(d3.axisBottom(x).ticks(Math.min(6,n)))
        .call(g=>g.select('.domain').remove());
      // label
      if (label){
        svg.append('text').attr('x',0).attr('y',bandH+30).style('font-size','12px').text(label);
      }
    }

    // Helpers for TopoJSON usage
    function toFeatureCollection(topo, objName){
      return (topo && topo.objects && topo.objects[objName]) ? topojson.feature(topo, topo.objects[objName]) : null;
    }
    function toMesh(topo, objName, filter){
      return (topo && topo.objects && topo.objects[objName]) ? topojson.mesh(topo, topo.objects[objName], filter || ((a,b)=>a!==b)) : null;
    }

    // Projection inference & path builder
    function buildPath(features){
      let proj;
      if (opts.projection && d3[opts.projection]){
        proj = d3[opts.projection]();
        if (proj.fitSize) proj.fitSize([innerW, innerH], features);
      } else {
        // Heuristic: use identity if already projected in small numeric extent; else NaturalEarth1
        const b = d3.geoPath().bounds(features);
        const spanX = b[1][0]-b[0][0], spanY = b[1][1]-b[0][1];
        if (spanX <= 1200 && spanY <= 1200){
          proj = d3.geoIdentity().fitSize([innerW, innerH], features);
        } else {
          proj = d3.geoNaturalEarth1().fitSize([innerW, innerH], features);
        }
      }
      return d3.geoPath(proj);
    }

    // Core draw routine
    function drawChoro(features, mesh){
      const path = buildPath(features);

      // fills
      g.selectAll('path.choro-area')
        .data(features.features)
        .join('path')
        .attr('class','choro-area')
        .attr('d', path)
        .attr('fill', f => {
          const v = dataMap.get(String(featureId(f)));
          return v==null ? '#3d5586ff' : colorScale(v);
        })
        .on('pointerenter', (e,f) => {
          const v = dataMap.get(String(featureId(f)));
          const nm = (f.properties && (f.properties.name || f.properties.NAME || f.properties.admin)) || 'Region';
          const txt = nm + (v!=null ? ' • ' + v : '');
          showTip(e, txt);
        })
        .on('pointermove', e => showTip(e, document.querySelector('.tooltip').innerHTML))
        .on('pointerleave', hideTip);

      // borders (optional)
      if (mesh){
        g.append('path')
          .datum(mesh)
          .attr('fill','none')
          .attr('stroke', (opts.borders && opts.borders.stroke) || '#fff')
          .attr('stroke-width', (opts.borders && opts.borders.strokeWidth) || 0.5)
          .attr('stroke-linejoin','round')
          .attr('d', path);
      }

      // legend (optional)
      if (opts.legend){
        drawQuantLegendChoro(rootEl, colorScale, opts.legend.label || '', opts.legend.width || 260);
      }
    }

    // Load & render
    if (opts.geojson && opts.geojson.type === 'FeatureCollection'){
      // Optional borders when only GeoJSON is provided: draw an outline of all rings
      let mesh = null;
      if (opts.borders && opts.borders.fromGeojson){
        mesh = { type:'MultiLineString',
          coordinates: opts.geojson.features.flatMap(f => {
            const geom = f.geometry || {};
            if (geom.type === 'Polygon')      return geom.coordinates;
            if (geom.type === 'MultiPolygon') return geom.coordinates.flat(1);
            return [];
          })
        };
      }
      drawChoro(opts.geojson, mesh);
    } else if (opts.topojsonUrl && opts.topoObject){
      fetch(opts.topojsonUrl).then(r => r.json()).then(topo => {
        const features = toFeatureCollection(topo, opts.topoObject);
        const mesh = opts.borders ? toMesh(topo, opts.borders.topoObject || opts.topoObject, opts.borders.filter) : null;
        if (!features){
          g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Invalid TopoJSON object');
          return;
        }
        drawChoro(features, mesh);
      }).catch(() => {
        g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Failed to load topology');
      });
    } else {
      g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Provide {topojsonUrl, topoObject} or {geojson}');
    }
  }

  function inferGeoMode(rows){
    var hasLatLon = rows.some(function(d){ return Number.isFinite(+d.lat||+d.latitude) && Number.isFinite(+d.lon||+d.longitude); });
    return hasLatLon ? 'points' : 'choropleth';
  }
}

// boot
render('#chart', INPUT);
})();
</script>
</body>
</html>`;
};


// let result  = buildChartHTML({
//   chartType: "force",
//   data: {
//     nodes: [{id:"A", group:1},{id:"B", group:1},{id:"C", group:2}],
//     links: [{source:"A", target:"B", value:2},{source:"A", target:"C", value:1}]
//   },
//   options: { title: "Network" }
// });


let result = buildChartHTML({
  chartType: "dendrogram",
  data: { name: "Root", children: [{ name: "A" }, { name: "B", children: [{ name: "B1" }, { name: "B2" }] }] },
  options: { title: "Hierarchy" }
});

// let donutChart = buildChartHTML({
//   chartType: "donut",
//   data: [{ name:"Alpha", value:30 }, { name:"Beta", value:50 }, { name:"Gamma", value:20 }],
//   options: { title: "Donut Chart" }
// });
// console.log(donutChart);

// let areaChart = buildChartHTML({
//   chartType: "area",
//   data: [
//     { date: "2024-01-01", value: 5 },
//     { date: "2024-02-01", value: 15 },
//     { date: "2024-03-01", value: 25 }
//   ],
//   options: { title: "Area Chart" }
// });
// console.log(areaChart);

// let bubbleChart = buildChartHTML({
//   chartType: "bubble",
//   data: [
//     { x: 5, y: 10, r: 15, name: "Alpha" },
//     { x: 15, y: 25, r: 25, name: "Beta" },
//     { x: 30, y: 12, r: 10, name: "Gamma" }
//   ],
//   options: { title: "Bubble Chart", xLabel: "X Axis", yLabel: "Y Axis" }
// });
// console.log(bubbleChart);

// let radialChart = buildChartHTML({
//   chartType: "radial",
//   data: [
//     { name: "North", value: 15 },
//     { name: "South", value: 25 },
//     { name: "East", value: 10 },
//     { name: "West", value: 20 }
//   ],
//   options: { title: "Radial Chart" }
// });
// console.log(radialChart);

// let stackedLine = buildChartHTML({
//   chartType: "stackedArea",
//   data: [
//     { year: 2018, apples: 30, bananas: 20, cherries: 10 },
//     { year: 2019, apples: 40, bananas: 25, cherries: 15 },
//     { year: 2020, apples: 35, bananas: 30, cherries: 20 },
//     { year: 2021, apples: 50, bananas: 40, cherries: 25 },
//     { year: 2022, apples: 45, bananas: 35, cherries: 30 }
//   ],
//   options: {
//     title: "Fruit Production (Stacked Area)",
//     keys: ["apples", "bananas", "cherries"]
//   }
// });
// console.log(stackedLine);

// let geoChoropleth = buildChartHTML({
//   chartType: "geo",
//   data: [
//     { date: "2024-01-01", value: 10 },
//     { date: "2024-02-01", value: 25 },
//     { date: "2024-03-01", value: 15 }
//   ],
//   options: { title: "Line Chart", xLabel: "Date", yLabel: "Value" }
// });
// console.log(geoChoropleth);


// bump = buildChartHTML({
//   chartType: "stacked-bar",
//   data: [
//     { date:"2025-01-01", name:"Alpha", value:10 },
//     { date:"2025-01-01", name:"Beta",  value:6  },
//     { date:"2025-02-01", name:"Alpha", value:12 },
//     { date:"2025-02-01", name:"Beta",  value:8  }
//   ],
//   options: { title: "Stacked Area over Time" ,xLabel: "Date", yLabel: "name"}
// });


let sunburstChart = buildChartHTML({
  chartType: "sunburst",
  data: {
    name: "Home",
    children: [
      {
        name: "Search",
        value: 120,
        children: [
          { name: "Product", value: 80 },
          { name: "Category", value: 40 },
        ],
      },
      {
        name: "Product",
        value: 200,
        children: [
          { name: "Details", value: 150 },
          { name: "Cart", value: 50 },
        ],
      },
    ],
  },
  options: { title: "Sunburst Chart Example" },
});
// console.log(sunburstChart);

let boxPlotChart = buildChartHTML({
  chartType: "boxPlot", // Specify the chart type as box plot
  data: [
    { value: [10, 20, 30, 40, 50, 60, 70, 80, 90] }, // Example data 1
    { value: [15, 25, 35, 45, 55, 65, 75, 85, 95] }, // Example data 2
    { value: [5, 15, 25, 35, 45, 55, 65, 75, 85] }, // Example data 3
  ],
  options: {
    title: "Box Plot Example", // Title of the chart
    xLabel: "Categories", // X-axis label
    yLabel: "Values", // Y-axis label
  },
});
// console.log(boxPlotChart);

let wordCloudChart = buildChartHTML({
  chartType: "wordCloud",
  data: [
    { text: "D3", count: 50 },
    { text: "JavaScript", count: 35 },
    { text: "SVG", count: 30 },
    { text: "Visualization", count: 20 },
    { text: "Chart", count: 20 },
  ],
  options: {
    title: "Word Cloud Example",
  },
});
// console.log(wordCloudChart);

let hexbinChart = buildChartHTML({
  chartType: "hexbin",
  data: [
    { x: 30, y: 30 },
    { x: 50, y: 50 },
    { x: 70, y: 70 },
    { x: 90, y: 90 },
    { x: 110, y: 110 },
    { x: 130, y: 130 },
    { x: 150, y: 150 },
    { x: 170, y: 170 },
  ],
  options: {
    title: "Customized Hexbin Chart",
    width: 600,
    height: 500,
    hexbin: {
      radius: 25,
      extent: [
        [0, 0],
        [600, 500],
      ],
      padding: 10,
    },
    colorScale: {
      scheme: "Greens",
      domain: [0, 10],
    },
    axes: {
      show: true,
      xLabel: "X Coordinate",
      yLabel: "Y Coordinate",
      axisTicks: { x: { tickCount: 6 }, y: { tickCount: 6 } },
    },
    tooltip: {
      show: true,
      format: (d) => `Points: ${d.length}`,
    },
  },
});
console.log(hexbinChart);

