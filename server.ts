import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API sheets proxy to bypass CORS/sandbox restrictions in iframe
  app.get("/api/sheets-proxy", async (req, res) => {
    try {
      const { url, ...params } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ success: false, error: 'Parameter URL tidak boleh kosong' });
      }

      // Parse the target URL
      const targetUrl = new URL(url);
      
      // Append all other query params to target URL
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined) {
          targetUrl.searchParams.set(key, String(val));
        }
      });

      console.log(`[Proxy] Fetching: ${targetUrl.toString()}`);

      const response = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });

      if (!response.ok) {
        throw new Error(`Google Sheets Web App responded with status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      // Check if it is JSON
      let isJson = false;
      let data;
      try {
        data = JSON.parse(text);
        isJson = true;
      } catch (e) {
        isJson = false;
      }

      if (isJson) {
        res.json(data);
      } else {
        // Since it's not valid JSON, it's either an HTML error/auth page from Google, or incorrect Apps Script configuration
        const textLower = text.toLowerCase();
        const isHtml = contentType.includes('text/html') || 
                       text.trim().startsWith('<') || 
                       text.trim().startsWith('<!') ||
                       textLower.includes('<html') || 
                       textLower.includes('doctype html') ||
                       textLower.includes('usercodeapppanel');

        if (isHtml) {
          res.status(502).json({
            success: false,
            error: 'URL Google Sheets Web App mengembalikan halaman HTML, bukan data JSON. Pastikan Web App Anda di-deploy dengan benar (Setelan akses: "Anyone/Siapa Saja") dan Anda sudah memberikan izin otorisasi akses pertama kali.'
          });
        } else {
          res.status(502).json({
            success: false,
            error: `Respons dari server tidak valid (bukan JSON): "${text.substring(0, 150)}..."`
          });
        }
      }
    } catch (error: any) {
      console.error('[Proxy Error]', error);
      res.status(500).json({ 
        success: false, 
        error: `Gagal sinkronisasi data Google Sheets: ${error.message || error}` 
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express v4 uses '*'
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
