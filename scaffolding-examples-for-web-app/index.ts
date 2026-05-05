import { Hono } from 'hono';
import { openAPIRouteHandler } from 'hono-openapi';
import { swaggerUI } from '@hono/swagger-ui'
import { cors } from 'hono/cors'

import { auth } from './services/auth.ts'
import healthcheckGroup from "./services/healthcheck.ts";
import {services} from "./services/services.ts";

const app = new Hono();

app.use(
  '/*',
  cors({
    // 1. Allow credentials (required for your fetch's credentials: 'include')
    credentials: true,
    
    // 2. Specify the origin of your frontend (Vite defaults to 5173)
    // You can use '*' during development, but 'http://localhost:5173' is better.
    origin: ['http://localhost:5173' , 'http://localhost:8080'], 
    
    // 3. Explicitly allow the Content-Type header needed for the POST request
    allowHeaders: [
      'Content-Type', // Crucial for your form-urlencoded POST
      'Authorization' // Good practice if you plan to send tokens via header later
    ],

    // 4. Explicitly allow the methods you are using
    allowMethods: ['POST', 'GET', 'OPTIONS'],
  })
);

const openAPI  = openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: 'FarmersPOS API',
        version: '1.0.0',
        description: 'FarmersPos Modular API',
      },
      servers: [
        { 
            url: '/',
           description: 'Local Server' 
          },
      ],
      security: [{ oauth2: [] }],
      components: {
      securitySchemes: {
        oauth2: {
          type: 'oauth2',
          flows: {
            password: {
              tokenUrl: '/auth/token',
              scopes: {
                admin: 'Admin access (full permissions)'
              }
            }
          }
        },
      }
    },
    },
  })


app.route('/auth', auth)
app.route('/api', services)
app.route('/healthcheck', healthcheckGroup)
app.get('/', (c) => c.text('Hono API is running!'));


app.get(
  '/openapi',
  openAPI
);
// Use the middleware to serve Swagger UI at /ui
app.get('/docs', swaggerUI({ url: '/openapi', persistAuthorization:true }))

export default app
