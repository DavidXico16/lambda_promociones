// handlers/dispersionMegasHandler.js
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
  console.log('Dispersion Megas handler - Event received:', JSON.stringify(event, null, 2));

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
    let body = event.body ? JSON.parse(event.body) : event;

    const dispersionData = body || {};

    const requiredFields = [
      'vigencia_de_aplicacion', 'pronto_pago', 'precio_lista',
      'idFlujo', 'fecha_mod', 'nombreEditor', 'sub', 'dispersiones', 'tipo_dispersion'
    ];

    const missingFields = requiredFields.filter(field => dispersionData[field] === undefined || dispersionData[field] === null);
    if (missingFields.length > 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos requeridos faltantes', missing: missingFields }) };
    }

    const client = new Client(dbConfig);
    await client.connect();

    try {
      await client.query('BEGIN');

      const checkParentQuery = 'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1';
      const parentExists = await client.query(checkParentQuery, [dispersionData.idFlujo]);

      if (parentExists.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          statusCode: 400, headers, body: JSON.stringify({
            error: 'El idFlujo no existe en la tabla promociones_ttp',
            details: `No se pueden guardar datos para idFlujo (${dispersionData.idFlujo}) que no existe`
          })
        };
      }

      // 🔹 Verificar si ya existe registro
      const checkQuery = 'SELECT id_datos_dispercion_megas FROM datos_dispercion_megas WHERE id_promociones_ttp = $1';
      const existing = await client.query(checkQuery, [dispersionData.idFlujo]);
      const exists = existing.rows.length > 0;

      const fechaModConvertida = convertirFecha(dispersionData.fecha_mod);

      if (exists) {
        // 🔄 Actualizar
        const updateQuery = `
          UPDATE datos_dispercion_megas
          SET vigencia_de_aplicacion = $1,
              pronto_pago = $2,
              precio_lista = $3,
              dispersiones = $4,
              responsable_modificacion = $5,
              ultima_modificacion = $6,
              megas = $8,
              aplicacion_montos_frontera = $9,
              aplicacion_montos_nacionales = $10,
              porcentaje_de_descuento = $11,
              monto_de_descuento = $12,
              mes_inicio = $13,
              vigencia_en_meses = $14,
              megas_de_subida = $15,
              megas_de_bajada = $16,
              tipo_dispersion = $17
          WHERE id_promociones_ttp = $7
          RETURNING id_datos_dispercion_megas
        `;

        const values = [
          dispersionData.vigencia_de_aplicacion,
          Number.parseFloat(dispersionData.pronto_pago),
          Number.parseFloat(dispersionData.precio_lista),
          JSON.stringify(dispersionData.dispersiones),
          dispersionData.nombreEditor,
          fechaModConvertida,
          dispersionData.idFlujo,
          [],
          0,
          0,
          0,
          0,
          fechaModConvertida,
          0,
          0,
          0,
          dispersionData.tipo_dispersion
        ];

        await client.query(updateQuery, values);
      } else {
        // 🆕 Insertar
        const insertQuery = `
          INSERT INTO datos_dispercion_megas
          (id_promociones_ttp, vigencia_de_aplicacion, pronto_pago, precio_lista,
           dispersiones, responsable_modificacion, ultima_modificacion, megas, aplicacion_montos_frontera, aplicacion_montos_nacionales,
           porcentaje_de_descuento, monto_de_descuento, mes_inicio, vigencia_en_meses, megas_de_subida, megas_de_bajada,
           tipo_dispersion)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          RETURNING id_datos_dispercion_megas
        `;

        const values = [
          dispersionData.idFlujo,
          dispersionData.vigencia_de_aplicacion,
          Number.parseFloat(dispersionData.pronto_pago),
          Number.parseFloat(dispersionData.precio_lista),
          JSON.stringify(dispersionData.dispersiones),
          dispersionData.nombreEditor,
          fechaModConvertida,
          [],
          0,
          0,
          0,
          0,
          fechaModConvertida,
          0,
          0,
          0,
          dispersionData.tipo_dispersion
        ];

        await client.query(insertQuery, values);
      }

      await client.query('COMMIT');

      return {
        statusCode: 200, headers, body: JSON.stringify({
          message: exists ? 'Dispersión actualizada exitosamente' : 'Dispersión creada exitosamente',
          idFlujo: dispersionData.idFlujo,
          action: exists ? 'updated' : 'created'
        })
      };

    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Database error:', dbError);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno del servidor', details: dbError.message }) };
    } finally {
      await client.end();
    }

  } catch (error) {
    console.error('Error en handler:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno del servidor', details: error.message }) };
  }
};
