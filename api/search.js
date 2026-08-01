// api/search.js
// Vercel serverless function — chạy trên server, KHÔNG chạy trong trình duyệt.
// Đây là nơi duy nhất được phép cầm ANTHROPIC_API_KEY, để sale dùng app
// trên điện thoại mà key không bao giờ lộ ra ngoài.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Thiếu ANTHROPIC_API_KEY trên server (cấu hình trong Vercel > Settings > Environment Variables).' });
    return;
  }

  const { query } = req.body || {};
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Thiếu query' });
    return;
  }

  const system = `Bạn là trợ lý nội bộ cho sale của một công ty trung gian cho thuê villa/resort/khách sạn tại Việt Nam.
Nhiệm vụ: đọc câu hỏi của sale và tách ra các tiêu chí lọc, đồng thời viết một câu trả lời ngắn, thân thiện, đúng chất đồng nghiệp (không quảng cáo, không dài dòng).
CHỈ trả lời bằng JSON hợp lệ, không kèm markdown, không kèm lời dẫn, theo đúng cấu trúc:
{"location": string hoặc null, "guests_min": number hoặc null, "price_max": number hoặc null (đơn vị VND), "reply": string}
Nếu câu hỏi có địa danh Việt Nam, chuẩn hoá về tên khu vực ngắn gọn (vd "Phan Thiết", "Phú Quốc", "Đà Lạt", "Nha Trang", "Hội An", "Vũng Tàu").
Giá tiền nói "tr" hoặc "triệu" nghĩa là triệu đồng.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 300,
        system,
        messages: [{ role: 'user', content: query }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: 'Anthropic API lỗi: ' + errText });
      return;
    }

    const data = await response.json();
    const text = (data.content || []).map((c) => c.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server: ' + err.message });
  }
};
