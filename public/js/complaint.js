let map;
let marker;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    loadComplaints(token);
    
    // Attach Submit Event
    document.getElementById('complaint-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('c-title').value;
        const description = document.getElementById('c-desc').value;
        const photo = document.getElementById('c-photo').files[0];
        const lat = document.getElementById('c-lat').value;
        const lon = document.getElementById('c-lon').value;

        if (!lat || !lon) {
            alert("Please provide the location by clicking 'Get Current Location'.");
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('latitude', lat);
        formData.append('longitude', lon);
        if (photo) {
            formData.append('photo', photo);
        }

        try {
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerText = 'Submitting...';

            const res = await fetch('/api/complaints', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (res.ok) {
                showPopup('Complaint Submitted', 'Your complaint has been successfully recorded!', () => {
                    e.target.reset();
                    document.getElementById('photo-preview').style.display = 'none';
                    document.getElementById('map').style.display = 'none';
                    btn.disabled = false;
                    btn.innerText = 'Submit Complaint';
                    loadComplaints(token);
                });
            } else {
                const data = await res.json();
                showPopup('Error', data.message || 'Submission failed.');
                btn.disabled = false;
                btn.innerText = 'Submit Complaint';
            }
        } catch (err) {
            showPopup('Error', 'Network error. Try again.');
        }
    });
});

function getLocation() {
    const status = document.getElementById('loc-status');
    status.innerText = "Locating...";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                document.getElementById('c-lat').value = lat;
                document.getElementById('c-lon').value = lon;
                status.innerText = "Location mapped successfully!";
                showMap(lat, lon);
            },
            () => {
                status.innerText = "Unable to retrieve your location.";
            }
        );
    } else {
        status.innerText = "Geolocation is not supported by your browser.";
    }
}

function showMap(lat, lon) {
    const mapDiv = document.getElementById('map');
    mapDiv.style.display = 'block';

    if (!map) {
        map = L.map('map').setView([lat, lon], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(map);
        marker = L.marker([lat, lon]).addTo(map);
    } else {
        map.setView([lat, lon], 15);
        marker.setLatLng([lat, lon]);
    }
    // Fix leaflet visibility issue in hidden divs
    setTimeout(() => map.invalidateSize(), 500);
}

async function loadComplaints(token) {
    try {
        const res = await fetch('/api/complaints', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            const container = document.getElementById('my-complaints');
            if (data.length === 0) {
                container.innerHTML = "<p>No complaints submitted yet.</p>";
                return;
            }

            container.innerHTML = data.map(c => `
                <div style="border-bottom: 1px solid #ddd; padding: 15px 0;">
                    <div style="display:flex; justify-content:space-between;">
                        <h3 style="color:#2a5298; margin-bottom:5px;">${c.title}</h3>
                        <span class="status-badge status-${c.status.toLowerCase()}">${c.status}</span>
                    </div>
                    <p style="color:#555;font-size:14px; margin-bottom:10px;">${c.description}</p>
                    <p style="color:#888;font-size:12px;">Submitted: ${new Date(c.created_at).toLocaleString()}</p>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error("Error loading complaints", err);
    }
}
