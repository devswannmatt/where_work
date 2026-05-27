function initJobMap() {
  const mapElement = document.getElementById('map');
  const mapSection = document.querySelector('.map-section');

  if (!mapElement || !mapSection || typeof google === 'undefined') {
    return;
  }

  const latInput = document.getElementById('lat-input');
  const lngInput = document.getElementById('lng-input');
  const addressInput = document.getElementById('address-input');

  const initialLat = Number.parseFloat(mapSection.dataset.lat);
  const initialLng = Number.parseFloat(mapSection.dataset.lng);

  const center = {
    lat: Number.isFinite(initialLat) ? initialLat : 51.5072,
    lng: Number.isFinite(initialLng) ? initialLng : -0.1276,
  };

  const map = new google.maps.Map(mapElement, {
    center,
    zoom: Number.isFinite(initialLat) && Number.isFinite(initialLng) ? 15 : 8,
  });
  const geocoder = new google.maps.Geocoder();

  const marker = new google.maps.Marker({
    map,
    position: center,
    draggable: true,
  });

  function setPosition(location) {
    map.setCenter(location);
    map.setZoom(17);
    marker.setPosition(location);
    updateLatLng(location);
  }

  function updateLatLng(position) {
    if (latInput) {
      latInput.value = position.lat().toFixed(6);
    }
    if (lngInput) {
      lngInput.value = position.lng().toFixed(6);
    }
  }

  marker.addListener('dragend', () => {
    updateLatLng(marker.getPosition());
  });

  map.addListener('click', (event) => {
    marker.setPosition(event.latLng);
    updateLatLng(event.latLng);
  });

  function geocodeAddress() {
    if (!addressInput) {
      return;
    }

    const address = addressInput.value.trim();
    if (!address) {
      return;
    }

    geocoder.geocode({ address }, (results, status) => {
      if (status !== 'OK' || !results || !results[0]) {
        return;
      }

      setPosition(results[0].geometry.location);
    });
  }

  if (addressInput) {
    if (google.maps.places && google.maps.places.Autocomplete) {
      const autocomplete = new google.maps.places.Autocomplete(addressInput);

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();

        if (!place.geometry || !place.geometry.location) {
          return;
        }

        setPosition(place.geometry.location);
      });
    }

    addressInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        geocodeAddress();
      }
    });

    addressInput.addEventListener('blur', geocodeAddress);
  }

  if (Number.isFinite(initialLat) && Number.isFinite(initialLng)) {
    updateLatLng(marker.getPosition());
  }
}

window.initJobMap = initJobMap;
