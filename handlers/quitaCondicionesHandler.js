const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

exports.handler = async (event) => {
  console.log('Insertar/Actualizar datos_quitas_condiciones - Event received:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS preflight' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    console.log("Parsed body:", body);

    // Validar campos principales
    if (!body.idflujo || !body.datosCondiciones) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Campos requeridos faltantes: idflujo o datosCondiciones',
        }),
      };
    }

    const idFlujo = parseInt(body.idflujo);
    if (isNaN(idFlujo)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'El campo idflujo debe ser numérico válido' }),
      };
    }

    const datos = body.datosCondiciones;

    const requiredFields = [
      'tipoReloj',
      'antiguedadCuenta',
      'tiempoMinMoraDias',
      'TiempoMaxMoraDias',
      'recurrenciaTiempo',
      'recurrenciaCantidad',
      'urgente',
      'sub',
      'nombreEditor',
      'fecha_mod',
      'status',
    ];

    const missingFields = requiredFields.filter(f => !datos[f]);
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Campos faltantes en datosCondiciones',
          missingFields,
        }),
      };
    }

    //Verificar si el idFlujo existe en promociones_ttp (tabla padre)
    const checkParentQuery = 'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1';
    const checkParentResult = await pool.query(checkParentQuery, [body.idflujo]);

    console.log("checkParentResult: ", checkParentResult)
      
    if (checkParentResult.rows.length === 0) {
        return {
          statusCode: 400,
          headers: headers,
          body: JSON.stringify({
            error: 'El idFlujo no existe ',
            details: `idFlujo (${body.idflujo})`
          })
        };
    }

    // Verificar si ya existe el registro
    const checkQuery = `SELECT id_datos_quitas_condiciones 
                        FROM datos_quitas_condiciones 
                        WHERE id_promociones_ttp = $1`;
    const checkResult = await pool.query(checkQuery, [idFlujo]);
    const exists = checkResult.rows.length > 0;

    if (exists) {
      // --- UPDATE ---
      console.log(`Actualizando condiciones existentes para idFlujo: ${idFlujo}`);

      const updateQuery = `
        UPDATE public.datos_quitas_condiciones
        SET tipo_reloj = $2,
            antiguedad_cuenta = $3,
            tiempo_min_mora_dias = $4,
            tiempo_max_mora_dias = $5,
            recurrencia_tiempo = $6,
            recurrencia_cantidad = $7,
            urgente = $8,
            sub = $9,
            nombre_editor = $10,
            fecha_mod = $11,
            status = $12
        WHERE id_promociones_ttp = $1
        RETURNING id_datos_quitas_condiciones;
      `;

      const updateValues = [
        idFlujo,
        datos.tipoReloj,
        datos.antiguedadCuenta,
        datos.tiempoMinMoraDias,
        datos.TiempoMaxMoraDias,
        datos.recurrenciaTiempo,
        datos.recurrenciaCantidad,
        datos.urgente,
        datos.sub,
        datos.nombreEditor,
        datos.fecha_mod,
        datos.status
      ];

      const updateResult = await pool.query(updateQuery, updateValues);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Registro actualizado correctamente en datos_quitas_condiciones',
          idFlujo,
          idRegistro: updateResult.rows[0].id_datos_quitas_condiciones,
        }),
      };

    } else {
      // --- INSERT ---
      console.log(`Insertando nuevo registro para idFlujo: ${idFlujo}`);

      const insertQuery = `
        INSERT INTO public.datos_quitas_condiciones (
          id_promociones_ttp,
          tipo_reloj,
          antiguedad_cuenta,
          tiempo_min_mora_dias,
          tiempo_max_mora_dias,
          recurrencia_tiempo,
          recurrencia_cantidad,
          urgente,
          sub,
          nombre_editor,
          fecha_mod,
          status
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id_datos_quitas_condiciones;
      `;

      const insertValues = [
        idFlujo,
        datos.tipoReloj,
        datos.antiguedadCuenta,
        datos.tiempoMinMoraDias,
        datos.TiempoMaxMoraDias,
        datos.recurrenciaTiempo,
        datos.recurrenciaCantidad,
        datos.urgente,
        datos.sub,
        datos.nombreEditor,
        datos.fecha_mod,
        datos.status
      ];

      const insertResult = await pool.query(insertQuery, insertValues);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          message: 'Registro insertado correctamente en datos_quitas_condiciones',
          idFlujo,
          idRegistro: insertResult.rows[0].id_datos_quitas_condiciones,
        }),
      };
    }

  } catch (error) {
    console.error('Error al insertar/actualizar datos_quitas_condiciones:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error interno del servidor',
        details: error.message,
      }),
    };
  }
};
