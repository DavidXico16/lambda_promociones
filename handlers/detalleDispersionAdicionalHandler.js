// handlers/getDispersionAdicionalHandler.js
const { Client } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

exports.handler = async (event) => {
  console.log('Get Dispersion Adicional handler - Event received:', JSON.stringify(event, null, 2));

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

  if (!body.idFlujo) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Campo requerido faltante: idFlujo' })
    };
  }

  const client = new Client(dbConfig);

  try {
    await client.connect();

    const query = `
      SELECT 
        id_promociones_ttp AS "idFlujo",
        id_promocion AS "idPromocion",
        vigencia_de_aplicacion AS "vigencia_de_aplicacion",
        pronto_pago AS "pronto_pago",
        precio_lista AS "precio_lista",
        aplicacion_montos_frontera AS "aplicación_montos_frontera",
        aplicacion_montos_nacionales AS "aplicación_montos_nacionales",
        responsable_modificacion AS "nombreEditor",
        ultima_modificacion AS "fecha_mod",
        sub AS "sub",
        tipo_dispersion AS "tipoDispersion",
        dispersiones AS "dispersiones"
      FROM datos_dispercion_adicional
      WHERE id_promociones_ttp = $1
    `;

    const result = await client.query(query, [body.idFlujo]);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          message: `No se encontraron registros para idFlujo: ${body.idFlujo}`,
          data: []
        })
      };
    }

    // Parsear campos JSONB si existen
    const parsedData = result.rows.map(row => {
      try {
        if (typeof row.adicionales === 'string') row.adicionales = JSON.parse(row.adicionales);
      } catch (e) {
        console.warn('No se pudo parsear el campo adicionales como JSON:', e);
      }
      try {
        if (typeof row.dispersiones === 'string') row.dispersiones = JSON.parse(row.dispersiones);
      } catch (e) {
        console.warn('No se pudo parsear el campo dispersiones como JSON:', e);
      }
      return row;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Datos obtenidos exitosamente de datos_dispercion_adicional',
        data: parsedData
      })
    };

  } catch (error) {
    console.error('Error en GET datos_dispercion_adicional:', error);
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
