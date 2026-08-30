// ==============================================================================
// 정수와진하 - 백그라운드 푸시 알림 서비스워커
// 사이트를 닫아두거나 폰 화면을 꺼둔 상태에서도 이 파일이 알림을 받아 화면에 띄워준다.
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

// 사이트가 닫혀 있거나 다른 탭을 보고 있을 때(백그라운드) 도착하는 알림을 처리한다.
messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const title = notification.title || '💖 정수와진하';
  const options = {
    body: notification.body || '새로운 정보가 추가되었습니다. 확인해주세요!',
    tag: 'jeongsu-jinha-update', // 같은 태그면 알림이 쌓이지 않고 최신 것으로 교체됨
    data: { url: (payload.fcmOptions && payload.fcmOptions.link) || (payload.webpush && payload.webpush.fcm_options && payload.webpush.fcm_options.link) || '/' }
  };
  self.registration.showNotification(title, options);
});

// 알림을 눌렀을 때 사이트(또는 관련 링크)를 열어준다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
