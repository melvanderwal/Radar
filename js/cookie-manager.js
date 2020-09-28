// Cookie which stores the user's preferences and last-used map location
class CookieManager {

    constructor() {
        this.markers = [];
        let markerString = this.get("markers");
        if (markerString)
            this.markers = JSON.parse(markerString);
    }

    addMarker(id, lat, lng) {
        let markerFound = false;
        this.markers.forEach(marker => {
            if (marker.id == id) {
                marker.lat = lat;
                marker.lng = lng;
                markerFound = true;
            }
        });
        if (!markerFound)
            this.markers.push({ "id": id, "lat": lat, "lng": lng });

        this.set("markers", JSON.stringify(this.markers));
    }

    removeMarker(id) {
        for (let index = 0; index < this.markers.length; index++) {
            if (this.markers[index].id == id) {
                this.markers.splice(index, 1)
                break;
            }
        }
        this.set("markers", JSON.stringify(this.markers));
    }

    getMarkers() {
        console.log(this.markers);
        return this.markers;
    }

    setMapLocation() {
        this.set("center", JSON.stringify(map.getCenter()));
        this.set("zoom", map.getZoom());
    }

    getMapLocation() {
        return {
            "zoom": this.get("zoom"),
            "center": JSON.parse(this.get("center"))
        }
    }

    // Parse a cookie for the provided parameter name
    get(parameterName) {
        let parameterReplace = parameterName + "=";
        let parameters = document.cookie.split(";");
        for (let index = 0; index < parameters.length; index++) {
            const parameter = parameters[index].trim();
            if ((parameter).indexOf(parameterReplace) == 0)
                return parameter.substring(parameterReplace.length, parameter.length);
        }
        return null;
    }

    // Sets a cookie, expiring in 60 days
    set(key, value) {
        var cookie = key + "=" + value + ";";
        cookie += "max-age=" + 60 * 60 * 24 * 60 + ";";
        cookie += "SameSite=None;Secure;";
        document.cookie = cookie;
    }
}

var cookie = new CookieManager();
