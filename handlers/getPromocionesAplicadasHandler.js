// handlers/promocionesTtpInfoHandler.js
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
  console.log('Promociones TTP GET - Event:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS preflight' }) };
  }

  try {
    let body = {};

    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (err) {
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
        body: JSON.stringify({ error: 'El campo idFlujo es requerido' }),
      };
    }

    const client = new Client(dbConfig);
    await client.connect();

    try {
        // Obtener la info de promociones_ttp
        const queryPromo = `
            SELECT *
            FROM promociones_ttp
            WHERE id_promociones_ttp = $1
        `;

        const promoResult = await client.query(queryPromo, [idFlujo]);

        if (promoResult.rows.length === 0) {
            return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ message: `No existe id_promociones_ttp ${idFlujo}` }),
            };
        }

        // Conteo en simulador_planes_cuentas
        const queryPlanes = `
        SELECT COUNT(*) AS total_coincidencias
        FROM simulador_planes_cuentas
        WHERE id_promociones_ttp = $1
        `;
        const planesResult = await client.query(queryPlanes, [idFlujo]);

        // Obtener datos en datos_condiciones
        const queryCountCondiciones = `
            SELECT COUNT(*) AS total_condiciones_promociones
            FROM datos_condiciones
            WHERE id_promociones_ttp = $1
        `;
        const countCondicionesResult = await client.query(queryCountCondiciones, [idFlujo]);


        // Obtener 
        const queryCondiciones = `
            SELECT condiciones_promociones
            FROM datos_condiciones
            WHERE id_promociones_ttp = $1
        `;
        const condicionesResult = await client.query(queryCondiciones, [idFlujo]);


        // Obtener suma de campo monto_de_descuento
        const queryMontoDescuentoCondiciones = `
            SELECT SUM(monto_de_descuento) AS total_monto_descuento
            FROM datos_dispercion_adicional
            WHERE id_promociones_ttp = $1
        `;
        const montoDescuentoResult = await client.query(queryMontoDescuentoCondiciones, [idFlujo]);

        
        // Obtener datos en datos_dispercion_adicional
        const querytipoAplicacion = `
            SELECT 
                tipo_dispersion,
                pronto_pago,
                precio_lista,
                CASE
                    WHEN pronto_pago = 1 AND precio_lista = 1 THEN 'monto con impuestos'
                    WHEN pronto_pago = 1 AND precio_lista <> 1 THEN 'monto pronto pago'
                    WHEN precio_lista = 1 AND pronto_pago <> 1 THEN 'monto precio lista'
                    ELSE 'NA'
                END AS resultado
            FROM datos_dispercion_adicional
            WHERE id_promociones_ttp = $1
        `;
        const tipoAplicacionResult = await client.query( querytipoAplicacion, [idFlujo] );

        // 4️⃣ Respuesta final
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
            message: 'Datos obtenidos exitosamente',
            data: {
                idFlujo: promoResult.rows[0].id_promociones_ttp,
                nombre_promocion: promoResult.rows[0].nombre_promocion,
                total_planes: planesResult.rows[0].total_coincidencias ,
                total_cuentas: countCondicionesResult.rows[0].total_condiciones_promociones,
                total_monto_descuento: montoDescuentoResult.rows[0].total_monto_descuento != null ? montoDescuentoResult.rows[0].total_monto_descuento : "0",
                tipo_dispersion: tipoAplicacionResult.rows[0] != null ? tipoAplicacionResult.rows[0].tipo_dispersion : "",
                tipo_aplicacion: tipoAplicacionResult.rows[0] != null ? tipoAplicacionResult.rows[0].resultado : "",
                fecha: promoResult.rows[0].fecha_creacion,
                responsable_promocion: promoResult.rows[0].responsable_creacion
            },
            }),
        };

    } catch (dbError) {
      console.error('Database error:', dbError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Error en base de datos',
          details: dbError.message,
        }),
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
