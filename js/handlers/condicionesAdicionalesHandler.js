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
      
      // Verificar si ya existe un registro con el mismo idflujo
      const checkQuery = 'SELECT id_datos_condiciones FROM datos_condiciones WHERE id_promociones_ttp = $1';
      const checkResult = await client.query(checkQuery, [body.idflujo]);
      
      const exists = checkResult.rows.length > 0;
      
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
        
      } else {
        // INSERT - Si no existe, crear nuevo registro con solo los campos necesarios
        console.log(`Creando nuevo registro con campo adicional para idflujo: ${body.idflujo}`);
        
        const insertQuery = `
          INSERT INTO datos_condiciones 
          (
            id_promociones_ttp, adicional, sub, nombre_editor, fecha_mod, 
            responsable_modificacion, ultima_modificacion,
            urgente, fin_promocion_y_producto, campania_r_l_bot,
            descuento_de_por_vida, bestfit, prorroteo, no_visible_en_front, 
            determina_promocion, es_comisionable, cupon, meses_pago_adelantado, 
            porcentaje_pago_adelantado, automatica, condiciones_promociones, 
            perfil_promociones, comentarios
          )
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP,
                  $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          RETURNING id_datos_condiciones
        `;
        
        const values = [
          body.idflujo,                                    // $1
          JSON.stringify(body.adicionales),                // $2
          body.sub,                                        // $3
          body.nombreEditor,                               // $4
          fechaModConvertida,                              // $5
          body.nombreEditor,                               // $6 - responsable_modificacion
          false,                                           // $7 - urgente
          false,                                           // $8 - fin_promocion_y_producto
          false,                                           // $9 - campania_r_l_bot
          false,                                           // $10 - descuento_de_por_vida
          false,                                           // $11 - bestfit
          false,                                           // $12 - prorroteo
          false,                                           // $13 - no_visible_en_front
          false,                                           // $14 - determina_promocion
          false,                                           // $15 - es_comisionable
          false,                                           // $16 - cupon
          0,                                               // $17 - meses_pago_adelantado
          0.00,                                            // $18 - porcentaje_pago_adelantado
          '',                                              // $19 - automatica
          '',                                              // $20 - condiciones_promociones
          '',                                              // $21 - perfil_promociones
          ''                                               // $22 - comentarios
        ];
        
        console.log('INSERT adicional values:', values);
        console.log('Number of values for INSERT:', values.length);
        //const result = await client.query(insertQuery, values);
      }
      
      await client.query('COMMIT');
      
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          message: exists ? 'Campo adicional actualizado exitosamente' : 'Registro creado con campo adicional exitosamente',
          idflujo: body.idflujo,
          action: exists ? 'updated' : 'created',
          adicionales: body.adicionales
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