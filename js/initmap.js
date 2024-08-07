let layerDefinitions = {};
let layerCounter = 0;
let parcelMarker;
let parcelTimeout;
let systemLayers = [];
let isDataLoaded = false;

mapboxgl.accessToken = 'pk.eyJ1IjoiYXp6b2NvcnAiLCJhIjoiY2x4MDVtdnowMGlncjJqcmFhbjhjaDhidiJ9.iNiKldcG83Nr02956JPbTA';
const customMarkerIcon = 'css/images/egliseO.png';

let map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/azzocorp/clxfnkj8a005j01qr2fjue7bj',
    center: [-63.613927, 2.445929],
    zoom: 0
});

map.on('load', function () {
    console.log('Loading GeoJSON data for cadastre-parcelles...');
    fetch('datas/geojson/cadastre-2A247-parcelles.json')
        .then(response => response.json())
        .then(data => {
            data.features.forEach((feature, index) => {
                feature.id = index;
            });

            map.addSource('cadastre-parcelles', {
                type: 'geojson',
                data: data
            });

            map.addLayer({
                id: 'cadastre-parcelles-layer',
                type: 'line',
                source: 'cadastre-parcelles',
                minzoom: 14,
                maxzoom: 22,
                paint: {
                    'line-color': '#ffffff',
                    'line-width': 0.01
                }
            });

            map.addLayer({
                id: 'cadastre-parcelles-hover',
                type: 'fill',
                source: 'cadastre-parcelles',
                minzoom: 12,
                maxzoom: 22,
                paint: {
                    'fill-color': '#ffffff',
                    'fill-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        0.5,
                        0
                    ]
                }
            });

            map.addLayer({
                id: 'cadastre-parcelles-labels',
                type: 'symbol',
                source: 'cadastre-parcelles',
                minzoom: 12,
                maxzoom: 22,
                layout: {
                    'text-field': [
                        'concat',
                        ['get', 'section'], ' ', ['get', 'numero'], '\n',
                        ['get', 'contenance'], ' m²'
                    ],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 12,
                    'text-offset': [0, 0.6],
                    'text-anchor': 'top',
                    'visibility': 'none'
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 1
                }
            });

            map.addLayer({
                id: 'highlighted-parcel',
                type: 'line',
                source: 'cadastre-parcelles',
                layout: {},
                paint: {
                    'line-color': '#ff0000',
                    'line-width': 4
                },
                'filter': ['==', 'id', '']
            });

            let hoveredStateId = null;

            map.on('mousemove', 'cadastre-parcelles-hover', function(e) {
                if (e.features.length > 0) {
                    if (hoveredStateId !== null && hoveredStateId !== e.features[0].id) {
                        map.setFeatureState(
                            { source: 'cadastre-parcelles', id: hoveredStateId },
                            { hover: false }
                        );
                    }
                    hoveredStateId = e.features[0].id;
                    map.setFeatureState(
                        { source: 'cadastre-parcelles', id: hoveredStateId },
                        { hover: true }
                    );

                    map.setFilter('cadastre-parcelles-labels', ['==', ['id'], hoveredStateId]);
                    map.setLayoutProperty('cadastre-parcelles-labels', 'visibility', 'visible');
                }
            });

            map.on('mouseleave', 'cadastre-parcelles-hover', function() {
                if (hoveredStateId !== null) {
                    map.setFeatureState(
                        { source: 'cadastre-parcelles', id: hoveredStateId },
                        { hover: false }
                    );
                }
                hoveredStateId = null;

                map.setLayoutProperty('cadastre-parcelles-labels', 'visibility', 'none');
            });

            const parcelRefs = getUrlParameter('r');
            if (parcelRefs) {
                const formattedParcelRefs = parseAndReformatParcelRefs(parcelRefs);
                const parcels = parseSearchInput(formattedParcelRefs);
                if (parcels.length > 0) {
                    document.getElementById('search-input').value = formattedParcelRefs;
                    animateView(() => highlightParcels(parcels));
                } else {
                    console.error('Invalid URL parameter. Please enter valid parcel references.');
                }
            }

            // Set the data loaded flag to true and log
            isDataLoaded = true;
            console.log('Data for cadastre-parcelles fully loaded');

            // Populate the "Demandes" tab
            populateDepotsList();
        })
        .catch(error => {
            console.error('Error loading GeoJSON data:', error);
        });

    // Add the commune polygon source and layer
    if (!map.getSource('commune-polygon')) {
        fetch('datas/geojson/cadastre-2A247-communes.json')
            .then(response => response.json())
            .then(data => {
                map.addSource('commune-polygon', {
                    type: 'geojson',
                    data: data
                });

                map.addLayer({
                    id: 'commune-polygon-layer',
                    type: 'line',
                    source: 'commune-polygon',
                    paint: {
                        'line-color': '#FFFFFF', // Blue color
                        'line-width': 5,
                        'line-opacity': 0.35
                    }
                });
            })
            .catch(error => {
                console.error('Error loading commune polygon GeoJSON:', error);
            });
    }

    // Adding the GeoJSON source for depots
    const depotsSource = 'depots-parcelles';
    if (!map.getSource(depotsSource)) {
        map.addSource(depotsSource, {
            type: 'geojson',
            data: 'datas/urbanism/output_depots.geojson',
        });

        map.addLayer({
            id: 'depots-layer',
            type: 'fill',
            source: depotsSource,
            layout: {},
            paint: {
                'fill-color': '#FF00FF', // Flashy magenta color
                'fill-opacity': 1,
            },
        });

        // Popup for the depots layer
		map.on('click', 'depots-layer', function(e) {
			const properties = e.features[0].properties;
			let content = '<div class="popup-content depot-popup">';
			// ... rest of your content generation

			if (properties.depots && properties.depots.length > 0) {
				let depots = properties.depots;
				if (typeof depots === 'string') {
					try {
						depots = JSON.parse(depots);
					} catch (error) {
						console.error('Failed to parse depots:', depots, error);
					}
				}

				if (Array.isArray(depots) && depots.length > 0) {
					depots.forEach(depot => {
						if (Array.isArray(depot)) {
							const [dateReceived, permitNumber, dateIssued, owner, address, area, description, additionalInfo] = depot;
							const squareMeters = extractSquareMeters(additionalInfo);
							const difference = (squareMeters[0] - squareMeters[1]).toFixed(2);
							const groupItems = extractGroupItems(address);
							const parcelInfo = getParcelInfo(groupItems, [e.features[0]], groupItems[0]);

							content += `
								<div class="depot-data">
									<strong>${difference} m² = ${squareMeters[0]} m² - ${squareMeters[1]} m²</strong><br>
									<div class="nomdeposant">${owner}</div>
									<strong>${permitNumber}</strong><i> reçue le </i><strong>${dateReceived}</strong><br>
									${parcelInfo}
									<br><strong>Adresse </strong>${address}<br>
									<div class="desc"><strong>DESCRIPTION</strong></div>${description}<br>
									${additionalInfo}
								</div>
								<div class="textrmq">ID <strong>${properties.id}</strong> commune <strong>${properties.commune}</strong>
								<br>arpenté <strong>${properties.arpente}</strong>
								créée <strong>${properties.created}</strong> màj <strong>${properties.updated}</strong><br>
								</div>
							`;
						}
					});
				} else {
					content += '<p>No valid depot information available.</p>';
				}
			} else {
				content += '<p>No depot information available.</p>';
			}

			content += '</div>';

			new mapboxgl.Popup()
				.setLngLat(e.lngLat)
				.setHTML(content)
				.addTo(map);
		});


        // Change the cursor to pointer when hovering over the depots layer
        map.on('mouseenter', 'depots-layer', function() {
            map.getCanvas().style.cursor = 'pointer';
        });

        // Change it back to default when no longer hovering over the depots layer
        map.on('mouseleave', 'depots-layer', function() {
            map.getCanvas().style.cursor = '';
        });
    }
});
						
map.on('load', async function() {
    // Adding the second GeoJSON source
    const depotsSource = 'depots-parcelles';
    if (!map.getSource(depotsSource)) {
        map.addSource(depotsSource, {
            type: 'geojson',
            data: 'datas/urbanism/output_depots.geojson',
        });

        map.addLayer({
            id: 'depots-layer',
            type: 'fill',
            source: depotsSource,
            layout: {},
            paint: {
                'fill-color': '#FF00FF', // Flashy magenta color
                'fill-opacity': 1,
            },
        });

        // Popup for the second layer
        map.on('click', 'depots-layer', function(e) {
            const properties = e.features[0].properties;

            // Create a content string for the popup
            let content = '<h3>Property Details</h3>';
            content += `<strong>ID:</strong> ${properties.id}<br>`;
            content += `<strong>Commune:</strong> ${properties.commune}<br>`;
            content += `<strong>Prefix:</strong> ${properties.prefixe}<br>`;
            content += `<strong>Section:</strong> ${properties.section}<br>`;
            content += `<strong>Number:</strong> ${properties.numero}<br>`;
            content += `<strong>Contenance:</strong> ${properties.contenance} m²<br>`;
            content += `<strong>Arpente:</strong> ${properties.arpente}<br>`;
            content += `<strong>Created:</strong> ${properties.created}<br>`;
            content += `<strong>Updated:</strong> ${properties.updated}<br>`;

            // Check if depots is a string and parse it
            let depots = properties.depots;
            if (typeof depots === 'string') {
                try {
                    depots = JSON.parse(depots);
                } catch (error) {
                    console.error('Failed to parse depots:', depots, error);
                }
            }

            // Check if depots is now an array
            if (Array.isArray(depots)) {
                content += '<h3>Depots:</h3><ul>';
                depots.forEach(depot => {
                    if (Array.isArray(depot)) {
                        content += '<li>';
                        content += `<strong>Date Received:</strong> ${depot[0]}<br>`;
                        content += `<strong>Permit Number:</strong> ${depot[1]}<br>`;
                        content += `<strong>Date Issued:</strong> ${depot[2]}<br>`;
                        content += `<strong>Owner:</strong> ${depot[3]}<br>`;
                        content += `<strong>Address:</strong> ${depot[4]}<br>`;
                        content += `<strong>Area:</strong> ${depot[5]}<br>`;
                        content += `<strong>Description:</strong> ${depot[6]}<br>`;
                        content += `<strong>Additional Info:</strong> ${depot[7].replace(/\\r\\n/g, '<br>')}<br>`;
                        content += '</li>';
                    } else {
                        console.error('Depot entry is not an array:', depot);
                    }
                });
                content += '</ul>';
            } else {
                console.error('Properties depots is not an array:', depots);
            }

            new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(content)
                .addTo(map);
        });

        // Change the cursor to pointer when hovering over the second layer
        map.on('mouseenter', 'depots-layer', function() {
            map.getCanvas().style.cursor = 'pointer';
        });

        // Change it back to default when no longer hovering over the second layer
        map.on('mouseleave', 'depots-layer', function() {
            map.getCanvas().style.cursor = '';
        });
    }
});

map.on('load', async function() {
    // Adding the GeoJSON source for favorable decisions
    const favorablesSource = 'favorables-parcelles';
    if (!map.getSource(favorablesSource)) {
        map.addSource(favorablesSource, {
            type: 'geojson',
            data: 'datas/urbanism/output_decisions.geojson',
        });

        map.addLayer({
            id: 'favorables-layer',
            type: 'fill',
            source: favorablesSource,
            layout: {},
            paint: {
                'fill-color': '#00FFFF', // Light cyan color
                'fill-opacity': 1,
            },
        });

        // Popup for the favorables layer
		map.on('click', 'favorables-layer', function(e) {
			const properties = e.features[0].properties;
			let content = '<div class="popup-content decision-popup">';
			// ... rest of your content generation


			if (properties.decisions && properties.decisions.length > 0) {
				let decisions = properties.decisions;
				if (typeof decisions === 'string') {
					try {
						decisions = JSON.parse(decisions);
					} catch (error) {
						console.error('Failed to parse decisions:', decisions, error);
					}
				}

				if (Array.isArray(decisions) && decisions.length > 0) {
					decisions.forEach(decision => {
						if (Array.isArray(decision)) {
							const [dateDecision, permitNumber, dateIssued, owner, address, area, description, additionalInfo, decisionComplement, refParcelle, surfaceNet] = decision;
							const squareMeters = extractSquareMeters(surfaceNet);
							const difference = (squareMeters[0] - squareMeters[1]).toFixed(2);
							const groupItems = extractGroupItems(address);
							const parcelInfo = getParcelInfo(groupItems, [e.features[0]], groupItems[0]);

							content += `
								<div class="decision-data">
									<strong>${difference} m² = ${squareMeters[0]} m² - ${squareMeters[1]} m²</strong><br>
									<div class="nomdeposantF">${owner}</div>
									<strong>${permitNumber}</strong><i> décidée le </i><strong>${dateDecision}</strong><br>
									${parcelInfo}
									<br><strong>Adresse </strong>${address}<br>
									<div class="desc"><strong>DESCRIPTION</strong></div>${description}<br>
									${additionalInfo}
									<br><strong>Décision: </strong>${decisionComplement}<br>
								</div>
								<div class="textrmq">ID <strong>${properties.id}</strong> commune <strong>${properties.commune}</strong>
								<br>arpenté <strong>${properties.arpente}</strong>
								créée <strong>${properties.created}</strong> màj <strong>${properties.updated}</strong><br>
								</div>
							`;
						}
					});
				} else {
					content += '<p>No valid decision information available.</p>';
				}
			} else {
				content += '<p>No decision information available.</p>';
			}

			content += '</div>';

			new mapboxgl.Popup()
				.setLngLat(e.lngLat)
				.setHTML(content)
				.addTo(map);
		});


        // Change the cursor to pointer when hovering over the favorables layer
        map.on('mouseenter', 'favorables-layer', function() {
            map.getCanvas().style.cursor = 'pointer';
        });

        // Change it back to default when no longer hovering over the favorables layer
        map.on('mouseleave', 'favorables-layer', function() {
            map.getCanvas().style.cursor = '';
        });
    }
});


map.on('load', () => {
    map.loadImage('css/images/egliseO.png', (error, image) => {
        if (error) throw error;
        map.addImage('marker-15', image);
    });
});

map.once('idle', () => {
    updateLayerList();
	adjustLayerNameWidths();
});
/* map.on('idle', () => {
	adjustLayerNameWidths();
});
 */


document.getElementById('search-btn').addEventListener('click', function() {
    if (!isDataLoaded) {
        console.error('Data is not fully loaded. Please wait and try again.');
        return;
    }
    var searchInput = document.getElementById('search-input').value.trim();
    var formattedSearchInput = parseAndReformatParcelRefs(searchInput); // Reformat the input
    console.log('Formatted search input:', formattedSearchInput);
    document.getElementById('search-input').value = formattedSearchInput; // Update the input box with formatted value
    var parcels = parseSearchInput(formattedSearchInput);
    console.log('Parsed parcels:', parcels);
    if (parcels.length > 0) {
        zoomOutToCenterCommune(() => {
            highlightParcels(parcels);
        });
    } else {
        console.error('Invalid search input. Please enter valid parcel references.');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabBodies = document.querySelector('.tab-bodies');
    hideTabs();
    tabButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const tabId = button.getAttribute('data-tab');
            handleTabClick(tabId);
        });
    });

    const addButton = document.getElementById('add-btn');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.geojson';
    fileInput.style.display = 'none';

    addButton.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', handleFileSelect);
    document.body.appendChild(fileInput);

 
});

document.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.getElementById('save-btn');
    const loadButton = document.getElementById('load-btn');
    const resetButton = document.getElementById('reset-btn');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';

    saveButton.addEventListener('click', saveLayers);
    loadButton.addEventListener('click', () => fileInput.click());
    resetButton.addEventListener('click', resetLayers);
    fileInput.addEventListener('change', loadLayers);
    document.body.appendChild(fileInput);
});

document.addEventListener('click', function(event) {
    if (event.target.classList.contains('locate-btn') || event.target.classList.contains('locate-btnF')) {
        if (!isDataLoaded) {
            console.error('Data is not fully loaded. Please wait and try again.');
            return;
        }
        const section = event.target.getAttribute('data-section');
        const numero = event.target.getAttribute('data-numero');
        const groupItems = event.target.getAttribute('data-group-items');
        const searchInput = groupItems ? groupItems : `${section}${numero}`;

        document.getElementById('search-input').value = searchInput;
       
        zoomOutToCenterCommune(() => {
            highlightParcels(parseSearchInput(searchInput));
        });
    }
});



function getParcelInfo(groupItems, features, headParcel) {
    let totalArea = 0;
    let parcelInfo = 'Parcelle ';
    
    // Add head parcel first
    const headFeature = features.find(f => `${f.properties.section} ${f.properties.numero}` === headParcel);
    if (headFeature) {
        const area = headFeature.properties.contenance || 0;
        parcelInfo += `<strong>${headParcel}</strong> (${area} m²)`;
        totalArea += area;
    }
    
    // Add other parcels
    groupItems.forEach(item => {
        if (item !== headParcel) {
            const feature = features.find(f => `${f.properties.section} ${f.properties.numero}` === item);
            if (feature) {
                const area = feature.properties.contenance || 0;
                parcelInfo += ` + ${item} (${area} m²)`;
                totalArea += area;
            }
        }
    });
    
    parcelInfo += ` = ${totalArea} m²`;
    return parcelInfo;
}

function extractGroupItems(address) {
    const match = address.match(/$$(.*?)$$/);
    if (match) {
        return match[1].split(', ');
    }
    return [];
}

function showOrphanedItemsPopup(orphanedData, type) {
    // Remove any existing popup
    const existingPopup = document.querySelector('.orphaned-items-popup, .orphaned-itemsD-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    const popup = document.createElement('div');
    popup.className = type === 'Décisions' ? 'orphaned-itemsD-popup' : 'orphaned-items-popup';

    popup.innerHTML = `
        <div class="popup-header">
            <h2>${type} sans parcelles renseignées (${orphanedData.length})</h2>
            <button id="close-popup" class="close-button">&times;</button>
        </div>
        <p class="popup-subheader">ou, parcelles erronées,<br>ou, nouvelle division parcellaire non encore màj dans le cadastre.</p>
        <ul>
            ${orphanedData.map(item => `
                <li>
                    <strong>${item['id Autorisation']}</strong> - ${item['Demandeur']}<br>
                    Date de décision: ${item['Affichage']}<br>
                    Adresse: ${item['Lieu']}<br>
                    Description: ${item['Travaux']}<br>
                    Surface: ${item['Surface']}<br>
                    ${item['Ref Parcelle'] && item['Ref Parcelle'].length > 0 
                        ? `Parcelles: ${item['Ref Parcelle'].join(', ')}<br>` 
                        : ''}
                </li>
            `).join('')}
        </ul>
    `;

    document.body.appendChild(popup);

    document.getElementById('close-popup').addEventListener('click', () => {
        popup.remove();
    });
}





function handleTabClick(tabId) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }	
    const tabContents = document.querySelectorAll('.tab-content');
    const tabBodies = document.querySelector('.tab-bodies');
    const mapElement = document.getElementById('map');
    const tabsContainer = document.querySelector('.tabs');

    // Hide all tab contents and reset styles
    tabContents.forEach(content => content.style.display = 'none');
    tabBodies.style.display = 'none';
    tabBodies.style.visibility = 'hidden';
    //tabsContainer.style.height = '30px';
    mapElement.style.pointerEvents = 'auto';

    // Show the selected tab content
    if (tabId !== 'tab1') {
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
            targetTab.style.display = 'block';
        }
        tabBodies.style.display = 'flex';
        tabBodies.style.visibility = 'visible';
        tabsContainer.style.height = 'auto';
        // Remove this line to keep map interactions enabled
        // mapElement.style.pointerEvents = 'none'; // Disable map interactions when a tab is open
    }

    // Highlight the active tab button
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(btn => btn.classList.remove('active-tab'));
    document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active-tab');

    // Load specific content based on the tab
    if (tabId === 'tab6') {
        //loadReadme();
    } else if (tabId === 'tab7') {
        //loadinfo();
    } else if (tabId === 'tab5') {
        populateFavorablesList();
    } else if (tabId === 'tab4') {
        populateDepotsList();
    }
}

function getParcelInfo(groupItems, features) {
    const parcelData = {};

    // Collect the contenance for each parcel in the group
    features.forEach(feature => {
        const properties = feature.properties;
        const parcelId = `${properties.section} ${properties.numero}`;
        parcelData[parcelId] = properties.contenance || 0;
    });

    let totalArea = 0;
    const headParcel = groupItems[0];
    const headParcelArea = parcelData[headParcel] || 0;
    totalArea += headParcelArea;

    const parcelDescriptions = groupItems.filter(parcel => parcel !== headParcel).map(parcel => {
        const area = parcelData[parcel] || 0;
        totalArea += area;
        return `${parcel} (${area} m²)`;
    });

    const aussiSur = parcelDescriptions.length > 0 ? ` + ${parcelDescriptions.join(' + ')}` : '';
    
    // Conditionally append total area information only if there are child parcels
    const totalAreaInfo = parcelDescriptions.length > 0 ? ` = ${totalArea} m²` : '';

    return `Parcelle ${headParcel} (${headParcelArea} m²)${aussiSur}${totalAreaInfo}`;
}

async function populateDepotsList() {
    if (OnOff()) {
        console.log('>>>> ' + arguments.callee.name + '() <= fonction utilisée');
    }
    const depotsContainer = document.getElementById('Demandes');
    if (!depotsContainer) {
        console.error('Élément avec ID "Demandes" non trouvé.');
        return;
    }
    depotsContainer.innerHTML = ''; // Effacer le contenu existant

    const depotsSource = map.getSource('depots-parcelles');
    if (depotsSource) {
        try {
            const depotsData = await fetch('datas/urbanism/output_depots.geojson').then(response => response.json());
            const features = depotsData.features;

            console.log(`Total des entités : ${features.length}`);

            let elementsInclus = 0;
            const groupedItems = {};
            const groupingLog = [];
            const depotCounts = {};

            features.forEach(feature => {
                const properties = feature.properties;

                if (Array.isArray(properties.depots) && properties.depots.length > 0) {
                    properties.depots.forEach(depot => {
                        if (Array.isArray(depot)) {
                            elementsInclus++;
                            const groupItems = extractGroupItems(depot[4]);
                            const headParcel = groupItems[0]; // La première parcelle est considérée comme la principale
                            const depotId = depot[1]; // Utiliser le numéro de dépôt comme identifiant

                            depotCounts[depotId] = (depotCounts[depotId] || 0) + 1;

                            if (!groupedItems[headParcel]) {
                                groupedItems[headParcel] = {
                                    properties: properties,
                                    depot: depot,
                                    groupItems: groupItems
                                };
                                groupingLog.push(`Nouveau groupe créé : ${headParcel} (Dépôt: ${depotId})`);
                            } else {
                                groupingLog.push(`Élément ajouté au groupe existant : ${headParcel} (Dépôt: ${depotId})`);
                            }
                        }
                    });
                }
            });

            console.log("Log de regroupement :");
            console.log(groupingLog.join('\n'));

            const duplicateDepots = Object.entries(depotCounts).filter(([_, count]) => count > 1);
            console.log("Dépôts apparaissant dans plusieurs parcelles :", duplicateDepots);

            const listItems = [];

            for (const headParcel in groupedItems) {
                const group = groupedItems[headParcel];
                const properties = group.properties;
                const depot = group.depot;
                const groupItems = group.groupItems;

                const squareMeters = extractSquareMeters(depot[7]);
                const difference = (squareMeters[0] - squareMeters[1]).toFixed(2);
                const parcelInfo = getParcelInfo(groupItems, features, headParcel);

                const listItem = `
                    <div class="depot-group">
                        <div class="depot-data">
                            <strong>[${listItems.length + 1}] | ${difference} m² = ${squareMeters[0]} m² - ${squareMeters[1]} m²</strong><br>
                            <button class="locate-btn" data-section="${properties.section}" data-numero="${properties.numero}" data-group-items="${groupItems.join(' ')}">Trouver</button><div class="nomdeposant">${depot[3]}</div>
                            <strong>${depot[1]}</strong><i> reçue le </i><strong>${depot[0]}</strong><br>
                            ${parcelInfo}
                            <br><strong>Adresse </strong>${depot[4]}<br>
                            <div class="desc"><strong>DESCRIPTION</strong></div>${depot[6]}<br>
                            ${depot[7]}
                        </div>
                        <div class="textrmq">ID <strong>${properties.id}</strong> commune <strong>${properties.commune}</strong>
                        <br>arpenté <strong>${properties.arpente}</strong>
                        créée <strong>${properties.created}</strong> màj <strong>${properties.updated}</strong><br>
                    </div>
                `;
                listItems.push({ difference: parseFloat(difference), html: listItem });
            }

            // Trier par différence en ordre décroissant
            listItems.sort((a, b) => b.difference - a.difference);

            listItems.forEach((item, index) => {
                const listItemElement = document.createElement('div');
                listItemElement.className = 'list-item';
                listItemElement.innerHTML = item.html.replace(/$$$(\d+)$$$/, `[${listItems.length - index}]`);
                depotsContainer.appendChild(listItemElement);
            });

            // Fetch and count orphaned items
            let orphanedCount = 0;
            let orphanedData = [];
            try {
                const response = await fetch('./datas/urbanism/output_depots_orphans.json');
                if (response.ok) {
                    orphanedData = await response.json();
                    orphanedCount = orphanedData.length;
                }
            } catch (error) {
                console.error('Erreur lors du chargement des données orphelines:', error);
            }

            const totalTraite = elementsInclus + orphanedCount;

            const itemCountElement = document.createElement('div');
            itemCountElement.innerHTML = `
                <strong>Total des éléments traités :</strong> ${totalTraite}<br>
                <strong>Éléments inclus :</strong> ${elementsInclus}<br>
                <strong>Demandes sans parcelles renseignées :</strong> <a href="#" id="show-orphaned-items" class="orphaned-link" style="color: var(--nomdeposant-color);">${orphanedCount}</a><br>
                <strong>Nombre de groupes finaux :</strong> ${Object.keys(groupedItems).length}<br>
            `;
            depotsContainer.insertBefore(itemCountElement, depotsContainer.firstChild);

            // Add event listener for showing orphaned items
            document.getElementById('show-orphaned-items').addEventListener('click', (e) => {
                e.preventDefault();
                showOrphanedItemsPopup(orphanedData, "Demandes");
            });

            // Add event listeners for locate buttons
            depotsContainer.querySelectorAll('.locate-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const section = this.getAttribute('data-section');
                    const numero = this.getAttribute('data-numero');
                    const groupItems = this.getAttribute('data-group-items').split(' ');
                    locateParcel(section, numero, groupItems);
                });
            });

            console.log(`Éléments affichés : ${depotsContainer.querySelectorAll('.list-item').length}`);
        } catch (error) {
            console.error('Erreur lors du chargement des données de dépôt:', error);
        }
    } else {
        console.error('Source de dépôts non trouvée.');
    }
}

async function populateFavorablesList() {
    console.log('Début de populateFavorablesList');
    if (OnOff()) {
        console.log('>>>> ' + arguments.callee.name + '() <= fonction utilisée');
    }
    const favorablesContainer = document.getElementById('Décisions');
    if (!favorablesContainer) {
        console.error('Élément avec ID "Décisions" non trouvé.');
        return;
    }
    favorablesContainer.innerHTML = ''; // Effacer le contenu existant

    const favorablesSource = map.getSource('favorables-parcelles');
    if (favorablesSource) {
        try {
            console.log('Chargement des données favorables...');
            const favorablesData = await fetch('datas/urbanism/output_decisions.geojson').then(response => response.json());
            const features = favorablesData.features;

            console.log(`Total des entités : ${features.length}`);

            let elementsInclus = 0;
            const groupedItems = {};
            const groupingLog = [];
            const decisionCounts = {};

            features.forEach(feature => {
                const properties = feature.properties;

                if (Array.isArray(properties.decisions) && properties.decisions.length > 0) {
                    properties.decisions.forEach(decision => {
                        if (Array.isArray(decision)) {
                            elementsInclus++;
                            const groupItems = extractGroupItems(decision[4]);
                            const headParcel = groupItems[0]; // La première parcelle est considérée comme la principale
                            const decisionId = decision[1]; // Utiliser le numéro de décision comme identifiant

                            decisionCounts[decisionId] = (decisionCounts[decisionId] || 0) + 1;

                            if (!groupedItems[headParcel]) {
                                groupedItems[headParcel] = {
                                    properties: properties,
                                    decision: decision,
                                    groupItems: groupItems
                                };
                                groupingLog.push(`Nouveau groupe créé : ${headParcel} (Décision: ${decisionId})`);
                            } else {
                                groupingLog.push(`Élément ajouté au groupe existant : ${headParcel} (Décision: ${decisionId})`);
                            }
                        }
                    });
                }
            });

            console.log("Log de regroupement :");
            console.log(groupingLog.join('\n'));

            const duplicateDecisions = Object.entries(decisionCounts).filter(([_, count]) => count > 1);
            console.log("Décisions apparaissant dans plusieurs parcelles :", duplicateDecisions);

            const listItems = [];

            for (const headParcel in groupedItems) {
                const group = groupedItems[headParcel];
                const properties = group.properties;
                const decision = group.decision;
                const groupItems = group.groupItems;

                const squareMeters = extractSquareMeters(decision[10] || [0, 0]);
                const difference = (squareMeters[0] - squareMeters[1]).toFixed(2);
                const parcelInfo = getParcelInfo(groupItems, features, headParcel);

                const listItem = `
                    <div class="decision-group">
                        <div class="decision-data">
                            <strong>[${listItems.length + 1}] | ${difference} m² = ${squareMeters[0]} m² - ${squareMeters[1]} m²</strong><br>
                            <button class="locate-btnF" data-section="${properties.section}" data-numero="${properties.numero}" data-group-items="${groupItems.join(' ')}">Trouver</button><div class="nomdeposantF">${decision[3]}</div>
                            <strong>${decision[1]}</strong><i> reçue le </i><strong>${decision[2]}</strong><br>
                            ${parcelInfo}
                            <br><strong>Adresse </strong>${decision[4]}<br>
                            <div class="desc"><strong>DESCRIPTION</strong></div>${decision[6]}<br>
                            ${decision[7]}
                        </div>
                        <div class="textrmq">ID <strong>${properties.id}</strong> commune <strong>${properties.commune}</strong>
                        <br>arpenté <strong>${properties.arpente}</strong>
                        créée <strong>${properties.created}</strong> màj <strong>${properties.updated}</strong><br>
                    </div>
                `;
                listItems.push({ difference: parseFloat(difference), html: listItem });
            }

            // Trier par différence en ordre décroissant
            listItems.sort((a, b) => b.difference - a.difference);

            listItems.forEach((item, index) => {
                const listItemElement = document.createElement('div');
                listItemElement.className = 'list-item';
                listItemElement.innerHTML = item.html.replace(/$$$(\d+)$$$/, `[${listItems.length - index}]`);
                favorablesContainer.appendChild(listItemElement);
            });

            // Fetch and count orphaned items
            let orphanedCount = 0;
            let orphanedData = [];
            try {
                const response = await fetch('./datas/urbanism/output_decisions_orphans.json');
                if (response.ok) {
                    orphanedData = await response.json();
                    orphanedCount = orphanedData.length;
                }
            } catch (error) {
                console.error('Erreur lors du chargement des données orphelines:', error);
            }

            const totalTraite = elementsInclus + orphanedCount;

            const itemCountElement = document.createElement('div');
            itemCountElement.innerHTML = `
                <strong>Total des éléments traités :</strong> ${totalTraite}<br>
                <strong>Éléments inclus :</strong> ${elementsInclus}<br>
                <strong>Décisions sans parcelles renseignées :</strong> <a href="#" id="show-orphaned-decisions" class="orphaned-link" style="color: var(--nomdeposant-color);">${orphanedCount}</a><br>
                <strong>Nombre de groupes final :</strong> ${Object.keys(groupedItems).length}<br>
            `;
            favorablesContainer.insertBefore(itemCountElement, favorablesContainer.firstChild);

            // Add event listener for showing orphaned items
            document.getElementById('show-orphaned-decisions').addEventListener('click', (e) => {
                e.preventDefault();
                showOrphanedItemsPopup(orphanedData, "Décisions");
            });

            // Add event listeners for locate buttons
            favorablesContainer.querySelectorAll('.locate-btnF').forEach(button => {
                button.addEventListener('click', function() {
                    const section = this.getAttribute('data-section');
                    const numero = this.getAttribute('data-numero');
                    const groupItems = this.getAttribute('data-group-items').split(' ');
                    locateParcel(section, numero, groupItems);
                });
            });

            console.log(`Éléments affichés : ${favorablesContainer.querySelectorAll('.list-item').length}`);
        } catch (error) {
            console.error('Erreur lors du chargement des données favorables:', error);
        }
    } else {
        console.error('Source des favorables non trouvée.');
    }
    console.log('Fin de populateFavorablesList');
}


function extractSquareMeters(data) {
    if (Array.isArray(data) && data.length >= 2) {
        return data.map(value => parseFloat(value) || 0);
    }
    return [0, 0];
}


function extractGroupItems(address) {
    const firstMatch = address.match(/\((.*)/);
    if (firstMatch) {
        const afterFirstParenthesis = firstMatch[1];
        const secondMatch = afterFirstParenthesis.match(/(.*?)\)/);
        if (secondMatch) {
            const groupItemsString = secondMatch[1];
            const groupItems = groupItemsString.split(',').map(item => item.trim());
            return groupItems;
        }
    }
    return [];
}


function zoomOutToCenterCommune(callback) {
    const communeSource = map.getSource('commune-polygon');
    if (communeSource) {
        const communePolygon = communeSource._data;
        if (communePolygon) {
            // Calculate the centroid of the commune polygon using Turf.js
            const centroid = turf.centroid(communePolygon);
            const centroidCoordinates = centroid.geometry.coordinates;

            console.log('Centroid coordinates:', centroidCoordinates);

            // Center the map on the centroid
            map.flyTo({
                center: centroidCoordinates,
                zoom: 11,
                pitch: 0,
                bearing: 0,
                duration: 2000,
                essential: true
            });

            map.once('moveend', () => {
                if (callback) {
                    callback();
                }
            });
        } else {
            console.error('The data for "commune-polygon" is not available.');
        }
    } else {
        console.error('The source "commune-polygon" is not loaded.');
    }
}

function extendBounds(features, bounds) {
    if (OnOff()) { console.log('>>>>  ' + arguments.callee.name + '() <= function used'); }
    features.forEach(feature => {
        feature.geometry.coordinates[0].forEach(coord => {
            bounds.extend(coord);
        });
    });
    console.log('Extended bounds:', bounds);
}

function identifyNotFoundParcels(parcels, features, notFoundParcels) {
    if (OnOff()) { console.log('>>>>  ' + arguments.callee.name + '() <= function used'); }
    parcels.forEach(parcel => {
        const [section, numero] = parcel.trim().split(/\s+/);
        const found = features.some(feature => feature.properties.section === section && feature.properties.numero === numero);
        if (!found) {
            notFoundParcels.push(parcel);
        }
    });
    console.log('Identified not found parcels:', notFoundParcels);
}

function highlightParcels(parcels) {
    if (OnOff()) { console.log('>>>>  ' + arguments.callee.name + '() <= function used'); }
    if (map.getLayer('highlighted-parcel')) {
        const filters = createFilters(parcels);
        const bounds = new mapboxgl.LngLatBounds();
        const notFoundParcels = [];

        console.log('Applying filters:', filters);
        map.setFilter('highlighted-parcel', filters);

        const features = map.querySourceFeatures('cadastre-parcelles', { filter: filters });
        console.log('Queried features:', features);

        if (features.length > 0) {
            extendBounds(features, bounds);
            identifyNotFoundParcels(parcels, features, notFoundParcels);

            console.log('Features found:', features);
            console.log('Not found parcels:', notFoundParcels);

            // Log the coordinates of the features
            features.forEach(feature => {
                console.log('Feature coordinates:', feature.geometry.coordinates);
            });

            zoomOutToCenterCommune(() => {
                zoomToSelectedParcels(bounds, filters, notFoundParcels);
            });
        } else {
            console.log(`111 No features found for the given parcels: ${parcels.join(', ')}`);
            zoomOutAndRetry(filters, parcels, bounds, notFoundParcels);
        }
    } else {
        console.error('The layer "highlighted-parcel" does not exist in the map\'s style.');
    }
}

function createFilters(parcels) {
    if (OnOff()) { console.log('>>>>  ' + arguments.callee.name + '() <= function used'); }
    const filters = ['any'];
    parcels.forEach(parcel => {
        const [section, numero] = parcel.trim().split(/\s+/);
        filters.push(['all', ['==', ['get', 'section'], section], ['==', ['get', 'numero'], numero]]);
    });
    return filters;
}

function zoomToSelectedParcels(bounds, filters, notFoundParcels) {
    if (OnOff()) { console.log('>>>>  ' + arguments.callee.name + '() <= function used'); }
    console.log('Zooming to selected parcels with bounds:', bounds);
    console.log('Filters:', JSON.stringify(filters));
    console.log('Not found parcels:', notFoundParcels);

    // Ensure bounds are valid before calling fitBounds
    if (bounds.isEmpty()) {
        console.error('Bounds are empty, cannot zoom to selected parcels.');
        return;
    }

    // Log the actual coordinates of the bounds
    console.log('Bounds south-west:', bounds.getSouthWest());
    console.log('Bounds north-east:', bounds.getNorthEast());

    try {
        map.fitBounds(bounds, {
            padding: 20,
            maxZoom: 17,
            pitch: 0,
            bearing: 0,
            duration: 2000
        });
    } catch (error) {
        console.error('Error in fitBounds:', error);
    }

    addHighlightLayers(filters);

    if (notFoundParcels.length > 0) {
        console.log(`The following parcel references were not found: ${notFoundParcels.join(', ')}`);
    }
}

function addHighlightLayers(filters) {
    if (OnOff()) { console.log('>>>>  ' + arguments.callee.name + '() <= function used'); }
    if (!map.getLayer('highlighted-parcel-fill')) {
        map.addLayer({
            id: 'highlighted-parcel-fill',
            type: 'fill',
            source: 'cadastre-parcelles',
            layout: {},
            paint: {
                'fill-color': '#ff0000',
                'fill-opacity': 0.5
            },
            filter: filters
        });
    } else {
        map.setFilter('highlighted-parcel-fill', filters);
    }

    if (!map.getLayer('highlighted-parcel-line')) {
        map.addLayer({
            id: 'highlighted-parcel-line',
            type: 'line',
            source: 'cadastre-parcelles',
            layout: {},
            paint: {
                'line-color': '#FFA500',
                'line-width': 4
            },
            filter: filters
        });
    } else {
        map.setFilter('highlighted-parcel-line', filters);
    }
    console.log('Highlight layers added/updated with filters:', filters);
}

function zoomOutAndRetry(filters, parcels, bounds) {
    if (OnOff()) { console.log('>>>>  ' + arguments.callee.name + '() <= function used'); }
    const communeSource = map.getSource('commune-polygon');
    if (communeSource) {
        const communePolygon = communeSource._data;
        if (communePolygon) {
            // Calculate the centroid of the commune polygon using Turf.js
            const centroid = turf.centroid(communePolygon);
            const centroidCoordinates = centroid.geometry.coordinates;

            console.log('Centroid coordinates:', centroidCoordinates);

            // Center the map on the centroid
            map.flyTo({
                center: centroidCoordinates,
                zoom: 11,
                pitch: 0,
                bearing: 0,
                duration: 2000,
                essential: true
            });

            console.log('---1 First bounce');
            map.once('moveend', () => {
                const features = map.querySourceFeatures('cadastre-parcelles', { filter: filters });
                console.log('Queried features after zooming out:', features);

                if (features.length > 0) {
                    extendBounds(features, bounds);
                    identifyNotFoundParcels(parcels, features, []);

                    console.log('Features found after zooming out:', features);

                    // Log the coordinates of the features
                    features.forEach(feature => {
                        console.log('Feature coordinates after zooming out:', feature.geometry.coordinates);
                    });

                    console.log('||||||||||||  zoomToSelectedParcels(' + bounds + ',' + JSON.stringify(filters) + ', []);');
                    zoomToSelectedParcels(bounds, filters, []);
                } else {
                    console.log(`222 No features found for the given parcels even after zooming out: ${parcels.join(', ')}`);
                }
            });
        } else {
            console.error('The data for "commune-polygon" is not available.');
        }
    } else {
        console.error('The source "commune-polygon" is not loaded.');
    }
}

function getUrlParameter(name) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }	
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

function parseSearchInput(input) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }	
    const regex = /([A-Za-z]+)\s*(\d+)/g;
    let match;
    const parcels = [];
    while ((match = regex.exec(input)) !== null) {
        parcels.push(`${match[1]} ${match[2]}`); // Ensure space between section and number
    }
    return parcels;
}

function getRandomInRange(min, max) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }	
    return Math.random() * (max - min) + min;
}

function parseAndReformatParcelRefs(parcelRefs) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }	
    const formattedParcelRefs = parcelRefs
        .replace(/[^A-Za-z0-9\s]/g, ' ') // Replace non-alphanumeric characters with space
        .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
        .trim() // Trim leading/trailing spaces
        .toUpperCase(); // Convert to uppercase

    return formattedParcelRefs;
}

function loadinfo() {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }	
    console.log('loadinfo function called');
    populateDepotsList(); // Call the function to populate the depots list
}

function saveLayers() {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    const layersState = map.getStyle().layers
        .filter(layer => layerDefinitions[layer.id]) // Only include layers that are in layerDefinitions
        .map((layer, index) => {
            const layerDef = layerDefinitions[layer.id];
            let baseFileName = layerDef.fileName ? layerDef.fileName.split('/').pop().split('-')[0] : layerDef.fileName;
            baseFileName = baseFileName.replace(/\.geojson$/, ''); // Remove any existing .geojson extension
            const fileName = baseFileName + ".geojson"; // Ensure single .geojson extension
            return {
                id: layer.id.split('-')[0], // Add the id property layer.id.split('.')[0]
                level: index, // Save the order level
                fileName: fileName, // Save only the base file name with single .geojson extension
                color: layerDef.color,
                opacity: layerDef.opacity,
                type: layerDef.type,
                weight: layerDef.weight,
                source: layerDef.baseSource // Save base source ID
            };
        });

    const blob = new Blob([JSON.stringify(layersState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'layers.json';
    a.click();
    URL.revokeObjectURL(url);
}

function loadLayers(event) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        
        try {
            const layersState = JSON.parse(content);
            // Sort layers based on their order level
            layersState.sort((a, b) => a.level - b.level);
            
            layersState.forEach(layer => {
                const baseFileName = layer.fileName.split('.')[0];
                console.log(baseFileName + ' <= baseFileName ');
                console.log('datas/geojson/' + baseFileName + ".geojson");
                layer.fileName = 'datas/geojson/' + baseFileName + ".geojson";
                console.log('layer.fileName  ' + layer.fileName);

                layer.id = baseFileName;
                console.log('layer.id  ' + layer.id);
            });
            applyLayersState(layersState);
        } catch (error) {
            console.error('Error parsing file:', error);
            alert('Error parsing file: ' + error.message);
        }
    };

    reader.readAsText(file);
    event.target.value = null;
}

function resetLayers() {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }	
    Object.values(layerDefinitions).forEach(layer => {
        if (layer.type !== 'marker') {
            map.removeLayer(layer.id);
            map.removeSource(layer.source);
        } else {
            layer.markers.forEach(marker => marker.remove());
        }
    });

    layerDefinitions = {};
    updateLayerList();
}

function addMarkerToLayerDefinitions(marker, layerId) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }	
    if (!layerDefinitions[layerId]) {
        layerDefinitions[layerId] = {
            id: layerId,
            type: 'marker',
            markers: []
        };
    }
    layerDefinitions[layerId].markers.push(marker);
}

function createLayerItem(layer, index) {
    const layerItem = document.createElement('div');
    layerItem.className = 'layer-item';
    layerItem.setAttribute('data-layer-id', layer.id);

    layerItem.innerHTML = `
        <span class="drag-handle">&#9776;</span>
        <input type="checkbox" class="visibility-toggle" ${map.getLayoutProperty(layer.id, 'visibility') !== 'none' ? 'checked' : ''}>
        <span class="layer-name">${layer.id}</span>
        <div class="layer-controls"></div>
    `;

    const visibilityToggle = layerItem.querySelector('.visibility-toggle');
    visibilityToggle.addEventListener('change', () => toggleLayerVisibility(layer.id));

    const controlsContainer = layerItem.querySelector('.layer-controls');

    // Add controls based on layer type and whether it's a system layer
    const isSystemLayer = systemLayers.includes(layer.id);
    if (!isSystemLayer && (layer.type === 'fill' || layer.type === 'line')) {
        addColorControl(controlsContainer, layer);
        addOpacityControl(controlsContainer, layer);
        addTypeControl(controlsContainer, layer);
        if (layer.type === 'line') {
            addLineWidthControl(controlsContainer, layer);
        }
    }

    if (!isSystemLayer) {
        addDeleteButton(controlsContainer, layer);
    }

    return layerItem;
}

async function loadMarkdownFile(filePath, elementId, additionalContent) {
	if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        const markdown = await response.text();
        const reader = new commonmark.Parser();
        const writer = new commonmark.HtmlRenderer();
        const parsed = reader.parse(markdown);
        const result = writer.render(parsed);
        document.getElementById(elementId).innerHTML = result + additionalContent;
    } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
    }
}

function toggleLayerType(layerId) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }	
    const layer = layerDefinitions[layerId];
    if (!layer) return;

    let newType, newPaintProperties;

    if (layer.type === 'fill') {
        newType = 'line';
        newPaintProperties = {
            'line-color': map.getPaintProperty(layerId, 'fill-color'),
            'line-opacity': map.getPaintProperty(layerId, 'fill-opacity')
        };
    } else if (layer.type === 'line') {
        newType = 'fill';
        newPaintProperties = {
            'fill-color': map.getPaintProperty(layerId, 'line-color'),
            'fill-opacity': map.getPaintProperty(layerId, 'line-opacity')
        };
    }

    const cleanPaintProperties = {};
    for (const prop in newPaintProperties) {
        if (newPaintProperties[prop] !== undefined) {
            cleanPaintProperties[prop] = newPaintProperties[prop];
        }
    }

    const layerIndex = map.getStyle().layers.findIndex(l => l.id === layerId);
    const nextLayerId = map.getStyle().layers[layerIndex + 1]?.id;

    console.log(`Toggling layer ${layerId} from ${layer.type} to ${newType}`);
    console.log('Layer order before toggle:', map.getStyle().layers.map(l => l.id));

    map.removeLayer(layerId);

    map.addLayer({
        id: layerId,
        type: newType,
        source: layer.source,
        layout: {},
        paint: cleanPaintProperties
    }, nextLayerId);

    console.log('Layer order after toggle:', map.getStyle().layers.map(l => l.id));

    layer.type = newType;
    updateLayerUI(layerId);
    updateLayerList();
}

function updateLayerProperties(layerId, properties) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }	
    if (layerDefinitions[layerId]) {
        const layer = layerDefinitions[layerId];

        if (properties.color !== undefined) {
            if (layer.type === 'fill') {
                map.setPaintProperty(layerId, 'fill-color', properties.color);
            } else if (layer.type === 'line') {
                map.setPaintProperty(layerId, 'line-color', properties.color);
            }
            layer.color = properties.color;
        }

        if (properties.opacity !== undefined) {
            if (layer.type === 'fill') {
                map.setPaintProperty(layerId, 'fill-opacity', parseFloat(properties.opacity));
            } else if (layer.type === 'line') {
                map.setPaintProperty(layerId, 'line-opacity', parseFloat(properties.opacity));
            }
            layer.opacity = parseFloat(properties.opacity);
        }

        if (properties.weight !== undefined && layer.type === 'line') {
            map.setPaintProperty(layerId, 'line-width', parseFloat(properties.weight));
            layer.weight = parseFloat(properties.weight);
        }

        updateLayerUI(layerId);
    } else {
        console.error(`Layer ${layerId} not found in layerDefinitions`);
    }
}

function loadGeoJsonLayerFromState(layer) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }	
    console.log('Created layer :', layer);
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    fetch(layer.fileName)
        .then(response => response.json())
        .then(data => {
            const uniqueId = generate(); // Generate a unique identifier
            const layerId = `${layer.id}-${uniqueId}`; // Ensure unique layer ID
            const sourceId = `${layer.source}-${uniqueId}`; // Ensure unique source ID

            map.addSource(sourceId, {
                type: 'geojson',
                data: data
            });

            const paintProperties = {};
            if (layer.type === 'fill') {
                paintProperties['fill-color'] = layer.color;
                paintProperties['fill-opacity'] = parseFloat(layer.opacity); // Ensure opacity is a number
            } else if (layer.type === 'line') {
                paintProperties['line-color'] = layer.color;
                paintProperties['line-opacity'] = parseFloat(layer.opacity); // Ensure opacity is a number
                paintProperties['line-width'] = isNaN(parseFloat(layer.weight)) ? 1 : parseFloat(layer.weight); // Ensure weight is a number, default to 1 if NaN
            }

            map.addLayer({
                id: layerId,
                type: layer.type,
                source: sourceId,
                paint: paintProperties
            });

            layerDefinitions[layerId] = {
                id: layerId,
                source: sourceId,
                baseSource: layer.source, // Store base source ID
                fileName: layer.fileName,
                color: layer.color,
                opacity: parseFloat(layer.opacity), // Ensure opacity is a number
                weight: isNaN(parseFloat(layer.weight)) ? 1 : parseFloat(layer.weight), // Ensure weight is a number, default to 1 if NaN
                type: layer.type
            };
        })
        .catch(error => console.error('Error loading GeoJSON:', error));
}

function addGeoJsonLayer(geojsonData, fileNameWithoutExtension) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    const uniqueId = generate();
    const layerId = `${fileNameWithoutExtension}-${uniqueId}`;
    const sourceId = `${fileNameWithoutExtension}-source-${uniqueId}`;
    const rdColor = randomColor();
    const initialOpacity = 1;

    map.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData
    });

    map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        layout: {},
        paint: {
            'fill-color': rdColor,
            'fill-opacity': initialOpacity
        }
    });

    layerDefinitions[layerId] = {
        id: layerId,
        source: sourceId,
        baseSource: `${fileNameWithoutExtension}-source`,
        type: 'fill',
        data: geojsonData,
        fileName: fileNameWithoutExtension,
        color: rdColor,
        opacity: initialOpacity,
        interactive: true,
        isSystemLayer: false
    };

    updateLayerList();
    adjustLayerNameWidths();
}

function handleFileSelect(event) {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        let geojsonData;

        try {
            if (file.name.endsWith('.geojson')) {
                geojsonData = JSON.parse(content);
            } else if (file.name.endsWith('.js')) {
                geojsonData = eval(content); // Attention: utiliser eval peut être dangereux si le contenu n'est pas fiable
            } else {
                alert('Unsupported file type');
                return;
            }

            const fileNameWithoutExtension = file.name.split('.').slice(0, -1).join('.');
            addGeoJsonLayer(geojsonData, fileNameWithoutExtension);
        } catch (error) {
            console.error('Error parsing file:', error);
            alert('Error parsing file');
        }
    };

    reader.readAsText(file);
    event.target.value = null;
	adjustLayerNameWidths();
}

function applyLayersState(layersState) {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    layersState.forEach(layer => {
        if (layer.type === 'marker') {
            layer.markers.forEach(markerData => {
                const marker = new mapboxgl.Marker()
                    .setLngLat(markerData.coordinates)
                    .addTo(map);
                addMarkerToLayerDefinitions(marker, layer.layerId);
            });
        } else {
            loadGeoJsonLayerFromState(layer); // Use the new function
        }
    });
    updateLayerList();
	adjustLayerNameWidths();
}

function setLayerOpacity(layerId, opacity) {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    map.setPaintProperty(layerId, 'fill-opacity', parseFloat(opacity));
    if (layerDefinitions[layerId]) {
        layerDefinitions[layerId].opacity = opacity;
    }
    const colorBox = document.querySelector(`.layer-item[data-layer-id="${layerId}"] .color-box`);
    if (colorBox) {
        colorBox.style.opacity = opacity;
    }
}

function updateLayerUI(layerId) {
    const layer = map.getLayer(layerId);
    if (!layer) {
        console.warn(`Layer ${layerId} not found. Skipping UI update.`);
        return;
    }

    const layerItem = document.querySelector(`.layer-item[data-layer-id="${layerId}"]`);
    if (!layerItem) {
        console.warn(`UI element for layer ${layerId} not found. Skipping UI update.`);
        return;
    }

    // Update color control
    const colorControl = layerItem.querySelector('input[type="color"]');
    if (colorControl) {
        colorControl.value = getLayerColor(layerId);
    }

    // Update opacity control
    const opacityControl = layerItem.querySelector('input[type="range"][min="0"][max="1"]');
    if (opacityControl) {
        opacityControl.value = getLayerOpacity(layerId);
    }

    // Update line width control
    const lineWidthControl = layerItem.querySelector('input[type="range"][min="1"][max="10"]');
    if (lineWidthControl) {
        lineWidthControl.disabled = layer.type !== 'line';
        lineWidthControl.value = getLayerLineWidth(layerId);
    }

    // Update type selector
    const typeSelector = layerItem.querySelector('select');
    if (typeSelector) {
        typeSelector.value = layer.type;
    }
}

function animateView(callback) {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    setTimeout(() => {
        map.flyTo({
            center: [9.27970, 41.59099],
            zoom: 15.5,
            pitch: 55,
            bearing: 90,
            duration: 1000,
            essential: true // This animation is considered essential with respect to prefers-reduced-motion
        });

        // Execute the callback after the flyTo animation completes
        map.once('moveend', () => {
            if (callback) {
                callback();
            }
        });
    }, 50);
}

function addMouseMoveListener() {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    map.on('mousemove', function (e) {
        if (map.getLayer('parcelles-interactive-layer')) {
            const features = map.queryRenderedFeatures(e.point, {
                layers: ['parcelles-interactive-layer']
            });

            if (!features.length) {
                if (parcelMarker) {
                    parcelMarker.remove();
                    parcelMarker = null;
                }
            }
        }
    });
}

function hideTabs() {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    handleTabClick('tab1');
}

function moveLayer(layerId, beforeId) {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    map.moveLayer(layerId, beforeId);
}

function getNextLayerType(currentType) {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    const layerTypes = ['fill', 'line', 'fill-extrusion'];
    const currentIndex = layerTypes.indexOf(currentType);
    return layerTypes[(currentIndex + 1) % layerTypes.length];
}

function generate() {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    let id = () => {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return id();
}

function randomColor() {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }

    const colors = ['#00F6DE', '#2044E8', '#C500ED', '#17F105', '#F6EA00', '#F10C1A'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function getSystemLayers() {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    return systemLayers;
}

function getMapLayer() {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    return map.getStyle().layers;
}

function initializeMap() {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
	loadMarkdownFile('README.md', 'lisezmoi', "<br><p>Depuis le fichier readme.md du github du projet.</p>");
    loadMarkdownFile('INFORMATIONS.md', 'informations', "<br><p>Depuis le fichier INFORMATIONS.md du github du projet.</p>");
    map.on('style.load', () => {
        const layers = getMapLayer();
        console.log('getMapLayer :' + layers);
        const layersList = document.getElementById('layers-list');
		console.log('layersList :' + layersList);
        // Stocker les calques système
        layers.forEach(layer => {
            if (!systemLayers.includes(layer.id)) {
                systemLayers.push(layer.id);
                map.setLayoutProperty(layer.id, 'visibility', 'visible');
                console.log('systemLayers populate :' + systemLayers);
            }
        });

        if (!map.getSource('mapbox-dem')) {
            map.addSource('mapbox-dem', {
                type: 'raster-dem',
                url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                tileSize: 512,
                maxzoom: 14
            });
            map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
        }
        animateView();
        updateLayerList(); // Appeler updateLayerList() ici
    });
	
}

function adjustLayerNameWidths() {
    const layerNames = document.querySelectorAll('.layer-item .nom');
    if (layerNames.length === 0) return null; // No elements found

    let maxWidth = 100; // Minimum width

    // Find the widest name
    layerNames.forEach(name => {
        // Create a temporary span to measure the text width
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'nowrap'; // Prevent wrapping
        tempSpan.textContent = name.textContent;
        document.body.appendChild(tempSpan);

        const width = tempSpan.offsetWidth;
        if (width > maxWidth) {
            maxWidth = width;
        }

        document.body.removeChild(tempSpan);
    });

    // Set the width for all layer names
    layerNames.forEach(name => {
        name.style.width = `${maxWidth + 10}px`; // Add some padding
        name.style.whiteSpace = 'nowrap'; // Prevent wrapping
        name.style.overflow = 'hidden'; // Hide overflow
        name.style.textOverflow = 'ellipsis'; // Add ellipsis for overflowing text
    });

    console.log(`Adjusted layer name widths to ${maxWidth + 10}px`);
    return maxWidth + 10; // Return the width that was set
}

function addColorControl(layerItem, layer) {
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = getLayerColor(layer.id);
    colorPicker.addEventListener('input', (e) => {
        updateLayerColor(layer.id, e.target.value);
    });
    layerItem.appendChild(colorPicker);
	adjustLayerNameWidths();
}

function addPointLayer(geojsonData, layerId, sourceId, color, opacity) {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    const markers = [];
    geojsonData.features.forEach(feature => {
		
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.backgroundImage = `url(${customMarkerIcon})`;
        el.style.width = '32px';
        el.style.height = '32px';
        el.style.backgroundSize = '100%';
		const marker = new mapboxgl.Marker(el)
            .setLngLat(feature.geometry.coordinates)
            .addTo(map);
		markers.push(marker);
    });
}

function moveLayerByIndex(oldIndex, newIndex) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    if (oldIndex === newIndex) return;
    
    const layers = map.getStyle().layers;
    const movedLayer = layers[oldIndex];
    
    if (oldIndex < newIndex) {
        // Moving down
        if (newIndex < layers.length - 1) {
            map.moveLayer(movedLayer.id, layers[newIndex + 1].id);
        } else {
            map.moveLayer(movedLayer.id);
        }
    } else {
        // Moving up
        map.moveLayer(movedLayer.id, layers[newIndex].id);
    }

    console.log(`Moved layer ${movedLayer.id} from index ${oldIndex} to ${newIndex}`);

    updateLayerList();
    adjustLayerNameWidths();
}

function toggleLayerVisibility(layerId) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    
    const visibility = map.getLayoutProperty(layerId, 'visibility');
    const newVisibility = visibility === 'visible' ? 'none' : 'visible';
    map.setLayoutProperty(layerId, 'visibility', newVisibility);
    
    // Update the checkbox state
    const checkbox = document.querySelector(`.layer-item[data-layer-id="${layerId}"] input[type="checkbox"]`);
    if (checkbox) {
        checkbox.checked = newVisibility === 'visible';
    }
    
    console.log(`Layer ${layerId} visibility set to ${newVisibility}`);
}

function reorderLayerList() {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    const layersList = document.getElementById('layers-list');
    const items = Array.from(layersList.children);
    const sortedItems = items.sort((a, b) => {
        const aIndex = Array.from(map.getStyle().layers).findIndex(layer => layer.id === a.dataset.layerId);
        const bIndex = Array.from(map.getStyle().layers).findIndex(layer => layer.id === b.dataset.layerId);
        return aIndex - bIndex;
    });
    sortedItems.forEach((item, index) => {
        const indexText = item.querySelector('.layer-index');
        indexText.textContent = `${index}`; // Start index from 0 to match the map order
    });
    layersList.innerHTML = '';
    sortedItems.forEach(item => layersList.appendChild(item));
}

function initializeMarkers(geojson) {
	
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    const markers = [];
    geojson.features.forEach((feature) => {
        const el = document.createElement('div');
        el.className = 'marker';
        el.style.backgroundImage = `url(css/images/${feature.properties.icon})`;
        el.style.width = '32px';
        el.style.height = '32px';

        const marker = new mapboxgl.Marker(el)
            .setLngLat(feature.geometry.coordinates)
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(feature.properties.nom))
            .addTo(map);

        markers.push(marker);
    });
    return markers;
}

function getLayerColor(layerId) {
    const layer = map.getLayer(layerId);
    if (layer) {
        if (layer.type === 'fill') {
            return map.getPaintProperty(layerId, 'fill-color') || '#000000';
        } else if (layer.type === 'line') {
            return map.getPaintProperty(layerId, 'line-color') || '#000000';
        }
    }
    return '#000000'; // Couleur par défaut
}

function getLayerOpacity(layerId) {
    const layer = map.getLayer(layerId);
    if (layer) {
        if (layer.type === 'fill') {
            return map.getPaintProperty(layerId, 'fill-opacity') || 1;
        } else if (layer.type === 'line') {
            return map.getPaintProperty(layerId, 'line-opacity') || 1;
        }
    }
    return 1; // Opacité par défaut
}

function getLayerLineWidth(layerId) {
    const layer = map.getLayer(layerId);
    if (layer && layer.type === 'line') {
        return map.getPaintProperty(layerId, 'line-width') || 1;
    }
    return 1; // Largeur de ligne par défaut
}

function updateLayerColor(layerId, color) {
    const layer = map.getLayer(layerId);
    if (layer) {
        if (layer.type === 'fill') {
            map.setPaintProperty(layerId, 'fill-color', color);
        } else if (layer.type === 'line') {
            map.setPaintProperty(layerId, 'line-color', color);
        }
    }
}

function updateLayerOpacity(layerId, opacity) {
    const layer = map.getLayer(layerId);
    if (layer) {
        if (layer.type === 'fill') {
            map.setPaintProperty(layerId, 'fill-opacity', parseFloat(opacity));
        } else if (layer.type === 'line') {
            map.setPaintProperty(layerId, 'line-opacity', parseFloat(opacity));
        }
    }
}

function updateLayerType(layerId, newType) {
    const layer = map.getLayer(layerId);
    if (layer && !systemLayers.includes(layerId)) {
        const currentPaint = map.getPaintProperty(layerId, `${layer.type}-color`);
        const currentOpacity = map.getPaintProperty(layerId, `${layer.type}-opacity`);

        // Get the current layer index
        const layers = map.getStyle().layers;
        const currentIndex = layers.findIndex(l => l.id === layerId);
        const nextLayerId = layers[currentIndex + 1] ? layers[currentIndex + 1].id : undefined;

        map.removeLayer(layerId);

        const newLayer = {
            id: layerId,
            type: newType,
            source: layer.source,
            paint: {
                [`${newType}-color`]: currentPaint,
                [`${newType}-opacity`]: currentOpacity
            }
        };

        if (newType === 'line') {
            newLayer.paint['line-width'] = 0.01; // Set default line width to 0.01
        }

        // Add the layer back at its original position
        map.addLayer(newLayer, nextLayerId);

        // Update layerDefinitions
        if (layerDefinitions[layerId]) {
            layerDefinitions[layerId].type = newType;
            if (newType === 'line') {
                layerDefinitions[layerId].weight = 0.01; // Set default line width to 0.01
            }
        }

        // Update UI
        updateLayerUI(layerId);
    }
}

function adjustLayerNameWidths() {
    const layerNames = document.querySelectorAll('.layer-item .nom');
    if (layerNames.length === 0) return null; // No elements found

    let maxWidth = 100; // Minimum width

    // Find the widest name
    layerNames.forEach(name => {
        const width = name.scrollWidth;
        if (width > maxWidth) {
            maxWidth = width;
        }
    });

    // Set the width for all layer names
    layerNames.forEach(name => {
        name.style.width = `${maxWidth}px`;
    });

    console.log(`Adjusted layer name widths to ${maxWidth}px`);
    return maxWidth; // Return the width that was set
}

function updateLayerLineWidth(layerId, width) {
    const layer = map.getLayer(layerId);
    if (layer && layer.type === 'line') {
        map.setPaintProperty(layerId, 'line-width', parseFloat(width));
        if (layerDefinitions[layerId]) {
            layerDefinitions[layerId].weight = parseFloat(width);
        }
    }
}

function updateLayerList() {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    const layersList = document.getElementById('layers-list');
    const layersContainer = document.getElementById('layers-container');
 
    if (!layersList) {
        console.error('layers-list element not found');
        return;
    }
    layersList.innerHTML = ''; // Clear the existing list

    const allLayers = map.getStyle().layers;
    console.log('All layers detected:', allLayers.map(layer => layer.id));
    allLayers.forEach((layer, index) => {
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.setAttribute('data-layer-id', layer.id);

        addLayerControls(layerItem, layer);
        
        // Set the initial state of the visibility checkbox
        const visibilityCheckbox = layerItem.querySelector('input[type="checkbox"]');
        if (visibilityCheckbox) {
            visibilityCheckbox.checked = map.getLayoutProperty(layer.id, 'visibility') !== 'none';
        }

        layersList.appendChild(layerItem);
    });




    // Adjust the container height
    layersContainer.style.maxHeight = `calc(100vh - 200px)`; // Adjust this value as needed

    // Initialize or update Sortable
    if (layersList.sortable) {
        layersList.sortable.destroy();
    }
    layersList.sortable = new Sortable(layersList, {
        animation: 150,
        handle: '.drag-handle',
        onEnd: function (evt) {
            const oldIndex = evt.oldIndex;
            const newIndex = evt.newIndex;
            if (oldIndex !== newIndex) {
                moveLayerByIndex(oldIndex, newIndex);
            }
        }
    });

    console.log(`Total layers in list: ${layersList.children.length}`);
    
    // Call adjustLayerNameWidths after a short delay to ensure DOM is updated
    setTimeout(adjustLayerNameWidths, 0);
}

function addLayerControls(layerItem, layer) {
    const isSystemLayer = systemLayers.includes(layer.id);
    const isHoverLayer = layer.id === 'cadastre-parcelles-hover';
    const isSpecialLayer = isSystemLayer || isHoverLayer || layer.id === 'cadastre-parcelles-labels' || layer.id === 'highlighted-parcel';

    // Créer un conteneur flex pour les contrôles
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'layer-controls';
    controlsContainer.style.display = 'flex';
    controlsContainer.style.alignItems = 'center';
    controlsContainer.style.gap = '5px';

    // Ajouter tous les contrôles, mais les désactiver si nécessaire
	
    addControl(controlsContainer, 'drag', layer, isSpecialLayer);
    addControl(controlsContainer, 'level', layer, isSpecialLayer);

    addControl(controlsContainer, 'visibility', layer, false); // La visibilité est toujours active	
    addControl(controlsContainer, 'name', layer, true); // Le nom est toujours en lecture seule  
	addControl(controlsContainer, 'type', layer, isSpecialLayer);

    addControl(controlsContainer, 'color', layer, isSystemLayer && !isHoverLayer);
    addControl(controlsContainer, 'opacity', layer, isSpecialLayer);
    addControl(controlsContainer, 'lineWidth', layer, isSpecialLayer || layer.type !== 'line');
  
    addDeleteButton(controlsContainer, layer, );//isSpecialLayer || isHoverLayer || isSystemLayer

    layerItem.appendChild(controlsContainer);

    // Indicateurs spéciaux
    if (isHoverLayer) {
        //addSpecialIndicator(layerItem, '*', 'Calque de survol - Seule la couleur est modifiable');
    } else if (isSpecialLayer) {
        // addSpecialIndicator(layerItem, '🔒', 'Ce calque est verrouillé');
    }
}

function addControl(container, type, layer, isDisabled) {
    let control;
    switch (type) {
        case 'drag':
            control = document.createElement('span');
            control.className = 'drag-handle';
            control.innerHTML = '&#9776;';
            control.style.cursor = 'move';
            break;
        
        case 'level':
            control = document.createElement('span');
            control.className = 'level';
            control.textContent = getLayerLevel(layer.id);
            break;

        case 'visibility':
            control = document.createElement('input');
            control.type = 'checkbox';
            control.checked = map.getLayoutProperty(layer.id, 'visibility') !== 'none';
            control.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleLayerVisibility(layer.id);
            });
            break;

        case 'name':
            control = document.createElement('span');
            control.className = 'nom';
            control.textContent = layer.id;
            break;

        case 'color':
            control = document.createElement('input');
            control.type = 'color';
            control.value = getLayerColor(layer.id);
            control.addEventListener('input', (e) => updateLayerColor(layer.id, e.target.value));
            break;

        case 'opacity':
            control = document.createElement('input');
            control.type = 'range';
            control.min = '0';
            control.max = '1';
            control.step = '0.1';
            control.value = getLayerOpacity(layer.id);
            control.addEventListener('input', (e) => updateLayerOpacity(layer.id, e.target.value));
            control.style.width = '50px'; // Reduce width by 50%
            break;

        case 'lineWidth':
            control = document.createElement('input');
            control.type = 'range';
            control.min = '0.01';
            control.max = '10';
            control.step = '0.01';
            control.value = getLayerLineWidth(layer.id);
            control.addEventListener('input', (e) => updateLayerLineWidth(layer.id, e.target.value));
            control.disabled = layer.type !== 'line';
            control.style.width = '50px'; // Reduce width by 50%
            break;

        case 'type':
            control = document.createElement('select');
            control.innerHTML = '<option value="fill">Fill</option><option value="line">Line</option>';
            control.value = layer.type;
            control.addEventListener('change', (e) => {
                updateLayerType(layer.id, e.target.value);
                const lineWidthSlider = container.querySelector('input[type="range"][min="0.01"][max="10"]');
                if (lineWidthSlider) {
                    lineWidthSlider.disabled = e.target.value !== 'line';
                }
            });
            break;
    }
    
    if (control) {
        control.disabled = isDisabled;
        container.appendChild(control);
    }
}

function removeLayer(layerId) {
    if (OnOff()) { console.log('>>>>  '+arguments.callee.name + '() <= function used'); }
    
    if (map.getLayer(layerId)) {
        // Remove the layer from the map
        map.removeLayer(layerId);
        
        // If the layer has a source, remove it as well
        if (map.getSource(layerId)) {
            map.removeSource(layerId);
        }
        
        // Remove the layer from the layers list in the UI
        const layerElement = document.getElementById(layerId);
        if (layerElement) {
            layerElement.remove();
        }
        
        // Update the layer list in the UI
        updateLayerList();
        
        console.log(`Layer ${layerId} removed successfully`);
    } else {
        console.warn(`Layer ${layerId} not found on the map`);
    }
}

function addDeleteButton(container, layer, isDisabled) {
    if (!isDisabled) {
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'x';
        deleteButton.addEventListener('click', () => {
            if (confirm(`Êtes-vous sûr de vouloir supprimer le calque "${layer.id}" ?`)) {
                removeLayer(layer.id);
                updateLayerList();
            }
        });
        container.appendChild(deleteButton);
    }
}

function addSpecialIndicator(layerItem, symbol, title) {
    const indicator = document.createElement('span');
    indicator.textContent = ` ${symbol}`;
    indicator.title = title;
    indicator.style.fontStyle = 'italic';
    indicator.style.color = '#888';
    layerItem.appendChild(indicator);
}

function getLayerLevel(layerId) {
    const layers = map.getStyle().layers;
    return layers.findIndex(layer => layer.id === layerId);
}

function OnOff() {
	
    return false; 
    // return true;
}


initializeMap();
addMouseMoveListener();