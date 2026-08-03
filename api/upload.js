// api/upload.js
// Nhận file Excel (.xlsx) tải lên từ giao diện app, đọc dữ liệu, rồi ghi thẳng
// vào file data.json trên GitHub — GitHub sẽ tự báo Vercel deploy lại bản mới,
// nên vài chục giây sau là dữ liệu mới lên web, không cần đụng gì thêm.

const XLSX = require('xlsx');

function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchHeader(h, candidates) {
  const n = normalize(h).replace(/\s+/g, '');
  return candidates.some((c) => n.includes(normalize(c).replace(/\s+/g, '')));
}

function toNumber(v) {
  if (v == null) return null;
  const digits = String(v).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : null;
}

function rowsToProducts(rows) {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const col = {
    id: headers.find((h) => matchHeader(h, ['ma villa', 'ma san pham', 'id'])),
    name: headers.find((h) => matchHeader(h, ['ten villa', 'ten san pham', 'name'])),
    region: headers.find((h) => matchHeader(h, ['khu vuc', 'region'])),
    guests: headers.find((h) => matchHeader(h, ['suc chua', 'so khach', 'guests'])),
    price: headers.find((h) => matchHeader(h, ['gia', 'price'])),
    tags: headers.find((h) => matchHeader(h, ['tien ich', 'tags', 'amenities'])),
  };
  return rows
    .filter((r) => col.name && String(r[col.name] || '').trim())
    .map((r, i) => {
      const region = col.region ? String(r[col.region] || '').trim() : 'Khác';
      return {
        id: col.id && r[col.id] ? String(r[col.id]).trim() : 'SP-' + (i + 1),
        name: String(r[col.name]).trim(),
        region: region || 'Khác',
        guests: col.guests ? toNumber(r[col.guests]) : null,
        price: col.price ? toNumber(r[col.price]) : null,
        tags: col.tags
          ? String(r[col.tags] || '').split(/[;,]/).map((t) => t.trim()).filter(Boolean)
          : [],
      };
    });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { password, filename, fileBase64 } = req.body || {};

  if (!process.env.UPLOAD_PASSWORD) {
    res.status(500).json({ error: 'Server chưa cấu hình UPLOAD_PASSWORD (Vercel > Settings > Environment Variables).' });
    return;
  }
  if (password !== process.env.UPLOAD_PASSWORD) {
    res.status(401).json({ error: 'Sai mật khẩu.' });
    return;
  }
  if (!fileBase64) {
    res.status(400).json({ error: 'Thiếu file.' });
    return;
  }

  let products;
  try {
    const buf = Buffer.from(fileBase64, 'base64');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    products = rowsToProducts(rows);
  } catch (e) {
    res.status(400).json({ error: 'Không đọc được file Excel: ' + e.message });
    return;
  }

  if (!products.length) {
    res.status(400).json({ error: 'Không tìm thấy dòng dữ liệu hợp lệ trong file. Kiểm tra lại tên cột (Mã villa, Tên villa, Khu vực, Sức chứa, Giá, Tiện ích).' });
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // dạng "tenchusohuu/ten-repo"
  if (!token || !repo) {
    res.status(500).json({ error: 'Server chưa cấu hình GITHUB_TOKEN / GITHUB_REPO (Vercel > Settings > Environment Variables).' });
    return;
  }

  const apiUrl = `https://api.github.com/repos/${repo}/contents/data.json`;
  const content = Buffer.from(JSON.stringify(products, null, 2)).toString('base64');

  let sha;
  try {
    const getRes = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'ban-tim-villa', Accept: 'application/vnd.github+json' },
    });
    if (getRes.ok) {
      const j = await getRes.json();
      sha = j.sha;
    }
  } catch (e) {
    // Không sao — nếu data.json chưa tồn tại thì tạo mới, không cần sha.
  }

  try {
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'ban-tim-villa',
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Cập nhật dữ liệu villa từ ${filename || 'file Excel'} (${products.length} sản phẩm)`,
        content,
        sha,
      }),
    });
    if (!putRes.ok) {
      const errText = await putRes.text();
      res.status(502).json({ error: 'Không ghi được lên GitHub: ' + errText });
      return;
    }
  } catch (e) {
    res.status(500).json({ error: 'Lỗi khi ghi lên GitHub: ' + e.message });
    return;
  }

  res.status(200).json({ success: true, count: products.length });
};
