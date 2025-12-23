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

// Función para convertir fecha ISO a formato PostgreSQL
function convertirFecha(fecha) {
  if (!fecha) return null;
  
  // Si ya es una fecha ISO, extraer solo la parte YYYY-MM-DD
  if (fecha.includes('T')) {
    return fecha.split('T')[0]; // Extraer solo la fecha (YYYY-MM-DD)
  }
  
  // Si es DD/MM/YYYY, convertir a YYYY-MM-DD
  const partes = fecha.split('/');
  if (partes.length === 3) {
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }

  return fecha;
}

exports.handler = async (event) => {
  console.log('\n===== EVENTO RECEIVED =====');
  console.log(JSON.stringify(event, null, 2));
  console.log('===========================\n');

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
        console.log("❌ ERROR AL PARSEAR BODY:", parseError);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Cuerpo de solicitud JSON inválido' })
        };
      }
    } else {
      body = event;
    }

    console.log("\n===== BODY PARSEADO =====");
    console.log(JSON.stringify(body, null, 2));
    console.log("=========================\n");

    // Validaciones
    const requiredFields = ['idFlujo', 'datos_condiciones'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Campos requeridos faltantes',
          missing: missingFields
        })
      };
    }

    const datosCondiciones = body.datos_condiciones;

    const requiredDatosFields = ['sub', 'nombreEditor', 'fecha_mod'];
    const missingDatosFields = requiredDatosFields.filter(field => !datosCondiciones[field]);

    if (missingDatosFields.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Campos requeridos faltantes en datos_condiciones',
          missing: missingDatosFields
        })
      };
    }

    // Convertir fecha ISO a YYYY-MM-DD
    const fechaModConvertida = convertirFecha(datosCondiciones.fecha_mod);
    console.log("Fecha convertida:", fechaModConvertida);

    const client = new Client(dbConfig);
    await client.connect();

    try {
      await client.query('BEGIN');

      const checkQuery = `
        SELECT id_datos_condiciones 
        FROM datos_condiciones 
        WHERE id_promociones_ttp = $1
      `;

      const checkResult = await client.query(checkQuery, [body.idFlujo]);
      const exists = checkResult.rows.length > 0;

      if (exists) {
        // ================================================
        // UPDATE
        // ================================================
        console.log("\n===== REALIZANDO UPDATE =====");
        
        // Construir la query base
        let updateQuery = `
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
              comentarios = $15,
              sub = $16,
              nombre_editor = $17,
              fecha_mod = $18,
              responsable_modificacion = $19,
              ultima_modificacion = CURRENT_TIMESTAMP,
              descuento_empleado = $20,
              perfil_promociones = $21
        `;
        
        // Valores base
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
          datosCondiciones.comentarios,
          datosCondiciones.sub,
          datosCondiciones.nombreEditor,
          fechaModConvertida,
          datosCondiciones.nombreEditor,
          datosCondiciones.descuento_empleado,
          JSON.stringify(datosCondiciones.perfil_promociones || [])
        ];

        // Si hay adicionales, agregarlo como nuevo parámetro
        let paramCounter = values.length + 1;
        if (body.adicionales) {
          updateQuery += `, adicional = $${paramCounter}`;
          values.push(JSON.stringify(body.adicionales));
          paramCounter++;
        }

        // Agregar WHERE
        updateQuery += ` WHERE id_promociones_ttp = $${paramCounter} RETURNING id_datos_condiciones`;
        values.push(body.idFlujo);

        console.log("UPDATE Query:", updateQuery);
        console.log("UPDATE Valores:", values);
        console.log("Total parámetros:", values.length);

        await client.query(updateQuery, values);

      } else {
        // ================================================
        // INSERT
        // ================================================
        console.log("\n===== REALIZANDO INSERT =====");

        // Preparar valores
        const values = [
          body.idFlujo,                                 // $1
          datosCondiciones.urgente,                     // $2
          datosCondiciones.fin_promocion_y_producto,    // $3
          datosCondiciones.campania_r_l_bot,            // $4
          datosCondiciones.descuento_de_por_vida,       // $5
          datosCondiciones.bestfit,                     // $6
          datosCondiciones.prorroteo,                   // $7
          datosCondiciones.no_visible_en_front,         // $8
          datosCondiciones.determina_promocion,         // $9
          datosCondiciones.es_comisionable,             // $10
          datosCondiciones.cupon,                       // $11
          datosCondiciones.meses_pago_adelantado,       // $12
          datosCondiciones.porcentaje_pago_adelantado,  // $13
          datosCondiciones.automatica,                  // $14
          datosCondiciones.condiciones_promociones,     // $15
          datosCondiciones.comentarios,                 // $16
          datosCondiciones.sub,                         // $17
          datosCondiciones.nombreEditor,                // $18
          fechaModConvertida,                           // $19
          datosCondiciones.nombreEditor,                // $20 (responsable_modificacion)
          datosCondiciones.descuento_empleado,          // $21
          JSON.stringify(datosCondiciones.perfil_promociones || [])  // $22
        ];
        
        // Construir query dinámicamente
        let insertQuery = `
          INSERT INTO datos_condiciones (
            id_promociones_ttp, 
            urgente, 
            fin_promocion_y_producto, 
            campania_r_l_bot, 
            descuento_de_por_vida, 
            bestfit, 
            prorroteo, 
            no_visible_en_front, 
            determina_promocion, 
            es_comisionable, 
            cupon, 
            meses_pago_adelantado, 
            porcentaje_pago_adelantado, 
            automatica, 
            condiciones_promociones, 
            comentarios, 
            sub, 
            nombre_editor, 
            fecha_mod, 
            fecha_creacion, 
            responsable_modificacion, 
            ultima_modificacion, 
            descuento_empleado, 
            perfil_promociones
        `;
        
        let placeholders = `
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, 
            CURRENT_TIMESTAMP, $20, CURRENT_TIMESTAMP, $21, $22
        `;
        
        // Agregar adicionales si existen
        if (body.adicionales) {
          insertQuery += `, adicional`;
          placeholders += `, $${values.length + 1}`;
          values.push(JSON.stringify(body.adicionales));
        }
        
        insertQuery += `) VALUES (${placeholders}) RETURNING id_datos_condiciones`;

        console.log("INSERT Query:", insertQuery);
        console.log("INSERT Valores:", values);
        console.log("Total parámetros:", values.length);

        await client.query(insertQuery, values);
      }

      await client.query('COMMIT');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: exists ? 'Condiciones actualizadas exitosamente' : 'Condiciones guardadas exitosamente',
          idFlujo: body.idFlujo,
          action: exists ? 'updated' : 'created'
        })
      };

    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('\n❌ ERROR EN BASE DE DATOS:');
      console.error("Mensaje:", dbError.message);
      console.error("Stack:", dbError.stack);
      
      // Log detallado del error
      if (dbError.code) {
        console.error("Código error PostgreSQL:", dbError.code);
      }
      if (dbError.position) {
        console.error("Posición error:", dbError.position);
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Error interno del servidor',
          details: dbError.message,
          code: dbError.code
        })
      };
    } finally {
      await client.end();
    }

  } catch (error) {
    console.error('\n❌ ERROR GENERAL:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error interno del servidor',
        details: error.message
      })
    };
  }
};