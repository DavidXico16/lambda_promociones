// handlers/dispersionCombinadaHandler.js
const { Client } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

function convertirFecha(fecha) {
  if (!fecha) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  const partes = fecha.split('/');
  if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
  return fecha;
}

exports.handler = async (event) => {
  console.log('Dispersion Combinada handler - Event received:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS preflight' }) };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : event;

    const dispersionData = body;

    const requiredFields = [
      'idPromocion', 'vigencia_de_aplicacion', 'pronto_pago', 'precio_lista',
      'aplicacion_montos_frontera', 'aplicacion_montos_nacionales',
      'idFlujo', 'fecha_mod', 'nombreEditor', 'sub'
    ];

    const missingFields = requiredFields.filter(field => !dispersionData[field]);
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Campos requeridos faltantes', missing: missingFields })
      };
    }

    const client = new Client(dbConfig);
    await client.connect();

    try {
      await client.query('BEGIN');

      // Verificamos que idFlujo exista
      const checkParent = await client.query(
        'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1',
        [dispersionData.idFlujo]
      );
      if (checkParent.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          statusCode: 400, headers,
          body: JSON.stringify({ error: 'idFlujo no existe en promociones_ttp' })
        };
      }

      const fechaMod = convertirFecha(dispersionData.fecha_mod);

      // Verificamos si ya existe
      const checkExist = await client.query(
        'SELECT id_datos_dispercion_combinada FROM datos_dispercion_combinada WHERE id_promociones_ttp = $1',
        [dispersionData.idFlujo]
      );
      const exists = checkExist.rows.length > 0;

      if (exists) {
        // UPDATE
        const updateQuery = `
          UPDATE datos_dispercion_combinada SET
            id_promocion = $1,
            vigencia_de_aplicacion = $2,
            pronto_pago = $3,
            precio_lista = $4,
            aplicacion_montes_frontera = $5,
            aplicacion_montes_nacionales = $6,
            dispersiones = $7,
            responsable_modificacion = $8,
            ultima_modificacion = $9,

            adicionales = $11,
            promociones = $12,
            porcentaje_de_descuento = $13,
            monto_de_descuento = $14,
            mes_inicio = $15,
            vigencia_en_meses = $16,
            megas_de_subida = $17,
            megas_de_bajada = $18
          WHERE id_promociones_ttp = $10
        `;
        const updateValues = [
          dispersionData.idPromocion,
          dispersionData.vigencia_de_aplicacion,
          Number(dispersionData.pronto_pago),
          Number(dispersionData.precio_lista),
          Number(dispersionData.aplicacion_montos_frontera),
          Number(dispersionData.aplicacion_montos_nacionales),
          JSON.stringify(dispersionData.dispersiones || []),
          dispersionData.nombreEditor,
          fechaMod,
          dispersionData.idFlujo,
          [],
          [],
          0,
          0,
          "2025-10-31",
          0,
          0,
          0
        ];

        await client.query(updateQuery, updateValues);
      } else {
        // INSERT
        const insertQuery = `
          INSERT INTO datos_dispercion_combinada (
            id_promocion, id_promociones_ttp, vigencia_de_aplicacion, pronto_pago, precio_lista,
            aplicacion_montes_frontera, aplicacion_montes_nacionales, dispersiones,
            responsable_modificacion, ultima_modificacion, 
            adicionales, promociones, porcentaje_de_descuento, monto_de_descuento, mes_inicio, vigencia_en_meses, megas_de_subida, megas_de_bajada
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, $11, $12, $13, $14, $15, $16, $17, $18)
        `;
        const insertValues = [
          dispersionData.idPromocion,
          dispersionData.idFlujo,
          dispersionData.vigencia_de_aplicacion,
          Number(dispersionData.pronto_pago),
          Number(dispersionData.precio_lista),
          Number(dispersionData.aplicacion_montos_frontera),
          Number(dispersionData.aplicacion_montos_nacionales),
          JSON.stringify(dispersionData.dispersiones || []),
          dispersionData.nombreEditor,
          fechaMod,
          [],
          [],
          0,
          0,
          "2025-10-31",
          0,
          0,
          0
        ];

        await client.query(insertQuery, insertValues);
      }

      await client.query('COMMIT');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: exists ? 'Dispersión combinada actualizada exitosamente' : 'Dispersión combinada creada exitosamente',
          idFlujo: dispersionData.idFlujo,
          action: exists ? 'updated' : 'created'
        })
      };

    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Database error:', dbError);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno DB', details: dbError.message }) };
    } finally {
      await client.end();
    }

  } catch (error) {
    console.error('Error en handler:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno del servidor', details: error.message }) };
  }
};
