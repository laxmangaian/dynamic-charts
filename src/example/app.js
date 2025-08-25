// D3 Spec Renderer (interactive, wide support)
// Goal: user supplies data and chooses chart type. We render if the data is compatible.
// Supported chart types (marks): line, area, bar, scatter, bubble, pie, donut, geo, chord, qplot, arc.
// - geo: expects GeoJSON FeatureCollection
// - chord: expects an edge list [{source, target, value}] or square matrix [[...]]
// - qplot: quantile-quantile plot comparing two numeric fields
// - arc: simple gauge/progress: expects [{label, value, max}] or single row with value & max
//
// The dropdown per chart shows only COMPATIBLE chart types for the dataset.
// Area charts handle missing data via .defined.
(function() {
/* ---------- helpers ---------- */
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o==null?o:o[k]), obj);
const makeAccessorResolver = (fields=[]) => (name) => {
  const f = fields.find(f => f.name === name);
  return f ? (f.accessor || f.name) : name;
};
const inferType = (values) => {
  const v = values.find(x => x != null);
  if (v == null) return 'quantitative';
  if (v instanceof Date) return 'temporal';
  if (!isNaN(+v) && v !== '') return 'quantitative';
  return 'nominal';
};
const resolveScheme = (name) => {
  const key = 'scheme' + name.replace(/[^a-z0-9]/ig,'');
  return d3[key] || d3.schemeCategory10;
};
const valueReader = (enc, accOf) => {
  if (!enc) return () => undefined;
  if ('value' in enc) return () => enc.value;
  if ('field' in enc) {
    const acc = accOf(enc.field);
    return d => getPath(d, acc);
  }
  return () => undefined;
};
const collectValues = (data, reader) => data.map(reader).filter(v => v != null);
const isFeatureCollection = (d) => d && d.type === 'FeatureCollection' && Array.isArray(d.features);

/* ---------- transforms ---------- */
function runTransforms(src, transforms = []) {
  let ctx = { type: Array.isArray(src)?'table':(typeof src==='object'?'object':'table'), data: src };
  for (const t of transforms) {
    const type = (t?.type||'').toLowerCase();
    const p = t?.params || {};
    if (type === 'hierarchy') {
      const root = d3.hierarchy(ctx.data);
      ctx = { type:'hierarchy', root };
    } else if (type === 'cluster') {
      if (ctx.type!=='hierarchy') throw new Error('cluster requires hierarchy');
      const layout = d3.cluster().size(p.size||[1,1]).separation(p.separation||((a,b)=>a.parent===b.parent?1:2));
      ctx = { type:'hierarchy', root: layout(ctx.root) };
    } else if (type === 'tree') {
      if (ctx.type!=='hierarchy') throw new Error('tree requires hierarchy');
      const layout = d3.tree().size(p.size||[1,1]).separation(p.separation||((a,b)=>a.parent===b.parent?1:2));
      ctx = { type:'hierarchy', root: layout(ctx.root) };
    } else if (type === 'filter') {
      const fn = typeof p.fn==='function'?p.fn:(p.fn?eval(p.fn):null);
      ctx = { type:'table', data: fn?ctx.data.filter(fn):ctx.data };
    } else if (type === 'map') {
      const fn = typeof p.fn==='function'?p.fn:(p.fn?eval(p.fn):null);
      ctx = { type:'table', data: fn?ctx.data.map(fn):ctx.data };
    } else if (type === 'stack') {
      const keys = p.keys;
      if (!Array.isArray(keys) || !keys.length) throw new Error('stack requires params.keys');
      const stack = d3.stack().keys(keys);
      const series = stack(ctx.data);
      ctx = { type:'stack', series, keys, data: ctx.data, xField: p.x };
    }
  }
  return ctx;
}

/* ---------- scales ---------- */
function buildScales(spec, layersData, fields) {
  const result = {};
  const scalesSpec = spec.scales || {};
  for (const [name, s] of Object.entries(scalesSpec)) {
    const type = (s.type||'').toLowerCase();
    let scale;
    if (type === 'time') scale = d3.scaleTime();
    else if (type === 'log') scale = d3.scaleLog();
    else if (type === 'ordinal') scale = d3.scaleOrdinal().range(s.scheme ? resolveScheme(s.scheme) : undefined);
    else if (type === 'band') scale = d3.scaleBand().padding(s.padding ?? 0.1);
    else if (type === 'point') scale = d3.scalePoint().padding(s.padding ?? 0.5);
    else if (type === 'sqrt') scale = d3.scaleSqrt();
    else scale = d3.scaleLinear();

    if (s.domain) {
      scale.domain(s.domain);
    } else {
      const vals = [];
      for (const ld of layersData) {
        for (const enc of Object.values(ld.layer.encoding || {})) {
          if (enc && enc.scale === name && !('value' in enc)) {
            const rd = valueReader(enc, fields);
            vals.push(...collectValues(ld.data, rd));
          }
        }
      }
      if (type === 'time') {
        const dates = vals.map(v => (v instanceof Date ? v : new Date(v)));
        scale.domain(d3.extent(dates));
      } else {
        const t = inferType(vals);
        if (t === 'quantitative') {
          scale.domain(d3.extent(vals.map(Number)));
          if (s.nice && scale.nice) scale.nice();
        } else if (t === 'temporal') {
          scale = d3.scaleTime().domain(d3.extent(vals.map(v => v instanceof Date ? v : new Date(v))));
        } else {
          scale.domain([...new Set(vals)]);
        }
      }
    }
    if (s.range) scale.range(s.range);
    if (s.nice && scale.nice && (scale.ticks)) scale.nice();
    result[name] = scale;
  }
  return result;
}

/* ---------- compatibility detection for dropdown ---------- */
function detectCompatibility(rows) {
  if (isFeatureCollection(rows)) {
    return ['geo'];
  }
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const keys = Object.keys(rows[0]);
  const numericKeys = keys.filter(k => rows.some(r => r[k] != null && !isNaN(+r[k])));
  const temporalKey = keys.find(k => rows.some(r => {
    const v = r[k];
    return (v instanceof Date) || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v));
  }));
  const categoricalKeys = keys.filter(k => !numericKeys.includes(k));

  // Edge list detection for chord
  const hasEdges = keys.includes('source') && keys.includes('target') && keys.includes('value');

  const options = new Set();

  // Pie/Donut: 1 numeric + 1 category is sufficient
  if (numericKeys.length >= 1 && categoricalKeys.length >= 1) {
    options.add('pie'); options.add('donut');
  }

  // Bar: category vs numeric (or temporal treated as categorical)
  if (numericKeys.length >= 1 && (categoricalKeys.length >= 1 || temporalKey)) {
    options.add('bar');
  }

  // Line/Area: prefer temporal + numeric
  if (temporalKey && numericKeys.length >= 1) {
    options.add('line'); options.add('area');
  }

  // Scatter/Bubble: need two numerics; bubble optionally uses a third for size
  if (numericKeys.length >= 2) {
    options.add('scatter'); options.add('qplot');
    if (numericKeys.length >= 3) options.add('bubble'); else options.add('bubble'); // allow size derived
  }

  // Chord: edge list or matrix
  if (hasEdges || (Array.isArray(rows) && Array.isArray(rows[0]) && rows.length === rows[0].length)) {
    options.add('chord');
  }

  // Arc: single row with value & max, or rows containing those
  if (rows.length >= 1 && (('value' in rows[0] && 'max' in rows[0]) || ('progress' in rows[0] && 'max' in rows[0]))) {
    options.add('arc');
  }

  return Array.from(options);
}

/* ---------- layer renderer ---------- */
function renderLayer(svg, layerData, scales, fields, dims) {
  const { layer, data } = layerData;
  const enc = layer.encoding || {};
  const accOf = fields;

  const valueReader = (encCh) => {
    if (!encCh) return () => undefined;
    if ('value' in encCh) return () => encCh.value;
    if ('field' in encCh) {
      const acc = accOf(encCh.field);
      return d => acc.split('.').reduce((o,k)=>o==null?o:o[k], d);
    }
    return () => undefined;
  };
  const r = (k) => valueReader(enc[k]);

  const coerceForScale = (scale, v) => {
    if (!scale) return v;
    const looksDate = (v instanceof Date) || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v));
    return looksDate ? new Date(v) : v;
  };

  const sx  = enc.x  && !('value' in enc.x)  ? (enc.x.scale  && scales[enc.x.scale]  || null) : null;
  const sy  = enc.y  && !('value' in enc.y)  ? (enc.y.scale  && scales[enc.y.scale]  || null) : null;
  const sc  = enc.color && !('value' in enc.color) ? (enc.color.scale && scales[enc.color.scale] || null) : null;
  const ss  = enc.size  && !('value' in enc.size)  ? (enc.size.scale  && scales[enc.size.scale]  || null) : null;

  const posX  = d => sx ? sx(coerceForScale(sx, r('x')(d))) : +r('x')(d);
  const posY  = d => sy ? sy(coerceForScale(sy, r('y')(d))) : +r('y')(d);

  const applyFill   = (sel) => sel.attr('fill',  d => {
    const v = (r('fill')?.(d)) ?? (r('color')?.(d));
    if (v == null) return 'none';
    if (enc.fill?.scale && scales[enc.fill.scale]) return scales[enc.fill.scale](v);
    if (enc.color?.scale && scales[enc.color.scale]) return scales[enc.color.scale](v);
    return v;
  });
  const applyStroke = (sel) => sel.attr('stroke', d => {
    const v = (r('stroke')?.(d));
    if (v == null) return '#333';
    if (enc.stroke?.scale && scales[enc.stroke.scale]) return scales[enc.stroke.scale](v);
    return v;
  });
  const applyOpacity = (sel) => sel.attr('opacity', d => {
    const v = r('opacity')?.(d);
    return v == null ? null : +v;
  });

  const mark = (layer.mark?.type || 'point').toLowerCase();

  if (mark === 'bar') {
    const xScale = sx;
    const yScale = sy;
    const baseline = (enc.y2 && r('y2')) ? d => yScale(coerceForScale(yScale, r('y2')(d))) : d => yScale(0);
    const width = xScale && xScale.bandwidth ? xScale.bandwidth() : 8;

    svg.append('g')
      .selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', d => (xScale ? xScale(r('x')(d)) : posX(d)) - (xScale && xScale.bandwidth ? 0 : width/2))
      .attr('y', d => Math.min(posY(d), baseline(d)))
      .attr('width', width)
      .attr('height', d => Math.abs(baseline(d) - posY(d)))
      .call(applyFill).call(applyStroke).call(applyOpacity);
    return;
  }

  if (mark === 'area') {
    const area = d3.area()
      .defined(d => r('x')(d)!=null && r('y')(d)!=null) // handles missing
      .x(d => posX(d))
      .y1(d => posY(d))
      .y0(enc.y2 ? d => sy(coerceForScale(sy, r('y2')(d))) : d => sy(0));
    svg.append('path')
      .datum(data)
      .attr('d', area)
      .call(applyFill).call(applyStroke).call(applyOpacity);
    return;
  }

  if (mark === 'line') {
    const lineGen = d3.line()
      .defined(d => r('x')(d)!=null && r('y')(d)!=null) // handles missing
      .x(d => posX(d))
      .y(d => posY(d));
    svg.append('path')
      .datum(data)
      .attr('d', lineGen)
      .call(applyStroke).call(applyOpacity)
      .attr('stroke-width', layer.encoding?.strokeWidth?.value ?? 1.5)
      .attr('fill', 'none');
    return;
  }

  if (mark === 'circle' || mark === 'point' || mark === 'scatter' || mark === 'bubble') {
    const g = svg.append('g');
    g.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', d => posX(d))
      .attr('cy', d => posY(d))
      .attr('r',  d => {
        const v = r('size')?.(d);
        if (v == null) return (mark === 'bubble') ? 6 : 3;
        return ss ? ss(+v) : Math.sqrt(+v);
      })
      .call(applyFill).call(applyStroke).call(applyOpacity);
    return;
  }

  if (mark === 'pie' || mark === 'donut') {
    const value = r('theta');
    const cat = r('color') || r('fill') || r('key');
    const radius = Math.min(dims.width, dims.height) / 2 - 10;
    const inner = mark === 'donut' ? radius * 0.6 : 0;
    const pie = d3.pie().value(d => +value(d)).sort(null);
    const arc = d3.arc().innerRadius(inner).outerRadius(radius);
    const g = svg.append('g').attr('transform', `translate(${dims.width/2},${dims.height/2})`);
    const colorScale = sc || d3.scaleOrdinal().range(d3.schemeTableau10);

    g.selectAll('path')
      .data(pie(data))
      .join('path')
      .attr('d', arc)
      .attr('fill', d => colorScale(cat(d.data)))
      .attr('stroke', 'white')
      .attr('stroke-width', 1);
    return;
  }

  if (mark === 'geo') {
    const geo = (data && data.type === 'FeatureCollection') ? data : { type:'FeatureCollection', features: [] };
    const projection = d3.geoMercator().fitExtent([[dims.margin.left, dims.margin.top],
                                                   [dims.width - dims.margin.right, dims.height - dims.margin.bottom]], geo);
    const path = d3.geoPath(projection);
    const g = svg.append('g');

    let fillReader = r('fill');
    const vals = geo.features.map(f => fillReader ? fillReader(f) : undefined).filter(v => v != null).map(Number);
    const q = (vals.length ? d3.scaleSequential(d3.interpolateBlues).domain(d3.extent(vals)) : null);

    g.selectAll('path')
      .data(geo.features)
      .join('path')
      .attr('d', path)
      .attr('fill', f => {
        const v = fillReader ? Number(fillReader(f)) : null;
        return q ? q(v) : '#ddd';
      })
      .attr('stroke', '#555');
    return;
  }

  if (mark === 'chord') {
    // encoding: source, target, value (edge list) OR data is square matrix
    let matrix = null, indexByName = new Map(), names = [];
    if (Array.isArray(data) && Array.isArray(data[0])) {
      matrix = data;
      names = d3.range(matrix.length).map(String);
    } else {
      const edges = data;
      const nodes = Array.from(new Set(edges.flatMap(e => [e.source, e.target])));
      nodes.forEach((n,i)=>{ indexByName.set(n,i); names[i]=n; });
      const n = nodes.length;
      matrix = Array.from({length:n}, () => Array(n).fill(0));
      edges.forEach(e => {
        const i = indexByName.get(e.source);
        const j = indexByName.get(e.target);
        const v = +e.value || 0;
        matrix[i][j] += v;
      });
    }

    const chords = d3.chord().padAngle(0.05).sortSubgroups(d3.descending)(matrix);
    const g = svg.append('g').attr('transform', `translate(${dims.width/2},${dims.height/2})`);
    const radius = Math.min(dims.width, dims.height) / 2 - 20;
    const arc = d3.arc().innerRadius(radius).outerRadius(radius+10);
    const ribbon = d3.ribbon().radius(radius);
    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(d3.range(names.length));

    g.append('g')
      .selectAll('path')
      .data(chords.groups)
      .join('path')
      .attr('d', arc)
      .attr('fill', d => color(d.index))
      .attr('stroke', '#fff');

    g.append('g')
      .selectAll('path')
      .data(chords)
      .join('path')
      .attr('d', ribbon)
      .attr('fill', d => color(d.target.index))
      .attr('stroke', '#fff');
    return;
  }

  if (mark === 'arc') {
    // expects a single row with {value, max} (pick first)
    const row = Array.isArray(data) ? data[0] : data;
    const value = Math.max(0, Math.min(+getPath(row,'value') || 0, +getPath(row,'max') || 1));
    const max = +getPath(row,'max') || 1;
    const f = value / max;

    const radius = Math.min(dims.width, dims.height) / 2 - 20;
    const g = svg.append('g').attr('transform', `translate(${dims.width/2},${dims.height/2})`);

    const arcBg = d3.arc().innerRadius(radius*0.7).outerRadius(radius).startAngle(-Math.PI/2).endAngle(Math.PI/2);
    const arcFg = d3.arc().innerRadius(radius*0.7).outerRadius(radius).startAngle(-Math.PI/2).endAngle(-Math.PI/2 + Math.PI*f);

    g.append('path').attr('d', arcBg()).attr('fill', '#eee');
    g.append('path').attr('d', arcFg()).attr('fill', 'steelblue');
    g.append('text').attr('text-anchor','middle').attr('dy','0.35em').text(d3.format('.0%')(f));
    return;
  }
}

/* ---------- shorthand normalizer ---------- */
function normalizeSpec(spec) {
  if (spec?.data?.source && spec?.layers) return spec;

  if (spec.chartType) {
    const rows = spec.data;
    const width  = spec.space?.width  ?? 800;
    const height = spec.space?.height ?? 400;

    // Geo
    if (spec.chartType === 'geo' && isFeatureCollection(rows)) {
      return {
        id: spec.id || 'auto-geo', title: spec.title || 'Geo',
        data: { source:{ type:'inline', data: rows }, fields:[] },
        space:{ width, height },
        layers:[{ id:'map', mark:{type:'geo'}, encoding:{ fill:{field:'properties.value'} } }]
      };
    }

    if (!Array.isArray(rows) || rows.length === 0) return spec;

    const keys = Object.keys(rows[0]);
    const temporalKey = keys.find(k => rows.some(r => {
      const v = r[k]; return (v instanceof Date) || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v));
    }));
    const numericKeys = keys.filter(k => rows.some(r => r[k] != null && !isNaN(+r[k])));
    const catKeys = keys.filter(k => !numericKeys.includes(k));

    const pick = {
      temporal: temporalKey || null,
      xNum: numericKeys[0],
      yNum: numericKeys.find(k => k !== numericKeys[0]) || numericKeys[0],
      cat: catKeys[0] || (temporalKey || keys[0]),
      size: numericKeys.find(k => k !== numericKeys[0] && k !== numericKeys[1])
    };

    const scalesXY = (temporal)=>({
      x:{ type: temporal ? 'time':'linear', range:[50, width-50], nice: !temporal },
      y:{ type:'linear', range:[height-50, 50], nice:true }
    });

    const bandY = { type:'linear', range:[height-50, 50], nice:true };

    const toSpec = (markType, enc) => ({
      id: spec.id || `auto-${markType}`,
      title: spec.title || markType[0].toUpperCase()+markType.slice(1),
      data: { source:{ type:'inline', data: rows }, fields: Object.entries(enc).filter(([k,v])=>v.field).map(([k,v])=>({ name:v.field, type: k==='x' && pick.temporal ? 'temporal' : (numericKeys.includes(v.field)?'quantitative':'nominal'), accessor:v.field })) },
      space:{ width, height },
      scales: (()=>{
        const s = {};
        if (enc.x?.scale === 'x' || enc.y?.scale === 'y') {
          s.x = { ...(pick.temporal ? {type:'time'}:{type: (markType==='bar' && !pick.temporal)?'band':'linear'}), range:[50, width-50], nice: markType!=='bar' };
          s.y = bandY;
        }
        if (enc.size) s.size = { type:'sqrt', range:[2, 22] };
        if (enc.color && enc.color.scale==='color') s.color = { type:'ordinal' };
        return s;
      })(),
      layers:[{ id: markType, mark:{type: markType}, encoding: enc }]
    });

    const type = spec.chartType.toLowerCase();

    if (type === 'line' || type === 'area') {
      const enc = { x:{ field: pick.temporal || pick.cat, scale:'x' }, y:{ field: pick.yNum, scale:'y' }, stroke:{value:'steelblue'}, fill:{ value: type==='area' ? 'lightsteelblue' : 'none' } };
      return toSpec(type, enc);
    }

    if (type === 'bar') {
      const enc = { x:{ field: pick.temporal || pick.cat, scale:'x' }, y:{ field: pick.yNum, scale:'y' }, y2:{ value:0 }, fill:{ value:'steelblue' } };
      return toSpec('bar', enc);
    }

    if (type === 'scatter') {
      const enc = { x:{ field: pick.xNum, scale:'x' }, y:{ field: pick.yNum, scale:'y' } };
      return toSpec('scatter', enc);
    }

    if (type === 'bubble') {
      const enc = { x:{ field: pick.xNum, scale:'x' }, y:{ field: pick.yNum, scale:'y' }, size:{ field: pick.size || pick.yNum, scale:'size' }, color:{ field: pick.cat || pick.temporal || pick.xNum, scale:'color' } };
      return toSpec('bubble', enc);
    }

    if (type === 'pie' || type === 'donut') {
      const valueField = numericKeys[0]; const catField = catKeys[0] || keys[0];
      return {
        id: spec.id || `auto-${type}`, title: spec.title || (type==='pie'?'Pie':'Donut'),
        data: { source:{ type:'inline', data: rows }, fields:[{name:catField,type:'nominal',accessor:catField},{name:valueField,type:'quantitative',accessor:valueField}] },
        space:{ width, height },
        scales:{ color:{ type:'ordinal', scheme:'Tableau10' } },
        layers:[{ id:type, mark:{type}, encoding:{ theta:{field:valueField}, color:{field:catField, scale:'color'} } }]
      };
    }

    if (type === 'qplot') {
      // Use first two numeric columns to form quantile-quantile plot
      if (numericKeys.length < 2) return spec;
      const xKey = numericKeys[0], yKey = numericKeys[1];
      const xs = rows.map(r => +r[xKey]).filter(v => !isNaN(v)).sort((a,b)=>a-b);
      const ys = rows.map(r => +r[yKey]).filter(v => !isNaN(v)).sort((a,b)=>a-b);
      const n = Math.min(xs.length, ys.length);
      const qData = d3.range(n).map(i => ({ qx: xs[Math.floor(i*(xs.length-1)/(n-1))], qy: ys[Math.floor(i*(ys.length-1)/(n-1))] }));
      return {
        id: spec.id || 'auto-qplot',
        title: spec.title || 'Q-Q Plot',
        data: { source:{ type:'inline', data: qData }, fields:[
          { name:'qx', type:'quantitative', accessor:'qx' },
          { name:'qy', type:'quantitative', accessor:'qy' }
        ]},
        space:{ width, height },
        scales:{ x:{type:'linear', range:[50, width-50], nice:true}, y:{type:'linear', range:[height-50, 50], nice:true} },
        layers:[
          { id:'qq', mark:{type:'scatter'}, encoding:{ x:{field:'qx', scale:'x'}, y:{field:'qy', scale:'y'}, fill:{value:'steelblue'} } },
          { id:'diag', mark:{type:'line'}, encoding:{ x:{field:'qx', scale:'x'}, y:{field:'qx', scale:'y'}, stroke:{value:'#999'} } }
        ]
      };
    }

    if (type === 'chord') {
      // Expect edge list source/target/value, pass-through
      return {
        id: spec.id || 'auto-chord', title: spec.title || 'Chord',
        data: { source:{ type:'inline', data: rows }, fields:[] },
        space:{ width, height },
        layers:[{ id:'ch', mark:{type:'chord'}, encoding:{ source:{field:'source'}, target:{field:'target'}, value:{field:'value'} } }]
      };
    }

    if (type === 'arc') {
      const row = rows[0];
      return {
        id: spec.id || 'auto-arc', title: spec.title || 'Arc',
        data: { source:{ type:'inline', data: [row] }, fields:[{name:'value',type:'quantitative',accessor:'value'},{name:'max',type:'quantitative',accessor:'max'}] },
        space:{ width, height },
        layers:[{ id:'gauge', mark:{type:'arc'}, encoding:{ value:{field:'value'}, max:{field:'max'} } }]
      };
    }
  }

  return spec;
}

/* ---------- render multiple specs with UI ---------- */
function renderSpecs(specs, container = '#root') {
  const root = typeof container === 'string' ? document.querySelector(container) : container;
  specs.forEach((spec, i) => {
    const title = spec.title || spec.id || `Chart ${i+1}`;
    const width  = spec.space?.width  ?? 800;
    const height = spec.space?.height ?? 400;
    const margin = { top: 24, right: 28, bottom: 36, left: 52 };

    const wrap = document.createElement('div');
    wrap.className = 'chart';

    const titleRow = document.createElement('div');
    titleRow.className = 'titleRow';
    const titleEl = document.createElement('div');
    titleEl.className = 'title';
    titleEl.textContent = title;
    titleRow.appendChild(titleEl);

    // Per-chart dropdown based on data compatibility
    let baseRows = spec?.data?.source?.data;
    if (spec.__controls?.baseData) baseRows = spec.__controls.baseData;
    const compat = detectCompatibility(baseRows);
    if (compat.length) {
      const controls = document.createElement('div');
      controls.className = 'controls';
      const label = document.createElement('label');
      const select = document.createElement('select');
      const selId = 'sel-' + Math.random().toString(36).slice(2,8);
      label.textContent = 'Chart type:';
      label.setAttribute('for', selId);
      select.id = selId;
      compat.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (opt === (spec.chartType || (spec.layers?.[0]?.mark?.type))) o.selected = true;
        select.appendChild(o);
      });
      controls.appendChild(label); controls.appendChild(select);
      titleRow.appendChild(controls);

      select.addEventListener('change', () => {
        const newType = select.value;
        const fresh = normalizeSpec({ chartType: newType, title, data: baseRows, space: spec.space });
        d3.select(wrap).select('svg').remove();
        drawSpec(fresh, wrap, margin, width, height);
      });
    }

    wrap.appendChild(titleRow);
    root.appendChild(wrap);
    drawSpec(spec, wrap, margin, width, height);
  });
}

function drawSpec(spec, wrap, margin, width, height) {
  const svg = d3.select(wrap).append('svg')
    .attr('width', width).attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  const src = spec?.data?.source || {};
  const fields = spec?.data?.fields || [];
  const accOf = makeAccessorResolver(fields);

  const raw = src.type === 'inline' ? src.data : (src.data ?? []);
  const tctx = runTransforms(raw, spec?.data?.transforms || []);

  let nodes=null, links=null, tableData=null;
  if (tctx.type === 'hierarchy') {
    nodes = tctx.root.descendants();
    links = tctx.root.links();
  } else if (tctx.type === 'stack') {
    tableData = [];
    tctx.series.forEach((serie, si) => {
      const key = tctx.keys[si];
      serie.forEach((seg, idx) => {
        const row = tctx.data[idx];
        tableData.push({ key, '[0]': seg[0], '[1]': seg[1], x: row[tctx.xField], __row: row });
      });
    });
  } else {
    tableData = tctx.data || [];
  }

  const layers = spec.layers || [];
  const layersData = layers.map(layer => {
    const encStr = JSON.stringify(layer.encoding || {});
    const useLinks = /"source\./.test(encStr) || /"target\./.test(encStr);
    let ld = null;
    if (nodes && useLinks) ld = links;
    else if (nodes) ld = nodes;
    else if (layer.mark?.type === 'geo') ld = raw; // GeoJSON
    else ld = tableData;
    return { layer, data: ld };
  });

  const namedScales = buildScales(spec, layersData, accOf);

  for (const ld of layersData) {
    renderLayer(svg, ld, namedScales, accOf, { width, height, margin });
  }

  // Axes for x/y charts
  if (namedScales.x && namedScales.y && !['pie','donut','geo','chord','arc'].includes(layers[0]?.mark?.type)) {
    const x = namedScales.x, y = namedScales.y;
    svg.append('g')
      .attr('class','grid')
      .attr('transform',`translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6).tickSize(-(width - margin.left - margin.right)).tickFormat(''));
    svg.append('g')
      .attr('class','axis x-axis')
      .attr('transform',`translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6));
    svg.append('g')
      .attr('class','axis y-axis')
      .attr('transform',`translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6));
  }
}

/* ---------- boot: build specs from provided JSON if present on window ---------- */
async function boot() {
  // Try to find a global 'window.__SPECS__' injected by the user (e.g., pasted JSON)
  const provided = window.__SPECS__;
  if (Array.isArray(provided) && provided.length) {
    // Normalize chartType for 3rd shorthand if present
    const specs = provided.map(s => (s.chartType ? normalizeSpec(s) : s));
    // Enhance each with a dropdown of compatible types
    const enhanced = specs.map(s => {
      const base = s?.data?.source?.data;
      const chartType = s.chartType || s?.layers?.[0]?.mark?.type;
      const options = detectCompatibility(base);
      if (options.length) {
        const selected = options.includes(chartType) ? chartType : options[0];
        const norm = chartType ? normalizeSpec({ chartType: selected, title: s.title || s.id, data: base, space: s.space }) : s;
        norm.chartType = selected;
        return norm;
      }
      return s;
    });
    renderSpecs(enhanced, '#root');
    return;
  }

  // Fallback: simple mixed demo
  let monthly = [];
  try {
    const resp = await fetch('./example.json');
    if (resp.ok) monthly = await resp.json();
  } catch(e) {
    monthly = [
      { date: '2023-01-01', sales: 100 },
      { date: '2023-02-01', sales: 120 },
      { date: '2023-03-01', sales: 150 },
      { date: '2023-04-01', sales: 90  }
    ];
  }

  const geoDemo = { type:'FeatureCollection', features:[
    { type:'Feature', properties:{name:'A', value:10}, geometry:{ type:'Polygon', coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]]] } },
    { type:'Feature', properties:{name:'B', value:30}, geometry:{ type:'Polygon', coordinates:[[[12,0],[22,0],[22,10],[12,10],[12,0]]] } }
  ]};

  const edges = [
    { source:'A', target:'B', value:5 },
    { source:'B', target:'C', value:3 },
    { source:'C', target:'A', value:7 }
  ];

  const progress = [{ label:'Complete', value:72, max:100 }];

  const examples = [
    normalizeSpec({ chartType:'line', title:'Line (switchable)', data: monthly }),
    normalizeSpec({ chartType:'bubble', title:'Bubble (auto size)', data: monthly.map(d => ({ x:+d.sales, y:+d.sales*0.8 + 10, size:+d.sales, group:d.date })) }),
    normalizeSpec({ chartType:'pie', title:'Pie', data: [{ cat:'A', val:30 }, { cat:'B', val:20 }, { cat:'C', val:50 }] }),
    normalizeSpec({ chartType:'donut', title:'Donut', data: [{ region:'North', amount:40 }, { region:'South', amount:25 }, { region:'East', amount:20 }, { region:'West', amount:15 }] }),
    normalizeSpec({ chartType:'geo', title:'Geo', data: geoDemo }),
    normalizeSpec({ chartType:'chord', title:'Chord', data: edges }),
    normalizeSpec({ chartType:'qplot', title:'Q-Q Plot', data: monthly.map(d => ({ a:+d.sales, b:+d.sales*0.9 + (Math.random()*20-10) })) }),
    normalizeSpec({ chartType:'arc', title:'Arc Gauge', data: progress })
  ];

  // Attach compatibility-dropdown to all
  const withDropdown = examples.map(s => {
    s.__controls = { baseData: s?.data?.source?.data };
    return s;
  });

  renderSpecs(withDropdown, '#root');
}

document.addEventListener('DOMContentLoaded', boot);
})();
