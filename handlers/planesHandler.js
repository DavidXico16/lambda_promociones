// handlers/planesHandler.js
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
  console.log('Planes handler - Event received:', JSON.stringify(event, null, 2));
  
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
    const requiredFields = ['idFlujo', 'planes', 'familias', 'metadata', 'sub', 'nombreEditor', 'fecha_mod'];
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
    
    // Validar que planes sea un array
    if (!Array.isArray(body.planes)) {
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ 
          error: 'El campo planes debe ser un array' 
        })
      };
    }
    
    // Convertir formato de fecha
    const fechaModConvertida = convertirFecha(body.fecha_mod);
    
    const client = new Client(dbConfig);
    await client.connect();
    
    try {
      await client.query('BEGIN');
      
      // PRIMERO: Verificar si el idFlujo existe en promociones_ttp (tabla padre)
      const checkParentQuery = 'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1';
      const checkParentResult = await client.query(checkParentQuery, [body.idFlujo]);
      
      if (checkParentResult.rows.length === 0) {
        // Si no existe en la tabla padre, retornar error
        await client.query('ROLLBACK');
        return {
          statusCode: 400,
          headers: headers,
          body: JSON.stringify({
            error: 'El idFlujo no existe en la tabla promociones_ttp',
            details: `No se pueden guardar planes para un idFlujo (${body.idFlujo}) que no existe en la tabla principal`
          })
        };
      }
      
      // SEGUNDO: Verificar si ya existe un registro con el mismo idFlujo en datos_planes
      const checkQuery = 'SELECT id_datos_planes FROM datos_planes WHERE id_promociones_ttp = $1';
      const checkResult = await client.query(checkQuery, [body.idFlujo]);
      
      const exists = checkResult.rows.length > 0;
      
      if (exists) {
        // UPDATE - Si existe, actualizar
        console.log(`Actualizando planes existentes para idFlujo: ${body.idFlujo}`);
        
        const updateQuery = `
          UPDATE datos_planes 
          SET result_description = $1,
              result = $2,
              planes = $3,
              metadata = $4,
              familias = $5,
              message = $6,
              fecha_creacion = $7,
              responsable_modificacion = $8,
              ultima_modificacion = CURRENT_TIMESTAMP
          WHERE id_promociones_ttp = $9
          RETURNING id_datos_planes
        `;
        
        const values = [
          'Planes procesados exitosamente',
          'success',
          JSON.stringify(body.planes || []),
          JSON.stringify(body.metadata || {}),
          JSON.stringify(body.familias || []),
          `Procesados ${body.planes?.length || 0} planes`,
          fechaModConvertida,
          body.nombreEditor,
          body.idFlujo
        ];
        
        console.log('UPDATE values:', values);
        const result = await client.query(updateQuery, values);
        
      } else {
        // INSERT - Si no existe, crear nuevo registro
        console.log(`Creando nuevos planes para idFlujo: ${body.idFlujo}`);
        
        const insertQuery = `
          INSERT INTO datos_planes 
          (id_promociones_ttp, result_description, result, planes, metadata, familias, message, fecha_creacion, responsable_modificacion, ultima_modificacion)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
          RETURNING id_datos_planes
        `;
        
        const values = [
          body.idFlujo,
          'Planes procesados exitosamente',
          'success',
          JSON.stringify(body.planes || []),
          JSON.stringify(body.metadata || {}),
          JSON.stringify(body.familias || []),
          `Procesados ${body.planes?.length || 0} planes`,
          fechaModConvertida,
          body.nombreEditor
        ];
        
        console.log('INSERT values:', values);
        console.log('Number of planes:', body.planes.length);
        const result = await client.query(insertQuery, values);
      }
      
      await client.query('COMMIT');
      
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          message: exists ? 'Planes actualizados exitosamente' : 'Planes guardados exitosamente',
          idFlujo: body.idFlujo,
          total_planes: body.planes.length,
          total_familias: body.familias.length,
          action: exists ? 'updated' : 'created'
        })
      };
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Database error in planes handler:', dbError);
      
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
    console.error('Error en planes handler:', error);
    
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