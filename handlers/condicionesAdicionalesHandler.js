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
  console.log('Condiciones handler - Event received:', JSON.stringify(event, null, 2));
  
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
        console.log("condiciones adicionales parseError: ", parseError);
        return {
          statusCode: 400,
          headers: headers,
          body: JSON.stringify({ error: 'Cuerpo de solicitud JSON inválido' })
        };
      }
    } else {
      body = event;
    }
    
    const requiredFields = ['idflujo', 'adicionales', 'sub', 'nombreEditor', 'fecha_mod'];
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
    
    if (!Array.isArray(body.adicionales)) {
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ 
          error: 'El campo adicionales debe ser un array' 
        })
      };
    }
    
    const fechaModConvertida = convertirFecha(body.fecha_mod);
    
    const client = new Client(dbConfig);
    await client.connect();
    
    try {
      await client.query('BEGIN');
      
      const checkFlujo = await client.query(
        'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1',
        [body.idFlujo]
      );

      if (checkFlujo.rows.length === 0) {
        return {
          statusCode: 404,
          headers: defaultHeaders(),
          body: JSON.stringify({
            error: 'El idFlujo no existe en la tabla promociones_ttp'
          })
        };
      }

      // Verificar si ya existe un registro con el mismo idflujo
      const checkQuery = 'SELECT promociones_tt, adicional FROM datos_condiciones WHERE id_promociones_ttp = $1';
      const checkResult = await client.query(checkQuery, [body.idflujo]);
      
      const exists = checkResult.rows.length > 0;

      console.log("result checkResult: ", checkResult);

      
      if (exists) {
        // UPDATE - Si existe, actualizar solo el campo adicional
        console.log(`Actualizando campo adicional para idflujo: ${body.idflujo}`);
        
        const updateQuery = `
          UPDATE datos_condiciones 
          SET adicional = $1,
              sub = $2,
              nombre_editor = $3,
              fecha_mod = $4,
              responsable_modificacion = $5,
              ultima_modificacion = CURRENT_TIMESTAMP
          WHERE id_promociones_ttp = $6
          RETURNING id_datos_condiciones
        `;
        
        const values = [
          JSON.stringify(body.adicionales), 
          body.sub,
          body.nombreEditor,
          fechaModConvertida,
          body.nombreEditor,
          body.idflujo
        ];
        
        console.log('UPDATE adicional values:', values);
        const result = await client.query(updateQuery, values);


        console.log("--result: ", result)
        
      } else {
          await client.query('ROLLBACK');
          return {
            statusCode: 400, headers, body: JSON.stringify({
              error: 'El idFlujo no existe',
              details: `No se pueden registar los datos para idFlujo (${body.idflujo})`
            })
          };
      }
      
      await client.query('COMMIT');
      
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          message: 'Campo adicional registrado exitosamente',
          idflujo: body.idflujo
        })
      };
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Database error in condiciones handler:', dbError);
      
      return {
        statusCode: 500,
        headers: headers,
        body: JSON.stringify({
          error: 'Error en la base de datos',
          details: dbError.message
        })
      };
    } finally {
      await client.end();
    }
    
  } catch (error) {
    console.error('Error en condiciones handler:', error);
    
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