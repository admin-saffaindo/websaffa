import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
// @ts-ignore
import indexHtmlString from '../Index.html?raw';
import { 
  Lock, ArrowRight, LogOut, Wallet, Banknote, QrCode, Database, 
  PlusCircle, Save, BarChart3, History, Search, Trash2, Info, 
  CheckCircle, AlertCircle, FileCode, Copy, RefreshCw, BookOpen
} from 'lucide-react';

// Register Chart.js modules
Chart.register(...registerables);

// Hardcoded configs
const CORRECT_PASSWORD = 'saffaseiza123';
const OUTLETS_DATA = [
  {
    region: 'Wilayah Tanjungpinang (8 Lokasi)',
    items: ['KM 8 Atas', 'Poltekkes', 'Simpang Kios Djalal', 'Bincen', 'Jl. Cinta Damai', 'Ganet', 'Kijang Lama', 'KM 16 Arah Uban']
  },
  {
    region: 'Wilayah Bintan (3 Lokasi)',
    items: ['KM 18 Arah Kijang', 'Jl. Musi KM 19', 'Simpang 3 Tanah Kuning']
  }
];
const OUTLETS = OUTLETS_DATA.flatMap(r => r.items);
const LOGO_URL = 'https://i.ibb.co.com/6cmz9N6B/saffa-id.png';

// Interfaces
interface Transaction {
  id: string;
  tanggal: string;
  outlet: string;
  cash: number;
  qris: number;
  total: number;
  timestamp: string;
}

// Initial Mock Seed Data
const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: 't1', tanggal: '2026-07-07', outlet: 'KM 8 Atas', cash: 450000, qris: 150000, total: 600000, timestamp: '07/07/2026, 17:15:00' },
  { id: 't2', tanggal: '2026-07-07', outlet: 'Poltekkes', cash: 320000, qris: 220000, total: 540000, timestamp: '07/07/2026, 17:20:00' },
  { id: 't3', tanggal: '2026-07-06', outlet: 'KM 8 Atas', cash: 420000, qris: 180000, total: 600000, timestamp: '06/07/2026, 17:05:00' },
  { id: 't4', tanggal: '2026-07-06', outlet: 'Ganet', cash: 280000, qris: 120000, total: 400000, timestamp: '06/07/2026, 17:10:00' },
  { id: 't5', tanggal: '2026-07-06', outlet: 'Bincen', cash: 510000, qris: 240000, total: 750000, timestamp: '06/07/2026, 17:30:00' }
];

export default function App() {
  // App navigation & tabs
  const [activeTab, setActiveTab] = useState<'app' | 'gas'>('app');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('react_isLoggedIn') === 'true';
  });
  
  // Auth states
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);

  // Google Sheets Web App URL integration
  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    return localStorage.getItem('saffa_web_app_url') || '';
  });
  const [isLiveMode, setIsLiveMode] = useState<boolean>(() => {
    return localStorage.getItem('saffa_is_live_mode') === 'true';
  });
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(false);

  // Chart view selector state
  const [chartView, setChartView] = useState<'outlet' | 'weekly' | 'monthly'>('outlet');

  // Database / Transactions state (persisted to localStorage)
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const localData = localStorage.getItem('saffa_react_data');
    if (localData) {
      try {
        return JSON.parse(localData);
      } catch (e) {
        return DEFAULT_TRANSACTIONS;
      }
    }
    return DEFAULT_TRANSACTIONS;
  });

  // Form states
  const [tanggal, setTanggal] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [outlet, setOutlet] = useState('');
  const [cash, setCash] = useState<number | ''>('');
  const [qris, setQris] = useState<number | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false
  });

  // Show toast utility
  const triggerToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, visible: true });
  };

  // Function to fetch live data from Google Sheets Web App
  const fetchLiveTransactions = async (urlToUse = webAppUrl) => {
    if (!urlToUse) return;
    setIsLoadingLive(true);
    try {
      const response = await fetch(`${urlToUse}?action=read&_t=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        const formatted: Transaction[] = data.map((item: any) => ({
          id: `row_${item.rowId}`,
          tanggal: item.tanggal,
          outlet: item.outlet,
          cash: item.cash,
          qris: item.qris,
          total: item.total,
          timestamp: item.timestamp || '',
          rowId: item.rowId
        }));
        setTransactions(formatted);
        triggerToast('Sinkronisasi data Google Sheets berhasil!', 'success');
      } else {
        throw new Error('Format data tidak valid');
      }
    } catch (err: any) {
      console.error(err);
      triggerToast('Gagal sinkronisasi data: ' + err.message, 'error');
    } finally {
      setIsLoadingLive(false);
    }
  };

  // Chart ref
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Sync state to localStorage only when not in live mode
  useEffect(() => {
    if (!isLiveMode) {
      localStorage.setItem('saffa_react_data', JSON.stringify(transactions));
    }
  }, [transactions, isLiveMode]);

  // Initial load live transactions if in live mode
  useEffect(() => {
    if (isLiveMode && webAppUrl && isLoggedIn) {
      fetchLiveTransactions();
    }
  }, [isLiveMode, isLoggedIn]);

  // Render & Re-render Chart (Destroy and Recreate) on transactions change
  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'app' || !chartCanvasRef.current) return;

    let labels: string[] = [];
    let cashData: number[] = [];
    let qrisData: number[] = [];

    if (chartView === 'outlet') {
      labels = OUTLETS;
      const outletAggregates = OUTLETS.map(o => {
        const filtered = transactions.filter(t => t.outlet === o);
        const cashSum = filtered.reduce((sum, item) => sum + item.cash, 0);
        const qrisSum = filtered.reduce((sum, item) => sum + item.qris, 0);
        return {
          cash: cashSum,
          qris: qrisSum
        };
      });
      cashData = outletAggregates.map(d => d.cash);
      qrisData = outletAggregates.map(d => d.qris);
    } else if (chartView === 'weekly') {
      const weeksMap: { [key: string]: { startTimestamp: number; cash: number; qris: number } } = {};
      
      transactions.forEach(t => {
        const d = new Date(t.tanggal);
        if (isNaN(d.getTime())) return;
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0,0,0,0);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
        const label = `${monday.toLocaleDateString('id-ID', options)} - ${sunday.toLocaleDateString('id-ID', options)}`;
        
        if (!weeksMap[label]) {
          weeksMap[label] = {
            startTimestamp: monday.getTime(),
            cash: 0,
            qris: 0
          };
        }
        weeksMap[label].cash += t.cash;
        weeksMap[label].qris += t.qris;
      });
      
      const sortedWeeks = Object.entries(weeksMap).sort((a, b) => a[1].startTimestamp - b[1].startTimestamp);
      labels = sortedWeeks.map(([label]) => label);
      cashData = sortedWeeks.map(([_, data]) => data.cash);
      qrisData = sortedWeeks.map(([_, data]) => data.qris);
    } else if (chartView === 'monthly') {
      const monthsMap: { [key: string]: { startTimestamp: number; cash: number; qris: number } } = {};
      
      transactions.forEach(t => {
        const d = new Date(t.tanggal);
        if (isNaN(d.getTime())) return;
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        const label = startOfMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        
        if (!monthsMap[label]) {
          monthsMap[label] = {
            startTimestamp: startOfMonth.getTime(),
            cash: 0,
            qris: 0
          };
        }
        monthsMap[label].cash += t.cash;
        monthsMap[label].qris += t.qris;
      });
      
      const sortedMonths = Object.entries(monthsMap).sort((a, b) => a[1].startTimestamp - b[1].startTimestamp);
      labels = sortedMonths.map(([label]) => label);
      cashData = sortedMonths.map(([_, data]) => data.cash);
      qrisData = sortedMonths.map(([_, data]) => data.qris);
    }

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart instance if any (as per specifications)
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    // Create new chart instance
    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Cash (Tunai)',
            data: cashData,
            backgroundColor: 'rgba(120, 185, 40, 0.85)', // Saffa Green
            borderColor: '#78b928',
            borderWidth: 1.5,
            borderRadius: 8,
            borderSkipped: false,
          },
          {
            label: 'QRIS (Non-Tunai)',
            data: qrisData,
            backgroundColor: 'rgba(233, 0, 118, 0.85)', // Saffa Pink
            borderColor: '#e90076',
            borderWidth: 1.5,
            borderRadius: 8,
            borderSkipped: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: {
                family: 'Poppins',
                size: 11
              },
              boxWidth: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + formatRupiah(context.raw as number);
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: {
              display: false
            },
            ticks: {
              font: {
                family: 'Poppins',
                size: 11
              }
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              font: {
                family: 'Poppins',
                size: 10
              },
              callback: function(value) {
                const num = value as number;
                return num >= 1000000 
                  ? 'Rp ' + (num / 1000000).toFixed(1) + 'jt' 
                  : 'Rp ' + (num / 1000).toFixed(0) + 'rb';
              }
            }
          }
        }
      }
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [transactions, isLoggedIn, activeTab, chartView]);


  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, visible: false }));
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  // Auth Handlers
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === CORRECT_PASSWORD) {
      setAuthError(false);
      setIsLoggedIn(true);
      sessionStorage.setItem('react_isLoggedIn', 'true');
      triggerToast('Akses dikabulkan! Selamat datang di Dashboard.', 'success');
    } else {
      setAuthError(true);
      triggerToast('Kata sandi salah!', 'error');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    sessionStorage.removeItem('react_isLoggedIn');
    setPasswordInput('');
    triggerToast('Anda telah keluar dari dashboard.', 'success');
  };

  // Helper formats
  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const parseAndFormatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
  };

  // Dynamic Validation: Check which outlets are already registered on the selected date
  const registeredOutletsForSelectedDate = transactions
    .filter(t => t.tanggal === tanggal)
    .map(t => t.outlet);

  // Form submission handler
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();

    if (!tanggal) {
      triggerToast('Tanggal wajib diisi!', 'error');
      return;
    }
    if (!outlet) {
      triggerToast('Pilih outlet terlebih dahulu!', 'error');
      return;
    }

    // Validation logic (double safety)
    if (registeredOutletsForSelectedDate.includes(outlet)) {
      triggerToast(`Outlet ${outlet} sudah diinput untuk tanggal ini!`, 'error');
      return;
    }

    const cashValue = Number(cash) || 0;
    const qrisValue = Number(qris) || 0;
    const totalValue = cashValue + qrisValue;

    if (isLiveMode && webAppUrl) {
      setIsLoadingLive(true);
      const url = `${webAppUrl}?action=add&tanggal=${tanggal}&outlet=${encodeURIComponent(outlet)}&cash=${cashValue}&qris=${qrisValue}&_t=${Date.now()}`;
      fetch(url)
        .then(res => res.json())
        .then(resData => {
          if (resData.success) {
            triggerToast(resData.message || `Sukses menyimpan data untuk Outlet ${outlet}!`, 'success');
            // Reset inputs on success
            setOutlet('');
            setCash('');
            setQris('');
            // Refresh data
            fetchLiveTransactions();
          } else {
            triggerToast('Gagal menyimpan ke Google Sheets: ' + (resData.error || 'Terjadi kesalahan'), 'error');
          }
        })
        .catch(err => {
          triggerToast('Gagal menghubungi Google Sheets: ' + err.message, 'error');
        })
        .finally(() => {
          setIsLoadingLive(false);
        });
    } else {
      const newTx: Transaction = {
        id: 'tx_' + Date.now(),
        tanggal,
        outlet,
        cash: cashValue,
        qris: qrisValue,
        total: totalValue,
        timestamp: new Date().toLocaleString('id-ID')
      };

      setTransactions(prev => [newTx, ...prev]);
      triggerToast(`Sukses menyimpan data untuk Outlet ${outlet}!`, 'success');
      
      // Reset inputs
      setOutlet('');
      setCash('');
      setQris('');
    }
  };

  // Delete Handler
  const handleDeleteTransaction = (id: string, outletName: string, dateStr: string, rowId?: number) => {
    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus data outlet ${outletName} pada tanggal ${parseAndFormatDate(dateStr)}?`);
    if (!confirmDelete) return;

    if (isLiveMode && webAppUrl && rowId) {
      setIsLoadingLive(true);
      const url = `${webAppUrl}?action=delete&rowId=${rowId}&_t=${Date.now()}`;
      fetch(url)
        .then(res => res.json())
        .then(resData => {
          if (resData.success) {
            triggerToast(resData.message || 'Data berhasil dihapus dari Google Sheets!', 'success');
            fetchLiveTransactions();
          } else {
            triggerToast('Gagal menghapus dari Google Sheets: ' + (resData.error || 'Terjadi kesalahan'), 'error');
          }
        })
        .catch(err => {
          triggerToast('Gagal menghubungi Google Sheets: ' + err.message, 'error');
        })
        .finally(() => {
          setIsLoadingLive(false);
        });
    } else {
      setTransactions(prev => prev.filter(t => t.id !== id));
      triggerToast(`Data ${outletName} berhasil dihapus!`, 'success');
    }
  };

  // Reset to seed data
  const handleResetData = () => {
    const confirmReset = window.confirm("Ingin memulihkan data bawaan awal (Seed Data)? Ini akan menghapus data masukan baru Anda.");
    if (!confirmReset) return;

    setTransactions(DEFAULT_TRANSACTIONS);
    triggerToast("Data bawaan berhasil dipulihkan.", "success");
  };

  // Calculate Aggregates for Cards
  const totalOmset = transactions.reduce((sum, item) => sum + item.total, 0);
  const totalCash = transactions.reduce((sum, item) => sum + item.cash, 0);
  const totalQris = transactions.reduce((sum, item) => sum + item.qris, 0);
  const totalCount = transactions.length;

  // Search filtered transactions
  const filteredTransactions = transactions.filter(t => {
    const query = searchQuery.toLowerCase();
    return t.outlet.toLowerCase().includes(query) || 
           t.tanggal.toLowerCase().includes(query) ||
           parseAndFormatDate(t.tanggal).toLowerCase().includes(query);
  });

  // GAS Script strings to display in Code exporter
  const codeGsString = `/**
 * Saffa Bubur Bayi - Dashboard Keuangan
 * Backend Google Apps Script (Code.gs)
 * 
 * Hubungkan script ini ke Google Sheets.
 * Pastikan Sheet aktif Anda memiliki nama "Data Sheet" (atau sesuaikan di bawah).
 * Baris pertama (Header) harus berisi: Tanggal, Outlet, Cash, QRIS, Total, Timestamp
 */

const SHEET_NAME = "Data Sheet";

/**
 * Berfungsi untuk menampilkan halaman utama Index.html
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Saffa Bubur Bayi - Dashboard Keuangan')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Mendapatkan lembaran kerja (Sheet) aktif
 */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["Tanggal", "Outlet", "Cash", "QRIS", "Total", "Timestamp"]);
  }
  return sheet;
}

/**
 * Membaca semua data transaksi dari Google Sheets
 */
function getData() {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    
    const range = sheet.getRange(2, 1, lastRow - 1, 6);
    const values = range.getValues();
    
    return values.map((row, index) => {
      let dateVal = row[0];
      let dateString = "";
      if (dateVal instanceof Date) {
        const year = dateVal.getFullYear();
        const month = String(dateVal.getMonth() + 1).padStart(2, '0');
        const day = String(dateVal.getDate()).padStart(2, '0');
        dateString = \`\${year}-\${month}-\${day}\`;
      } else {
        dateString = String(dateVal);
      }
      
      return {
        rowId: index + 2,
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
 */
function addData(tanggal, outlet, cash, qris) {
  try {
    const sheet = getSheet();
    const data = getData();
    
    const isDuplicate = data.some(item => item.tanggal === tanggal && item.outlet.toLowerCase() === outlet.toLowerCase());
    if (isDuplicate) {
      throw new Error(\`Outlet \${outlet} sudah diinput untuk tanggal \${tanggal}!\`);
    }
    
    const cashVal = Number(cash) || 0;
    const qrisVal = Number(qris) || 0;
    const totalVal = cashVal + qrisVal;
    const timestamp = new Date().toLocaleString("id-ID");
    
    sheet.appendRow([tanggal, outlet, cashVal, qrisVal, totalVal, timestamp]);
    
    return {
      success: true,
      message: \`Data untuk Outlet \${outlet} berhasil disimpan!\`
    };
  } catch (error) {
    throw new Error("Gagal menyimpan data: " + error.message);
  }
}

/**
 * Menghapus transaksi berdasarkan nomor baris (rowId)
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
}`;

  // Handle copy to clipboard
  const handleCopyCode = (text: string, fileName: string) => {
    navigator.clipboard.writeText(text);
    triggerToast(`Isi file ${fileName} berhasil disalin ke clipboard!`, 'success');
  };

  return (
    <div className="min-h-screen bg-[#fef2f7] text-gray-800 antialiased flex flex-col font-sans">
      
      {/* Floating background design details from Vibrant Palette */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-pink-300/20 blur-[130px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-green-200/20 blur-[150px] pointer-events-none z-0"></div>

      {/* Main Container */}
      <div className="relative z-10 flex-1 flex flex-col">
        
        {/* ==================================================== */}
        {/* VIEW 1: LOGIN (WHEN NOT LOGGED IN) */}
        {/* ==================================================== */}
        {!isLoggedIn ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div id="login-card" className="w-full max-w-md bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-8 md:p-10 transition-all duration-300 shadow-2xl">
              
              {/* Brand Logo & Heading */}
              <div className="text-center mb-8">
                <img 
                  src={LOGO_URL} 
                  alt="Saffa Bubur Bayi Logo" 
                  className="h-24 mx-auto mb-4 object-contain filter drop-shadow-md"
                  referrerPolicy="no-referrer"
                />
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Dashboard Keuangan</h2>
                <div className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1 bg-pink-100 text-saffa-pink rounded-full text-xs font-semibold tracking-wide uppercase">
                  Saffa Bubur Bayi
                </div>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-6">
                <div>
                  <label htmlFor="password-input" className="block text-sm font-medium text-gray-600 mb-2">
                    Kata Sandi Akses
                  </label>
                  <div className="relative rounded-2xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-5 h-5" />
                    </div>
                    <input 
                      type="password" 
                      id="password-input"
                      required 
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Masukkan kata sandi..." 
                      className="block w-full pl-11 pr-4 py-3.5 bg-white/60 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-saffa-pink focus:border-transparent transition-all placeholder:text-gray-400 text-sm"
                    />
                  </div>
                  {authError && (
                    <p className="mt-2 text-xs text-saffa-pink font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Sandi salah! Silakan coba lagi.
                    </p>
                  )}
                </div>

                <button 
                  type="submit" 
                  className="w-full py-4 bg-gradient-to-r from-saffa-pink to-pink-600 hover:from-saffa-pink-hover hover:to-pink-700 text-white font-semibold rounded-2xl shadow-lg shadow-pink-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  Masuk ke Dashboard
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-8 text-center text-xs text-gray-400">
                &copy; 2026 Saffa Bubur Bayi • Hak Cipta Dilindungi.
              </div>

            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            
            {/* HEADER */}
            <header className="w-full py-4 px-4 md:px-12 bg-white/60 backdrop-blur-xl border-b border-white/40 sticky top-0 z-40 shadow-sm">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                {/* Brand Identity */}
                <div className="flex items-center gap-3">
                  <img 
                    src={LOGO_URL} 
                    alt="Saffa Bubur Bayi Logo" 
                    className="h-12 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h1 className="text-lg md:text-xl font-bold text-gray-800 tracking-tight leading-none flex items-center gap-2">
                      Saffa Bubur Bayi
                    </h1>
                    <p className="text-[10px] md:text-xs text-[#78b928] font-semibold tracking-wide uppercase mt-1">
                      Dashboard Keuangan & Ekspor GAS
                    </p>
                  </div>
                </div>

                {/* Navigation and Actions */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Mode Selector */}
                  <div className="bg-white/40 backdrop-blur-md p-1 rounded-2xl flex border border-white/60 shadow-sm">
                    <button
                      onClick={() => setActiveTab('app')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'app' 
                          ? 'bg-[#e90076] text-white shadow-md' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/20'
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      Aplikasi Demo
                    </button>
                    <button
                      onClick={() => setActiveTab('gas')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'gas' 
                          ? 'bg-[#e90076] text-white shadow-md' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/20'
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      Dapatkan Kode GAS
                    </button>
                  </div>

                  {/* Logout Button */}
                  <button 
                    onClick={handleLogout} 
                    className="px-4 py-2 bg-white/60 hover:bg-red-50 text-red-600 border border-white/80 rounded-2xl font-semibold text-xs transition-all flex items-center gap-1.5 hover:shadow-md cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Keluar
                  </button>
                </div>

              </div>
            </header>

            {/* TAB CONTENT 1: INTERACTIVE APP PREVIEW */}
            {activeTab === 'app' && (
              <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">                 {/* RECTOR BULLETINS */}
                <div className="p-4 bg-emerald-50/80 border border-emerald-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-medium text-emerald-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-saffa-green flex-shrink-0" />
                    <span>Halaman ini mensimulasikan integrasi real-time Google Apps Script & Google Sheets menggunakan penyimpanan lokal.</span>
                  </div>
                  <button 
                    onClick={handleResetData}
                    className="self-start sm:self-auto px-3 py-1.5 bg-white hover:bg-emerald-100 border border-emerald-200 text-saffa-green rounded-lg font-semibold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Pulihkan Seed Data
                  </button>
                </div>

                {/* GOOGLE SHEETS LIVE CONNECTION PANEL */}
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 shadow-lg rounded-[2rem] p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-saffa-green flex-shrink-0">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-800">Koneksi Spreadsheet Google Sheets (Saffa Live)</h3>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          Hubungkan aplikasi pratinjau ini secara langsung ke Google Sheets Anda dengan menempelkan URL Web App hasil deploy Apps Script.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 self-start md:self-center">
                      <span className="text-xs font-semibold text-gray-500">Status:</span>
                      {isLiveMode && webAppUrl ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-1.5"></span>
                          Terhubung (LIVE)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                          <span className="w-2 h-2 rounded-full bg-gray-400 mr-1.5"></span>
                          Offline (Lokal)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/60 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-8">
                      <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 tracking-wider">
                        Google Apps Script Web App URL
                      </label>
                      <input 
                        type="url"
                        value={webAppUrl}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setWebAppUrl(val);
                          localStorage.setItem('saffa_web_app_url', val);
                        }}
                        placeholder="https://script.google.com/macros/s/AKfyby.../exec"
                        className="w-full px-3 py-2 bg-white/70 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#78b928]/30 focus:border-transparent font-mono"
                      />
                    </div>
                    
                    <div className="md:col-span-4 flex gap-2 h-9 self-end">
                      <button
                        onClick={() => {
                          if (!webAppUrl) {
                            triggerToast('Harap masukkan URL Web App Google Script terlebih dahulu!', 'error');
                            return;
                          }
                          const nextMode = !isLiveMode;
                          setIsLiveMode(nextMode);
                          localStorage.setItem('saffa_is_live_mode', String(nextMode));
                          if (nextMode) {
                            fetchLiveTransactions(webAppUrl);
                          } else {
                            // Offline, reset to local transactions
                            const localData = localStorage.getItem('saffa_react_data');
                            if (localData) {
                              setTransactions(JSON.parse(localData));
                            } else {
                              setTransactions(DEFAULT_TRANSACTIONS);
                            }
                            triggerToast('Beralih kembali ke mode penyimpanan lokal (offline).', 'success');
                          }
                        }}
                        className={`flex-1 h-full px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isLiveMode 
                            ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm' 
                            : 'bg-saffa-green hover:bg-saffa-green-hover text-white shadow-sm shadow-green-100'
                        }`}
                      >
                        {isLoadingLive ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : isLiveMode ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            Matikan Live
                          </>
                        ) : (
                          <>
                            <Database className="w-3.5 h-3.5" />
                            Hubungkan Live
                          </>
                        )}
                      </button>

                      {isLiveMode && (
                        <button
                          onClick={() => fetchLiveTransactions()}
                          disabled={isLoadingLive}
                          className="px-3 h-full bg-white hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm"
                          title="Refresh Data dari Sheets"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLive ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-[11px] text-gray-500 leading-relaxed font-medium">
                    {isLiveMode ? (
                      <span className="text-[#78b928] font-bold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 flex-shrink-0" />
                        Aplikasi saat ini membaca dan menulis data langsung ke Google Sheets Anda!
                      </span>
                    ) : (
                      <span>
                        💡 <strong>Cara Hubungkan Live:</strong> Salin script dari tab <strong>Dapatkan Kode GAS</strong>, pasang di Google Sheets Anda, Deploy sebagai <strong>Web App</strong>, lalu tempel URL-nya di atas dan klik <strong>Hubungkan Live</strong>.
                      </span>
                    )}
                  </div>
                </div>

                {/* CARDS: FINANCIAL SUMMARY */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* CARD 1: TOTAL OMSET */}
                  <div className="bg-[#e90076] rounded-[2rem] p-5 shadow-xl text-white relative overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-85">Total Omset</p>
                        <h3 className="text-lg md:text-2xl font-bold mt-1 tracking-tight">{formatRupiah(totalOmset)}</h3>
                      </div>
                      <div className="bg-white/25 p-2.5 rounded-2xl text-white">
                        <Wallet className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-[10px] mt-4 font-medium opacity-75">Total Tunai + QRIS</p>
                    <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                  </div>

                  {/* CARD 2: TOTAL CASH */}
                  <div className="bg-[#78b928] rounded-[2rem] p-5 shadow-xl text-white relative overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider opacity-85">Omset Cash</p>
                        <h3 className="text-lg md:text-2xl font-bold mt-1 tracking-tight">{formatRupiah(totalCash)}</h3>
                      </div>
                      <div className="bg-white/25 p-2.5 rounded-2xl text-white">
                        <Banknote className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-[10px] mt-4 font-medium opacity-75">Pembayaran Tunai</p>
                    <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                  </div>

                  {/* CARD 3: TOTAL QRIS */}
                  <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-5 shadow-xl border border-white/60 flex flex-col justify-between transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Omset QRIS</p>
                        <h3 className="text-lg md:text-2xl font-bold text-gray-800 mt-1 tracking-tight">{formatRupiah(totalQris)}</h3>
                      </div>
                      <div className="bg-pink-100 p-2.5 rounded-2xl text-[#e90076]">
                        <QrCode className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-4 font-medium">Transaksi QR QRIS</p>
                  </div>

                  {/* CARD 4: TOTAL ENTRIES */}
                  <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-5 shadow-xl border border-white/60 flex flex-col justify-between transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Laporan</p>
                        <h3 className="text-lg md:text-2xl font-bold text-gray-800 mt-1 tracking-tight">{totalCount}</h3>
                      </div>
                      <div className="bg-green-100 p-2.5 rounded-2xl text-[#78b928]">
                        <Database className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-4 font-medium">Total baris laporan</p>
                  </div>

                </div>                 {/* MODULAR SECTION: FORM INPUT & VISUAL ANALYTICS */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* FORM COLUMN */}
                  <div className="lg:col-span-4 bg-white/40 backdrop-blur-2xl border border-white/60 shadow-2xl rounded-[2.5rem] p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center text-saffa-pink">
                          <PlusCircle className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">Input Transaksi Harian</h2>
                      </div>

                      <form onSubmit={handleSaveTransaction} className="space-y-4">
                        {/* INPUT DATE */}
                        <div>
                          <label htmlFor="form-tanggal" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Tanggal
                          </label>
                          <input 
                            type="date" 
                            id="form-tanggal"
                            required 
                            value={tanggal}
                            onChange={(e) => setTanggal(e.target.value)}
                            className="block w-full px-4 py-3 bg-white/70 border border-white/80 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#e90076]/30 transition-all"
                          />
                        </div>

                        {/* OUTLET OPTION */}
                        <div>
                          <label htmlFor="form-outlet" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Outlet
                          </label>
                          <select 
                            id="form-outlet"
                            required
                            value={outlet}
                            onChange={(e) => setOutlet(e.target.value)}
                            className="block w-full px-4 py-3 bg-white/70 border border-white/80 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#e90076]/30 transition-all cursor-pointer"
                          >
                            <option value="" disabled>Pilih Outlet...</option>
                            {OUTLETS_DATA.map(group => (
                              <optgroup key={group.region} label={group.region} className="font-bold text-gray-700 bg-gray-50 text-xs">
                                {group.items.map(o => {
                                  const isDisabled = registeredOutletsForSelectedDate.includes(o);
                                  return (
                                    <option 
                                      key={o} 
                                      value={o} 
                                      disabled={isDisabled}
                                      className={isDisabled ? "text-gray-300 bg-gray-50 font-normal" : "text-gray-800 font-semibold bg-white"}
                                    >
                                      {o} {isDisabled ? '(Sudah diinput)' : ''}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            ))}
                          </select>
                          {registeredOutletsForSelectedDate.length > 0 && (
                            <p className="text-[10px] text-amber-600 mt-1.5 font-semibold flex items-center gap-1">
                              <Info className="w-3 h-3 flex-shrink-0" />
                              Outlet yang sudah diinput pada {parseAndFormatDate(tanggal)} dinonaktifkan otomatis.
                            </p>
                          )}
                        </div>

                        {/* CASH INPUT */}
                        <div>
                          <label htmlFor="form-cash" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            Cash (Rp)
                          </label>
                          <div className="relative rounded-2xl shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 text-xs font-semibold">
                              Rp
                            </div>
                            <input 
                              type="number" 
                              id="form-cash"
                              min="0" 
                              required 
                              value={cash}
                              onChange={(e) => setCash(e.target.value === '' ? '' : Number(e.target.value))}
                              placeholder="0"
                              className="block w-full pl-11 pr-4 py-3 bg-white/70 border border-white/80 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#e90076]/30 transition-all font-mono"
                            />
                          </div>
                        </div>

                        {/* QRIS INPUT */}
                        <div>
                          <label htmlFor="form-qris" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                            QRIS (Rp)
                          </label>
                          <div className="relative rounded-2xl shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 text-xs font-semibold">
                              Rp
                            </div>
                            <input 
                              type="number" 
                              id="form-qris"
                              min="0" 
                              required 
                              value={qris}
                              onChange={(e) => setQris(e.target.value === '' ? '' : Number(e.target.value))}
                              placeholder="0"
                              className="block w-full pl-11 pr-4 py-3 bg-white/70 border border-white/80 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#e90076]/30 transition-all font-mono"
                            />
                          </div>
                        </div>

                        {/* TOTAL PREVIEW CARD */}
                        <div className="p-4 bg-[#fef2f7] border border-[#e90076]/20 rounded-2xl flex justify-between items-center text-xs">
                          <span className="font-semibold text-gray-500">Estimasi Total Omset:</span>
                          <span className="font-bold text-[#e90076] text-base font-mono">
                            {formatRupiah((Number(cash) || 0) + (Number(qris) || 0))}
                          </span>
                        </div>

                        <button 
                          type="submit"
                          className="w-full py-4 bg-[#78b928] hover:bg-[#62981f] text-white font-bold rounded-2xl shadow-lg shadow-green-500/10 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.98]"
                        >
                          <Save className="w-4 h-4" />
                          Simpan Transaksi
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* VISUAL ANALYTICS COLUMN */}
                  <div className="lg:col-span-8 bg-white/60 backdrop-blur-xl border border-white shadow-xl rounded-[2.5rem] p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-saffa-green">
                            <BarChart3 className="w-5 h-5" />
                          </div>
                          <h2 className="text-lg font-bold text-gray-800 font-sans">
                            {chartView === 'outlet' && 'Grafik Omset Outlet'}
                            {chartView === 'weekly' && 'Tren Omset Mingguan'}
                            {chartView === 'monthly' && 'Tren Omset Bulanan'}
                          </h2>
                        </div>
                        
                        {/* Selector Tabs */}
                        <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-2xl border border-gray-200/50">
                          <button
                            type="button"
                            onClick={() => setChartView('outlet')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              chartView === 'outlet'
                                ? 'bg-[#78b928] text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-200/80'
                            }`}
                          >
                            Outlet
                          </button>
                          <button
                            type="button"
                            onClick={() => setChartView('weekly')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              chartView === 'weekly'
                                ? 'bg-[#78b928] text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-200/80'
                            }`}
                          >
                            Mingguan
                          </button>
                          <button
                            type="button"
                            onClick={() => setChartView('monthly')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              chartView === 'monthly'
                                ? 'bg-[#78b928] text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-200/80'
                            }`}
                          >
                            Bulanan
                          </button>
                        </div>
                      </div>

                      {/* CHART CONTAINER */}
                      <div className="relative w-full h-[340px] bg-white/30 backdrop-blur-md rounded-[2rem] p-4 border border-white/60 shadow-inner">
                        <canvas ref={chartCanvasRef} className="w-full h-full"></canvas>
                      </div>
                    </div>
                  </div>

                </div>

                {/* BOTTOM SECTION: TABLE HISTORY */}
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 shadow-lg rounded-[2.5rem] p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center text-saffa-pink">
                        <History className="w-5 h-5" />
                      </div>
                      <h2 className="text-lg font-bold text-gray-800">Riwayat Transaksi Harian</h2>
                    </div>

                    {/* SEARCH INPUT */}
                    <div className="relative rounded-2xl max-w-xs w-full shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                        <Search className="w-4 h-4" />
                      </div>
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari tanggal / outlet..."
                        className="block w-full pl-11 pr-4 py-3 bg-white/70 border border-white/80 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#e90076]/30 transition-all"
                      />
                    </div>
                  </div>

                  {/* TABLE WRAPPER */}
                  <div className="overflow-x-auto rounded-[2rem] border border-white/40 shadow-sm">
                    <table className="min-w-full divide-y divide-white/60 bg-white/30 text-left text-sm font-medium">
                      <thead className="bg-white/50">
                        <tr>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider">Tanggal</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider">Outlet</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider text-right">Cash</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider text-right">QRIS</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider text-right">Total</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Info className="w-8 h-8 text-gray-300" />
                                <span>Tidak ditemukan riwayat data transaksi harian.</span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredTransactions.map((item) => (
                            <tr key={item.id} className="hover:bg-pink-50/10 transition-all">
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-700">
                                {parseAndFormatDate(item.tanggal)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                  item.outlet === 'KM 8 Atas' ? 'bg-pink-100 text-saffa-pink' :
                                  item.outlet === 'Poltekkes' ? 'bg-green-100 text-saffa-green' :
                                  item.outlet === 'Ganet' ? 'bg-blue-100 text-blue-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {item.outlet}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-600 font-semibold">
                                {formatRupiah(item.cash)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-600 font-semibold">
                                {formatRupiah(item.qris)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right font-bold font-mono text-saffa-pink">
                                {formatRupiah(item.total)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button 
                                  onClick={() => handleDeleteTransaction(item.id, item.outlet, item.tanggal, item.rowId)}
                                  className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all inline-flex items-center justify-center cursor-pointer hover:shadow-sm"
                                  title="Hapus data"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </main>
            )}             {/* TAB CONTENT 2: GOOGLE APPS SCRIPT CODE & SETUP EXPLAINER */}
            {activeTab === 'gas' && (
              <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
                
                {/* HEADLINE */}
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 shadow-lg rounded-[2.5rem] p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-[#78b928]">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">Panduan Pemasangan Google Apps Script (GAS)</h2>
                      <p className="text-xs text-gray-500 font-medium">Langkah-langkah menyambungkan dashboard ini ke Google Sheets pribadi Anda.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-xs font-medium text-gray-700 leading-relaxed">
                    <div className="p-4 bg-white/70 border border-white/80 rounded-2xl">
                      <span className="text-lg font-black text-saffa-pink block mb-2">1. Siapkan Google Sheets</span>
                      Buat Google Sheet baru, ubah nama sheet pertama Anda menjadi <code className="bg-pink-100/60 text-saffa-pink px-1.5 py-0.5 rounded font-bold">Data Sheet</code>. 
                      Lalu buat header kolom di baris pertama: 
                      <div className="bg-gray-100 p-2 rounded mt-2 font-mono font-bold leading-tight">
                        Tanggal | Outlet | Cash | QRIS | Total | Timestamp
                      </div>
                    </div>

                    <div className="p-4 bg-white/70 border border-white/80 rounded-2xl">
                      <span className="text-lg font-black text-saffa-green block mb-2">2. Tempel Kode Backend</span>
                      Buka menu <span className="font-bold">Ekstensi &gt; Apps Script</span> di Google Sheet Anda. Hapus semua fungsi bawaan yang ada, lalu salin seluruh kode dari tab <span className="font-bold text-saffa-pink">Code.gs</span> di bawah ini dan tempel di editor script Anda.
                    </div>

                    <div className="p-4 bg-white/70 border border-white/80 rounded-2xl">
                      <span className="text-lg font-black text-blue-600 block mb-2">3. Tempel Kode Frontend</span>
                      Buat berkas baru di Google Apps Script (Klik tanda + di samping File, pilih <span className="font-bold">HTML</span>). Beri nama persis <code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">Index</code> (otomatis menjadi Index.html). Salin isi file <span className="font-bold text-saffa-green">Index.html</span> di folder proyek ini ke dalamnya, lalu jalankan <span className="font-bold">Deployment &gt; New deployment</span> sebagai Web App, akses "Anyone".
                    </div>
                  </div>
                </div>

                {/* CODE BOXES PANEL */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* BOX 1: CODE.GS */}
                  <div className="bg-white/40 backdrop-blur-xl border border-white/60 shadow-lg rounded-[2.5rem] p-6 flex flex-col justify-between h-[520px]">
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm bg-pink-100 text-saffa-pink px-3 py-1.5 rounded-xl">Code.gs</span>
                          <span className="text-xs text-gray-500 font-semibold">Backend Google Apps Script</span>
                        </div>
                        <button 
                          onClick={() => handleCopyCode(codeGsString, 'Code.gs')}
                          className="px-3 py-1.5 bg-saffa-pink hover:bg-saffa-pink-hover text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-pink-200"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Salin Kode
                        </button>
                      </div>

                      <div className="flex-1 overflow-auto bg-gray-900 rounded-2xl p-4 border border-gray-800 font-mono text-[11px] text-gray-300 leading-normal scrollbar">
                        <pre>{codeGsString}</pre>
                      </div>
                    </div>
                  </div>

                  {/* BOX 2: INDEX.HTML */}
                  <div className="bg-white/40 backdrop-blur-xl border border-white/60 shadow-lg rounded-[2.5rem] p-6 flex flex-col justify-between h-[520px]">
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm bg-green-100 text-saffa-green px-3 py-1.5 rounded-xl">Index.html</span>
                          <span className="text-xs text-gray-500 font-semibold">Frontend HTML dengan Tailwind & Chart.js</span>
                        </div>
                        <button 
                          onClick={() => handleCopyCode(indexHtmlString, 'Index.html')}
                          className="px-3 py-1.5 bg-saffa-green hover:bg-saffa-green-hover text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-green-200"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Salin Kode Lengkap
                        </button>
                      </div>

                      <div className="flex-1 overflow-auto bg-gray-900 rounded-2xl p-4 border border-gray-800 font-mono text-[11px] text-gray-300 leading-normal scrollbar">
                        <div className="mb-4 text-xs text-amber-400 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl font-sans font-medium">
                          💡 Klik tombol <strong className="underline">Salin Kode Lengkap</strong> di atas untuk menyalin isi dari berkas <strong className="font-mono">Index.html</strong> premium berukuran penuh yang dinamis dan modern.
                        </div>
                        <pre>{indexHtmlString}</pre>
                      </div>
                    </div>
                  </div>

                </div>

              </main>
            )}

            {/* FOOTER */}
            <footer className="w-full py-5 text-center text-xs text-gray-400 border-t border-gray-200/50 bg-white/20 mt-auto flex-shrink-0">
              &copy; 2026 Saffa Bubur Bayi • Dashboard Keuangan Premium Glassmorphism.
            </footer>

          </div>
        )}

      </div>

      {/* TOAST PANEL */}
      <div 
        className={`fixed bottom-5 right-5 z-50 transform transition-all duration-300 pointer-events-none ${
          toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
        }`}
      >
        <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-sm max-w-sm ${
          toast.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
            : 'bg-rose-50 text-rose-800 border-rose-100'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span className="font-bold">{toast.message}</span>
        </div>
      </div>

    </div>
  );
}
