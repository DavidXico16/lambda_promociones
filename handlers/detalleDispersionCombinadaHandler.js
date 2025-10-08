// handlers/getDispersionCombinadaHandler.js
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
  console.log('Get Dispersión Combinada Handler - Event received:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS preflight' }) };
  }

  // Obtener el idFlujo desde queryStringParameters o desde el cuerpo
  const idFlujo = event.queryStringParameters?.idFlujo || (event.body ? JSON.parse(event.body).idFlujo : null);

  if (!idFlujo) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Falta el parámetro requerido: idFlujo' })
    };
  }

  const client = new Client(dbConfig);
  await client.connect();

  try {
    const query = `
      SELECT 
        id_promociones_ttp AS "idFlujo",
        vigencia_de_aplicacion AS "vigenciaDeAplicacion",
        pronto_pago AS "prontoPago",
        precio_lista AS "precioLista",
        aplicacion_montes_frontera AS "aplicacionMontesFrontera",
        aplicacion_montes_nacionales AS "aplicacionMontesNacionales",
        adicionales AS "adicionales",
        promociones AS "promociones",
        porcentaje_de_descuento AS "porcentajeDeDescuento",
        monto_de_descuento AS "montoDeDescuento",
        mes_inicio AS "mesInicio",
        vigencia_en_meses AS "vigenciaEnMeses",
        megas_de_subida AS "megasDeSubida",
        megas_de_bajada AS "megasDeBajada",
        responsable_modificacion AS "nombreEditor",
        ultima_modificacion AS "fechaMod"
      FROM datos_dispercion_combinada
      WHERE id_promociones_ttp = $1
    `;

    const result = await client.query(query, [idFlujo]);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: `No se encontró información para idFlujo ${idFlujo}` })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: 'Datos de dispersión Combinada obtenidos exitosamente',
        data: result.rows[0] })
    };

  } catch (error) {
    console.error('Error al obtener datos de dispersión combinada:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error interno del servidor', details: error.message })
    };
  } finally {
    await client.end();
  }
};
