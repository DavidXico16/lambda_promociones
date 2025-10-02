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
    
    const requiredFields = ['idflujo','tipoPromocion', 'datosPromocion'];
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
    
    // Validar campos dentro de datosPromocion
    const datosPromocion = body.datosPromocion;
    const requiredDatosFields = ['nombre', 'sub', 'nombreEditor', 'fecha_mod', 'status'];
    const missingDatosFields = requiredDatosFields.filter(field => !datosPromocion[field]);
    
    if (missingDatosFields.length > 0) {
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ 
          error: 'Campos requeridos faltantes en datosPromocion', 
          missing: missingDatosFields 
        })
      };
    }
    
    // Convertir formatos de fecha
    const fechaModConvertida = convertirFecha(datosPromocion.fecha_mod);
    const inicioVigenciaConvertida = convertirFecha(datosPromocion.inicioVigencia);
    const finVigenciaConvertida = convertirFecha(datosPromocion.finVigencia);
    
    const client = new Client(dbConfig);
    await client.connect();


    // Obtener el último id_promociones_ttp
    const lastIdQuery = `
      SELECT id_promociones_ttp 
      FROM promociones_ttp 
      ORDER BY id_promociones_ttp DESC 
      LIMIT 1
    `;
    const lastIdResult = await client.query(lastIdQuery);

    let ultimoId = null;
    if (lastIdResult.rows.length > 0) {
      ultimoId = lastIdResult.rows[0].id_promociones_ttp;
    }

    if( ultimoId != null ){
      ultimoId++;
    }

    console.log("Último id_promociones_ttp en promociones_ttp:", ultimoId);


    
    try {
      await client.query('BEGIN');
      
      let exists = false;

      // Verificar si el idflujo ya existe en promociones_ttp
      if( body.idflujo != null ){
        const checkQuery = 'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1';
        const checkResult = await client.query(checkQuery, [body.idflujo]);
        
        exists = checkResult.rows.length > 0;
      }
      
      
      if (exists) {
        // UPDATE - Si existe el idflujo, actualizar ambas tablas
        console.log(`Actualizando registro existente con idflujo: ${body.idflujo}`);
        
        // Actualizar tabla promociones_ttp
        const updatePromocionesQuery = `
          UPDATE promociones_ttp 
          SET identificador_usuario = $1,
              tipo_solicitud = $2, 
              responsable_creacion = $3, 
              area_creacion = $4, 
              estatus = $5, 
              nombre_promocion = $6, 
              fecha_creacion = $7
          WHERE id_promociones_ttp = $8
          RETURNING id_promociones_ttp
        `;
        
        const promocionesValues = [
          datosPromocion.sub,
          body.tipoPromocion,
          datosPromocion.nombreEditor,
          datosPromocion.areaResponsable,
          datosPromocion.status,
          datosPromocion.nombre,
          fechaModConvertida,
          body.idflujo
        ];
        
        await client.query(updatePromocionesQuery, promocionesValues);
        
        // Verificar si existe en datos_promociones
        const checkDatosQuery = 'SELECT id_datos_promociones FROM datos_promociones WHERE id_promociones_ttp = $1';
        const checkDatosResult = await client.query(checkDatosQuery, [body.idflujo]);
        
        if (checkDatosResult.rows.length > 0) {
          // UPDATE en datos_promociones
          const updateDatosQuery = `
            UPDATE datos_promociones 
            SET nombre_promosion = $1,
                nombre_homologado = $2,
                area_responsable = $3,
                tipo_promocion = $4,
                inicio_vigencia = $5,
                fin_vigencia = $6,
                area_solicitante = $7,
                categoria = $8,
                unidad_negocio = $9,
                tipo_venta = $10,
                referencia = $11,
                cancelacion_enrutamiento = $12,
                canales_front = $13,
                fecha_creacion = $14,
                responsable_modificacion = $15,
                ultima_modificacion = CURRENT_TIMESTAMP
            WHERE id_promociones_ttp = $16
          `;
          
          const datosValues = [
            datosPromocion.nombre,
            datosPromocion.nombreHomologado,
            datosPromocion.areaResponsable,
            body.tipoPromocion,
            inicioVigenciaConvertida,
            finVigenciaConvertida,
            JSON.stringify(datosPromocion.area_solicitante || []),
            JSON.stringify(datosPromocion.categoria || []),
            datosPromocion.unidadNegocio,
            datosPromocion.tipoVenta,
            JSON.stringify(datosPromocion.referencia || []),
            datosPromocion.cancelacionEnrutamiento,
            JSON.stringify(datosPromocion.canales_front || []),
            fechaModConvertida,
            datosPromocion.nombreEditor,
            body.idflujo
          ];
          
          await client.query(updateDatosQuery, datosValues);
        } else {






          // INSERT en datos_promociones (si no existe)
          const insertDatosQuery = `
            INSERT INTO datos_promociones 
            (id_promociones_ttp, nombre_promosion, nombre_homologado, area_responsable,
             tipo_promocion, inicio_vigencia, fin_vigencia, area_solicitante, categoria,
             unidad_negocio, tipo_venta, referencia, cancelacion_enrutamiento, canales_front,
             fecha_creacion, responsable_modificacion, ultima_modificacion)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
          `;
          
          const datosValues = [
            body.idflujo,
            datosPromocion.nombre,
            datosPromocion.nombreHomologado,
            datosPromocion.areaResponsable,
            body.tipoPromocion,
            inicioVigenciaConvertida,
            finVigenciaConvertida,
            JSON.stringify(datosPromocion.area_solicitante || []),
            JSON.stringify(datosPromocion.categoria || []),
            datosPromocion.unidadNegocio,
            datosPromocion.tipoVenta,
            JSON.stringify(datosPromocion.referencia || []),
            datosPromocion.cancelacionEnrutamiento,
            JSON.stringify(datosPromocion.canales_front || []),
            fechaModConvertida,
            datosPromocion.nombreEditor
          ];
          
          await client.query(insertDatosQuery, datosValues);
        }
        
      } else {
        // INSERT - Si no existe el idflujo, crear nuevo registro
        console.log(`Creando nuevo registro con idflujo: ${ultimoId}`);
        
        // Insertar en tabla promociones_ttp
        const insertPromocionesQuery = `
          INSERT INTO promociones_ttp 
          (id_promociones_ttp, identificador_usuario, tipo_solicitud, responsable_creacion, 
           area_creacion, estatus, nombre_promocion, fecha_creacion)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id_promociones_ttp
        `;
        
        const promocionesValues = [
          ultimoId,
          datosPromocion.sub,
          body.tipoPromocion,
          datosPromocion.nombreEditor,
          datosPromocion.areaResponsable,
          datosPromocion.status,
          datosPromocion.nombre,
          fechaModConvertida
        ];
        
        await client.query(insertPromocionesQuery, promocionesValues);
        
        // Insertar en tabla datos_promociones
        const insertDatosQuery = `
          INSERT INTO datos_promociones 
          (id_promociones_ttp, nombre_promosion, nombre_homologado, area_responsable,
           tipo_promocion, inicio_vigencia, fin_vigencia, area_solicitante, categoria,
           unidad_negocio, tipo_venta, referencia, cancelacion_enrutamiento, canales_front,
           fecha_creacion, responsable_modificacion, ultima_modificacion)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
        `;
        
        const datosValues = [
          ultimoId,
          datosPromocion.nombre,
          datosPromocion.nombreHomologado,
          datosPromocion.areaResponsable,
          body.tipoPromocion,
          inicioVigenciaConvertida,
          finVigenciaConvertida,
          JSON.stringify(datosPromocion.area_solicitante || []),
          JSON.stringify(datosPromocion.categoria || []),
          datosPromocion.unidadNegocio,
          datosPromocion.tipoVenta,
          JSON.stringify(datosPromocion.referencia || []),
          datosPromocion.cancelacionEnrutamiento,
          JSON.stringify(datosPromocion.canales_front || []),
          fechaModConvertida,
          datosPromocion.nombreEditor
        ];
        
        await client.query(insertDatosQuery, datosValues);
      }
      
      await client.query('COMMIT');
      
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          message: exists ? 'Datos actualizados exitosamente' : 'Datos guardados exitosamente',
          id_promociones_ttp: ultimoId,
          action: exists ? 'updated' : 'created',
          creado_idFlujo: ultimoId
        })
      };
      
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('Database error:', dbError);
      throw dbError;
    } finally {
      await client.end();
    }
    
  } catch (error) {
    console.error('Error:', error);
    
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