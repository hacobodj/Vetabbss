# API PortalBBSS

Funciones serverless para Vercel:

- `/api/login` valida PIN.
- `/api/logout` cierra sesión.
- `/api/app` sirve el índice protegido.
- `/api/portal?view=proveedor|logistica|compliance` sirve las pantallas protegidas.
- `/api/ruc?numero=...` consulta RUC con sesión válida.
- `/api/dni?numero=...` consulta DNI con sesión válida.

Los tokens se configuran solo por variables de entorno en Vercel. No guardar tokens dentro de archivos del proyecto.
