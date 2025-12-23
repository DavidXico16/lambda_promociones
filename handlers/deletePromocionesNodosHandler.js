// handlers/deletePromocionDinamicoHandler.js
const { Client } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

// Whitelist de tablas permitidas
const TABLAS_RELACIONADAS = [
  'autorizaciones',
  'addon_planes',
  'simulador_progresive',
  'simulacion_segmentacion',
  'simulador_cuentas_reloj_ciclo',
  'simulador_planes_cuentas',
  'datos_nodos_simulador',
  'datos_nodos',
  'datos_simulador',
  'datos_quitas_condiciones',
  'datos_quitas',
  'datos_dispercion_combinada',
  'datos_dispercion_megas',
  'datos_dispercion_adicional',
  'datos_dispercion_descuento',
  'datos_catalogo_segmentacion',
  'datos_promo_sin_convivencia',
  'datos_cupones',
  'datos_condiciones',
  'datos_planes',
  'datos_promociones'
];

exports.handler = async (event) => {
  console.log('Delete Promoción Dinámico - Event:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido, usa DELETE' })
    };
  }

  const body = JSON.parse(event.body || '{}');
  const { idFlujo, tablas } = body;

  if (!idFlujo) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'idFlujo es requerido' })
    };
  }

  // detectar si es borrado parcial
  const borradoParcial = Array.isArray(tablas) && tablas.length > 0;

  // tablas a borror
  const tablasABorrar = borradoParcial
    ? tablas.filter(t => TABLAS_RELACIONADAS.includes(t))
    : TABLAS_RELACIONADAS;

  if (tablasABorrar.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'No hay tablas válidas para borrar' })
    };
  }

  const client = new Client(dbConfig);

  try {
    await client.connect();
    await client.query('BEGIN');

    //Validar que exista la promoción
    const existePromo = await client.query(
      'SELECT 1 FROM promociones_ttp WHERE id_promociones_ttp = $1',
      [idFlujo]
    );

    if (existePromo.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'No se encontró la promoción',
          idFlujo
        })
      };
    }

    //Borrar tablas hijas
    for (const tabla of tablasABorrar) {
      await client.query(
        `DELETE FROM ${tabla} WHERE id_promociones_ttp = $1`,
        [idFlujo]
      );
    }

    // borrar padre si no es borrado parcial
    if (!borradoParcial) {
      await client.query(
        'DELETE FROM promociones_ttp WHERE id_promociones_ttp = $1',
        [idFlujo]
      );
    }

    await client.query('COMMIT');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: borradoParcial
          ? 'Eliminación parcial completada correctamente'
          : 'Eliminación total completada correctamente',
        idFlujo,
        tablas_eliminadas: tablasABorrar,
        padre_eliminado: !borradoParcial
      })
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en borrado dinámico:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error eliminando la promoción',
        details: error.message
      })
    };
  } finally {
    await client.end();
  }
};
