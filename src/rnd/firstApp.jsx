// import React, { useState } from "react";
// import embed from "vega-embed";
// import { inferSchema } from "./rnd/infer";
// import { chooseMark } from "./rnd/choose";
// import { makeSpec } from "./rnd/makeSpec";
// import defaultData from "./data.json";
// import SelectData from "./dropdown/SelectData";

// export default function Appxxx() {
//   const [source, setSource] = useState("default"); // "default" | "upload"
//   const [uploadedFile, setUploadedFile] = useState(null);
//   const [error, setError] = useState(null);

//   const handleGenerate = async () => {
//     setError(null);

//     try {
//       // 1. Load JSON
//       let dataArray =
//         source === "default"
//           ? defaultData
//           : uploadedFile
//           ? JSON.parse(await uploadedFile.text())
//           : null;

//       if (!Array.isArray(dataArray)) {
//         setError("JSON root must be an array of objects.");
//         return;
//       }

//       // 2. Infer schema
//       const schema = inferSchema(dataArray);

//       // 3. Convert date-strings to Date objects if needed
//       const timeField = schema.find((f) => f.type === "temporal")?.field;
//       if (timeField) {
//         dataArray = dataArray.map((d) => ({
//           ...d,
//           [timeField]: new Date(d[timeField]),
//         }));
//       }

//       // 4. Pick mark, build spec, render
//       const mark = chooseMark(schema) || "bar";
//       const spec = makeSpec(dataArray, schema, mark);

//       await embed("#vis", spec, { actions: false });
//     } catch (err) {
//       setError(err.message);
//     }
//   };

//   return (
//     // <div style={{ padding: 20, fontFamily: "sans-serif" }}>
//     //   <h1>Dynamic Vega-Lite Dashboard</h1>

//     //   <fieldset style={{ marginBottom: 16 }}>
//     //     <legend>Data Source</legend>
//     //     <label style={{ marginRight: 12 }}>
//     //       <input
//     //         type="radio"
//     //         name="source"
//     //         value="default"
//     //         checked={source === "default"}
//     //         onChange={() => setSource("default")}
//     //       />{" "}
//     //       Default Data
//     //     </label>
//     //     <label>
//     //       <input
//     //         type="radio"
//     //         name="source"
//     //         value="upload"
//     //         checked={source === "upload"}
//     //         onChange={() => setSource("upload")}
//     //       />{" "}
//     //       Upload File
//     //     </label>
//     //   </fieldset>

//     //   {source === "upload" && (
//     //     <div style={{ marginBottom: 16 }}>
//     //       <input
//     //         type="file"
//     //         accept=".json"
//     //         onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
//     //       />
//     //     </div>
//     //   )}

//     //   <button
//     //     onClick={handleGenerate}
//     //     style={{
//     //       padding: "8px 16px",
//     //       background: "#007acc",
//     //       color: "white",
//     //       border: "none",
//     //       borderRadius: 4,
//     //       cursor: "pointer",
//     //     }}
//     //   >
//     //     Generate Chart
//     //   </button>

//     //   {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}

//     //   <div id="vis" style={{ marginTop: 24 }}></div>
//     // </div>
//     // <SelectData/>
//   );
// }
