// Code related to markers on the map

// Get markers from cookie and add to map, unless in PWS view.
if (!isPwsView) {
    cookie.markers.forEach(marker => {
        addMarker(true, false, marker.id, marker.lat, marker.lng);
    });
}

// Adds a marker to the map.  Coordinates can be provided; if not, it will be added to the center of the map.
var activeMarker;
var markerBin = document.getElementById('markerBin');
function addMarker(canDrag, addToCookie, id, lat, lng) {
    templateNode = document.getElementById('markerTemplate').cloneNode(true);
    let newDiv = document.createElement("div");
    newDiv.id = id;
    newDiv.innerHTML = templateNode.innerHTML;
    if (!lat || !lng) {
        coords = map.getCenter();
        lat = coords.lat;
        lng = coords.lng;
    }

    var newMarker = new mapboxgl.Marker({ element: newDiv, draggable: canDrag, offset: [5, -18] })
        .setLngLat([lng, lat])
        .addTo(map);

    // When the user drags the marker, display the bin
    newMarker.on('dragstart', function (e) {
        activeMarker = this;
        markerBin.style.display = "flex";
    });

    // Change the border when over the bin; hover css doesn't work on touchscreen devices
    newMarker.on('drag', function (e) {
        markerBin.style.borderStyle = markerOnBin(e) ? "solid" : "dotted";
    });

    // If the user drags the marker to the bin, delete it.  If not, move it.
    // Need to adjust the position of the dragend by 45px, as the pixel coordinates are relative 
    // to the map div, not the document.
    newMarker.on('dragend', function (e) {
        let isDeletingMarker = false;
        if (markerOnBin(e)) {
            isDeletingMarker = true;
            cookie.removeMarker(id);
            this.remove();
            activeMarker = null;
        }

        if (!isDeletingMarker)
            cookie.addMarker(id, e.target._lngLat.lat, e.target._lngLat.lng);

        markerBin.style.display = "none";
    });

    if (addToCookie)
        cookie.addMarker(id, lat, lng);
}

// Line drawn from marker closest to center of map to double-click point
var markerLineJson = {
    'type': 'FeatureCollection', 'features': [{ "type": "Feature", "geometry": null, "properties": {} }]
};

function updateMarkerLine(e) {
    if (cookie.markers.length == 0) return;

    let nearestDistance = 100000000000;
    cookie.markers.forEach(marker => {
        let markerCoords = new mapboxgl.LngLat(marker.lng, marker.lat);
        var distToMarker = markerCoords.distanceTo(map.getCenter());
        if (distToMarker < nearestDistance) {
            nearestDistance = distToMarker;
            markerLineJson.features[0].geometry = {
                'type': 'LineString',
                'coordinates': [
                    markerCoords.toArray(),
                    e.lngLat.toArray()
                ]
            }
        }
    });
}

function markerOnBin(e) {
    let onBin = false;
    document.elementsFromPoint(e.target._pos.x, e.target._pos.y + 45).forEach(element => {
        if (element.id == markerBin.id) onBin = true;
    })
    return onBin;
}

// The marker.dragend event doesn't fire when dragging over the bin div with a mouse, so a seperate event is required
markerBin.onpointerup = function () {
    if (activeMarker) {
        cookie.removeMarker(activeMarker._element.id);
        activeMarker.remove();
        activeMarker = null;
        markerBin.style.display = "none";
    }
}

// PWS Marker 
if (isPwsView) addMarker(false, false, "Mel's PWS", pwsCoords[1], pwsCoords[0]);