class mapboxControls {
    constructor() {
        this.fullscreen = new mapboxgl.FullscreenControl();
        this.geolocate = new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            fitBoundsOptions: { maxZoom: 13 },
            showAccuracyCircle: false
        });
        this.attribution = new mapboxgl.AttributionControl({
            compact: true,
            customAttribution: 'Radar data <a href="http://www.bom.gov.au/" target="_blank">Australia Bureau of Meteorology</a>'
        })
        this.marker = new MarkerControl();
        this.lock = new LockControl();
    }
}

class MarkerControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl';
        let templateNode = document.getElementById("markerControl").cloneNode(true);
        this._container.innerHTML = templateNode.innerHTML;
        this._container.onclick = function () { addMarker(true, true, new Date().getTime()); }
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

class LockControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl';
        let templateNode = document.getElementById("lockControl").cloneNode(true);
        this._container.innerHTML = templateNode.innerHTML;

        this.lockContainerDiv = this._container;
        this.radarLock = this.lockContainerDiv.querySelector("#radarLock");
        this.weatherStation = this.lockContainerDiv.querySelector("#weatherStation");

        // Set initial state to unlocked, and the click event to toggle between locked & unlocked
        this.radarLock.classList.toggle('unlocked');
        this.radarLock.onclick = function () {
            radarLocked = !radarLock.classList.toggle('unlocked');
            weatherStation.style.color = radarLocked ? '#64FF64' : '#c8ffc8';
            if (!radarLocked) { setActiveStation(); }
        }

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }

    lockRadar() {
        if (this.radarLock.classList.contains('unlocked')) {
            radarLocked = !radarLock.classList.toggle('unlocked');
            this.weatherStation.style.color = '#64FF64';
        }
    }
}
