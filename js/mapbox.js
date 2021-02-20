mapboxgl.accessToken = "pk.eyJ1IjoibWVsdmFuZGVyd2FsIiwiYSI6ImNrZGt5NnZzbTA1MWQyc2tiMmdjOHdzamoifQ.ygz_QyPDlrstuvm-iI-W1Q";
const urlParams = new URLSearchParams(window.location.search);
const idrUrl = "https://melvanderwal.github.io/Radar/data/idr.json";
const pwsCoords = [152.828101, -27.5276];

// Show/hide page elements based on URL parameters.
document.getElementById("titleBar").style.display = urlParams.get("title") == "false" ? "none" : "block";
if (urlParams.get("label") == "true") document.getElementById("radarTitle").style.display = "block";
let isPwsView = urlParams.get("pws") == "true";
if (isPwsView) document.getElementById("kickstart").style.display = "none";

// Create map object.  Use startup location from PWS, cookie,or use defaults.
let startLocation = cookie.getMapLocation();
if (isPwsView) {
  startLocation.center = pwsCoords;
  startLocation.zoom = 15;
  startLocation.bearing = 330;
  startLocation.pitch = 80;
}
else {
  startLocation.zoom = startLocation.zoom != null ? startLocation.zoom : 9;
  startLocation.center = startLocation.center != null ? startLocation.center : [152.81, -27.5276];
  startLocation.bearing = startLocation.bearing != null ? startLocation.bearing : 0;
  startLocation.pitch = startLocation.pitch != null ? startLocation.pitch : 0;
}

var map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/melvanderwal/ckdnzyjcq1mez1it8o84igkqc",
  center: startLocation.center,
  zoom: startLocation.zoom,
  bearing: startLocation.bearing,
  pitch: startLocation.pitch,
  attributionControl: false
});

// Add controls to the map.    
const controls = new mapboxControls();
map.addControl(controls.fullscreen, "top-right");
if (!isPwsView) {
  map.addControl(controls.geolocate, "top-right");
  map.addControl(controls.marker, "top-right");
  map.addControl(controls.attribution, "bottom-right");
  map.addControl(controls.lock, "top-left");
}

// Variables tracking the currently selected station and IDR
let activeStationGeoJson = { 'type': 'FeatureCollection', 'features': [] };
let activeIdr = { "name": "none", "images": [] };
let currentImageIdx = 0;
let stationGeoJson = null;
let radarLocked = false;

map.on("load", function () {

  // ========= 3D terrain and sky layers  =========  
  map.addSource('dem', {
    'type': 'raster-dem',
    'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
    'tileSize': 512,
    'maxzoom': 14
  });
  map.setTerrain({ 'source': 'dem', 'exaggeration': 2 });

  map.addLayer({
    'id': 'sky',
    'type': 'sky',
    'paint': {
      'sky-type': 'atmosphere',
      'sky-atmosphere-sun': [0.0, 0.0],
      'sky-atmosphere-sun-intensity': 2
    }
  });
  // ========= Marker line layer  =========
  map.addSource('markerLineSource', { 'type': 'geojson', 'data': markerLineJson });
  map.addLayer({
    'id': 'markerLine',
    'type': 'line',
    'source': 'markerLineSource',
    'layout': {
      'line-join': 'round',
      'line-cap': 'round'
    },
    'paint': {
      'line-color': '#888',
      'line-width': 5
    }
  });


  // ========= Radar station layer  =========
  map.addSource('stationSource', { 'type': 'geojson', 'data': "data/station.json" });
  map.addImage('stationSymbol', pulsingDot, { pixelRatio: 3 });
  map.addLayer({
    'id': 'stationLayer',
    'source': 'stationSource',
    'type': 'symbol',
    'layout': { 'icon-image': 'stationSymbol' }
  })

  // When clicking a radar station, change the current radar to that station
  map.on('click', 'stationLayer', function (e) {
    let feat = e.features[0];
    feat.properties.idrs = JSON.parse(feat.properties.idrs);  // Need to convert string to object, Mapbox issue
    setActiveStation(feat);
  })

  // Change the cursor to a pointer when the mouse is over the radar station layer.
  map.on('mouseenter', 'stationLayer', function () {
    map.getCanvas().style.cursor = 'pointer';
  });

  // Change it back to a pointer when it leaves.
  map.on('mouseleave', 'stationLayer', function () {
    map.getCanvas().style.cursor = '';
  });


  // ========= Currently selected radar station layer  =========
  map.addSource('activeStationSource', { 'type': 'geojson', 'data': { 'type': 'FeatureCollection', 'features': [] } });
  map.addImage('activeStationSymbol', pulsingDot, { pixelRatio: 1.5 });
  map.addLayer({
    'id': 'activeStationLayer',
    'source': 'activeStationSource',
    'type': 'symbol',
    'layout': { 'icon-image': 'activeStationSymbol' }
  })

  // ========= Radar layer  =========
  // Identify the first symbol layer in the map, and place the radar layer below placenames, roads, etc.
  var firstSymbolId;
  for (let layer of map.getStyle().layers) {
    if (layer.type === 'symbol') {
      firstSymbolId = layer.id;
      break;
    }
  }

  map.addSource('radarSource', {
    type: 'image',
    url: "data/blank-radar.png",
    coordinates: [[151, -26], [153, -26], [153, -28], [151, -28]]
  });

  var radarLayer = {
    id: 'radarLayer',
    type: 'raster',
    source: 'radarSource',
    paint: {
      'raster-fade-duration': 0,
      'raster-opacity': 0.4,
      'raster-resampling': 'linear'
    }
  };
  map.addLayer(radarLayer, firstSymbolId);

  // Load station geojson and set the current station based on location
  fetch("data/station.json")
    .then(response => response.json())
    .then(stnJson => {
      stationGeoJson = stnJson;
      setActiveStation();
    })
    .catch(function (error) {
      console.log(error);
    });

  // Move through radar images on a timer
  setInterval(function () {
    if (activeIdr.imagePaths && activeIdr.imagePaths.length > 0) {
      let opacity = (currentImageIdx + 1) / activeIdr.imagePaths.length;
      if (currentImageIdx == (activeIdr.imagePaths.length - 1)) opacity = 0;
      map.getSource('radarSource').updateImage({ url: activeIdr.imagePaths[currentImageIdx].source });
      map.setPaintProperty('radarLayer', 'raster-opacity', opacity);

      if (!isPwsView) {
        document.getElementById("weatherStation").textContent = activeIdr.title;
        let imageTime = new Date(activeIdr.imagePaths[currentImageIdx].imageDate).toLocaleString('en-AU');
        document.getElementById("radarTime").textContent = imageTime.replace(":00 ", " ");
      }
      currentImageIdx = (currentImageIdx == (activeIdr.imagePaths.length - 1)) ? 0 : currentImageIdx + 1;
    }
  }, 800);

  // Hide the startup animation
  document.getElementById("kickstart").style.display = "none";
});  // End On Load

// Update active station and radar images when a change to the map view requires it
map.on("moveend", function () {
  setActiveStation();
  if (!isPwsView) cookie.setMapLocation();
});

// On double-click, draw a line from the marker closest to the map centre to the mouse
map.doubleClickZoom.disable();
map.on('dblclick', function (e) {
  updateMarkerLine(e);
  map.getSource('markerLineSource').setData(markerLineJson);
});

function setActiveStation(feature) {
  if (radarLocked || !stationGeoJson) return;

  // If station feature was provided, use that. 
  // Use national radar if zoomed out beyond level 5.
  // Otherwise, use the station closest to the center of the screen.
  let nearestStation;
  let nearestDistance = 100000000000;
  let hasFeature = (feature && feature.properties);
  if (hasFeature)
    nearestStation = feature;
  else if (map.getZoom() <= 5)
    nearestStation = stationGeoJson.features[0];
  else {
    for (let stn of stationGeoJson.features) {
      if (!stn.geometry) continue;
      var distToStn = new mapboxgl.LngLat(stn.geometry.coordinates[0], stn.geometry.coordinates[1]).distanceTo(map.getCenter());
      if (distToStn < nearestDistance) {
        nearestStation = stn;
        nearestDistance = distToStn;
      }
    }
  }

  // Update active station layer if the current station is different than the previous one.
  if (activeStationGeoJson.features.length == 0 || activeStationGeoJson.features[0].properties.id != nearestStation.properties.id) {
    activeStationGeoJson = { 'type': 'FeatureCollection', 'features': [nearestStation] };
    map.getSource('activeStationSource').setData(activeStationGeoJson);
  }

  // Update the radar images, and if a station feature was provided to this function, lock to that station
  setActiveIDR();
  if (hasFeature) controls.lock.lockRadar();
}

function setActiveIDR() {
  // If the radar is locked or the active station is empty (occurs at startup), exit
  if (radarLocked || activeStationGeoJson.features.length == 0) return;

  // Determine the most appropriate IDR for that map scale
  var zoomLevel = map.getZoom();
  var idxIdr = 0;
  var idrs = activeStationGeoJson.features[0].properties.idrs;
  switch (true) {
    case (zoomLevel > 8):   // 64 km
      idxIdr = (idrs.length < 4) ? idrs.length - 1 : 3;
      break;
    case (zoomLevel > 7):    // 128km
      idxIdr = (idrs.length < 3) ? idrs.length - 1 : 2;
      break;
    case (zoomLevel > 6):    // 256 km
      idxIdr = (idrs.length < 2) ? idrs.length - 1 : 1;
      break;
    case (zoomLevel > 5):    // 512 km
      idxIdr = 0;
      break;
    default:    // All Australia
      idxIdr = 0;
  }
  let newIdrName = idrs[idxIdr].name;

  // If the new IDR is different than the current one, update the current IDR.  
  // Duplicate the start and end images for the radar loop, for visual effect.
  if (activeIdr.name != newIdrName) {
    fetch(idrUrl, { cache: "no-store" })
      .then(response => response.json())
      .then(idrJson => {
        currentImageIdx = 0;
        activeIdr = idrJson[newIdrName];
        map.getSource('radarSource').setCoordinates(activeIdr.bounds);
        activeIdr.imagePaths = [activeIdr.images[0]];
        activeIdr.images.forEach(element => {
          activeIdr.imagePaths.push(element);
        });
        activeIdr.imagePaths.push(activeIdr.images[activeIdr.images.length - 1]);
        activeIdr.imagePaths.push(activeIdr.images[activeIdr.images.length - 1]);
      })
      .catch(function (error) {
        console.log(error);
      });
  }
}
