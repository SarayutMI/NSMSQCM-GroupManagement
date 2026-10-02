// สแกนบาร์โค้ด / QR ด้วยกล้อง
// - ใช้ BarcodeDetector ของ browser ถ้ามี (Chrome/Edge บน Android, Windows, macOS)
// - ถ้าไม่มี (เช่น Safari บน iPhone/iPad) โหลด ZXing จาก CDN มาอ่านแทน
// - กล้องใช้ได้เฉพาะหน้าเว็บ https (GitHub Pages ผ่าน) และต้องกดอนุญาตกล้องครั้งแรก
// - เครื่องสแกนแบบยิง (USB/Bluetooth) ไม่ต้องใช้หน้านี้: ยิงใส่ช่องค้นหา/ช่องบาร์โค้ดได้เลย

const ZXING_URL = "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js";
const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "codabar", "itf", "qr_code", "data_matrix"];

const Scanner = (() => {
  let box, video, msg, manual, stream, zxControls, timer, onCode, done;

  function build() {
    if (box) return;
    box = document.createElement("div");
    box.className = "scanner";
    box.hidden = true;
    box.innerHTML = `
      <div class="scanner-card">
        <div class="scanner-head"><b>📷 สแกนบาร์โค้ด</b><button type="button" class="x" data-scan-close aria-label="ปิด">✕</button></div>
        <div class="scanner-view">
          <video playsinline muted autoplay></video>
          <div class="scanner-frame"><span></span></div>
        </div>
        <div class="scanner-msg">กำลังเปิดกล้อง...</div>
        <form class="scanner-manual">
          <input inputmode="numeric" placeholder="หรือพิมพ์ / ยิงเลขบาร์โค้ดที่นี่" autocomplete="off" />
          <button class="btn btn-primary" type="submit">ตกลง</button>
        </form>
      </div>`;
    document.body.appendChild(box);
    video = box.querySelector("video");
    msg = box.querySelector(".scanner-msg");
    manual = box.querySelector(".scanner-manual input");
    box.querySelector("[data-scan-close]").addEventListener("click", close);
    box.addEventListener("click", (e) => {
      if (e.target === box) close();
    });
    box.querySelector(".scanner-manual").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = manual.value.trim();
      if (v) found(v);
    });
  }

  function stop() {
    cancelAnimationFrame(timer);
    clearTimeout(timer);
    if (zxControls) {
      try {
        zxControls.stop();
      } catch (e) {
        /* already stopped */
      }
      zxControls = null;
    }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    if (video) video.srcObject = null;
  }

  function close() {
    stop();
    if (box) box.hidden = true;
    document.body.classList.remove("scanner-open");
    done = true;
  }

  function found(code) {
    if (done) return;
    done = true;
    if (navigator.vibrate) navigator.vibrate(80);
    const cb = onCode;
    close();
    cb(String(code).trim());
  }

  function loadZxing() {
    if (window.ZXingBrowser) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = ZXING_URL;
      s.onload = resolve;
      s.onerror = () => reject(new Error("โหลดตัวอ่านบาร์โค้ดไม่สำเร็จ (ตรวจอินเทอร์เน็ต)"));
      document.head.appendChild(s);
    });
  }

  async function nativeDetector() {
    if (!("BarcodeDetector" in window)) return null;
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
      return formats.length ? new BarcodeDetector({ formats }) : null;
    } catch (e) {
      return null;
    }
  }

  function cameraError(err) {
    if (!window.isSecureContext) return "ต้องเปิดหน้านี้ผ่าน https (เช่น GitHub Pages) จึงจะใช้กล้องได้";
    if (err && err.name === "NotAllowedError") return "ไม่ได้รับอนุญาตให้ใช้กล้อง — กดไอคอนกล้อง/แม่กุญแจที่แถบที่อยู่เว็บ แล้วอนุญาตกล้อง";
    if (err && (err.name === "NotFoundError" || err.name === "OverconstrainedError")) return "ไม่พบกล้องในเครื่องนี้";
    if (err && err.name === "NotReadableError") return "กล้องถูกใช้งานโดยแอปอื่นอยู่ ปิดแอปนั้นแล้วลองใหม่";
    return "เปิดกล้องไม่ได้: " + ((err && err.message) || err);
  }

  /** เปิดหน้าสแกน แล้วเรียก cb(code) เมื่ออ่านได้ (หรือพิมพ์เอง) */
  async function open(cb, title) {
    build();
    onCode = cb;
    done = false;
    box.querySelector(".scanner-head b").textContent = "📷 " + (title || "สแกนบาร์โค้ด");
    manual.value = "";
    msg.textContent = "กำลังเปิดกล้อง...";
    box.hidden = false;
    document.body.classList.add("scanner-open");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      msg.textContent = cameraError(new Error("browser นี้ไม่รองรับกล้อง")) + " — พิมพ์เลขด้านล่างแทนได้";
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (err) {
      msg.textContent = cameraError(err) + " — พิมพ์เลขด้านล่างแทนได้";
      return;
    }
    if (done) return stop(); // ปิดไปก่อนกล้องพร้อม
    video.srcObject = stream;
    await video.play().catch(() => {});
    msg.textContent = "เล็งบาร์โค้ดให้อยู่ในกรอบ";

    const detector = await nativeDetector();
    if (detector) {
      const tick = async () => {
        if (done) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length) return found(codes[0].rawValue);
        } catch (e) {
          /* frame not ready yet */
        }
        timer = setTimeout(tick, 120);
      };
      tick();
      return;
    }
    try {
      await loadZxing();
      if (done) return;
      const reader = new ZXingBrowser.BrowserMultiFormatReader();
      zxControls = await reader.decodeFromVideoElement(video, (result) => {
        if (result) found(result.getText());
      });
    } catch (err) {
      msg.textContent = err.message + " — พิมพ์เลขด้านล่างแทนได้";
    }
  }

  return { open, close };
})();
