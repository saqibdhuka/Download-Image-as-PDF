// The Conversion Engine (Offscreen Document)
// This script receives the message from background.js, processes the image, builds the PDF, and saves it.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'convert-to-pdf') {
        processImageAndGeneratePdf(message.srcUrl, message.pageSize || 'original');
    }
});

async function processImageAndGeneratePdf(imageUrl, setting) {
    try {
        const isValidProtocol = imageUrl.startsWith('http://') ||
            imageUrl.startsWith('https://') ||
            imageUrl.startsWith('data:');

        if (!isValidProtocol) {
            throw new Error("Invalid URL protocol.");
        }

        const response = await fetch(imageUrl);

        if (!response.ok) {
            throw new Error(`Server rejected request (Status: ${response.status}).`);
        }

        if (imageUrl.startsWith('http')) {
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.startsWith('image/')) {
                throw new Error("Target URL did not return a valid image type.");
            }
        }

        const blob = await response.blob();
        const reader = new FileReader();

        reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
                const { jsPDF } = window.jspdf;

                let doc, finalWidth, finalHeight, x = 0, y = 0;

                if (setting === 'original') {
                    const orientation = img.width > img.height ? "landscape" : "portrait";
                    doc = new jsPDF({
                        orientation: orientation,
                        unit: "px",
                        format: [img.width, img.height]
                    });
                    finalWidth = img.width;
                    finalHeight = img.height;
                } else {
                    doc = new jsPDF({
                        orientation: "portrait",
                        unit: "pt",
                        format: setting
                    });
                    const pdfWidth = setting === 'a4' ? 595.28 : 612;
                    const pdfHeight = setting === 'a4' ? 841.89 : 792;
                    const imgRatio = img.width / img.height;
                    const pageRatio = pdfWidth / pdfHeight;

                    if (imgRatio > pageRatio) {
                        finalWidth = pdfWidth;
                        finalHeight = pdfWidth / imgRatio;
                        y = (pdfHeight - finalHeight) / 2;
                    } else {
                        finalHeight = pdfHeight;
                        finalWidth = pdfHeight * imgRatio;
                        x = (pdfWidth - finalWidth) / 2;
                    }
                }

                doc.addImage(img, 'PNG', x, y, finalWidth, finalHeight);

                // Export generated PDF as a Data URL to pass to background.js
                const pdfDataUrl = doc.output('datauristring');

                chrome.runtime.sendMessage({
                    action: 'pdf-generated',
                    pdfDataUrl: pdfDataUrl
                });
            };

            img.onerror = () => {
                chrome.runtime.sendMessage({ action: 'conversion-error', error: "Failed to parse file as an image." });
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(blob);
    } catch (error) {
        chrome.runtime.sendMessage({ action: 'conversion-error', error: error.message });
    }
}