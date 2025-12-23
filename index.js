// index.js - Router principal
const handlers = {
  'GET:/promociones/dashboard': require('./handlers/dashboardHandler'),
  'GET:/dashboard': require('./handlers/dashboardHandler'),
  'POST:/dispersion-descuento': require('./handlers/dispersionDescuentoHandler'),
  'POST:/dispersion-adicional': require('./handlers/dispersionAdicionalHandler'),
  'POST:/dispersion-megas': require('./handlers/dispersionMegasHandler'),
  'POST:/dispersion-combinada': require('./handlers/dispersionCombinadaHandler'),
  'POST:/promociones': require('./handlers/promocionesHandler'),
  

  'DELETE:/promociones': require('./handlers/deletePromocionesNodosHandler'),
  'DELETE:/deletePromociones': require('./handlers/deletePromocionesNodosHandler')

};

exports.handler = async (event) => {
  console.log('Event recibido para enrutar:', JSON.stringify(event, null, 2));

  const path = event.path?.trim() || '';
  const httpMethod = event.httpMethod?.toUpperCase() || '';

  // Buscamos coincidencia exacta
  const key = `${httpMethod}:${path}`;
  const handler = handlers[key];

  if (handler) {
    console.log(`Routing to ${key}`);
    return await handler.handler(event);
  }

  // Casos especiales
  if (path.startsWith('/promociones/dashboard') && httpMethod === 'GET') {
    console.log('Routing to dashboard (startsWith)');
    return await handlers['GET:/promociones/dashboard'].handler(event);
  }

  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token'
    },
    body: JSON.stringify({
      error: 'Ruta no encontrada',
      path,
      method: httpMethod
    })
  };
};
