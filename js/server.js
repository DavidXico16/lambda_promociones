// server.js
require('dotenv').config(); // 👈 Cargar variables desde .env

const express = require('express');
const bodyParser = require('body-parser');
const { handler } = require('./index'); // Importamos tu handler principal

const app = express();
app.use(bodyParser.json());

// Middleware para simular el event de AWS Lambda
app.use(async (req, res) => {
  const event = {
    path: req.path,
    httpMethod: req.method,
    body: JSON.stringify(req.body),
    headers: req.headers,
    queryStringParameters: req.query
  };

  try {
    const result = await handler(event);

    // Setear headers si existen
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    res.status(result.statusCode || 200).send(result.body);
  } catch (err) {
    console.error('Error en handler:', err);
    res.status(500).json({ error: 'Error interno', detalle: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log('Base de datos configurada con:');
  console.log({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER
    // 🔒 Ojo: no mostramos password por seguridad
  });
});
