// index.js - Router principal
const handlers = {
  'GET:/promociones/dashboard': require('./handlers/dashboardHandler'),
  'GET:/dashboard': require('./handlers/dashboardHandler'),
  'POST:/dispersion-descuento': require('./handlers/dispersionDescuentoHandler'),
  'POST:/dispersion-adicional': require('./handlers/dispersionAdicionalHandler'),
  'POST:/dispersion-megas': require('./handlers/dispersionMegasHandler'),
  'POST:/dispersion-combinada': require('./handlers/dispersionCombinadaHandler'),
  'POST:/promociones': require('./handlers/promocionesHandler'),
  
  'POST:/condiciones': require('./handlers/condicionesHandler'),
  'POST:/datosplanes': require('./handlers/planesHandler'),
  'POST:/inconvivencias': require('./handlers/inconvivenciasHandler'),
  'POST:/segmentacion': require('./handlers/segmentacionHandler'),
  'POST:/grafos': require('./handlers/grafosHandler'),
  'POST:/simulador': require('./handlers/simuladorHandler'),
  'POST:/cupones': require('./handlers/cuponesHandler'),
  'POST:/detalle-planes': require('./handlers/detallePlanesHandler'),
  'POST:/detalle-segmentacion': require('./handlers/detalleSegmentacionHandler'),
  'POST:/detalle-nodos': require('./handlers/detalleNodosHandler'),
  'POST:/detalle-condiciones': require('./handlers/detalleCondicionesHandler'),
  'POST:/detalle-cupones': require('./handlers/detalleCuponesHandler'),
  'POST:/detalle-inconvivencias': require('./handlers/detalleInconvicencias'),
  'POST:/adicionales-condiciones': require('./handlers/condicionesAdicionalesHandler'),
  'POST:/detalle-promociones': require('./handlers/detallePromocionesHandler'),
  'POST:/detalle-adicional-condiciones': require('./handlers/detalleCondicionesAdicionalesHandler'),
  'POST:/detalleDispersionDescuento': require('./handlers/detalleDispersionDescuentoHandler'),
  'POST:/detalleDispersionAdicional': require('./handlers/detalleDispersionAdicionalHandler'),
  'POST:/detalleDispersionMegas': require('./handlers/detalleDispersionMegasHandler'),
  'POST:/detalleDispersionCombinada': require('./handlers/detalleDispersionCombinadaHandler'),
  'POST:/simuladorGrafo': require('./handlers/grafosSimuladorHandler'),
  'POST:/detalleSimuladorGrafo': require('./handlers/detalleGrafoSimuladorHandler'),
  'POST:/getCuentasNoCoinciden': require('./handlers/getCuentasNoCoincidenHnadler'),
  'POST:/getPromocionesAplicadas': require('./handlers/getPromocionesAplicadasHandler'),
  'POST:/cambioEstatusPromottp': require('./handlers/cambioEstatusPromottpHandler'),
  'POST:/autorizaciones': require('./handlers/autorizacionesHandler')
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
