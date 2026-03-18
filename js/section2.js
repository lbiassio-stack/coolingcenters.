mapboxgl.accessToken =
  'pk.eyJ1IjoiYWxzaXdpIiwiYSI6ImNtaGw0Y2ZpYzF4aDkybXB2cmdmMDB3MDYifQ.OyXk6TfoK0dtZP1NeEgtcA';

/**
 * Add the map to the page
 */
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-122.255, 47.565],
  zoom: 9,
  scrollZoom: false
});

// Debug: check again inside this file
console.log("section3.js: typeof MapboxGeocoder =", typeof MapboxGeocoder);

// will hold all the store features
let stores = null;

// build a bbox from two [lng, lat] points
function getBbox(point1, point2) {
  const lons = [point1[0], point2[0]].sort((a, b) => a - b);
  const lats = [point1[1], point2[1]].sort((a, b) => a - b);
  return [
    [lons[0], lats[0]], // lower-left
    [lons[1], lats[1]]  // upper-right
  ];
}

function clean(value) {
  return (value || '').toString().trim();
}

map.on('load', () => {
  fetch(
    'assets/Food_Facilites_-_Multiple_Classes_-_For_King_County___food_facilities_point.geojson'
  )
    .then((res) => res.json())
    .then((geojson) => {
      stores = geojson; // save for later

      geojson.features.forEach((f, i) => {
        if (!f.properties) f.properties = {};
        f.properties.id = i;
      });

      map.addSource('places', {
        type: 'geojson',
        data: geojson
      });

      buildLocationList(geojson);
      addMarkers(geojson);
    })
    .catch((err) => console.error('Error loading GeoJSON:', err));
});

/** Add Mapbox default markers */
function addMarkers(geojson) {
  for (const feature of geojson.features) {
    const marker = new mapboxgl.Marker()
      .setLngLat(feature.geometry.coordinates)
      .addTo(map);

    const el = marker.getElement();

    el.addEventListener('click', (e) => {
      flyToStore(feature);
      createPopUp(feature);
      const activeItem = document.getElementsByClassName('active');
      e.stopPropagation();
      if (activeItem[0]) {
        activeItem[0].classList.remove('active');
      }

      const listing = document.getElementById(
        `listing-${feature.properties.id}`
      );
      if (listing) {
        listing.classList.add('active');
      }
    });
  }
}

/** Build sidebar */
function buildLocationList(geojson) {
  const listings = document.getElementById('listings');

  for (const feature of geojson.features) {
    const props = feature.properties;

    const facilityName =
      clean(props.FACILITY_NAME) || clean(props.NAME) || 'Food Facility';

    const address1 = clean(props.SITE_ADDRESS);
    const address2 = clean(props.ADDRESS);
    const address = address1 || address2 || 'Address not available';

    const city = clean(props.CITY) || 'City not available';
    const phone = clean(props.PHONE);

    const listing = listings.appendChild(document.createElement('div'));
    listing.id = `listing-${props.id}`;
    listing.className = 'item';

    const link = listing.appendChild(document.createElement('a'));
    link.href = '#';
    link.className = 'title';
    link.id = `link-${props.id}`;
    link.innerHTML = facilityName;

    const details = listing.appendChild(document.createElement('div'));
    details.innerHTML = `${address}, ${city}`;
    if (phone) {
      details.innerHTML += ` &middot; ${phone}`;
    }

    link.addEventListener('click', function () {
      flyToStore(feature);
      createPopUp(feature);

      const activeItem = document.getElementsByClassName('active');
      if (activeItem[0]) {
        activeItem[0].classList.remove('active');
      }
      this.parentNode.classList.add('active');
    });
  }
}

/** Fly camera to a feature */
function flyToStore(currentFeature) {
  map.flyTo({
    center: currentFeature.geometry.coordinates,
    zoom: 15
  });
}

/** Create popup */
function createPopUp(currentFeature) {
  const props = currentFeature.properties;

  const facilityName =
    clean(props.FACILITY_NAME) || clean(props.NAME) || 'Food Facility';

  const address1 = clean(props.SITE_ADDRESS);
  const address2 = clean(props.ADDRESS);
  const address = address1 || address2 || 'Address not available';

  const city = clean(props.CITY) || 'City not available';
  const phone = clean(props.PHONE);

  const popUps = document.getElementsByClassName('mapboxgl-popup');
  if (popUps[0]) popUps[0].remove();

  let html = `<h3>${facilityName}</h3><h4>${address}`;
  if (city) html += `, ${city}`;
  html += '</h4>';
  if (phone) {
    html += `<div>Phone: ${phone}</div>`;
  }

  new mapboxgl.Popup({ closeOnClick: false })
    .setLngLat(currentFeature.geometry.coordinates)
    .setHTML(html)
    .addTo(map);
}

/**
 * Geocoder (search bar) and nearest-store behavior
 */
if (typeof MapboxGeocoder === 'undefined') {
  console.error('MapboxGeocoder library not loaded – check HTML <script> tags.');
} else {
  const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    marker: false,
    placeholder: 'Search for a location'
  });
  map.addControl(geocoder, 'top-left');

  geocoder.on('result', (e) => {
    const searchCoords = e.result.geometry.coordinates;

    if (!stores || !stores.features) return;

    let nearest = null;
    let minDist = Infinity;

    stores.features.forEach((f) => {
      const storeCoords = f.geometry.coordinates;
      const dist = turf.distance(searchCoords, storeCoords);
      if (dist < minDist) {
        minDist = dist;
        nearest = f;
      }
    });

    if (!nearest) return;

    const bbox = getBbox(searchCoords, nearest.geometry.coordinates);
    map.fitBounds(bbox, { padding: 100, maxZoom: 14, duration: 1500 });

    flyToStore(nearest);
    createPopUp(nearest);

    const activeItem = document.getElementsByClassName('active');
    if (activeItem[0]) activeItem[0].classList.remove('active');

    const listing = document.getElementById(`listing-${nearest.properties.id}`);
    if (listing) listing.classList.add('active');
  });
}
