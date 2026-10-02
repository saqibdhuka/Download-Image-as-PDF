//The Event Listener
// Register the right-click context menu
// Add or remove context menu based on user preference

function updateContextMenu(isEnabled) {
    chrome.contextMenus.removeAll(() => {
        if (isEnabled) {
            chrome.contextMenus.create({
                id: "save-as-pdf",
                title: "Download Image as PDF",
                contexts: ["image"]
            });
        }
    });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get({ isEnabled: true }, (result) => updateContextMenu(result.isEnabled));
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.isEnabled !== undefined) {
        updateContextMenu(changes.isEnabled.newValue);
    }
});

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

// Right-click context menu event listener
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "save-as-pdf" && info.srcUrl) {
        try {
            chrome.action.setBadgeText({ text: '...' });
            chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' });

            let finalUrlToProcess = info.srcUrl;

            // In-page fetch bypass for Gmail and authenticated URLs
            if (!info.srcUrl.startsWith('data:')) {
                try {
                    const injectionResults = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: async (targetUrl) => {
                            const response = await fetch(targetUrl);
                            const blob = await response.blob();
                            return new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                        },
                        args: [info.srcUrl]
                    });

                    if (injectionResults && injectionResults[0].result) {
                        finalUrlToProcess = injectionResults[0].result;
                    }
                } catch (injectionError) {
                    console.log("In-page fetch failed, falling back to background fetch.");
                }
            }

            const settings = await chrome.storage.local.get({ pageSize: 'original' });

            await ensureOffscreenDocument();
            chrome.runtime.sendMessage({
                action: 'convert-to-pdf',
                srcUrl: finalUrlToProcess,
                pageSize: settings.pageSize
            });

        } catch (error) {
            handleError("Failed to initiate download.");
        }
    }
});

// Messages received from offscreen.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'pdf-generated') {
        // Trigger chrome.downloads directly inside the service worker
        chrome.downloads.download({
            url: message.pdfDataUrl,
            filename: `image-${Date.now()}.pdf`,
            saveAs: false
        }, () => {
            chrome.action.setBadgeText({ text: 'DONE' });
            chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
            setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
        });

    } else if (message.action === 'conversion-error') {
        handleError(message.error);
    }
});

function handleError(errorMessage) {
    chrome.action.setBadgeText({ text: 'ERR' });
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 4000);

    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'PDF Conversion Failed',
        message: `Could not process image. Details: ${errorMessage}`
    });
}