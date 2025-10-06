const { Client } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

exports.handler = async (event) => {
  console.log('Datos detalles Quitas, idFlujo : ', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight' })
    };
  }

  // Solo permitir POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido' })
    };
  }

  // Validar cuerpo JSON
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    console.log("Error al parsear body:", error);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Cuerpo JSON inválido' })
    };
  }

  // Validar campo requerido
  if (!body.idFlujo) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Campo requerido: idFlujo' })
    };
  }

  const client = new Client(dbConfig);

  try {
    await client.connect();

    const query = `
      SELECT *
      FROM datos_quitas
      WHERE id_promociones_ttp = $1
    `;

    const result = await client.query(query, [body.idFlujo]);

    if (!result.rows || result.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          message: `No se encontraron registros en datos_quitas para idFlujo: ${body.idFlujo}`,
          data: {}
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Datos obtenidos exitosamente de Quitas',
        data: result.rows[0]
      })
    };

  } catch (error) {
    console.error('Error en POST datos_quitas por el idFlujo:', error);

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
