/* ===================================================
   Servidor de la invitación · Santiago & Dahiana
   - Sirve los archivos estáticos (index.html, css, js)
   - Recibe confirmaciones de asistencia (POST /api/confirmar)
   - Las guarda en MongoDB (si hay MONGODB_URI) o en un Excel + CSV local
   =================================================== */

const express = require("express");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;

// Carpeta de datos. En hosting se puede apuntar a un disco persistente
// con la variable de entorno DATA_DIR. Por defecto, la carpeta del proyecto.
const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const EXCEL_FILE = path.join(DATA_DIR, "confirmaciones.xlsx");
const CSV_FILE = path.join(DATA_DIR, "confirmaciones.csv");
const SHEET_NAME = "Asistentes";

// Ruta secreta para ver el listado de invitados (sin clave en parámetro)
const ADMIN_PATH = process.env.ADMIN_PATH || "mis-invitados-santi";

// Encabezados de la planilla
const HEADERS = [
  "Fecha de registro",
  "Nombre",
  "Apellido",
  "Asistencia",
  "Mensaje",
];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir SOLO los archivos públicos del sitio. (No se expone toda la carpeta,
// para que nadie pueda bajar confirmaciones.xlsx, server.js, etc.)
const PUBLIC_FILES = ["index.html", "styles.css", "script.js"];
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
PUBLIC_FILES.forEach((f) => {
  app.get("/" + f, (req, res) => res.sendFile(path.join(__dirname, f)));
});

// Escapa texto antes de meterlo en HTML (evita inyección desde el formulario)
function esc(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- Utilidades de Excel / CSV ---------- */

// Lee las filas existentes (array de arrays), o devuelve solo los encabezados.
function leerFilas() {
  if (!fs.existsSync(EXCEL_FILE)) {
    return [HEADERS.slice()];
  }
  const wb = XLSX.readFile(EXCEL_FILE);
  const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (!filas.length) return [HEADERS.slice()];

  // Migración: si el archivo viejo tiene la columna "Cantidad de personas", se quita.
  const idx = filas[0].indexOf("Cantidad de personas");
  if (idx !== -1) {
    return filas.map((fila) => fila.filter((_, i) => i !== idx));
  }
  return filas;
}

// Arma la hoja de Excel a partir de un array de filas (con encabezado).
function construirLibro(filas) {
  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws["!cols"] = [
    { wch: 22 }, // Fecha
    { wch: 18 }, // Nombre
    { wch: 18 }, // Apellido
    { wch: 14 }, // Asistencia
    { wch: 40 }, // Mensaje
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  return { wb, ws };
}

// Escribe el array de filas al archivo Excel y al respaldo CSV (modo archivo).
function guardarFilas(filas) {
  const { wb, ws } = construirLibro(filas);
  XLSX.writeFile(wb, EXCEL_FILE);

  // Respaldo CSV (más resistente y fácil de recuperar)
  const csv = XLSX.utils.sheet_to_csv(ws);
  fs.writeFileSync(CSV_FILE, "\uFEFF" + csv, "utf8"); // BOM para acentos en Excel
}

/* ---------- Almacenamiento ----------
   - Con MONGODB_URI: las confirmaciones se guardan en MongoDB (persisten
     entre redeploys y reinicios en Render).
   - Sin MONGODB_URI: se guardan en confirmaciones.xlsx/csv (solo para
     desarrollo local; en Render ese disco se borra).                    */
const MONGODB_URI = process.env.MONGODB_URI || "";
let coleccion = null;

async function iniciarAlmacenamiento() {
  if (!MONGODB_URI) return;
  const { MongoClient } = require("mongodb");
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  coleccion = client
    .db(process.env.MONGODB_DB || "invitacion")
    .collection("confirmaciones");
  await coleccion.createIndex({ creado: 1 });
}

// Guarda una confirmación y devuelve el total de respuestas.
async function guardarConfirmacion(reg) {
  if (coleccion) {
    await coleccion.insertOne({ ...reg, creado: new Date() });
    return coleccion.countDocuments();
  }
  const filas = leerFilas();
  filas.push([reg.fecha, reg.nombre, reg.apellido, reg.asistencia, reg.mensaje]);
  guardarFilas(filas);
  return filas.length - 1;
}

// Devuelve todas las filas, con el encabezado en la primera posición.
async function listarFilas() {
  if (coleccion) {
    const docs = await coleccion.find({}).sort({ creado: 1 }).toArray();
    return [
      HEADERS.slice(),
      ...docs.map((d) => [d.fecha, d.nombre, d.apellido, d.asistencia, d.mensaje || ""]),
    ];
  }
  return leerFilas();
}

/* ---------- Endpoint de confirmación ---------- */
app.post("/api/confirmar", async (req, res) => {
  try {
    const nombre = String(req.body.nombre || "").trim().slice(0, 100);
    const apellido = String(req.body.apellido || "").trim().slice(0, 100);
    const asistenciaRaw = String(req.body.asistencia || "").trim().toLowerCase();
    const mensaje = String(req.body.mensaje || "").trim().slice(0, 500);

    if (!nombre || !apellido) {
      return res
        .status(400)
        .json({ ok: false, error: "Nombre y apellido son obligatorios." });
    }
    if (asistenciaRaw !== "si" && asistenciaRaw !== "no") {
      return res
        .status(400)
        .json({ ok: false, error: "Indicá si vas a asistir." });
    }

    const asistencia = asistenciaRaw === "si" ? "Sí asiste" : "No asiste";
    const fecha = new Date().toLocaleString("es-PY", {
      timeZone: "America/Asuncion",
    });

    const totalConfirmados = await guardarConfirmacion({
      fecha,
      nombre,
      apellido,
      asistencia,
      mensaje,
    });
    return res.json({
      ok: true,
      mensaje: "Confirmación registrada.",
      totalConfirmados,
    });
  } catch (err) {
    console.error("Error al guardar la confirmación:", err);
    return res
      .status(500)
      .json({ ok: false, error: "No se pudo guardar la confirmación." });
  }
});

/* ---------- Ver listado de invitados (ruta secreta) ---------- */
// Accedé con: https://tu-app.onrender.com/ADMIN_PATH
// Ejemplo por defecto: /mis-invitados-santi
app.get(`/${ADMIN_PATH}`, async (req, res) => {
  let filas;
  try {
    filas = await listarFilas();
  } catch (err) {
    console.error("Error al leer el listado:", err);
    return res.status(500).send("No se pudo leer el listado.");
  }
  const datos = filas.slice(1);

  const total = datos.length;
  const asisten = datos.filter(f => f[3] === "Sí asiste").length;
  const noAsisten = datos.filter(f => f[3] === "No asiste").length;

  const encabezado = "<tr>" + filas[0].map(c => `<th>${esc(c)}</th>`).join("") + "</tr>";
  const cuerpo = datos.map(fila => {
    const cells = fila.map((cell, i) => {
      if (i === 3) {
        const clase = cell === "Sí asiste" ? "ok" : "no";
        return `<td><span class="badge badge--${clase}">${esc(cell)}</span></td>`;
      }
      return `<td>${esc(cell)}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  const filas_html = encabezado + cuerpo;

  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Listado de invitados · Santiago & Dahiana</title>
      <style>
        :root { --gold:#b08d4e; --gold-dark:#8c6d35; --cream:#f7f1e6; --ink:#4a4036; --ink-soft:#6b5f50; }
        * { box-sizing: border-box; }
        body { font-family: Georgia, "Times New Roman", serif; margin: 0; padding: 2rem 1.2rem; background: var(--cream); color: var(--ink); }
        .wrap { max-width: 980px; margin: 0 auto; }
        h1 { text-align: center; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; font-size: clamp(1.3rem, 4vw, 2rem); color: var(--gold-dark); margin: 0 0 .3rem; }
        .sub { text-align: center; color: var(--ink-soft); font-style: italic; margin: 0 0 1.6rem; }
        .stats { display: flex; gap: 1rem; margin: 0 0 1.6rem; flex-wrap: wrap; justify-content: center; }
        .stat { flex: 1 1 150px; max-width: 220px; background: #fff; border: 1px solid rgba(176,141,78,.35); border-radius: 14px; padding: 1rem 1.2rem; text-align: center; box-shadow: 0 8px 22px rgba(74,64,54,.08); }
        .stat .num { font-size: 2.2rem; font-weight: 600; color: var(--gold-dark); line-height: 1.1; }
        .stat .label { font-size: .8rem; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); }
        .table-wrap { overflow-x: auto; background: #fff; border: 1px solid rgba(176,141,78,.35); border-radius: 14px; box-shadow: 0 8px 22px rgba(74,64,54,.08); }
        table { border-collapse: collapse; width: 100%; font-family: system-ui, sans-serif; font-size: .92rem; }
        th { background: var(--gold); color: #fff; text-align: left; padding: 10px 14px; font-weight: 600; white-space: nowrap; }
        td { padding: 10px 14px; border-bottom: 1px solid #efe6d4; }
        tr:last-child td { border-bottom: 0; }
        tbody tr:hover td { background: #fbf7ef; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: .8rem; font-weight: 600; white-space: nowrap; }
        .badge--ok { background: #e4efe0; color: #3f6b35; }
        .badge--no { background: #f5e1de; color: #a1423a; }
        .empty { text-align: center; padding: 1.6rem; color: var(--ink-soft); font-style: italic; }
        .dl { margin-top: 1.5rem; display: flex; gap: .8rem; justify-content: center; flex-wrap: wrap; }
        .dl a { border: 1.5px solid var(--gold); color: var(--gold-dark); padding: .55rem 1.3rem; border-radius: 999px; text-decoration: none; font-family: system-ui, sans-serif; font-size: .88rem; font-weight: 600; }
        .dl a:hover { background: var(--gold); color: #fff; }
      </style>
    </head>
    <body>
     <div class="wrap">
      <h1>Invitados</h1>
      <p class="sub">Santiago &amp; Dahiana · 19 de diciembre de 2026</p>
      <div class="stats">
        <div class="stat"><div class="num">${total}</div><div class="label">Respuestas</div></div>
        <div class="stat"><div class="num">${asisten}</div><div class="label">Asisten</div></div>
        <div class="stat"><div class="num">${noAsisten}</div><div class="label">No asisten</div></div>
      </div>
      <div class="table-wrap">
        <table>${filas_html}</table>
        ${total === 0 ? '<p class="empty">Todavía no hay confirmaciones.</p>' : ""}
      </div>
      <div class="dl">
        <a href="/${ADMIN_PATH}/excel">⬇ Descargar Excel</a>
        <a href="/${ADMIN_PATH}/csv">⬇ Descargar CSV</a>
      </div>
     </div>
    </body>
    </html>
  `);
});

/* ---------- Descargar Excel ---------- */
app.get(`/${ADMIN_PATH}/excel`, async (req, res) => {
  try {
    const filas = await listarFilas();
    if (filas.length < 2) return res.status(404).send("Todavía no hay confirmaciones.");
    const { wb } = construirLibro(filas);
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="confirmaciones.xlsx"',
    });
    res.send(buf);
  } catch (err) {
    console.error("Error al generar el Excel:", err);
    res.status(500).send("No se pudo generar el Excel.");
  }
});

/* ---------- Descargar CSV ---------- */
app.get(`/${ADMIN_PATH}/csv`, async (req, res) => {
  try {
    const filas = await listarFilas();
    if (filas.length < 2) return res.status(404).send("Todavía no hay confirmaciones.");
    const { ws } = construirLibro(filas);
    const csv = "\uFEFF" + XLSX.utils.sheet_to_csv(ws); // BOM para acentos en Excel
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="confirmaciones.csv"',
    });
    res.send(csv);
  } catch (err) {
    console.error("Error al generar el CSV:", err);
    res.status(500).send("No se pudo generar el CSV.");
  }
});

// Escucha en todas las interfaces (0.0.0.0) para poder entrar desde otros
// dispositivos de la misma red (celular, tablet, otra PC).
function iniciarServidor() {
  app.listen(PORT, "0.0.0.0", () => {
  const redes = require("os").networkInterfaces();
  const ips = [];
  Object.keys(redes).forEach((n) =>
    redes[n].forEach((i) => {
      if (i.family === "IPv4" && !i.internal) ips.push(i.address);
    })
  );
  console.log("====================================================");
  console.log("  Invitación Santiago & Dahiana en marcha");
  console.log("  Abrí:    http://localhost:" + PORT);
  ips.forEach((ip) => console.log("  En red:  http://" + ip + ":" + PORT));
  console.log(
    "  Datos:   " + (coleccion ? "MongoDB (persistente)" : "archivo local " + DATA_DIR)
  );
  console.log("  Listado: http://localhost:" + PORT + "/" + ADMIN_PATH);
  console.log("====================================================");
  });
}

// Arranque: conecta el almacenamiento y luego levanta el servidor.
// Si MONGODB_URI está definida y falla la conexión, se corta con error
// (mejor eso que guardar en un disco que Render borra sin avisar).
(async () => {
  try {
    await iniciarAlmacenamiento();
    // Modo archivo: actualiza el Excel existente al formato actual
    if (!coleccion && fs.existsSync(EXCEL_FILE)) guardarFilas(leerFilas());
  } catch (err) {
    console.error("No se pudo iniciar el almacenamiento:", err.message);
    process.exit(1);
  }
  iniciarServidor();
})();
