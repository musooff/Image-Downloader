document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('downloadBtn').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = tab.url;

        try {
            const idInfo = extractIdFromUrl(url);
            await downloadImages(idInfo);
        } catch (error) {
            showMessage(error.message, 'red');
            alert("Error: " + error.message);
        }
    });
});

function extractIdFromUrl(url) {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    if (hostname === 'www.encar.com') {
        const urlParams = new URLSearchParams(parsedUrl.search);
        const carid = urlParams.get('carid');
        if (carid) {
            return { site: 'encar', id: carid };
        } else {
            throw new Error("carid parameter not found in URL");
        }
    }

    if (hostname === 'dealer.heydealer.com') {
        const pathRegex = /\/cars\/([a-zA-Z0-9]+)\//;
        const match = parsedUrl.pathname.match(pathRegex);
        if (match) {
            return { site: 'heydealer', id: match[1] };
        } else {
            throw new Error("ID not found in URL path");
        }
    }
    throw new Error("Unsupported URL");
}

function russificateFuel(fuelType) {
    switch (fuelType) {
        case "가솔린":
        case "휘발유":
            return "Бензин";
        case "전기":
            return "Электрический";
        case "가솔린+전기":
        case "휘발유+전기":
            return "Гибрид";
        case "디젤":
            return "Дизель";
        case "LPG":
            return "Газ";
        default:
            return fuelType; // Return the original string if no match is found
    }
}

async function downloadImages(idInfo) {
    let imageList = [];
    let messageDetails = "";

    try {
        if (idInfo.site === 'encar') {
            const response = await fetch(`http://api.encar.com/v1/readside/vehicle/${idInfo.id}`, {});

            if (!response.ok) {
                throw new Error("Failed to fetch data from Encar: " + response.statusText);
            }

            const data = await response.json();
            imageList = data.photos.map(photo => {
                const path = photo.path; // Assuming photo.path contains the path
                const filename = path.split('/').pop(); // Extract filename from path
                const imageUrl = `https://ci.encar.com${path}?impolicy=heightRate&rh=653&cw=1160&ch=653&wtmk=http://ci.encar.com/wt_mark/w_mark_04.png`;
                return { imageUrl, filename }; // Return an object with URL and filename
            });
            
            // Extract additional details for display
            const category = data.category;
            const spec = data.spec;
            const advertisement = data.advertisement;

            const formattedMileage = new Intl.NumberFormat('en-US').format(spec.mileage);
            const fuelType = russificateFuel(spec.fuelName); // Use the new function here
            
            const priceCalculation = (advertisement.price + 44) * 10000;
            const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KRW' }).format(priceCalculation);

            messageDetails = `${category.manufacturerEnglishName} ${category.modelGroupEnglishName} ${category.gradeEnglishName} ${category.yearMonth.substring(0, 4)}/${category.formYear}\n` +
                             `${formattedMileage} км\n` +
                             `${fuelType} ${spec.displacement / 1000}L\n` +
                             `${formattedPrice}`;

        } else if (idInfo.site === 'heydealer') {
            // Get cookies for the current HeyDealer site
            const cookies = await getCookies('https://dealer.heydealer.com');
            const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

            const response = await fetch(`https://api.heydealer.com/v2/dealers/web/cars/${idInfo.id}`, {
                headers: {
                    'Cookie': cookieHeader
                }
            });

            if (!response.ok) {
                throw new Error("Failed to fetch data from HeyDealer: " + response.statusText);
            }

            const data = await response.json();
            imageList = data.detail.image_urls.map(url => {
                const filename = url.split('/').pop(); // Extract filename from URL
                return { imageUrl: url, filename };
            });

            // Extract car details
            const carDetails = data.detail;

            const formattedMileage = new Intl.NumberFormat('en-US').format(carDetails.mileage);
            const fuelType = russificateFuel(carDetails.fuel_display); // Use the new function here
            
            const priceCalculation = ((data.auction?.desired_price ?? 0) + 44) * 10000;
            const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KRW' }).format(priceCalculation);

            messageDetails = `${carDetails.full_name} ${carDetails.initial_registration_date.substring(0, 7).replace("-", ".")}/${carDetails.year}\n` + 
                             `${formattedMileage} км\n` +
                             `${fuelType} ${(carDetails?.carhistory?.displacement ?? 0) / 1000}L\n` +
                             `${formattedPrice}`;
        }

        if (imageList.length > 0) {
            for (let { imageUrl, filename } of imageList) {
                await downloadImage(imageUrl, filename); // Pass both URL and filename to download
            }

            showMessage(`Images downloaded successfully!\n${messageDetails}`, 'green');
            await navigator.clipboard.writeText(messageDetails);
        } else {
            alert('No images found for download');
        }
    } catch (error) {
        console.error("Error downloading images:", error);
        showMessage("Error downloading images: " + error.message, 'red');
        alert("Error: " + error.message);
    }
}

// Function to get cookies for a given URL
function getCookies(url) {
    return new Promise((resolve, reject) => {
        chrome.cookies.getAll({ url }, (cookies) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(cookies);
            }
        });
    });
}

async function downloadImage(imageUrl, filename) {
    const folderPath = 'imageDownloader/';
    const downloading = chrome.downloads.download({
        url: imageUrl,
        filename: `${folderPath}${filename}`,
        conflictAction: 'uniquify', // Automatically handle filename conflicts
        saveAs: false // Set to true if you want to prompt the user to select the save location
    });
}

function showMessage(message, color) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.innerText = message; // Set the message text
        messageDiv.style.color = color || 'black'; // Set the message color
    } else {
        console.error("Message div not found"); // Log an error if the div is not found
    }
}
