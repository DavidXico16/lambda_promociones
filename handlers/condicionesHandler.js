// handlers/condicionesHandler.js
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
    
    // Validar campos requeridos
    const requiredFields = ['idFlujo', 'datos_condiciones'];
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
    
    // Validar campos dentro de datos_condiciones
    const datosCondiciones = body.datos_condiciones;
    const requiredDatosFields = ['sub', 'nombreEditor', 'fecha_mod'];
    const missingDatosFields = requiredDatosFields.filter(field => !datosCondiciones[field]);
    
    if (missingDatosFields.length > 0) {
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ 
          error: 'Campos requeridos faltantes en datos_condiciones', 
          missing: missingDatosFields 
        })
      };
    }
    
    // Convertir formato de fecha
    const fechaModConvertida = convertirFecha(datosCondiciones.fecha_mod);
    
    const client = new Client(dbConfig);
    await client.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verificar si ya existe un registro con el mismo idFlujo
      const checkQuery = 'SELECT id_datos_condiciones FROM datos_condiciones WHERE id_promociones_ttp = $1';
      const checkResult = await client.query(checkQuery, [body.idFlujo]);
      
      const exists = checkResult.rows.length > 0;
      
      if (exists) {
        // UPDATE - Si existe, actualizar
        console.log(`Actualizando condiciones existentes para idFlujo: ${body.idFlujo}`);
        
        const updateQuery = `
          UPDATE datos_condiciones 
          SET urgente = $1,
              fin_promocion_y_producto = $2,
              campania_r_l_bot = $3,
              descuento_de_por_vida = $4,
              bestfit = $5,
              prorroteo = $6,
              no_visible_en_front = $7,
              determina_promocion = $8,
              es_comisionable = $9,
              cupon = $10,
              meses_pago_adelantado = $11,
              porcentaje_pago_adelantado = $12,
              automatica = $13,
              condiciones_promociones = $14,
              perfil_promociones = $15,
              comentarios = $16,
              sub = $17,
              nombre_editor = $18,
              fecha_mod = $19,
              responsable_modificacion = $20,
              ultima_modificacion = CURRENT_TIMESTAMP
          WHERE id_promociones_ttp = $21
          RETURNING id_datos_condiciones
        `;
        
        const values = [
          datosCondiciones.urgente,
          datosCondiciones.fin_promocion_y_producto,
          datosCondiciones.campania_r_l_bot,
          datosCondiciones.descuento_de_por_vida,
          datosCondiciones.bestfit,
          datosCondiciones.prorroteo,
          datosCondiciones.no_visible_en_front,
          datosCondiciones.determina_promocion,
          datosCondiciones.es_comisionable,
          datosCondiciones.cupon,
          datosCondiciones.meses_pago_adelantado,
          datosCondiciones.porcentaje_pago_adelantado,
          datosCondiciones.automatica,
          datosCondiciones.condiciones_promociones,
          datosCondiciones.perfil_promociones,
          datosCondiciones.comentarios,
          datosCondiciones.sub,
          datosCondiciones.nombreEditor,
          fechaModConvertida,
          datosCondiciones.nombreEditor, // responsable_modificacion usa el mismo valor que nombre_editor
          body.idFlujo
        ];
        
        console.log('UPDATE values:', values);
        const result = await client.query(updateQuery, values);
        
      } else {
        // INSERT - Si no existe, crear nuevo registro
        console.log(`Creando nuevas condiciones para idFlujo: ${body.idFlujo}`);
        
        const insertQuery = `
          INSERT INTO datos_condiciones 
          (id_promociones_ttp, urgente, fin_promocion_y_producto, campania_r_l_bot,
           descuento_de_por_vida, bestfit, prorroteo, no_visible_en_front, determina_promocion,
           es_comisionable, cupon, meses_pago_adelantado, porcentaje_pago_adelantado, automatica,
           condiciones_promociones, perfil_promociones, comentarios, sub, 
           nombre_editor, fecha_mod, responsable_modificacion, ultima_modificacion)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP)
          RETURNING id_datos_condiciones
        `;
        
        const values = [
          body.idFlujo,
          datosCondiciones.urgente,
          datosCondiciones.fin_promocion_y_producto,
          datosCondiciones.campania_r_l_bot,
          datosCondiciones.descuento_de_por_vida,
          datosCondiciones.bestfit,
          datosCondiciones.prorroteo,
          datosCondiciones.no_visible_en_front,
          datosCondiciones.determina_promocion,
          datosCondiciones.es_comisionable,
          datosCondiciones.cupon,
          datosCondiciones.meses_pago_adelantado,
          datosCondiciones.porcentaje_pago_adelantado,
          datosCondiciones.automatica,
          datosCondiciones.condiciones_promociones,
          datosCondiciones.perfil_promociones,
          datosCondiciones.comentarios,
          datosCondiciones.sub,
          datosCondiciones.nombreEditor, // nombre_editor
          fechaModConvertida, // fecha_mod
          datosCondiciones.nombreEditor, // responsable_modificacion (mismo que nombre_editor)
        ];
        
        console.log('INSERT values:', values);
        console.log('Number of values:', values.length);
        const result = await client.query(insertQuery, values);
      }
      
      await client.query('COMMIT');
      
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          message: exists ? 'Condiciones actualizadas exitosamente' : 'Condiciones guardadas exitosamente',
          idFlujo: body.idFlujo,
          action: exists ? 'updated' : 'created'
        })
      };
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Database error in condiciones handler:', dbError);
      
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