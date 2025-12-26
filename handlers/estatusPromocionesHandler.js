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
  console.log('Event received:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight' })
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : event;

    // 🔹 Validar idFlujo
    if (!body.idFlujo) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'El campo idFlujo es requerido'
        })
      };
    }

    const client = new Client(dbConfig);
    await client.connect();

    try {
      const query = `
        SELECT estatus
        FROM promociones_ttp
        WHERE id_promociones_ttp = $1
      `;

      const result = await client.query(query, [body.idFlujo]);

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            message: 'No se encontró información para el idflujo',
            idFlujo: body.idFlujo
          })
        };
      }

      const estatus = result.rows[0].estatus;

      // Normalizamos por seguridad
      const isAprobado = typeof estatus === 'string' 
        && estatus.toLowerCase() === 'aprobado';

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          idFlujo: body.idFlujo,
          estatus: isAprobado
        })
      };

    } finally {
      await client.end();
    }

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error interno del servidor',
        details: error.message
      })
    };
  }
};
