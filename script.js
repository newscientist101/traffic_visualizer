document.addEventListener('DOMContentLoaded', function () {
    const map = L.map('map').setView([32.4279, 53.6880], 5); // Centered on Iran

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    fetch('data/')
        .then(response => response.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'));
            const jsonFiles = links
                .map(link => link.getAttribute('href'))
                .filter(href => href && href.endsWith('.json'))
                .sort();

            if (jsonFiles.length === 0) {
                throw new Error('No JSON file found in the data directory.');
            }
            const jsonFilePath = jsonFiles[0];
            return Promise.all([
                fetch('provinces.geojson').then(response => response.json()),
                fetch('data/' + jsonFilePath).then(response => response.json())
            ]);
        })
        .then(([geojson, data]) => {
        console.log("Successfully loaded GeoJSON data:", geojson);
        console.log("Successfully loaded timeseries data:", data);
        const timestamps = data.result.main.timestamps;
        const provinceData = data.result.main;

        let geojsonLayer;
            let hoveredLayer = null;

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

        function getGradientColor(value) {
            let r, g, b;
            if (value <= 50) {
                const ratio = value / 50;
                r = 255;
                g = 255;
                b = Math.round(255 * (1 - ratio));
            } else {
                const ratio = (value - 50) / 50;
                r = Math.round(255 * (1 - ratio));
                g = Math.round(255 - (255 - 128) * ratio);
                b = 0;
            }
            return `rgb(${r},${g},${b})`;
        }

        function getProvinceValue(geoJsonProvinceName, timestampIndex) {
            const dataProvinceName = provinceNameMapping[geoJsonProvinceName] || geoJsonProvinceName;
            let dataValues = provinceData[dataProvinceName] || provinceData[geoJsonProvinceName];
            if (!dataValues) {
                dataValues = provinceData['other'];
            }
            return dataValues ? parseFloat(dataValues[timestampIndex]) : 0;
        }

        function style(feature) {
            const value = getProvinceValue(feature.properties.shapeName, 0);
            return {
                fillColor: getGradientColor(value),
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
                const value = getProvinceValue(geoJsonProvinceName, timestampIndex);
                layer.setStyle({
                    fillColor: getGradientColor(value)
                });
            });

            if (hoveredLayer) {
                const geoJsonProvinceName = hoveredLayer.feature.properties.shapeName;
                const value = getProvinceValue(geoJsonProvinceName, timestampIndex);
                hoveredLayer.setTooltipContent(`${geoJsonProvinceName}<br>Value: ${value.toFixed(2)}%`);
            }
        }

        const legend = L.control({position: 'bottomright'});

        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = `
                <div class="legend-gradient"></div>
                <div class="legend-labels">
                    <span>0%</span>
                    <span>10%</span>
                    <span>20%</span>
                    <span>30%</span>
                    <span>40%</span>
                    <span>50%</span>
                    <span>60%</span>
                    <span>70%</span>
                    <span>80%</span>
                    <span>90%</span>
                    <span>100%</span>
                </div>
            `;
            return div;
        };

        legend.addTo(map);

        geojsonLayer.eachLayer(layer => {
            layer.on({
                mouseover: function (e) {
                    const layer = e.target;
                        hoveredLayer = layer;
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
                    const timestampIndex = slider.value;
                    const value = getProvinceValue(geoJsonProvinceName, timestampIndex);
                    layer.bindTooltip(`${geoJsonProvinceName}<br>Value: ${value.toFixed(2)}%`).openTooltip();
                },
                mouseout: function (e) {
                    geojsonLayer.resetStyle(e.target);
                    e.target.closeTooltip();
                        hoveredLayer = null;
                }
            });
        });

    }).catch(error => {
        console.error('Error loading data:', error);
        console.error('Failed to load GeoJSON or timeseries data. Please check file paths and network connectivity.');
    });
});
