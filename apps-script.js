/**
 * Google Apps Script code for QR Check-In System
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Go to Extensions → Apps Script
 * 3. Copy and paste this entire code
 * 4. Click Deploy → New deployment
 * 5. Select "Web app" as type
 * 6. Set "Execute as" to "Me"
 * 7. Set "Who has access" to "Anyone"
 * 8. Click Deploy and copy the Web App URL
 */

// Handle both GET and POST requests from the web app
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getData') {
    return handleGetData();
  } else if (action === 'checkIn') {
    const qrCode = e.parameter.qrCode;
    return handleCheckIn({ qrCode: qrCode });
  }
  
  return createResponse(true, 'QR Check-In API is running!');
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    if (action === 'checkIn') {
      return handleCheckIn(data);
    } else if (action === 'getData') {
      return handleGetData();
    }
    
    return createResponse(false, 'Invalid action');
  } catch (error) {
    return createResponse(false, error.toString());
  }
}

// Get all data from the sheet
function handleGetData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    return createResponse(true, 'Data retrieved', { data: values });
  } catch (error) {
    return createResponse(false, error.toString());
  }
}

// Handle check-in logic
function handleCheckIn(data) {
  const qrCode = data.qrCode;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  // Skip header row, start from row 1 (index 1)
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const scoreValue = row[4] ? row[4].toString().trim() : ''; // 5th column (index 4)
    
    if (scoreValue === qrCode.trim()) {
      // Found a match
      const isCheckedIn = row[6] ? row[6].toString().trim().toUpperCase() : 'FALSE'; // 7th column (index 6)
      
      if (isCheckedIn === 'TRUE') {
        return createResponse(true, 'Already checked in!', {
          status: 'already_checked_in',
          rowIndex: i + 1
        });
      } else {
        // Update to TRUE
        sheet.getRange(i + 1, 7).setValue('TRUE'); // Row i+1, Column 7
        
        return createResponse(true, 'Check-in Success!', {
          status: 'checked_in',
          rowIndex: i + 1
        });
      }
    }
  }
  
  // No match found
  return createResponse(true, 'Not registered', {
    status: 'not_registered'
  });
}

// Create standardized response
function createResponse(success, message, data = {}) {
  const response = {
    success: success,
    message: message,
    ...data
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

