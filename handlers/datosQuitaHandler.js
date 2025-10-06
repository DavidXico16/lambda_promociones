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
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;

  const partes = fecha.split('/');
  if (partes.length === 3) {
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }
  return fecha;
}

exports.handler = async (event) => {
  console.log('Event received:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight' })
    };
  }

  try {
    let body;
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (parseError) {
        console.log("parseError: ", parseError)
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'JSON inválido en la solicitud' })
        };
      }
    } else {
      body = event;
    }

    // Validar campos requeridos
    const requiredFields = ['tipoPromocion', 'datosQuita'];
    const missingFields = requiredFields.filter(f => !body[f]);
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Campos requeridos faltantes', missing: missingFields })
      };
    }

    const datosQuita = body.datosQuita;
    const requiredDatos = ['nombre', 'sub', 'nombreEditor', 'fecha_mod', 'status'];
    const missingDatos = requiredDatos.filter(f => !datosQuita[f]);
    if (missingDatos.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Campos faltantes en datosQuita', missing: missingDatos })
      };
    }

    const fechaModConvertida = convertirFecha(datosQuita.fecha_mod);
    const inicioVigenciaConvertida = convertirFecha(datosQuita.inicioVigencia);
    const finVigenciaConvertida = convertirFecha(datosQuita.finVigencia);

    const client = new Client(dbConfig);
    await client.connect();

    const existeFlujo = !!body.idflujo;
    console.log("body.idflujo: ", body.idflujo)
    console.log("¿Existe idflujo?:", existeFlujo);

    if (existeFlujo) {
      try {
        await client.query('BEGIN');

        const checkQuery = 'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1';
        const checkResult = await client.query(checkQuery, [body.idflujo]);
        const exists = checkResult.rows.length > 0;

        if (exists) {
          console.log(`Actualizando flujo existente: ${body.idflujo}`);

          // Actualiza promociones_ttp
          const updatePromocionesQuery = `
            UPDATE promociones_ttp
            SET responsable_modificacion = $1,
                ultima_modificacion = $2
            WHERE id_promociones_ttp = $3
          `;
          await client.query(updatePromocionesQuery, [
            datosQuita.nombreEditor,
            fechaModConvertida,
            body.idflujo
          ]);

          // Verifica si existe en datos_quitas
          const checkDatosQuery = 'SELECT id_datos_quitas FROM datos_quitas WHERE id_promociones_ttp = $1';
          const checkDatosResult = await client.query(checkDatosQuery, [body.idflujo]);

          if (checkDatosResult.rows.length > 0) {
            // Actualiza datos_quitas
            const updateDatosQuery = `
              UPDATE datos_quitas
              SET nombre = $1,
                  motivo_no_pago = $2,
                  area_responsable = $3,
                  inicio_vigencia = $4,
                  fin_vigencia = $5,
                  porcentaje_quita = $6,
                  monto_max_prorroteo = $7,
                  prorroteo_anticipado = $8,
                  tipo_quita = $9,
                  canales_front = $10,
                  descripcion = $11,
                  sub = $12,
                  nombre_editor = $13,
                  fecha_mod = $14,
                  status = $15,
                  responsable_modificacion = $16,
                  ultima_modificacion = CURRENT_TIMESTAMP
              WHERE id_promociones_ttp = $17
            `;

            await client.query(updateDatosQuery, [
              datosQuita.nombre,
              datosQuita.motivoNoPago,
              datosQuita.areaResponsable,
              inicioVigenciaConvertida,
              finVigenciaConvertida,
              datosQuita.porcentajeQuita,
              datosQuita.montoMaxProrroteo,
              datosQuita.prorroteoAnticipado === "1" || datosQuita.prorroteoAnticipado === true,
              datosQuita.tipoQuita,
              JSON.stringify(datosQuita.canales_front || []),
              datosQuita.descripcion,
              datosQuita.sub,
              datosQuita.nombreEditor,
              fechaModConvertida,
              datosQuita.status,
              datosQuita.nombreEditor,
              body.idflujo
            ]);
          }

          await client.query('COMMIT');
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Registro actualizado', idFlujo: body.idflujo })
          };
        }

        await client.query('ROLLBACK');
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: 'idflujo no encontrado', idflujo: body.idflujo })
        };

      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en actualización:', error);
        throw error;
      } finally {
        await client.end();
      }
    }

    // INSERT (nuevo flujo)
    try {
      await client.query('BEGIN');

      const lastIdQuery = `
        SELECT id_promociones_ttp 
        FROM promociones_ttp 
        ORDER BY id_promociones_ttp DESC 
        LIMIT 1
      `;
      const lastIdResult = await client.query(lastIdQuery);

      let ultimoId = 25000001;
      if (lastIdResult.rows.length > 0) {
        ultimoId = lastIdResult.rows[0].id_promociones_ttp;
      }

      if( ultimoId != null ){
        ultimoId++;
      }

      console.log(`Creando nuevo idflujo: ${ultimoId}`);

      // Inserta en promociones_ttp
      const insertPromocionesQuery = `
        INSERT INTO promociones_ttp
        (id_promociones_ttp, identificador_usuario, tipo_solicitud, responsable_creacion,
         area_creacion, estatus, nombre_promocion, fecha_creacion, responsable_modificacion, ultima_modificacion)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `;
      await client.query(insertPromocionesQuery, [
        ultimoId,
        datosQuita.sub,
        body.tipoPromocion,
        datosQuita.nombreEditor,
        datosQuita.areaResponsable,
        datosQuita.status,
        datosQuita.nombre,
        fechaModConvertida,
        datosQuita.nombreEditor,
        fechaModConvertida
      ]);

      // Inserta en datos_quitas
      const insertDatosQuery = `
        INSERT INTO datos_quitas
        (id_promociones_ttp, nombre, motivo_no_pago, area_responsable, inicio_vigencia, fin_vigencia,
         porcentaje_quita, monto_max_prorroteo, prorroteo_anticipado, tipo_quita,
         canales_front, descripcion, sub, nombre_editor, fecha_mod, status,
         responsable_modificacion, ultima_modificacion)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,CURRENT_TIMESTAMP)
      `;
      await client.query(insertDatosQuery, [
        ultimoId,
        datosQuita.nombre,
        datosQuita.motivoNoPago,
        datosQuita.areaResponsable,
        inicioVigenciaConvertida,
        finVigenciaConvertida,
        datosQuita.porcentajeQuita,
        datosQuita.montoMaxProrroteo,
        datosQuita.prorroteoAnticipado === "1" || datosQuita.prorroteoAnticipado === true,
        datosQuita.tipoQuita,
        JSON.stringify(datosQuita.canales_front || []),
        datosQuita.descripcion,
        datosQuita.sub,
        datosQuita.nombreEditor,
        fechaModConvertida,
        datosQuita.status,
        datosQuita.nombreEditor
      ]);

      await client.query('COMMIT');
      await client.end();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Registro creado exitosamente',
          idflujo: ultimoId.toString(),
          action: 'created'
        })
      };

    } catch (error) {
      await client.query('ROLLBACK');
      await client.end();
      console.error('Error en inserción:', error);
      throw error;
    }

  } catch (error) {
    console.error('Error general:', error);
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
