// handlers/dispersionAdicionalHandler.js
const { Client } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
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
    let body;
    if (event.body) {
      try { body = JSON.parse(event.body); } catch (parseError) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cuerpo de solicitud JSON inválido' }) };
      }
    } else { body = event; }
    
    const dispersionData = body.datos_dispercion_adicional || body;
    
    const requiredFields = [
      'vigencia_de_aplicacion', 'pronto_pago', 'precio_lista', 'aplicacion_montes_frontera', 
      'aplicacion_montes_nacionales', 'adicionales', 'porcentaje_de_descuento', 'monto_de_descuento',
      'mes_inicio', 'vigencia_en_meses', 'idFlujo', 'sub', 'nombreEditor', 'fecha_mod'
    ];
    
    const missingFields = requiredFields.filter(field => !dispersionData[field]);
    if (missingFields.length > 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos requeridos faltantes', missing: missingFields }) };
    }
    
    const numericFields = ['pronto_pago', 'precio_lista', 'aplicacion_montes_frontera', 'aplicacion_montes_nacionales', 'vigencia_en_meses'];
    const invalidNumeric = numericFields.filter(field => isNaN(dispersionData[field]));
    if (invalidNumeric.length > 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos numéricos inválidos', invalid: invalidNumeric }) };
    }
    
    const fechaModConvertida = convertirFecha(dispersionData.fecha_mod);
    const mesInicioConvertido = convertirFecha(dispersionData.mes_inicio);
    
    const client = new Client(dbConfig);
    await client.connect();
    
    try {
      await client.query('BEGIN');
      
      const checkParentQuery = 'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1';
      const checkParentResult = await client.query(checkParentQuery, [dispersionData.idFlujo]);
      
      if (checkParentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          statusCode: 400, headers, body: JSON.stringify({
            error: 'El idFlujo no existe en la tabla promociones_ttp',
            details: `No se pueden guardar datos para idFlujo (${dispersionData.idFlujo}) que no existe`
          })
        };
      }
      
      const checkQuery = 'SELECT id_datos_dispercion_adicional FROM datos_dispercion_adicional WHERE id_promociones_ttp = $1';
      const checkResult = await client.query(checkQuery, [dispersionData.idFlujo]);
      const exists = checkResult.rows.length > 0;
      
      if (exists) {
        const updateQuery = `
          UPDATE datos_dispercion_adicional 
          SET vigencia_de_aplicacion = $1, pronto_pago = $2, precio_lista = $3, aplicacion_montes_frontera = $4,
              aplicacion_montes_nacionales = $5, adicionales = $6, porcentaje_de_descuento = $7, monto_de_descuento = $8,
              mes_inicio = $9, vigencia_en_meses = $10, responsable_modificacion = $11, ultima_modificacion = $12
          WHERE id_promociones_ttp = $13
          RETURNING id_datos_dispercion_adicional
        `;
        
        const values = [
          dispersionData.vigencia_de_aplicacion,
          parseInt(dispersionData.pronto_pago),
          parseInt(dispersionData.precio_lista),
          parseInt(dispersionData.aplicacion_montes_frontera),
          parseInt(dispersionData.aplicacion_montes_nacionales),
          JSON.stringify(dispersionData.adicionales),
          parseFloat(dispersionData.porcentaje_de_descuento),
          parseFloat(dispersionData.monto_de_descuento),
          mesInicioConvertido,
          parseInt(dispersionData.vigencia_en_meses),
          dispersionData.nombreEditor,
          fechaModConvertida,
          dispersionData.idFlujo
        ];
        
        const result = await client.query(updateQuery, values);
      } else {
        const insertQuery = `
          INSERT INTO datos_dispercion_adicional 
          (id_promociones_ttp, vigencia_de_aplicacion, pronto_pago, precio_lista, aplicacion_montes_frontera,
           aplicacion_montes_nacionales, adicionales, porcentaje_de_descuento, monto_de_descuento, mes_inicio,
           vigencia_en_meses, responsable_modificacion, ultima_modificacion)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id_datos_dispercion_adicional
        `;
        
        const values = [
          dispersionData.idFlujo,
          dispersionData.vigencia_de_aplicacion,
          parseInt(dispersionData.pronto_pago),
          parseInt(dispersionData.precio_lista),
          parseInt(dispersionData.aplicacion_montes_frontera),
          parseInt(dispersionData.aplicacion_montes_nacionales),
          JSON.stringify(dispersionData.adicionales),
          parseFloat(dispersionData.porcentaje_de_descuento),
          parseFloat(dispersionData.monto_de_descuento),
          mesInicioConvertido,
          parseInt(dispersionData.vigencia_en_meses),
          dispersionData.nombreEditor,
          fechaModConvertida
        ];
        
        const result = await client.query(insertQuery, values);
      }
      
      await client.query('COMMIT');
      
      return {
        statusCode: 200, headers, body: JSON.stringify({
          message: exists ? 'Dispersión adicional actualizada exitosamente' : 'Dispersión adicional guardada exitosamente',
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