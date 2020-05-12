// UWB, blknr_copy, neighbors, neighbor_blocks, Insgesamt

// global objects
let geojson,

    map, mapLoaded = false,

    districts = [],
    districtKeys = {},
    blockKeys = {},

    hoveredStateId = null,
    selectedStateId = null,
    hoveredDistrictId = null,

    over = 0,
    under = 0,
    initOver = 0,
    initUnder = 0,
    histoData = [],
    initHistoData = [];

const limit = 2500;
const overLimit = 500;
const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
const overPopulationScale = d3.scaleLinear().range(['rgba(0, 0, 255, 0.5)', 'rgba(255, 255, 255, 0.5)', 'rgba(255, 0, 0, 0.5)']).domain([0, limit, limit + overLimit]);

const processData = (init) => {
  if (!init) {
    districts.forEach((district) => {
      district.population = 0;
      district.blocks = [];
    });
    over = 0;
    under = 0;
    histoData = [];
  }

  geojson.features.forEach((d, i) => {
    if (init) {
      d["id"] = i;
      blockKeys[d.properties["blknr_copy"]] = i;
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
    }
    districts[districtKeys[d.properties["UWB"]]].population += d.properties['Insgesamt'];
    districts[districtKeys[d.properties["UWB"]]].blocks.push(i);
  });

  geojson.features.forEach((d) => {
    d.properties['DistrictPopulation'] = districts[districtKeys[d.properties["UWB"]]].population;
    if (!init) {
      const neighbors = [];
      d.properties['neighbor_blocks'].split(",").forEach((neighbor) => {
        const uwb = geojson.features[blockKeys[neighbor]].properties["UWB"];
        if (!neighbors.includes(uwb)) {
          neighbors.push(uwb);
        }
      });
      d.properties['neighbors'] = neighbors.join(",");
    }
  });

  districts.forEach((district) => {
    if (district.population > limit) {
      over += 1;
      histoData.push(district.population);
    } else {
      under += 1;
    }
  });

  if (init) {
    initOver = over;
    initUnder = under;
    initHistoData = histoData;
  }

  overallScale.domain([0, over+under]);
};

const deselectDistrictBlocks = () => {
  if (hoveredDistrictId !== null) {
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
let rows;
let populationCol;
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

let overallSVG;
const overallScale = d3.scaleLinear().domain([0, over+under]).range([0, 288]);
const histoHeight = 100;
const histoY = d3.scaleLinear().range([histoHeight, 0]);
const histoInitY = d3.scaleLinear().range([0, histoHeight]);
let histoYAxis,histoRects, histogram, histoX, histo, histoRectsContainer;

// TODO: Check URL Params for loading the right model
const server = "https://tsb.ara.uberspace.de/wahlbezirke/";
let currentModel = "network";

const setupMenu = (init) => {
  d3.json(server + 'models')
    .then((data) => {
      d3.select("#districts-menu select").selectAll("option").remove();
      d3.select("#districts-menu select").selectAll("option").data(data).enter().append("option")
        .attr("value", (d) => d.uuid)
        .attr("selected", (d) => (currentModel === d.uuid) ? "selected" : null)
        .text((d) => `${d.name} (${d.timestamp})`);
      if (init) {
        d3.select("#button-load").on("click", () => {
          load(false, d3.select("#districts-menu select").property("value"));
        });
        d3.select("#button-save").on("click", () => {
          const url = server + "savemodel";

          const xhr = new XMLHttpRequest();
          xhr.open("POST", url, true);
          xhr.setRequestHeader("Content-Type", "application/json");
          
          xhr.onreadystatechange = () => {
            if (xhr.readyState === 4 && xhr.status === 200) {
              const json = JSON.parse(xhr.responseText);
              setupMenu(false);
            }
          };
          
          const name = d3.select("#variant-name-field").property("value");
          geojson.properties.name = name;
          geojson.properties.timestamp = (new Date()).toJSON();

          xhr.send(JSON.stringify({"geojson": JSON.stringify(geojson), "name": name}));
        });
      }
    });
};

// Load the data
const load = (init, modelName) => {
  currentModel = modelName;
  d3.json(server + 'model/' + modelName + '.geojson')
  .then((data) => {
    d3.select("#districts-menu p").html(`<strong>${data.properties.name}</strong><br />${data.properties.timestamp}`);
    geojson = data;
    processData(init);
    if (init) {
      setup();
    } else {
      update();
    }
    setupMenu(init);
  });
};
load(true, 'network');
 
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

    mapLoaded = true;

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

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false
    });

    map.on('mousemove', 'bloecke', function(e) {
      if (e.features.length > 0) {
        if (hoveredStateId !== null) {
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

        const coordinates = turf.center(e.features[0]).geometry.coordinates;
        const description = `<strong>${e.features[0].properties["blknr_copy"]}</strong> (${e.features[0].properties["Insgesamt"]})`;
        popup
          .setLngLat(coordinates)
          .setHTML(description)
          .addTo(map);
      }
    });
       
    map.on('mouseleave', 'bloecke', function() {
      if (hoveredStateId !== null) {
        map.setFeatureState(
          { source: 'bloecke', id: hoveredStateId },
          { hover: false }
        );
      }
      hoveredStateId = null;
      popup.remove();
    });

    map.on('click', 'bloecke', function(e) {
      selectBlock(e.features[0].id);
    });
    
    setupOtherStuff();
  });
}

const selectBlock = (id) => {
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

    const tDistrict = districts[districtKeys[geojson.features[id].properties["UWB"]]];

    d3.select("#districts-detail").selectAll("*").remove();
    d3.select("#districts-detail").html(`<div>
      <h2>Block: ${geojson.features[id].properties["blknr_copy"]}</h2>
      <p>Einwohner: ${geojson.features[id].properties["Insgesamt"]}</p>
      <h3>Zugehöriger Wahlbezirk: ${tDistrict.id}</h3>
      <p>
        Einwohner: ${tDistrict.population}<br />
        Alle Blöcke im Wahlbezirk:
        <ul id="districts-detail-other">
        </ul>
      </p>
      <h3>Verschiebe zu Nachbarn (${tDistrict.population} &raquo; ${tDistrict.population - geojson.features[id].properties["Insgesamt"]})</h3>
      <ul id="neighbor_select">
      </ul>
      <button id="districts-apply">Änderung anwenden</button>
    </div>`);

    d3.select("#districts-detail-other").selectAll("li").data(tDistrict.blocks).enter().append("li")
      .text((d) => `${geojson.features[d].properties["blknr_copy"]} (${geojson.features[d].properties["Insgesamt"]})`)
      .style("color", (d) => (d === id) ? "red" : "black")
      .on("mouseover", (d) => {
        if (hoveredStateId !== null) {
          map.setFeatureState(
            { source: 'bloecke', id: hoveredStateId },
            { hover: false }
          );
        }
        hoveredStateId = d;
        map.setFeatureState(
          { source: 'bloecke', id: d },
          { hover: true }
        );
      })
      .on("mouseleave", (d) => {
        if (hoveredStateId !== null) {
          map.setFeatureState(
            { source: 'bloecke', id: d },
            { hover: false }
          );
        }
        hoveredStateId = null;
      })
      .on("click", (d) => {
        if (d !== id) {
          selectBlock(d);
        }
      });
    
    d3.select("#neighbor_select").selectAll("li").data(geojson.features[id].properties["neighbors"].split(",").sort((a, b) => {
      const ap = districts[districtKeys[a]].population;
      const bp = districts[districtKeys[b]].population;
      if (ap < bp) {
        return -1;
      } else if (ap > bp) {
        return 1;
      }
      return 0;
    })).enter().append("li")
      .html((d) => `<input type="radio"${(d === tDistrict.id) ? ` checked="checked"` : ""} name="neighbor_selection" id="neighbor_selection_${d}" value="${d}"><label for="neighbor_selection_${d}">${d} (${districts[districtKeys[d]].population} / ${(d === tDistrict.id) ? districts[districtKeys[d]].population : districts[districtKeys[d]].population + geojson.features[id].properties["Insgesamt"]})</label></li>`)
      .on("mouseover", (d) => {
        deselectDistrictBlocks();

        districts[districtKeys[d]].blocks.forEach((block) => {
          map.setFeatureState(
            { source: 'bloecke', id: block },
            { selectDistrict: true }
          );
        });

        hoveredDistrictId = districts[districtKeys[d]].id;
      })
      .on("mouseout", (d) => {
        deselectDistrictBlocks();
      });

    d3.select('#districts-apply').on("click", () => {
      geojson.features[id].properties["UWB"] = d3.select('input[name="neighbor_selection"]:checked').property("value");
      processData(false);
      update();
      selectBlock(id);
      selectBlock(id);
    });
  }
};

const setupOtherStuff = () => {
  rows = d3.select('#districts-list tbody').selectAll('tr').data(districts).enter().append('tr')
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

  d3.selectAll("#districts-list thead th:nth-child(2), #districts-list tfoot th:nth-child(2)")
    .on("click", () => {
      sortRows("id");
    });

  d3.selectAll("#districts-list thead th:nth-child(3), #districts-list tfoot th:nth-child(3)")
    .on("click", () => {
      sortRows("population");
    });
  
  rows.append('td').attr("class", "colorcol").html((d) => `<span class="colorfield" style="background-color:${d.color};"></span>`);
  rows.append('td').text((d) => d.id);
  populationCol = rows.append('td').text((d) => d.population);

  sortRows("population");

  overallSVG = d3.select("#districts-overall").append("svg")
    .attr("width", 300)
    .attr("height", 400)
    .style("max-width", "100%")
    .style("height", "auto")
    .attr("viewBox", "0 0 300 400")
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
  
  overallSVG.append("rect")
    .attr("id", "overallUnderRect")
    .attr("x", 5)
    .attr("y", 25)
    .attr("height", 25)
    .style("fill", "blue");
  
  overallSVG.append("rect")
    .attr("id", "overallUnderRectInit")
    .style("opacity", 0.5)
    .attr("x", 5)
    .attr("y", 52)
    .attr("height", 5)
    .style("fill", "blue");
  
  overallSVG.append("text")
    .attr("id", "overallUnder")
    .style("fill", "white")
    .attr("x", 10)
    .attr("y", 40);
  
  overallSVG.append("rect")
    .attr("id", "overallOverRect")
    .attr("y", 25)
    .attr("height", 25)
    .style("fill", "red");

  overallSVG.append("rect")
    .attr("id", "overallOverRectInit")
    .attr("y", 52)
    .style("opacity", 0.5)
    .attr("height", 5)
    .style("fill", "red");
  
  overallSVG.append("text")
    .attr("id", "overallOver")
    .attr("text-anchor", "end")
    .style("fill", "white")
    .attr("x", 290)
    .attr("y", 40);
  
  // Histogram
  histoX = d3.scaleLinear()
      .domain(d3.extent(histoData))
      .range([0, 265]);

  histo = overallSVG.append("g")
    .attr("transform", "translate(25,70)");
  
  histo.append("g")
      .attr("transform", `translate(0,${histoHeight})`)
      .call(d3.axisBottom(histoX));

  histo.append("g")
      .attr("id", "histoInitAxis")
      .attr("transform", `translate(0,${histoHeight + 25})`)
      .call(d3.axisTop(histoX));

  histogram = d3.histogram()
      .domain(histoX.domain())
      .thresholds(20);

  histoYAxis = histo.append("g");
  histoRectsContainer = histo.append("g");
  histoRects = histoRectsContainer.selectAll("rect");

  const initBins = histogram(initHistoData);
  histoInitY.domain([0, d3.max(initBins, (d) => d.length)]);

  histo.append("g")
    .attr("transform", "translate(0, 125)")
    .call(d3.axisLeft(histoInitY).ticks(6));
  
  histo.append("g").attr("transform", "translate(0,126)").selectAll("rect").data(initBins)
    .enter()
    .append("rect")
      .attr("x", 1)
      .attr("transform", (d) => `translate(${histoX(d.x0)},0)`)
      .attr("width", (d) => histoX(d.x1) - histoX(d.x0) - 1)
      .attr("height", (d) => histoInitY(d.length))
      .style("opacity", 0.5)
      .style("fill", "red");

  
  update();
};

const update = () => {
  rows.style("background-color", (d) => overPopulationScale(d.population));
  populationCol.text((d) => d.population);
  sortRows(currentSort);
  sortRows(currentSort);

  overallSVG.select("#overallUnder").text(under);
  overallSVG.select("#overallOver").text(over);
  overallSVG.select("#overallUnderRect")
    .attr("width", overallScale(under));
  overallSVG.select("#overallOverRect")
    .attr("width", overallScale(over))
    .attr("x", 295 - overallScale(over));
  overallSVG.select("#overallUnderRectInit")
    .attr("width", overallScale(initUnder));
  overallSVG.select("#overallOverRectInit")
    .attr("width", overallScale(initOver))
    .attr("x", 295 - overallScale(initOver));

  const bins = histogram(histoData);

  histoY.domain([0, d3.max(bins, (d) => d.length)]);
  histoYAxis.call(d3.axisLeft(histoY).ticks(6));

  histoRects = histoRectsContainer.selectAll("rect").data(bins);

  histoRects
    .enter()
    .append("rect")
    .merge(histoRects)
      .attr("x", 1)
      .attr("transform", (d) => `translate(${histoX(d.x0)},${histoY(d.length)})`)
      .attr("width", (d) => histoX(d.x1) - histoX(d.x0) - 1)
      .attr("height", (d) => histoHeight - histoY(d.length))
      .style("fill", "red");

  histoRects.exit()
    .remove();
  
  if (mapLoaded) {
    map.getSource('bloecke').setData(geojson);
  }
};