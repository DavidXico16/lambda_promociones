const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

exports.handler = async (event) => {
    console.log('Detalle Adicionales Condiciones Handler:', JSON.stringify(event, null, 2));
    
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

        // Consultar la tabla datos_condiciones por id_promociones_ttp pero solo traemos adicional
        const query = `
            SELECT adicional FROM public.datos_condiciones 
            WHERE id_promociones_ttp = $1
            ORDER BY id_datos_condiciones ASC
        `;

        console.log(`Ejecutando consulta para id_promociones_ttp: ${idFlujo}`);
        
        const result = await pool.query(query, [idFlujo]);
        
        console.log(`result rows[0]: ${result.rows[0]}`);
        console.log(`result length: ${result.rows.length}`);
        console.log(`result length: ${result.rows.length}`);

        if ( result.rows.length == 0 || result.rows[0].adicional === null) {
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
                message: 'Datos de adicinal de condiciones obtenidos exitosamente',
                datos: result.rows[0]
            })
        };

    } catch (error) {
        console.error('Error en detalleAdicinalCondicionesHandler:', error);
        
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