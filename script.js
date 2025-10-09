// Global variables
let html5QrCode;
let webAppUrl = null;
let isScanning = false;

// DOM Elements
const connectBtn = document.getElementById('connect-btn');
const webappUrlInput = document.getElementById('webapp-url');
const welcomeSection = document.getElementById('welcome-section');
const scannerSection = document.getElementById('scanner-section');
const stopScanBtn = document.getElementById('stop-scan-btn');
const changeSheetBtn = document.getElementById('change-sheet-btn');
const successPage = document.getElementById('success-page');
const alreadyCheckedInPage = document.getElementById('already-checked-in-page');
const notFoundPage = document.getElementById('not-found-page');

// Event Listeners
connectBtn.addEventListener('click', connectToWebApp);
stopScanBtn.addEventListener('click', stopScanner);
changeSheetBtn.addEventListener('click', changeWebApp);

// Load saved Web App URL on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedUrl = localStorage.getItem('webAppUrl');
    if (savedUrl && webappUrlInput) {
        webappUrlInput.value = savedUrl;
    }
});

// Show full-screen status page
function showStatusPage(statusType) {
    // Hide scanner
    scannerSection.style.display = 'none';
    
    // Stop the camera temporarily
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.pause(true);
    }
    
    // Show appropriate status page
    if (statusType === 'success') {
        successPage.style.display = 'flex';
    } else if (statusType === 'already_checked_in') {
        alreadyCheckedInPage.style.display = 'flex';
    } else if (statusType === 'not_found') {
        notFoundPage.style.display = 'flex';
    }
    
    // Return to scanner after 4 seconds
    setTimeout(() => {
        // Hide all status pages
        successPage.style.display = 'none';
        alreadyCheckedInPage.style.display = 'none';
        notFoundPage.style.display = 'none';
        
        // Show scanner again
        scannerSection.style.display = 'flex';
        
        // Resume scanning
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.resume();
        }
        
        // Allow next scan
        isScanning = false;
    }, 4000);
}

// Connect to Web App
async function connectToWebApp() {
    const url = webappUrlInput.value.trim();
    
    if (!url) {
        alert('Please enter a Web App URL');
        return;
    }
    
    if (!url.includes('script.google.com/macros')) {
        alert('Invalid Google Apps Script Web App URL');
        return;
    }
    
    webAppUrl = url;
    localStorage.setItem('webAppUrl', url);
    
    connectBtn.disabled = true;
    connectBtn.innerHTML = '<span class="loading"></span> Connecting...';
    
    try {
        // Test connection by trying to read the sheet
        const testResult = await fetchSheetData();
        
        if (testResult && testResult.length > 0) {
            welcomeSection.style.display = 'none';
            scannerSection.style.display = 'flex';
            startScanner();
        } else {
            throw new Error('Cannot fetch data from Web App');
        }
    } catch (error) {
        alert('Failed to connect. Check the Web App URL and deployment settings.');
        console.error('Connection error:', error);
        webAppUrl = null;
    } finally {
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
    }
}

// Fetch data from Google Sheet via Apps Script
async function fetchSheetData() {
    if (!webAppUrl) return null;
    
    try {
        const response = await fetch(`${webAppUrl}?action=getData`, {
            method: 'GET',
            redirect: 'follow'
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch sheet data');
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
            return result.data;
        } else {
            throw new Error(result.message || 'Failed to retrieve data');
        }
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        throw error;
    }
}

// Check-in via Google Apps Script Web App
async function checkInViaScript(qrCode) {
    if (!webAppUrl) {
        throw new Error('WEB_APP_NOT_CONFIGURED');
    }
    
    try {
        // Use GET request with URL parameters to avoid CORS preflight
        const url = `${webAppUrl}?action=checkIn&qrCode=${encodeURIComponent(qrCode)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow'
        });
        
        // Get the response text first to see what we're actually receiving
        const responseText = await response.text();
        console.log('Response text:', responseText);
        
        // Try to parse as JSON
        const result = JSON.parse(responseText);
        return result;
    } catch (error) {
        console.error('Detailed error:', error);
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        throw error;
    }
}

// Process scanned QR code
async function processQRCode(qrCodeData) {
    if (isScanning) {
        return; // Prevent multiple scans
    }
    
    isScanning = true;
    
    try {
        // Use Apps Script backend for check-in
        const result = await checkInViaScript(qrCodeData);
        
        if (result.success) {
            if (result.status === 'checked_in') {
                showStatusPage('success');
            } else if (result.status === 'already_checked_in') {
                showStatusPage('already_checked_in');
            } else if (result.status === 'not_registered') {
                showStatusPage('not_found');
            }
        } else {
            showStatusPage('not_found');
        }
        
    } catch (error) {
        console.error('Error processing QR code:', error);
        showStatusPage('not_found');
    }
}

// Start QR Scanner
function startScanner() {
    html5QrCode = new Html5Qrcode("reader");
    
    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };
    
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText, decodedResult) => {
            processQRCode(decodedText);
        },
        (errorMessage) => {
            // Ignore scan errors (they happen frequently while scanning)
        }
    ).catch((err) => {
        console.error('Error starting scanner:', err);
        alert('Could not start camera. Please check permissions.');
    });
}

// Stop QR Scanner
function stopScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            alert('Scanner stopped');
        }).catch((err) => {
            console.error('Error stopping scanner:', err);
        });
    }
}

// Change Web App
function changeWebApp() {
    stopScanner();
    webAppUrl = null;
    scannerSection.style.display = 'none';
    welcomeSection.style.display = 'flex';
}

