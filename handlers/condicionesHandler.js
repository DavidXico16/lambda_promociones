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

    const fechaModConvertida = convertirFecha(datosCondiciones.fecha_mod);

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
        console.log("\n===== DEBUG UPDATE START =====");
        console.log("perfil_promociones:", datosCondiciones.perfil_promociones);
        console.log("descuento_empleado:", datosCondiciones.descuento_empleado);
        console.log("adicionales:", body.adicionales);
        console.log("===== DEBUG UPDATE END =====\n");

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
              perfil_promociones = $15,
              comentarios = $16,
              sub = $17,
              nombre_editor = $18,
              fecha_mod = $19,
              responsable_modificacion = $20,
              descuento_empleado = $21,
              ultima_modificacion = CURRENT_TIMESTAMP
        `;
        
        // Solo agregamos adicional si viene
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

          JSON.stringify(datosCondiciones.perfil_promociones), 

          datosCondiciones.comentarios,
          datosCondiciones.sub,
          datosCondiciones.nombreEditor,
          fechaModConvertida,
          datosCondiciones.nombreEditor,
          datosCondiciones.descuento_empleado
        ];

        if (body.adicionales) {
          updateQuery += `, adicional = $21`;
          values.push(JSON.stringify(body.adicionales));
        }

        updateQuery += ` WHERE id_promociones_ttp = $${values.length + 1} RETURNING id_datos_condiciones`;
        values.push(body.idFlujo);

        console.log("\n===== FINAL UPDATE QUERY =====");
        console.log(updateQuery);
        console.log("===== FINAL UPDATE VALUES =====");
        console.log(values);
        console.log("================================\n");

        await client.query(updateQuery, values);

      } else {
        // ================================================
        // INSERT
        // ================================================
        console.log("\n===== DEBUG INSERT START =====");
        console.log("perfil_promociones:", datosCondiciones.perfil_promociones);
        console.log("descuento_empleado:", datosCondiciones.descuento_empleado);
        console.log("adicionales:", body.adicionales);
        console.log("===== DEBUG INSERT END =====\n");

        let insertFields = `
          id_promociones_ttp, urgente, fin_promocion_y_producto, campania_r_l_bot,
          descuento_de_por_vida, bestfit, prorroteo, no_visible_en_front, determina_promocion,
          es_comisionable, cupon, meses_pago_adelantado, porcentaje_pago_adelantado, automatica,
          condiciones_promociones, perfil_promociones, comentarios, sub, 
          nombre_editor, fecha_mod, responsable_modificacion, descuento_empleado, ultima_modificacion
        `;

        let placeholders = `
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, CURRENT_TIMESTAMP
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

          JSON.stringify(datosCondiciones.perfil_promociones), // 🔥 FIX JSON

          datosCondiciones.comentarios,
          datosCondiciones.sub,
          datosCondiciones.nombreEditor,
          fechaModConvertida,
          datosCondiciones.nombreEditor,
          datosCondiciones.descuento_empleado
        ];

        if (body.adicionales) {
          insertFields += `, adicional`;
          placeholders += `, $${values.length + 1}`;
          values.push(JSON.stringify(body.adicionales));
        }

        const insertQuery = `
          INSERT INTO datos_condiciones (${insertFields})
          VALUES (${placeholders})
          RETURNING id_datos_condiciones
        `;

        console.log("\n===== FINAL INSERT QUERY =====");
        console.log(insertQuery);
        console.log("===== FINAL INSERT VALUES =====");
        console.log(values);
        console.log("================================\n");

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
      console.error(dbError);

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Error interno del servidor',
          details: dbError.message
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