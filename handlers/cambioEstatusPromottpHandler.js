const { Client } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

exports.handler = async (event) => {
  console.log("Event received:", JSON.stringify(event, null, 2));

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
    let body = event.body ? JSON.parse(event.body) : event;

    const { idFlujo, status } = body;

    if (!idFlujo || !status) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Faltan campos requeridos",
          required: ["idFlujo", "status"]
        })
      };
    }

    const validStatus = ["en_aprobacion", "aprobado"];

    if (!validStatus.includes(status)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Status inválido",
          statusRecibido: status,
          statusPermitidos: validStatus
        })
      };
    }

    const client = new Client(dbConfig);
    await client.connect();

    try {
      const existsQuery = `
        SELECT id_promociones_ttp 
        FROM promociones_ttp 
        WHERE id_promociones_ttp = $1
      `;
      const exists = await client.query(existsQuery, [idFlujo]);

      if (exists.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            message: "El idFlujo no existe",
            idFlujo
          })
        };
      }

      const updateQuery = `
        UPDATE promociones_ttp
        SET estatus = $1,
            ultima_modificacion = CURRENT_TIMESTAMP
        WHERE id_promociones_ttp = $2
        RETURNING id_promociones_ttp, estatus
      `;

      const result = await client.query(updateQuery, [status, idFlujo]);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: "Estatus actualizado correctamente",
          data: result.rows[0]
        })
      };

    } finally {
      await client.end();
    }

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Error interno del servidor",
        details: error.message
      })
    };
  }
};
