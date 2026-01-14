document.addEventListener('DOMContentLoaded', function () {
    const map = L.map('map').setView([32.4279, 53.6880], 5); // Centered on Iran

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    Promise.all([
        fetch('provinces.geojson').then(response => response.json()),
        fetch('data_v1.json').then(response => response.json())
    ]).then(([geojson, data]) => {
        console.log("Successfully loaded GeoJSON data:", geojson);
        console.log("Successfully loaded timeseries data:", data);
        const timestamps = data.result.main.timestamps;
        const provinceData = data.result.main;

        let geojsonLayer;

        const provinceNameMapping = {
            "Alborz": "7648907",
            "Bushehr": "139816",
            "East Azerbaijan": "142549",
            "Fars": "134766",
            "Gilan": "133349",
            "Hamadan": "132142",
            "Hormozgan": "131222",
            "Isfahan": "418862",
            "Kerman": "128231",
            "Khuzestan": "127082",
            "Markazi": "124763",
            "Mazandaran": "124544",
            "Qazvin": "443793",
            "Qom": "443794",
            "Razavi Khorasan": "6201375",
            "Semnan": "116401",
            "Tehran": "110791",
            "West Azerbaijan": "142550",
            "Zanjan": "111452"
        };

        function getColor(d) {
            return d > 80 ? '#800026' :
                   d > 60 ? '#BD0026' :
                   d > 40 ? '#E31A1C' :
                   d > 20 ? '#FC4E2A' :
                   d > 0  ? '#FD8D3C' :
                            '#FFEDA0';
        }

        function style(feature) {
            const geoJsonProvinceName = feature.properties.shapeName;
            const dataProvinceName = provinceNameMapping[geoJsonProvinceName] || geoJsonProvinceName;
            const dataValues = provinceData[dataProvinceName] || provinceData[geoJsonProvinceName];
            const value = dataValues ? parseFloat(dataValues[0]) : 0;
            console.log(`Styling ${geoJsonProvinceName} (mapped to ${dataProvinceName}) with initial value: ${value}`);
            return {
                fillColor: getColor(value),
                weight: 2,
                opacity: 1,
                color: 'white',
                dashArray: '3',
                fillOpacity: 0.7
            };
        }

        geojsonLayer = L.geoJson(geojson, {style: style}).addTo(map);

        const slider = document.getElementById('timeline-slider');
        slider.max = timestamps.length - 1;

        slider.addEventListener('input', (e) => {
            const timestampIndex = e.target.value;
            updateMap(timestampIndex);
        });

        let animationInterval = setInterval(animateSlider, 200);

        function animateSlider() {
            let currentValue = parseInt(slider.value);
            let maxValue = parseInt(slider.max);
            let nextValue = (currentValue + 1) % (maxValue + 1);
            slider.value = nextValue;
            updateMap(nextValue);
        }

        slider.addEventListener('mousedown', () => {
            clearInterval(animationInterval);
        });

        function updateMap(timestampIndex) {
            document.getElementById('datetime-display').innerText = new Date(timestamps[timestampIndex]).toLocaleString();
            geojsonLayer.eachLayer((layer) => {
                const geoJsonProvinceName = layer.feature.properties.shapeName;
                const dataProvinceName = provinceNameMapping[geoJsonProvinceName] || geoJsonProvinceName;
                const dataValues = provinceData[dataProvinceName] || provinceData[geoJsonProvinceName];
                const value = dataValues ? parseFloat(dataValues[timestampIndex]) : 0;
                console.log(`Updating ${geoJsonProvinceName} (mapped to ${dataProvinceName}) at index ${timestampIndex} with value: ${value}`);
                layer.setStyle({
                    fillColor: getColor(value)
                });
            });
        }

        const legend = L.control({position: 'bottomright'});

        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend'),
                grades = [0, 20, 40, 60, 80],
                labels = [];

            for (let i = 0; i < grades.length; i++) {
                div.innerHTML +=
                    '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
                    grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + '<br>' : '+');
            }

            return div;
        };

        legend.addTo(map);

        geojsonLayer.eachLayer(layer => {
            layer.on({
                mouseover: function (e) {
                    const layer = e.target;
                    layer.setStyle({
                        weight: 5,
                        color: '#666',
                        dashArray: '',
                        fillOpacity: 0.7
                    });
                    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                        layer.bringToFront();
                    }
                    const geoJsonProvinceName = layer.feature.properties.shapeName;
                    const dataProvinceName = provinceNameMapping[geoJsonProvinceName] || geoJsonProvinceName;
                    const timestampIndex = slider.value;
                    const dataValues = provinceData[dataProvinceName] || provinceData[geoJsonProvinceName];
                    const value = dataValues ? parseFloat(dataValues[timestampIndex]) : 0;
                    layer.bindTooltip(`${geoJsonProvinceName}<br>Value: ${value.toFixed(2)}%`).openTooltip();
                },
                mouseout: function (e) {
                    geojsonLayer.resetStyle(e.target);
                    e.target.closeTooltip();
                }
            });
        });

    }).catch(error => {
        console.error('Error loading data:', error);
        console.error('Failed to load GeoJSON or timeseries data. Please check file paths and network connectivity.');
    });
});
