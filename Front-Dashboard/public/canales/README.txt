ICONOS DE CANALES
=================

Coloca aqui los iconos de cada canal de ingreso de leads.
La carpeta public/ se sirve en la raiz "/", asi que la URL queda:

  Archivo en disco                 URL
  public/canales/whatsapp.png  ->  /canales/whatsapp.png

NOMBRES EXACTOS QUE ESPERA EL CODIGO
------------------------------------
Deben coincidir con las claves de CANAL_META en src/utils/domain.js
(todo en minusculas):

  store.png       (Odoo / tienda)
  whatsapp.png
  facebook.png
  instagram.png
  web.png
  tiktok.png
  youtube.png

RECOMENDACIONES
---------------
- PNG con fondo transparente, cuadrado (ej. 64x64 o 128x128).
- Mantener nombres en minusculas (el servidor distingue may/min).

PARA ACTIVARLOS
---------------
Una vez subidos los archivos, hay que cambiar las URLs remotas de
CANAL_META (en src/utils/domain.js) por las rutas locales /canales/<canal>.png.
Avisa y lo dejo cableado.
