// export function makeSpec(data, schema, mark) {
//   const spec = {
//     $schema: "https://vega.github.io/schema/vega-lite/v5.json",
//     data: { values: data },
//     mark,
//     encoding: {},
//   };

//   if (mark === "histogram") {
//     const xField = schema.find((f) => f.type === "quantitative").field;
//     spec.encoding.x = { field: xField, bin: true, type: "quantitative" };
//     spec.encoding.y = { aggregate: "count", type: "quantitative" };
//   } else if (mark === "line") {
//     const t = schema.find((f) => f.type === "temporal").field;
//     const q = schema.find((f) => f.type === "quantitative").field;
//     spec.encoding.x = { field: t, type: "temporal" };
//     spec.encoding.y = { field: q, type: "quantitative" };
//   } else if (mark === "bar") {
//     const cat = schema.find((f) => f.type !== "quantitative").field;
//     const q = schema.find((f) => f.type === "quantitative").field;
//     spec.encoding.x = { field: cat, type: "ordinal" };
//     spec.encoding.y = { field: q, type: "quantitative" };
//   } else if (mark === "point") {
//     const [q1, q2] = schema
//       .filter((f) => f.type === "quantitative")
//       .map((f) => f.field);
//     spec.encoding.x = { field: q1, type: "quantitative" };
//     spec.encoding.y = { field: q2, type: "quantitative" };
//   } else {
//     // fallback: show table
//     spec.mark = "text";
//     spec.encoding.text = { field: schema[0].field, type: schema[0].type };
//   }

//   return spec;
// }

// makeSpec.js
export function makeSpec(data, schema, mark) {
  const spec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    data: { values: data },
    mark,
    encoding: {},
  };

  if (mark === "histogram") {
    const xField = schema.find((f) => f.type === "quantitative").field;
    spec.encoding.x = { field: xField, bin: true, type: "quantitative" };
    spec.encoding.y = { aggregate: "count", type: "quantitative" };
  } else if (mark === "line" || mark === "area") {
    const tField = schema.find((f) => f.type === "temporal").field;
    const qField = schema.find((f) => f.type === "quantitative").field;

    spec.encoding.x = { field: tField, type: "temporal" };
    spec.encoding.y = { field: qField, type: "quantitative" };

    if (mark === "area") {
      spec.mark = { type: "area", interpolate: "monotone" };
    }
  } else if (mark === "bar") {
    const catField = schema.find((f) => f.type !== "quantitative").field;
    const qField = schema.find((f) => f.type === "quantitative").field;
    spec.encoding.x = { field: catField, type: "ordinal" };
    spec.encoding.y = { field: qField, type: "quantitative" };
  } else if (mark === "point") {
    const [q1, q2] = schema
      .filter((f) => f.type === "quantitative")
      .map((f) => f.field);
    spec.encoding.x = { field: q1, type: "quantitative" };
    spec.encoding.y = { field: q2, type: "quantitative" };
  } else if (mark === "arc") {
    // pie chart
    const catField = schema.find((f) => f.type !== "quantitative").field;
    const numField = schema.find((f) => f.type === "quantitative").field;

    spec.mark = { type: "arc", outerRadius: 100 };
    spec.encoding.theta = {
      field: numField,
      type: "quantitative",
      stack: true,
    };
    spec.encoding.color = { field: catField, type: "nominal" };
  } else {
    // fallback to simple text list
    spec.mark = "text";
    spec.encoding.text = { field: schema[0].field, type: schema[0].type };
  }

  return spec;
}
