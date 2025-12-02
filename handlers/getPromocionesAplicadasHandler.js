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
    const client = new Client(dbConfig);
    await client.connect();

    try {
      // 1️⃣ Obtener todas las promociones
      const promocionesQuery = `
        SELECT *
        FROM promociones_ttp
        ORDER BY id_promociones_ttp ASC
      `;
      const promociones = await client.query(promocionesQuery);

      if (promociones.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: 'No existen promociones registradas' }),
        };
      }

      // 2️⃣ Recorrer todas las promociones
      const resultados = [];

      for (const promo of promociones.rows) {
        const idPromo = promo.id_promociones_ttp;

        // COUNT simulador_planes_cuentas
        const planesResult = await client.query(
          `SELECT COUNT(*) AS total FROM simulador_planes_cuentas WHERE id_promociones_ttp = $1`,
          [idPromo]
        );

        // COUNT datos_condiciones
        const condicionesCount = await client.query(
          `SELECT COUNT(*) AS total FROM datos_condiciones WHERE id_promociones_ttp = $1`,
          [idPromo]
        );

        // condiciones
        const condicionesDetalle = await client.query(
          `SELECT condiciones_promociones FROM datos_condiciones WHERE id_promociones_ttp = $1`,
          [idPromo]
        );

        // SUM monto_de_descuento
        const montoDescuento = await client.query(
          `SELECT SUM(monto_de_descuento) AS total FROM datos_dispercion_adicional WHERE id_promociones_ttp = $1`,
          [idPromo]
        );

        // tipo_dispersion y tipo_aplicacion
        const tipoAplicacion = await client.query(`
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
            WHERE id_promociones_ttp = ${idPromo}
            LIMIT 1
        `);

        resultados.push({
          id_promociones_ttp: idPromo,
          nombre_promocion: promo.nombre_promocion,
          total_planes: planesResult.rows[0].total,
          total_condiciones: condicionesCount.rows[0].total,
          condiciones: condicionesDetalle.rows.map(r => r.condiciones_promociones),
          total_monto_descuento:
            montoDescuento.rows[0].total !== null ? montoDescuento.rows[0].total : "0",
          tipo_dispersion: tipoAplicacion.rows[0]?.tipo_dispersion || "",
          tipo_aplicacion: tipoAplicacion.rows[0]?.resultado || "",
          fecha_creacion: promo.fecha_creacion,
          responsable_promocion: promo.responsable_creacion,
        });
      }

      // 3️⃣ Respuesta final
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: "Datos obtenidos exitosamente",
          data: resultados,
        }),
      };

    } catch (err) {
      console.error("Database error:", err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Error en base de datos", details: err.message }),
      };
    } finally {
      await client.end();
    }

  } catch (error) {
    console.error("Error general:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Error interno del servidor", details: error.message }),
    };
  }
};
