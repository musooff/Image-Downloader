chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    try {
        const response = await fetch(request.url, {
            method: 'GET',
            credentials: 'include', // Include credentials like cookies
            headers: {
                'Content-Type': 'application/json',
            },
        });
        console.error('Log', request.url);
        const data = await response.json();
        sendResponse({ data });
    } catch (error) {
        console.error('Error fetching data:', error);
        sendResponse({ error: error.message });
    }
    return true; // Keep the messaging channel open
});
