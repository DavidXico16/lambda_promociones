// handlers/simuladorProgresiveHandler.js
const { Client } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

exports.handler = async (event) => {
  console.log('Simulador Progressive GET - Event received:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token',
  };

  // ✅ CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS preflight' }) };
  }

  try {
    let body = {};

    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (err) {
        console.error('Error al parsear el body:', err);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Cuerpo JSON inválido' }),
        };
      }
    } else {
      body = event;
    }

    const { idFlujo } = body;

    if (!idFlujo) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'El campo idFlujo es requerido en el body' }),
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
          responsable_modificacion AS "nombreEditor",
          ultima_modificacion AS "fechaMod",
          tipo_dispersion AS "tipoDispersion",
          dispersiones
        FROM datos_dispercion_megas
        WHERE id_promociones_ttp = $1
      `;

      const result = await client.query(query, [idFlujo]);

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: `No se encontraron datos para idFlujo ${idFlujo}` }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Datos obtenidos exitosamente',
          data: result.rows[0],
        }),
      };
    } catch (dbError) {
      console.error('Database error:', dbError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Error en base de datos', details: dbError.message }),
      };
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Error general en handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error interno del servidor', details: error.message }),
    };
  }
};
