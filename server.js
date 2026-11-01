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

// Clave opcional para proteger la descarga del listado (?clave=...)
const ADMIN_KEY = process.env.ADMIN_KEY || "";

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

/* ---------- Descargar el listado (Excel) ---------- */
// Si definís ADMIN_KEY, hay que pasar ?clave=TU_CLAVE para descargar.
app.get("/api/listado", (req, res) => {
  if (ADMIN_KEY && req.query.clave !== ADMIN_KEY) {
    return res.status(401).send("No autorizado.");
  }
  if (!fs.existsSync(EXCEL_FILE)) {
    return res.status(404).send("Todavía no hay confirmaciones.");
  }
  res.download(EXCEL_FILE, "confirmaciones.xlsx");
});

/* ---------- Descargar el respaldo (CSV) ---------- */
app.get("/api/listado.csv", (req, res) => {
  if (ADMIN_KEY && req.query.clave !== ADMIN_KEY) {
    return res.status(401).send("No autorizado.");
  }
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
