/* ===================================================
   Servidor de la invitación · Santiago & Dahiana
   - Sirve los archivos estáticos (index.html, css, js)
   - Recibe confirmaciones de asistencia (POST /api/confirmar)
   - Las guarda en un Excel acumulativo + respaldo CSV
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
  "Cantidad de personas",
  "Mensaje",
];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir el sitio estático desde la carpeta del proyecto
app.use(express.static(__dirname));

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
  return filas;
}

// Escribe el array de filas al archivo Excel y al respaldo CSV.
function guardarFilas(filas) {
  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws["!cols"] = [
    { wch: 22 }, // Fecha
    { wch: 18 }, // Nombre
    { wch: 18 }, // Apellido
    { wch: 14 }, // Asistencia
    { wch: 20 }, // Cantidad
    { wch: 40 }, // Mensaje
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  XLSX.writeFile(wb, EXCEL_FILE);

  // Respaldo CSV (más resistente y fácil de recuperar)
  const csv = XLSX.utils.sheet_to_csv(ws);
  fs.writeFileSync(CSV_FILE, "\uFEFF" + csv, "utf8"); // BOM para acentos en Excel
}

/* ---------- Endpoint de confirmación ---------- */
app.post("/api/confirmar", (req, res) => {
  try {
    const nombre = String(req.body.nombre || "").trim();
    const apellido = String(req.body.apellido || "").trim();
    const asistenciaRaw = String(req.body.asistencia || "").trim().toLowerCase();
    const personas = String(req.body.personas || "").trim();
    const mensaje = String(req.body.mensaje || "").trim();

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

    const filas = leerFilas();
    filas.push([
      fecha,
      nombre,
      apellido,
      asistencia,
      asistenciaRaw === "si" ? personas : "0",
      mensaje,
    ]);
    guardarFilas(filas);

    const totalConfirmados = filas.length - 1; // sin encabezado
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
app.get(`/${ADMIN_PATH}`, (req, res) => {
  if (!fs.existsSync(EXCEL_FILE)) {
    return res.status(200).send(`
      <html><body style="font-family:sans-serif;padding:2rem">
        <h2>Listado de confirmaciones</h2>
        <p>Todavía no hay confirmaciones registradas.</p>
      </body></html>
    `);
  }

  const wb = XLSX.readFile(EXCEL_FILE);
  const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const total = filas.length - 1;
  const asisten = filas.slice(1).filter(f => f[3] === "Sí asiste").length;
  const noAsisten = filas.slice(1).filter(f => f[3] === "No asiste").length;
  const totalPersonas = filas.slice(1).reduce((acc, f) => acc + (parseInt(f[4]) || 0), 0);

  const filas_html = filas.map((fila, i) => {
    const cells = fila.map(cell => i === 0
      ? `<th style="background:#6b21a8;color:white;padding:8px 12px;text-align:left">${cell}</th>`
      : `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${cell}</td>`
    ).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Listado de invitados · Santiago & Dahiana</title>
      <style>
        body { font-family: sans-serif; padding: 2rem; background: #faf5ff; color: #1f2937; }
        h1 { color: #6b21a8; }
        .stats { display: flex; gap: 1.5rem; margin: 1.5rem 0; flex-wrap: wrap; }
        .stat { background: white; border-radius: 12px; padding: 1rem 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.1); min-width: 140px; }
        .stat .num { font-size: 2rem; font-weight: bold; color: #6b21a8; }
        .stat .label { font-size: .85rem; color: #6b7280; }
        table { border-collapse: collapse; width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
        tr:hover td { background: #f5f3ff; }
        .dl { margin-top: 1.5rem; display: flex; gap: 1rem; }
        .dl a { background: #6b21a8; color: white; padding: .6rem 1.2rem; border-radius: 8px; text-decoration: none; font-size: .9rem; }
        .dl a:hover { background: #7c3aed; }
      </style>
    </head>
    <body>
      <h1>💌 Invitados · Santiago & Dahiana</h1>
      <div class="stats">
        <div class="stat"><div class="num">${total}</div><div class="label">Respuestas totales</div></div>
        <div class="stat"><div class="num">${asisten}</div><div class="label">Confirman asistencia</div></div>
        <div class="stat"><div class="num">${noAsisten}</div><div class="label">No asisten</div></div>
        <div class="stat"><div class="num">${totalPersonas}</div><div class="label">Personas confirmadas</div></div>
      </div>
      <table><tbody>${filas_html}</tbody></table>
      <div class="dl">
        <a href="/${ADMIN_PATH}/excel">⬇ Descargar Excel</a>
        <a href="/${ADMIN_PATH}/csv">⬇ Descargar CSV</a>
      </div>
    </body>
    </html>
  `);
});

/* ---------- Descargar Excel ---------- */
app.get(`/${ADMIN_PATH}/excel`, (req, res) => {
  if (!fs.existsSync(EXCEL_FILE)) {
    return res.status(404).send("Todavía no hay confirmaciones.");
  }
  res.download(EXCEL_FILE, "confirmaciones.xlsx");
});

/* ---------- Descargar CSV ---------- */
app.get(`/${ADMIN_PATH}/csv`, (req, res) => {
  if (!fs.existsSync(CSV_FILE)) {
    return res.status(404).send("Todavía no hay confirmaciones.");
  }
  res.download(CSV_FILE, "confirmaciones.csv");
});

app.listen(PORT, () => {
  console.log("====================================================");
  console.log("  Invitación Santiago & Dahiana en marcha");
  console.log("  Abrí:    http://localhost:" + PORT);
  console.log("  Datos:   " + DATA_DIR);
  console.log("  Listado: http://localhost:" + PORT + "/api/listado");
  console.log("====================================================");
});
