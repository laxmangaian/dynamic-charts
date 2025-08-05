// import React, { useState, useEffect } from "react";

// const CommitHistory = ({ owner = "gaiangroup", repo = "cms-dita.git" }) => {
//   const [commits, setCommits] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     const fetchCommits = async () => {
//       try {
//         const response = await fetch(
//           `https://api.github.com/repos/${owner}/${repo}/commits`
//         );

//         if (!response.ok) {
//           throw new Error(
//             `Failed to fetch commits: ${response.status} ${response.statusText}`
//           );
//         }

//         const data = await response.json();
//         setCommits(data);
//       } catch (e) {
//         setError(e.message);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchCommits();
//   }, [owner, repo]); 

//   if (loading) {
//     return <div>Loading commit history...</div>;
//   }

//   if (error) {
//     return <div>Error: {error}</div>;
//   }

//   return (
//     <div>
//       <h2>
//         Commit History for {owner}/{repo}
//       </h2>
//       <pre>
//         <code>{JSON.stringify(commits, null, 2)}</code>
//       </pre>
//     </div>
//   );
// };

// export default CommitHistory;



//  =========== Below is the app.jsx 

// import React, { useState } from "react";
// import embed from "vega-embed";
// import { inferSchema } from "./infer";
// import { chooseMark } from "./choose";
// import { makeSpec } from "./makeSpec";

// export default function App() {
//   const [error, setError]       = useState(null);
//   const [owner, setOwner]       = useState("");
//   const [repo,  setRepo]        = useState("");

//   // ————————————— File Upload Handler —————————————
//   const handleFile = async e => {
//     setError(null);
//     const file = e.target.files?.[0];
//     if (!file) return;

//     try {
//       const text = await file.text();
//       const data = JSON.parse(text);
//       if (!Array.isArray(data)) {
//         setError("JSON root must be an array of objects.");
//         return;
//       }
//       const schema = inferSchema(data);
//       const mark   = chooseMark(schema) || "bar";
//       const spec   = makeSpec(data, schema, mark);

//       embed("#vis", spec, { actions: false })
//         .catch(err => setError(err.message));
//     }
//     catch (err) {
//       setError(err.message);
//     }
//   };

//   // ————————————— GitHub Commits Handler —————————————
//   const handleGitPull = async () => {
//     setError(null);

//     if (!owner || !repo) {
//       setError("Please enter both owner and repo.");
//       return;
//     }

//     try {
//       const res = await fetch(
//         `https://api.github.com/repos/${owner}/${repo}/commits`
//       );
//       if (!res.ok) {
//         throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
//       }
//       const commits = await res.json();
//       // aggregate by date (YYYY-MM-DD)
//       const counts = commits.reduce((acc, { commit }) => {
//         const day = new Date(commit.author.date)
//           .toISOString().slice(0, 10);
//         acc[day] = (acc[day] || 0) + 1;
//         return acc;
//       }, {});
//       const data = Object.entries(counts)
//         .map(([date, count]) => ({ date, count }))
//         .sort((a, b) => a.date.localeCompare(b.date));

//       // infer + choose + render
//       const schema = inferSchema(data);
//       const mark   = chooseMark(schema) || "line";
//       const spec   = makeSpec(data, schema, mark);

//       embed("#vis", spec, { actions: false })
//         .catch(err => setError(err.message));
//     }
//     catch (err) {
//       setError(err.message);
//     }
//   };

//   return (
//     <div style={{ padding: 20 }}>
//       <h1>Dynamic Vega-Lite Dashboard</h1>

//       <section>
//         <h2>📁 Upload JSON File</h2>
//         <input
//           type="file"
//           accept=".json"
//           onChange={handleFile}
//         />
//       </section>

//       <hr/>

//       <section>
//         <h2>🐙 Fetch GitHub Commits</h2>
//         <div style={{ marginBottom: 8 }}>
//           <input
//             type="text"
//             placeholder="owner (e.g. facebook)"
//             value={owner}
//             onChange={e => setOwner(e.target.value)}
//             style={{ marginRight: 8, padding: 4 }}
//           />
//           <input
//             type="text"
//             placeholder="repo (e.g. react)"
//             value={repo}
//             onChange={e => setRepo(e.target.value)}
//             style={{ marginRight: 8, padding: 4 }}
//           />
//           <button onClick={handleGitPull} style={{ padding: "4px 12px" }}>
//             Get Commits
//           </button>
//         </div>
//       </section>

//       {error && (
//         <p style={{ color: "red" }}>
//           ⚠️ {error}
//         </p>
//       )}

//       <div id="vis" style={{ marginTop: 20 }}></div>
//     </div>
//   );
// }



// ==========================


