// handlers/autorizacionesHandler.js
const { Client } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

exports.handler = async (event) => {
  const client = new Client(dbConfig);
  await client.connect();

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    const {
      idFlujo,
      autoriza,
      comentario,
      responsable_creacion,
      area_creacion,
      perfil
    } = body;

    // Validación de campos requeridos
    if (!idFlujo || !autoriza || !comentario || !responsable_creacion || !area_creacion || !perfil) {
      return response(400, {
        error: 'Campos requeridos: idFlujo, autoriza, comentario, responsable_creacion, area_creacion, perfil'
      });
    }

    // Validar que idFlujo exista en promociones_ttp
    const checkFlujo = await client.query(
      'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1',
      [idFlujo]
    );

    if (checkFlujo.rows.length === 0) {
      return response(404, {
        error: `No existe el idFlujo en promociones_ttp: ${idFlujo}`
      });
    }

    // --------------------------------------------------------------------
    // 🟦 NUEVO: Verificar si ya existe una autorización para ese idFlujo
    // --------------------------------------------------------------------
    const checkAuthQuery = `
      SELECT id_promociones_ttp
      FROM autorizaciones
      WHERE id_promociones_ttp = $1
    `;
    const existResult = await client.query(checkAuthQuery, [idFlujo]);

    let result;

    if (existResult.rows.length > 0) {
      // 🔄 YA EXISTE → UPDATE
      const updateQuery = `
        UPDATE autorizaciones
        SET autoriza = $2,
            comentario = $3,
            fecha_creacion = NOW(),
            responsable_creacion = $4,
            area_creacion = $5,
            perfil = $6
        WHERE id_promociones_ttp = $1
        RETURNING *
      `;

      result = await client.query(updateQuery, [
        idFlujo,
        autoriza,
        comentario,
        responsable_creacion,
        area_creacion,
        perfil
      ]);

      return response(200, {
        message: "Autorización actualizada correctamente",
        data: result.rows[0]
      });

    } else {
      // 🆕 NO EXISTE → INSERT (tu código original)
      const insertQuery = `
        INSERT INTO autorizaciones
        (id_promociones_ttp, autoriza, comentario, fecha_creacion, responsable_creacion, area_creacion, perfil)
        VALUES ($1, $2, $3, NOW(), $4, $5, $6)
        RETURNING *
      `;

      result = await client.query(insertQuery, [
        idFlujo,
        autoriza,
        comentario,
        responsable_creacion,
        area_creacion,
        perfil
      ]);

      return response(200, {
        message: "Registro de autorización creado correctamente",
        data: result.rows[0]
      });
    }

  } catch (error) {
    console.error('Error en autorizacionesHandler:', error);
    return response(500, {
      error: 'Error interno del servidor',
      details: error.message
    });
  } finally {
    await client.end();
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}
