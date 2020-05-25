const weights = {
  "ID": {
    ignore: true
  },
  "X": {
    ignore: true
  },
  "Number_of_Modified_Blocks": {
    ignore: false,
    weight: 5,
    label: "Number of modified blocks"
  },
  "Number_of_Affected_Districts": {
    ignore: false,
    weight: 5,
    label: "Number of affected districts"
  },
  "Average_Area_Perimeter_Score": {
    ignore: true
  },
  "Median_Area_Perimeter_Score": {
    ignore: true
  },
  "Minimum_Area_Perimeter_Score": {
    ignore: true
  },
  "Average_Convex_Hull_Score": {
    ignore: false,
    weight: 5,
    label: "Average convex hull score"
  },
  "Median_Convex_Hull_Score": {
    ignore: false,
    weight: 5,
    label: "Median convex hull score"
  },
  "Minimum_Convex_Hull_Score": {
    ignore: true
  },
  "Number_of_Overpopulated_Districts": {
    ignore: false,
    weight: 5,
    label: "Number of overpopulated districts"
  },
  "Average_Population_Size": {
    ignore: false,
    weight: 5,
    label: "Average population size"
  },
  "Median_Population_Size": {
    ignore: false,
    weight: 5,
    label: "Median population size"
  },
  "Standard_Deviation_Population_Size": {
    ignore: false,
    weight: 5,
    label: "Standard deviation population size"
  }
};
const weightKeys = Object.keys(weights);
let distMatrix, data, twoDimensions, distMax;

const width = 500;
const height = 500;
const padding = 25;
let x, y, points;

const svg = d3.select("#map").append("svg")
  .attr("width", width)
  .attr("height", height);

const g = svg.append("g")
  .attr("transform", `translate(${padding}, ${padding})`);

g.append("rect")
  .style("fill", "rgba(0,0,0,0.1)")
  .attr("width", width - 2 * padding)
  .attr("height", width - 2 * padding);

// add background grid
const numLines = 20;

g.append("g").selectAll("line").data(d3.range(numLines)).enter().append("line")
  .attr("y1", 0)
  .attr("y2", height - 2 * padding)
  .attr("x1", (d, i) => (width - 2 * padding) / (numLines + 1) * (i + 1))
  .attr("x2", (d, i) => (width - 2 * padding) / (numLines + 1) * (i + 1))
  .style("stroke", "rgba(255,255,255,0.5)");

g.append("g").selectAll("line").data(d3.range(numLines)).enter().append("line")
  .attr("x1", 0)
  .attr("x2", width - 2 * padding)
  .attr("y1", (d, i) => (height - 2 * padding) / (numLines + 1) * (i + 1))
  .attr("y2", (d, i) => (height - 2 * padding) / (numLines + 1) * (i + 1))
  .style("stroke", "rgba(255,255,255,0.5)");

const dimensions = d3.select("#dimensions ul").selectAll("li").data(weightKeys.filter((d) => !weights[d].ignore)).enter().append("li")
  .on("mouseover", (d) => {
    const rScale = d3.scaleLinear().domain([0,1]).range([3, 10]);
    points.transition().attr("r", (pd) => rScale(pd[d + "_n"]));
  })
  .on("mouseout", (d) => {
    points.transition().attr("r", 5);
  });

const dimensionLabels = dimensions.append("label");

const updateDimensions = () => {
  dimensionLabels.html((d) => `${weights[d].label} (${weights[d].weight})`);
};

dimensions.append("input")
  .attr("type", "range")
  .attr("min", 0)
  .attr("max", 10)
  .attr("value", (d) => weights[d].weight)
  .on("change", (d, i, nodes) => {
    const val = d3.select(nodes[i]).property("value");
    weights[d].weight = val;
    updateDimensions();
    updateData();
  });

dimensions.append("br")

const mWidth = 300;
const mHeight = 75;
const mPadding = 25;
const miniGraphs = dimensions.append("svg")
  .attr("width", mWidth)
  .attr("height", mHeight);

updateDimensions();

d3.select("#map").append("br");
const legendSvg = d3.select("#map").append("svg")
  .style("opacity", 0)
  .attr("width", width)
  .attr("height", 50);

const legendCount = 50;
const legendScale = d3.scaleSequentialSqrt([0, legendCount], d3.interpolateViridis);
legendSvg.append("g")
  .attr("transform", `translate(${padding}, 0)`).selectAll("rect").data(d3.range(legendCount)).enter().append("rect")
    .attr("width", (width - 2 * padding) / legendCount)
    .attr("height", 25)
    .attr("x", (i) => (width - 2 * padding) / legendCount * i)
    .style("fill" , (i) => legendScale(i));

d3.csv("selected_sim_stats.csv")
  .then((csv) => {
    data = csv;

    /*----- Backup weights -----*/
    weightKeys.forEach((key) => {
      if ("weight" in weights[key]) {
        weights[key]["weight_backup"] = weights[key].weight;
      }
    });

    /*----- Normalize columns -----*/
    weightKeys.forEach((key) => {
      if (!weights[key].ignore) {
        data.forEach((d) => {
          d[key] = parseFloat(d[key]);
        });
        weights[key].min = d3.min(data, (d) => d[key]);
        weights[key].max = d3.max(data, (d) => d[key]);
        data.forEach((d) => {
          d[key + "_n"] = (d[key] - weights[key].min) / (weights[key].max - weights[key].min);
        });
      }
    });

    points = g.selectAll("circle").data(data).enter().append("circle")
      .attr("r", 5)
      .style("cursor", "pointer")
      .on("mouseover", (d, pId) => {
        miniGraphs.each((key, i, nodes) => {
          const histo = d3.select(nodes[i]);
          const histoX = d3.scaleLinear().domain(d3.extent(data, (d) => d[key])).range([0, mWidth]);
          histo.select("circle")
            .style("fill", "#E60032")
            .style("stroke", "#fff")
            .attr("cx", histoX(d[key]) + mPadding);
        });

        const colorSeqScale = d3.scaleSequentialSqrt([0, d3.max(distMatrix[pId])], d3.interpolateViridis);
        const colorSeqScaleLegend = d3.scaleSqrt([0, d3.max(distMatrix[pId])], [0, width - 2 * padding]);

        legendSvg.select("#axis").remove();
        legendSvg.append("g")
          .attr("transform", `translate(${padding}, 25)`)
          .attr("id", "axis")
          .call(d3.axisBottom(colorSeqScaleLegend));
        
        legendSvg.style("opacity", 1);

        points.style("fill", (d, i) => {
          return colorSeqScale(distMatrix[pId][i]);
        });
      })
      .on("mouseout", () => {
        miniGraphs.each((key, i, nodes) => {
          const histo = d3.select(nodes[i]);
          histo.select("circle")
            .style("stroke", "transparent")
            .style("fill", "transparent");
        });
        points.style("fill", "#000");
        legendSvg.style("opacity", 0);
      })
      .on("click", (d) => {
        window.location.href = '/app-editor/index.html?model=' + d["X"];
      });

    miniGraphs.each((key, i, nodes) => {
      const histo = d3.select(nodes[i]);
      const histoX = d3.scaleLinear().domain(d3.extent(data, (d) => d[key])).range([0, mWidth]);

      histo.append("g")
        .attr("transform", `translate(${mPadding},${mHeight - mPadding})`)
        .call(d3.axisBottom(histoX));

      const histogram = d3.histogram()
        .domain(histoX.domain())
        .thresholds(20);

      const histoData = [];
      data.forEach((d) => {
        histoData.push(d[key]);
      });
      
      const initBins = histogram(histoData);
      const histoY = d3.scaleLinear().domain([0, d3.max(initBins, (d) => d.length)]).range([mHeight - mPadding, 0]);
    
      histo.append("g")
        .attr("transform", `translate(${mPadding},0)`)
        .call(d3.axisLeft(histoY).ticks(3));
    
      histo.append("g")
        .attr("transform", `translate(${mPadding},${mHeight - mPadding})`)
        .selectAll("rect").data(initBins)
          .enter()
          .append("rect")
            .attr("x", 1)
            .attr("transform", (d) => `translate(${histoX(d.x0)},-${mHeight - mPadding - histoY(d.length)})`)
            .attr("width", (d) => histoX(d.x1) - histoX(d.x0) - 1)
            .attr("height", (d) => mHeight - mPadding - histoY(d.length))
            .style("fill", "#2e91d2");

      histo.append("circle")
        .attr("cy", mHeight - mPadding)
        .attr("r", 5)
        .style("stroke-width", 1)
        .style("stroke", "transparent")
        .style("fill", "transparent");

    });

    updateData();
  })
  .catch((err) => {
    throw err;
  });

const updateData = () => {
  /*----- Calculate distance matrix -----*/
  distMatrix = [];
  data.forEach((d, di) => {
    const row = [];
    data.forEach((dd, ddi) => {
      let distanceSum = 0;
      if (ddi !== di) {
        weightKeys.forEach((key) => {
          if (!weights[key].ignore) {
            distanceSum += Math.abs(d[key + "_n"] - dd[key + "_n"]) * weights[key].weight;
          }
        });
      }
      row.push(distanceSum);
    });
    distMatrix.push(row);
  });

  distMax = d3.max(distMatrix, (d) => d3.max(d));

  /*----- Dimensionality reduction -----*/
  twoDimensions = numeric.transpose(mds.classic(distMatrix));

  x = d3.scaleLinear().range([0, width - 2 * padding]).domain(d3.extent(twoDimensions[0]));
  y = d3.scaleLinear().range([0, height - 2 * padding]).domain(d3.extent(twoDimensions[1]));

  updateGraph();
};

const updateGraph = () => {
  points
    .attr("cx", (d, i) => x(twoDimensions[0][i]))
    .attr("cy", (d, i) => y(twoDimensions[1][i]));
};