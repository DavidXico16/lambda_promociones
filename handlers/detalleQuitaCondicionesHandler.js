const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

exports.handler = async (event) => {
    console.log('Detalle Quitas Condiciones Handler - Event received:', JSON.stringify(event, null, 2));
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS preflight' }) };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        console.log('Parsed body:', body);
        
        // Validar campo requerido
        if (!body.idFlujo) {
            return {
                statusCode: 400,
                headers,
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
                headers,
                body: JSON.stringify({ 
                    error: 'El idFlujo debe ser un número válido'
                })
            };
        }


        //Verificar si el idFlujo existe en promociones_ttp (tabla padre)
        const checkParentQuery = 'SELECT id_promociones_ttp FROM promociones_ttp WHERE id_promociones_ttp = $1';
        const checkParentResult = await pool.query(checkParentQuery, [body.idFlujo]);

        console.log("checkParentResult: ", checkParentResult)
        
        if (checkParentResult.rows.length === 0) {
            return {
            statusCode: 400,
            headers: headers,
            body: JSON.stringify({
                error: 'El idFlujo no existe',
                details: `idFlujo (${body.idFlujo})`
            })
            };
        }

        // Consultar la tabla datos_quitas_condiciones por id_promociones_ttp
        const query = `
            SELECT 
                id_datos_quitas_condiciones,
                tipo_reloj AS "tipoReloj",
                antiguedad_cuenta AS "antiguedadCuenta",
                tiempo_min_mora_dias AS "tiempoMinMoraDias",
                tiempo_max_mora_dias AS "tiempoMaxMoraDias",
                recurrencia_tiempo AS "recurrenciaTiempo",
                recurrencia_cantidad AS "recurrenciaCantidad",
                urgente,
                sub,
                nombre_editor AS "nombreEditor",
                fecha_mod,
                status
            FROM public.datos_quitas_condiciones 
            WHERE id_promociones_ttp = $1
            ORDER BY id_datos_quitas_condiciones ASC
        `;

        console.log(`Ejecutando consulta para id_promociones_ttp: ${idFlujo}`);
        
        const result = await pool.query(query, [idFlujo]);
        
        if (result.rows.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: 'No se encontraron registros en datos_quitas_condiciones con el idFlujo proporcionado',
                    idFlujo: idFlujo
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Datos obtenidos exitosamente de datos_quitas_condiciones',
                datos: result.rows[0]
            })
        };

    } catch (error) {
        console.error('Error en detalleQuitasCondicionesHandler:', error);
        
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
