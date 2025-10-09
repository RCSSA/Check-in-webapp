// Global variables
let html5QrCode;
let webAppUrl = null;
let isScanning = false;

// DOM Elements
const connectBtn = document.getElementById('connect-btn');
const webappUrlInput = document.getElementById('webapp-url');
const setupSection = document.getElementById('setup-section');
const scannerSection = document.getElementById('scanner-section');
const stopScanBtn = document.getElementById('stop-scan-btn');
const changeSheetBtn = document.getElementById('change-sheet-btn');
const statusContainer = document.getElementById('status-container');

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

// Show status message
function showStatus(message, type = 'info', duration = 5000) {
    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message status-${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    statusDiv.innerHTML = `
        <span class="status-icon">${icons[type]}</span>
        <span>${message}</span>
    `;
    
    statusContainer.appendChild(statusDiv);
    
    setTimeout(() => {
        statusDiv.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => statusDiv.remove(), 300);
    }, duration);
}

// Connect to Web App
async function connectToWebApp() {
    const url = webappUrlInput.value.trim();
    
    if (!url) {
        showStatus('Please enter a Web App URL', 'error');
        return;
    }
    
    if (!url.includes('script.google.com/macros')) {
        showStatus('Invalid Google Apps Script Web App URL', 'error');
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
            showStatus('Successfully connected to Web App!', 'success');
            setupSection.style.display = 'none';
            scannerSection.style.display = 'block';
            startScanner();
        } else {
            throw new Error('Cannot fetch data from Web App');
        }
    } catch (error) {
        showStatus('Failed to connect. Check the Web App URL and deployment settings.', 'error');
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
        const response = await fetch(webAppUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',  // Changed from application/json
            },
            body: JSON.stringify({
                action: 'checkIn',
                qrCode: qrCode
            }),
            redirect: 'follow',
            mode: 'cors'
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
    showStatus(`Scanning: ${qrCodeData}`, 'info', 2000);
    
    try {
        // Use Apps Script backend for check-in
        const result = await checkInViaScript(qrCodeData);
        
        if (result.success) {
            if (result.status === 'checked_in') {
                showStatus('✅ Check-in Success!', 'success', 4000);
            } else if (result.status === 'already_checked_in') {
                showStatus('⚠️ Already checked in!', 'warning', 4000);
            } else if (result.status === 'not_registered') {
                showStatus('❌ Not registered', 'error', 4000);
            }
        } else {
            showStatus(`Error: ${result.message}`, 'error', 5000);
        }
        
    } catch (error) {
        console.error('Error processing QR code:', error);
        const errorMsg = error.message || 'Error processing QR code. Please try again.';
        showStatus(errorMsg, 'error');
    } finally {
        // Allow scanning again after 2 seconds
        setTimeout(() => {
            isScanning = false;
        }, 2000);
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
        showStatus('Could not start camera. Please check permissions.', 'error');
    });
}

// Stop QR Scanner
function stopScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            showStatus('Scanner stopped', 'info');
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
    setupSection.style.display = 'block';
}

