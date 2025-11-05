// handlers/getMontosNoCoincidenHandler.js
const { Client } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

// Función para validar formato YYYY-MM-DD
function validarFormatoFecha(fecha) {
  // Expresión regular estricta: 2025-10-30
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(fecha)) return false;

  // Verifica que sea una fecha válida del calendario
  const date = new Date(fecha);
  return date instanceof Date && !isNaN(date.getTime());
}

exports.handler = async (event) => {
  console.log('Get Montos No Coinciden handler - Event received:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS preflight' }) };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido. Usa POST.' })
    };
  }

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : event;
  } catch (error) {
    console.error("Error parsing body:", error);
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cuerpo JSON inválido' }) };
  }

  const { fechaInicio, fechaFin } = body;

  // Validación de campos requeridos
  if (!fechaInicio || !fechaFin) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Campos requeridos: fechaInicio y fechaFin' })
    };
  }

  // Validación de formato
  if (!validarFormatoFecha(fechaInicio) || !validarFormatoFecha(fechaFin)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Formato de fecha inválido. Usa el formato YYYY-MM-DD, por ejemplo: 2025-10-30'
      })
    };
  }

  // Validar que fechaInicio <= fechaFin
  if (new Date(fechaInicio) > new Date(fechaFin)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'El campo fechaInicio no puede ser posterior a fechaFin.'
      })
    };
  }

  const client = new Client(dbConfig);

  try {
    await client.connect();

    const query = `
      SELECT 
        id,
        fecha,
        sapnosat,
        totalr1,
        satnosap,
        bmrnosap,
        totalr2,
        sapnobrm,
        brmnosat,
        totalr3,
        satnobmr,
        "total_SAT",
        "total_BRM",
        "total_SAP",
        links
      FROM cuentas_no_coinciden
      WHERE fecha BETWEEN $1 AND $2
      ORDER BY fecha DESC;
    `;

    const result = await client.query(query, [fechaInicio, fechaFin]);

    const parsedData = result.rows.map(row => {
      try {
        if (typeof row.links === 'string') {
          row.links = JSON.parse(row.links);
        }
      } catch (e) {
        console.warn('No se pudo parsear el campo links como JSON:', e);
      }
      return row;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Datos obtenidos exitosamente de cuentas_no_coinciden entre ${fechaInicio} y ${fechaFin}`,
        data: parsedData
      })
    };

  } catch (error) {
    console.error('Error en GET cuentas_no_coinciden:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error interno del servidor',
        details: error.message
      })
    };
  } finally {
    await client.end();
  }
};
