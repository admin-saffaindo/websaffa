import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
// @ts-ignore
import indexHtmlString from '../Index.html?raw';
import { 
  Lock, ArrowRight, LogOut, Wallet, Banknote, QrCode, Database, 
  PlusCircle, Save, BarChart3, History, Search, Trash2, Info, 
  CheckCircle, AlertCircle, FileCode, Copy, RefreshCw, BookOpen,
  FileDown, Store, Calendar, Sparkles, Printer, ChevronDown, Clock,
  AlertTriangle, ExternalLink
} from 'lucide-react';
import { exportToPDF } from './utils/pdfExport';

// Register Chart.js modules
Chart.register(...registerables);

// Hardcoded configs
const CORRECT_PASSWORD = 'saffaseiza123';
const ADMIN_PASSWORD = 'omsetnaik';
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
const LOGO_URL = 'https://i.ibb.co.com/XvTydSC/LOGO-SAFFA-FIX-1-2-20240228-103210-0000.png';

// Default Google Apps Script URL.
// Anda dapat memasukkan URL Web App hasil deploy Apps Script Anda di sini agar terkunci otomatis untuk semua pengguna.
const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx91zEJqCtXQwuqfgBB2s7AhQDhVOrsLOkz38rtRjacx5UroJD4IP9UOv1YO4y0u8tz3A/exec';

// Interfaces
interface Transaction {
  id: string;
  tanggal: string;
  outlet: string;
  cash: number;
  qris: number;
  total: number;
  timestamp: string;
  belumBayar?: number;
  belumBayarNama?: string;
  rowId?: number;
}

interface DebtItem {
  id: string;
  nama: string;
  nominal: number | '';
}

// Helper to generate simple alphanumeric transaction ID (Format: D1799C)
const generateSimpleId = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const firstLetter = letters.charAt(Math.floor(Math.random() * letters.length));
  const lastLetter = letters.charAt(Math.floor(Math.random() * letters.length));
  let numStr = '';
  for (let i = 0; i < 4; i++) {
    numStr += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return firstLetter + numStr + lastLetter;
};

// Helper to generate professional Option 3 unique sequential ID (Format: SF-YYMMDD-NN)
const generateOpsi3Id = (tanggalStr: string, currentTransactions: Transaction[]) => {
  let yy = '26';
  let mm = '01';
  let dd = '01';
  if (tanggalStr && tanggalStr.length >= 10) {
    const parts = tanggalStr.split('-');
    if (parts.length === 3) {
      yy = parts[0].substring(2);
      mm = parts[1];
      dd = parts[2];
    }
  }
  const datePrefix = `SF-${yy}${mm}${dd}-`;
  
  // Find transactions with same prefix to get the next counter
  let maxSeq = 0;
  currentTransactions.forEach(t => {
    if (t.id && t.id.startsWith(datePrefix)) {
      const seqStr = t.id.substring(datePrefix.length);
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  });
  
  const nextSeq = maxSeq + 1;
  return `${datePrefix}${String(nextSeq).padStart(2, '0')}`;
};

// Initial Mock Seed Data
const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: 'D1799C', tanggal: '2026-07-07', outlet: 'KM 8 Atas', cash: 450000, qris: 150000, total: 600000, timestamp: '07/07/2026, 17:15:00' },
  { id: 'P3024W', tanggal: '2026-07-07', outlet: 'Poltekkes', cash: 320000, qris: 220000, total: 540000, timestamp: '07/07/2026, 17:20:00' },
  { id: 'A8812X', tanggal: '2026-07-06', outlet: 'KM 8 Atas', cash: 420000, qris: 180000, total: 600000, timestamp: '06/07/2026, 17:05:00' },
  { id: 'G4592H', tanggal: '2026-07-06', outlet: 'Ganet', cash: 280000, qris: 120000, total: 400000, timestamp: '06/07/2026, 17:10:00' },
  { id: 'B6109K', tanggal: '2026-07-06', outlet: 'Bincen', cash: 510000, qris: 240000, total: 750000, timestamp: '06/07/2026, 17:30:00' }
];

export default function App() {
  // App navigation & tabs
  const [activeTab, setActiveTab] = useState<'app' | 'gas'>('app');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('react_isLoggedIn') === 'true';
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return sessionStorage.getItem('react_isAdmin') === 'true';
  });
  
  // Fitur Pengecekan Versi Otomatis
  const [currentAppVersion] = useState<string>('1.0.0');
  const [latestVersion, setLatestVersion] = useState<string>('1.0.0');
  const [changelog, setChangelog] = useState<string>('');
  const [hasNewVersion, setHasNewVersion] = useState<boolean>(false);
  const [showVersionUpdateModal, setShowVersionUpdateModal] = useState<boolean>(false);
  const [isCheckingVersion, setIsCheckingVersion] = useState<boolean>(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  
  // Auth states
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);

  // Google Sheets Web App URL integration - DIKUNCI KE URL SHEET RESMI
  const [webAppUrl, setWebAppUrl] = useState<string>(DEFAULT_WEB_APP_URL);
  const [isLiveMode, setIsLiveMode] = useState<boolean>(true);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Database / Transactions state (persisted to localStorage)
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const localData = localStorage.getItem('saffa_react_data');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        if (Array.isArray(parsed)) {
          const idRegex = /^[A-Z]\d{4}[A-Z]$/i;
          let modified = false;
          const migrated = parsed.map((item: any) => {
            if (!item.id || !idRegex.test(item.id)) {
              modified = true;
              return { ...item, id: generateSimpleId() };
            }
            return item;
          });
          if (modified) {
            localStorage.setItem('saffa_react_data', JSON.stringify(migrated));
          }
          return migrated;
        }
        return DEFAULT_TRANSACTIONS;
      } catch (e) {
        return DEFAULT_TRANSACTIONS;
      }
    }
    return DEFAULT_TRANSACTIONS;
  });

  // Chart view selector state
  const [chartView, setChartView] = useState<'outlet' | 'weekly' | 'monthly'>('outlet');
  const [chartDate, setChartDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Helper to format ISO Date Obj to 'YYYY-MM-DD'
  const formatDateISO = (dateObj: Date) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to format Date into Indonesian words (e.g. 9 Juli 2026)
  const formatDateIndo = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Helper to get Indonesian week range (e.g. 6 Jul - 12 Jul 2026)
  const getWeekRangeIndo = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  // Helper to get Indonesian Month Year (e.g. Juli 2026)
  const getMonthYearIndo = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  // Computed state for Chart Analysis (Highest & Lowest Outlets)
  const chartAnalysis = React.useMemo(() => {
    let activeTransactions: Transaction[] = [];
    let labelDescription = '';

    if (chartView === 'outlet') {
      activeTransactions = transactions.filter(t => t.tanggal === chartDate);
      labelDescription = `Tanggal ${formatDateIndo(chartDate)}`;
    } else if (chartView === 'weekly') {
      const d = new Date(chartDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const mondayStr = formatDateISO(monday);
      const sundayStr = formatDateISO(sunday);
      activeTransactions = transactions.filter(t => t.tanggal >= mondayStr && t.tanggal <= sundayStr);
      labelDescription = `Minggu (${getWeekRangeIndo(chartDate)})`;
    } else {
      const monthPrefix = chartDate.substring(0, 7);
      activeTransactions = transactions.filter(t => t.tanggal.startsWith(monthPrefix));
      labelDescription = `Bulan ${getMonthYearIndo(chartDate)}`;
    }

    // Calculate sum for each outlet
    const outletSums = OUTLETS.map(o => {
      const sum = activeTransactions
        .filter(t => t.outlet === o)
        .reduce((s, t) => s + (t.cash + t.qris), 0);
      return { name: o, total: sum };
    });

    // Filter out outlets with 0 to find real highest and lowest performing
    const validSums = outletSums.filter(o => o.total > 0);

    let highest: { name: string; total: number } | null = null;
    let lowest: { name: string; total: number } | null = null;

    if (validSums.length > 0) {
      const sorted = [...validSums].sort((a, b) => b.total - a.total);
      highest = sorted[0];
      lowest = sorted[sorted.length - 1];
    }

    return {
      description: labelDescription,
      highest,
      lowest,
      outletSums
    };
  }, [transactions, chartView, chartDate]);

  // Form states
  const [tanggal, setTanggal] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [outlet, setOutlet] = useState('');
  const [cash, setCash] = useState<number | ''>('');
  const [qris, setQris] = useState<number | ''>('');
  const [belumBayar, setBelumBayar] = useState<number | ''>('');
  const [belumBayarNama, setBelumBayarNama] = useState<string>('');
  const [debts, setDebts] = useState<DebtItem[]>([{ id: '1', nama: '', nominal: '' }]);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-calculate total belum bayar and formatted names from the multi-debts array
  useEffect(() => {
    const activeDebts = debts.filter(d => d.nama.trim() !== '' || d.nominal !== '');
    const totalBB = activeDebts.reduce((sum, d) => sum + (Number(d.nominal) || 0), 0);
    const namesBB = activeDebts
      .map(d => {
        const amt = Number(d.nominal) || 0;
        const nominalStr = amt > 0 ? ` (Rp ${amt.toLocaleString('id-ID')})` : '';
        return `${d.nama.trim()}${nominalStr}`;
      })
      .filter(str => str !== '')
      .join(', ');

    setBelumBayar(totalBB > 0 ? totalBB : '');
    setBelumBayarNama(namesBB);
  }, [debts]);

  // New States for Employee Flow and Dual-View Login
  const [loggedOutView, setLoggedOutView] = useState<'report' | 'login'>('report');
  const [submittedTx, setSubmittedTx] = useState<Transaction | null>(null);
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      let url = window.location.origin + window.location.pathname;
      if (url.includes('ais-dev-')) {
        url = url.replace('ais-dev-', 'ais-pre-');
      }
      return url;
    }
    return '';
  });

  // Auto-detect and pre-select outlet from URL query (?outlet=Nama%20Outlet)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const outletParam = params.get('outlet');
      if (outletParam) {
        // Find matching outlet case-insensitively
        const matched = OUTLETS.find(o => o.toLowerCase() === outletParam.trim().toLowerCase());
        if (matched) {
          setOutlet(matched);
        }
      }
    }
  }, []);

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
  const fetchLiveTransactions = async (urlToUse = webAppUrl, showToastOnError = true) => {
    if (!urlToUse) return;
    setIsLoadingLive(true);
    setConnectionError(null);
    try {
      let text = '';
      let responseStatus = 200;
      let responseOk = true;
      
      const proxyUrl = `/api/sheets-proxy?url=${encodeURIComponent(urlToUse)}&action=read&_t=${Date.now()}`;
      try {
        const response = await fetch(proxyUrl);
        responseStatus = response.status;
        responseOk = response.ok;
        text = await response.text();
        
        // Detect if the proxy returned our static index.html because we are running in client-only mode
        const isOurStaticIndex = responseOk && (
          text.includes('<div id="root">') || 
          text.includes('src="/src/main.tsx"') || 
          text.includes('<title>My Google AI Studio App</title>')
        );
        
        if (responseStatus === 404 || isOurStaticIndex) {
          console.warn('[Proxy Fallback] Proxy endpoint not found or returned static index.html. Trying direct fetch from Google Sheets...');
          const directUrl = `${urlToUse}${urlToUse.includes('?') ? '&' : '?'}action=read&_t=${Date.now()}`;
          const directResponse = await fetch(directUrl);
          responseStatus = directResponse.status;
          responseOk = directResponse.ok;
          text = await directResponse.text();
        }
      } catch (proxyErr) {
        console.warn('[Proxy Fallback] Failed to fetch from proxy, trying direct fetch:', proxyErr);
        const directUrl = `${urlToUse}${urlToUse.includes('?') ? '&' : '?'}action=read&_t=${Date.now()}`;
        const directResponse = await fetch(directUrl);
        responseStatus = directResponse.status;
        responseOk = directResponse.ok;
        text = await directResponse.text();
      }

      let data;
      
      if (!responseOk) {
        let errorMsg = `HTTP error! status: ${responseStatus}`;
        try {
          const errData = JSON.parse(text);
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }

      try {
        data = JSON.parse(text);
      } catch (e) {
        const isHtml = text.trim().startsWith('<') || text.toLowerCase().includes('<!doctype html');
        if (isHtml) {
          throw new Error('Respons dari server Google Sheets mengembalikan halaman HTML/Otorisasi (bukan format JSON). Silakan klik tombol "Buka & Berikan Izin Otorisasi" di bawah untuk melakukan otorisasi keamanan.');
        } else {
          throw new Error('Respons dari server tidak valid (bukan format JSON). Silakan periksa apakah URL Google Sheets Web App Anda sudah benar dan aktif.');
        }
      }

      let transactionsArray: any[] | null = null;
      if (Array.isArray(data)) {
        transactionsArray = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.data)) {
          transactionsArray = data.data;
        } else if (Array.isArray(data.transactions)) {
          transactionsArray = data.transactions;
        } else if (Array.isArray(data.rows)) {
          transactionsArray = data.rows;
        }
      }

      if (transactionsArray) {
        const formatted: Transaction[] = transactionsArray.map((item: any) => {
          let finalId = item.id ? String(item.id).trim() : "";
          const idRegex = /^[A-Z]\d{4}[A-Z]$/i;
          if (!finalId || finalId.startsWith('row_') || !idRegex.test(finalId)) {
            // Generate a deterministic simple alphanumeric ID based on rowId (Format: [Letter][4 digits][Letter])
            const rowNum = Number(item.rowId) || 0;
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const firstLetter = letters.charAt((rowNum * 7) % 26);
            const lastLetter = letters.charAt((rowNum * 13) % 26);
            const numVal = (1700 + rowNum) % 10000;
            const numStr = String(numVal).padStart(4, '0');
            finalId = `${firstLetter}${numStr}${lastLetter}`;
          }
          return {
            id: finalId,
            tanggal: item.tanggal || '',
            outlet: item.outlet || '',
            cash: Number(item.cash) || 0,
            qris: Number(item.qris) || 0,
            total: Number(item.total) || 0,
            belumBayar: Number(item.belumBayar || item.belum_bayar || item.unpaid || 0) || 0,
            belumBayarNama: item.belumBayarNama || item.belum_bayar_nama || item.atasNama || item.atas_nama || item.customerName || '',
            timestamp: item.timestamp || '',
            rowId: item.rowId
          };
        });
        setTransactions(formatted);
        setConnectionError(null);
        if (showToastOnError) {
          triggerToast('Sinkronisasi data Google Sheets berhasil!', 'success');
        }
      } else {
        const errMsg = (data && typeof data === 'object' && data.error) ? data.error : 'Format data dari Google Sheets tidak valid (Harus berupa list/array)';
        throw new Error(errMsg);
      }
    } catch (err: any) {
      console.warn('[Google Sheets Sync Issue]', err);
      const errMsg = err ? (err.message || String(err)) : 'Unknown error';
      setConnectionError(errMsg);
      if (showToastOnError) {
        if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch') || errMsg.includes('NetworkError')) {
          triggerToast('Koneksi gagal! Pastikan internet Anda aktif, URL Google Sheets Web App benar, dan izin aksesnya telah diatur ke "Anyone" (Siapa saja).', 'error');
        } else {
          triggerToast('Gagal sinkronisasi data: ' + errMsg, 'error');
        }
      }
    } finally {
      setIsLoadingLive(false);
    }
  };

  // Function to check app version from Google Sheets Settings sheet
  const checkAppVersion = async (urlToUse = webAppUrl, silent = true) => {
    if (!urlToUse) return;
    setIsCheckingVersion(true);
    setVersionError(null);
    try {
      let text = '';
      let responseStatus = 200;
      let responseOk = true;
      
      const proxyUrl = `/api/sheets-proxy?url=${encodeURIComponent(urlToUse)}&action=version&_t=${Date.now()}`;
      try {
        const response = await fetch(proxyUrl);
        responseStatus = response.status;
        responseOk = response.ok;
        text = await response.text();
        
        // Detect if the proxy returned static index.html
        const isOurStaticIndex = responseOk && (
          text.includes('<div id="root">') || 
          text.includes('src="/src/main.tsx"') || 
          text.includes('<title>My Google AI Studio App</title>')
        );
        
        if (responseStatus === 404 || isOurStaticIndex) {
          const directUrl = `${urlToUse}${urlToUse.includes('?') ? '&' : '?'}action=version&_t=${Date.now()}`;
          const directResponse = await fetch(directUrl);
          responseStatus = directResponse.status;
          responseOk = directResponse.ok;
          text = await directResponse.text();
        }
      } catch (proxyErr) {
        const directUrl = `${urlToUse}${urlToUse.includes('?') ? '&' : '?'}action=version&_t=${Date.now()}`;
        const directResponse = await fetch(directUrl);
        responseStatus = directResponse.status;
        responseOk = directResponse.ok;
        text = await directResponse.text();
      }

      if (!responseOk) {
        throw new Error(`HTTP error! status: ${responseStatus}`);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Respons dari server tidak valid (bukan format JSON).');
      }

      if (data && data.success && data.latestVersion) {
        const remoteVersion = String(data.latestVersion).trim();
        setLatestVersion(remoteVersion);
        setChangelog(data.changelog || 'Pembaruan fitur, optimalisasi antarmuka bento-grid, dan peningkatan stabilitas sinkronisasi.');
        
        if (remoteVersion !== currentAppVersion) {
          setHasNewVersion(true);
          if (!silent) {
            triggerToast(`Pembaruan tersedia! Versi terbaru: v${remoteVersion}`, 'success');
            setShowVersionUpdateModal(true);
          }
        } else {
          setHasNewVersion(false);
          if (!silent) {
            triggerToast('Aplikasi Saffa Anda sudah up-to-date (Versi v1.0.0).', 'success');
          }
        }
      } else {
        throw new Error('Format data versi dari Sheets tidak dikenal.');
      }
    } catch (err: any) {
      console.warn('[Version Check Error]', err);
      setVersionError(err.message || String(err));
      if (!silent) {
        triggerToast('Gagal memverifikasi versi: ' + (err.message || 'Error tidak diketahui'), 'error');
      }
    } finally {
      setIsCheckingVersion(false);
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
      fetchLiveTransactions(webAppUrl, false);
      checkAppVersion(webAppUrl, true);
    }
  }, [isLiveMode, isLoggedIn]);

  // Render & Re-render Chart (Destroy and Recreate) on transactions change or chart config change
  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'app' || !chartCanvasRef.current) return;

    const labels = OUTLETS;
    const totalData = chartAnalysis.outletSums.map(item => item.total);

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart instance if any (as per specifications)
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    // Create new chart instance with a premium line design
    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Total Omset',
            data: totalData,
            borderColor: '#e90076', // Saffa Pink
            backgroundColor: 'rgba(233, 0, 118, 0.08)', // Soft gradient area fill
            borderWidth: 3,
            tension: 0.35, // Smooth bezier curves
            fill: true,
            pointBackgroundColor: '#e90076',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#e90076',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
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
            stacked: false,
            grid: {
              display: false
            },
            ticks: {
              font: {
                family: 'Poppins',
                size: 10
              },
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            stacked: false,
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
  }, [chartAnalysis, isLoggedIn, activeTab]);


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
      setIsAdmin(false);
      setIsLoggedIn(true);
      sessionStorage.setItem('react_isLoggedIn', 'true');
      sessionStorage.setItem('react_isAdmin', 'false');
      triggerToast('Akses dikabulkan! Selamat datang di Dashboard.', 'success');
    } else if (passwordInput === ADMIN_PASSWORD) {
      setAuthError(false);
      setIsAdmin(true);
      setIsLoggedIn(true);
      sessionStorage.setItem('react_isLoggedIn', 'true');
      sessionStorage.setItem('react_isAdmin', 'true');
      triggerToast('Akses Admin dikabulkan! Selamat datang.', 'success');
    } else {
      setAuthError(true);
      triggerToast('Kata sandi salah!', 'error');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setIsAdmin(false);
    sessionStorage.removeItem('react_isLoggedIn');
    sessionStorage.removeItem('react_isAdmin');
    setPasswordInput('');
    setActiveTab('app');
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

  const formatInputTime = (timestampStr: string | undefined) => {
    if (!timestampStr) return '-';
    // Match something like "17:15:00" or "21.37.44" or "17:15"
    const match = timestampStr.match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
    if (match) {
      const hh = match[1].padStart(2, '0');
      const mm = match[2];
      return `${hh}:${mm}`;
    }
    try {
      const parsed = new Date(timestampStr);
      if (!isNaN(parsed.getTime())) {
        const hh = String(parsed.getHours()).padStart(2, '0');
        const mm = String(parsed.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      }
    } catch (e) {
      // ignore
    }
    return timestampStr;
  };

  // Dynamic Validation: Check which outlets are already registered on the selected date
  const registeredOutletsForSelectedDate = transactions
    .filter(t => t.tanggal === tanggal)
    .map(t => t.outlet);

  const isOutletLocked = outlet ? registeredOutletsForSelectedDate.includes(outlet) : false;

  // Form submission handler
  const handleSaveTransaction = async (e: React.FormEvent) => {
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
    const belumBayarValue = Number(belumBayar) || 0;
    const belumBayarNamaValue = belumBayarNama.trim();

    if (isLiveMode && webAppUrl) {
      setIsLoadingLive(true);
      try {
        const proxyUrl = `/api/sheets-proxy?url=${encodeURIComponent(webAppUrl)}&action=add&tanggal=${tanggal}&outlet=${encodeURIComponent(outlet)}&cash=${cashValue}&qris=${qrisValue}&belumBayar=${belumBayarValue}&belumBayarNama=${encodeURIComponent(belumBayarNamaValue)}&_t=${Date.now()}`;
        const res = await fetch(proxyUrl);
        
        const text = await res.text();
        let resData;

        if (!res.ok) {
          let errorMsg = `HTTP error! status: ${res.status}`;
          try {
            const errData = JSON.parse(text);
            if (errData && errData.error) {
              errorMsg = errData.error;
            }
          } catch (_) {}
          throw new Error(errorMsg);
        }

        try {
          resData = JSON.parse(text);
        } catch (e) {
          throw new Error('Respons dari server tidak valid (bukan format JSON). Silakan periksa apakah URL Google Sheets Web App Anda sudah benar.');
        }

        if (resData.success) {
          const generatedId = resData.id || generateSimpleId();
          const newTx: Transaction = {
            id: generatedId,
            tanggal,
            outlet,
            cash: cashValue,
            qris: qrisValue,
            total: totalValue,
            belumBayar: belumBayarValue,
            belumBayarNama: belumBayarNamaValue,
            timestamp: new Date().toLocaleString('id-ID')
          };
          setSubmittedTx(newTx);
          triggerToast(resData.message || `Sukses menyimpan data untuk Outlet ${outlet}!`, 'success');
          // Reset inputs on success
          setOutlet('');
          setCash('');
          setQris('');
          setBelumBayar('');
          setBelumBayarNama('');
          setDebts([{ id: '1', nama: '', nominal: '' }]);
          // Refresh data
          fetchLiveTransactions();
        } else {
          triggerToast('Gagal menyimpan ke Google Sheets: ' + (resData.error || 'Terjadi kesalahan'), 'error');
        }
      } catch (err: any) {
        console.error(err);
        const errMsg = err ? (err.message || String(err)) : 'Unknown error';
        if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch') || errMsg.includes('NetworkError')) {
          triggerToast('Gagal menghubungi Google Sheets! Pastikan internet Anda aktif dan URL Web App benar dengan izin akses "Anyone".', 'error');
        } else {
          triggerToast('Gagal menghubungi Google Sheets: ' + errMsg, 'error');
        }
      } finally {
        setIsLoadingLive(false);
      }
    } else {
      const generatedId = generateOpsi3Id(tanggal, transactions);
      const newTx: Transaction = {
        id: generatedId,
        tanggal,
        outlet,
        cash: cashValue,
        qris: qrisValue,
        total: totalValue,
        belumBayar: belumBayarValue,
        belumBayarNama: belumBayarNamaValue,
        timestamp: new Date().toLocaleString('id-ID')
      };

      setTransactions(prev => [newTx, ...prev]);
      setSubmittedTx(newTx);
      triggerToast(`Sukses menyimpan data untuk Outlet ${outlet} dengan ID ${generatedId}!`, 'success');
      
      // Reset inputs
      setOutlet('');
      setCash('');
      setQris('');
      setBelumBayar('');
      setBelumBayarNama('');
      setDebts([{ id: '1', nama: '', nominal: '' }]);
    }
  };

  // Delete Handler
  const handleDeleteTransaction = async (id: string, outletName: string, dateStr: string, rowId?: number) => {
    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus data outlet ${outletName} pada tanggal ${parseAndFormatDate(dateStr)}?`);
    if (!confirmDelete) return;

    if (isLiveMode && webAppUrl) {
      setIsLoadingLive(true);
      try {
        const rowParam = rowId ? `&rowId=${rowId}` : '';
        const proxyUrl = `/api/sheets-proxy?url=${encodeURIComponent(webAppUrl)}&action=delete${rowParam}&id=${encodeURIComponent(id)}&_t=${Date.now()}`;
        const res = await fetch(proxyUrl);
        
        const text = await res.text();
        let resData;

        if (!res.ok) {
          let errorMsg = `HTTP error! status: ${res.status}`;
          try {
            const errData = JSON.parse(text);
            if (errData && errData.error) {
              errorMsg = errData.error;
            }
          } catch (_) {}
          throw new Error(errorMsg);
        }

        try {
          resData = JSON.parse(text);
        } catch (e) {
          throw new Error('Respons dari server tidak valid (bukan format JSON). Silakan periksa apakah URL Google Sheets Web App Anda sudah benar.');
        }

        if (resData.success) {
          triggerToast(resData.message || 'Data berhasil dihapus dari Google Sheets!', 'success');
          fetchLiveTransactions();
        } else {
          triggerToast('Gagal menghapus dari Google Sheets: ' + (resData.error || 'Terjadi kesalahan'), 'error');
        }
      } catch (err: any) {
        console.error(err);
        const errMsg = err ? (err.message || String(err)) : 'Unknown error';
        if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch') || errMsg.includes('NetworkError')) {
          triggerToast('Gagal menghubungi Google Sheets! Pastikan internet Anda aktif dan URL Web App benar dengan izin akses "Anyone".', 'error');
        } else {
          triggerToast('Gagal menghubungi Google Sheets: ' + errMsg, 'error');
        }
      } finally {
        setIsLoadingLive(false);
      }
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

  // Export current period data to PDF
  const handleExportPDF = async () => {
    try {
      await exportToPDF(
        transactions,
        chartView,
        chartDate,
        OUTLETS,
        'saffaindo@gmail.com',
        isLiveMode,
        LOGO_URL
      );
      triggerToast('Laporan PDF berhasil diunduh!', 'success');
    } catch (error: any) {
      console.error(error);
      triggerToast('Gagal mencetak PDF: ' + error.message, 'error');
    }
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
 * Baris pertama (Header) harus berisi: ID, Tanggal, Outlet, Cash, QRIS, Belum Bayar, Atas Nama, Total, Timestamp
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
      
      if (action === "version") {
        const versionInfo = getVersionInfo();
        return ContentService.createTextOutput(JSON.stringify(versionInfo))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      if (action === "add") {
        const tanggal = e.parameter.tanggal;
        const outlet = e.parameter.outlet;
        const cash = Number(e.parameter.cash) || 0;
        const qris = Number(e.parameter.qris) || 0;
        const belumBayar = Number(e.parameter.belumBayar) || 0;
        const belumBayarNama = e.parameter.belumBayarNama || "";
        const result = addData(tanggal, outlet, cash, qris, belumBayar, belumBayarNama);
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      if (action === "delete") {
        const rowId = e.parameter.rowId ? Number(e.parameter.rowId) : undefined;
        const id = e.parameter.id || "";
        const result = deleteData(rowId, id);
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
      const belumBayar = Number(params.belumBayar || (e.parameter ? e.parameter.belumBayar : 0)) || 0;
      const belumBayarNama = params.belumBayarNama || (e.parameter ? e.parameter.belumBayarNama : "") || "";
      
      const result = addData(tanggal, outlet, cash, qris, belumBayar, belumBayarNama);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "delete") {
      const rowId = params.rowId || (e.parameter ? e.parameter.rowId : undefined);
      const id = params.id || (e.parameter ? e.parameter.id : "") || "";
      const result = deleteData(rowId ? Number(rowId) : undefined, id);
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
    sheet.appendRow(["ID", "Tanggal", "Outlet", "Cash", "QRIS", "Belum Bayar", "Atas Nama", "Total", "Timestamp"]);
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
      let belumBayar = 0;
      let belumBayarNama = "";
      let total = 0;
      let timestamp = "";
      
      if (numCols >= 9) {
        id = row[0] ? String(row[0]) : "";
        dateVal = row[1];
        outlet = row[2];
        cash = Number(row[3]) || 0;
        qris = Number(row[4]) || 0;
        belumBayar = Number(row[5]) || 0;
        belumBayarNama = row[6] ? String(row[6]) : "";
        total = Number(row[7]) || 0;
        timestamp = row[8] ? String(row[8]) : "";
      } else if (isNewFormat) {
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
        dateString = \`\${year}-\\ \${month}-\\ \${day}\`.replace(/\\s/g, '');
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
        belumBayar: belumBayar,
        belumBayarNama: belumBayarNama,
        total: total,
        timestamp: timestamp
      };
    });
  } catch (error) {
    throw new Error("Gagal mengambil data: " + error.message);
  }
}

/**
 * Mendapatkan info versi terbaru dan catatan rilis (changelog) dari sheet Settings
 */
function getVersionInfo() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Settings");
    if (!sheet) {
      sheet = ss.insertSheet("Settings");
      sheet.appendRow(["Key", "Value"]);
      sheet.appendRow(["dashboard_version", "1.1.0"]);
      sheet.appendRow(["changelog", "Pembaruan sistem sinkronisasi otomatis, visualisasi bento-grid, dan perbaikan penanganan koneksi offline."]);
    }
    
    const lastRow = sheet.getLastRow();
    let version = "1.1.0";
    let changelog = "Pembaruan sistem sinkronisasi otomatis, visualisasi bento-grid, dan perbaikan penanganan koneksi offline.";
    
    if (lastRow > 1) {
      const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      values.forEach(row => {
        const key = String(row[0]).trim().toLowerCase();
        const val = String(row[1]).trim();
        if (key === "dashboard_version" || key === "version") {
          version = val;
        } else if (key === "changelog") {
          changelog = val;
        }
      });
    }
    
    return {
      success: true,
      latestVersion: version,
      changelog: changelog
    };
  } catch (err) {
    return {
      success: false,
      latestVersion: "1.1.0",
      changelog: "Gagal memuat info versi dari Sheets: " + err.message
    };
  }
}

/**
 * Menambahkan data transaksi baru ke Google Sheets
 * @param {string} tanggal - Format YYYY-MM-DD
 * @param {string} outlet - Nama outlet
 * @param {number} cash - Nominal cash
 * @param {number} qris - Nominal QRIS
 * @param {number} belumBayar - Nominal belum bayar
 * @param {string} belumBayarNama - Keterangan nama
 * @returns {Object} Hasil transaksi yang berhasil disimpan
 */
function addData(tanggal, outlet, cash, qris, belumBayar, belumBayarNama) {
  try {
    const sheet = getSheet();
    const data = getData();
    
    // Validasi double-input tingkat backend untuk memastikan integritas data
    const isDuplicate = data.some(item => item.tanggal === tanggal && item.outlet.toLowerCase() === outlet.toLowerCase());
    if (isDuplicate) {
      throw new Error(\`Outlet \${outlet} sudah diinput untuk tanggal \${tanggal}!\\ \`);
    }
    
    const cashVal = Number(cash) || 0;
    const qrisVal = Number(qris) || 0;
    const belumBayarVal = Number(belumBayar) || 0;
    const belumBayarNamaVal = belumBayarNama ? String(belumBayarNama).trim() : "";
    const totalVal = cashVal + qrisVal;
    const timestamp = new Date().toLocaleString("id-ID");
    const transactionId = generateOpsi3Id(tanggal);
    
    let numCols = sheet.getLastColumn();
    const firstVal = sheet.getRange(1, 1).getValue();
    let isNewFormat = numCols >= 7 && firstVal && String(firstVal).trim().toUpperCase() === "ID";
    
    // Auto-migrate sheet dari 7 kolom ke 9 kolom
    if (isNewFormat && numCols < 9) {
      // Kolom awal: ID, Tanggal, Outlet, Cash, QRIS, Total, Timestamp
      // Kita sisipkan "Belum Bayar" dan "Atas Nama" di kolom 6 & 7 (sebelum Total)
      sheet.insertColumnsBefore(6, 2);
      sheet.getRange(1, 6).setValue("Belum Bayar");
      sheet.getRange(1, 7).setValue("Atas Nama");
      
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        // Isi Kolom 6 (Belum Bayar) dengan 0
        const bbRange = sheet.getRange(2, 6, lastRow - 1, 1);
        const bbVals = [];
        for (let i = 0; i < lastRow - 1; i++) {
          bbVals.push([0]);
        }
        bbRange.setValues(bbVals);
        
        // Isi Kolom 7 (Atas Nama) dengan string kosong
        const namaRange = sheet.getRange(2, 7, lastRow - 1, 1);
        const namaVals = [];
        for (let i = 0; i < lastRow - 1; i++) {
          namaVals.push([""]);
        }
        namaRange.setValues(namaVals);
      }
      numCols = 9; // Perbarui jumlah kolom setelah migrasi
    }
    
    if (numCols >= 9) {
      // Tambahkan baris baru dengan format 9 kolom
      sheet.appendRow([transactionId, tanggal, outlet, cashVal, qrisVal, belumBayarVal, belumBayarNamaVal, totalVal, timestamp]);
    } else if (isNewFormat) {
      // Tambahkan baris baru dengan format 7 kolom jika belum termigrasi
      sheet.appendRow([transactionId, tanggal, outlet, cashVal, qrisVal, totalVal, timestamp]);
    } else {
      // Otomatis lakukan migrasi sheet lama ke format 9 kolom dengan menambahkan kolom ID di depan
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
        
        // Sekarang lembar kerja sudah bermigrasi ke 7 kolom, mari migrasi ke 9 kolom
        sheet.insertColumnsBefore(6, 2);
        sheet.getRange(1, 6).setValue("Belum Bayar");
        sheet.getRange(1, 7).setValue("Atas Nama");
        const updatedLastRow = sheet.getLastRow();
        if (updatedLastRow > 1) {
          const bbRange = sheet.getRange(2, 6, updatedLastRow - 1, 1);
          const bbVals = [];
          for (let i = 0; i < updatedLastRow - 1; i++) {
            bbVals.push([0]);
          }
          bbRange.setValues(bbVals);
          
          const namaRange = sheet.getRange(2, 7, updatedLastRow - 1, 1);
          const namaVals = [];
          for (let i = 0; i < updatedLastRow - 1; i++) {
            namaVals.push([""]);
          }
          namaRange.setValues(namaVals);
        }
        
        sheet.appendRow([transactionId, tanggal, outlet, cashVal, qrisVal, belumBayarVal, belumBayarNamaVal, totalVal, timestamp]);
      } else {
        // Lembar kerja kosong total
        sheet.appendRow(["ID", "Tanggal", "Outlet", "Cash", "QRIS", "Belum Bayar", "Atas Nama", "Total", "Timestamp"]);
        sheet.appendRow([transactionId, tanggal, outlet, cashVal, qrisVal, belumBayarVal, belumBayarNamaVal, totalVal, timestamp]);
      }
    }
    
    return {
      success: true,
      message: \`Data untuk Outlet \${outlet} berhasil disimpan dengan ID \${transactionId}!\\ \`
    };
  } catch (error) {
    throw new Error("Gagal menyimpan data: " + error.message);
  }
}

/**
 * Menghapus transaksi berdasarkan nomor baris (rowId) atau ID transaksi (id)
 * @param {number} [rowId] - Baris yang akan dihapus
 * @param {string} [id] - ID transaksi yang akan dicocokkan di kolom pertama (ID)
 * @returns {Object} Status keberhasilan
 */
function deleteData(rowId, id) {
  try {
    const sheet = getSheet();
    let targetRow = rowId ? Number(rowId) : NaN;
    const idToMatch = id ? String(id).trim() : "";
    
    // Jika ada ID transaksi, cari baris yang sesuai dengan ID tersebut terlebih dahulu demi keamanan & akurasi
    if (idToMatch) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]).trim() === idToMatch) {
            targetRow = i + 2; // Baris ditemukan
            break;
          }
        }
      }
    }
    
    if (isNaN(targetRow) || targetRow < 2) {
      throw new Error("ID Transaksi atau Nomor Baris tidak ditemukan atau tidak valid.");
    }
    
    sheet.deleteRow(targetRow);
    return {
      success: true,
      message: "Data berhasil dihapus dari Google Sheets!"
    };
  } catch (error) {
    throw new Error("Gagal menghapus data: " + error.message);
  }
}`;

  // Custom QR Code printing handlers
  const handlePrintAllQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      triggerToast('Gagal membuka jendela cetak! Izinkan popup di browser Anda.', 'error');
      return;
    }
    
    let qrCardsHtml = '';
    
    OUTLETS.forEach(name => {
      let baseUrl = customBaseUrl || (window.location.origin + window.location.pathname);
      if (baseUrl.includes('ais-dev-')) {
        baseUrl = baseUrl.replace('ais-dev-', 'ais-pre-');
      }
      const params = new URLSearchParams(window.location.search);
      const webapp = params.get('webapp') || params.get('url') || webAppUrl;
      let newParams = new URLSearchParams();
      newParams.set('outlet', name);
      if (webapp) {
        newParams.set('webapp', webapp);
      }
      const outletUrl = `${baseUrl}?${newParams.toString()}`;
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(outletUrl)}`;
      
      qrCardsHtml += `
        <div class="qr-card">
          <div class="logo-container">
            <img src="${LOGO_URL}" alt="Saffa Logo" />
          </div>
          <div class="outlet-title">OUTLET ${name.toUpperCase()}</div>
          <div class="sub">SAFFA BUBUR BAYI</div>
          <div class="qr-wrapper">
            <img src="${qrImageUrl}" alt="QR Code" />
          </div>
          <div class="instruction">SCAN BARCODE UNTUK ISI OMSET</div>
          <div class="url-text">${outletUrl}</div>
        </div>
      `;
    });
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Barcode QR Outlet Saffa Bubur Bayi</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=JetBrains+Mono&display=swap');
            body {
              font-family: 'Plus Jakarta Sans', sans-serif;
              background: white;
              color: #333;
              margin: 0;
              padding: 20px;
            }
            .header-info {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px dashed #e90076;
              padding-bottom: 15px;
            }
            .header-info h1 {
              margin: 0;
              color: #e90076;
              font-size: 24px;
              font-weight: 800;
            }
            .header-info p {
              margin: 5px 0 0 0;
              font-size: 14px;
              color: #666;
              font-weight: 500;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 25px;
            }
            .qr-card {
              border: 3px solid #e90076;
              border-radius: 24px;
              padding: 24px;
              text-align: center;
              background: #fff;
              box-shadow: 0 4px 10px rgba(0,0,0,0.05);
              page-break-inside: avoid;
            }
            .logo-container img {
              height: 50px;
              object-fit: contain;
            }
            .outlet-title {
              font-size: 18px;
              font-weight: 800;
              color: #e90076;
              margin-top: 10px;
              letter-spacing: -0.5px;
            }
            .sub {
              font-size: 11px;
              font-weight: 800;
              color: #78b928;
              letter-spacing: 1.5px;
              margin-bottom: 15px;
            }
            .qr-wrapper {
              margin: 15px auto;
              width: 180px;
              height: 180px;
              border: 1px solid #f0f0f0;
              padding: 10px;
              background: white;
              border-radius: 16px;
            }
            .qr-wrapper img {
              width: 100%;
              height: 100%;
            }
            .instruction {
              font-size: 11px;
              font-weight: 700;
              background: #fef2f7;
              color: #e90076;
              padding: 6px 14px;
              border-radius: 20px;
              display: inline-block;
              margin-top: 5px;
            }
            .url-text {
              font-family: 'JetBrains Mono', monospace;
              font-size: 8px;
              color: #888;
              margin-top: 10px;
              word-break: break-all;
              max-width: 90%;
              margin-left: auto;
              margin-right: auto;
            }
            @media print {
              .header-info {
                display: none;
              }
              body {
                padding: 0;
              }
              .grid {
                gap: 20px;
              }
              .qr-card {
                box-shadow: none;
                border-color: #333;
              }
              .instruction {
                background: #f5f5f5;
                color: #333;
                border: 1px solid #ddd;
              }
            }
          </style>
        </head>
        <body>
          <div class="header-info">
            <h1>Cetak QR Code Laporan Cabang</h1>
            <p>Saffa Bubur Bayi • Tempel di outlet masing-masing untuk discan oleh karyawan</p>
          </div>
          <div class="grid">
            ${qrCardsHtml}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintSingleQR = (name: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      triggerToast('Gagal membuka jendela cetak! Izinkan popup di browser Anda.', 'error');
      return;
    }
    
    let baseUrl = customBaseUrl || (window.location.origin + window.location.pathname);
    if (baseUrl.includes('ais-dev-')) {
      baseUrl = baseUrl.replace('ais-dev-', 'ais-pre-');
    }
    const params = new URLSearchParams(window.location.search);
    const webapp = params.get('webapp') || params.get('url') || webAppUrl;
    let newParams = new URLSearchParams();
    newParams.set('outlet', name);
    if (webapp) {
      newParams.set('webapp', webapp);
    }
    const outletUrl = `${baseUrl}?${newParams.toString()}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(outletUrl)}`;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak QR Code ${name} - Saffa Bubur Bayi</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=JetBrains+Mono&display=swap');
            body {
              font-family: 'Plus Jakarta Sans', sans-serif;
              background: white;
              color: #333;
              margin: 0;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .qr-card {
              border: 4px solid #e90076;
              border-radius: 32px;
              padding: 40px;
              text-align: center;
              background: #fff;
              max-width: 400px;
              width: 100%;
              box-sizing: border-box;
              box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            }
            .logo-container img {
              height: 70px;
              object-fit: contain;
            }
            .outlet-title {
              font-size: 24px;
              font-weight: 800;
              color: #e90076;
              margin-top: 15px;
              letter-spacing: -0.5px;
            }
            .sub {
              font-size: 13px;
              font-weight: 800;
              color: #78b928;
              letter-spacing: 2px;
              margin-bottom: 25px;
            }
            .qr-wrapper {
              margin: 25px auto;
              width: 240px;
              height: 240px;
              border: 1px solid #f0f0f0;
              padding: 15px;
              background: white;
              border-radius: 20px;
            }
            .qr-wrapper img {
              width: 100%;
              height: 100%;
            }
            .instruction {
              font-size: 13px;
              font-weight: 700;
              background: #fef2f7;
              color: #e90076;
              padding: 8px 18px;
              border-radius: 20px;
              display: inline-block;
              margin-top: 10px;
            }
            .url-text {
              font-family: 'JetBrains Mono', monospace;
              font-size: 9px;
              color: #999;
              margin-top: 15px;
              word-break: break-all;
            }
            @media print {
              body {
                padding: 0;
              }
              .qr-card {
                border-color: #333;
                box-shadow: none;
              }
              .instruction {
                background: #f5f5f5;
                color: #333;
                border: 1px solid #ddd;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-card">
            <div class="logo-container">
              <img src="${LOGO_URL}" alt="Saffa Logo" />
            </div>
            <div class="outlet-title font-bold">OUTLET ${name.toUpperCase()}</div>
            <div class="sub">SAFFA BUBUR BAYI</div>
            <div class="qr-wrapper">
              <img src="${qrImageUrl}" alt="QR Code" />
            </div>
            <div class="instruction">SCAN BARCODE UNTUK ISI OMSET</div>
            <div class="url-text">${outletUrl}</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintHomeQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      triggerToast('Gagal membuka jendela cetak! Izinkan popup di browser Anda.', 'error');
      return;
    }
    
    const targetUrl = getMainTargetUrl();
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(targetUrl)}`;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Barcode Utama - Saffa Bubur Bayi</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=JetBrains+Mono&display=swap');
            body {
              font-family: 'Plus Jakarta Sans', sans-serif;
              background: white;
              color: #333;
              margin: 0;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .qr-card {
              border: 5px solid #e90076;
              border-radius: 40px;
              padding: 50px;
              text-align: center;
              background: #fff;
              max-width: 500px;
              width: 100%;
              box-sizing: border-box;
              box-shadow: 0 15px 35px rgba(0,0,0,0.05);
            }
            .logo-container img {
              height: 90px;
              object-fit: contain;
            }
            .title {
              font-size: 28px;
              font-weight: 800;
              color: #e90076;
              margin-top: 20px;
              letter-spacing: -1px;
            }
            .sub {
              font-size: 15px;
              font-weight: 800;
              color: #78b928;
              letter-spacing: 3px;
              margin-bottom: 30px;
            }
            .qr-wrapper {
              margin: 30px auto;
              width: 280px;
              height: 280px;
              border: 1px solid #f0f0f0;
              padding: 20px;
              background: white;
              border-radius: 24px;
              box-shadow: inset 0 2px 8px rgba(0,0,0,0.02);
            }
            .qr-wrapper img {
              width: 100%;
              height: 100%;
            }
            .instruction {
              font-size: 14px;
              font-weight: 800;
              background: #fef2f7;
              color: #e90076;
              padding: 10px 24px;
              border-radius: 30px;
              display: inline-block;
              margin-top: 15px;
            }
            .url-text {
              font-family: 'JetBrains Mono', monospace;
              font-size: 11px;
              color: #666;
              margin-top: 20px;
              word-break: break-all;
              font-weight: bold;
            }
            @media print {
              body {
                padding: 0;
              }
              .qr-card {
                border-color: #333;
                box-shadow: none;
              }
              .instruction {
                background: #f5f5f5;
                color: #333;
                border: 1px solid #ddd;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-card">
            <div class="logo-container">
              <img src="${LOGO_URL}" alt="Saffa Logo" />
            </div>
            <div class="title">BARCODE UTAMA LAPORAN</div>
            <div class="sub">SAFFA BUBUR BAYI</div>
            <div class="qr-wrapper">
              <img src="${qrImageUrl}" alt="QR Code" />
            </div>
            <div class="instruction">SCAN BARCODE UNTUK ISI OMSET</div>
            <div class="url-text">${targetUrl}</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Handle copy to clipboard
  const handleCopyCode = (text: string, fileName: string) => {
    navigator.clipboard.writeText(text);
    triggerToast(`Isi file ${fileName} berhasil disalin ke clipboard!`, 'success');
  };

  // Dynamically compute the main QR Code url target
  const getMainTargetUrl = () => {
    let baseUrl = customBaseUrl || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'https://websaffa.vercel.app/');
    if (baseUrl.includes('ais-dev-')) {
      baseUrl = baseUrl.replace('ais-dev-', 'ais-pre-');
    }
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const webapp = params.get('webapp') || params.get('url') || webAppUrl;
    
    if (webapp) {
      const newParams = new URLSearchParams();
      newParams.set('webapp', webapp);
      return `${baseUrl}?${newParams.toString()}`;
    }
    return baseUrl;
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
            <div id="login-card" className={`w-full ${loggedOutView === 'report' ? 'max-w-xl' : 'max-w-md'} bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-6 md:p-10 transition-all duration-300 shadow-2xl`}>
              
              {/* Brand Logo & Heading */}
              <div className="text-center mb-6">
                <img 
                  src={LOGO_URL} 
                  alt="Saffa Bubur Bayi Logo" 
                  className="h-20 mx-auto mb-3 object-contain filter drop-shadow-md"
                  referrerPolicy="no-referrer"
                />
                <h2 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight">
                  {loggedOutView === 'report' ? 'Laporan Keuangan Outlet' : 'Akses Portal Admin'}
                </h2>
                <div className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1 bg-pink-100 text-saffa-pink rounded-full text-[10px] md:text-xs font-bold tracking-wide uppercase">
                  Saffa Bubur Bayi
                </div>
              </div>

              {/* Segmented Tab Selector for Logged Out Views */}
              <div className="grid grid-cols-2 bg-gray-100/60 backdrop-blur-md p-1 rounded-2xl border border-gray-200/50 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setLoggedOutView('report');
                    setAuthError(false);
                  }}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    loggedOutView === 'report'
                      ? 'bg-saffa-pink text-white shadow-md'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Isi Laporan
                </button>
                <button
                  type="button"
                  onClick={() => setLoggedOutView('login')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    loggedOutView === 'login'
                      ? 'bg-[#e90076] text-white shadow-md'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Portal Admin
                </button>
              </div>

              {/* VIEW A: EMPLOYEE REPORTING */}
              {loggedOutView === 'report' && (
                <div>
                  {submittedTx ? (
                    <div className="text-center py-4 space-y-5 animate-fade-in">
                      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600 animate-pulse">
                        <CheckCircle className="w-10 h-10" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-800">Laporan Berhasil Dikirim! 🎉</h3>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          Terima kasih atas laporan Anda. Data omset harian telah terekam aman di {isLiveMode ? 'Google Sheets' : 'Sistem Lokal'}.
                        </p>
                      </div>
                      
                      <div className="bg-white/70 border border-white/80 rounded-[2rem] p-5 text-left space-y-3.5 shadow-sm">
                        <div className="flex justify-between items-center pb-2.5 border-b border-gray-200/50">
                          <span className="text-xs text-gray-500 font-semibold">ID Transaksi</span>
                          <span className="text-xs font-mono font-bold bg-pink-100 text-saffa-pink px-2.5 py-1 rounded-lg">{submittedTx.id}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2.5 border-b border-gray-200/50">
                          <span className="text-xs text-gray-500 font-semibold">Outlet Cabang</span>
                          <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                            <Store className="w-3.5 h-3.5 text-saffa-pink flex-shrink-0" />
                            {submittedTx.outlet}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-2.5 border-b border-gray-200/50">
                          <span className="text-xs text-gray-500 font-semibold">Tanggal</span>
                          <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-saffa-green flex-shrink-0" />
                            {parseAndFormatDate(submittedTx.tanggal)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-2.5 border-b border-gray-200/50">
                          <span className="text-xs text-gray-500 font-semibold">Uang Cash (Tunai)</span>
                          <span className="text-xs font-bold text-gray-800">{formatRupiah(submittedTx.cash)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2.5 border-b border-gray-200/50">
                          <span className="text-xs text-gray-500 font-semibold">Uang QRIS (Non-Tunai)</span>
                          <span className="text-xs font-bold text-gray-800">{formatRupiah(submittedTx.qris)}</span>
                        </div>
                        {submittedTx.belumBayar !== undefined && submittedTx.belumBayar > 0 && (
                          <>
                            <div className="flex justify-between items-center pb-2.5 border-b border-gray-200/50 text-rose-600">
                              <span className="text-xs font-semibold">Belum Bayar (Piutang)</span>
                              <span className="text-xs font-extrabold">{formatRupiah(submittedTx.belumBayar)}</span>
                            </div>
                            {submittedTx.belumBayarNama && (
                              <div className="flex justify-between items-start pb-2.5 border-b border-gray-200/50 text-rose-600 gap-2">
                                <span className="text-xs font-semibold">Atas Nama Siapa</span>
                                <span className="text-xs font-extrabold text-right max-w-[200px] break-words">{submittedTx.belumBayarNama}</span>
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex justify-between items-center pt-1.5">
                          <span className="text-xs font-bold text-gray-500">Total Omset</span>
                          <span className="text-sm font-black text-saffa-green bg-green-50 px-2.5 py-1 rounded-lg">{formatRupiah(submittedTx.total)}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setSubmittedTx(null)}
                        className="w-full py-4 bg-gradient-to-r from-saffa-green to-emerald-600 hover:from-saffa-green-hover hover:to-emerald-700 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Input Laporan Baru
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveTransaction} className="space-y-4">
                      {/* Outlet pre-selection indicator */}
                      {outlet && !isOutletLocked && (
                        <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 leading-relaxed font-semibold animate-fade-in">
                          <Store className="w-4 h-4 text-saffa-green flex-shrink-0 mt-0.5" />
                          <div>
                            <span>Anda sedang mengisi omset untuk <strong className="text-saffa-green">{outlet}</strong>.</span>
                            <span className="block text-[10px] text-emerald-600 font-medium mt-0.5">Prefilled & Terkunci dari Scan Barcode.</span>
                          </div>
                        </div>
                      )}

                      {/* Tanggal input */}
                      <div>
                        <label htmlFor="tanggal-input" className="block text-[10px] uppercase font-black text-gray-500 tracking-wider mb-1.5">
                          Tanggal Penjualan
                        </label>
                        <div className="relative rounded-2xl shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <input
                            type="date"
                            id="tanggal-input"
                            required
                            value={tanggal}
                            onChange={(e) => setTanggal(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3 bg-white/60 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-saffa-pink focus:border-transparent transition-all text-xs font-semibold"
                          />
                        </div>
                      </div>

                      {/* Outlet select */}
                      <div>
                        <label htmlFor="outlet-select" className="block text-[10px] uppercase font-black text-gray-500 tracking-wider mb-1.5">
                          Cabang Outlet
                        </label>
                        <div className="relative rounded-2xl shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                            <Store className="w-4 h-4" />
                          </div>
                          <select
                            id="outlet-select"
                            required
                            value={outlet}
                            onChange={(e) => setOutlet(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3 bg-white/60 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-saffa-pink focus:border-transparent transition-all text-xs font-semibold"
                          >
                            <option value="">-- Pilih Cabang Outlet --</option>
                            {OUTLETS_DATA.map((region) => (
                              <optgroup key={region.region} label={region.region} className="font-bold text-gray-700 bg-gray-50 text-xs">
                                {region.items.map((item) => {
                                  const isLockedItem = registeredOutletsForSelectedDate.includes(item);
                                  return (
                                    <option 
                                      key={item} 
                                      value={item}
                                      disabled={isLockedItem}
                                      className={isLockedItem ? "text-gray-300 bg-gray-50 font-normal" : "text-gray-800 font-semibold bg-white"}
                                    >
                                      {item} {isLockedItem ? '🔒 (Sudah Diisi - Terkunci)' : ''}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      </div>

                      {!isOutletLocked ? (
                        <>
                          {/* Cash Input */}
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <label htmlFor="cash-input" className="block text-[10px] uppercase font-black text-gray-500 tracking-wider">
                                Omset Tunai (Cash)
                              </label>
                              {cash !== '' && (
                                <span className="text-xs font-black text-saffa-pink">
                                  {formatRupiah(Number(cash))}
                                </span>
                              )}
                            </div>
                            <div className="relative rounded-2xl shadow-sm">
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 font-bold text-xs">
                                Rp
                              </div>
                              <input
                                type="number"
                                id="cash-input"
                                required
                                min="0"
                                placeholder="Masukkan nominal cash..."
                                value={cash}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCash(val === '' ? '' : Number(val));
                                }}
                                className="block w-full pl-11 pr-4 py-3 bg-white/60 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-saffa-pink focus:border-transparent transition-all text-xs font-semibold"
                              />
                            </div>
                          </div>

                          {/* QRIS Input */}
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <label htmlFor="qris-input" className="block text-[10px] uppercase font-black text-gray-500 tracking-wider">
                                Omset QRIS (Non-Tunai)
                              </label>
                              {qris !== '' && (
                                <span className="text-xs font-black text-blue-600">
                                  {formatRupiah(Number(qris))}
                                </span>
                              )}
                            </div>
                            <div className="relative rounded-2xl shadow-sm">
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 font-bold text-xs">
                                Rp
                              </div>
                              <input
                                type="number"
                                id="qris-input"
                                required
                                min="0"
                                placeholder="Masukkan nominal qris..."
                                value={qris}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQris(val === '' ? '' : Number(val));
                                }}
                                className="block w-full pl-11 pr-4 py-3 bg-white/60 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-saffa-pink focus:border-transparent transition-all text-xs font-semibold"
                              />
                            </div>
                          </div>

                          {/* Piutang / Belum Bayar Section */}
                          <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-3xl space-y-3.5 animate-fade-in">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase font-black text-rose-600 tracking-wider flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                <span>Transaksi Belum Bayar / Piutang (Opsional)</span>
                              </div>
                              {belumBayar !== '' && (
                                <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full">
                                  Total: {formatRupiah(Number(belumBayar))}
                                </span>
                              )}
                            </div>
                            
                            <div className="space-y-3">
                              {debts.map((debt, index) => (
                                <div key={debt.id} className="grid grid-cols-12 gap-2 items-end bg-white/50 p-3 rounded-2xl border border-rose-100/50 relative group shadow-sm">
                                  {/* Name Input */}
                                  <div className="col-span-6">
                                    <label className="block text-[8px] uppercase font-bold text-gray-400 mb-1">
                                      Atas Nama Siapa
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Nama pelanggan..."
                                      value={debt.nama}
                                      onChange={(e) => {
                                        const newDebts = [...debts];
                                        newDebts[index].nama = e.target.value;
                                        setDebts(newDebts);
                                      }}
                                      className="block w-full px-2.5 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all text-[11px] font-semibold"
                                    />
                                  </div>

                                  {/* Nominal Input */}
                                  <div className="col-span-5">
                                    <label className="block text-[8px] uppercase font-bold text-gray-400 mb-1">
                                      Nominal Piutang
                                    </label>
                                    <div className="relative rounded-xl shadow-sm">
                                      <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-gray-400 font-bold text-[10px]">
                                        Rp
                                      </div>
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={debt.nominal}
                                        onChange={(e) => {
                                          const newDebts = [...debts];
                                          const val = e.target.value;
                                          newDebts[index].nominal = val === '' ? '' : Number(val);
                                          setDebts(newDebts);
                                        }}
                                        className="block w-full pl-6 pr-1.5 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all text-[11px] font-semibold"
                                      />
                                    </div>
                                  </div>

                                  {/* Action Delete Button */}
                                  <div className="col-span-1 flex items-center justify-center">
                                    {debts.length > 1 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDebts(debts.filter(d => d.id !== debt.id));
                                        }}
                                        className="p-2 text-rose-500 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition-all cursor-pointer border-0 bg-transparent flex items-center justify-center self-center"
                                        title="Hapus orang ini"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      <div className="w-8 h-8"></div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Button to Add Person */}
                            <button
                              type="button"
                              onClick={() => {
                                setDebts([...debts, { id: Date.now().toString(), nama: '', nominal: '' }]);
                              }}
                              className="w-full py-2 border border-dashed border-rose-300 hover:border-rose-500 bg-white/60 hover:bg-rose-50/50 text-rose-600 hover:text-rose-700 text-[10px] font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wide"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              Tambah Orang Berutang
                            </button>
                          </div>

                          {/* Live calculation panel */}
                          <div className="p-4 bg-gradient-to-r from-pink-500/10 to-green-500/10 border border-white/60 rounded-2xl flex justify-between items-center">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Estimasi Total Hari Ini</span>
                              <span className="block text-[10px] text-gray-400 mt-0.5">Sum: Cash + QRIS</span>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-black text-saffa-green">
                                {formatRupiah((Number(cash) || 0) + (Number(qris) || 0))}
                              </span>
                            </div>
                          </div>

                          {/* Submit */}
                          <button
                            type="submit"
                            disabled={isLoadingLive}
                            className="w-full py-4 bg-gradient-to-r from-saffa-pink to-pink-600 hover:from-saffa-pink-hover hover:to-pink-700 text-white font-bold rounded-2xl shadow-lg shadow-pink-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                          >
                            {isLoadingLive ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Menyimpan ke Google Sheets...</span>
                              </>
                            ) : (
                              <>
                                <PlusCircle className="w-4.5 h-4.5" />
                                Kirim Laporan Omset
                              </>
                            )}
                          </button>
                        </>
                      ) : (
                        /* Locked Message Card replacing form inputs when locked */
                        <div className="p-5 bg-red-50 border border-red-200 rounded-[2rem] flex flex-col items-center text-center gap-4 text-red-800 shadow-sm animate-fade-in my-2">
                          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 animate-pulse">
                            <Lock className="w-6 h-6" />
                          </div>
                          <div className="space-y-1.5">
                            <h4 className="text-sm font-black text-red-600 uppercase tracking-tight">🔒 Akses Pengisian Terkunci</h4>
                            <p className="text-xs text-red-700/90 leading-relaxed font-semibold">
                              Laporan omset harian untuk outlet <span className="text-red-700 underline decoration-red-400 decoration-2 font-bold">{outlet}</span> pada tanggal <span className="font-bold">{parseAndFormatDate(tanggal)}</span> sudah dikirim dan tidak dapat diisi ulang.
                            </p>
                            <p className="text-[10px] text-red-500 leading-relaxed font-medium">
                              Sistem mengunci pengisian ganda untuk mencegah kekeliruan data atau duplikasi dari karyawan lain. Apabila ingin merevisi laporan ini, silakan hubungi owner / admin.
                            </p>
                          </div>
                          
                          <div className="w-full pt-3 border-t border-red-200/50 flex flex-col gap-2">
                            <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Pilihan Alternatif:</div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setOutlet('');
                                  triggerToast('Silakan pilih cabang outlet lain.', 'success');
                                }}
                                className="flex-1 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold rounded-xl text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1"
                              >
                                <Store className="w-3.5 h-3.5" />
                                Ganti Outlet
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const yesterday = new Date();
                                  yesterday.setDate(yesterday.getDate() - 1);
                                  setTanggal(yesterday.toISOString().split('T')[0]);
                                  triggerToast('Tanggal diubah ke kemarin.', 'success');
                                }}
                                className="flex-1 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold rounded-xl text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                Ganti Tanggal
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </form>
                  )}
                </div>
              )}

              {/* VIEW B: ADMIN PASSWORD LOGIN */}
              {loggedOutView === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="password-input" className="block text-sm font-medium text-gray-600 mb-2">
                      Kata Sandi Akses Admin
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
                        placeholder="Masukkan sandi admin..." 
                        className="block w-full pl-11 pr-4 py-3.5 bg-white/60 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-saffa-pink focus:border-transparent transition-all placeholder:text-gray-400 text-sm font-medium"
                      />
                    </div>
                    {authError && (
                      <p className="mt-2 text-xs text-saffa-pink font-semibold flex items-center gap-1 animate-pulse">
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
              )}

              <div className="mt-6 pt-5 border-t border-gray-200/50 text-center text-xs text-gray-400 font-medium">
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
                      {isAdmin ? 'Dashboard Keuangan' : 'Dashboard Keuangan & Ekspor GAS'}
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
                      Dashboard
                    </button>
                    <button
                      onClick={() => setActiveTab('qr')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === 'qr' 
                          ? 'bg-[#e90076] text-white shadow-md' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/20'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Barcode QR Cabang
                    </button>
                    {!isAdmin && (
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
                    )}
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
                {!isAdmin && (
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
                )}

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
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-saffa-green">
                            <BarChart3 className="w-5 h-5" />
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-gray-800 font-sans leading-tight">
                              {chartView === 'outlet' && 'Grafik Omset Harian'}
                              {chartView === 'weekly' && 'Grafik Omset Mingguan'}
                              {chartView === 'monthly' && 'Grafik Omset Bulanan'}
                            </h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Analisis Per Outlet</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Date Selector */}
                          <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Pilih Tanggal:</span>
                            <input 
                              type="date"
                              value={chartDate}
                              onChange={(e) => setChartDate(e.target.value)}
                              className="text-xs font-bold text-gray-700 bg-transparent border-none focus:outline-none focus:ring-0 p-0 cursor-pointer"
                            />
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
                              Harian
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
                      </div>

                      {/* Period Description Banner & PDF Export Button */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 bg-white/40 backdrop-blur-md p-3 rounded-2xl border border-white/60">
                        <div className="text-xs text-gray-600 font-semibold flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-pink-100 text-saffa-pink rounded-lg text-[9px] font-bold uppercase tracking-wide">Periode Aktif</span>
                          <span>{chartAnalysis.description}</span>
                        </div>
                        
                        <button
                          type="button"
                          onClick={handleExportPDF}
                          className="px-4 py-2 bg-gradient-to-r from-saffa-pink to-pink-600 hover:from-saffa-pink-hover hover:to-pink-700 text-white font-bold rounded-xl shadow-md shadow-pink-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs cursor-pointer w-full sm:w-auto"
                        >
                          <FileDown className="w-4 h-4" />
                          Cetak Laporan PDF
                        </button>
                      </div>
 
                      {/* CHART CONTAINER */}
                      <div className="relative w-full h-[320px] bg-white/30 backdrop-blur-md rounded-[2rem] p-4 border border-white/60 shadow-inner">
                        <canvas ref={chartCanvasRef} className="w-full h-full"></canvas>
                      </div>

                      {/* HIGHEST & LOWEST OUTLETS ANALYSIS CARD */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        {chartAnalysis.highest ? (
                          <div className="p-4 bg-emerald-50/80 border border-emerald-100/80 rounded-2xl flex items-center justify-between shadow-sm">
                            <div>
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                                Outlet Tertinggi ({chartView === 'outlet' ? 'Harian' : chartView === 'weekly' ? 'Mingguan' : 'Bulanan'})
                              </span>
                              <span className="text-sm font-bold text-gray-800 mt-1 block leading-tight">{chartAnalysis.highest.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-semibold text-emerald-700 block">Total Omset</span>
                              <span className="text-sm font-extrabold text-[#78b928] font-mono block mt-0.5">{formatRupiah(chartAnalysis.highest.total)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-center text-xs text-gray-400 font-semibold py-6">
                            Tidak ada transaksi untuk Outlet Tertinggi
                          </div>
                        )}

                        {chartAnalysis.lowest ? (
                          <div className="p-4 bg-rose-50/80 border border-rose-100/80 rounded-2xl flex items-center justify-between shadow-sm">
                            <div>
                              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                                Outlet Terendah ({chartView === 'outlet' ? 'Harian' : chartView === 'weekly' ? 'Mingguan' : 'Bulanan'})
                              </span>
                              <span className="text-sm font-bold text-gray-800 mt-1 block leading-tight">{chartAnalysis.lowest.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-semibold text-rose-700 block">Total Omset</span>
                              <span className="text-sm font-extrabold text-[#e90076] font-mono block mt-0.5">{formatRupiah(chartAnalysis.lowest.total)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-center text-xs text-gray-400 font-semibold py-6">
                            Tidak ada transaksi untuk Outlet Terendah
                          </div>
                        )}
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
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider">ID</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider">Tanggal</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider">Jam Input</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider">Outlet</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider text-right">Cash</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider text-right">QRIS</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider text-right text-rose-600 bg-rose-50/30">Belum Bayar</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider text-rose-600 bg-rose-50/30">Atas Nama</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider text-right">Total</th>
                          <th className="px-6 py-4 font-bold text-xs text-gray-500 uppercase tracking-wider text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-6 py-12 text-center text-sm text-gray-400">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Info className="w-8 h-8 text-gray-300" />
                                <span>Tidak ditemukan riwayat data transaksi harian.</span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredTransactions.map((item) => (
                            <tr key={item.id} className="hover:bg-pink-50/10 transition-all">
                              <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-500 font-bold">
                                {item.id}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-700">
                                {parseAndFormatDate(item.tanggal)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-600 font-mono text-xs">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                                  <span>{formatInputTime(item.timestamp)}</span>
                                </div>
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
                              <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-rose-600 font-bold bg-rose-50/20">
                                {item.belumBayar ? formatRupiah(item.belumBayar) : '-'}
                              </td>
                              <td className="px-6 py-4 font-semibold text-rose-700 text-xs bg-rose-50/20 max-w-xs truncate" title={item.belumBayarNama || undefined}>
                                {item.belumBayarNama || '-'}
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
                               <div className="mt-4 pt-4 border-t border-white/60 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-8">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                          Google Apps Script Web App URL (Terkunci)
                        </label>
                        <span className="text-[10px] bg-pink-100 text-[#e90076] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                          Utama / Aktif
                        </span>
                      </div>
                      <input 
                        type="url"
                        value={webAppUrl}
                        readOnly
                        placeholder="https://script.google.com/macros/s/AKfyby.../exec"
                        className="w-full px-3 py-2 bg-gray-100/80 border border-gray-200 rounded-xl text-xs focus:outline-none font-mono text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    
                    <div className="md:col-span-4 flex gap-2 h-9 self-end">
                      <div className="flex-1 h-full px-3 bg-green-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-green-100 cursor-default">
                        <Database className="w-3.5 h-3.5" />
                        <span>Online Aktif</span>
                      </div>

                      <button
                        onClick={() => fetchLiveTransactions()}
                        disabled={isLoadingLive}
                        className="px-3 h-full bg-white hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm"
                        title="Refresh Data dari Sheets"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLive ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
                  
                  {/* SHAREABLE LOCKED LINK BLOCK */}
                  {webAppUrl && (
                    <div className="mt-4 p-3 bg-green-50/50 border border-green-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="block text-[10px] uppercase font-bold text-green-700 tracking-wider">Tautan Auto-Integrasi Terkunci (Siap Bagikan)</span>
                        <p className="text-[11px] text-gray-600 font-mono truncate select-all mt-0.5">
                          {`${window.location.origin}${window.location.pathname}?webapp=${encodeURIComponent(webAppUrl)}`}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}${window.location.pathname}?webapp=${encodeURIComponent(webAppUrl)}`;
                          navigator.clipboard.writeText(link);
                          triggerToast('Tautan integrasi berhasil disalin! Siapapun yang membuka tautan ini akan langsung terhubung ke Google Sheets Anda secara otomatis.', 'success');
                        }}
                        className="px-3.5 py-1.5 bg-saffa-green hover:bg-saffa-green-hover text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-green-100 flex-shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Salin Tautan Kunci
                      </button>
                    </div>
                  )}

                  {/* VERSION CONTROL & UPDATE ENGINE */}
                  {isLiveMode && webAppUrl && (
                    <div className="mt-4 p-4 bg-white/50 border border-white/80 rounded-2xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-saffa-pink">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-800">Versi Dashboard:</span>
                              <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-bold text-gray-600 font-mono">
                                v{currentAppVersion}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {isCheckingVersion ? (
                                <span className="flex items-center gap-1.5">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-saffa-pink" />
                                  Menghubungkan ke Google Sheets untuk verifikasi versi...
                                </span>
                              ) : hasNewVersion ? (
                                <span className="text-amber-600 font-semibold flex items-center gap-1">
                                  ⚠️ Pembaruan fitur tersedia (v{latestVersion}!)
                                </span>
                              ) : versionError ? (
                                <span className="text-rose-500">
                                  Gagal memverifikasi: {versionError}
                                </span>
                              ) : (
                                <span className="text-green-600 font-medium">
                                  ✓ Dashboard Anda sudah up-to-date.
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => checkAppVersion(webAppUrl, false)}
                            disabled={isCheckingVersion}
                            className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer bg-white"
                          >
                            <RefreshCw className={`w-3 h-3 ${isCheckingVersion ? 'animate-spin' : ''}`} />
                            Cek Versi
                          </button>
                          {hasNewVersion && (
                            <button
                              onClick={() => setShowVersionUpdateModal(true)}
                              className="px-3 py-1.5 bg-[#e90076] hover:bg-[#c80064] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-pink-100"
                            >
                              <Sparkles className="w-3 h-3" />
                              Lihat Update
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {connectionError && (
                    <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-xs font-bold text-rose-800">
                            Terdeteksi Masalah Koneksi Google Sheets
                          </h4>
                          <p className="text-xs text-rose-700/90 mt-1 leading-relaxed">
                            Respons dari Web App Google Script tidak valid (mengembalikan HTML halaman login/konfirmasi/keamanan dari Google, bukan format data JSON). Hal ini sangat umum terjadi ketika Google membatasi akses sementara ke script baru, atau memerlukan persetujuan izin akses pertama kali dari pemilik akun.
                          </p>
                          
                          <div className="mt-3 bg-white/80 rounded-xl p-3 border border-rose-100/50 space-y-2">
                            <p className="text-[10px] font-bold text-gray-800 uppercase tracking-wider">
                              Cara Mengatasi (Hanya Butuh 30 Detik):
                            </p>
                            <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1.5 leading-relaxed">
                              <li>
                                Klik tombol <strong className="text-gray-800">"Buka & Berikan Izin Otorisasi"</strong> di bawah untuk membuka URL Google Script langsung di browser Anda.
                              </li>
                              <li>
                                Jika muncul halaman peringatan dari Google (seperti "Aplikasi tidak diverifikasi" atau "Review Permissions"), klik <strong className="text-gray-800">Advanced / Lanjutan</strong> di bagian bawah, lalu klik <strong className="text-gray-800">Go to Saffa Bubur Bayi (unsafe) / Buka Saffa Bubur Bayi (tidak aman)</strong>.
                              </li>
                              <li>
                                Berikan otorisasi izin akses dengan mengklik tombol <strong className="text-gray-800">Allow / Izinkan</strong>.
                              </li>
                              <li>
                                Pastikan juga saat melakukan Deploy di Google Apps Script, setelan aksesnya adalah:
                                <div className="mt-1 pl-4 font-semibold text-gray-700">
                                  • Execute as: "Me (Akun Google Anda)"<br />
                                  • Who has access: "Anyone (Siapa saja, bahkan anonim)"
                                </div>
                              </li>
                            </ol>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <a
                              href={`${webAppUrl}?action=read`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Buka & Berikan Izin Otorisasi
                            </a>
                            <button
                              onClick={() => {
                                setConnectionError(null);
                                fetchLiveTransactions();
                              }}
                              className="px-3.5 py-1.5 bg-white hover:bg-gray-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Coba Hubungkan Kembali
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-[11px] text-gray-500 leading-relaxed font-medium space-y-1">
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
                    <span className="block text-gray-400">
                      🔒 <strong>Kunci Permanen untuk Semua:</strong> Anda juga dapat mengunci URL ini secara permanen di dalam berkas kode (ubah variabel <code>DEFAULT_WEB_APP_URL</code> di <code>App.tsx</code>) sehingga semua pengguna terhubung secara default tanpa parameter tambahan.
                    </span>
                  </div>
                </div>

              </main>
            )}

            {/* TAB CONTENT 2: BARCODE & QR GENERATOR */}
            {activeTab === 'qr' && (
              <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
                
                {/* PRIMARY SINGLE BARCODE SECTION (HERO) */}
                <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl border-2 border-saffa-pink/30 shadow-xl rounded-[2.5rem] p-6 md:p-10 text-center max-w-3xl mx-auto space-y-6">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-16 h-16 rounded-3xl bg-pink-100 flex items-center justify-center text-saffa-pink shadow-md">
                      <QrCode className="w-8 h-8" />
                    </div>
                    <span className="text-[11px] font-black tracking-widest text-saffa-pink uppercase mt-2">BARCODE UTAMA LAPORAN</span>
                    <h2 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight">
                      Saffa Bubur Bayi
                    </h2>
                    <p className="text-xs text-gray-500 max-w-lg mx-auto font-semibold leading-relaxed">
                      Cetak barcode di bawah ini untuk ditempel di rumah Anda. Karyawan cukup men-scan barcode ini untuk langsung membuka formulir pelaporan omset harian.
                    </p>
                  </div>

                  {/* LARGE QR CODE CAROUSEL CARD */}
                  <div className="bg-white border-2 border-pink-100 rounded-[2rem] p-6 md:p-8 max-w-sm mx-auto shadow-md space-y-4">
                    <div className="flex justify-center">
                      <img src={LOGO_URL} alt="Saffa Logo" className="h-10 object-contain" />
                    </div>
                    
                    <div className="text-sm font-extrabold text-saffa-pink uppercase tracking-wider">
                      FORMULIR LAPORAN OMSET
                    </div>
                    
                    <div className="mx-auto w-56 h-56 bg-pink-50/50 border border-pink-100 rounded-2xl p-4 flex items-center justify-center shadow-inner">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getMainTargetUrl())}`}
                        alt="Barcode Utama Saffa"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    
                    <div className="text-[11px] font-bold text-gray-600 bg-gray-50 py-1.5 px-3 rounded-full inline-block max-w-full truncate">
                      Tujuan: <span className="font-mono text-saffa-pink font-semibold break-all whitespace-pre-wrap">{getMainTargetUrl()}</span>
                    </div>
                  </div>

                  {/* ACTIONS GROUP */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto pt-2">
                    <button
                      onClick={handlePrintHomeQR}
                      className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-saffa-pink to-pink-600 hover:from-saffa-pink-hover hover:to-pink-700 text-white font-bold rounded-2xl shadow-lg shadow-pink-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      Cetak Barcode Utama (Print & Tempel)
                    </button>
                    
                    <button
                      onClick={() => {
                        const targetUrl = getMainTargetUrl();
                        navigator.clipboard.writeText(targetUrl);
                        triggerToast('Link website disalin ke clipboard!', 'success');
                      }}
                      className="w-full sm:w-auto px-6 py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                    >
                      <Copy className="w-4 h-4 text-gray-400" />
                      Salin Link Website
                    </button>
                  </div>
                </div>

                {/* EXPANDABLE BRANCH BARCODES SECTION */}
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 shadow-md rounded-[2.5rem] p-6 max-w-4xl mx-auto">
                  <details className="group">
                    <summary className="list-none flex items-center justify-between cursor-pointer font-bold text-gray-700 select-none">
                      <div className="flex items-center gap-3">
                        <Store className="w-5 h-5 text-gray-500" />
                        <div className="text-left">
                          <h3 className="text-sm font-black text-gray-800">Atau Gunakan Barcode Khusus Per Cabang (Opsional)</h3>
                          <p className="text-[11px] text-gray-400 font-semibold mt-0.5">Membuka form dengan isian cabang yang otomatis terkunci</p>
                        </div>
                      </div>
                      <span className="transition group-open:rotate-180 text-gray-500">
                        <ChevronDown className="w-5 h-5" />
                      </span>
                    </summary>
                    
                    <div className="mt-6 pt-6 border-t border-gray-200/60 space-y-6">
                      <div className="p-4 bg-blue-50/80 border border-blue-100 rounded-2xl flex items-start gap-3 text-xs text-blue-800 font-medium">
                        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Informasi Tambahan:</span>
                          <p className="mt-1 leading-relaxed text-[11px] text-blue-700 font-semibold">
                            Barcode khusus cabang di bawah ini akan otomatis memilih nama outlet saat di-scan oleh karyawan, sehingga karyawan tidak perlu memilih nama cabang secara manual lagi. Gunakan ini jika Anda ingin mencetak barcode khusus untuk masing-masing lokasi jualan.
                          </p>
                        </div>
                      </div>

                      {/* CONFIG LINK BARCODE */}
                      <div className="bg-white/50 border border-gray-100 rounded-2xl p-4 space-y-3">
                        <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">Konfigurasi Target Aplikasi Cabang</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                          <div className="md:col-span-3 space-y-1.5">
                            <label className="block text-[10px] uppercase font-black text-gray-400 tracking-wider">
                              URL Target Cabang
                            </label>
                            <input
                              type="text"
                              value={customBaseUrl}
                              onChange={(e) => setCustomBaseUrl(e.target.value)}
                              placeholder="https://example.com"
                              className="block w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffa-pink focus:border-transparent text-xs font-semibold"
                            />
                          </div>
                          <button
                            onClick={() => {
                              let url = window.location.origin + window.location.pathname;
                              if (url.includes('ais-dev-')) {
                                url = url.replace('ais-dev-', 'ais-pre-');
                              }
                              setCustomBaseUrl(url);
                              triggerToast('URL di-reset ke default publik!', 'success');
                            }}
                            className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Reset URL
                          </button>
                        </div>
                      </div>

                      {/* BRANCH CARDS GRID */}
                      <div className="space-y-6 pt-2">
                        {OUTLETS_DATA.map((region) => (
                          <div key={region.region} className="space-y-3">
                            <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest pl-2 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-saffa-pink"></span>
                              {region.region}
                            </h4>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                              {region.items.map((name) => {
                                let baseUrl = customBaseUrl || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');
                                if (baseUrl.includes('ais-dev-')) {
                                  baseUrl = baseUrl.replace('ais-dev-', 'ais-pre-');
                                }
                                const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
                                const webapp = params.get('webapp') || params.get('url') || webAppUrl;
                                
                                let newParams = new URLSearchParams();
                                newParams.set('outlet', name);
                                if (webapp) {
                                  newParams.set('webapp', webapp);
                                }
                                const outletUrl = `${baseUrl}?${newParams.toString()}`;
                                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(outletUrl)}`;
                                
                                return (
                                  <div key={name} className="bg-white/60 border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-saffa-green uppercase tracking-wider">QR Cabang</span>
                                        <span className="text-[9px] font-mono font-bold bg-pink-100 text-saffa-pink px-1.5 py-0.5 rounded">Pre-filled</span>
                                      </div>
                                      
                                      <div>
                                        <h5 className="text-xs font-black text-gray-800 truncate">{name}</h5>
                                        <p className="text-[9px] text-gray-400 font-medium">Saffa Bubur Bayi</p>
                                      </div>
                                      
                                      <div className="mx-auto w-32 h-32 bg-white border border-gray-100 rounded-xl p-2 flex items-center justify-center">
                                        <img 
                                          src={qrImageUrl} 
                                          alt={`QR Code ${name}`} 
                                          className="w-full h-full object-contain"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                    </div>
                                    
                                    <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                                      <button
                                        onClick={() => handlePrintSingleQR(name)}
                                        className="w-full py-1.5 bg-pink-50 hover:bg-pink-100 text-saffa-pink font-bold rounded-lg transition-all text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        <Printer className="w-3 h-3" />
                                        Cetak Barcode
                                      </button>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(outletUrl);
                                          triggerToast(`Link untuk Outlet ${name} disalin ke clipboard!`, 'success');
                                        }}
                                        className="w-full py-1 text-[9px] font-semibold text-gray-400 hover:text-gray-700 transition-all flex items-center justify-center gap-1 cursor-pointer truncate"
                                      >
                                        <Copy className="w-2.5 h-2.5 flex-shrink-0" />
                                        Salin Link Cabang
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                </div>

              </main>
            )}

            {/* TAB CONTENT 3: GOOGLE APPS SCRIPT CODE & SETUP EXPLAINER */}
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

      {/* VERSION UPDATE MODAL */}
      {showVersionUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md">
          <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-[2.5rem] p-6 md:p-8 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            {/* Close Button */}
            <button 
              onClick={() => setShowVersionUpdateModal(false)}
              className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all cursor-pointer border-0 bg-transparent"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Sparkles icon */}
            <div className="w-14 h-14 rounded-2xl bg-pink-100 text-[#e90076] flex items-center justify-center mb-5">
              <Sparkles className="w-8 h-8" />
            </div>

            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-pink-50 text-saffa-pink uppercase tracking-wide">
              Pembaruan Tersedia
            </span>

            <h3 className="text-2xl font-black text-gray-900 tracking-tight mt-3">
              Saffa Dashboard v{latestVersion}
            </h3>
            
            <p className="text-sm text-gray-500 mt-1 font-semibold">
              Versi Anda saat ini: <span className="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">v{currentAppVersion}</span>
            </p>

            <div className="mt-6 space-y-4">
              <div className="bg-pink-50/40 border border-pink-100/50 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-saffa-pink uppercase tracking-wider mb-2">
                  Apa yang Baru di Versi ini?
                </h4>
                <p className="text-xs text-gray-700 leading-relaxed font-medium">
                  {changelog || 'Pembaruan stabilitas, perbaikan bug minor, peningkatan penanganan offline, dan optimasi performa sinkronisasi bento-grid.'}
                </p>
              </div>

              <div className="bg-green-50/40 border border-green-100/50 rounded-2xl p-4 flex items-start gap-3">
                <Info className="w-4 h-4 text-saffa-green flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-saffa-green uppercase tracking-wider">
                    Bagaimana cara memperbarui?
                  </h5>
                  <p className="text-[11px] text-gray-600 leading-relaxed mt-1">
                    Pembaruan ini sepenuhnya kompatibel. Anda dapat mengunduh atau menyalin kode <code className="bg-white px-1 py-0.5 rounded border">Code.gs</code> atau <code className="bg-white px-1 py-0.5 rounded border">Index.html</code> baru dari tab <strong>"Ekspor GAS"</strong> di dashboard Anda, kemudian pasang kembali di Google Apps Script Anda.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => {
                  setShowVersionUpdateModal(false);
                  setActiveTab('gas');
                }}
                className="flex-1 py-3 bg-[#e90076] hover:bg-[#c80064] text-white text-xs font-black rounded-2xl transition-all cursor-pointer shadow-md shadow-pink-100 text-center uppercase tracking-wide"
              >
                Unduh Kode Pembaruan
              </button>
              <button
                onClick={() => setShowVersionUpdateModal(false)}
                className="px-5 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-2xl transition-all cursor-pointer bg-white text-center uppercase tracking-wide"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        </div>
      )}

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
