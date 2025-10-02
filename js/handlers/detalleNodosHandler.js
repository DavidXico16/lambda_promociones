const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

exports.handler = async (event) => {
    console.log('Detalle Nodos Handler - Event received:', JSON.stringify(event, null, 2));
    
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
        
        // Validar campo requerido
        if (!body.idFlujo) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'Campo requerido faltante: idFlujo'
                })
            };
        }

        // Convertir idFlujo a número
        const idFlujo = parseInt(body.idFlujo);
        
        if (isNaN(idFlujo)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'El idFlujo debe ser un número válido'
                })
            };
        }

        // Consultar la tabla datos_nodos por id_promociones_ttp
        const query = `
            SELECT * FROM public.datos_nodos 
            WHERE id_promociones_ttp = $1
            ORDER BY id_datos_nodos ASC
        `;

        console.log(`Ejecutando consulta para id_promociones_ttp: ${idFlujo}`);
        
        const result = await pool.query(query, [idFlujo]);
        
        if (result.rows.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'No se encontraron registros con el idFlujo proporcionado',
                    idFlujo: idFlujo
                })
            };
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
            },
            body: JSON.stringify({
                message: 'Datos de nodos obtenidos exitosamente',
                totalRegistros: result.rows.length,
                datos: result.rows
            })
        };

    } catch (error) {
        console.error('Error en detalleNodosHandler:', error);
        
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