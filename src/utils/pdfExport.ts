import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
}

// Helper to format currency in Indonesian Rupiah
const formatRupiah = (val: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val);
};

// Helper to format date in Indonesian long style (e.g., 9 Juli 2026)
const formatDateIndo = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Helper to get Indonesian short date format
const formatDateIndoShort = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

// Helper to calculate week range in Indonesian style
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

// Helper to get Indonesian Month Year style (e.g., Juli 2026)
const getMonthYearIndo = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

// Helper to format input time from timestamp (e.g., "17:15")
const formatInputTime = (timestampStr: string | undefined) => {
  if (!timestampStr) return '-';
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

// Helper to asynchronously load image as HTMLImageElement
const loadImg = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
};

export const exportToPDF = async (
  transactions: Transaction[],
  periodType: 'outlet' | 'weekly' | 'monthly',
  selectedDate: string,
  outlets: string[],
  userEmail: string,
  isLiveMode: boolean,
  logoUrl?: string
) => {
  let title = '';
  let periodLabel = '';
  let filtered: Transaction[] = [];

  // Filter transactions exactly matching the active view
  if (periodType === 'outlet') {
    title = 'LAPORAN OMSET HARIAN';
    periodLabel = formatDateIndo(selectedDate);
    filtered = transactions.filter(t => t.tanggal === selectedDate);
  } else if (periodType === 'weekly') {
    title = 'LAPORAN OMSET MINGGUAN';
    periodLabel = getWeekRangeIndo(selectedDate);
    
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const formatISO = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const mondayStr = formatISO(monday);
    const sundayStr = formatISO(sunday);
    filtered = transactions.filter(t => t.tanggal >= mondayStr && t.tanggal <= sundayStr);
  } else {
    title = 'LAPORAN OMSET BULANAN';
    periodLabel = getMonthYearIndo(selectedDate);
    const monthPrefix = selectedDate.substring(0, 7);
    filtered = transactions.filter(t => t.tanggal.startsWith(monthPrefix));
  }

  // Calculate totals
  const totalCash = filtered.reduce((s, t) => s + t.cash, 0);
  const totalQris = filtered.reduce((s, t) => s + t.qris, 0);
  const grandTotal = totalCash + totalQris;

  // Initialize jsPDF (Portrait, A4 size in mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Try loading the logo image asynchronously
  let imgElement: HTMLImageElement | null = null;
  if (logoUrl) {
    try {
      imgElement = await loadImg(logoUrl);
    } catch (e) {
      console.error('Gagal memuat logo Saffa, menggunakan badge vektor bawaan:', e);
    }
  }

  // --- DRAW BRAND HEADER ---
  // Top green accent bar
  doc.setFillColor(120, 185, 40); // Saffa Green (#78b928)
  doc.rect(0, 0, 210, 4, 'F');

  let textStartX = 28;
  if (imgElement) {
    // Draw Saffa logo (larger size 16x16)
    doc.addImage(imgElement, 'PNG', 15, 7, 16, 16);
    textStartX = 35;
  } else {
    // Saffa logo badge (vector emblem fallback)
    doc.setFillColor(120, 185, 40); // Saffa Green
    doc.roundedRect(15, 10, 10, 10, 2, 2, 'F');

    // White "S" inside the green emblem
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('S', 19, 17);
    textStartX = 28;
  }

  // "SAFFA ID" brand name
  doc.setTextColor(33, 41, 54); // Dark slate
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SAFFA ID', textStartX, 17);

  // Slogan/Label below brand text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(115, 128, 142); // Gray
  doc.text('Sistem Informasi Omset & Transaksi', textStartX, 22);

  // Document Title & Metadata on the Right
  doc.setTextColor(33, 41, 54);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, 195, 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(115, 128, 142);
  doc.text(`Periode: ${periodLabel}`, 195, 20, { align: 'right' });
  doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 195, 24, { align: 'right' });

  // Divider Line
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.5);
  doc.line(15, 28, 195, 28);

  // --- REPORT METADATA BOX ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(115, 128, 142);
  doc.text('INFORMASI LAPORAN', 15, 34);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 80, 95);
  doc.text(`Tipe Laporan : ${periodType === 'outlet' ? 'Harian (Per Hari)' : periodType === 'weekly' ? 'Mingguan (Per Minggu)' : 'Bulanan (Per Bulan)'}`, 15, 39);
  doc.text(`Total Transaksi: ${filtered.length} Transaksi`, 15, 43);
  
  if (userEmail) {
    doc.text(`Operator     : ${userEmail}`, 110, 39);
  }
  doc.text(`Sumber Data  : ${isLiveMode ? 'Google Sheets (Live Sync)' : 'Database Offline (Lokal)'}`, 110, 43);

  // --- FINANCIAL SUMMARY CARDS (using an autoTable for clean layout) ---
  autoTable(doc, {
    startY: 48,
    margin: { left: 15, right: 15 },
    theme: 'plain',
    styles: {
      cellPadding: 4,
      fontSize: 8.5,
      font: 'helvetica'
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 55 },
      2: { cellWidth: 70 }
    },
    body: [
      [
        {
          content: `TOTAL CASH\n\n${formatRupiah(totalCash)}`,
          styles: {
            halign: 'center',
            fontStyle: 'bold',
            textColor: [33, 41, 54],
            fillColor: [243, 244, 246],
            lineWidth: 0.5,
            lineColor: [229, 231, 235]
          }
        },
        {
          content: `TOTAL QRIS\n\n${formatRupiah(totalQris)}`,
          styles: {
            halign: 'center',
            fontStyle: 'bold',
            textColor: [233, 0, 118], // Saffa Pink (#e90076)
            fillColor: [253, 242, 248], // Light pink bg
            lineWidth: 0.5,
            lineColor: [251, 207, 232]
          }
        },
        {
          content: `TOTAL OMSET KESELURUHAN\n\n${formatRupiah(grandTotal)}`,
          styles: {
            halign: 'center',
            fontStyle: 'bold',
            textColor: [255, 255, 255],
            fillColor: [120, 185, 40], // Saffa Green (#78b928)
            lineWidth: 0.5,
            lineColor: [100, 160, 30]
          }
        }
      ]
    ]
  });

  // --- OUTLET TURNOVER SUMMARY TABLE ---
  const OUTLETS_REGIONS = [
    {
      region: 'Wilayah Tanjungpinang (8 Lokasi)',
      items: ['KM 8 Atas', 'Poltekkes', 'Simpang Kios Djalal', 'Bincen', 'Jl. Cinta Damai', 'Ganet', 'Kijang Lama', 'KM 16 Arah Uban']
    },
    {
      region: 'Wilayah Bintan (3 Lokasi)',
      items: ['KM 18 Arah Kijang', 'Jl. Musi KM 19', 'Simpang 3 Tanah Kuning']
    }
  ];

  const activeOutletRows: any[] = [];
  let globalIdx = 1;

  OUTLETS_REGIONS.forEach(reg => {
    // Add region category row
    activeOutletRows.push([
      {
        content: reg.region.toUpperCase(),
        colSpan: 6,
        styles: {
          fillColor: [240, 244, 248],
          textColor: [33, 41, 54],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left',
          cellPadding: 2.5
        }
      }
    ]);

    // Calculate data for outlets in this region
    const regionOutletsData = reg.items.map(o => {
      const oTrans = filtered.filter(t => t.outlet === o);
      const cashSum = oTrans.reduce((s, t) => s + t.cash, 0);
      const qrisSum = oTrans.reduce((s, t) => s + t.qris, 0);
      const totalSum = cashSum + qrisSum;
      const contrib = grandTotal > 0 ? (totalSum / grandTotal) * 100 : 0;
      return { name: o, cash: cashSum, qris: qrisSum, total: totalSum, contrib };
    });

    // Sort outlets inside the region by total sales descending
    const sortedRegOutlets = [...regionOutletsData].sort((a, b) => b.total - a.total);

    // Append to table rows
    sortedRegOutlets.forEach(o => {
      activeOutletRows.push([
        globalIdx++,
        o.name,
        formatRupiah(o.cash),
        formatRupiah(o.qris),
        formatRupiah(o.total),
        `${o.contrib.toFixed(1)}%`
      ]);
    });
  });

  const summaryY = (doc as any).lastAutoTable.finalY || 70;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(33, 41, 54);
  doc.text('RINGKASAN OMSET PER OUTLET', 15, summaryY + 8);

  autoTable(doc, {
    startY: summaryY + 11,
    margin: { left: 15, right: 15 },
    head: [['No', 'Nama Outlet', 'Omset Cash', 'Omset QRIS', 'Total Omset', 'Kontribusi']],
    body: activeOutletRows,
    theme: 'striped',
    headStyles: {
      fillColor: [33, 41, 54], // Dark slate header
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [50, 50, 50]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50, fontStyle: 'bold' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 25, halign: 'center' }
    },
    foot: [
      [
        '',
        'TOTAL KESELURUHAN',
        formatRupiah(totalCash),
        formatRupiah(totalQris),
        formatRupiah(grandTotal),
        '100.0%'
      ]
    ],
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [33, 41, 54],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'right'
    }
  });

  // --- DETAILED TRANSACTIONS TABLE ---
  const outletY = (doc as any).lastAutoTable.finalY || (summaryY + 50);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(33, 41, 54);
  doc.text('DAFTAR TRANSAKSI RINCI', 15, outletY + 8);

  const txRows = filtered.map((t, idx) => [
    idx + 1,
    t.id,
    formatDateIndoShort(t.tanggal),
    formatInputTime(t.timestamp),
    t.outlet,
    formatRupiah(t.cash),
    formatRupiah(t.qris),
    t.belumBayar ? formatRupiah(t.belumBayar) : '-',
    t.belumBayarNama || '-',
    formatRupiah(t.total)
  ]);

  autoTable(doc, {
    startY: outletY + 11,
    margin: { left: 15, right: 15 },
    head: [['No', 'ID Transaksi', 'Tanggal', 'Jam Input', 'Outlet', 'Cash', 'QRIS', 'Blm Bayar', 'Atas Nama', 'Total']],
    body: txRows.length > 0 ? txRows : [['-', 'Tidak ada transaksi', '-', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'striped',
    headStyles: {
      fillColor: [120, 185, 40], // Saffa Green header
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [70, 70, 70]
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 15 },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 25 },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 20, halign: 'right' }, // Blm Bayar
      8: { cellWidth: 17 }, // Atas Nama
      9: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
    }
  });

  // --- FOOTER AND PAGE NUMBERS ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    
    // Footer divider line
    doc.setDrawColor(240, 240, 240);
    doc.line(15, 282, 195, 282);
    
    doc.text('Dokumen ini digenerate secara otomatis dari Aplikasi Omset Saffa ID.', 15, 287);
    doc.text(`Halaman ${i} dari ${pageCount}`, 195, 287, { align: 'right' });
  }

  // Save the PDF locally
  const safeLabel = periodLabel.replace(/[\s\/:,\.\(\)]+/g, '_');
  doc.save(`Laporan_Omset_Saffa_${periodType}_${safeLabel}.pdf`);
};
