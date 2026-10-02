const sizeSelect = document.getElementById('pageSize');
const enableToggle = document.getElementById('enableToggle');
const statusText = document.getElementById('status');

// Load the currently saved settings when the popup opens
chrome.storage.local.get({ pageSize: 'original', isEnabled: true }, (result) => {
    sizeSelect.value = result.pageSize;
    enableToggle.checked = result.isEnabled;
});

function showSaved() {
    statusText.style.display = 'block';
    setTimeout(() => { statusText.style.display = 'none'; }, 1500);
}

// Save page size setting
sizeSelect.addEventListener('change', () => {
    chrome.storage.local.set({ pageSize: sizeSelect.value }, showSaved);
});

// Save enable/disable toggle
enableToggle.addEventListener('change', () => {
    chrome.storage.local.set({ isEnabled: enableToggle.checked }, showSaved);
});