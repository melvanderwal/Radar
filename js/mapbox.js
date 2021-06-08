mapboxgl.accessToken = "pk.eyJ1IjoibWVsdmFuZGVyd2FsIiwiYSI6ImNrZGt5NnZzbTA1MWQyc2tiMmdjOHdzamoifQ.ygz_QyPDlrstuvm-iI-W1Q";
const urlParams = new URLSearchParams(window.location.search);
const idrUrl = "https://melvanderwal.github.io/Radar/data/idr.json";
const pwsCoords = [152.828101, -27.5276];

// Show/hide page elements based on URL parameters.
document.getElementById("titleBar").style.display = urlParams.get("title") == "false" ? "none" : "block";
if (urlParams.get("label") == "true") document.getElementById("radarTitle").style.display = "block";
let isPwsView = urlParams.get("pws") == "true";
if (isPwsView) document.getElementById("kickstart").style.display = "none";

// Create map object.  Use startup location from PWS, cookie, or use defaults.
let startLocation = cookie.getMapLocation();
if (isPwsView) {
  startLocation.center = pwsCoords;
  startLocation.zoom = 10;
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

// Variables tracking the currently selected station
let activeStationGeoJson = { 'type': 'FeatureCollection', 'features': [] };
let currentImageIdx = 0;
let stationGeoJson = willyWeather.stations;
let radarLocked = false;
var radarCanvas = document.getElementById('radarAnimation');
var radarCtx = radarCanvas.getContext('2d');
var radarImages = [];
var isLoading = true;


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

  map.setFog({
    'range': [-1.5, 15],
    'color': 'white',
    'horizon-blend': 0.08
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
  map.addSource('stationSource', { 'type': 'geojson', 'data': stationGeoJson });
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
  map.addSource('activeStationSource', { 'type': 'geojson', 'data': activeStationGeoJson });
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
    type: 'canvas',
    canvas: 'radarAnimation',
    coordinates: [[151, -26], [153, -26], [153, -28], [151, -28]],
    animate: true
  });


  var radarLayer = {
    id: 'radarLayer',
    type: 'raster',
    source: 'radarSource',
    paint: {
      'raster-resampling': 'linear'
    }
  };
  map.addLayer(radarLayer, firstSymbolId);


  // Move through radar images on a timer
  setInterval(function () {
    // At startup there is a delay until the station GeoJson is ready to use...  set the active station when it is available
    if (activeStationGeoJson.features.length == 0 && stationGeoJson.features.length > 0) setActiveStation();

    // Exit if loading, no feature, the feature doesn't have overlays, or the images aren't present yet in the array
    if (isLoading || !activeStationGeoJson ||
      activeStationGeoJson.features.length == 0 ||
      activeStationGeoJson.features[0].properties.overlays.length == 0 ||
      radarImages.length == 0)
      return;

    // Sort radar images by filename - won't be needed when accessing WillyWeather images directly
    radarImages.sort(function (a, b) {
      if (a.file < b.file) { return -1; }
      if (a.file > b.file) { return 1; }
      return 0;
    });

    let props = activeStationGeoJson.features[0].properties;
    let overlays = props.overlays;

    // Draw previous radar images with opacity, to appear as fading, trailing radar.
    // Draw the last image several times, fading away.
    let drawImageIdx = Math.min(currentImageIdx, overlays.length - 1);
    let opacityFactor = currentImageIdx - drawImageIdx + 1;
    radarCtx.clearRect(0, 0, radarCanvas.width, radarCanvas.height);
    if (currentImageIdx > 0 && currentImageIdx <= drawImageIdx + 1) {
      radarCtx.globalAlpha = 0.15 / opacityFactor;
      radarCtx.drawImage(radarImages[currentImageIdx - 1].img, 0, 0);
    }
    if (currentImageIdx > 1 && currentImageIdx <= drawImageIdx + 2) {
      radarCtx.globalAlpha = 0.10 / opacityFactor;
      radarCtx.drawImage(radarImages[currentImageIdx - 2].img, 0, 0);
    }
    if (currentImageIdx > 2 && currentImageIdx <= drawImageIdx + 3) {
      radarCtx.globalAlpha = 0.05 / opacityFactor;
      radarCtx.drawImage(radarImages[currentImageIdx - 3].img, 0, 0);
    }

    // Draw current image
    radarCtx.globalAlpha = 1 / opacityFactor;
    radarCtx.drawImage(radarImages[drawImageIdx].img, 0, 0);

    if (!isPwsView) {
      document.getElementById("weatherStation").textContent = props.name;
      let imageTime = new Date(overlays[drawImageIdx].dateTime + " UTC").toLocaleString('en-AU');
      document.getElementById("radarTime").textContent = imageTime.replace(":00 ", " ");
    }

    currentImageIdx = (currentImageIdx == (overlays.length + 5)) ? 0 : currentImageIdx + 1;

  }, 500);

 
  // Hide the startup animation
  document.getElementById("kickstart").style.display = "none";
  setActiveStation();
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
  if (nearestStation && (activeStationGeoJson.features.length == 0 || activeStationGeoJson.features[0].properties.id != nearestStation.properties.id)) {
    radarCtx.clearRect(0, 0, radarCanvas.width, radarCanvas.height);
    activeStationGeoJson = { 'type': 'FeatureCollection', 'features': [nearestStation] };
    map.getSource('activeStationSource').setData(activeStationGeoJson);
    map.getSource('radarSource').setCoordinates(nearestStation.properties.bounds);

    // Load radar images to array
    isLoading = true;
    radarImages = [];
    let activeProps = nearestStation.properties;
    for (let overlay of activeProps.overlays) {
      let imgUrl = "https://script.google.com/macros/s/" + gasMelStuffId + "/exec?action=overlay&url=" + activeProps.overlayPath + overlay.name;
      fetch(imgUrl, { method: 'GET' })
        .then(response => response.json())
        .then(imgJson => {
          let img = new Image();
          img.crossOrigin = "anonymous";
          img.src = imgJson.imageData;
          img.onload = function () {
            radarCanvas.width = img.naturalWidth;
            radarCanvas.height = img.naturalHeight;
          }
          radarImages.push({ "file": overlay.name, "img": img });
        })
      currentImageIdx = 0;
      isLoading = false;
    }
  }

  // If a station feature was provided to this function, lock to that station
  if (hasFeature) controls.lock.lockRadar();
}
