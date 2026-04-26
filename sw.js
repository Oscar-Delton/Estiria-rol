const CACHE_NAME = 'estiria-v1';
const ASSETS = [
  '/',
    '/index.html',
      '/style.css',
        '/app.js',
          '/firebase-config.js',
            '/manifest.json'
            ];

            // Instalación — guarda los archivos en caché
            self.addEventListener('install', e => {
              e.waitUntil(
                  caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
                    );
                    });

                    // Activación — limpia cachés viejos
                    self.addEventListener('activate', e => {
                      e.waitUntil(
                          caches.keys().then(keys =>
                                Promise.all(
                                        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
                                              )
                                                  )
                                                    );
                                                    });

                                                    // Fetch — sirve desde caché si no hay internet
                                                    self.addEventListener('fetch', e => {
                                                      e.respondWith(
                                                          caches.match(e.request).then(cached => {
                                                                return cached || fetch(e.request);
                                                                    })
                                                                      );
                                                                      });const