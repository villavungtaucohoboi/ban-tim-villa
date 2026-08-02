// api/sheet.js
// Lấy dữ liệu villa từ Google Sheet (đã Publish to web) ngay trên server,
// rồi mới đưa cho trình duyệt — tránh bị trình duyệt chặn do CORS khi gọi thẳng.

module.exports = async function handler(req, res) {
  const sheetUrl = process.env.SHEET_CSV_URL;
  if (!sheetUrl) {
    res.status(500).json({ error: 'Thiếu SHEET_CSV_URL trên server (cấu hình trong Vercel > Settings > Environment Variables).' });
    return;
  }

  try {
    const bustCache = sheetUrl + (sheetUrl.includes('?') ? '&' : '?') + 'cachebust=' + Date.now();
    const response = await fetch(bustCache);
    if (!response.ok) {
      res.status(502).json({ error: 'Không tải được Google Sheet, mã lỗi: ' + response.status });
      return;
    }
    const csvText = await response.text();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(csvText);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server khi lấy Google Sheet: ' + err.message });
  }
};
