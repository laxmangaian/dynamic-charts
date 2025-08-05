// export function chooseMark(schema) {
//   const quant = schema.filter((f) => f.type === "quantitative");
//   const time = schema.filter((f) => f.type === "temporal");
//   const cat = schema.filter(
//     (f) => f.type === "ordinal" || f.type === "nominal"
//   );

//   if (quant.length === 1 && !time.length && !cat.length) return "histogram";
//   if (time.length === 1 && quant.length === 1) return "line";
//   if (cat.length === 1 && quant.length === 1) return "bar";
//   if (quant.length === 2) return "point";
//   return null;
// }

// chooseMark.js

// choose.js
export function chooseMark(schema) {
  const quant = schema.filter((f) => f.type === "quantitative");
  const time = schema.filter((f) => f.type === "temporal");
  const cat = schema.filter(
    (f) => f.type === "ordinal" || f.type === "nominal"
  );

  // Only numbers → histogram
  if (quant.length === 1 && !time.length && !cat.length) {
    return "histogram";
  }

  // Time + number → line (or area)
  if (time.length === 1 && quant.length === 1) {
    // if you prefer a filled chart for long time series, switch to `"area"`
    return "line";
  }

  // Categorical + number → bar, or pie if few categories
  if (cat.length === 1 && quant.length === 1) {
    const c = schema.find((f) => f.type !== "quantitative");
    return c.cardinality <= 6 ? "arc" : "bar";
  }

  // Two numbers → scatter
  if (quant.length === 2) {
    return "point";
  }

  // Fallback
  return null;
}
