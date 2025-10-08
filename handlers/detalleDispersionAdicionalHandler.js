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

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS preflight' }) };
  }

  // Solo se permite POST (para recibir idFlujo en el body)
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido. Usa POST.' })
    };
  }

  // Parsear body
  let body;
  try {
    body = event.body ? JSON.parse(event.body) : event;
  } catch (error) {
    console.log("ERROR: ", error)
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cuerpo JSON inválido' }) };
  }

  // Validar campo requerido
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
        aplicacion_montes_frontera AS "aplicacionMontesFrontera",
        aplicacion_montes_nacionales AS "aplicacionMontesNacionales",
        adicionales AS "adicionales",
        porcentaje_de_descuento AS "porcentajeDeDescuento",
        monto_de_descuento AS "montoDeDescuento",
        mes_inicio AS "mesInicio",
        vigencia_en_meses AS "vigenciaEnMeses",
        responsable_modificacion AS "nombreEditor",
        ultima_modificacion AS "fechaMod"
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

    // Parsear el campo JSON adicionales si existe
    const parsedData = result.rows.map(row => {
      if (row.adicionales) {
        try {
          row.adicionales = JSON.parse(row.adicionales);
        } catch {
          console.warn('No se pudo parsear el campo adicionales como JSON');
        }
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
