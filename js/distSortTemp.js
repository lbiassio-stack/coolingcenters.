mapboxgl.accessToken = 'pk.eyJ1IjoibGJpYXNzaW8iLCJhIjoiY21tbGh6emloMW10NDJwcHprcmJpc2lrNCJ9.4w069MMr6OqZyFxWAZEQAw';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v10',
    zoom: 10,
    center: [-122.255, 47.565]
});

async function geojsonFetch() {
    map.on('load', async () => {

        // ----- Point Layers -----
        const pointLayerFiles = [
            "beaches.geojson",
            "communitycenters.geojson",
            "libraries.geojson",
            "sprayparks.geojson",
            "swimmingpools.geojson",
            "wadingpools.geojson"
        ];

        const allPoints = [];

        for (let i = 0; i < pointLayerFiles.length; i++) {
            const data = await fetch(`assets/${pointLayerFiles[i]}`).then(res => res.json());
            console.log(`Point Layer Loaded: ${pointLayerFiles[i]} → ${data.features.length} features`);

            // ---- Fix coordinates if not in EPSG:4326 ----
            data.features.forEach(f => {
                if (f.properties.LONGITUDE && f.properties.LATITUDE) {
                    f.geometry.coordinates = [f.properties.LONGITUDE, f.properties.LATITUDE];
                }
            });

            const sourceName = `point${i + 1}`;
            const layerId = `pointLayer${i + 1}`;

            map.addSource(sourceName, { type: 'geojson', data: data });
            map.addLayer({
                id: layerId,
                type: 'circle',
                source: sourceName,
                paint: {
                    'circle-radius': 8, // slightly bigger for visibility
                    'circle-color': '#007cbf',
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 1
                }
            });

            map.on('click', layerId, (e) => {
                const props = e.features[0].properties;
                new mapboxgl.Popup()
                    .setLngLat(e.features[0].geometry.coordinates)
                    .setHTML(`<strong>${props.NAME || 'Point'}</strong>`)
                    .addTo(map);
            });

            allPoints.push(...data.features);
        }

       

        // ----- Geocoder -----
        const geocoder = new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            mapboxgl: mapboxgl,
            marker: false,
            placeholder: "Enter an address in Seattle"
        });

        document.getElementById('geocoder-container').appendChild(geocoder.onAdd(map));

        let searchMarker;

        geocoder.on('result', (e) => {
            const searchCoords = e.result.geometry.coordinates;

            if (searchMarker) searchMarker.remove();

            searchMarker = new mapboxgl.Marker({ color: "red" })
                .setLngLat(searchCoords)
                .addTo(map);

            const nearest = turf.nearestPoint(searchCoords, {
                type: "FeatureCollection",
                features: allPoints
            });

            const line = {
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: [searchCoords, nearest.geometry.coordinates]
                }
            };

            if (!map.getSource("nearest-line")) {
                map.addSource("nearest-line", { type: 'geojson', data: line });
                map.addLayer({
                    id: "nearest-line-layer",
                    type: "line",
                    source: "nearest-line",
                    paint: { "line-color": "#ff0000", "line-width": 3 }
                });
            } else {
                map.getSource("nearest-line").setData(line);
            }

            new mapboxgl.Popup()
                .setLngLat(nearest.geometry.coordinates)
                .setHTML(`<strong>${nearest.properties.NAME}</strong>`)
                .addTo(map);

            map.flyTo({ center: nearest.geometry.coordinates, zoom: 14 });
        });

    });
}

geojsonFetch();