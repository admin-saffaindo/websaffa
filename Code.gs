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
    sheet.appendRow(["Tanggal", "Outlet", "Cash", "QRIS", "Total", "Timestamp"]);
  }
  return sheet;
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
    
    const range = sheet.getRange(2, 1, lastRow - 1, 6);
    const values = range.getValues();
    
    // Konversi baris ke bentuk JSON array agar mudah diolah di frontend
    return values.map((row, index) => {
      // Format tanggal ke YYYY-MM-DD
      let dateVal = row[0];
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
        tanggal: dateString,
        outlet: row[1],
        cash: Number(row[2]) || 0,
        qris: Number(row[3]) || 0,
        total: Number(row[4]) || 0,
        timestamp: row[5] ? String(row[5]) : ""
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
    
    // Tambahkan baris baru
    sheet.appendRow([tanggal, outlet, cashVal, qrisVal, totalVal, timestamp]);
    
    return {
      success: true,
      message: `Data untuk Outlet ${outlet} berhasil disimpan!`
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
