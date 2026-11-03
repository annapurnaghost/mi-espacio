# Mi espacio (PWA)

Archivos: index.html, manifest.json, sw.js, icons/, splash/. Sube la carpeta tal cual a un hosting HTTPS.

GitHub Pages: nuevo repositorio publico > Add file > Upload files (arrastra el contenido de la carpeta) > Settings > Pages > Deploy from a branch > main / (root). URL: https://TU-USUARIO.github.io/NOMBRE-REPO/

Cloudflare Pages: Workers & Pages > Create > Pages > Upload assets > arrastra la carpeta > Deploy. URL: https://NOMBRE.pages.dev

Instalar: abre la URL en Safari > Compartir > Anadir a pantalla de inicio. Abre la app desde el icono (sus datos son independientes de los de Safari).
Actualizar: cambia V='mi-espacio-v1' por v2 en sw.js, sube los archivos y abre la app dos veces.
Push con la app cerrada: requiere servidor (Cloudflare Worker + claves VAPID + suscripcion Web Push). sw.js ya incluye el manejador 'push'.
