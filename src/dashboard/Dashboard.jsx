import React, { useState, useEffect, useRef } from "react";
import { Copy } from "lucide-react";
import data from "./Data.json"; // Array of { name, data }

const loadScriptsSequentially = async (urls) => {
  for (const url of urls) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = false; // load in order
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${url}`));
      document.head.appendChild(script);
    });
  }
};

const vegaLiteScriptUrls = [
  "https://cdn.jsdelivr.net/npm/vega@5",
  "https://cdn.jsdelivr.net/npm/vega-lite@5",
  "https://cdn.jsdelivr.net/npm/vega-embed@6",
];

const Dashboard = () => {
  const chartRef = useRef(null);
  const [selectedData, setSelectedData] = useState(data[0]);
  const [customJsonInput, setCustomJsonInput] = useState(
    JSON.stringify(data[0].data, null, 2)
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  // Dynamic chart type inference
  const inferDynamicChartSpec = (data) => {
    if (!Array.isArray(data) || !data.length) {
      throw new Error("Data must be a non-empty array of objects");
    }

    const MAX_POINTS = 5000;
    const sampled = data.length > MAX_POINTS ? data.slice(0, MAX_POINTS) : data;
    const keys = Object.keys(sampled[0]);

    const temporalKeys = keys.filter(
      (k) =>
        typeof sampled[0][k] === "string" && !isNaN(Date.parse(sampled[0][k]))
    );
    const numericKeys = keys.filter((k) => typeof sampled[0][k] === "number");
    const categoricalKeys = keys.filter(
      (k) => typeof sampled[0][k] === "string" && !temporalKeys.includes(k)
    );

    const xField = temporalKeys[0] || categoricalKeys[0];
    const xType = temporalKeys.length ? "temporal" : "ordinal";

    // Bar + line combo
    if (numericKeys.length === 2 && xField) {
      return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "Auto-generated bar + line combo",
        data: { values: sampled },
        layer: [
          {
            mark: { type: "bar", color: "#4C78A8" },
            encoding: {
              x: { field: xField, type: xType },
              y: { field: numericKeys[0], type: "quantitative" },
            },
          },
          {
            mark: { type: "line", color: "#E45756", point: true },
            encoding: {
              x: { field: xField, type: xType },
              y: { field: numericKeys[1], type: "quantitative" },
            },
          },
        ],
      };
    }

    // Multiple lines
    if (numericKeys.length > 2 && temporalKeys.length === 1) {
      return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "Auto-generated multiple lines",
        data: { values: sampled },
        transform: [{ fold: numericKeys, as: ["series", "value"] }],
        mark: "line",
        encoding: {
          x: { field: xField, type: "temporal" },
          y: { field: "value", type: "quantitative" },
          color: { field: "series", type: "nominal" },
        },
      };
    }

    // Scatter plot
    if (numericKeys.length === 2 && !xField) {
      return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "Auto-generated scatter plot",
        data: { values: sampled },
        mark: "point",
        encoding: {
          x: { field: numericKeys[0], type: "quantitative" },
          y: { field: numericKeys[1], type: "quantitative" },
        },
      };
    }

    // Heatmap
    if (categoricalKeys.length >= 2 && numericKeys.length >= 1) {
      return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        description: "Auto-generated heatmap",
        data: { values: sampled },
        mark: "rect",
        encoding: {
          x: { field: categoricalKeys[0], type: "ordinal" },
          y: { field: categoricalKeys[1], type: "ordinal" },
          color: { field: numericKeys[0], type: "quantitative" },
        },
      };
    }

    // Default single series
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      description: "Auto-generated chart",
      data: { values: sampled },
      mark: temporalKeys.length ? "line" : "bar",
      encoding: {
        x: { field: xField, type: xType },
        y: { field: numericKeys[0], type: "quantitative" },
      },
    };
  };

  // Render chart
  //   const renderChart = async (input) => {
  //     if (!window.vegaEmbed) return;
  //     let spec;

  //     if (
  //       input &&
  //       typeof input === "object" &&
  //       (input.$schema || input.mark || input.layer)
  //     ) {
  //       spec = input;
  //     } else if (Array.isArray(input)) {
  //       spec = inferDynamicChartSpec(input);
  //     } else {
  //       throw new Error(
  //         "Invalid input: must be Vega-Lite spec or array of objects"
  //       );
  //     }

  //     chartRef.current.innerHTML = "";
  //     await window.vegaEmbed(chartRef.current, spec, { actions: false });
  //   };

  const renderChart = async (input) => {
    if (!window.vegaEmbed) return;
    let spec;

    if (
      input &&
      typeof input === "object" &&
      (input.$schema || input.mark || input.layer)
    ) {
      spec = input;
    } else if (Array.isArray(input)) {
      spec = inferDynamicChartSpec(input);
    } else {
      throw new Error(
        "Invalid input: must be Vega-Lite spec or array of objects"
      );
    }

    // ✅ Make chart responsive to container size
    spec.width = "container";
    spec.height = "container";
    spec.autosize = { type: "fit", contains: "padding" };

    chartRef.current.innerHTML = "";
    await window.vegaEmbed(chartRef.current, spec, { actions: false });
  };

  // Load scripts in order
  useEffect(() => {
    (async () => {
      try {
        await loadScriptsSequentially(vegaLiteScriptUrls);
        setScriptsLoaded(true);
      } catch (err) {
        console.error(err);
        setError("Failed to load charting libraries.");
      }
    })();
  }, []);

  // Render chart when dataset changes
  useEffect(() => {
    if (scriptsLoaded && selectedData) {
      setCustomJsonInput(JSON.stringify(selectedData.data, null, 2));
      renderChart(selectedData.data);
    }
  }, [scriptsLoaded, selectedData]);

  // Render chart live when textarea changes
  useEffect(() => {
    if (!scriptsLoaded) return;
    try {
      const parsed = JSON.parse(customJsonInput);
      renderChart(parsed);
      setError(null);
    } catch {
      // Ignore parsing errors until user fixes input
    }
  }, [customJsonInput]);

  return (
    <div className="flex flex-col sm:flex-row gap-8 p-6">
      {/* Left: Chart + JSON Input */}
      <div className="flex-1 flex flex-col gap-4">
        <h1 className="text-xl font-bold">Dynamic Data visualization</h1>
        {/* <div className="bg-gray-100 p-4 rounded-lg min-h-[300px] flex items-center justify-center">
          {scriptsLoaded ? (
            <div ref={chartRef} className="w-full h-[300px]" />
          ) : (
            <p>Loading chart libraries...</p>
          )}
        </div> */}
        <div className="bg-gray-100 p-4 rounded-lg flex-1 flex items-center justify-center">
          {scriptsLoaded ? (
            <div ref={chartRef} className="w-full h-full" />
          ) : (
            <p>Loading chart libraries...</p>
          )}
        </div>
        <textarea
          className="w-full h-[45vh] border p-2 font-mono"
          value={customJsonInput}
          onChange={(e) => setCustomJsonInput(e.target.value)}
        />
        {error && <div className="text-red-500">{error}</div>}
      </div>

      {/* Right: Dropdown + Data Preview */}
      <div className="flex-1 flex flex-col gap-4">
        <h2 className="font-bold">Predefined Data</h2>
        <select
          className="border p-2"
          value={selectedData?.name}
          onChange={(e) => {
            const item = data.find((d) => d.name === e.target.value);
            setSelectedData(item);
          }}
        >
          {data.map((d, idx) => (
            <option key={idx} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
        <div className="h-[80vh] relative bg-black text-white p-4 rounded-lg min-h-[300px] overflow-auto">
          <pre>{customJsonInput}</pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(customJsonInput);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="absolute top-2 right-2 bg-blue-500 px-2 py-1 rounded"
          >
            <Copy size={16} />
          </button>
          {copied && (
            <span className="absolute bottom-2 right-2 text-green-400">
              Copied!
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
