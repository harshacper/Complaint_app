let map;
let marker;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user || user.role !== 'admin') {
        window.location.href = '/login.html';
        return;
    }

    loadAllComplaints(token);
});

async function loadAllComplaints(token) {
    try {
        const res = await fetch('/api/complaints', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            const tbody = document.getElementById('admin-table');
            
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center">No Complaints Found.</td></tr>`;
                return;
            }

            tbody.innerHTML = data.map(c => `
                <tr>
                    <td>#${c.id}</td>
                    <td>
                        <strong>${c.user_name}</strong><br>
                        <small style="color:#666">${c.user_email}</small>
                    </td>
                    <td>
                        <strong>${c.title}</strong><br>
                        <span style="font-size:13px; color:#555;">${c.description}</span>
                    </td>
                    <td>
                        ${c.photo_url ? `<a href="${c.photo_url}" target="_blank"><img src="${c.photo_url}" class="evidence-img" alt="Evidence"></a>` : '<span style="color:#aaa; font-size:12px;">No Photo</span>'}
                    </td>
                    <td>
                        <button class="btn-secondary" style="font-size:12px; padding:5px 10px; color:#333; border-color:#333;" onclick="openMap(${c.latitude}, ${c.longitude}, '${c.title.replace(/'/g, "\\'")}')">View Map</button>
                    </td>
                    <td>
                        <span class="status-badge status-${c.status.toLowerCase()}">${c.status}</span>
                    </td>
                    <td>${new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                        <select onchange="updateStatus(${c.id}, this.value)" style="padding:5px; border-radius:4px;">
                            <option value="" disabled selected>Change Status</option>
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Solved">Solved</option>
                        </select>
                    </td>
                </tr>
            `).join('');
        } else {
            document.getElementById('admin-table').innerHTML = `<tr><td colspan="8" class="text-center" style="color:red;">Error loading complaints.</td></tr>`;
        }
    } catch (err) {
        console.error("Error", err);
    }
}

async function updateStatus(id, newStatus) {
    if (!confirm(`Are you sure you want to change status to "${newStatus}"?`)) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/api/complaints/${id}/status`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (res.ok) {
            showPopup('Status Updated', `The complaint #${id} is now ${newStatus}. An email notification has been triggered if solved.`, () => {
                loadAllComplaints(token);
            });
        } else {
            alert('Failed to update status.');
        }
    } catch(err) {
        console.error(err);
    }
}

function openMap(lat, lon, title) {
    document.getElementById('map-overlay').style.display = 'block';
    document.getElementById('map-popup').style.display = 'block';
    document.getElementById('map-details').innerText = `Location for: ${title} (Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)})`;

    if (!map) {
        map = L.map('admin-map').setView([lat, lon], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(map);
        marker = L.marker([lat, lon]).addTo(map);
    } else {
        map.setView([lat, lon], 16);
        marker.setLatLng([lat, lon]);
    }
    setTimeout(() => map.invalidateSize(), 300);
}

function closeMap() {
    document.getElementById('map-overlay').style.display = 'none';
    document.getElementById('map-popup').style.display = 'none';
}
