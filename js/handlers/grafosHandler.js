// handlers/grafosHandler.js
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
  console.log('Grafos handler - Event received:', JSON.stringify(event, null, 2));
  
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
    const requiredFields = ['nodes', 'edges', 'tipoSolicitud', 'idFlujo', 'sub', 'nombreEditor', 'fecha_mod'];
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
        // Si no existe en la tabla padre, retornar error
        await client.query('ROLLBACK');
        return {
          statusCode: 400,
          headers: headers,
          body: JSON.stringify({
            error: 'El idFlujo no existe en la tabla promociones_ttp',
            details: `No se pueden guardar datos de grafos para un idFlujo (${body.idFlujo}) que no existe en la tabla principal`
          })
        };
      }
      
      // SEGUNDO: Verificar si ya existe un registro con el mismo idFlujo en datos_nodos
      const checkQuery = 'SELECT id_datos_nodos FROM datos_nodos WHERE id_promociones_ttp = $1';
      const checkResult = await client.query(checkQuery, [body.idFlujo]);
      
      const exists = checkResult.rows.length > 0;
      
      if (exists) {
        // UPDATE - Si existe, actualizar
        console.log(`Actualizando grafos existentes para idFlujo: ${body.idFlujo}`);
        
        const updateQuery = `
          UPDATE datos_nodos 
          SET nodes = $1,
              edges = $2,
              tipo_solicitud = $3,
              responsable_modificacion = $4,
              ultima_modificacion = $5
          WHERE id_promociones_ttp = $6
          RETURNING id_datos_nodos
        `;
        
        const values = [
          JSON.stringify(body.nodes),
          JSON.stringify(body.edges),
          body.tipoSolicitud,
          body.nombreEditor,
          fechaModConvertida,
          body.idFlujo,
         
        ];
        
        console.log('UPDATE values:', values);
        const result = await client.query(updateQuery, values);
        
      } else {
        // INSERT - Si no existe, crear nuevo registro
        console.log(`Creando nuevos grafos para idFlujo: ${body.idFlujo}`);
        
        const insertQuery = `
          INSERT INTO datos_nodos 
          (id_promociones_ttp, nodes, edges, tipo_solicitud, responsable_modificacion, ultima_modificacion)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id_datos_nodos
        `;
        
        const values = [
          body.idFlujo,
          JSON.stringify(body.nodes),
          JSON.stringify(body.edges),
          body.tipoSolicitud,
          body.nombreEditor,
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
          message: exists ? 'Grafos actualizados exitosamente' : 'Grafos guardados exitosamente',
          idFlujo: body.idFlujo,
          tipoSolicitud: body.tipoSolicitud,
          totalNodes: body.nodes.length,
          totalEdges: body.edges.length,
          action: exists ? 'updated' : 'created'
        })
      };
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Database error in grafos handler:', dbError);
      
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
    console.error('Error en grafos handler:', error);
    
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