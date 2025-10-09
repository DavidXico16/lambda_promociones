const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

exports.handler = async (event) => {
  console.log('Get Grafos Simulador Handler - Event received:', JSON.stringify(event, null, 2));

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: defaultHeaders(),
      body: JSON.stringify({ error: 'Método no permitido' })
    };
  }

  const client = await pool.connect();
  try {
    const body = JSON.parse(event.body || '{}');

    if (!body.idFlujo) {
      return {
        statusCode: 400,
        headers: defaultHeaders(),
        body: JSON.stringify({
          error: 'Campo requerido faltante: idFlujo'
        })
      };
    }

    // Verificar si existe
    const checkFlujo = await client.query(
      'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1',
      [body.idFlujo]
    );

    if (checkFlujo.rows.length === 0) {
      return {
        statusCode: 404,
        headers: defaultHeaders(),
        body: JSON.stringify({
          error: 'El idFlujo no existe en la tabla promociones_ttp'
        })
      };
    }

    const selectQuery = `
    SELECT 
        id_promociones_ttp AS "idFlujo",
        nodes AS "nodes",
        edges AS "edges",
        tipo_solicitud AS "tipoSolicitud",
        responsable_modificacion AS "responsable",
        ultima_modificacion AS "ultimaModificacion",
        sub AS "sub",
        fecha_creacion AS "fechaCreacion"
    FROM datos_nodos_simulador
    WHERE id_promociones_ttp = $1 AND tipo_solicitud = $2
    ORDER BY fecha_creacion DESC
    LIMIT 1
    `;


    const result = await client.query(selectQuery, [body.idFlujo, 'simulador']);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: defaultHeaders(),
        body: JSON.stringify({
          message: 'No se encontró información para el idFlujo proporcionado'
        })
      };
    }

    const data = result.rows[0];

    return {
      statusCode: 200,
      headers: defaultHeaders(),
      body: JSON.stringify({
        message: 'Datos obtenidos correctamente',
        data: data
      })
    };

  } catch (error) {
    console.error('Error en getGrafosSimuladorHandler:', error);
    return {
      statusCode: 500,
      headers: defaultHeaders(),
      body: JSON.stringify({
        error: 'Error interno del servidor',
        details: error.message
      })
    };
  } finally {
    client.release();
  }
};

function defaultHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
  };
}
