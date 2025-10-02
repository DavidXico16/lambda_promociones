// handlers/getPromocionesHandler.js
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

exports.handler = async (event) => {
  console.log('GET Promociones handler - Event received:', JSON.stringify(event, null, 2));
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({ message: 'CORS preflight' })
    };
  }
  
  // Solo permitir método GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: headers,
      body: JSON.stringify({ error: 'Método no permitido' })
    };
  }
  
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    // Query para obtener todos los registros de promociones_ttp
    const query = `
      SELECT 
        id_promociones_ttp,
        identificador_usuario,
        tipo_solicitud,
        responsable_creacion,
        area_creacion,
        fecha_creacion,
        nombre_promocion,
        estatus
      FROM promociones_ttp 
      ORDER BY fecha_creacion DESC
    `;
    
    const result = await client.query(query);
    
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        message: 'Datos opteneeie obtenidos exitosamente',
        total_registros: result.rows.length,
        data: result.rows
      })
    };
    
  } catch (error) {
    console.error('Error en GET promociones handler:', error);
    
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({
        error: 'Error interno del servidor',
        details: error.message
      })
    };
  } finally {
    await client.end();
  }
};