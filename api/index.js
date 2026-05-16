// Vercel Serverless Function — entry point for all /api/* routes
// This imports the Express app from backend/ and lets Vercel handle it as a serverless function.
const app = require('../backend/app');

module.exports = app;
