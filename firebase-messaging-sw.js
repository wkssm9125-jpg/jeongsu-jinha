// ==============================================================================
// 정수와진하 - 백그라운드 푸시 알림 서비스워커
// 사이트를 닫아두거나 폰 화면을 꺼둔 상태에서도 이 파일이 알림을 받아 화면에 띄워준다.
// (2026-11 추가) 사이트 화면을 폰에 저장해 두어 다음부터 바로 열리게 하는 캐시 역할도 같이 한다.
// 반드시 index.html과 같은 위치(사이트 루트)에 "firebase-messaging-sw.js" 라는 이름 그대로 올려야 한다.
// ==============================================================================

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// 아래 값들은 index.html 안의 firebaseConfig와 반드시 똑같아야 한다.
// (index.html에서 채워 넣은 값을 그대로 여기에도 복사해 붙여넣기)
firebase.initializeApp({
  apiKey: "AIzaSyC3dZzHlFkRECsrZrHnMv_5wrlqS5CbdIo",
  authDomain: "js-jh-2d166.firebaseapp.com",
  projectId: "js-jh-2d166",
  storageBucket: "js-jh-2d166.firebasestorage.app",
  messagingSenderId: "144540756511",
  appId: "1:144540756511:web:0b7971a04eca72499e432a"
});

const messaging = firebase.messaging();

// ------------------------------------------------------------------
// 알림 내역 저장소 (IndexedDB) — index.html의 것과 이름/구조가 반드시 똑같아야
// 나중에 사이트를 열었을 때 "🕘 알림 내역" 화면에서 이 기록을 같이 읽을 수 있다.
// ------------------------------------------------------------------
const PUSH_HISTORY_DB_NAME = 'jeongsu_jinha_push_history';
const PUSH_HISTORY_STORE = 'notifications';

function openPushHistoryDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PUSH_HISTORY_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PUSH_HISTORY_STORE)) {
        db.createObjectStore(PUSH_HISTORY_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// type/targetId: 알림 내역에서 이 항목을 눌렀을 때 앱 안에서 어디로 이동할지 알려주는 정보.
// index.html의 savePushHistory와 반드시 같은 구조로 저장해야 나중에 "알림 내역" 화면에서 같이 보인다.
async function savePushHistory(title, body, type, targetId) {
  try {
    const db = await openPushHistoryDB();
    const tx = db.transaction(PUSH_HISTORY_STORE, 'readwrite');
    tx.objectStore(PUSH_HISTORY_STORE).add({ title, body, type: type || '', targetId: targetId || '', time: Date.now() });
  } catch(e) {}
}

// 사이트가 닫혀 있거나 다른 탭을 보고 있을 때(백그라운드) 도착하는 알림을 처리한다.
messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || '💖 정수와진하';
  const body = notification.body || '새로운 정보가 추가되었습니다. 확인해주세요!';
  savePushHistory(title, body, data.type, data.targetId); // 사이트를 다시 열었을 때 "알림 내역"에서 볼 수 있도록 기록
  // ⚠️ 알림 내용(notification)이 실린 메시지는 Firebase가 이미 알림을 띄운다.
  //    예전엔 여기서 한 번 더 띄워서 알림이 두 개씩 왔다 → 내용이 없는(데이터만 있는) 메시지일 때만 직접 띄운다.
  if (payload.notification) return;
  const options = {
    body: body,
    // 알림마다 다른 태그를 써서 쌓이게 하고, 혹시 같은 태그로 교체되더라도 다시 울리도록(renotify) 한다.
    // (안드로이드는 같은 태그의 알림이 교체될 때 renotify가 없으면 소리·진동 없이 조용히 바뀐다)
    tag: 'jeongsu-jinha-' + Date.now(),
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: (payload.fcmOptions && payload.fcmOptions.link) || (payload.webpush && payload.webpush.fcm_options && payload.webpush.fcm_options.link) || '/', type: data.type || '', targetId: data.targetId || '' }
  };
  return self.registration.showNotification(title, options);
});

// 알림을 눌렀을 때 사이트를 열어주되, 그냥 홈으로 가는 게 아니라 이 알림이 알려준 항목(추억/쪽지/채팅 등)으로
// 바로 이동하도록 targetUrl에 "?ptype=...&ptarget=..." 이 실려 있다 (code.gs가 만들어 보냄).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          // 이미 열려 있던 탭이면 그 탭을 새 이동 정보가 담긴 주소로 새로고침해서 해당 항목을 열어준다
          if ('navigate' in client) return client.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});


// ==============================================================================
// ⚡ 앱 화면 저장(오프라인 캐시) — 두 번째 방문부터 화면이 네트워크를 기다리지 않고 바로 뜬다.
//  - 사이트 화면(index.html): 저장본을 즉시 보여주고, 뒤에서 최신본을 받아 교체 (바뀌었으면 화면에 "새 버전" 안내)
//  - 폰트/알림 모듈처럼 주소에 버전이 박힌 파일: 한 번 받으면 계속 저장본 사용
//  - 서버 데이터(Apps Script)와 사진은 건드리지 않는다 (항상 최신)
// ==============================================================================
const SHELL_CACHE = "jj-shell-v1";
const STATIC_CACHE = "jj-static-v1";
const SCOPE_URL = new URL("./", self.location).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(["./", "./manifest.json", "./icon-192.png"]))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = [SHELL_CACHE, STATIC_CACHE];
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith("jj-") && keep.indexOf(n) === -1).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function notifyClientsUpdated(version) {
  const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  list.forEach((c) => c.postMessage({ type: "jj-update-available", version: version || "" }));
}

// 화면 파일 안의 <meta name="jj-version" content="..."> 로 버전을 비교한다.
// (GitHub Pages는 여러 서버에 복사본을 두고 최대 10분쯤 예전 복사본을 줄 수 있어서, 비교 없이 덮어쓰면
//  새 버전을 받았다가 다시 예전 버전으로 되돌아가는 일이 생겼다 → 더 높은 버전일 때만 저장)
async function versionOf(res) {
  try { const t = await res.clone().text(); const m = t.match(/<meta name="jj-version" content="([^"]+)"/); return m ? m[1] : ""; }
  catch (e) { return ""; }
}
let lastNotified = "";
async function fetchLatestShell() {
  // 주소 뒤에 매번 다른 값을 붙여 중간 서버(CDN)의 예전 복사본을 건너뛰고 최신 파일을 받는다
  const res = await fetch(SCOPE_URL + "?_sw=" + Date.now(), { cache: "no-store" });
  if (!res || !res.ok || res.type !== "basic") throw new Error("shell fetch " + (res && res.status));
  return res;
}
async function refreshShell(cached) {
  const cache = await caches.open(SHELL_CACHE);
  const res = await fetchLatestShell();
  const newV = await versionOf(res);
  const oldV = cached ? await versionOf(cached) : "";
  if (!cached || !oldV || (newV && newV > oldV)) {
    await cache.put("./", res.clone());
    if (cached && newV && newV !== lastNotified) { lastNotified = newV; notifyClientsUpdated(newV); }
  }
  return res;
}
async function handleNavigation(event) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match("./");
  if (cached) {
    // 화면에 돌려줄 응답과 버전 비교용 응답을 따로 둔다 (같은 응답을 두 번 읽으면 비교가 실패해 예전 버전으로 덮어쓰였다)
    const forCheck = cached.clone();
    event.waitUntil(refreshShell(forCheck).catch(() => {}));
    return cached;
  }
  try { return await refreshShell(null); }
  catch (e) { try { return await fetch(event.request); } catch (e2) { return Response.error(); } }
}
// 화면이 "업데이트 확인해 줘"라고 하면 (앱으로 돌아왔을 때 등) 바로 확인
self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "jj-check-update") return;
  const clientV = event.data.version || "";
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try { await refreshShell(await cache.match("./")); } catch (e) {}
    const latest = await cache.match("./");
    const v = latest ? await versionOf(latest) : "";
    // 지금 화면보다 새 버전이 저장돼 있으면 그 화면에 알려준다
    if (v && clientV && v > clientV && event.source) event.source.postMessage({ type: "jj-update-available", version: v });
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 사이트 화면 (주소 뒤 ?ptype=... 같은 값은 무시하고 같은 화면 저장본 사용)
  if (req.mode === "navigate" && req.url.startsWith(SCOPE_URL) && url.pathname.replace(/index\.html$/, "") === new URL(SCOPE_URL).pathname) {
    event.respondWith(handleNavigation(event));
    return;
  }

  // 버전이 고정된 외부 파일 (폰트, Firebase SDK) + 아이콘
  const isStatic = url.hostname === "cdn.jsdelivr.net" || url.hostname === "www.gstatic.com" ||
    (req.url.startsWith(SCOPE_URL) && /\.(png|json)$/.test(url.pathname) && !/firebase-messaging-sw/.test(url.pathname));
  if (isStatic) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {});
      return res;
    })());
  }
  // 그 외(Apps Script 데이터, 구글 드라이브 사진 등)는 서비스워커가 관여하지 않는다
});
