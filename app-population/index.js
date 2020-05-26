const w = 700;
const h = 700;
const limit = 2500;
const problems = ["07608", "07609", "07614", "07613"];

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

d3.json("network-edit.geojson").then((geojson) => {
  data = geojson;
  projection.center(turf.center(data).geometry.coordinates);
  
  data.features.forEach((feature, i) => {
    node_map[feature.properties.blknr_copy] = i;
    feature.properties["centroid"] = turf.centroid(feature);
    if (!(feature.properties["UWB"] in district_map)) {
      district_map[feature.properties["UWB"]] = districts.length
      districts.push({
        id: feature.properties["UWB"],
        population: 0,
        num_blocks: 0,
        blocks: [],
        points: []
      });
    }
    districts[district_map[feature.properties["UWB"]]].population += feature.properties["Insgesamt"];
    districts[district_map[feature.properties["UWB"]]].num_blocks += 1;
    districts[district_map[feature.properties["UWB"]]].blocks.push(feature.properties.blknr_copy);
    districts[district_map[feature.properties["UWB"]]].points = districts[district_map[feature.properties["UWB"]]].points.concat(feature.geometry.coordinates[0]);
  });

  mapPath = svg.append("g").selectAll("path")
    .data(data.features)
    .enter()
    .append("path")
    .attr("class","block")
    .attr("id", (d) => "blknr_" + d.properties.blknr_copy)
    .attr("d", path)
    .classed("full", (d) => districts[district_map[d.properties["UWB"]]].population > limit)
    .classed("single", (d) => districts[district_map[d.properties["UWB"]]].num_blocks === 1)
    .classed("big", (d) => d.properties["Insgesamt"] > limit)
    .style("fill", (d) => district_colors(d.properties["UWB"]));

  districts.forEach((district) => {
    const points = turf.featureCollection(district.points.map((p) => turf.point(p)));
    const options = {units: 'kilometers', maxEdge: 0.1};
    const hull = turf.concave(points);
    svg.append("path").attr("class", "district")
      .style("stroke", "red")
      .style("fill", "transparent")
      .attr("d", path(hull));
  });

  // list_color.domain([limit, d3.max(districts, (d) => d.population)]);

  // listItems = list.selectAll("li").data(districts).enter().append("li");

  // const lines = svg.append("g");

  // data.features.forEach((feature) => {
  //   if (Array.isArray(feature.properties.neighbor_blocks)){
  //     // cool already done
  //   } else {
  //     if (feature.properties.neighbor_blocks !== null) {
  //       feature.properties.neighbor_blocks = feature.properties.neighbor_blocks.split(",");
  //     } else {
  //       feature.properties.neighbor_blocks = [];
  //     }
  //   }

  //   const p1 = projection(feature.properties.centroid.geometry.coordinates);
  //   feature.properties.neighbor_blocks.forEach((neighbor) => {
  //     const p2 = projection(data.features[node_map[neighbor]].properties.centroid.geometry.coordinates);
  //     lines.append("line")
  //       .attr("x1", p1[0])
  //       .attr("x2", p2[0])
  //       .attr("y1", p1[1])
  //       .attr("y2", p2[1]);
  //   });
  // });
  
  // listItems.data(districts)
  //   .classed("full", (d) => d.population > limit)
  //   .classed("single", (d) => d.num_blocks === 1 || problems.includes(d.id) )
  //   .style("background-color", (d) => list_color(d.population))
  //   .html((d) => `${d.id}: ${d.population}`)
  //   .on("mouseover", (d) => {
  //     d.blocks.forEach((block) => {
  //       d3.select("#blknr_" + block).classed("hover", true);
  //     });
  //   })
  //   .on("mouseout", (d) => {
  //     mapPath.classed("hover", false);
  //   });
})
.catch((error) => {
  throw error;
});