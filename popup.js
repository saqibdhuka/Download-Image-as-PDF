const sizeSelect = document.getElementById('pageSize');
const statusText = document.getElementById('status');

// Load the currently saved setting when the popup opens (defaults to 'original')
chrome.storage.local.get({ pageSize: 'original' }, (result) => {
    sizeSelect.value = result.pageSize;
});

// Save the setting immediately when the user changes the dropdown
sizeSelect.addEventListener('change', () => {
    chrome.storage.local.set({ pageSize: sizeSelect.value }, () => {
        statusText.style.display = 'inline';
        setTimeout(() => { statusText.style.display = 'none'; }, 1500);
    });
});