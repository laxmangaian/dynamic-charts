// // <!doctype html>
// // <html lang="en">
// // <head>
// //   <meta charset="utf-8" />
// //   <meta name="viewport" content="width=device-width,initial-scale=1" />
// //   <title>Universal D3 Chart (HTML Builder)</title>
// //   <style>
// //     :root { color-scheme: light dark; }
// //     body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; }
// //     .card { max-width: 1180px; margin: 0 auto; }
// //     .muted { color: #6b7280; }
// //     .chart-wrap { width: 100%; }
// //     svg { display:block; width:100%; height:auto; }
// //     .legend { display:flex; flex-wrap:wrap; gap:8px; align-items:center; font-size:12px; margin-top:8px; }
// //     .legend .item { display:flex; align-items:center; gap:6px; margin-right:10px; }
// //     .legend .swatch { width:12px; height:12px; border-radius:2px; display:inline-block; }
// //     .tooltip { position:fixed; pointer-events:none; background:var(--tbg,rgba(0,0,0,.8)); color:white; padding:6px 8px; border-radius:6px; font-size:12px; z-index:9999; transform:translate(-50%, calc(-100% - 8px)); white-space:nowrap; }
// //     @media (prefers-color-scheme: light) { .tooltip { --tbg: rgba(17,24,39,.92); } }
// //   </style>
// //   <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
// // </head>
// // <body>
// //   <div class="card">
// //     <h2 style="margin:0 0 12px;">Universal D3 Chart (HTML Builder)</h2>
// //     <p class="muted" style="margin-top:0;">Pass <code>{ chartType, data, options }</code> to <code>buildChartHTML</code>; get a self-contained HTML string.</p>
// //     <div class="chart-wrap"><div id="demo" aria-label="chart container"></div></div>
// //   </div>

// //   <script>
// //   // ==========================
// //   // Public API: buildChartHTML
// //   // ==========================
// //   // buildChartHTML({ chartType, data, options }) -> returns complete HTML document as a string.
// //   // - chartType: "auto"|"line"|"bar"|"area"|"scatter"|"barline"|"pie"|"donut"|"arc"|"radial"|"heatmap" (calendar) |"matrix-heatmap"|"dendrogram"|"force"
// //   // - data: depends on chartType. See examples at bottom.
// //   // - options: { width, height, margin, title, yLabel, xLabel, colorScheme, legend, tooltip }

// //   function buildChartHTML(input){
// //     const chartType = Array.isArray(input) ? 'auto' : (input.chartType || 'auto');
// //     const data = Array.isArray(input) ? input : (input.data || []);
// //     const title = (input && input.options && input.options.title) || 'Chart';

// //     const safe = (v) => JSON.stringify(v).replace(/</g, '\u003c').replace(/-->/g, '--\u003e');

// //     return `<!doctype html>
// // <html lang="en">
// // <head>
// //   <meta charset="utf-8" />
// //   <meta name="viewport" content="width=device-width,initial-scale=1" />
// //   <title>${title}</title>
// //   <style>
// //     :root { color-scheme: light dark; }
// //     body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; }
// //     .card { max-width: 1180px; margin: 0 auto; }
// //     .muted { color: #6b7280; }
// //     .chart-wrap { width: 100%; }
// //     svg { display:block; width:100%; height:auto; }
// //     .legend { display:flex; flex-wrap:wrap; gap:8px; align-items:center; font-size:12px; margin-top:8px; }
// //     .legend .item { display:flex; align-items:center; gap:6px; margin-right:10px; }
// //     .legend .swatch { width:12px; height:12px; border-radius:2px; display:inline-block; }
// //     .tooltip { position:fixed; pointer-events:none; background:var(--tbg,rgba(0,0,0,.8)); color:white; padding:6px 8px; border-radius:6px; font-size:12px; z-index:9999; transform:translate(-50%, calc(-100% - 8px)); white-space:nowrap; }
// //     @media (prefers-color-scheme: light) { .tooltip { --tbg: rgba(17,24,39,.92); } }
// //   </style>
// //   <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
// // </head>
// // <body>
// //   <div class="card">
// //     <h2 style="margin:0 0 12px;">${title}</h2>
// //     <p class="muted" style="margin-top:0;">Data driven chart (${chartType}).</p>
// //     <div class="chart-wrap"><div id="chart" aria-label="chart container"></div></div>
// //   </div>

// //   <script>
//     function buildChartHTML(INPUT){
//       const d3ref = window.d3; // alias
//       const INPUT = ${safe({ chartType, data, options: input.options || {} })};

//       const fmt = {
//         dateShort: d3.utcFormat('%b %Y'),
//         dateISO: d3.utcFormat('%Y-%m-%d')
//       };
//       const parseDate = d3.utcParse('%Y-%m-%d');

//       function valueOf(d){
//         if (typeof d.value === 'number') return d.value;
//         if (typeof d.sales === 'number') return d.sales;
//         if (typeof d.count === 'number') return d.count;
//         const n = +d.value || +d.sales || +d.count;
//         return Number.isFinite(n) ? n : NaN;
//       }
//       function nameOf(d){ return d.name ?? d.category ?? d.label ?? d.key ?? d.id ?? ''; }
//       function normalizeTimeRows(rows){
//         return rows.map(d=>({
//           date: typeof d.date==='string' ? parseDate(d.date) : d.date,
//           value: valueOf(d)
//         })).filter(d=>d.date instanceof Date && !isNaN(d.date) && Number.isFinite(d.value))
//           .sort((a,b)=>a.date-b.date);
//       }
//       function normalizeCatRows(rows){
//         return rows.map(d=>({ key: nameOf(d), value: valueOf(d) }))
//           .filter(d=>d.key!=null && d.key!=='' && Number.isFinite(d.value));
//       }

//       function ensureTooltip(){
//         let t = document.querySelector('.tooltip');
//         if (!t){ t = document.createElement('div'); t.className='tooltip'; t.style.opacity='0'; document.body.appendChild(t); }
//         return t;
//       }
//       function showTip(e, html){ const t=ensureTooltip(); t.innerHTML=html; t.style.left=e.clientX+'px'; t.style.top=e.clientY+'px'; t.style.opacity='1'; }
//       function hideTip(){ const t=document.querySelector('.tooltip'); if(t) t.style.opacity='0'; }

//       function addLegend(root, items, color){
//         const wrap = document.createElement('div'); wrap.className='legend';
//         items.forEach(k=>{
//           const span = document.createElement('span'); span.className='item';
//           span.innerHTML = `<span class="swatch" style="background:${color(k)}"></span>${k}`;
//           wrap.appendChild(span);
//         });
//         root.appendChild(wrap);
//         return wrap;
//       }

//       function render(container, input){
//         const root = typeof container==='string' ? document.querySelector(container) : container;
//         if (!root) throw new Error('container not found');
//         Array.from(root.querySelectorAll('svg, .legend')).forEach(n=>n.remove());

//         const isArray = Array.isArray(input);
//         const rows = isArray ? input : (input && input.data) ? input.data : [];
//         const type = (!isArray && input && input.chartType) ? input.chartType : (input.chartType || 'auto');
//         const opts = (input && input.options) || {};

//         const box = root.getBoundingClientRect();
//         const width = Math.max(360, opts.width || box.width || 800);
//         const height = opts.height || 420;
//         const margin = Object.assign({ top: 24, right: 24, bottom: 56, left: 64 }, opts.margin || {});
//         const innerW = width - margin.left - margin.right;
//         const innerH = height - margin.top - margin.bottom;
//         const colorScheme = opts.colorScheme || d3.schemeTableau10;

//         const svg = d3.select(root).append('svg')
//           .attr('viewBox', `0 0 ${width} ${height}`)
//           .attr('width','100%').attr('height', height)
//           .attr('role','img').attr('aria-label', type + ' chart');
//         const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

//         // Routers
//         if (["line","area","bar","scatter","barline"].includes(type)){
//           renderTimeLike(g, rows, type, innerW, innerH, { margin, opts });
//           return;
//         }
//         if (["pie","donut","arc","radial"].includes(type)){
//           renderRadialLike(g, rows, type, innerW, innerH, { root: root, colorScheme });
//           return;
//         }
//         if (type === 'heatmap'){
//           renderCalendarHeatmap(g, rows, innerW, innerH);
//           return;
//         }
//         if (type === 'matrix-heatmap'){
//           renderMatrixHeatmap(g, rows, innerW, innerH, { margin, colorScheme });
//           return;
//         }
//         if (type === 'dendrogram'){
//           renderDendrogram(g, input, innerW, innerH);
//           return;
//         }
//         if (type === 'force'){
//           renderForce(g, input, innerW, innerH, { svg });
//           return;
//         }

//         g.append('text').attr('x', innerW/2).attr('y', innerH/2).attr('text-anchor','middle')
//           .style('font','14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif')
//           .text('Unsupported chartType: ' + type);

//         // ======== Renderers ========
//         function renderTimeLike(g, rows, type, innerW, innerH, ctx){
//           const norm = normalizeTimeRows(rows);
//           const { margin, opts } = ctx;
//           if (!norm.length){ g.append('text').attr('x', innerW/2).attr('y', innerH/2).attr('text-anchor','middle').text('No valid data'); return; }
//           const x = d3.scaleUtc().domain(d3.extent(norm, d=>d.date)).range([0, innerW]).nice();
//           const y = d3.scaleLinear().domain([0, d3.max(norm,d=>d.value)||0]).nice().range([innerH,0]);
//           g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(Math.min(6,norm.length)).tickFormat(fmt.dateShort));
//           g.append('g').call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));
//           g.append('g').attr('stroke-opacity',0.1).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(()=>''));

//           const line = d3.line().x(d=>x(d.date)).y(d=>y(d.value)).defined(d=>Number.isFinite(d.value));
//           if (type==='area'){
//             const area = d3.area().x(d=>x(d.date)).y0(y(0)).y1(d=>y(d.value)).defined(d=>Number.isFinite(d.value));
//             g.append('path').datum(norm).attr('d', area).attr('fill','currentColor').attr('opacity',0.15);
//           }
//           if (type==='line' || type==='area' || type==='barline'){
//             g.append('path').datum(norm).attr('fill','none').attr('stroke','currentColor').attr('stroke-width',2).attr('d', line);
//           }
//           if (type==='bar' || type==='barline'){
//             const xBand = d3.scaleBand().domain(norm.map(d=>+d.date)).range([0, innerW]).padding(0.2);
//             g.selectAll('rect.bar').data(norm).join('rect').attr('class','bar')
//               .attr('x',d=>xBand(+d.date)).attr('y',d=>y(Math.max(0,d.value)))
//               .attr('width',xBand.bandwidth()).attr('height',d=>Math.abs(y(d.value)-y(0)))
//               .attr('fill','currentColor').attr('opacity', type==='barline'?0.35:1)
//               .on('pointerenter',(e,d)=>showTip(e, `${fmt.dateISO(d.date)} • ${d.value}`))
//               .on('pointermove',(e)=>showTip(e, document.querySelector('.tooltip').innerHTML))
//               .on('pointerleave',hideTip);
//           }
//           if (type!=='bar'){
//             g.selectAll('circle.pt').data(norm).join('circle').attr('class','pt').attr('cx',d=>x(d.date)).attr('cy',d=>y(d.value)).attr('r',3).attr('fill','currentColor')
//               .on('pointerenter',(e,d)=>showTip(e, `${fmt.dateISO(d.date)} • ${d.value}`))
//               .on('pointermove',(e)=>showTip(e, document.querySelector('.tooltip').innerHTML))
//               .on('pointerleave',hideTip);
//           }
//           g.append('text').attr('x', -innerH/2).attr('y', -margin.left+14).attr('transform','rotate(-90)').attr('text-anchor','middle').style('font-size','12px').text(opts.yLabel||'Value');
//           g.append('text').attr('x', innerW/2).attr('y', innerH+40).attr('text-anchor','middle').style('font-size','12px').text(opts.xLabel||'Date');
//           addLegend(root, [opts.seriesLabel || 'Series'], ()=> 'currentColor');
//         }

//         function renderRadialLike(g, rows, type, innerW, innerH, ctx){
//           const { root, colorScheme } = ctx;
//           const cx=innerW/2, cy=innerH/2; const R=Math.min(innerW, innerH)/2;
//           const norm = normalizeCatRows(rows);
//           const color = d3.scaleOrdinal().domain(norm.map(d=>d.key)).range(colorScheme);
//           if (type==='arc'){
//             const v = norm.length? norm[0].value : 0; const max = (rows[0] && typeof rows[0].max==='number')? rows[0].max : 100; const k = Math.max(0,Math.min(1, v/max));
//             const ir=R*0.7; const start=-Math.PI; const end=0; const arc=d3.arc().innerRadius(ir).outerRadius(R).startAngle(start);
//             g.attr('transform',`translate(${cx},${cy})`);
//             g.append('path').attr('d', arc.endAngle(end)).attr('fill','currentColor').attr('opacity',0.15);
//             g.append('path').attr('d', arc.endAngle(start+(end-start)*k)).attr('fill','currentColor');
//             const txt = Math.round(k*100)+'%';
//             g.append('text').attr('text-anchor','middle').attr('dy','0.35em').style('font-weight','600').text(txt);
//             addLegend(root, [rows[0]?.name || 'Value'], ()=> 'currentColor');
//             return;
//           }
//           if (!norm.length){ g.append('text').attr('x',cx).attr('y',cy).attr('text-anchor','middle').text('No valid data'); return; }
//           const pie = d3.pie().value(d=>d.value).sort(null); const arcs=pie(norm);
//           const isDonut = (type==='donut'); const innerR = isDonut ? R*0.6 : 0;
//           g.attr('transform',`translate(${cx},${cy})`);
//           g.selectAll('path.slice').data(arcs).join('path').attr('class','slice')
//             .attr('d', d3.arc().innerRadius(innerR).outerRadius(R))
//             .attr('fill', d=>color(d.data.key))
//             .on('pointerenter',(e,d)=>showTip(e, `${d.data.key}: ${d.data.value}`))
//             .on('pointermove',(e)=>showTip(e, document.querySelector('.tooltip').innerHTML))
//             .on('pointerleave',hideTip);
//           addLegend(root, norm.map(d=>d.key), color);
//           if (type==='radial'){
//             // radial bars
//             g.selectAll('path.rad').data(norm).join('path').attr('class','rad')
//               .attr('d', d=>{ const a=d3.scaleBand().domain(norm.map(x=>x.key)).range([0,2*Math.PI]).padding(0.1); const r=d3.scaleLinear().domain([0,d3.max(norm,x=>x.value)||1]).range([R*0.25,R]);
//                 return d3.arc().innerRadius(R*0.25).outerRadius(r(d.value)).startAngle(a(d.key)).endAngle(a(d.key)+a.bandwidth())(); })
//               .attr('fill', d=>color(d.key))
//               .on('pointerenter',(e,d)=>showTip(e, `${d.key}: ${d.value}`))
//               .on('pointermove',(e)=>showTip(e, document.querySelector('.tooltip').innerHTML))
//               .on('pointerleave',hideTip);
//           }
//         }

//         function renderCalendarHeatmap(g, rows, innerW, innerH){
//           const norm=normalizeTimeRows(rows); if(!norm.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('No valid data'); return; }
//           const byYear = d3.groups(norm, d=>d.date.getUTCFullYear()); const years=byYear.map(d=>d[0]).sort(d3.ascending);
//           const cell=14, gap=2; const yearHeight = cell*7 + 24;
//           const color = d3.scaleSequential(d3.interpolateTurbo).domain([0, d3.max(norm,d=>d.value)||1]);
//           years.forEach((yr, yi)=>{
//             const Y = yi*(yearHeight+20); const data = byYear.find(d=>d[0]===yr)[1]; const map=new Map(data.map(d=>[fmt.dateISO(d.date), d.value]));
//             g.append('text').attr('x',0).attr('y',Y+12).style('font-size','12px').text(yr);
//             const first=new Date(Date.UTC(yr,0,1)); const last=new Date(Date.UTC(yr,11,31)); const days=d3.utcDays(first, d3.utcDay.offset(last,1));
//             const group=g.append('g').attr('transform',`translate(40,${Y})`);
//             group.selectAll('rect.day').data(days).join('rect').attr('class','day').attr('width',cell).attr('height',cell)
//               .attr('x',d=>d3.utcWeek.count(new Date(Date.UTC(yr,0,1)), d)*(cell+gap)).
//               attr('y',d=>d.getUTCDay()*(cell+gap)+16).attr('rx',2).attr('ry',2)
//               .attr('fill', d=>{ const v=map.get(fmt.dateISO(d))||0; return v===0?'#e5e7eb':color(v); })
//               .on('pointerenter',(e,d)=>{ const v=map.get(fmt.dateISO(d))||0; showTip(e, `${fmt.dateISO(d)} • ${v}`); })
//               .on('pointermove',(e)=>showTip(e, document.querySelector('.tooltip').innerHTML))
//               .on('pointerleave',hideTip);
//           });
//         }

//         function renderMatrixHeatmap(g, rows, innerW, innerH, ctx){
//           // Expect rows: [{ x:'A', y:'B', value: 3 }, ...]
//           const xs = Array.from(new Set(rows.map(r=>r.x)));
//           const ys = Array.from(new Set(rows.map(r=>r.y)));
//           if (!xs.length || !ys.length){ g.append('text').attr('x', innerW/2).attr('y', innerH/2).attr('text-anchor','middle').text('Provide {x,y,value} rows'); return; }
//           const xScale = d3.scaleBand().domain(xs).range([0, innerW]).padding(0.05);
//           const yScale = d3.scaleBand().domain(ys).range([0, innerH]).padding(0.05);
//           const maxV = d3.max(rows, d=>+d.value)||1;
//           const color = d3.scaleSequential(d3.interpolateTurbo).domain([0, maxV]);
//           g.append('g').attr('transform',`translate(0,${innerH})`).call(d3.axisBottom(xScale));
//           g.append('g').call(d3.axisLeft(yScale));
//           g.selectAll('rect.cell').data(rows).join('rect').attr('class','cell')
//             .attr('x', d=>xScale(d.x)).attr('y', d=>yScale(d.y))
//             .attr('width', xScale.bandwidth()).attr('height', yScale.bandwidth())
//             .attr('rx',2).attr('ry',2)
//             .attr('fill', d=>color(+d.value))
//             .on('pointerenter', (e,d)=>showTip(e, `${d.x} × ${d.y} • ${d.value}`))
//             .on('pointermove',(e)=>showTip(e, document.querySelector('.tooltip').innerHTML))
//             .on('pointerleave', hideTip);
//         }

//         function renderDendrogram(g, input, innerW, innerH){
//           const tree = (input && input.data && (input.data.children || input.data.name)) ? input.data : null;
//           if (!tree){ g.append('text').attr('x', innerW/2).attr('y', innerH/2).attr('text-anchor','middle').text('Provide hierarchical data'); return; }
//           const root = d3.hierarchy(tree); const cluster = d3.cluster().size([innerH, innerW-160]); cluster(root);
//           g.append('g').selectAll('path').data(root.links()).join('path').attr('fill','none').attr('stroke','currentColor').attr('stroke-opacity',0.4)
//             .attr('d', d3.linkHorizontal().x(d=>d.y).y(d=>d.x));
//           const node = g.append('g').selectAll('g').data(root.descendants()).join('g').attr('transform', d=>`translate(${d.y},${d.x})`);
//           node.append('circle').attr('r',3).attr('fill','currentColor');
//           node.append('text').attr('dy','0.32em').attr('x', d=>d.children?-8:8).attr('text-anchor', d=>d.children?'end':'start').style('font-size','12px').text(d=>d.data.name ?? d.data.id ?? '');
//         }

//         function renderForce(g, input, innerW, innerH, ctx){
//           // Expect input.data: { nodes:[{id, group?}], links:[{source, target, value?}] }
//           const data = input && input.data && input.data.nodes ? input.data : null;
//           if (!data){ g.append('text').attr('x', innerW/2).attr('y', innerH/2).attr('text-anchor','middle').text('Provide {nodes,links}'); return; }
//           const color = d3.scaleOrdinal(d3.schemeTableau10);
//           const link = g.append('g').attr('stroke','currentColor').attr('stroke-opacity',0.3).selectAll('line').data(data.links).join('line').attr('stroke-width', d=>Math.sqrt(d.value||1));
//           const node = g.append('g').attr('stroke','#fff').attr('stroke-width',1.5).selectAll('circle').data(data.nodes).join('circle').attr('r',5).attr('fill', d=>color(d.group||0))
//             .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended))
//             .on('pointerenter',(e,d)=>showTip(e, d.id))
//             .on('pointermove',(e)=>showTip(e, document.querySelector('.tooltip').innerHTML))
//             .on('pointerleave',hideTip);

//           const sim = d3.forceSimulation(data.nodes)
//             .force('link', d3.forceLink(data.links).id(d=>d.id).distance(d=>40 + (d.value||0)))
//             .force('charge', d3.forceManyBody().strength(-200))
//             .force('center', d3.forceCenter(innerW/2, innerH/2))
//             .on('tick', ticked);

//           function ticked(){
//             link.attr('x1', d=>d.source.x).attr('y1', d=>d.source.y).attr('x2', d=>d.target.x).attr('y2', d=>d.target.y);
//             node.attr('cx', d=>d.x).attr('cy', d=>d.y);
//           }
//           function dragstarted(event, d){ if (!event.active) ctx.svg.transition(); d.fx = d.x; d.fy = d.y; }
//           function dragged(event, d){ d.fx = event.x; d.fy = event.y; }
//           function dragended(event, d){ if (!event.active) ctx.svg.transition(); d.fx = null; d.fy = null; }
//           addLegend(root, Array.from(new Set(data.nodes.map(n=>n.group))).map(g=>`Group ${g}`), (k)=>color(+k.replace('Group ','')));
//         }
//       }

//       // Boot demo so the live canvas shows something
//       const demo = { chartType: 'barline', data: [
//         { date:'2023-01-01', value:20 },{ date:'2023-02-01', value:120 },{ date:'2023-03-01', value:150 },{ date:'2023-04-01', value:90 }
//       ], options: { title: 'Demo Bar+Line' } };
//       render('#demo', demo);

//       // Expose globals for you to use this builder
//       window.buildChartHTML = buildChartHTML; // returns a full HTML string

//     };
// //   </script>
// // </body>
// // </html>




// const html = buildChartHTML({
//   chartType: "matrix-heatmap",
//   data: [
//     { x: "A", y: "X", value: 3 },
//     { x: "A", y: "Y", value: 8 },
//     { x: "B", y: "X", value: 5 },
//     { x: "B", y: "Y", value: 2 },
//   ],
//   options: { title: "Matrix Heatmap" }
// });
// // -> write `html` to a .html file or serve it


// // Force-directed graph
// buildChartHTML({
//   chartType: "force",
//   data: {
//     nodes: [{id:"A", group:1},{id:"B", group:1},{id:"C", group:2}],
//     links: [{source:"A", target:"B", value:2},{source:"A", target:"C", value:1}]
//   },
//   options: { title: "Network" }
// });

// // Dendrogram
// buildChartHTML({
//   chartType: "dendrogram",
//   data: { name: "Root", children: [{ name: "A" }, { name: "B", children:[{ name: "B1" }, { name: "B2" }] }] },
//   options: { title: "Hierarchy" }
// });

// // Donut
// buildChartHTML({
//   chartType: "donut",
//   data: [{ name:"Alpha", value:30 }, { name:"Beta", value:50 }, { name:"Gamma", value:20 }],
//   options: { title: "Share" }
// });





/**
 * buildChartHTML({ chartType, data, options }) -> returns a COMPLETE, self-contained HTML document string.
 * Supported chartType values:
 *  - line | area | bar | scatter | barline
 *  - pie | donut | arc (semi-gauge) | radial (radial bars)
 *  - heatmap (calendar, date->value) | matrix-heatmap ({x,y,value})
 *  - dendrogram ({ name, children }) | force ({ nodes:[{id,group?}], links:[{source,target,value?}] })
 *
 * Example:
 *   const html = buildChartHTML({
 *     chartType: "matrix-heatmap",
 *     data: [{x:"A",y:"X",value:3},{x:"A",y:"Y",value:8}],
 *     options: { title: "Matrix" }
 *   });
 */

// function buildChartHTML(input) {
//   const chartType = Array.isArray(input) ? "auto" : (input.chartType || "auto");
//   const data = Array.isArray(input) ? input : (input.data || []);
//   const options = (input && input.options) || {};
//   const safe = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/-->/g, "--\\u003e");

//   return `<!doctype html>
// <html lang="en">
// <head>
// <meta charset="utf-8" />
// <meta name="viewport" content="width=device-width,initial-scale=1" />
// <title>${(options.title || "Chart").replace(/"/g, "&quot;")}</title>
// <style>
//   :root { color-scheme: light dark; }
//   body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; }
//   .card { max-width: 1180px; margin: 0 auto; }
//   .muted { color: #6b7280; }
//   .chart-wrap { width: 100%; }
//   svg { display: block; width: 100%; height: auto; }
//   .legend { display:flex; flex-wrap:wrap; gap:8px; align-items:center; font-size:12px; margin-top:8px; }
//   .legend .item { display:flex; align-items:center; gap:6px; margin-right:10px; }
//   .legend .swatch { width:12px; height:12px; border-radius:2px; display:inline-block; }
//   .tooltip { position:fixed; pointer-events:none; background:var(--tbg,rgba(0,0,0,.85)); color:white; padding:6px 8px; border-radius:6px; font-size:12px; z-index:9999; transform:translate(-50%, calc(-100% - 8px)); white-space:nowrap; opacity:0; transition:opacity .1s linear; }
//   @media (prefers-color-scheme: light) { .tooltip { --tbg: rgba(17,24,39,.92); } }
// </style>
// <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
// </head>
// <body>
//   <div class="card">
//     <h2 style="margin:0 0 12px;">${(options.title || "Chart").replace(/</g, "&lt;")}</h2>
//     <p class="muted" style="margin-top:0;">Data driven chart (${chartType}).</p>
//     <div class="chart-wrap"><div id="chart" aria-label="chart container"></div></div>
//   </div>

// <script>
// (function() {
//   const INPUT = ${safe({ chartType, data, options })};

//   const fmt = { dateShort: d3.utcFormat("%b %Y"), dateISO: d3.utcFormat("%Y-%m-%d") };
//   const parseDate = d3.utcParse("%Y-%m-%d");

//   function valueOf(d){
//     if (typeof d.value === "number") return d.value;
//     if (typeof d.sales === "number") return d.sales;
//     if (typeof d.count === "number") return d.count;
//     const n = +d.value || +d.sales || +d.count;
//     return Number.isFinite(n) ? n : NaN;
//   }
//   function nameOf(d){ return d.name ?? d.category ?? d.label ?? d.key ?? d.id ?? ""; }
//   function normalizeTimeRows(rows){
//     return rows.map(d=>({
//       date: typeof d.date==="string" ? parseDate(d.date) : d.date,
//       value: valueOf(d)
//     })).filter(d=>d.date instanceof Date && !isNaN(d.date) && Number.isFinite(d.value))
//       .sort((a,b)=>a.date-b.date);
//   }
//   function normalizeCatRows(rows){
//     return rows.map(d=>({ key: nameOf(d), value: valueOf(d) }))
//                .filter(d=>d.key!=null && d.key!=="" && Number.isFinite(d.value));
//   }

//   function ensureTooltip(){
//     let t = document.querySelector(".tooltip");
//     if (!t){ t = document.createElement("div"); t.className="tooltip"; document.body.appendChild(t); }
//     return t;
//   }
//   function showTip(e, html){ const t=ensureTooltip(); t.innerHTML=html; t.style.left=e.clientX+"px"; t.style.top=e.clientY+"px"; t.style.opacity="1"; }
//   function hideTip(){ const t=document.querySelector(".tooltip"); if(t) t.style.opacity="0"; }

//   function addLegend(root, items, color){
//     const wrap = document.createElement("div"); wrap.className="legend";
//     items.forEach(k=>{
//       const span = document.createElement("span"); span.className="item";
//       span.innerHTML = '<span class="swatch" style="background:'+color(k)+'"></span>'+k;
//       wrap.appendChild(span);
//     });
//     root.appendChild(wrap);
//     return wrap;
//   }

//   function render(container, input){
//     const root = typeof container==="string" ? document.querySelector(container) : container;
//     if (!root) throw new Error("container not found");
//     Array.from(root.querySelectorAll("svg, .legend")).forEach(n=>n.remove());

//     const isArray = Array.isArray(input);
//     const rows = isArray ? input : (input && input.data) ? input.data : [];
//     const type = (!isArray && input && input.chartType) ? input.chartType : (input.chartType || "auto");
//     const opts = (input && input.options) || {};

//     const box = root.getBoundingClientRect();
//     const width = Math.max(360, opts.width || box.width || 900);
//     const height = opts.height || 440;
//     const margin = Object.assign({ top: 24, right: 24, bottom: 56, left: 64 }, opts.margin || {});
//     const innerW = width - margin.left - margin.right;
//     const innerH = height - margin.top - margin.bottom;
//     const colorScheme = opts.colorScheme || d3.schemeTableau10;

//     const svg = d3.select(root).append("svg")
//       .attr("viewBox", "0 0 "+width+" "+height)
//       .attr("width", "100%").attr("height", height)
//       .attr("role","img").attr("aria-label", type + " chart");
//     const g = svg.append("g").attr("transform", "translate("+margin.left+","+margin.top+")");

//     if (["line","area","bar","scatter","barline"].includes(type)){ renderTimeLike(g, rows, type, innerW, innerH, { margin, opts, root }); return; }
//     if (["pie","donut","arc","radial"].includes(type)){ renderRadialLike(g, rows, type, innerW, innerH, { root, colorScheme }); return; }
//     if (type==="heatmap"){ renderCalendarHeatmap(g, rows, innerW, innerH); return; }
//     if (type==="matrix-heatmap"){ renderMatrixHeatmap(g, rows, innerW, innerH, { margin, colorScheme, root }); return; }
//     if (type==="dendrogram"){ renderDendrogram(g, input, innerW, innerH); return; }
//     if (type==="force"){ renderForce(g, input, innerW, innerH, { svg, root }); return; }

//     g.append("text").attr("x", innerW/2).attr("y", innerH/2).attr("text-anchor","middle")
//      .style("font","14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif")
//      .text("Unsupported chartType: " + type);

//     // -------- Renderers --------
//     function renderTimeLike(g, rows, type, innerW, innerH, ctx){
//       const norm = normalizeTimeRows(rows);
//       const { margin, opts, root } = ctx;
//       if (!norm.length){ g.append("text").attr("x",innerW/2).attr("y",innerH/2).attr("text-anchor","middle").text("No valid data"); return; }
//       const x = d3.scaleUtc().domain(d3.extent(norm, d=>d.date)).range([0, innerW]).nice();
//       const y = d3.scaleLinear().domain([0, d3.max(norm,d=>d.value)||0]).nice().range([innerH,0]);
//       g.append("g").attr("transform", "translate(0,"+innerH+")").call(d3.axisBottom(x).ticks(Math.min(6,norm.length)).tickFormat(fmt.dateShort));
//       g.append("g").call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));
//       g.append("g").attr("stroke-opacity",0.1).call(d3.axisLeft(y).tickSize(-innerW).tickFormat(()=>"" ));

//       const line = d3.line().x(d=>x(d.date)).y(d=>y(d.value)).defined(d=>Number.isFinite(d.value));
//       if (type==="area"){
//         const area = d3.area().x(d=>x(d.date)).y0(y(0)).y1(d=>y(d.value)).defined(d=>Number.isFinite(d.value));
//         g.append("path").datum(norm).attr("d", area).attr("fill","currentColor").attr("opacity",0.15);
//       }
//       if (type==="line"||type==="area"||type==="barline"){
//         g.append("path").datum(norm).attr("fill","none").attr("stroke","currentColor").attr("stroke-width",2).attr("d", line);
//       }
//       if (type==="bar"||type==="barline"){
//         const xBand = d3.scaleBand().domain(norm.map(d=>+d.date)).range([0, innerW]).padding(0.2);
//         g.selectAll("rect.bar").data(norm).join("rect").attr("class","bar")
//           .attr("x",d=>xBand(+d.date)).attr("y",d=>y(Math.max(0,d.value)))
//           .attr("width",xBand.bandwidth()).attr("height",d=>Math.abs(y(d.value)-y(0)))
//           .attr("fill","currentColor").attr("opacity", type==="barline"?0.35:1)
//           .on("pointerenter",(e,d)=>showTip(e, fmt.dateISO(d.date)+" • "+d.value))
//           .on("pointermove",(e)=>showTip(e, document.querySelector(".tooltip").innerHTML))
//           .on("pointerleave",hideTip);
//       }
//       if (type!=="bar"){
//         g.selectAll("circle.pt").data(norm).join("circle").attr("class","pt")
//           .attr("cx",d=>x(d.date)).attr("cy",d=>y(d.value)).attr("r",3).attr("fill","currentColor")
//           .on("pointerenter",(e,d)=>showTip(e, fmt.dateISO(d.date)+" • "+d.value))
//           .on("pointermove",(e)=>showTip(e, document.querySelector(".tooltip").innerHTML))
//           .on("pointerleave",hideTip);
//       }
//       g.append("text").attr("x",-innerH/2).attr("y",-margin.left+14).attr("transform","rotate(-90)").attr("text-anchor","middle").style("font-size","12px").text(opts.yLabel||"Value");
//       g.append("text").attr("x",innerW/2).attr("y",innerH+40).attr("text-anchor","middle").style("font-size","12px").text(opts.xLabel||"Date");
//       addLegend(root, [opts.seriesLabel || "Series"], ()=>"currentColor");
//     }

//     function renderRadialLike(g, rows, type, innerW, innerH, ctx){
//       const { root, colorScheme } = ctx;
//       const cx=innerW/2, cy=innerH/2; const R=Math.min(innerW, innerH)/2;
//       const norm = normalizeCatRows(rows);
//       const color = d3.scaleOrdinal().domain(norm.map(d=>d.key)).range(colorScheme);
//       if (type==="arc"){
//         const v = norm.length? norm[0].value : 0;
//         const max = (rows[0] && typeof rows[0].max==="number")? rows[0].max : 100;
//         const k = Math.max(0, Math.min(1, v/max));
//         const ir=R*0.7; const start=-Math.PI; const end=0; const arc=d3.arc().innerRadius(ir).outerRadius(R).startAngle(start);
//         g.attr("transform","translate("+cx+","+cy+")");
//         g.append("path").attr("d", arc.endAngle(end)).attr("fill","currentColor").attr("opacity",0.15);
//         g.append("path").attr("d", arc.endAngle(start+(end-start)*k)).attr("fill","currentColor");
//         g.append("text").attr("text-anchor","middle").attr("dy","0.35em").style("font-weight","600").text(Math.round(k*100)+"%");
//         addLegend(root, [rows[0]?.name || "Value"], ()=>"currentColor");
//         return;
//       }
//       if (!norm.length){ g.append("text").attr("x",cx).attr("y",cy).attr("text-anchor","middle").text("No valid data"); return; }

//       if (type==="radial"){
//         const a = d3.scaleBand().domain(norm.map(x=>x.key)).range([0,2*Math.PI]).padding(0.1);
//         const r = d3.scaleLinear().domain([0, d3.max(norm,x=>x.value)||1]).range([R*0.25,R]);
//         g.attr("transform","translate("+cx+","+cy+")");
//         g.selectAll("path.rad").data(norm).join("path").attr("class","rad")
//           .attr("d", d=>d3.arc().innerRadius(R*0.25).outerRadius(r(d.value)).startAngle(a(d.key)).endAngle(a(d.key)+a.bandwidth())())
//           .attr("fill", d=>color(d.key))
//           .on("pointerenter",(e,d)=>showTip(e, d.key+": "+d.value))
//           .on("pointermove",(e)=>showTip(e, document.querySelector(".tooltip").innerHTML))
//           .on("pointerleave",hideTip);
//         addLegend(root, norm.map(d=>d.key), color);
//         return;
//       }

//       const pie = d3.pie().value(d=>d.value).sort(null);
//       const arcs = pie(norm);
//       const innerR = (type==="donut") ? R*0.6 : 0;
//       g.attr("transform","translate("+cx+","+cy+")");
//       g.selectAll("path.slice").data(arcs).join("path").attr("class","slice")
//         .attr("d", d3.arc().innerRadius(innerR).outerRadius(R))
//         .attr("fill", d=>color(d.data.key))
//         .on("pointerenter",(e,d)=>showTip(e, d.data.key+": "+d.data.value))
//         .on("pointermove",(e)=>showTip(e, document.querySelector(".tooltip").innerHTML))
//         .on("pointerleave",hideTip);
//       addLegend(root, norm.map(d=>d.key), color);
//     }

//     function renderCalendarHeatmap(g, rows, innerW, innerH){
//       const norm = normalizeTimeRows(rows);
//       if (!norm.length){ g.append("text").attr("x",innerW/2).attr("y",innerH/2).attr("text-anchor","middle").text("No valid data"); return; }
//       const byYear = d3.groups(norm, d=>d.date.getUTCFullYear());
//       const years = byYear.map(d=>d[0]).sort(d3.ascending);
//       const cell=14, gap=2; const color = d3.scaleSequential(d3.interpolateTurbo).domain([0, d3.max(norm,d=>d.value)||1]);
//       years.forEach((yr, yi)=>{
//         const Y = yi * (cell*7 + 24 + 20);
//         const data = byYear.find(d=>d[0]===yr)[1];
//         const map = new Map(data.map(d=>[fmt.dateISO(d.date), d.value]));
//         g.append("text").attr("x",0).attr("y",Y+12).style("font-size","12px").text(yr);
//         const first=new Date(Date.UTC(yr,0,1)), last=new Date(Date.UTC(yr,11,31));
//         const days=d3.utcDays(first, d3.utcDay.offset(last,1));
//         const group=g.append("g").attr("transform","translate(40,"+Y+")");
//         group.selectAll("rect.day").data(days).join("rect").attr("class","day")
//           .attr("width",cell).attr("height",cell)
//           .attr("x",d=> d3.utcWeek.count(new Date(Date.UTC(yr,0,1)), d) * (cell+gap))
//           .attr("y",d=> d.getUTCDay() * (cell+gap) + 16)
//           .attr("rx",2).attr("ry",2)
//           .attr("fill", d=>{ const v = map.get(fmt.dateISO(d))||0; return v===0 ? "#e5e7eb" : color(v); })
//           .on("pointerenter",(e,d)=>{ const v=map.get(fmt.dateISO(d))||0; showTip(e, fmt.dateISO(d)+" • "+v); })
//           .on("pointermove",(e)=>showTip(e, document.querySelector(".tooltip").innerHTML))
//           .on("pointerleave",hideTip);
//       });
//     }

//     function renderMatrixHeatmap(g, rows, innerW, innerH, ctx){
//       const xs = Array.from(new Set(rows.map(r=>r.x)));
//       const ys = Array.from(new Set(rows.map(r=>r.y)));
//       if (!xs.length || !ys.length){ g.append("text").attr("x",innerW/2).attr("y",innerH/2).attr("text-anchor","middle").text("Provide {x,y,value} rows"); return; }
//       const xScale = d3.scaleBand().domain(xs).range([0, innerW]).padding(0.05);
//       const yScale = d3.scaleBand().domain(ys).range([0, innerH]).padding(0.05);
//       const maxV = d3.max(rows, d=>+d.value)||1;
//       const color = d3.scaleSequential(d3.interpolateTurbo).domain([0, maxV]);
//       g.append("g").attr("transform","translate(0,"+innerH+")").call(d3.axisBottom(xScale));
//       g.append("g").call(d3.axisLeft(yScale));
//       g.selectAll("rect.cell").data(rows).join("rect").attr("class","cell")
//         .attr("x", d=>xScale(d.x)).attr("y", d=>yScale(d.y))
//         .attr("width", xScale.bandwidth()).attr("height", yScale.bandwidth())
//         .attr("rx",2).attr("ry",2).attr("fill", d=>color(+d.value))
//         .on("pointerenter", (e,d)=>showTip(e, d.x+" × "+d.y+" • "+d.value))
//         .on("pointermove",(e)=>showTip(e, document.querySelector(".tooltip").innerHTML))
//         .on("pointerleave", hideTip);
//       addLegend(ctx.root, ["Low","High"], (k)=> k==="Low" ? color(0) : color(maxV));
//     }

//     function renderDendrogram(g, input, innerW, innerH){
//       const tree = (input && input.data && (input.data.children || input.data.name)) ? input.data : null;
//       if (!tree){ g.append("text").attr("x",innerW/2).attr("y",innerH/2).attr("text-anchor","middle").text("Provide { name, children }"); return; }
//       const root = d3.hierarchy(tree);
//       const cluster = d3.cluster().size([innerH, innerW - 160]);
//       cluster(root);
//       g.append("g").selectAll("path").data(root.links()).join("path")
//         .attr("fill","none").attr("stroke","currentColor").attr("stroke-opacity",0.4)
//         .attr("d", d3.linkHorizontal().x(d=>d.y).y(d=>d.x));
//       const node = g.append("g").selectAll("g").data(root.descendants()).join("g")
//         .attr("transform", d=>"translate("+d.y+","+d.x+")");
//       node.append("circle").attr("r",3).attr("fill","currentColor");
//       node.append("text").attr("dy","0.32em").attr("x", d=>d.children?-8:8)
//         .attr("text-anchor", d=>d.children?"end":"start").style("font-size","12px")
//         .text(d=>d.data.name ?? d.data.id ?? "");
//     }

//     function renderForce(g, input, innerW, innerH, ctx){
//       const data = input && input.data && input.data.nodes ? input.data : null;
//       if (!data){ g.append("text").attr("x",innerW/2).attr("y",innerH/2).attr("text-anchor","middle").text("Provide { nodes, links }"); return; }
//       const color = d3.scaleOrdinal(d3.schemeTableau10);
//       const link = g.append("g").attr("stroke","currentColor").attr("stroke-opacity",0.3)
//         .selectAll("line").data(data.links).join("line").attr("stroke-width", d=>Math.sqrt(d.value||1));
//       const node = g.append("g").attr("stroke","#fff").attr("stroke-width",1.5)
//         .selectAll("circle").data(data.nodes).join("circle").attr("r",5).attr("fill", d=>color(d.group||0))
//         .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended))
//         .on("pointerenter",(e,d)=>showTip(e, d.id))
//         .on("pointermove",(e)=>showTip(e, document.querySelector(".tooltip").innerHTML))
//         .on("pointerleave",hideTip);

//       const sim = d3.forceSimulation(data.nodes)
//         .force("link", d3.forceLink(data.links).id(d=>d.id).distance(d=>40+(d.value||0)))
//         .force("charge", d3.forceManyBody().strength(-200))
//         .force("center", d3.forceCenter(innerW/2, innerH/2))
//         .on("tick", ticked);

//       function ticked(){
//         link.attr("x1", d=>d.source.x).attr("y1", d=>d.source.y).attr("x2", d=>d.target.x).attr("y2", d=>d.target.y);
//         node.attr("cx", d=>d.x).attr("cy", d=>d.y);
//       }
//       function dragstarted(event, d){ if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
//       function dragged(event, d){ d.fx = event.x; d.fy = event.y; }
//       function dragended(event, d){ if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }

//       const groups = Array.from(new Set(data.nodes.map(n=>n.group))).map(v => v==null ? "Group" : "Group "+v);
//       addLegend(ctx.root, groups, k => color(+String(k).replace("Group ","")||0));
//     }
//   }

//   // boot
//   render("#chart", INPUT);
// })();
// </script>
// </body>
// </html>`;
// };



// ---------------------->>>>>>>>>>>> 2.0 






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
  :root { color-scheme: light dark; }
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
</style>
<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3"></script>
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
      value: valueOf(d)
    }; }).filter(function(d){ return d.date instanceof Date && !isNaN(d.date) && Number.isFinite(d.value); })
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

    if (['line','area','bar','scatter','barline'].includes(type)){ renderTimeLike(g, rows, type, innerW, innerH, { margin: margin, opts: opts, root: root }); return; }
    if (['xy-scatter','bubble'].includes(type)){ renderXYLike(g, rows, type, innerW, innerH, { margin: margin, opts: opts, root: root, colorScheme: colorScheme }); return; }
    if (['pie','donut','arc','radial'].includes(type)){ renderRadialLike(g, rows, type, innerW, innerH, { root: root, colorScheme: colorScheme }); return; }
    if (type==='heatmap'){ renderCalendarHeatmap(g, rows, innerW, innerH); return; }
    if (type==='matrix-heatmap'){ renderMatrixHeatmap(g, rows, innerW, innerH, { margin: margin, colorScheme: colorScheme, root: root }); return; }
    if (type==='dendrogram'){ renderDendrogram(g, input, innerW, innerH); return; }
    if (type==='force'){ renderForce(g, input, innerW, innerH, { svg: svg, root: root }); return; }
    if (type==='geo'){ renderGeo(g, rows, innerW, innerH, { svg: svg, root: root, opts: opts, width: width, height: height, margin: margin, colorScheme: colorScheme }); return; }

    g.append('text').attr('x', innerW/2).attr('y', innerH/2).attr('text-anchor','middle')
     .style('font','14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif')
     .text('Unsupported chartType: ' + type);

    // -------- Renderers --------
    function renderTimeLike(g, rows, type, innerW, innerH, ctx){
      var norm = normalizeTimeRows(rows);
      var margin = ctx.margin, opts = ctx.opts, root = ctx.root;
      if (!norm.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('No valid data'); return; }
      var x = d3.scaleUtc().domain(d3.extent(norm, function(d){ return d.date; })).range([0, innerW]).nice();
      var y = d3.scaleLinear().domain([0, d3.max(norm,function(d){ return d.value; })||0]).nice().range([innerH,0]);
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
        g.selectAll('rect.bar').data(norm).join('rect').attr('class','bar')
          .attr('x',function(d){ return xBand(+d.date); }).attr('y',function(d){ return y(Math.max(0,d.value)); })
          .attr('width',xBand.bandwidth()).attr('height',function(d){ return Math.abs(y(d.value)-y(0)); })
          .attr('fill','currentColor').attr('opacity', type==='barline'?0.35:1)
          .on('pointerenter',function(e,d){ showTip(e, fmt.dateISO(d.date)+' • '+d.value); })
          .on('pointermove',function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
          .on('pointerleave',hideTip);
      }
      if (type!=='bar'){
        g.selectAll('circle.pt').data(norm).join('circle').attr('class','pt')
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

    function renderGeo(g, rows, innerW, innerH, ctx){
      var root = ctx.root, opts = ctx.opts;
      var mode = opts.geoMode || inferGeoMode(rows);
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

        if (mode === 'choropleth'){
          var byId = new Map();
          rows.forEach(function(d){
            var id = (d.iso3 || d.id || d.code || '').toString().toUpperCase();
            if (id) byId.set(id, (+d.value) || (+d.count) || 0);
          });
          var byName = new Map(rows.filter(function(d){ return d.name; }).map(function(d){ return [d.name.toString().toLowerCase(), (+d.value) || (+d.count) || 0]; }));
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
        } else {
          var pts = rows.map(function(d){ return {
            lat: (+d.lat) || (+d.latitude) || yNumOf(d),
            lon: (+d.lon) || (+d.longitude) || xNumOf(d),
            r: (+d.r) || (+d.size) || (+d.value) || 1,
            name: d.name || d.label || ''
          }; }).filter(function(p){ return Number.isFinite(p.lat) && Number.isFinite(p.lon); });
          if (!pts.length){ g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Provide {lat, lon, value} rows'); return; }
          var r = d3.scaleSqrt().domain([0, d3.max(pts, function(d){ return d.r; })||1]).range([2, Math.min(innerW, innerH)/20]);

          g.append('g').selectAll('circle.pin').data(pts).join('circle').attr('class','pin')
            .attr('transform', function(d){ var p = proj([d.lon,d.lat]); return 'translate(' + p[0] + ',' + p[1] + ')'; })
            .attr('r', function(d){ return r(d.r); })
            .attr('fill', 'currentColor').attr('fill-opacity', 0.6).attr('stroke', 'white').attr('stroke-width', 0.5)
            .on('pointerenter', function(e,d){ showTip(e, (d.name||'') + ' ' + d.lat.toFixed(2) + ', ' + d.lon.toFixed(2) + ' • ' + d.r); })
            .on('pointermove', function(e){ showTip(e, document.querySelector('.tooltip').innerHTML); })
            .on('pointerleave', hideTip);

          addLegend(root, ['Smaller','Larger'], function(k){ return k==='Smaller'? '#9ca3af' : '#111827'; });
        }
      }).catch(function(){
        g.append('text').attr('x',innerW/2).attr('y',innerH/2).attr('text-anchor','middle').text('Failed to load world map');
      });
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
  data: { name: "Root", children: [{ name: "A" }, { name: "B", children:[{ name: "B1" }, { name: "B2" }] }] },
  options: { title: "Hierarchy" }
});

// buildChartHTML({
//   chartType: "donut",
//   data: [{ name:"Alpha", value:30 }, { name:"Beta", value:50 }, { name:"Gamma", value:20 }],
//   options: { title: "Share" }
// });

let radialChart = buildChartHTML({
  chartType: "radial",
  data: [
    { name: "North", value: 15 },
    { name: "South", value: 25 },
    { name: "East", value: 10 },
    { name: "West", value: 20 }
  ],
  options: { title: "Radial Chart" }
});

let geoChoropleth = buildChartHTML({
  chartType: "geo",
  data: [
    { iso3: "USA", value: 100 },
    { iso3: "IND", value: 75 },
    { iso3: "BRA", value: 50 },
    { iso3: "FRA", value: 30 }
  ],
  options: { title: "World Choropleth Map", geoMode: "choropleth" }
});


console.log(geoChoropleth);