const CACHE_NAME = 'oooooo-v8';
const FONT_CACHE_NAME = 'oooooo-fonts-v1';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keepCaches = [CACHE_NAME, FONT_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keepCaches.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/*
 * خطوط جوجل (Tajawal / Cairo): بنستخدم stale-while-revalidate — أول مرة بس بتتحمّل
 * من الإنترنت، وبعدها بتتقرأ فورًا من كاش الجهاز (من غير أي استنى على الشبكة)
 * مع تحديث هادئ في الخلفية لو فيه نسخة أحدث. ده بيسرّع ظهور النص بشكل واضح
 * خصوصًا على نت بطيء، ومفيهوش أي تأثير على باقي التطبيق.
 */
function isFontRequest(url){
  return url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com');
}

self.addEventListener('fetch', (event) => {
  if (isFontRequest(event.request.url)) {
    event.respondWith(
      caches.open(FONT_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request).then((response) => {
          if (response && response.ok) cache.put(event.request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }
  /*
   * لطلبات التنقّل (فتح/تحديث الصفحة الرئيسية index.html): نحاول النت الأول
   * دايمًا عشان أي تحديث جديد للتطبيق يظهر فورًا، ونرجع للكاش بس لو مفيش نت
   * (network-first). ده بيمنع مشكلة إن نسخة قديمة/بايظة تفضل عالقة في الكاش
   * للأبد حتى بعد نشر تحديث جديد.
   */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

/* لما المستخدم يدوس على إشعار: نفتح التطبيق أو نرجّعه للواجهة لو كان مفتوح بالفعل */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});

/*
 * دعم إشعارات الدفع (Push) جاهز هنا لو حبيت تربط الموقع بسيرفر إشعارات حقيقي مستقبلًا
 * (يحتاج مفاتيح VAPID وسيرفر backend يبعت الإشعارات حتى لو التطبيق مقفول تمامًا).
 * حاليًا لا يوجد سيرفر يبعت Push، فالإشعارات الحالية بتتولّد من داخل صفحة التطبيق نفسها
 * وبتشتغل وهو مفتوح أو شغال في الخلفية على جهاز المستخدم.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch (e) { payload = { title: 'تن', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'تن', {
      body: payload.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: payload.data || {}
    })
  );
});
