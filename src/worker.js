import { Router } from 'itty-router';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import jwt from '@tsndr/cloudflare-worker-jwt';
import bcryptjs from 'bcryptjs';

// Create a new router
const router = Router();

// Use Cloudflare D1 or KV instead of MongoDB
// Example KV operations:
async function getUser(username) {
  return await BRAINLY_KV.get(`user:${username}`, { type: 'json' });
}

async function saveUser(user) {
  await BRAINLY_KV.put(`user:${user.username}`, JSON.stringify(user));
  await BRAINLY_KV.put(`userid:${user.id}`, user.username);
}

// Helper function for random string generation
function random(len) {
  const str = "qwertyuiopasdfghjklzxcvbnm1231456789";
  let ans = "";
  for (let i = 0; i < len; i++) {
    ans += str[Math.floor(Math.random() * str.length)];
  }
  return ans;
}

// Routes
router.get('/', () => {
  return new Response("The backend is working and up", {
    headers: { 'Content-Type': 'text/plain' }
  });
});

// User signup
router.post('/api/v1/user/signup', async (request) => {
  const { username, password } = await request.json();
  
  const existingUser = await getUser(username);
  if (existingUser) {
    return new Response(JSON.stringify({ msg: "username already exists" }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const hashedPassword = await bcryptjs.hash(password, 10);
  const userId = crypto.randomUUID();
  
  await saveUser({
    id: userId,
    username,
    password: hashedPassword
  });
  
  return new Response(JSON.stringify({ msg: "user signed up successfully" }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});

// User signin
router.post('/api/v1/user/signin', async (request) => {
  const { username, password } = await request.json();
  
  const user = await getUser(username);
  if (!user) {
    return new Response(JSON.stringify({ msg: "user not found" }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const validPassword = await bcryptjs.compare(password, user.password);
  if (!validPassword) {
    return new Response(JSON.stringify({ msg: "invalid credentials" }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const token = await jwt.sign({ id: user.id }, JWT_SECRET);
  
  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});

// Helper middleware function to verify JWT token
async function userMiddleware(request) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return new Response(JSON.stringify({ message: "Authorization header not provided" }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const token = authHeader.split(' ')[1]; // Get token from "Bearer <token>"
    const isValid = await jwt.verify(token, JWT_SECRET);
    
    if (!isValid) {
      return new Response(JSON.stringify({ message: "Invalid token" }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = jwt.decode(token);
    return payload.id; // Return the user ID from the token
  } catch (error) {
    return new Response(JSON.stringify({ message: "Invalid token format" }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get content for a user
router.get('/api/v1/content', async (request) => {
  const userId = await userMiddleware(request);
  
  // If userMiddleware returned a Response, it means there was an error
  if (userId instanceof Response) {
    return userId;
  }
  
  // Get all content for the user from KV storage
  const contentListKey = `content:list:${userId}`;
  const contentIds = await BRAINLY_KV.get(contentListKey, { type: 'json' }) || [];
  
  const content = [];
  for (const contentId of contentIds) {
    const contentItem = await BRAINLY_KV.get(`content:${contentId}`, { type: 'json' });
    if (contentItem) {
      content.push(contentItem);
    }
  }
  
  return new Response(JSON.stringify({ content }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});

// Add new content
router.post('/api/v1/content', async (request) => {
  const userId = await userMiddleware(request);
  
  // If userMiddleware returned a Response, it means there was an error
  if (userId instanceof Response) {
    return userId;
  }
  
  const { type, link, title, tags, content } = await request.json();
  const contentId = crypto.randomUUID();
  
  const contentItem = {
    id: contentId,
    userId,
    title,
    type,
    link,
    tags,
    content,
    createdAt: new Date().toISOString()
  };
  
  // Store the content item
  await BRAINLY_KV.put(`content:${contentId}`, JSON.stringify(contentItem));
  
  // Update the content list for the user
  const contentListKey = `content:list:${userId}`;
  const contentIds = await BRAINLY_KV.get(contentListKey, { type: 'json' }) || [];
  contentIds.push(contentId);
  await BRAINLY_KV.put(contentListKey, JSON.stringify(contentIds));
  
  return new Response(JSON.stringify({ msg: "content added successfully" }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});

// Delete content
router.delete('/api/v1/content', async (request) => {
  const userId = await userMiddleware(request);
  
  // If userMiddleware returned a Response, it means there was an error
  if (userId instanceof Response) {
    return userId;
  }
  
  const { title } = await request.json();
  
  // Get the content list for the user
  const contentListKey = `content:list:${userId}`;
  const contentIds = await BRAINLY_KV.get(contentListKey, { type: 'json' }) || [];
  
  // Find and remove content with matching title
  let deletedCount = 0;
  const updatedContentIds = [];
  
  for (const contentId of contentIds) {
    const contentItem = await BRAINLY_KV.get(`content:${contentId}`, { type: 'json' });
    
    if (contentItem && contentItem.title === title && contentItem.userId === userId) {
      // Delete this content item
      await BRAINLY_KV.delete(`content:${contentId}`);
      deletedCount++;
    } else {
      updatedContentIds.push(contentId);
    }
  }
  
  // Update the content list for the user
  await BRAINLY_KV.put(contentListKey, JSON.stringify(updatedContentIds));
  
  if (deletedCount === 0) {
    return new Response(JSON.stringify({ msg: "no content found with the specified title" }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({ msg: "content deleted successfully" }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});

// Share brain
router.post('/api/v1/brain/share', async (request) => {
  const userId = await userMiddleware(request);
  
  // If userMiddleware returned a Response, it means there was an error
  if (userId instanceof Response) {
    return userId;
  }
  
  const { share } = await request.json();
  
  if (share) {
    // Check if user already has a share link
    const existingLink = await BRAINLY_KV.get(`link:user:${userId}`, { type: 'json' });
    
    if (existingLink) {
      return new Response(JSON.stringify({ hash: existingLink.hash }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create a new share link
    const hash = random(10);
    const linkData = { userId, hash };
    
    // Store the link
    await BRAINLY_KV.put(`link:user:${userId}`, JSON.stringify(linkData));
    await BRAINLY_KV.put(`link:hash:${hash}`, JSON.stringify(linkData));
    
    return new Response(JSON.stringify({ hash }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } else {
    // Remove existing share link
    const existingLink = await BRAINLY_KV.get(`link:user:${userId}`, { type: 'json' });
    
    if (existingLink) {
      await BRAINLY_KV.delete(`link:hash:${existingLink.hash}`);
      await BRAINLY_KV.delete(`link:user:${userId}`);
    }
    
    return new Response(JSON.stringify({ msg: "removed link" }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Get shared brain content
router.get('/api/v1/brain/:shareLink', async (request, { params }) => {
  const hash = params.shareLink;
  
  // Find the link
  const link = await BRAINLY_KV.get(`link:hash:${hash}`, { type: 'json' });
  
  if (!link) {
    return new Response(JSON.stringify({ msg: "link is not found" }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get all content for the user
  const contentListKey = `content:list:${link.userId}`;
  const contentIds = await BRAINLY_KV.get(contentListKey, { type: 'json' }) || [];
  
  const content = [];
  for (const contentId of contentIds) {
    const contentItem = await BRAINLY_KV.get(`content:${contentId}`, { type: 'json' });
    if (contentItem) {
      content.push(contentItem);
    }
  }
  
  // Get username
  const username = await BRAINLY_KV.get(`userid:${link.userId}`);
  
  if (!username) {
    return new Response(JSON.stringify({ msg: "user not found" }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({ username, content }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});

// 404 for everything else
router.all('*', () => new Response('Not Found', { status: 404 }));

// Add this function to handle CORS
function handleCors(request) {
  // Make sure the necessary CORS headers are present
  const headers = {
    'Access-Control-Allow-Origin': '*', // Or specify your frontend origin: 'https://your-frontend-url.com'
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  // Handle OPTIONS request (preflight request)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers
    });
  }

  return headers;
}

// Event listener with CORS support
addEventListener('fetch', event => {
  const request = event.request;
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    event.respondWith(handleCors(request));
    return;
  }
  
  // Handle all other requests
  event.respondWith(router.handle(request)
    .then(response => {
      // Check if the response is already a Response object
      if (response instanceof Response) {
        // Clone the response to modify headers
        const newResponse = new Response(response.body, response);
        const corsHeaders = handleCors(request);
        
        // Add CORS headers to the response
        Object.keys(corsHeaders).forEach(key => {
          newResponse.headers.set(key, corsHeaders[key]);
        });
        
        return newResponse;
      }
      
      // If it's not a Response, return it as is
      return response;
    })
    .catch(err => {
      console.error(err);
      const corsHeaders = handleCors(request);
      return new Response(JSON.stringify({ msg: 'Something went wrong!' }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    })
  );
});