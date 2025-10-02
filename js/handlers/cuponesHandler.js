// handlers/cuponesHandler.js
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
  console.log('Cupones handler - Event received:', JSON.stringify(event, null, 2));
  
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
    
    // Validar si viene dentro de objeto "cupones" o en el root
    const cuponesData = body.cupones || body;
    
    // Validar campos requeridos
    const requiredFields = [
      'tipo_de_codigo', 
      'vigencia', 
      'cantidad_de_dias', 
      'numero_de_unidades', 
      'medio_canal', 
      'id_campania',
      'idFlujo', 
      'sub', 
      'nombreEditor', 
      'fecha_mod'
    ];
    
    const missingFields = requiredFields.filter(field => !cuponesData[field]);
    
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
    
    // Validar tipos de datos numéricos
    if (isNaN(cuponesData.cantidad_de_dias) || isNaN(cuponesData.numero_de_unidades)) {
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ 
          error: 'Los campos numéricos deben ser válidos',
          details: 'cantidad_de_dias y numero_de_unidades deben ser números'
        })
      };
    }
    
    // Convertir formato de fecha
    const fechaModConvertida = convertirFecha(cuponesData.fecha_mod);
    
    const client = new Client(dbConfig);
    await client.connect();
    
    try {
      await client.query('BEGIN');
      
      // PRIMERO: Verificar si el idFlujo existe en promociones_ttp (tabla padre)
      const checkParentQuery = 'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1';
      const checkParentResult = await client.query(checkParentQuery, [cuponesData.idFlujo]);
      
      if (checkParentResult.rows.length === 0) {
        // Si no existe en la tabla padre, retornar error
        await client.query('ROLLBACK');
        return {
          statusCode: 400,
          headers: headers,
          body: JSON.stringify({
            error: 'El idFlujo no existe en la tabla promociones_ttp',
            details: `No se pueden guardar datos de cupones para un idFlujo (${cuponesData.idFlujo}) que no existe en la tabla principal`
          })
        };
      }
      
      // SEGUNDO: Verificar si ya existe un registro con el mismo idFlujo en datos_cupones
      const checkQuery = 'SELECT id_datos_cupones FROM datos_cupones WHERE id_promociones_ttp = $1';
      const checkResult = await client.query(checkQuery, [cuponesData.idFlujo]);
      
      const exists = checkResult.rows.length > 0;
      
      if (exists) {
        // UPDATE - Si existe, actualizar
        console.log(`Actualizando cupones existentes para idFlujo: ${cuponesData.idFlujo}`);
        
        const updateQuery = `
          UPDATE datos_cupones 
          SET tipo_de_codigo = $1,
              vigencia = $2,
              cantidad_de_dias = $3,
              numero_de_unidades = $4,
              medio_canal = $5,
              id_campania = $6,
              responsable_modificacion = $7,
              ultima_modificacion = $8
          WHERE id_promociones_ttp = $9
          RETURNING id_datos_cupones
        `;
        
        const values = [
          cuponesData.tipo_de_codigo,
          cuponesData.vigencia,
          parseInt(cuponesData.cantidad_de_dias),
          parseInt(cuponesData.numero_de_unidades),
          JSON.stringify(cuponesData.medio_canal),
          cuponesData.id_campania,
          cuponesData.nombreEditor,
          fechaModConvertida,
          cuponesData.idFlujo
        ];
        
        console.log('UPDATE values:', values);
        const result = await client.query(updateQuery, values);
        
      } else {
        // INSERT - Si no existe, crear nuevo registro
        console.log(`Creando nuevos cupones para idFlujo: ${cuponesData.idFlujo}`);
        
        const insertQuery = `
          INSERT INTO datos_cupones 
          (id_promociones_ttp, tipo_de_codigo, vigencia, cantidad_de_dias, numero_de_unidades, medio_canal, id_campania, responsable_modificacion, ultima_modificacion)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id_datos_cupones
        `;
        
        const values = [
          cuponesData.idFlujo,
          cuponesData.tipo_de_codigo,
          cuponesData.vigencia,
          parseInt(cuponesData.cantidad_de_dias),
          parseInt(cuponesData.numero_de_unidades),
          JSON.stringify(cuponesData.medio_canal),
          cuponesData.id_campania,
          cuponesData.nombreEditor,
          fechaModConvertida
        ];
        
        console.log('INSERT values:', values);
        const result = await client.query(insertQuery, values);
      }
      
      await client.query('COMMIT');
      
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          message: exists ? 'Datos de cupones actualizados exitosamente' : 'Datos de cupones guardados exitosamente',
          idFlujo: cuponesData.idFlujo,
          tipo_de_codigo: cuponesData.tipo_de_codigo,
          vigencia: cuponesData.vigencia,
          cantidad_de_dias: cuponesData.cantidad_de_dias,
          numero_de_unidades: cuponesData.numero_de_unidades,
          id_campania: cuponesData.id_campania,
          action: exists ? 'updated' : 'created'
        })
      };
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Database error in cupones handler:', dbError);
      
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
    console.error('Error en cupones handler:', error);
    
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