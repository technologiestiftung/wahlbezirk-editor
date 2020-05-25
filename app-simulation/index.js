const w = 700;
const h = 700;
const limit = 2500;
const problems = ["07608", "07609", "07614", "07613"];
let optimization_state = "stop";

// either go completely random: false, or try to further optimize: true
const optimization_improve = false;

d3.select("#actions").append("a").html("<span class=\"icon\">&olarr;</span>&nbsp;reset&nbsp;optimization")
  .on("click", () => {
    location.reload();
  });

d3.select("#actions").append("a").html("<span class=\"icon\">&squf;</span>&nbsp;stop&nbsp;optimization")
  .on("click", () => {
    if (optimization_state === "running") {
      optimization_state = "pause";
    }
  });

d3.select("#actions").append("a").html("<span class=\"icon\">&rtrif;</span>&nbsp;start&nbsp;optimization")
  .on("click", () => {
    if (optimization_state === "stop") {
      optimization_state = "running";
      optimization();
    }
  });

  const svg = d3.select("#map").append("svg").attr("id", "map")
  .attr("preserveAspectRatio", "xMinYMin meet")
  .attr("viewBox", "0 0 " + w + " " + h);
  
const list = d3.select("#list").append("ul");
let listItems;

const stateSvg = d3.select("#progress").append("svg");

const projection = d3.geoMercator().translate([w/2, h/2]).scale(180000);
const path = d3.geoPath().projection(projection);

let mapPath;
let init = true;
let data;

const node_map = {};
const district_map = {};
let districts = [];
const district_colors = d3.scaleOrdinal(d3.schemeCategory10);
const list_color = d3.scaleLinear().range(['rgb(255,255,255)','rgb(255,0,0)']);

const states = [];

const update = () => {
  if (init) {
    init = false;
    projection.center(turf.center(data).geometry.coordinates);
    mapPath = svg.append("g").selectAll("path")
      .data(data.features)
      .enter()
      .append("path")
      .attr("class","block")
      .attr("id", (d) => "blknr_" + d.properties.blknr_copy)
      .attr("d", path);
    
    
    data.features.forEach((feature, i) => {
      node_map[feature.properties.blknr_copy] = i;
      feature.properties["centroid"] = turf.centroid(feature);
      if (!(feature.properties["UWB"] in district_map)) {
        district_map[feature.properties["UWB"]] = districts.length
        districts.push({
          id: feature.properties["UWB"],
          population: 0,
          num_blocks: 0,
          blocks: []
        });
      }
      districts[district_map[feature.properties["UWB"]]].population += feature.properties["Insgesamt"];
      districts[district_map[feature.properties["UWB"]]].num_blocks += 1;
      districts[district_map[feature.properties["UWB"]]].blocks.push(feature.properties.blknr_copy);
    });

    list_color.domain([limit, d3.max(districts, (d) => d.population)]);

    listItems = list.selectAll("li").data(districts).enter().append("li");

    const lines = svg.append("g");

    data.features.forEach((feature) => {
      if (Array.isArray(feature.properties.neighbor_blocks)){
        // cool already done
      } else {
        if (feature.properties.neighbor_blocks !== null) {
          feature.properties.neighbor_blocks = feature.properties.neighbor_blocks.split(",");
        } else {
          feature.properties.neighbor_blocks = [];
        }
      }

      const p1 = projection(feature.properties.centroid.geometry.coordinates);
      feature.properties.neighbor_blocks.forEach((neighbor) => {
        const p2 = projection(data.features[node_map[neighbor]].properties.centroid.geometry.coordinates);
        lines.append("line")
          .attr("x1", p1[0])
          .attr("x2", p2[0])
          .attr("y1", p1[1])
          .attr("y2", p2[1]);
      });
    });
  }

  mapPath.data(data.features)
    .classed("full", (d) => districts[district_map[d.properties["UWB"]]].population > limit)
    .classed("single", (d) => districts[district_map[d.properties["UWB"]]].num_blocks === 1)
    .classed("big", (d) => d.properties["Insgesamt"] > limit)
    .style("fill", (d) => district_colors(d.properties["UWB"]));
  
  listItems.data(districts)
    .classed("full", (d) => d.population > limit)
    .classed("single", (d) => d.num_blocks === 1 || problems.includes(d.id) )
    .style("background-color", (d) => list_color(d.population))
    .html((d) => `${d.id}: ${d.population}`)
    .on("mouseover", (d) => {
      d.blocks.forEach((block) => {
        d3.select("#blknr_" + block).classed("hover", true);
      });
    })
    .on("mouseout", (d) => {
      mapPath.classed("hover", false);
    });
};

// http://stackoverflow.com/questions/962802#962890
const shuffledList = (count) => {
  var array = [];
  for (i = 0; i<count; i+=1) {
    array.push(i);
  }

  var tmp, current, top = array.length;
  if(top) while(--top) {
    current = Math.floor(Math.random() * (top + 1));
    tmp = array[current];
    array[current] = array[top];
    array[top] = tmp;
  }
  return array;
}

const clusterDistrict = (remove_id, district_id, cluster) => {
  let cluster_size = 0;

  while (cluster_size < cluster.length) {
    cluster_size = cluster.length;
    cluster.forEach((block_id) => {
      data.features[node_map[block_id]].properties.neighbor_blocks.forEach((neighbor) => {
        if (!cluster.includes(neighbor) && remove_id !== neighbor && data.features[node_map[neighbor]].properties["UWB"] === district_id) {
          cluster.push(neighbor);
        }
      });
    });
  }

  return cluster;
};

const isCandidate = (block_id, district_id) => {
  const block = data.features[node_map[block_id]];
  if (block.properties.neighbor_blocks.length > 0) {
    // check if this node has other neighboring districts
    const neighbors = block.properties.neighbor_blocks;
    let has_other_neighbors = false;
    neighbors.forEach((neighbor) => {
      if (data.features[node_map[neighbor]].properties["UWB"] !== district_id) {
        has_other_neighbors = true;
      }
    });
    if (has_other_neighbors) {
      // check if there are blocks within this district that depend only on this block
      let is_independent = true;
      neighbors.forEach((neighbor) => {
        if (data.features[node_map[neighbor]].properties["UWB"] === district_id) {
          let same_neighbors = 0;
          const next_neighbors = data.features[node_map[neighbor]].properties.neighbor_blocks;
          next_neighbors.forEach((next_neighbor) => {
            if (next_neighbor != block_id && data.features[node_map[neighbor]].properties["UWB"] === district_id) {
              same_neighbors += 1;
            }
          });
          if (same_neighbors === 0) {
            is_independent = false;
          }
        }
      });

      // check if the district is being split apart when this block is removed
      const cluster_start = districts[district_map[district_id]].blocks.filter((d) => d != block_id)[0];
      const cluster = clusterDistrict(block_id, district_id, [cluster_start]);
      if (cluster.length !== districts[district_map[district_id]].blocks.length - 1) {
        is_independent = false;
      }

      if (is_independent) {
        return true;
      }
    }
  }

  return false;
};

const optimization = () => {
  let changes = 0;
  districts.forEach((district) => {
    if (district.population > limit && !problems.includes(district.id)) {
      let selected = false;
      let ids = shuffledList(district.blocks.length);
      for (let i = 0; i < ids.length && !selected; i += 1) {
        if (isCandidate(district.blocks[ids[i]], district.id)) {
          selected = true;

          const block_id = district.blocks[ids[i]];

          // get neighbor districts
          const population = data.features[node_map[block_id]].properties["Insgesamt"];
          const neighbor_districts = [...new Set(data.features[node_map[block_id]].properties.neighbor_blocks.filter((d) => data.features[node_map[d]].properties["UWB"] != district.id)
            .map((d) => data.features[node_map[d]].properties["UWB"]))];
          
          // remove from current district
          const bindex = district.blocks.indexOf(block_id);
          district.blocks.splice(bindex, 1);
          district.population -= population;

          // calculate the smallest damage
          let smallest_damage = Number.MAX_VALUE;
          let smallest_damage_id = null;
          neighbor_districts.forEach((neighbor) => {
            damage = districts[district_map[neighbor]].population + population - limit;
            if (damage < smallest_damage) {
              smallest_damage = damage;
              smallest_damage_id = district_map[neighbor];
            }
          });

          // move block to neighbor district
          districts[smallest_damage_id].blocks.push(block_id);
          districts[smallest_damage_id].population += population;

          // update block
          data.features[node_map[block_id]].properties["UWB"] = districts[smallest_damage_id].id;

          changes += 1;
        }
      }
    }
  });

  update();
  createState(changes);

  if (optimization_state === "pause") {
    optimization_state = "stop";
  } else {
    if (optimization_improve) {
      // TODO: Do a better comparison if things get better???
      if (states[states.length - 1].error_median > states[states.length - 2].error_median) {
        gotoState(states[states.length - 2]);
      }
    }
    setTimeout(optimization, 300);
  }
};

const gotoState = (state) => {
  districts = JSON.parse(state.data);
  districts.forEach((district) => {
    district.blocks.forEach((block) => {
      data.features[node_map[block]].properties["UWB"] = district.id;
    });
  });
  update();
  createState(0);
};

const createState = (changes) => {
  const state = {
    bad: 0,
    changes,
    data: JSON.stringify(districts),
    errors: [],
    error_sum: 0,
    error_median: 0,
    error_mean: 0,
    error_max: 0,
    good: 0,
    quantiles: [],
  };

  districts.forEach((district) => {
    if (district.population > limit && !problems.includes(district.id)) {
      state.bad += 1;
      state.errors.push(district.population - limit);
    } else {
      state.good += 1;
    }
  });

  state.error_sum = d3.sum(state.errors);
  state.error_median = d3.median(state.errors);
  state.error_mean = d3.mean(state.errors);
  state.error_max = d3.max(state.errors);
  state.quantiles = [
    d3.quantile(state.errors, 0),
    d3.quantile(state.errors, 0.25),
    d3.quantile(state.errors, 0.5),
    d3.quantile(state.errors, 0.75),
    d3.quantile(state.errors, 1)
  ];

  states.push(state);

  stateSvg
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", "0 0 " + (100 + 20 * states.length) + " 200")
    .style("width", (100 + 20 * states.length) + "px");

  stateSvg.selectAll("*").remove();

  const yScale = d3.scaleLinear().range([175, 25]).domain([0, d3.max(states, (d) => d.error_max)]);
  const yAxis = d3.axisLeft().scale(yScale);

  stateSvg.append("g").attr("transform", "translate(50, 0)")
    .call(yAxis);

  const svgStates = stateSvg.append("g").selectAll("g").data(states).enter().append("g")
    .attr("transform", (d, i) => `translate(${60 + i * 20})`);
  
  svgStates.selectAll("circle").data((d) => d.errors).enter().append("circle")
    .attr("r", 3)
    .style("fill", "rgba(0,0,0,0.2)")
    .attr("cy", (d) => yScale(d));

  svgStates.append("text")
    .attr("transform", "translate(0, 190)")
    .style("font-weight", "bold")
    .style("font-family", "sans-serif")
    .style("font-size", "10px")
    .attr("text-anchor", "middle")
    .text((d, i) => (i + 1))
    .attr("class", "svgLink")
    .on("click", (d, i) => {
      if (optimization_state === "stop") {
        gotoState(states[i]);
      }
    });
};

let const_interval = false;

d3.json("network-edit.geojson").then((geojson) => {
  data = geojson;
  update();
  createState(0);
});