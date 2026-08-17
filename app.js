// ==========================================
// 1. STATE & DATA
// ==========================================
let pigeons = [];
let globalStats = { totalFlights: 37, totalDistance: 4821 };

// Hardcoded locations for demo
const myLocation = { lat: 40.6936, lng: -89.5889 }; // Peoria
const friendLocation = { lat: 41.8781, lng: -87.6298 }; // Chicago

// Map variables
let map = null;
let pigeonMarker = null;
let flightPath = null;
let currentTrackingId = null;

// ==========================================
// 2. MATH & PHYSICS HELPER FUNCTIONS
// ==========================================
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function calculateDistance(loc1, loc2) {
    const R = 6371; // Earth radius in km
    const dLat = (loc2.lat - loc1.lat) * (Math.PI / 180);
    const dLon = (loc2.lng - loc1.lng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(loc1.lat * (Math.PI / 180)) * Math.cos(loc2.lat * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function interpolate(start, end, fraction) {
    return {
        lat: start.lat + (end.lat - start.lat) * fraction,
        lng: start.lng + (end.lng - start.lng) * fraction
    };
}

function calculateBearing(start, end) {
    const startLat = start.lat * Math.PI / 180;
    const startLng = start.lng * Math.PI / 180;
    const endLat = end.lat * Math.PI / 180;
    const endLng = end.lng * Math.PI / 180;

    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) -
              Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ==========================================
// 3. PIGEON ENGINE
// ==========================================
function createPigeon(text) {
    const totalDist = calculateDistance(myLocation, friendLocation);
    const initialBearing = calculateBearing(myLocation, friendLocation);
    
    const pigeon = {
        id: Math.random().toString(36).substring(2, 8).toUpperCase(),
        message: escapeHTML(text),
        startLoc: { ...myLocation },
        endLoc: { ...friendLocation },
        currentLoc: { ...myLocation },
        status: "🪽 Taking off!",
        speedKmh: 64,
        maxSpeedKmh: 64,
        distanceRemainingKm: totalDist,
        totalDistanceKm: totalDist,
        healthPercent: 100,
        flightRiskPercent: 2,
        progressPercent: 0,
        eventsEncountered: 0,
        isDelivered: false,
        bearing: initialBearing,
        startTime: Date.now(),
        flightTimeMs: 0
    };
    
    pigeons.push(pigeon);
    updateUI();
}

function handleRandomEvents(pigeon) {
    if (Math.random() < 0.05) { // 5% chance per tick
        const eventId = Math.floor(Math.random() * 5);
        pigeon.eventsEncountered++;
        switch(eventId) {
            case 0: pigeon.status = "🍞 Stopped for food"; pigeon.speedKmh = 0; break;
            case 1: pigeon.status = "💨 Strong headwind!"; pigeon.speedKmh -= 15; pigeon.flightRiskPercent += 2; break;
            case 2: pigeon.status = "🌤️ Flying extra fast!"; pigeon.speedKmh += 25; break;
            case 3: pigeon.status = "🌧️ Flying through rain"; pigeon.healthPercent -= 5; pigeon.speedKmh -= 10; break;
            case 4: pigeon.status = "😴 Taking a rest"; pigeon.speedKmh = 0; pigeon.healthPercent += 10; break;
        }
    } else {
        if (pigeon.speedKmh < 40 || pigeon.speedKmh > 80) {
            pigeon.speedKmh = 64;
            pigeon.status = "🌤️ Flying normally";
        }
        if (pigeon.progressPercent > 0.9 && pigeon.speedKmh > 0) {
            pigeon.status = "🏠 Approaching destination";
        }
    }
    pigeon.healthPercent = Math.max(1, Math.min(100, pigeon.healthPercent));
}

// Main Simulation Loop
setInterval(() => {
    let uiNeedsUpdate = false;
    
    pigeons.forEach(pigeon => {
        if (pigeon.isDelivered) return;
        
        uiNeedsUpdate = true;
        // Accelerate time for demo (moves 2% per tick)
        pigeon.progressPercent += 0.02;
        
        if (pigeon.progressPercent >= 1) {
            pigeon.progressPercent = 1;
            pigeon.isDelivered = true;
            pigeon.status = "💌 Message delivered!";
            pigeon.currentLoc = { ...pigeon.endLoc };
            pigeon.distanceRemainingKm = 0;
            globalStats.totalFlights++;
            globalStats.totalDistance += Math.round(pigeon.totalDistanceKm);
        } else {
            pigeon.currentLoc = interpolate(pigeon.startLoc, pigeon.endLoc, pigeon.progressPercent);
            pigeon.distanceRemainingKm = pigeon.totalDistanceKm * (1 - pigeon.progressPercent);
            handleRandomEvents(pigeon);
            pigeon.flightTimeMs = Date.now() - pigeon.startTime;
            if (pigeon.speedKmh > pigeon.maxSpeedKmh) pigeon.maxSpeedKmh = pigeon.speedKmh;
        }
    });
    
    if (uiNeedsUpdate) {
        updateUI();
        if (currentTrackingId) updateMapLogic();
    }
}, 1000);

// ==========================================
// 4. UI CONTROLLERS
// ==========================================
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    if (viewId === 'view-map' && map != null) {
        setTimeout(() => map.invalidateSize(), 100);
    } else {
        currentTrackingId = null; 
    }
    updateUI();
}

function handleEnter(e) {
    if (e.key === 'Enter') sendPigeon();
}

function sendPigeon() {
    const input = document.getElementById('message-input');
    if (input.value.trim() === '') return;
    createPigeon(input.value);
    input.value = '';
}

function trackPigeon(id) {
    currentTrackingId = id;
    initMap(id);
    switchView('view-map');
}

function updateUI() {
    // 1. Home Screen
    const active = pigeons.filter(p => !p.isDelivered).length;
    const waiting = pigeons.filter(p => p.isDelivered).length;
    
    document.getElementById('stat-active').innerText = active;
    document.getElementById('stat-waiting').innerText = waiting;
    document.getElementById('stat-flights').innerText = globalStats.totalFlights;
    document.getElementById('stat-distance').innerText = globalStats.totalDistance;
    
    const flightList = document.getElementById('active-flights-list');
    flightList.innerHTML = pigeons.filter(p => !p.isDelivered).map(p => `
        <div class="card flight-item">
            <div>
                <strong>Pigeon #${p.id}</strong><br>
                <small>${p.status}</small><br>
                ${!p.isDelivered ? `<small style="color:#6c757d">${Math.round(p.distanceRemainingKm)} km remaining</small>` : ''}
            </div>
            <button onclick="trackPigeon('${p.id}')">Track</button>
        </div>
    `).join('');

    // 2. Chat Screen
    const chatList = document.getElementById('chat-messages');
    chatList.innerHTML = pigeons.map(p => `
        <div class="msg-wrapper">
            <div class="msg-bubble ${p.isDelivered ? 'delivered' : ''}">
                ${p.isDelivered ? p.message : 'Message is flying...'}
            </div>
            <div class="msg-status" onclick="trackPigeon('${p.id}')">
                ${p.isDelivered ? '🐦 Arrived!' : `🐦 Flying (${Math.round(p.progressPercent * 100)}%) - Track`}
            </div>
        </div>
    `).join('');
}

// ==========================================
// 5. MAP LOGIC (Leaflet.js)
// ==========================================
function initMap(id) {
    const pigeon = pigeons.find(p => p.id === id);
    if (!pigeon) return;

    if (!map) {
        map = L.map('map', { zoomControl: false }).setView([pigeon.currentLoc.lat, pigeon.currentLoc.lng], 7);
        // Free OpenStreetMap Tiles (No API key required)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    }

    // Clear previous markers
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });

    // Draw route
    flightPath = L.polyline([
        [pigeon.startLoc.lat, pigeon.startLoc.lng], 
        [pigeon.endLoc.lat, pigeon.endLoc.lng]
    ], {color: '#6c757d', weight: 4, opacity: 0.5}).addTo(map);

    // Draw Start/End Pins
    L.marker([pigeon.startLoc.lat, pigeon.startLoc.lng]).addTo(map).bindPopup('Origin');
    L.marker([pigeon.endLoc.lat, pigeon.endLoc.lng]).addTo(map).bindPopup('Destination');

    // Custom Pigeon Icon Marker
    const pigeonDivIcon = L.divIcon({
        className: 'pigeon-marker',
        html: `<div class="pigeon-icon" id="live-pigeon-icon" style="transform: rotate(${pigeon.bearing}deg);">🐦</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    pigeonMarker = L.marker([pigeon.currentLoc.lat, pigeon.currentLoc.lng], {icon: pigeonDivIcon}).addTo(map);
    
    updateMapLogic();
}

function updateMapLogic() {
    const pigeon = pigeons.find(p => p.id === currentTrackingId);
    if (!pigeon) return;

    // Move marker and camera
    if (pigeonMarker) pigeonMarker.setLatLng([pigeon.currentLoc.lat, pigeon.currentLoc.lng]);
    if (map) map.panTo([pigeon.currentLoc.lat, pigeon.currentLoc.lng], {animate: true});
    
    // Update Rotation via DOM to avoid recreating marker icon every second
    const iconEl = document.getElementById('live-pigeon-icon');
    if (iconEl) iconEl.style.transform = `rotate(${pigeon.bearing}deg)`;

    // Helpers for time formatting
    const formatTime = ms => {
        const totalMinutes = Math.floor(ms / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    let etaString = "N/A";
    if (pigeon.speedKmh > 0) {
        // ETA in hours = distance / speed. We multiply by 3600000 for ms.
        // Wait, the simulation is accelerated (2% per second).
        // If it travels 2% per second, full journey takes 50 seconds.
        // Distance doesn't matter for the *real* ETA, but let's fake it according to the lore:
        const hoursRemaining = pigeon.distanceRemainingKm / pigeon.speedKmh;
        etaString = formatTime(hoursRemaining * 3600000);
    }

    // Convert actual flight time to a fake lore-friendly flight time (assuming 64km/h average)
    // Actually, just use progress * total distance / average speed.
    const avgSpeed = (pigeon.maxSpeedKmh + 64) / 2; // rough estimate
    const simulatedTotalHours = pigeon.totalDistanceKm / avgSpeed;
    const simulatedElapsedMs = pigeon.progressPercent * simulatedTotalHours * 3600000;
    const flightTimeString = formatTime(simulatedElapsedMs);

    // Update Bottom Panel
    const panel = document.getElementById('map-panel');
    if (pigeon.isDelivered) {
        panel.innerHTML = `
            <h3 style="color:#0f5132">🐦 PIGEON ARRIVED!</h3>
            <p style="margin-top:8px">Flight distance: ${Math.round(pigeon.totalDistanceKm)} km</p>
            <p>Flight time: ${flightTimeString}</p>
            <p>Average speed: ${Math.round(pigeon.totalDistanceKm / simulatedTotalHours)} km/h</p>
            <p>Maximum speed: ${Math.round(pigeon.maxSpeedKmh)} km/h</p>
            <p>Events encountered: ${pigeon.eventsEncountered}</p>
            <p style="margin-top:12px"><strong>Message:</strong><br>"${pigeon.message}"</p>
        `;
    } else {
        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <strong>🐦 Pigeon #${pigeon.id}</strong>
                <span style="color:#007bff; font-weight:bold">${pigeon.status}</span>
            </div>
            <div style="margin-top: 8px; font-size: 0.85em; color: #6c757d; border-bottom: 1px solid #e9ecef; padding-bottom: 8px; margin-bottom: 8px;">
                <p>📍 Origin: ${pigeon.startLoc.lat.toFixed(4)}, ${pigeon.startLoc.lng.toFixed(4)}</p>
                <p>📍 Destination: ${pigeon.endLoc.lat.toFixed(4)}, ${pigeon.endLoc.lng.toFixed(4)}</p>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:12px; color:#495057;">
                <div>
                    <p>💨 ${Math.round(pigeon.speedKmh)} km/h</p>
                    <p>📏 ${Math.round(pigeon.distanceRemainingKm)} km remaining</p>
                    <p>⏱️ ETA: ${etaString}</p>
                    <p>🕐 Flight time: ${flightTimeString}</p>
                </div>
                <div style="text-align:right;">
                    <p>❤️ Health: ${pigeon.healthPercent}%</p>
                    <p>💀 Risk: ${pigeon.flightRiskPercent}%</p>
                    <p>📊 Progress: ${Math.round(pigeon.progressPercent * 100)}%</p>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${pigeon.progressPercent * 100}%"></div>
            </div>
        `;
    }
}
