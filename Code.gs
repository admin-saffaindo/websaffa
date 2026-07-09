/**
 * Saffa Bubur Bayi - Dashboard Keuangan
 * Backend Google Apps Script (Code.gs)
 * 
 * Hubungkan script ini ke Google Sheets.
 * Pastikan Sheet aktif Anda memiliki nama "Data Sheet" (atau sesuaikan di bawah).
 * Baris pertama (Header) harus berisi: Tanggal, Outlet, Cash, QRIS, Total, Timestamp
 */

const SHEET_NAME = "Data Sheet";

/**
 * Berfungsi untuk menampilkan halaman utama Index.html atau merespon request API (CORS)
 */
function doGet(e) {
  // Jika ada parameter action, berarti ini request API dari luar (misal React App)
  if (e && e.parameter && e.parameter.action) {
    try {
      const action = e.parameter.action;
      
      if (action === "read") {
        const data = getData();
        return ContentService.createTextOutput(JSON.stringify(data))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      if (action === "add") {
        const tanggal = e.parameter.tanggal;
        const outlet = e.parameter.outlet;
        const cash = Number(e.parameter.cash) || 0;
        const qris = Number(e.parameter.qris) || 0;
        const result = addData(tanggal, outlet, cash, qris);
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      if (action === "delete") {
        const rowId = Number(e.parameter.rowId);
        const result = deleteData(rowId);
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Action tidak dikenal" }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // Default: Tampilkan halaman Index.html
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Saffa Bubur Bayi - Dashboard Keuangan')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Menangani request POST dari luar
 */
function doPost(e) {
  try {
    let params = {};
    if (e && e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (err) {
        // Jika bukan JSON, parse parameter post biasa
        params = e.parameter;
      }
    } else if (e) {
      params = e.parameter;
    }
    
    const action = params.action || (e.parameter ? e.parameter.action : undefined);
    
    if (action === "add") {
      const tanggal = params.tanggal || (e.parameter ? e.parameter.tanggal : undefined);
      const outlet = params.outlet || (e.parameter ? e.parameter.outlet : undefined);
      const cash = Number(params.cash || (e.parameter ? e.parameter.cash : 0)) || 0;
      const qris = Number(params.qris || (e.parameter ? e.parameter.qris : 0)) || 0;
      
      const result = addData(tanggal, outlet, cash, qris);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "delete") {
      const rowId = Number(params.rowId || (e.parameter ? e.parameter.rowId : undefined));
      const result = deleteData(rowId);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "read") {
      const data = getData();
      return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Action POST tidak dikenal" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Mendapatkan lembaran kerja (Sheet) aktif
 */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Tulis header jika sheet baru dibuat
    sheet.appendRow(["ID", "Tanggal", "Outlet", "Cash", "QRIS", "Total", "Timestamp"]);
  }
  return sheet;
}

/**
 * Membuat ID transaksi sederhana campuran huruf dan angka (Format: D1799C)
 */
function generateSimpleId() {
  var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var digits = '0123456789';
  var firstLetter = letters.charAt(Math.floor(Math.random() * letters.length));
  var lastLetter = letters.charAt(Math.floor(Math.random() * letters.length));
  var numStr = '';
  for (var i = 0; i < 4; i++) {
    numStr += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return firstLetter + numStr + lastLetter;
}

/**
 * Opsi 3: Membuat ID unik terstruktur berbasis Tanggal Transaksi dan Nomor Urut (Format: SF-YYMMDD-NN)
 * Contoh: SF-260709-01 (Transaksi ke-1 pada tanggal 9 Juli 2026)
 */
function generateOpsi3Id(tanggalStr) {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    
    // Parse tanggal untuk mengambil format YYMMDD (e.g., "2026-07-09" -> "260709")
    let yy = "26";
    let mm = "01";
    let dd = "01";
    if (tanggalStr && tanggalStr.length >= 10) {
      const parts = tanggalStr.split("-");
      if (parts.length === 3) {
        yy = parts[0].substring(2);
        mm = parts[1];
        dd = parts[2];
      }
    }
    const datePrefix = "SF-" + yy + mm + dd + "-";
    
    let counter = 1;
    if (lastRow > 1) {
      const numCols = sheet.getLastColumn();
      const firstVal = sheet.getRange(1, 1).getValue();
      const isNewFormat = numCols >= 7 && firstVal && String(firstVal).trim().toUpperCase() === "ID";
      
      if (isNewFormat) {
        const idRange = sheet.getRange(2, 1, lastRow - 1, 1);
        const existingIds = idRange.getValues().map(row => String(row[0]));
        
        // Cari ID yang berawalan datePrefix yang sama, lalu cari nomor urut tertinggi
        let maxSeq = 0;
        existingIds.forEach(id => {
          if (id.indexOf(datePrefix) === 0) {
            const seqStr = id.substring(datePrefix.length);
            const seqNum = parseInt(seqStr, 10);
            if (!isNaN(seqNum) && seqNum > maxSeq) {
              maxSeq = seqNum;
            }
          }
        });
        counter = maxSeq + 1;
      }
    }
    
    // Format counter menjadi 2 digit (misal: 01, 02, dst)
    const counterStr = String(counter).padStart(2, '0');
    return datePrefix + counterStr;
  } catch (e) {
    // Fallback jika terjadi error
    return "SF-" + new Date().getTime().toString().substring(5);
  }
}

/**
 * Membaca semua data transaksi dari Google Sheets
 * @returns {Array<Object>} List data transaksi
 */
function getData() {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return []; // Hanya header atau kosong
    }
    
    const numCols = sheet.getLastColumn();
    const range = sheet.getRange(2, 1, lastRow - 1, numCols);
    const values = range.getValues();
    const firstVal = sheet.getRange(1, 1).getValue();
    const isNewFormat = numCols >= 7 && firstVal && String(firstVal).trim().toUpperCase() === "ID";
    
    // Konversi baris ke bentuk JSON array agar mudah diolah di frontend
    return values.map((row, index) => {
      let id = "";
      let dateVal = null;
      let outlet = "";
      let cash = 0;
      let qris = 0;
      let total = 0;
      let timestamp = "";
      
      if (isNewFormat) {
        id = row[0] ? String(row[0]) : "";
        dateVal = row[1];
        outlet = row[2];
        cash = Number(row[3]) || 0;
        qris = Number(row[4]) || 0;
        total = Number(row[5]) || 0;
        timestamp = row[6] ? String(row[6]) : "";
      } else {
        // Format lama 6 kolom
        id = "D" + (1700 + index) + "C"; // fallback simple ID
        dateVal = row[0];
        outlet = row[1];
        cash = Number(row[2]) || 0;
        qris = Number(row[3]) || 0;
        total = Number(row[4]) || 0;
        timestamp = row[5] ? String(row[5]) : "";
      }
      
      let dateString = "";
      if (dateVal instanceof Date) {
        const year = dateVal.getFullYear();
        const month = String(dateVal.getMonth() + 1).padStart(2, '0');
        const day = String(dateVal.getDate()).padStart(2, '0');
        dateString = `${year}-${month}-${day}`;
      } else {
        dateString = String(dateVal);
      }
      
      return {
        rowId: index + 2, // Baris nyata di Google Sheets (dimulai dari indeks 2)
        id: id,
        tanggal: dateString,
        outlet: outlet,
        cash: cash,
        qris: qris,
        total: total,
        timestamp: timestamp
      };
    });
  } catch (error) {
    throw new Error("Gagal mengambil data: " + error.message);
  }
}

/**
 * Menambahkan data transaksi baru ke Google Sheets
 * @param {string} tanggal - Format YYYY-MM-DD
 * @param {string} outlet - Nama outlet
 * @param {number} cash - Nominal cash
 * @param {number} qris - Nominal QRIS
 * @returns {Object} Hasil transaksi yang berhasil disimpan
 */
function addData(tanggal, outlet, cash, qris) {
  try {
    const sheet = getSheet();
    const data = getData();
    
    // Validasi double-input tingkat backend untuk memastikan integritas data
    const isDuplicate = data.some(item => item.tanggal === tanggal && item.outlet.toLowerCase() === outlet.toLowerCase());
    if (isDuplicate) {
      throw new Error(`Outlet ${outlet} sudah diinput untuk tanggal ${tanggal}!`);
    }
    
    const cashVal = Number(cash) || 0;
    const qrisVal = Number(qris) || 0;
    const totalVal = cashVal + qrisVal;
    const timestamp = new Date().toLocaleString("id-ID");
    const transactionId = generateOpsi3Id(tanggal);
    
    const numCols = sheet.getLastColumn();
    const firstVal = sheet.getRange(1, 1).getValue();
    const isNewFormat = numCols >= 7 && firstVal && String(firstVal).trim().toUpperCase() === "ID";
    
    if (isNewFormat) {
      // Tambahkan baris baru dengan format 7 kolom
      sheet.appendRow([transactionId, tanggal, outlet, cashVal, qrisVal, totalVal, timestamp]);
    } else {
      // Otomatis lakukan migrasi sheet lama ke format 7 kolom dengan menambahkan kolom ID di depan
      if (sheet.getLastRow() >= 1) {
        sheet.insertColumnBefore(1);
        sheet.getRange(1, 1).setValue("ID");
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          const idRange = sheet.getRange(2, 1, lastRow - 1, 1);
          const idValues = [];
          for (let i = 0; i < lastRow - 1; i++) {
            idValues.push([generateSimpleId()]);
          }
          idRange.setValues(idValues);
        }
        // Sekarang lembar kerja sudah bermigrasi ke 7 kolom
        sheet.appendRow([transactionId, tanggal, outlet, cashVal, qrisVal, totalVal, timestamp]);
      } else {
        // Lembar kerja kosong total
        sheet.appendRow(["ID", "Tanggal", "Outlet", "Cash", "QRIS", "Total", "Timestamp"]);
        sheet.appendRow([transactionId, tanggal, outlet, cashVal, qrisVal, totalVal, timestamp]);
      }
    }
    
    return {
      success: true,
      message: `Data untuk Outlet ${outlet} berhasil disimpan dengan ID ${transactionId}!`
    };
  } catch (error) {
    throw new Error("Gagal menyimpan data: " + error.message);
  }
}

/**
 * Menghapus transaksi berdasarkan nomor baris (rowId)
 * @param {number} rowId - Baris yang akan dihapus
 * @returns {Object} Status keberhasilan
 */
function deleteData(rowId) {
  try {
    const sheet = getSheet();
    const targetRow = Number(rowId);
    
    if (isNaN(targetRow) || targetRow < 2) {
      throw new Error("Row ID tidak valid.");
    }
    
    sheet.deleteRow(targetRow);
    return {
      success: true,
      message: "Data berhasil dihapus!"
    };
  } catch (error) {
    throw new Error("Gagal menghapus data: " + error.message);
  }
}
