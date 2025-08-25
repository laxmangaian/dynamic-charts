// NOTE: If you split this into a real file, remove the surrounding <script> tag.

/* ---------- tiny utils ---------- */
const getPath = (obj, path) => path.split('.').reduce((o,k)=> (o==null ? o : o[k]), obj);
const makeAccessorResolver = (fields=[]) => (name)=>{
  const f = fields.find(f=>f.name===name);
  return f ? (f.accessor || f.name) : name;
};
const inferType = (values)=>{
  const v = values.find(x=>x!=null);
  if (v==null) return 'quantitative';
  if (v instanceof Date) return 'temporal';
  if (!isNaN(+v) && v!=='') return 'quantitative';
  return 'nominal';
};
const resolveScheme = (name)=>{
  const key = 'scheme' + name.replace(/[^a-z0-9]/ig,'');
  return d3[key] || d3.schemeCategory10;
};
const valueReader = (enc, accOf)=>{
  if (!enc) return ()=>undefined;
  if ('value' in enc) return ()=>enc.value;
  if ('field' in enc){
    const acc = accOf(enc.field);
    return d=> getPath(d, acc);
  }
  return ()=>undefined;
};
const collectValues = (data, reader)=> data.map(reader).filter(v=>v!=null);

/* ---------- SPEC <-> DATA DECOUPLING ---------- */
// A spec references data via one of:
// 1) spec.data.datasetId: "prices_2024" (preferred)
// 2) spec.data.source: { type: 'inline'|'url', data|url }
// datasets.json maps IDs -> { type:'inline'|'url', data|url }

async function fetchJson(url){
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch failed ${url}: ${r.status}`);
  return r.json();
}

async function resolveDataset(entry){
  if (!entry) return [];
  if (entry.type === 'inline') return entry.data ?? [];
  if (entry.type === 'url') {
    const json = await fetchJson(entry.url);
    return json;
  }
  // Fallback: if entry already is an array
  if (Array.isArray(entry)) return entry;
  return [];
}

async function resolveSpecData(spec, datasets){
  // If datasetId is present, look it up; else fall back to source.
  const src = spec?.data?.datasetId ? datasets[spec.data.datasetId] : spec?.data?.source;
  const rows = await resolveDataset(src);
  return { rows, fields: spec?.data?.fields || [] };
}

/* ---------- shorthand normalization (no inline rows required) ---------- */
function normalizeSpec(spec){
  // pass-through if complete
  if (spec?.data && (spec?.layers)) return spec;

  // shorthand: { chartType, datasetId, title?, space? }
  if (spec.chartType && (spec.datasetId || spec?.data?.datasetId)){
    const xField = spec.x || 'date';
    const yField = spec.y || 'value';
    const width  = spec.space?.width ?? 800;
    const height = spec.space?.height ?? 400;
    return {
      id: spec.id || `auto-${spec.chartType}`,
      title: spec.title || (spec.chartType[0].toUpperCase()+spec.chartType.slice(1)),
      data: {
        datasetId: spec.datasetId || spec?.data?.datasetId,
        fields: [
          { name: xField, type:'temporal',     accessor:xField },
          { name: yField, type:'quantitative', accessor:yField }
        ]
      },
      space: { width, height },
      scales: {
        x: { type:'time',   range:[50, width-50] },
        y: { type:'linear', range:[height-50, 50], nice:true }
      },
      layers: [{
        id:'line', mark:{type:'line'},
        encoding:{ x:{field:xField, scale:'x'}, y:{field:yField, scale:'y'}, stroke:{value:'steelblue'}, strokeWidth:{value:2} }
      }]
    };
  }
  return spec;
}

/* ---------- transforms ---------- */
function runTransforms(src, transforms = []){
  let ctx = { type: Array.isArray(src) ? 'table' : (typeof src==='object' ? 'object' : 'table'), data: src };
  for (const t of transforms){
    const type = (t?.type||'').toLowerCase();
    const p = t?.params || {};
    if (type==='hierarchy'){
      const root = d3.hierarchy(ctx.data);
      ctx = { type:'hierarchy', root };
    } else if (type==='cluster'){
      if (ctx.type!=='hierarchy') throw new Error('cluster requires hierarchy');
      const layout = d3.cluster().size(p.size||[1,1]).separation(p.separation || ((a,b)=> a.parent===b.parent?1:2));
      ctx = { type:'hierarchy', root: layout(ctx.root) };
    } else if (type==='tree'){
      if (ctx.type!=='hierarchy') throw new Error('tree requires hierarchy');
      const layout = d3.tree().size(p.size||[1,1]).separation(p.separation || ((a,b)=> a.parent===b.parent?1:2));
      ctx = { type:'hierarchy', root: layout(ctx.root) };
    } else if (type==='filter'){
      const fn = typeof p.fn==='function' ? p.fn : (p.fn ? Function('return ('+p.fn+')')() : null);
      ctx = { type:'table', data: fn ? ctx.data.filter(fn) : ctx.data };
    } else if (type==='map'){
      const fn = typeof p.fn==='function' ? p.fn : (p.fn ? Function('return ('+p.fn+')')() : null);
      ctx = { type:'table', data: fn ? ctx.data.map(fn) : ctx.data };
    }
  }
  return ctx;
}

/* ---------- scales ---------- */
function buildScales(spec, layersData, fields){
  const result = {};
  const scalesSpec = spec.scales || {};
  for (const [name, s] of Object.entries(scalesSpec)){
    const type = (s.type||'').toLowerCase();
    let scale;
    if (type==='time') scale = d3.scaleTime();
    else if (type==='log') scale = d3.scaleLog();
    else if (type==='ordinal') scale = d3.scaleOrdinal().range(s.scheme ? resolveScheme(s.scheme) : undefined);
    else if (type==='band') scale = d3.scaleBand().padding(s.padding ?? 0.1);
    else scale = d3.scaleLinear();

    if (s.domain){
      scale.domain(s.domain);
    } else {
      const vals = [];
      for (const ld of layersData){
        for (const enc of Object.values(ld.layer.encoding || {})){
          if (enc && enc.scale===name && !('value' in enc)){
            const rd = valueReader(enc, fields);
            vals.push(...collectValues(ld.data, rd));
          }
        }
      }
      if (type==='time'){
        const dates = vals.map(v => (v instanceof Date ? v : new Date(v)));
        scale.domain(d3.extent(dates));
      } else {
        const t = inferType(vals);
        if (t==='quantitative'){
          scale.domain(d3.extent(vals.map(Number)));
          if (s.nice && scale.nice) scale.nice();
        } else if (t==='temporal'){
          scale = d3.scaleTime().domain(d3.extent(vals.map(v => v instanceof Date ? v : new Date(v))));
        } else {
          scale.domain([...new Set(vals)]);
        }
      }
    }
    if (s.range) scale.range(s.range);
    if (s.nice && scale.nice) scale.nice();
    result[name] = scale;
  }
  return result;
}

/* ---------- layer renderer ---------- */
function renderLayer(svg, layerData, scales, fields, dims){
  const { layer, data } = layerData;
  const enc = layer.encoding || {};
  const accOf = fields;
  const r = (k)=>{
    const ch = enc[k];
    if (!ch) return ()=>undefined;
    if ('value' in ch) return ()=>ch.value;
    if ('field' in ch){ const acc = accOf(ch.field); return d=> getPath(d, acc); }
    return ()=>undefined;
  };

  const collect = (reader)=> data.map(reader).filter(v=>v!=null);
  const localInfer = (vals)=>{
    const v = vals.find(x=>x!=null);
    if (v instanceof Date) return 'temporal';
    if (typeof v==='string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return 'temporal';
    return (!isNaN(+v) && v!=='') ? 'quantitative' : 'nominal';
  };
  const buildShared = (encA, encB, axis)=>{
    const a = encA && !('value' in encA), b = encB && !('value' in encB);
    if (!a && !b) return null;
    if ((encA?.scale && scales[encA.scale]) || (encB?.scale && scales[encB.scale])) return null;
    const vals = [];
    if (a) vals.push(...collect(r(axis)));
    if (b) vals.push(...collect(r(axis+'2')));
    const t = localInfer(vals);
    const range = axis==='x' ? [dims.margin.left, dims.width-dims.margin.right] : [dims.height-dims.margin.bottom, dims.margin.top];
    if (t==='temporal') return d3.scaleTime().domain(d3.extent(vals.map(v=> v instanceof Date ? v : new Date(v)))).range(range);
    if (t==='quantitative') return d3.scaleLinear().domain(d3.extent(vals.map(Number))).nice().range(range);
    return d3.scalePoint().domain([...new Set(vals)]).range(range);
  };

  const sxShared = buildShared(enc.x, enc.x2, 'x');
  const syShared = buildShared(enc.y, enc.y2, 'y');
  const scaleFor = (encCh, shared)=>{
    if (!encCh || 'value' in encCh) return null;
    if (encCh.scale && scales[encCh.scale]) return scales[encCh.scale];
    return shared;
  };
  const sx = scaleFor(enc.x, sxShared);
  const sx2= scaleFor(enc.x2, sxShared);
  const sy = scaleFor(enc.y, syShared);
  const sy2= scaleFor(enc.y2, syShared);

  const coerceForScale = (scale, v)=>{
    if (!scale) return v;
    const looksDate = (v instanceof Date) || (typeof v==='string' && /^\d{4}-\d{2}-\d{2}/.test(v));
    return looksDate ? new Date(v) : v;
  };

  const posX  = d=> sx  ? sx (coerceForScale(sx,  r('x')(d)))  : +r('x')(d);
  const posY  = d=> sy  ? sy (coerceForScale(sy,  r('y')(d)))  : +r('y')(d);
  const posX2 = d=> sx2 ? sx2(coerceForScale(sx2, r('x2')(d))) : +r('x2')(d);
  const posY2 = d=> sy2 ? sy2(coerceForScale(sy2, r('y2')(d))) : +r('y2')(d);

  const applyFill   = sel => sel.attr('fill', d=> { const v=r('fill')(d); if (v==null) return 'none'; if (enc.fill?.scale&&scales[enc.fill.scale]) return scales[enc.fill.scale](v); return v; });
  const applyStroke = sel => sel.attr('stroke', d=> { const v=r('stroke')(d); if (v==null) return '#333'; if (enc.stroke?.scale&&scales[enc.stroke.scale]) return scales[enc.stroke.scale](v); return v; });
  const applyOpacity= sel => sel.attr('opacity', d=> { const v=r('opacity')(d); return v==null? null : +v; });

  const mark = (layer.mark?.type || 'point').toLowerCase();

  if (mark==='link'){
    const link = d3.linkHorizontal().x(d=>d.y).y(d=>d.x);
    const toScreen = (d)=>({
      source:{ x: posY({ ...d, y: r('y')({ source:d.source }) }), y: posX({ ...d, x: r('x')({ source:d.source }) }) },
      target:{ x: posY({ ...d, y: r('y2')({ target:d.target }) }), y: posX({ ...d, x: r('x2')({ target:d.target }) }) }
    });
    svg.append('g').selectAll('path').data(data).join('path')
      .attr('d', d=> link(toScreen(d)))
      .call(applyStroke).call(applyOpacity)
      .attr('stroke-width', layer.encoding?.strokeWidth?.value ?? 1.5)
      .attr('fill','none');
    return;
  }

  if (mark==='line'){
    const hasSeg = enc.x2 || enc.y2;
    if (hasSeg){
      svg.append('g').selectAll('line').data(data).join('line')
        .attr('x1', d=>posX(d)).attr('y1', d=>posY(d))
        .attr('x2', d=>posX2(d)).attr('y2', d=>posY2(d))
        .call(applyStroke).call(applyOpacity)
        .attr('stroke-width', layer.encoding?.strokeWidth?.value ?? 1.5)
        .attr('fill','none');
    } else {
      const lineGen = d3.line().defined(d=> r('x')(d)!=null && r('y')(d)!=null).x(d=>posX(d)).y(d=>posY(d));
      svg.append('path').datum(data).attr('d', lineGen)
        .call(applyStroke).call(applyOpacity)
        .attr('stroke-width', layer.encoding?.strokeWidth?.value ?? 1.5)
        .attr('fill','none');
    }
  } else if (mark==='circle' || mark==='point'){
    svg.append('g').selectAll('circle').data(data).join('circle')
      .attr('cx', d=>posX(d)).attr('cy', d=>posY(d))
      .attr('r', d=> r('r')(d) ?? 3)
      .call(applyFill).call(applyStroke).call(applyOpacity);
  } else if (mark==='rect'){
    svg.append('g').selectAll('rect').data(data).join('rect')
      .attr('x', d=>posX(d)).attr('y', d=>posY(d))
      .attr('width', d=> r('width')(d) ?? 2)
      .attr('height', d=> r('height')(d) ?? 2)
      .call(applyFill).call(applyStroke).call(applyOpacity);
  } else if (mark==='text'){
    svg.append('g').selectAll('text').data(data).join('text')
      .attr('x', d=>posX(d)).attr('y', d=>posY(d))
      .text(d=> r('text')(d) ?? '')
      .attr('dy','0.32em')
      .call(applyFill).call(applyStroke).call(applyOpacity);
  }
}

/* ---------- main rendering ---------- */
function renderSpecs(specs, datasets, container = '#root'){
  const root = typeof container==='string' ? document.querySelector(container) : container;
  specs.forEach((spec, i)=>{
    const title = spec.title || spec.id || `Chart ${i+1}`;
    const width = spec.space?.width ?? 800;
    const height= spec.space?.height ?? 400;
    const margin= { top:24, right:28, bottom:36, left:52 };

    const wrap = document.createElement('div');
    wrap.className = 'chart';
    wrap.innerHTML = `<div class="title">${title}</div>`;
    root.appendChild(wrap);

    const svg = d3.select(wrap).append('svg')
      .attr('width', width).attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const fields = spec?.data?.fields || [];
    const accOf = makeAccessorResolver(fields);

    const srcRows = wrap.__resolvedRows; // (unused hook left for future streaming)

    const raw = srcRows || wrap.__raw || [];
    // NOTE: We resolve data outside; here we only receive rows via caller.

    const tctx = runTransforms(raw, spec?.data?.transforms || []);
    const nodes = (tctx.type==='hierarchy') ? tctx.root.descendants() : null;
    const links = (tctx.type==='hierarchy') ? tctx.root.links() : null;

    const layers = spec.layers || [];
    const layersData = layers.map(layer=>{
      const encStr = JSON.stringify(layer.encoding || {});
      const useLinks = /"source\./.test(encStr) || /"target\./.test(encStr);
      return { layer, data: (nodes && useLinks) ? links : (nodes ? nodes : (tctx.data || [])) };
    });

    const namedScales = buildScales(spec, layersData, accOf);
    for (const ld of layersData){ renderLayer(svg, ld, namedScales, accOf, { width, height, margin }); }

    if (namedScales.x && namedScales.y){
      const x = namedScales.x, y = namedScales.y;
      svg.append('g').attr('class','grid').attr('transform',`translate(${margin.left},0)`) 
        .call(d3.axisLeft(y).ticks(6).tickSize(-(width - margin.left - margin.right)).tickFormat(''));
      svg.append('g').attr('class','axis x-axis').attr('transform',`translate(0,${height - margin.bottom})`) 
        .call(d3.axisBottom(x).ticks(6));
      svg.append('g').attr('class','axis y-axis').attr('transform',`translate(${margin.left},0)`) 
        .call(d3.axisLeft(y).ticks(6));
    }
  });
}

/* ---------- orchestrators ---------- */
export async function renderFromUrls(specsUrl, datasetsUrl, container = '#root'){
  // 1) Load the two documents
  const [specsRaw, datasets] = await Promise.all([
    fetchJson(specsUrl),
    fetchJson(datasetsUrl)
  ]);

  // 2) Normalize specs (shorthand -> full)
  const normalized = specsRaw.map(normalizeSpec);

  // 3) Resolve and render sequentially (per spec), preserving decoupling
  for (const spec of normalized){
    const { rows, fields } = await resolveSpecData(spec, datasets);
    // Create a shallow clone with fields (if none provided in spec, keep as-is)
    const specWithFields = { ...spec, data: { ...(spec.data||{}), fields: (spec.data?.fields?.length ? spec.data.fields : fields) } };
    // Create a temp container, attach rows to it (so renderSpecs can read them without coupling to fetch)
    const temp = document.createElement('div');
    document.querySelector(container).appendChild(temp);
    // Store the resolved rows on the element as a side-channel
    temp.__raw = rows;
    renderSpecs([specWithFields], datasets, temp);
  }
}


{/* <script type="application/json" id="example.specs.json">


</script>


<script type="application/json" id="datasets.json"> */}
