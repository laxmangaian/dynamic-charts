// import React, { useEffect, useRef } from "react";
// import * as d3 from "d3";

// const Dashboard = ({ charts }) => {
//   const refs = useRef([]);

//   useEffect(() => {
//     charts.forEach((schema, i) => {
//       renderChart(schema, refs.current[i]);
//     });
//   }, [charts]);

//   const renderChart = async (schema, container) => {
//     // Clear container before rendering
//     d3.select(container).selectAll("*").remove();

//     const { width, height, margin, chartType, data, marks, animation, style, chartSpecific } = schema;
//     let dataset = [];

//     // Load data (inline or URL)
//     if (data[0]?.values) {
//       dataset = data[0].values;
//     } else if (data[0]?.url) {
//       const format = data[0].format || "json";
//       if (format === "csv") dataset = await d3.csv(data[0].url);
//       else if (format === "tsv") dataset = await d3.tsv(data[0].url);
//       else dataset = await d3.json(data[0].url);
//     }

//     const svg = d3
//       .select(container)
//       .append("svg")
//       .attr("width", width)
//       .attr("height", height)
//       .style("background-color", style?.backgroundColor || "#fff");

//     const g = svg.append("g").attr(
//       "transform",
//       `translate(${margin.left || 0}, ${margin.top || 0})`
//     );

//     // Generic scale setup
//     const xScale = d3
//       .scaleBand()
//       .domain(dataset.map((d) => d.x))
//       .range([0, width - (margin.left || 0) - (margin.right || 0)])
//       .padding(0.1);

//     const yScale = d3
//       .scaleLinear()
//       .domain([0, d3.max(dataset, (d) => +d.y)])
//       .range([height - (margin.top || 0) - (margin.bottom || 0), 0]);

//     // Chart type handling
//     if (chartType === "bar") {
//       g.selectAll(".bar")
//         .data(dataset)
//         .enter()
//         .append("rect")
//         .attr("class", "bar")
//         .attr("x", (d) => xScale(d.x))
//         .attr("y", (d) => yScale(d.y))
//         .attr("width", xScale.bandwidth())
//         .attr("height", (d) => height - (margin.top || 0) - (margin.bottom || 0) - yScale(d.y))
//         .attr("fill", style?.fill || "steelblue")
//         .transition()
//         .duration(animation?.duration || 1000)
//         .ease(d3[animation?.ease || "easeCubicInOut"])
//         .attr("opacity", style?.opacity ?? 1);
//     }

//     else if (chartType === "line") {
//       const line = d3
//         .line()
//         .x((d) => xScale(d.x) + xScale.bandwidth() / 2)
//         .y((d) => yScale(d.y))
//         .curve(d3[chartSpecific?.line?.curve || "curveLinear"]);

//       g.append("path")
//         .datum(dataset)
//         .attr("fill", "none")
//         .attr("stroke", style?.stroke || "steelblue")
//         .attr("stroke-width", style?.strokeWidth || 2)
//         .attr("d", line);
//     }

//     else if (chartType === "pie") {
//       const radius = Math.min(width, height) / 2;
//       const pie = d3.pie().value((d) => d.y);
//       const arc = d3.arc().innerRadius(chartSpecific?.pie?.innerRadius || 0).outerRadius(radius);

//       const pieGroup = g
//         .attr("transform", `translate(${width / 2},${height / 2})`)
//         .selectAll("arc")
//         .data(pie(dataset))
//         .enter()
//         .append("g");

//       pieGroup
//         .append("path")
//         .attr("d", arc)
//         .attr("fill", (d, i) => style?.colors?.[i] || d3.schemeCategory10[i % 10]);
//     }

//     else if (chartType === "scatter") {
//       g.selectAll("circle")
//         .data(dataset)
//         .enter()
//         .append("circle")
//         .attr("cx", (d) => xScale(d.x) + xScale.bandwidth() / 2)
//         .attr("cy", (d) => yScale(d.y))
//         .attr("r", chartSpecific?.scatter?.size || 5)
//         .attr("fill", style?.fill || "orange");
//     }

//     // Axes
//     g.append("g")
//       .attr("transform", `translate(0,${height - (margin.top || 0) - (margin.bottom || 0)})`)
//       .call(d3.axisBottom(xScale));

//     g.append("g").call(d3.axisLeft(yScale));
//   };

//   return (
//     <div>
//       {charts.map((_, i) => (
//         <div key={i} ref={(el) => (refs.current[i] = el)} />
//       ))}
//     </div>
//   );
// };

// export default Dashboard;

// ------------------------

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const Dashboard = ({ charts }) => {
  const refs = useRef([]);

  useEffect(() => {
    charts.forEach((schema, i) => {
      renderChart(schema, refs.current[i]);
    });
  }, [charts]);

  const loadData = async (dataConfig) => {
    if (dataConfig.values) return dataConfig.values;
    if (dataConfig.url) {
      const format = dataConfig.format || "json";
      if (format === "csv") return await d3.csv(dataConfig.url);
      if (format === "tsv") return await d3.tsv(dataConfig.url);
      return await d3.json(dataConfig.url);
    }
    return [];
  };

  const renderChart = async (schema, container) => {
    d3.select(container).selectAll("*").remove();

    const { width, height, margin, data, marks, animation, facet } = schema;

    // Load datasets into map
    const datasetMap = {};
    for (const d of data) datasetMap[d.name] = await loadData(d);

    // Faceting (simple example: loop through unique values)
    let facetValues = [null];
    if (facet?.field && facet?.data) {
      facetValues = [
        ...new Set(datasetMap[facet.data].map((d) => d[facet.field])),
      ];
    }

    facetValues.forEach((facetValue, idx) => {
      const svg = d3
        .select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr(
          "transform",
          `translate(${margin?.left || 0},${margin?.top || 0})`
        );

      marks.forEach((mark) => {
        const dataset = datasetMap[mark.from.data].filter(
          (d) => !facetValue || d[facet.field] === facetValue
        );
        drawMark(svg, mark, dataset, width, height, margin, animation);
      });
    });
  };

  const drawMark = (svg, mark, dataset, width, height, margin, animation) => {
    switch (mark.type) {
      case "rect": {
        // Bar
        const x = d3
          .scaleBand()
          .domain(dataset.map((d) => d.x))
          .range([0, width - margin.left - margin.right])
          .padding(0.1);
        const y = d3
          .scaleLinear()
          .domain([0, d3.max(dataset, (d) => +d.y)])
          .range([height - margin.top - margin.bottom, 0]);
        svg
          .selectAll("rect")
          .data(dataset)
          .enter()
          .append("rect")
          .attr("x", (d) => x(d.x))
          .attr("y", (d) => y(d.y))
          .attr("width", x.bandwidth())
          .attr("height", (d) => height - margin.top - margin.bottom - y(d.y))
          .attr("fill", mark.style?.fill || "steelblue")
          .transition()
          .duration(animation?.duration || 1000)
          .ease(d3[animation?.ease || "easeCubicInOut"]);
        break;
      }

      case "line": {
        const xLine = d3
          .scalePoint()
          .domain(dataset.map((d) => d.x))
          .range([0, width - margin.left - margin.right]);
        const yLine = d3
          .scaleLinear()
          .domain([0, d3.max(dataset, (d) => +d.y)])
          .range([height - margin.top - margin.bottom, 0]);
        const line = d3
          .line()
          .x((d) => xLine(d.x))
          .y((d) => yLine(d.y))
          .curve(d3[mark.chartSpecific?.line?.curve || "curveLinear"]);
        svg
          .append("path")
          .datum(dataset)
          .attr("fill", "none")
          .attr("stroke", mark.style?.stroke || "black")
          .attr("stroke-width", mark.style?.strokeWidth || 2)
          .attr("d", line);
        break;
      }

      case "pie": {
        const radius = Math.min(width, height) / 2;
        const pie = d3.pie().value((d) => d.y);
        const arc = d3
          .arc()
          .innerRadius(mark.chartSpecific?.pie?.innerRadius || 0)
          .outerRadius(radius);
        const pieGroup = svg
          .attr("transform", `translate(${width / 2},${height / 2})`)
          .selectAll("arc")
          .data(pie(dataset))
          .enter()
          .append("g");
        pieGroup
          .append("path")
          .attr("d", arc)
          .attr(
            "fill",
            (d, i) => mark.style?.colors?.[i] || d3.schemeCategory10[i % 10]
          );
        break;
      }

      case "scatter": {
        const xScatter = d3
          .scaleLinear()
          .domain(d3.extent(dataset, (d) => +d.x))
          .range([0, width - margin.left - margin.right]);
        const yScatter = d3
          .scaleLinear()
          .domain(d3.extent(dataset, (d) => +d.y))
          .range([height - margin.top - margin.bottom, 0]);
        svg
          .selectAll("circle")
          .data(dataset)
          .enter()
          .append("circle")
          .attr("cx", (d) => xScatter(d.x))
          .attr("cy", (d) => yScatter(d.y))
          .attr("r", mark.chartSpecific?.scatter?.size || 5)
          .attr("fill", mark.style?.fill || "orange");
        break;
      }

      case "geoPath": {
        const projection = d3[
          mark.chartSpecific?.geo?.projection || "geoMercator"
        ]().fitSize([width, height], dataset);
        const path = d3.geoPath().projection(projection);
        svg
          .selectAll("path")
          .data(dataset.features)
          .enter()
          .append("path")
          .attr("d", path)
          .attr("fill", mark.style?.fill || "#ccc")
          .attr("stroke", mark.style?.stroke || "#333");
        break;
      }

      case "force": {
        const simulation = d3
          .forceSimulation(dataset.nodes)
          .force(
            "link",
            d3
              .forceLink(dataset.links)
              .id((d) => d.id)
              .distance(mark.chartSpecific?.force?.linkDistance || 50)
          )
          .force(
            "charge",
            d3
              .forceManyBody()
              .strength(mark.chartSpecific?.force?.charge || -50)
          )
          .force(
            "center",
            d3.forceCenter(
              (width - margin.left - margin.right) / 2,
              (height - margin.top - margin.bottom) / 2
            )
          );

        const link = svg
          .append("g")
          .selectAll("line")
          .data(dataset.links)
          .enter()
          .append("line")
          .attr("stroke", "#999");

        const node = svg
          .append("g")
          .selectAll("circle")
          .data(dataset.nodes)
          .enter()
          .append("circle")
          .attr("r", 5)
          .attr("fill", "steelblue");

        simulation.on("tick", () => {
          link
            .attr("x1", (d) => d.source.x)
            .attr("y1", (d) => d.source.y)
            .attr("x2", (d) => d.target.x)
            .attr("y2", (d) => d.target.y);
          node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
        });
        break;
      }

      case "treemap": {
        const root = d3.hierarchy(dataset).sum((d) => d.value);
        d3
          .treemap()
          .size([
            width - margin.left - margin.right,
            height - margin.top - margin.bottom,
          ])
          .padding(mark.chartSpecific?.treemap?.paddingInner || 1)(root);
        svg
          .selectAll("rect")
          .data(root.leaves())
          .enter()
          .append("rect")
          .attr("x", (d) => d.x0)
          .attr("y", (d) => d.y0)
          .attr("width", (d) => d.x1 - d.x0)
          .attr("height", (d) => d.y1 - d.y0)
          .attr("fill", mark.style?.fill || "steelblue");
        break;
      }

      case "hexbin": {
        const hexbin = d3
          .hexbin()
          .radius(mark.chartSpecific?.hexbin?.radius || 20)
          .extent([
            [0, 0],
            [
              width - margin.left - margin.right,
              height - margin.top - margin.bottom,
            ],
          ]);
        const hexData = hexbin(dataset.map((d) => [d.x, d.y]));
        svg
          .append("g")
          .selectAll("path")
          .data(hexData)
          .enter()
          .append("path")
          .attr("d", hexbin.hexagon())
          .attr("transform", (d) => `translate(${d.x},${d.y})`)
          .attr("fill", mark.style?.fill || "teal");
        break;
      }

      case "chord": {
        const chord = d3
          .chord()
          .padAngle(mark.chartSpecific?.chord?.padAngle || 0.05);
        const chords = chord(dataset);
        const ribbon = d3.ribbon();
        svg
          .append("g")
          .selectAll("path")
          .data(chords)
          .enter()
          .append("path")
          .attr("d", ribbon)
          .attr("fill", mark.style?.fill || "steelblue")
          .attr("stroke", mark.style?.stroke || "#000");
        break;
      }

      default:
        console.warn(`Unknown mark type: ${mark.type}`);
    }
  };

  return (
    <div>
      {charts.map((_, i) => (
        <div key={i} ref={(el) => (refs.current[i] = el)} />
      ))}
    </div>
  );
};

export default Dashboard;
