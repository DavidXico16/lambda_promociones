// index.js - Router principal actualizado
const promocionesHandler = require('./handlers/promocionesHandler');
const condicionesHandler = require('./handlers/condicionesHandler');
const planesHandler = require('./handlers/planesHandler');
const dashboardHandler = require('./handlers/dashboardHandler');
const inconvivenciasHandler = require('./handlers/inconvivenciasHandler');
const segmentacionHandler = require('./handlers/segmentacionHandler');
const grafosHandler = require('./handlers/grafosHandler');
const cuponesHandler = require('./handlers/cuponesHandler');
const dispersionDescuentoHandler = require('./handlers/dispersionDescuentoHandler');
const dispersionAdicionalHandler = require('./handlers/dispersionAdicionalHandler');
const dispersionMegasHandler = require('./handlers/dispersionMegasHandler');
const dispersionCombinadaHandler = require('./handlers/dispersionCombinadaHandler');
const simuladorHandler = require('./handlers/simuladorHandler');
const grafosSimuladorHandler = require('./handlers/grafosSimuladorHandler');
const detallePlanesHandler = require('./handlers/detallePlanesHandler');
const detalleSegmentacionHandler = require('./handlers/detalleSegmentacionHandler');
const detalleNodosHandler = require('./handlers/detalleNodosHandler');
const detalleCondicionesHandler = require('./handlers/detalleCondicionesHandler');
const detalleCupones = require('./handlers/detalleCuponesHandler');
const detalleIncovivencias = require('./handlers/detalleInconvicencias');
const condicionesAdicionalesHandler = require('./handlers/condicionesAdicionalesHandler');
const detallePromocionesHandler = require('./handlers/detallePromocionesHandler');
const detalleAdicinalCondicionesHandler = require('./handlers/detalleCondicionesAdicionalesHandler');
const detalleDispersionDescuento = require('./handlers/detalleDispersionDescuentoHandler');
const detalleDispersionAdicional = require('./handlers/detalleDispersionAdicionalHandler');
const detalleDispersionMegas = require('./handlers/detalleDispersionMegasHandler');
const detalleDispersionCombinada = require('./handlers/detalleDispersionCombinadaHandler');

exports.handler = async (event) => {
  console.log('Event received:', JSON.stringify(event, null, 2));
  
  const path = event.path || '';
  const httpMethod = event.httpMethod;
  
// Routing - PRIORIDAD a rutas compuestas
if (path.includes('/promociones/dashboard') && httpMethod === 'GET') {
  console.log('Routing to dashboard via /promociones/dashboard');
  return await dashboardHandler.handler(event);
}
else if (path.includes('/dashboard') && httpMethod === 'GET') {
  return await dashboardHandler.handler(event);
}
else if (path.includes('/dispersion-descuento') && httpMethod === 'POST') {
  return await dispersionDescuentoHandler.handler(event);
}
else if (path.includes('/dispersion-adicional') && httpMethod === 'POST') {
  return await dispersionAdicionalHandler.handler(event);
}
else if (path.includes('/dispersion-megas') && httpMethod === 'POST') {
  return await dispersionMegasHandler.handler(event);
}
else if (path.includes('/dispersion-combinada') && httpMethod === 'POST') {
  return await dispersionCombinadaHandler.handler(event);
}
else if (path.includes('/promociones') && httpMethod === 'POST') {
  return await promocionesHandler.handler(event);
}
else if (path.includes('/condiciones') && httpMethod === 'POST') {
  return await condicionesHandler.handler(event);
}
else if (path.includes('/datosplanes') && httpMethod === 'POST') {
  return await planesHandler.handler(event);
}
else if (path.includes('/inconvivencias') && httpMethod === 'POST') {
  return await inconvivenciasHandler.handler(event);
}
else if (path.includes('/segmentacion') && httpMethod === 'POST') {
  return await segmentacionHandler.handler(event);
}
else if (path.includes('/grafos') && httpMethod === 'POST') {
  return await grafosHandler.handler(event);
}
else if (path.includes('/simulador') && httpMethod === 'POST') {
  return await simuladorHandler.handler(event);
}
else if (path.includes('/grafos-simulador') && httpMethod === 'POST') {
  return await grafosSimuladorHandler.handler(event);
}
else if (path.includes('/cupones') && httpMethod === 'POST') {
  return await cuponesHandler.handler(event);
}
else if (path.includes('/detalle-planes') && httpMethod === 'POST') {
  return await detallePlanesHandler.handler(event);
}
else if (path.includes('/detalle-segmentacion') && httpMethod === 'POST') {
  return await detalleSegmentacionHandler.handler(event);
}
else if (path.includes('/detalle-nodos') && httpMethod === 'POST') {
  return await detalleNodosHandler.handler(event);
}
else if (path.includes('/detalle-condiciones') && httpMethod === 'POST') {
  return await detalleCondicionesHandler.handler(event);
}
else if (path.includes('/detalle-cupones') && httpMethod === 'POST') {
  return await detalleCupones.handler(event);
}
else if (path.includes('/detalle-inconvivencias') && httpMethod === 'POST') {
  return await detalleIncovivencias.handler(event);
}
else if (path.includes('/adicionales-condiciones') && httpMethod === 'POST') {
  return await condicionesAdicionalesHandler.handler(event);
}
else if (path.includes('/detalle-promociones') && httpMethod === 'POST') {
  return await detallePromocionesHandler.handler(event);
}
else if (path.includes('/detalle-adicional-condiciones') && httpMethod === 'POST') {
  return await detalleAdicinalCondicionesHandler.handler(event);
}
else if (path.includes('/detalleDispersionDescuento') && httpMethod === 'POST') {
  return await detalleDispersionDescuento.handler(event);
}
else if (path.includes('/detalleDispersionAdicional') && httpMethod === 'POST') {
  return await detalleDispersionAdicional.handler(event);
}
else if (path.includes('/detalleDispersionMegas') && httpMethod === 'POST') {
  return await detalleDispersionMegas.handler(event);
}
else if (path.includes('/detalleDispersionCombinada') && httpMethod === 'POST') {
  return await detalleDispersionCombinada.handler(event);
}

  else {
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
        path: path,
        method: httpMethod 
      })
    };
  }
};