// Backup diario de Control Económico a Google Drive.
// Corre desde GitHub Actions (ver .github/workflows/backup-diario.yml), no desde la app.
// Necesita 5 variables de entorno (configuradas como secrets del repo en GitHub):
//   SUPABASE_SERVICE_ROLE_KEY - Project Settings > API > "service_role" en Supabase
//   GDRIVE_FOLDER_ID          - ID de la carpeta de Drive destino
//   GDRIVE_OAUTH_CLIENT_ID     \
//   GDRIVE_OAUTH_CLIENT_SECRET  > credenciales OAuth (autentican como el usuario dueño de la carpeta,
//   GDRIVE_OAUTH_REFRESH_TOKEN /  no como una cuenta de servicio: esas no tienen cuota en Drive normal)
import { google } from 'googleapis';

const SUPABASE_URL = 'https://ssfbamnomyjkuixqzxok.supabase.co';
const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const GDRIVE_FOLDER_ID = requireEnv('GDRIVE_FOLDER_ID');
const GDRIVE_OAUTH_CLIENT_ID = requireEnv('GDRIVE_OAUTH_CLIENT_ID');
const GDRIVE_OAUTH_CLIENT_SECRET = requireEnv('GDRIVE_OAUTH_CLIENT_SECRET');
const GDRIVE_OAUTH_REFRESH_TOKEN = requireEnv('GDRIVE_OAUTH_REFRESH_TOKEN');

// Mismas tablas (y en el mismo orden) que TABLAS_BACKUP en app.js: así el archivo se puede restaurar
// desde la pestaña Administración (de a una familia). Un test chequea que las dos listas coincidan.
// Con la service role key se leen todas las familias (se saltea RLS).
const TABLAS = ['familias', 'miembros', 'centros', 'categorias', 'subcategorias', 'movimientos', 'vencimientos', 'deudas',
  'usdt_movimientos', 'facturas', 'reglas_categorizacion', 'familia_config'];
// Columna para ordenar al paginar (sin un orden fijo, las páginas pueden repetir o saltear filas).
const CLAVE_ORDEN = { miembros: 'user_id', familia_config: 'familia_id.asc,clave' };
// Supabase devuelve como máximo 1000 filas por request: hay que pedirlas de a páginas.
const TAM_PAGINA = 1000;

function requireEnv(nombre) {
  var valor = process.env[nombre];
  if (!valor) throw new Error('Falta la variable de entorno ' + nombre);
  return valor;
}

async function leerTabla(nombre) {
  var filas = [];
  var orden = CLAVE_ORDEN[nombre] || 'id';
  for (var desde = 0; ; desde += TAM_PAGINA) {
    var url = SUPABASE_URL + '/rest/v1/' + nombre + '?select=*&order=' + orden + '.asc' +
      '&limit=' + TAM_PAGINA + '&offset=' + desde;
    var res = await fetch(url, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: 'Bearer ' + SERVICE_ROLE_KEY
      }
    });
    if (!res.ok) {
      throw new Error('No se pudo leer "' + nombre + '": ' + res.status + ' ' + (await res.text()));
    }
    var pagina = await res.json();
    filas = filas.concat(pagina);
    if (pagina.length < TAM_PAGINA) return filas;
  }
}

async function subirADrive(nombreArchivo, contenidoJson) {
  var auth = new google.auth.OAuth2(GDRIVE_OAUTH_CLIENT_ID, GDRIVE_OAUTH_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GDRIVE_OAUTH_REFRESH_TOKEN });
  var drive = google.drive({ version: 'v3', auth: auth });
  await drive.files.create({
    requestBody: { name: nombreArchivo, parents: [GDRIVE_FOLDER_ID] },
    media: { mimeType: 'application/json', body: contenidoJson },
    fields: 'id'
  });
}

async function main() {
  var datosPorTabla = {};
  for (var i = 0; i < TABLAS.length; i++) {
    var nombre = TABLAS[i];
    datosPorTabla[nombre] = await leerTabla(nombre);
  }

  var backupObj = Object.assign(
    { version: 3, exportadoEn: new Date().toISOString() },
    datosPorTabla
  );

  var fecha = new Date().toISOString().slice(0, 10);
  var nombreArchivo = 'backup-control-economico-' + fecha + '.json';
  var contenido = JSON.stringify(backupObj, null, 2);

  await subirADrive(nombreArchivo, contenido);
  console.log('Backup subido a Drive: ' + nombreArchivo);
  TABLAS.forEach(function (t) { console.log('  ' + t + ': ' + datosPorTabla[t].length + ' fila(s)'); });
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
