// handlers/dispersionAdicionalHandler.js
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
  console.log('Dispersion Adicional handler - Event received:', JSON.stringify(event, null, 2));

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

    const requiredFields = [
      'idPromocion',
      'vigencia_de_aplicacion', 
      'pronto_pago',
      'precio_lista',
      'aplicacion_montos_frontera',
      'aplicacion_montos_nacionales',
      'idFlujo',
      'fecha_mod',
      'nombreEditor',
      'sub',
      'dispersiones',
      'tipo_dispersion'
    ];

    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ 
          error: 'Campos requeridos faltantes', 
          missing: missingFields 
        })
      };
    }

    const client = new Client(dbConfig);
    await client.connect();

    await client.query('BEGIN');

    const checkParentQuery = 'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1';
    const checkParentResult = await client.query(checkParentQuery, [body.idFlujo]);
    if (checkParentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        statusCode: 400, headers, body: JSON.stringify({
          error: 'El idFlujo no existe en promociones_ttp',
          details: `No se pueden guardar datos para idFlujo ${body.idFlujo}`
        })
      };
    }

    const checkQuery = 'SELECT id_datos_dispercion_adicional FROM datos_dispercion_adicional WHERE id_promociones_ttp = $1';
    const checkResult = await client.query(checkQuery, [body.idFlujo]);
    const exists = checkResult.rows.length > 0;

    const fechaMod = convertirFecha(body.fecha_mod);

    if (exists) {
      const updateQuery = `
        UPDATE datos_dispercion_adicional 
        SET 
          vigencia_de_aplicacion = $1,
          pronto_pago = $2,
          precio_lista = $3,
          aplicacion_montos_frontera = $4,
          aplicacion_montos_nacionales = $5,
          dispersiones = $6,
          responsable_modificacion = $7,
          id_promocion = $8,
          sub = $9,
          ultima_modificacion = $10,
          adicionales = $11,
          porcentaje_de_descuento = $12,
          monto_de_descuento = $13,
          mes_inicio = $14,
          vigencia_en_meses = $15,
          tipo_dispersion = $17
        WHERE id_promociones_ttp = $16
        RETURNING id_datos_dispercion_adicional
      `;

      await client.query(updateQuery, [
        body.vigencia_de_aplicacion,
        Number(body.pronto_pago),
        Number(body.precio_lista),
        Number( body.aplicacion_montos_frontera ),
        Number( body.aplicacion_montos_nacionales ),
        JSON.stringify(body.dispersiones),
        body.nombreEditor,
        body.idPromocion,
        body.sub,
        fechaMod,
        {},
        0,
        0,
        fechaMod,
        0,
        body.idFlujo,
        body.tipo_dispersion
      ]);
    } else {
      const insertQuery = `
        INSERT INTO datos_dispercion_adicional (
          id_promociones_ttp, vigencia_de_aplicacion, pronto_pago, precio_lista, 
          aplicacion_montos_frontera, aplicacion_montos_nacionales, dispersiones, 
          responsable_modificacion, ultima_modificacion, fecha_creacion, id_promocion, sub, 
          adicionales, porcentaje_de_descuento, monto_de_descuento, mes_inicio, vigencia_en_meses,
          tipo_dispersion
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, $17, $18)
        RETURNING id_datos_dispercion_adicional
      `;

      await client.query(insertQuery, [
        body.idFlujo,
        body.vigencia_de_aplicacion,
        Number(body.pronto_pago),
        Number(body.precio_lista),
        Number( body.aplicacion_montos_frontera ),
        Number( body.aplicacion_montos_nacionales ),
        JSON.stringify(body.dispersiones),
        body.nombreEditor,
        fechaMod,
        fechaMod,
        body.idPromocion,
        body.sub,
        {},
        0,
        0,
        fechaMod,
        0,
        body.tipo_dispersion
      ]);
    }

    await client.query('COMMIT');
    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: exists ? 'Dispersión adicional actualizada exitosamente' : 'Dispersión adicional guardada exitosamente',
        idFlujo: body.idFlujo,
        action: exists ? 'updated' : 'created'
      })
    };

  } catch (error) {
    console.error('Error en handler:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno del servidor', details: error.message }) };
  }
};
