# Alba

Aplicación personal de salud, entrenamiento y autocuidado. Es una PWA sin servidor ni cuentas: los datos se guardan en IndexedDB, en tu dispositivo.

## Publicarla gratis (GitHub Pages)
1. Crea una cuenta en github.com y un repositorio público llamado `alba`.
2. Pulsa "uploading an existing file" y sube el contenido de esta carpeta (que `index.html` quede en la raíz del repositorio).
3. En Settings > Pages, elige "Deploy from a branch", rama `main`, carpeta `/ (root)`, y guarda.
4. En un par de minutos tendrás la dirección `https://TU-USUARIO.github.io/alba/`, con HTTPS.

El repositorio público contiene el código, nunca tus registros. Cloudflare Pages o Netlify también sirven: basta con subir la carpeta.

## Instalarla en el iPhone
1. Abre la dirección en Safari.
2. Compartir > Añadir a pantalla de inicio > Añadir.
3. Abre Alba desde el icono y empieza ahí: Safari y la app instalada guardan los datos por separado.

## Copias de seguridad
Ajustes > Crear copia cifrada > Guardar en Archivos > iCloud Drive. La copia va cifrada (AES-256) con tu contraseña, que no se guarda: si la olvidas, no se puede abrir. Borrar la app borra sus datos. Alba guarda además 5 puntos de restauración diarios dentro del iPhone, sin fotos.

## Publicar una actualización
Sube los archivos cambiados y aumenta `VERSION` en `sw.js`. Tus datos no se tocan. Si cambias la estructura de la base de datos, sube `VERSION` en `js/db.js` y añade solo almacenes nuevos.

## Pruebas
`node --test tests/domain.test.mjs` y, con Playwright, `node tests/e2e.cjs`.

## Datos de referencia
Los alimentos de `js/data/foods.js` son valores típicos aproximados por 100 g o ml, escritos a mano, no análisis de laboratorio.
