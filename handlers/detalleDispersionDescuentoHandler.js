// handlers/getDispersionDescuentoHandler.js
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
  console.log('Get Dispersion Descuento handler - Event received:', JSON.stringify(event, null, 2));

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
    console.log("Error: ", error)
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cuerpo JSON inválido' }) };
  }

  const requiredFields = ['idFlujo'];
  const missingFields = requiredFields.filter(f => !body[f]);
  if (missingFields.length > 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Campo requerido faltante', missing: missingFields })
    };
  }

  const client = new Client(dbConfig);

  try {
    await client.connect();

  const query = `
    SELECT 
      id_promociones_ttp AS "idFlujo",
      vigencia_de_aplicacion AS "vigenciaDeAplicacion",
      pronto_pago AS "prontoPago",
      precio_lista AS "precioLista",
      aplicacion_montos_frontera AS "aplicacionMontosFrontera",
      aplicacion_montos_nacionales AS "aplicacionMontosNacionales",
      planes AS "planes",
      porcentaje_de_descuento AS "porcentajeDeDescuento",
      monto_de_descuento AS "montoDeDescuento",
      mes_inicio AS "mesInicio",
      vigencia_en_meses AS "vigenciaEnMeses",
      responsable_modificacion AS "nombreEditor",
      ultima_modificacion AS "fechaMod",
      dispersiones
    FROM datos_dispercion_descuento
    WHERE id_promociones_ttp = $1
  `;

    const result = await client.query(query, [body.idFlujo]);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          message: `No se encontraron registros para idFlujo: ${body.idFlujo}`,
          data: {}
        })
      };
    }

    // Parsear el campo JSON planes si existe
    const data = result.rows[0];
    if (data.planes) {
      try {
        data.planes = JSON.parse(data.planes);
      } catch {
        console.warn('No se pudo parsear el campo planes como JSON');
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Datos obtenidos exitosamente de datos_dispercion_descuento',
        data
      })
    };

  } catch (error) {
    console.error('Error en GET datos_dispercion_descuento:', error);
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
