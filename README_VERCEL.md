# PortalBBSS - despliegue Vercel

## Estructura final

- `index.html`: login simple tipo PIN, estándar VetaDorada.
- `/api/login`: valida el PIN en servidor y crea cookie `HttpOnly`.
- `/app`: índice protegido con las tres secciones del Portal BBSS.
- `/portal/proveedor`: vista protegida de Proveedor.
- `/portal/logistica`: vista protegida de Logística.
- `/portal/compliance`: vista protegida de Compliance.
- `/api/ruc` y `/api/dni`: consultas protegidas por sesión.
- `api/_private_files/`: HTML internos. No quedan publicados como archivos estáticos raíz.

## PIN de acceso

Por defecto queda:

```txt
vetadoradaBBSS
```

Para producción, configura en Vercel:

```txt
BBSS_PIN=vetadoradaBBSS
BBSS_SESSION_SECRET=coloca-un-secreto-largo-privado-y-unico
RUC_API_TOKEN=tu-token-real
DNI_API_TOKEN=tu-token-real
```

Opcionales:

```txt
RUC_API_URL=https://api.apis.net.pe/v1/ruc
DNI_API_URL=https://api.apis.net.pe/v1/dni
BBSS_API_TOKEN=token-compartido-si-usas-el-mismo-para-ruc-y-dni
```

## Publicación

1. Sube esta carpeta o este ZIP a Vercel.
2. Agrega las variables de entorno indicadas.
3. Deploy.
4. Entra por la URL principal del proyecto.
5. El acceso redirige a `/app` cuando el PIN es correcto.

## Importante

No abras `index.html` como archivo local para probar seguridad. El login necesita `/api/login`, por eso debe probarse en Vercel o con `vercel dev`.

Los archivos internos no se abren directo como `/Proveedor_BBSS.html`, `/Logistica_BBSS.html` o `/Compliance_BBSS.html`; se sirven por rutas protegidas.
