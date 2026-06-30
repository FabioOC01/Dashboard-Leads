FOTOS DE VENDEDORES
===================

Coloca aquí las fotos de cada vendedor. Luego, en el Dashboard:
  Admin (candado) -> "Gestionar vendedores" -> campo "URL de foto"
y pega la ruta local del archivo.

CONVENCION DE NOMBRES (recomendado)
-----------------------------------
- Usa el nombre del vendedor en minusculas, sin tildes ni espacios.
- Separa nombre y apellido con guion.
- Formato .jpg o .png, idealmente cuadrada (ej. 400x400) para que el
  avatar circular se vea bien.

Ejemplos de archivo:
  juan-perez.jpg
  maria-quispe.png
  luis-torres.jpg

COMO REFERENCIARLAS EN EL MODAL
-------------------------------
La carpeta public/ se sirve en la raiz "/", asi que la URL a pegar es:

  Archivo en disco                         URL a pegar en el modal
  public/vendedores/juan-perez.jpg    ->   /vendedores/juan-perez.jpg
  public/vendedores/maria-quispe.png  ->   /vendedores/maria-quispe.png

NOTA: el servidor distingue mayusculas/minusculas. Manten todo en
minusculas para evitar que la imagen no cargue en produccion.
