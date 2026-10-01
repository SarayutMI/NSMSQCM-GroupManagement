// คุยกับ Code.gs (Web App) — ทุกคำสั่งเขียนตอบกลับด้วยข้อมูลล่าสุดทั้งหมด {items, locations, log}

async function apiCall(options) {
  if (!STOCK_CONFIG.API_URL) throw new Error("ยังไม่ได้ตั้ง API_URL ใน js/config.js (Deploy Code.gs ก่อน)");
  let res;
  try {
    res = await fetch(STOCK_CONFIG.API_URL, options);
  } catch (err) {
    throw new Error("เชื่อมต่อ Sheet ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่");
  }
  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new Error("Sheet ตอบกลับผิดรูปแบบ (ตรวจการ Deploy ของ Code.gs)");
  }
  if (json.error) throw new Error(json.error);
  return json.data;
}

function fetchState() {
  return apiCall({ method: "GET" });
}

/** body: {action, ...}; `by` (ผู้ทำรายการ) ใส่ให้อัตโนมัติ */
function postAction(body) {
  return apiCall({
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(Object.assign({ by: currentUser() }, body)),
  });
}

/** รายชื่อจาก CSV ที่ publish ไว้ (คอลัมน์แรก ข้ามหัวตาราง) */
async function fetchNames(urls) {
  const lists = await Promise.all(
    urls.map(async (u) => {
      try {
        const text = await (await fetch(u)).text();
        return text.split(/\r?\n/).slice(1).map((l) => l.split(",")[0].replace(/​/g, "").trim()).filter(Boolean);
      } catch (err) {
        return [];
      }
    }),
  );
  return [...new Set(lists.flat())];
}
