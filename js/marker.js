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

    // If the user drags the marker to the bin, delete it.  If not, move it.
    // Need to adjust the position of the dragend by 45px, as the pixel coordinates are relative 
    // to the map div, not the document.
    newMarker.on('dragend', function (e) {
        let isDeletingMarker = false;
        document.elementsFromPoint(e.target._pos.x, e.target._pos.y+45).forEach(element => {
            console.log(element.id);
            if (element.id == markerBin.id) {
                isDeletingMarker = true;
                cookie.removeMarker(id);
                this.remove();
                activeMarker = null;
            }
        });

        if (!isDeletingMarker)
            cookie.addMarker(id, e.target._lngLat.lat, e.target._lngLat.lng);

        markerBin.style.display = "none";
    });

    if (addToCookie)
        cookie.addMarker(id, lat, lng);
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