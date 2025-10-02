const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

exports.handler = async (event) => {
    console.log('Grafos Simulador Handler - Event received:', JSON.stringify(event, null, 2));
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
            },
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        
        // Validar campos requeridos
        const requiredFields = ['id_promociones_ttp', 'nodes', 'edges', 'tipo_solicitud', 'responsable_modificacion', 'ultima_modificacion'];
        const missingFields = requiredFields.filter(field => !body[field] && body[field] !== 0);
        
        if (missingFields.length > 0) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'Campos requeridos faltantes', 
                    missingFields 
                })
            };
        }

        // Validar que el id_promociones_ttp existe en la tabla promociones_ttp
        const checkQuery = 'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1';
        const checkResult = await pool.query(checkQuery, [body.id_promociones_ttp]);
        
        if (checkResult.rows.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'El id_promociones_ttp no existe en la tabla promociones_ttp' 
                })
            };
        }

        // Insertar datos en la tabla datos_nodos_simulador
        const insertQuery = `
            INSERT INTO datos_nodos_simulador (
                id_promociones_ttp, nodes, edges, tipo_solicitud,
                responsable_modificacion, ultima_modificacion
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id_datos_nodos_simulador, fecha_creacion
        `;

        const values = [
            body.id_promociones_ttp,
            JSON.stringify(body.nodes),
            JSON.stringify(body.edges),
            body.tipo_solicitud,
            body.responsable_modificacion,
            body.ultima_modificacion
        ];

        const result = await pool.query(insertQuery, values);
        
        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
            },
            body: JSON.stringify({
                message: 'Datos de grafos del simulador guardados exitosamente',
                id: result.rows[0].id_datos_nodos_simulador,
                fecha_creacion: result.rows[0].fecha_creacion
            })
        };

    } catch (error) {
        console.error('Error en grafosSimuladorHandler:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: 'Error interno del servidor',
                details: error.message 
            })
        };
    }
};