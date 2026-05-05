import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie } from 'hono/cookie';
import { Buffer } from "node:buffer";

const SECRET: string = Bun.env.JWT_SECRET || "";

const auth = new Hono();

function parseBasicAuth(authHeader: string | null): { username: string; password: string } | null {
  if (!authHeader || !authHeader.startsWith('Basic ')) return null;
  try {
    const encoded = authHeader.slice(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');
    if (!username || !password) return null;
    return { username, password };
  } catch (_error) {
    return null;
  }
}

const passwordSchema = z.object({
  grant_type: z.literal('password'),
  username: z.string().min(1),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  grant_type: z.literal('refresh_token'),
  refresh_token: z.string().min(1),
});

const tokenFormSchema = z.union([passwordSchema, refreshSchema]);

const tokenResponseSchemaBase = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  scope: z.string(),
  refresh_token: z.string().optional(),
  username: z.string().optional()
});


const tokenResponseSchema = z.union([z.object({
  success: z.boolean(),
}), tokenResponseSchemaBase ]);

const verifyResponseSchema = z.object({
  valid: z.boolean(),
  payload: z.record(z.any()).optional(),
  error: z.string().optional(),
});

auth.post(
  '/token',
  describeRoute({
    description: 'Login (OAuth2 Password Flow or Basic Auth) or Token Refresh',
    requestBody: {
      required: true,
      content: {
        'application/x-www-form-urlencoded': {
          schema: resolver(tokenFormSchema),
        },
      },
    },
    responses: {
      200: {
        description: 'Access token set as cookie',
        content: {
          'application/json': {
            schema: resolver(tokenResponseSchema),
          },
        },
      },
      400: { description: 'Invalid request (e.g., wrong grant_type)' },
      401: { description: 'Invalid credentials or refresh token' },
    },
  }),
  validator('form', tokenFormSchema),
  async (c) => {
    try {
      const form = await c.req.formData();
      const grant_type = form.get('grant_type') as string || '';
      const username = form.get('username') as string;
      const password = form.get('password') as string;
      const refresh_token_input = form.get('refresh_token') as string;

      const issueTokens = async (user: string) => {
        const now = Math.floor(Date.now() / 1000);
        const accessPayload = {
          sub: user,
          role: 'admin',
          exp: now + 60 * 60,
        };
        const accessToken = await sign(accessPayload, SECRET);
        const refreshPayload = {
          sub: user,
          type: 'refresh',
          exp: now + 24 * 60 * 60,
        };
        const refreshToken = await sign(refreshPayload, SECRET);
        // Set HTTP-only, Secure cookies
        setCookie(c, 'access_token', accessToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          maxAge: 30 * 24 * 60 * 60, // 30 days
          path: '/',
        });
        setCookie(c, 'refresh_token', refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          maxAge: 30 * 24 * 60 * 60, // 30 days
          path: '/',
        });
        return {
          // success: true,
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 30 * 24 * 60 * 60,
          scope: 'admin',
          refresh_token: refreshToken,
          username: user
         };
      };

      if (grant_type === 'refresh_token') {
        if (!refresh_token_input) {
          return c.json({ success: false, error: 'Missing refresh_token' }, 400);
        }
        try {
          refreshSchema.parse({ grant_type, refresh_token: refresh_token_input });
        } catch (e) {
          return c.json({ success: false, error: 'Invalid refresh request' }, 400);
        }
        const payload = await verify(refresh_token_input, SECRET);
        if (typeof payload === 'string' || !payload.sub || payload.type !== 'refresh') {
          return c.json({ success: false, error: 'Invalid refresh token' }, 401);
        }
        const username = payload.sub;
        const response = await issueTokens(username);
        return c.json(response);
      } else if (grant_type === 'password') {
        let credsUsername: string;
        let credsPassword: string;
        if (username && password) {
          try {
            passwordSchema.parse({ grant_type, username, password });
          } catch (e) {
            return c.json({ success: false, error: 'Invalid password request' }, 400);
          }
          credsUsername = username;
          credsPassword = password;
        } else {
          const authHeader = c.req.header('Authorization');
          const basicCreds = parseBasicAuth(authHeader);
          if (!basicCreds) {
            return c.json({ success: false, error: 'Missing credentials in form or Basic Auth header' }, 400);
          }
          credsUsername = basicCreds.username;
          credsPassword = basicCreds.password;
        }
        if (credsUsername !== 'admin' || credsPassword !== '1234') {
          return c.json({ success: false, error: 'Invalid credentials' }, 401);
        }
        const response = await issueTokens(credsUsername);
        return c.json(response);
      } else {
        const authHeader = c.req.header('Authorization');
        const basicCreds = parseBasicAuth(authHeader);
        if (!basicCreds) {
          return c.json({ success: false, error: 'Invalid request format' }, 400);
        }
        if (basicCreds.username !== 'admin' || basicCreds.password !== '1234') {
          return c.json({ success: false, error: 'Invalid credentials' }, 401);
        }
        const response = await issueTokens(basicCreds.username);
        return c.json(response);
      }
    } catch (error) {
      console.error('Auth token error:', error);
      return c.json({ success: false, error: 'Internal server error' }, 500);
    }
  }
);

// Check session endpoint - reads access token from HTTP-only cookie, NOT from Bearer header
auth.get(
  '/me',
  async (c) => {
    const token = getCookie(c, 'access_token');
    if (!token) {
      return c.json({ authenticated: false }, 401);
    }
    try {
      const payload = await verify(token, SECRET);
      return c.json({ authenticated: true, username: payload.sub });
    } catch {
      return c.json({ authenticated: false }, 401);
    }
  }
);

auth.get(
  '/verify',
  describeRoute({
    description: 'Verify a provided token',
    responses: {
      200: {
        description: 'Token verification response',
        content: {
          'application/json': {
            schema: resolver(verifyResponseSchema),
          },
        },
      },
      401: {
        description: 'Invalid or missing token',
      },
    },
  }),
  // Manual handling for Authorization header
  async (c) => {
    let token;
    const authHeader = c.req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7); // Remove 'Bearer '
      }
      else{
        token = getCookie(c, 'access_token');
      }

    if (!token) {
      return c.json({ valid: false, error: 'Missing token cookie' }, 401);
    }
    try {
      const payload = await verify(token, SECRET);
      return c.json({ valid: true, payload });
    } catch {
      return c.json({ valid: false, error: 'Token invalid or expired' }, 401);
    }
  }
);

// New Logout Endpoint
auth.post(
  '/logout',
  describeRoute({
    description: 'Deletes session cookies and logs the user out',
    responses: {
      200: { description: 'Logout successful' },
    },
  }),
  // Remove the 'async' keyword here
  (c) => { 
    // 1. Delete the access_token cookie
    setCookie(c, 'access_token', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 0, // Immediately expire the cookie
      path: '/',
      expires: new Date(0), // Ensure it's expired
    });

    // 2. Delete the refresh_token cookie
    setCookie(c, 'refresh_token', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 0, // Immediately expire the cookie
      path: '/',
      expires: new Date(0), // Ensure it's expired
    });

    // 3. Return a success response
    return c.json({ success: true, message: 'Logged out successfully' }, 200);
  }
);

export { auth, SECRET };
