import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

// Schemas (Zod for validation and OpenAPI metadata)
const querySchema = z.object({
  name: z.string().optional(),
});
const responseSchema = z.string();

// Route group for "/hello" (e.g., GET /hello)
const helloGroup = new Hono();

// GET /hello - Say hello with optional name query
helloGroup.get(
  '/',
  describeRoute({
    description: 'Say hello to the user',
    responses: {
      200: {
        description: 'Successful response',
        content: {
          'text/plain': { schema: resolver(responseSchema) },
        },
      },
    },
  }),
  validator('query', querySchema),
  (c) => {
    const query = c.req.valid('query');
    return c.text(`Hello ${query?.name ?? 'Hono'}!`);
  }
);

export default helloGroup;