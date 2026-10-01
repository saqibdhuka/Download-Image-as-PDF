//The Event Listener
// Register the right-click context menu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "save-as-pdf",
        title: "Download Image as PDF",
        contexts: ["image"]
    });
});

// Helper to create a hidden document for DOM processing
async function ensureOffscreenDocument() {
    const offscreenUrl = chrome.runtime.getURL('offscreen.html');
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) return;

    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['DOM_PARSER'],
        justification: 'Convert images to PDF using DOM Canvas capabilities'
    });
}

// Listen for clicks on the context menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "save-as-pdf" && info.srcUrl) {
        try {
            await ensureOffscreenDocument();

            // Pass the image URL to the offscreen document for conversion
            chrome.runtime.sendMessage({
                action: 'convert-to-pdf',
                srcUrl: info.srcUrl
            });
        } catch (error) {
            console.error("Failed to process image:", error);
        }
    }
});