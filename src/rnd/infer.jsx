// export function inferSchema(data) {
//   const sample = Array.isArray(data) ? data.slice(0, 1000) : [];
//   if (!sample.length) return [];

//   const fields = Object.keys(sample[0]);
//   return fields.map((field) => {
//     const vals = sample.map((d) => d[field]).filter((v) => v != null);
//     const unique = new Set(vals).size;
//     const allNum = vals.every((v) => typeof v === "number");
//     const allDate = vals.every((v) => !isNaN(Date.parse(v)));
//     return {
//       field,
//       type: allDate
//         ? "temporal"
//         : allNum
//         ? "quantitative"
//         : unique <= 10
//         ? "ordinal"
//         : "nominal",
//       cardinality: unique,
//     };
//   });
// }

// infer.js
export function inferSchema(data) {
  const sample = Array.isArray(data) ? data.slice(0, 1000) : [];
  if (!sample.length) return [];

  const fields = Object.keys(sample[0]);
  return fields.map((field) => {
    const vals = sample.map((d) => d[field]).filter((v) => v != null);

    const uniqueCount = new Set(vals).size;
    const allNum = vals.every((v) => typeof v === "number");
    const allDate = vals.every((v) => !isNaN(Date.parse(v)));

    let type;
    if (allDate) type = "temporal";
    else if (allNum) type = "quantitative";
    else if (uniqueCount <= 10) type = "ordinal";
    else type = "nominal";

    return {
      field,
      type,
      cardinality: uniqueCount,
    };
  });
}
