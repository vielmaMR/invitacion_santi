# Invitación de boda · Santiago & Dahiana

Invitación digital de boda con confirmación de asistencia que se guarda en un Excel.

## Requisitos
- [Node.js](https://nodejs.org) (ya instalado: v24).

## Cómo usarla

1. Abrí una terminal en esta carpeta.
2. La primera vez, instalá las dependencias:
   ```
   npm install
   ```
3. Iniciá el servidor:
   ```
   npm start
   ```
4. Abrí en el navegador: **http://localhost:3000**

## Confirmaciones de asistencia

- Cada vez que alguien completa el formulario y confirma, se guarda una fila
  en el archivo **`confirmaciones.xlsx`** (se crea solo con la primera confirmación).
- Columnas del listado: Fecha de registro · Nombre · Apellido · Asistencia ·
  Cantidad de personas · Mensaje.
- Para descargar/ver el listado desde el navegador:
  **http://localhost:3000/api/listado**
- También podés abrir directamente el archivo `confirmaciones.xlsx` con Excel.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Estructura de la invitación |
| `styles.css` | Estilos (estética clásica dorado/crema) |
| `script.js` | Countdown, animaciones y envío del formulario |
| `server.js` | Servidor que guarda las confirmaciones en el Excel |
| `confirmaciones.xlsx` | Listado de asistentes (se genera solo) |

## Datos para editar

- **Novios, fecha y lugares:** en `index.html`.
- **Fecha del countdown:** constante `WEDDING_DATE` en `script.js`.
- **Datos bancarios para regalos:** sección `.gifts__box` en `index.html` (ahora con guiones).

---

## Publicar en internet (para que confirmen desde el celular)

La invitación necesita el servidor Node corriendo. Para que esté en línea 24/7
podés usar **Render** (tiene plan gratis). Pasos:

### 1. Subir el proyecto a GitHub
1. Creá una cuenta en [github.com](https://github.com) y un repositorio nuevo (vacío).
2. En una terminal, dentro de esta carpeta:
   ```
   git init
   git add .
   git commit -m "Invitación Santiago y Dahiana"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```

### 2. Desplegar en Render
1. Creá una cuenta en [render.com](https://render.com) (podés entrar con GitHub).
2. **New** → **Web Service** → conectá tu repositorio.
3. Render detecta el archivo `render.yaml` y completa la configuración solo:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. En **Environment**, cambiá la variable `ADMIN_KEY` por una clave tuya
   (la vas a usar para descargar el listado).
5. **Create Web Service**. En unos minutos te da una URL pública tipo
   `https://invitacion-santi-dahiana.onrender.com`.

Esa URL es la que compartís con los invitados.

### 3. Ver el listado de asistentes (ya publicado)
- Excel: `https://TU-URL.onrender.com/api/listado?clave=TU_CLAVE`
- CSV:   `https://TU-URL.onrender.com/api/listado.csv?clave=TU_CLAVE`

(Reemplazá `TU_CLAVE` por el valor que pusiste en `ADMIN_KEY`.)

### ⚠️ Importante sobre el guardado en la nube
- En el **plan gratuito** de Render el disco es **efímero**: si el servicio se
  reinicia (pasa tras inactividad), el `confirmaciones.xlsx` puede perderse.
- Por eso el servidor guarda **también un respaldo CSV** y conviene
  **descargar el listado cada cierto tiempo**.
- Para que NO se pierda nunca, en Render podés contratar un **disco persistente**
  (de pago). El `render.yaml` ya lo tiene configurado en `/var/data`; si usás el
  plan free, ignorá/comentá ese bloque.
- Alternativa sin preocupaciones: conectar las confirmaciones a **Google Sheets**
  en vez de un archivo local. Avisame si preferís esa opción y lo armo.

## Variables de entorno (opcionales)
| Variable | Para qué sirve | Ejemplo |
|---|---|---|
| `PORT` | Puerto del servidor (lo asigna el hosting) | `3000` |
| `DATA_DIR` | Carpeta donde se guardan Excel y CSV | `/var/data` |
| `ADMIN_KEY` | Clave para descargar el listado | `mi-clave-secreta` |
