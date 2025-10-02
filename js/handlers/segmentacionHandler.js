// handlers/segmentacionHandler.js
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

// Función para convertir fecha de DD/MM/YYYY a YYYY-MM-DD
function convertirFecha(fecha) {
  if (!fecha) return null;
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }
  
  const partes = fecha.split('/');
  if (partes.length === 3) {
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }
  
  return fecha;
}

exports.handler = async (event) => {
  console.log('Segmentacion handler - Event received:', JSON.stringify(event, null, 2));
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({ message: 'CORS preflight' })
    };
  }
  
  try {
    let body;
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (parseError) {
        return {
          statusCode: 400,
          headers: headers,
          body: JSON.stringify({ error: 'Cuerpo de solicitud JSON inválido' })
        };
      }
    } else {
      body = event;
    }
    
    // Validar campos requeridos
    const requiredFields = ['segmentacion'];
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
    
    // Validar campos dentro de segmentacion
    const segmentacion = body.segmentacion;
    const requiredSegmentacionFields = ['idFlujo', 'sub', 'nombreEditor', 'fecha_mod', 'plaza', 'cluster', 'canal_de_venta'];
    const missingSegmentacionFields = requiredSegmentacionFields.filter(field => !segmentacion[field]);
    
    if (missingSegmentacionFields.length > 0) {
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ 
          error: 'Campos requeridos faltantes en segmentacion', 
          missing: missingSegmentacionFields 
        })
      };
    }
    
    // Convertir formato de fecha
    const fechaModConvertida = convertirFecha(segmentacion.fecha_mod);
    
    const client = new Client(dbConfig);
    await client.connect();
    
    try {
      await client.query('BEGIN');
      
      // PRIMERO: Verificar si el idFlujo existe en promociones_ttp (tabla padre)
      const checkParentQuery = 'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1';
      const checkParentResult = await client.query(checkParentQuery, [segmentacion.idFlujo]);
      
      if (checkParentResult.rows.length === 0) {
        // Si no existe en la tabla padre, retornar error
        await client.query('ROLLBACK');
        return {
          statusCode: 400,
          headers: headers,
          body: JSON.stringify({
            error: 'El idFlujo no existe en la tabla promociones_ttp',
            details: `No se pueden guardar datos de segmentación para un idFlujo (${segmentacion.idFlujo}) que no existe en la tabla principal`
          })
        };
      }
      
      // Preparar datos para JSONB
      const clustersData = {
        cluster: segmentacion.cluster,
        distrito: segmentacion.distrito || null
      };
      
      const plazasData = {
        plaza: segmentacion.plaza,
        distrito: segmentacion.distrito || null
      };
      
      const canalesVentaData = {
        canal_venta: segmentacion.canal_de_venta,
        subcanales: segmentacion.subcanales || null
      };
      
      // SEGUNDO: Verificar si ya existe un registro con el mismo idFlujo en datos_catalogo_segmentacion
      const checkQuery = 'SELECT id_datos_catalogo_segmentacion FROM datos_catalogo_segmentacion WHERE id_promociones_ttp = $1';
      const checkResult = await client.query(checkQuery, [segmentacion.idFlujo]);
      
      const exists = checkResult.rows.length > 0;
      
      if (exists) {
        // UPDATE - Si existe, actualizar
        console.log(`Actualizando segmentación existente para idFlujo: ${segmentacion.idFlujo}`);
        
        const updateQuery = `
          UPDATE datos_catalogo_segmentacion 
          SET clusters = $1,
              plazas = $2,
              canales_venta = $3,
              result = $4,
              result_description = $5,
              fecha_creacion = $6,
              responsable_modificacion = $7,
              ultima_modificacion = CURRENT_TIMESTAMP
          WHERE id_promociones_ttp = $8
          RETURNING id_datos_catalogo_segmentacion
        `;
        
        const values = [
          JSON.stringify(clustersData),
          JSON.stringify(plazasData),
          JSON.stringify(canalesVentaData),
          'success',
          'Segmentación procesada exitosamente',
          fechaModConvertida,
          segmentacion.nombreEditor,
          segmentacion.idFlujo
        ];
        
        console.log('UPDATE values:', values);
        const result = await client.query(updateQuery, values);
        
      } else {
        // INSERT - Si no existe, crear nuevo registro
        console.log(`Creando nueva segmentación para idFlujo: ${segmentacion.idFlujo}`);
        
        const insertQuery = `
          INSERT INTO datos_catalogo_segmentacion 
          (id_promociones_ttp, clusters, plazas, canales_venta, result, result_description, fecha_creacion, responsable_modificacion, ultima_modificacion)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
          RETURNING id_datos_catalogo_segmentacion
        `;
        
        const values = [
          segmentacion.idFlujo,
          JSON.stringify(clustersData),
          JSON.stringify(plazasData),
          JSON.stringify(canalesVentaData),
          'success',
          'Segmentación procesada exitosamente',
          fechaModConvertida,
          segmentacion.nombreEditor
        ];
        
        console.log('INSERT values:', values);
        const result = await client.query(insertQuery, values);
      }
      
      await client.query('COMMIT');
      
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          message: exists ? 'Segmentación actualizada exitosamente' : 'Segmentación guardada exitosamente',
          idFlujo: segmentacion.idFlujo,
          plaza: segmentacion.plaza,
          cluster: segmentacion.cluster,
          canal_venta: segmentacion.canal_de_venta,
          action: exists ? 'updated' : 'created'
        })
      };
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Database error in segmentacion handler:', dbError);
      
      // Manejar error específico de NULL
      if (dbError.message.includes('null value in column')) {
        return {
          statusCode: 400,
          headers: headers,
          body: JSON.stringify({
            error: 'Error de validación en la base de datos',
            details: dbError.message
          })
        };
      }
      
      throw dbError;
    } finally {
      await client.end();
    }
    
  } catch (error) {
    console.error('Error en segmentacion handler:', error);
    
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({
        error: 'Error interno del servidor',
        details: error.message
      })
    };
  }
};