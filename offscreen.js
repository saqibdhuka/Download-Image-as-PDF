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

                // Fetch the user's page size preference from storage
                chrome.storage.local.get({ pageSize: 'original' }, (result) => {
                    const setting = result.pageSize;
                    let doc, finalWidth, finalHeight, x = 0, y = 0;

                    if (setting === 'original') {
                        // ORIGINAL LOGIC: Canvas matches exact image dimensions
                        const orientation = img.width > img.height ? "landscape" : "portrait";
                        doc = new jsPDF({
                            orientation: orientation,
                            unit: "px",
                            format: [img.width, img.height]
                        });
                        finalWidth = img.width;
                        finalHeight = img.height;

                    } else {
                        // FIXED PAGE LOGIC (A4 or Letter, forced to Portrait)
                        // jsPDF uses 'pt' (points) as the standard unit for print sizes
                        doc = new jsPDF({
                            orientation: "portrait",
                            unit: "pt",
                            format: setting // 'a4' or 'letter'
                        });

                        // Standard dimensions in points
                        const pdfWidth = setting === 'a4' ? 595.28 : 612; // A4 vs Letter width
                        const pdfHeight = setting === 'a4' ? 841.89 : 792; // A4 vs Letter height

                        const imgRatio = img.width / img.height;
                        const pageRatio = pdfWidth / pdfHeight;

                        // Calculate scaling to shrink the image while maintaining aspect ratio
                        if (imgRatio > pageRatio) {
                            // Image is wider than the page: Fit to page width
                            finalWidth = pdfWidth;
                            finalHeight = pdfWidth / imgRatio;
                            y = (pdfHeight - finalHeight) / 2; // Center vertically on the page
                        } else {
                            // Image is taller than the page: Fit to page height
                            finalHeight = pdfHeight;
                            finalWidth = pdfHeight * imgRatio;
                            x = (pdfWidth - finalWidth) / 2; // Center horizontally on the page
                        }
                    }

                    doc.addImage(img, 'PNG', x, y, finalWidth, finalHeight);

                    const pdfBlob = doc.output('blob');
                    const blobUrl = URL.createObjectURL(pdfBlob);

                    chrome.downloads.download({
                        url: blobUrl,
                        filename: `image-${Date.now()}.pdf`,
                        saveAs: false
                    }, () => {
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                    });
                }); // End of chrome.storage.local.get
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