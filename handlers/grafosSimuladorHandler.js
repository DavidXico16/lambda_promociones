const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Convierte fecha de DD/MM/YYYY → YYYY-MM-DD
function convertirFecha(fecha) {
  if (!fecha) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  const partes = fecha.split('/');
  return partes.length === 3 ? `${partes[2]}-${partes[1]}-${partes[0]}` : fecha;
}

exports.handler = async (event) => {
  console.log('Grafos Simulador Handler - Event received:', JSON.stringify(event, null, 2));

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
    const requiredFields = ['idFlujo', 'nodes', 'edges', 'nombreEditor', 'fechaMod', 'sub'];
    const missingFields = requiredFields.filter(f => !body[f] && body[f] !== 0);

    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers: defaultHeaders(),
        body: JSON.stringify({
          error: 'Campos requeridos faltantes',
          missingFields
        })
      };
    }

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

    const fechaMod = convertirFecha(body.fechaMod);

    //Revisar si ya hay registro en datos_nodos_simulador
    const checkNodo = await client.query(
      'SELECT id_datos_nodos_simulador FROM datos_nodos_simulador WHERE id_promociones_ttp = $1 AND tipo_solicitud = $2',
      [body.idFlujo, 'simulador']
    );

    let response;
    if (checkNodo.rows.length > 0) {
      //Actualizar
      const updateQuery = `
        UPDATE datos_nodos_simulador
        SET nodes = $1, edges = $2, responsable_modificacion = $3,
            ultima_modificacion = $4, sub = $5
        WHERE id_promociones_ttp = $6 AND tipo_solicitud = $7
        RETURNING id_promociones_ttp, ultima_modificacion
      `;
      const updateValues = [
        JSON.stringify(body.nodes),
        JSON.stringify(body.edges),
        body.nombreEditor,
        fechaMod,
        body.sub,
        body.idFlujo,
        'simulador'
      ];

      const result = await client.query(updateQuery, updateValues);
      response = {
        message: 'Registro actualizado correctamente',
        idFlujo: result.rows[0].id_promociones_ttp,
        ultimaModificacion: result.rows[0].ultima_modificacion
      };
    } else {
      //Insertar
      const insertQuery = `
        INSERT INTO datos_nodos_simulador (
          id_promociones_ttp, nodes, edges, tipo_solicitud,
          responsable_modificacion, ultima_modificacion, sub
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id_promociones_ttp, fecha_creacion
      `;
      const insertValues = [
        body.idFlujo,
        JSON.stringify(body.nodes),
        JSON.stringify(body.edges),
        'simulador',
        body.nombreEditor,
        fechaMod,
        body.sub
      ];

      const result = await client.query(insertQuery, insertValues);
      response = {
        message: 'Nuevo registro insertado correctamente',
        idFlujo: result.rows[0].id_promociones_ttp,
        fechaCreacion: result.rows[0].fecha_creacion
      };
    }

    return {
      statusCode: 200,
      headers: defaultHeaders(),
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error en grafosSimuladorHandler:', error);
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
