class WillyWeather {

    constructor() {
        this.stations = { "type": "FeatureCollection", "features": [] };
        this.update();
    }

    update() {
        // Reset GeoJSON which holds stations and radar image urls
        this.stations = { "type": "FeatureCollection", "features": [] };

        // Get stations and image urls from WillyWeather via Google Apps Script
        let url = "https://script.google.com/macros/s/AKfycbxZLDmk6NSzDkmP5oiBcv05tuVr1ueZWTE1ZqcEwUseFOlWWp32tzb3vwf7AGS65EL-nA/exec?action=overlays";
        fetch(url, { method: 'GET' })
            .then(response => response.json())
            .then(stationJson => {
                // Populate GeoJSON
                stationJson.forEach(stnIn => {
                    let stnOut = {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [
                                stnIn.lng,
                                stnIn.lat
                            ]
                        },
                        "properties": {
                            "id": stnIn.id,
                            "name": stnIn.name,
                            "bounds": [
                                [
                                    stnIn.bounds.minLng,
                                    stnIn.bounds.maxLat
                                ],
                                [
                                    stnIn.bounds.maxLng,
                                    stnIn.bounds.maxLat
                                ],
                                [
                                    stnIn.bounds.maxLng,
                                    stnIn.bounds.minLat
                                ],
                                [
                                    stnIn.bounds.minLng,
                                    stnIn.bounds.minLat
                                ]
                            ],
                            "typeId": stnIn.typeId,
                            "radius": stnIn.radius,
                            "interval": stnIn.interval,
                            "overlayPath": stnIn.overlayPath,
                            "status": stnIn.status.code,
                            "nextIssueTime": stnIn.nextIssueTime,
                            "overlays": stnIn.overlays
                        }
                    }
                    this.stations.features.push(stnOut);
                });
            });
    }
}

const willyWeather = new WillyWeather();
