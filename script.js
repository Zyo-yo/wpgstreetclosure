/******w**************
    
    Assignment 4
    Name: Cyrus Gatus
    Date: June 18, 2026
    Description: Queries the Winnipeg open API database for closures on either a searched address, 
                 or the browser's current location

*********************/
//map and marker variables for mmap markings
let map;
let markerGroup;

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("warning").style.visibility = "hidden";
    document.getElementById("loading").style.display = "none";
    document.getElementById("searchForm").addEventListener("submit", function (event) {
        event.preventDefault();
        searchByAddress();
    });
    document.getElementById("locationButton").addEventListener("click", function () {
        searchByBrowserLocation();
    });
    //currrently set to wonnipeg 
    map = L.map("map").setView([49.8951, -97.1384], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    markerGroup = L.layerGroup().addTo(map);
});
// address searcher using a search button that queries the databse
function searchByAddress() {
    const addressInput = document.getElementById("search").value;
    if (addressInput.trim() === "") {
        showWarning("Please enter an address or area."); //error message if the address does not exist
        return;
    }
   
    const address = addressInput + ", Winnipeg, Manitoba"; //adds winnipeg to the geolocated data so it stays within the city boudns
    //geloacation of the given address, querried through the longitute and latitude in the database
    const geoUrl =
        "https://nominatim.openstreetmap.org/search?format=json&q=" +
        encodeURIComponent(address);
    //hide warnings and loading page
    showLoading();
    hideWarning();
    //get collected address
    fetch(geoUrl)
        .then(response => response.json())
        .then(data => {
            if (data.length === 0) {
                hideLoading();
                document.getElementById("dataLayout").style.display = "none";
                showWarning("Address not found."); //no address located warning
                return;
            }
            //using latitude and longitude for the API since it only has those as its location
            const userLat = parseFloat(data[0].lat);
            const userLon = parseFloat(data[0].lon);
            getClosuresNear(userLat, userLon);
        })
        .catch(() => {
            hideLoading();
            document.getElementById("dataLayout").style.display = "none";
            showWarning("There was an error finding that address."); //no address found
        });
}
// uses the browser location  after giving permission from the user
function searchByBrowserLocation() {
    //warning and loading functions
    showLoading();
    hideWarning();
    //same geolocation process from before:
    if (!navigator.geolocation) {
        hideLoading();
        showWarning("Geolocation is not supported by your browser.");
        return;
    }
    // after parsing hte browser location, it gatheres the same data the way it did when a searched address
    navigator.geolocation.getCurrentPosition(
        function (position) {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            getClosuresNear(userLat, userLon);
        },
        function () {
            hideLoading();
            document.getElementById("dataLayout").style.display = "none";
            showWarning("Unable to get your location."); // no address found
        }
    );
}
// once address is collected, we query the API and use the longitute and latitude to compare on the dataset
function getClosuresNear(userLat, userLon) {
    markerGroup.clearLayers();
    const radius = 1; //radius of the search
    const apiUrl = encodeURI(
        "https://data.winnipeg.ca/resource/h367-iifg.json?" +
        "$where=latitude IS NOT NULL AND longitude IS NOT NULL" + //WHERE clause
        "&$order=primary_street" + //ORDER clause
        "&$limit=2000" //this is the current limit of the dataset, the assignment says 100 but the data can handle more
    );
    //marker used for location based, got this from leafletjs.com
    L.marker([userLat, userLon])
        .addTo(markerGroup)
        .bindPopup("<strong>Your searched location</strong>")
        .openPopup();
    map.setView([userLat, userLon], 15);
    //after getting the data, we display it here and print using HTML elements
    fetch(apiUrl)
        .then(response => response.json())
        .then(retrieved => {
            //hide loading screen to show data:
            hideLoading();
            let output = "";
            let foundClosures = 0;
            //loops through all the data that we received and prints them one by one
            retrieved.forEach(closure => {
                const closureLat = parseFloat(closure.latitude);
                const closureLon = parseFloat(closure.longitude);
                const distance = getDistance(
                    userLat,
                    userLon,
                    closureLat,
                    closureLon
                );

                if (distance <= radius) {
                    foundClosures++;
                    const closedFormat = formatDate(closure.date_closed_from);
                    const finishedFormat = formatDate(closure.date_closed_to);
                    L.marker([closureLat, closureLon])
                        .addTo(markerGroup)
                        .bindPopup(`
                            <strong>${closure.primary_street}</strong><br>
                            ${closure.boundaries}<br>
                            ${closure.traffic_effect}<br>
                            Distance: ${distance.toFixed(2)} km
                        `);

                    output += `
                        <p>
                            <strong>Primary Street:</strong> ${closure.primary_street}<br>
                            <strong>Street Boundary:</strong> ${closure.boundaries}<br>
                            <strong>Status:</strong> Current<br>
                            <strong>Distance from Location:</strong> ${distance.toFixed(2)} km<br>
                            <strong>Description/Effect:</strong> ${closure.traffic_effect}<br>
                            <strong>Closed Since:</strong> ${closedFormat}<br>
                            <strong>Closed Until:</strong> ${finishedFormat}<br>
                        </p>
                        <hr>
                    `;
                }
            });
            // if there are no closures, it will show, example would be 99 ara way (my aunt's house)
            if (foundClosures === 0) {
                document.getElementById("dataLayout").style.display = "none";
                showWarning("No closures found within " + radius + " km.");
                return;
            }
            //css flex data for the fieldset
            document.getElementById("results").innerHTML = output;
            document.getElementById("dataLayout").style.display = "flex";
            setTimeout(function () {
                map.invalidateSize();
            }, 100);
        })
        //if there is an error:
        .catch(() => {
            hideLoading();
            document.getElementById("dataLayout").style.display = "none";
            showWarning("There was an error loading closure data.");
        });
}

//this function calculates the radius this was taken and revised from stackoverflow
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = degreesToRadians(lat2 - lat1);
    const dLon = degreesToRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(degreesToRadians(lat1)) *
        Math.cos(degreesToRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

function formatDate(rawDate) {
    if (!rawDate) {
        return "No date available";
    }

    const newDate = new Date(rawDate);

    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
    }).format(newDate);
}

//show warnign message from HTML
function showWarning(message) {
    document.getElementById("warning").innerHTML = message;
    document.getElementById("warning").style.visibility = "visible";
}

//hide warning message
function hideWarning() {
    document.getElementById("warning").style.visibility = "hidden";
}

//loading message. 
function showLoading() {
    document.getElementById("results").innerHTML = "";
    document.getElementById("dataLayout").style.display = "none";
    document.getElementById("loading").style.display = "flex";
}

//hide loading messsage
function hideLoading() {
    document.getElementById("loading").style.display = "none";
}