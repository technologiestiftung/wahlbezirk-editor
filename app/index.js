// UWB, blknr_copy, neighbors, neighbor_blocks, Insgesamt

// global objects
let geojson,

    map,

    districts = [],
    districtKeys = {},
    blockKeys = {},

    hoveredStateId = null,
    selectedStateId = null,
    hoveredDistrictId = null,

    over = 0,
    under = 0;

const limit = 2500;

// Load the data
d3.json('network.geojson')
  .then((data) => {
    geojson = data;
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    geojson.features.forEach((d, i) => {
      d["id"] = i;
      d.properties['Insgesamt'] = +d.properties['Insgesamt'];
      if (!(d.properties["UWB"] in districtKeys)) {
        districts.push({
          id: d.properties["UWB"],
          population: 0,
          color: colorScale(districts.length),
          blocks: []
        });
        districtKeys[d.properties["UWB"]] = districts.length - 1;
      }
      d.properties["DistrictId"] = districtKeys[d.properties["UWB"]];
      districts[districtKeys[d.properties["UWB"]]].population += d.properties['Insgesamt'];
      districts[districtKeys[d.properties["UWB"]]].blocks.push(i);
      blockKeys[d.properties["blknr_copy"]] = i;
    });
    geojson.features.forEach((d) => {
      d.properties['DistrictPopulation'] = districts[districtKeys[d.properties["UWB"]]].population;
    });
    districts.forEach((district) => {
      if (district.population > limit) {
        over += 1;
      } else {
        under += 1;
      }
    });
    setup();
  });
 
const setup = () => {
  // Create Map
  mapboxgl.accessToken = 'pk.eyJ1IjoidGVjaG5vbG9naWVzdGlmdHVuZyIsImEiOiJjanZubXFzc3YxOTk3NGFxanNxMHdkc3Z0In0.cvnIEVF97kQljPfbB8nUZg';
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v10',
    zoom: 11,
    center: turf.center(geojson).geometry.coordinates
  });

  map.on('load', () => {
    map.addSource('bloecke', {
      'type': 'geojson',
      'data': geojson
    });

    //generate color scale for voting districts
    const fillColor = [
      'match',
      ['get', 'UWB']
    ];

    districts.forEach((district) => {
      fillColor.push(district.id);
      fillColor.push(district.color);
    });

    // Unknown values 
    fillColor.push('black');

    map.addLayer({
      'id': 'bloecke',
      'type': 'fill',
      'source': 'bloecke',
      'paint': {
        'fill-color': fillColor,
        'fill-opacity': [
          'case',
          ['>', ['get', 'DistrictPopulation'], 2500],
          1,
          0.25
        ]
      }
    });

    map.addLayer({
      'id': 'bloecke-borders',
      'type': 'line',
      'source': 'bloecke',
      'paint': {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'select'], false],
          'red',
          'black'
        ],
        'line-width': 2,
        'line-opacity': [
          'case',
          ['boolean', ['feature-state', 'select'], false],
          1,
          ['boolean', ['feature-state', 'selectDistrict'], false],
          1,
          ['boolean', ['feature-state', 'hover'], false],
          1,
          0
        ]
      }
    });

    map.on('mousemove', 'bloecke', function(e) {
      if (e.features.length > 0) {
        if (hoveredStateId) {
          map.setFeatureState(
            { source: 'bloecke', id: hoveredStateId },
            { hover: false }
          );
        }
        hoveredStateId = e.features[0].id;
        map.setFeatureState(
          { source: 'bloecke', id: hoveredStateId },
          { hover: true }
        );
      }
    });
       
    map.on('mouseleave', 'bloecke', function() {
      if (hoveredStateId) {
        map.setFeatureState(
          { source: 'bloecke', id: hoveredStateId },
          { hover: false }
        );
      }
      hoveredStateId = null;
    });

    map.on('click', 'bloecke', function(e) {
      const id = e.features[0].id;

      // deselect current
      map.setFeatureState(
        { source: 'bloecke', id: selectedStateId },
        { select: false }
      );

      if (selectedStateId === id) {
        selectedStateId = null;
        d3.select("#districts-detail").selectAll("*").remove();
      } else {
        // select new
        selectedStateId = id;
        map.setFeatureState(
          { source: 'bloecke', id: id },
          { select: true }
        );

        const tDistrict = districts[e.features[0].properties["DistrictId"]];

        d3.select("#districts-detail").selectAll("*").remove();
        d3.select("#districts-detail").html(`<div>
          <h2>Block: ${e.features[0].properties["blknr_copy"]}</h2>
          <p>Einwohner: ${e.features[0].properties["Insgesamt"]}</p>
          <h3>Zugehöriger Wahlbezirk: ${tDistrict.id}</h3>
          <p>
            Einwohner: ${tDistrict.population}<br />
            Alle Blöcke im Wahlbezirk:
            <ul>
              ${ tDistrict.blocks.map((d) => `<li>${geojson.features[d].properties["blknr_copy"]} (${geojson.features[d].properties["Insgesamt"]})</li>`).join("") }
            </ul>
          </p>
          <h3>Verschiebe zu Nachbarn</h3>
          <select>
            ${ e.features[0].properties["neighbors"].split(",").map((d) => `<option value="${d}">${d} (${districts[districtKeys[d]].population} / ${districts[districtKeys[d]].population + e.features[0].properties["Insgesamt"]})</option>`).join("") }
          </select>
          <button id="districts-apply">Änderung anwenden</button>
        </div>`);

        d3.select('#districts-apply').on("click", () => {
          // TODO: Switch District, update data structure and redraw!
        });
      }
    });      
  });

  const overPopulationScale = d3.scaleLinear().range(['rgba(0, 0, 255, 0.5)', 'rgba(255, 255, 255, 0.5)', 'rgba(255, 0, 0, 0.5)']).domain([0, 2500, 3000]);

  const deselectDistrictBlocks = () => {
    if (hoveredDistrictId) {
      districts[districtKeys[hoveredDistrictId]].blocks.forEach((block) => {
        map.setFeatureState(
          { source: 'bloecke', id: block },
          { selectDistrict: false }
        );
      });
    }
    hoveredDistrictId = null;
  };

  let currentAsc = true;
  let currentSort = null;
  const sortRows = (key) => {
    if (currentSort === key) {
      currentAsc = !currentAsc;
    }
    currentSort = key;
    rows.sort((a, b) => {
      if (a[key] < b[key]) {
        return 1 * (currentAsc ? 1 : -1);
      } else if (a[key] > b[key]) {
        return -1 * (currentAsc ? 1 : -1);
      }
      return 0;
    });
  };

  const rows = d3.select('#districts-list tbody').selectAll('tr').data(districts).enter().append('tr')
    .style("background-color", (d) => overPopulationScale(d.population))
    .on("mouseover", (d) => {
      deselectDistrictBlocks();

      d.blocks.forEach((block) => {
        map.setFeatureState(
          { source: 'bloecke', id: block },
          { selectDistrict: true }
        );
      });

      hoveredDistrictId = d.id;
    })
    .on("mouseout", (d) => {
      deselectDistrictBlocks();
    });

  d3.selectAll("#districts-list thead th:nth-child(1), #districts-list tfoot th:nth-child(1)")
    .on("click", () => {
      sortRows("id");
    });

  d3.selectAll("#districts-list thead th:nth-child(2), #districts-list tfoot th:nth-child(2)")
    .on("click", () => {
      sortRows("population");
    });
  
  rows.append('td').text((d) => d.id);
  rows.append('td').text((d) => d.population);

  sortRows("population");

  const overallSVG = d3.select("#districts-overall").append("svg")
    .attr("width", 300)
    .attr("height", 50)
    .style("width", "100%")
    .style("height", "auto")
    .attr("viewBox", "0 0 300 50")
    .attr("preserveAspectRatio", "xMidYMid meet");
  
  overallSVG.append("text")
    .attr("x", 10)
    .attr("y", 10)
    .text("<= " + limit);
  
  overallSVG.append("text")
    .attr("x", 290)
    .attr("y", 10)
    .attr("text-anchor", "end")
    .text("> " + limit);
  
  const overallScale = d3.scaleLinear().domain([0, over+under]).range([0, 288]);
  
  overallSVG.append("rect")
    .attr("x", 5)
    .attr("y", 25)
    .attr("height", 25)
    .attr("width", overallScale(under))
    .style("fill", "blue");
  
  overallSVG.append("text")
    .text(under)
    .style("fill", "white")
    .attr("x", 10)
    .attr("y", 40);
  
  overallSVG.append("rect")
    .attr("x", 295 - overallScale(over))
    .attr("y", 25)
    .attr("height", 25)
    .attr("width", overallScale(over))
    .style("fill", "red");
  
  overallSVG.append("text")
    .text(over)
    .attr("text-anchor", "end")
    .style("fill", "white")
    .attr("x", 290)
    .attr("y", 40);
};