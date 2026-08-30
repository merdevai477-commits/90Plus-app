/** Inline HTML for the in-app Google Maps picker (WebView). */
export function buildMapPickerHtml(apiKey: string, labels: { myLocation: string }): string {
  const myLocation = JSON.stringify(labels.myLocation);
  const key = JSON.stringify(apiKey);
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body { margin: 0; height: 100%; background: #080512; }
      #map { width: 100%; height: 100%; }
      #myLoc {
        display: none;
      }
      #hint {
        position: absolute;
        bottom: 12px;
        left: 12px;
        right: 12px;
        z-index: 2;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(8,5,18,0.88);
        color: #c9b8e8;
        font: 400 12px system-ui, sans-serif;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <button id="myLoc" type="button"></button>
    <div id="hint"></div>
    <div id="map"></div>
    <script>
      function post(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }
      const API_KEY = ${key};
      const MY_LOC_LABEL = ${myLocation};
      let map, marker, geocoder, picking = false;

      document.getElementById('myLoc').textContent = MY_LOC_LABEL;

      function reverseGeocode(latLng) {
        if (!geocoder) return;
        geocoder.geocode({ location: latLng }, function (results, status) {
          if (status === 'OK' && results && results[0]) {
            post({
              type: 'address',
              address: results[0].formatted_address,
              lat: latLng.lat(),
              lng: latLng.lng(),
            });
          } else {
            post({ type: 'error', code: 'GEOCODE' });
          }
        });
      }

      function setPosition(latLng, pan) {
        if (!marker) return;
        marker.setPosition(latLng);
        if (pan) map.panTo(latLng);
        reverseGeocode(latLng);
      }

      function initMap() {
        geocoder = new google.maps.Geocoder();
        const cairo = { lat: 30.0444, lng: 31.2357 };
        map = new google.maps.Map(document.getElementById('map'), {
          center: cairo,
          zoom: 14,
          disableDefaultUI: false,
          gestureHandling: 'greedy',
        });
        marker = new google.maps.Marker({ map, position: cairo, draggable: true });
        reverseGeocode(new google.maps.LatLng(cairo.lat, cairo.lng));

        map.addListener('click', function (e) {
          setPosition(e.latLng, false);
        });
        marker.addListener('dragend', function () {
          setPosition(marker.getPosition(), false);
        });

        document.getElementById('myLoc').addEventListener('click', function () {
          post({ type: 'locateMe' });
        });

        window.setMapPosition = function (lat, lng) {
          if (!map || !marker) return;
          const latLng = new google.maps.LatLng(lat, lng);
          setPosition(latLng, true);
          map.setZoom(16);
        };

        post({ type: 'ready' });
      }

      window.gm_authFailure = function () {
        post({ type: 'error', code: 'AUTH' });
      };

      const script = document.createElement('script');
      script.src =
        'https://maps.googleapis.com/maps/api/js?key=' +
        encodeURIComponent(API_KEY) +
        '&callback=initMap';
      script.async = true;
      script.defer = true;
      script.onerror = function () {
        post({ type: 'error', code: 'SCRIPT' });
      };
      document.head.appendChild(script);
    </script>
  </body>
</html>`;
}
