// handlers/inconvivenciasHandler.js
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
  console.log('Inconvivencias handler - Event received:', JSON.stringify(event, null, 2));
  
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
    
    // Validar campos requeridos según tu estructura
    const requiredFields = ['idFlujo', 'sub', 'nombreEditor', 'fecha_mod', 'resultDescription', 'result', 'inconvivencias'];
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
        await client.query('ROLLBACK');
        return {
          statusCode: 400,
          headers: headers,
          body: JSON.stringify({
            error: 'El idFlujo no existe en la tabla promociones_ttp',
            details: `No se pueden guardar datos de inconvivencia para un idFlujo (${body.idFlujo}) que no existe en la tabla principal`
          })
        };
      }
      
      // SEGUNDO: Verificar si ya existe un registro con el mismo idFlujo en datos_inconvivencia
      const checkQuery = 'SELECT id_datos_inconvivencia FROM datos_inconvivencia WHERE id_promociones_ttp = $1';
      const checkResult = await client.query(checkQuery, [body.idFlujo]);
      
      const exists = checkResult.rows.length > 0;
      
      if (exists) {
        // UPDATE - Si existe, actualizar
        console.log(`Actualizando inconvivencias existentes para idFlujo: ${body.idFlujo}`);
        
        const updateQuery = `
          UPDATE datos_inconvivencia 
          SET result_description = $1,
              result = $2,
              inconvivencias = $3,
              fecha_creacion = $4,
              responsable_modificacion = $5,
              ultima_modificacion = CURRENT_DATE
          WHERE id_promociones_ttp = $6
          RETURNING id_datos_inconvivencia
        `;
        
        const values = [
          body.resultDescription,
          body.result,
          JSON.stringify(body.inconvivencias), // Array de inconvivencias
          fechaModConvertida,
          body.nombreEditor,
          body.idFlujo
        ];
        
        console.log('UPDATE values:', values);
        const result = await client.query(updateQuery, values);
        
      } else {
        // INSERT - Si no existe, crear nuevo registro
        console.log(`Creando nuevos datos de inconvivencia para idFlujo: ${body.idFlujo}`);
        
        const insertQuery = `
          INSERT INTO datos_inconvivencia 
          (id_promociones_ttp, result_description, result, inconvivencias, fecha_creacion, responsable_modificacion, ultima_modificacion)
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
          RETURNING id_datos_inconvivencia
        `;
        
        const values = [
          body.idFlujo,
          body.resultDescription,
          body.result,
          JSON.stringify(body.inconvivencias), // Array de inconvivencias
          fechaModConvertida,
          body.nombreEditor
        ];
        
        console.log('INSERT values:', values);
        const result = await client.query(insertQuery, values);
      }
      
      await client.query('COMMIT');
      
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          message: exists ? 'Datos de inconvivencia actualizados exitosamente' : 'Datos de inconvivencia guardados exitosamente',
          idFlujo: body.idFlujo,
          total_inconvivencias: body.inconvivencias ? body.inconvivencias.length : 0,
          action: exists ? 'updated' : 'created'
        })
      };
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Database error in inconvivencias handler:', dbError);
      
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
    console.error('Error en inconvivencias handler:', error);
    
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