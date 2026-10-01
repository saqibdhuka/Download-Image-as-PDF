//The Conversion Engine
// This script receives the message from background.js, processes the image, builds the PDF, and saves it.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'convert-to-pdf') {
        processImageAndDownload(message.srcUrl);
    }
});

async function processImageAndDownload(imageUrl) {
    try {
        // Only allow standard web protocols and base64 data URIs. 
        // Reject file://, chrome://, and ftp:// URLs.
        const isValidProtocol = imageUrl.startsWith('http://') ||
            imageUrl.startsWith('https://') ||
            imageUrl.startsWith('data:');

        if (!isValidProtocol) {
            console.error("Security Block: Invalid URL protocol detected.");
            return;
        }

        // Fetch the raw image data
        const response = await fetch(imageUrl);

        // Ensure the server actually returned an image, not a disguised script or large binary.
        // (Skip this check for data: URIs as they don't have headers in the same way)
        if (imageUrl.startsWith('http')) {
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.startsWith('image/')) {
                console.error("Security Block: Target URL did not return an image type.");
                return;
            }
        }

        const blob = await response.blob();

        // Convert blob to Data URL for jsPDF processing
        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
                const { jsPDF } = window.jspdf;

                const orientation = img.width > img.height ? "landscape" : "portrait";
                const doc = new jsPDF({
                    orientation: orientation,
                    unit: "px",
                    format: [img.width, img.height]
                });

                doc.addImage(img, 'PNG', 0, 0, img.width, img.height);

                const pdfBlob = doc.output('blob');
                const blobUrl = URL.createObjectURL(pdfBlob);

                chrome.downloads.download({
                    url: blobUrl,
                    filename: `image-${Date.now()}.pdf`,
                    saveAs: false
                }, () => {
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                });
            };
            // Handle corrupt image data gracefully
            img.onerror = () => {
                console.error("Failed to parse the fetched file as an image.");
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(blob);
    } catch (error) {
        console.error("Error creating PDF:", error);
    }
}