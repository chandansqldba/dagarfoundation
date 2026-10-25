/**
 * Dagar Foundation - Advanced Full-Stack Backend & Content Management Server
 * Native Node.js Zero-Dependency High-Performance Server
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT = process.env.PORT || 8085;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure required directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Active In-Memory Sessions: token -> { username, expiresAt }
const sessions = new Map();
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 Hours

// MIME Types Map
const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=UTF-8',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff'
};

/* ==========================================================================
   Database Layer with Atomic Writes & Backup
   ========================================================================== */

let dbCache = null;

function loadDatabase() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            console.error('[DB] database.json not found! Creating fallback structure.');
            dbCache = { admin: {}, seo: {}, content: {}, blogs: [], messages: [], subscribers: [], activityLogs: [] };
            saveDatabase();
        } else {
            const raw = fs.readFileSync(DB_FILE, 'utf-8');
            dbCache = JSON.parse(raw);
        }
    } catch (err) {
        console.error('[DB] Error loading database:', err);
        if (!dbCache) {
            dbCache = { admin: {}, seo: {}, content: {}, blogs: [], messages: [], subscribers: [], activityLogs: [] };
        }
    }
    return dbCache;
}

let saveTimer = null;
function saveDatabase(immediate = false) {
    const doWrite = () => {
        try {
            const tempFile = DB_FILE + '.tmp';
            fs.writeFileSync(tempFile, JSON.stringify(dbCache, null, 2), 'utf-8');
            fs.renameSync(tempFile, DB_FILE);
        } catch (err) {
            console.error('[DB] Failed to save database:', err);
        }
    };

    if (immediate) {
        if (saveTimer) clearTimeout(saveTimer);
        doWrite();
    } else {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(doWrite, 150);
    }
}

function logActivity(action, user = 'Admin') {
    if (!dbCache.activityLogs) dbCache.activityLogs = [];
    dbCache.activityLogs.unshift({
        id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        timestamp: new Date().toISOString(),
        action,
        user
    });
    if (dbCache.activityLogs.length > 100) {
        dbCache.activityLogs = dbCache.activityLogs.slice(0, 100);
    }
    saveDatabase();
}

// Initial DB Load
loadDatabase();

/* ==========================================================================
   Authentication & Cryptography Helpers
   ========================================================================== */

function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
}

// Verify or initialize default password if not properly set
function initAdminAccount() {
    const salt = 'dagar_secure_salt_2026';
    const defaultHash = hashPassword('admin123', salt);

    if (!dbCache.admin || !dbCache.admin.username || dbCache.admin.passwordHash === 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3') {
        dbCache.admin = {
            username: 'admin',
            salt: salt,
            passwordHash: defaultHash,
            email: 'admin@dagarfoundation.org',
            lastLogin: dbCache.admin?.lastLogin || null
        };
        saveDatabase(true);
    }
}
initAdminAccount();

function createSession(username) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    sessions.set(token, { username, expiresAt });
    return token;
}

function authenticateToken(req) {
    const authHeader = req.headers['authorization'] || '';
    let token = '';
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    } else if (req.headers['x-admin-token']) {
        token = req.headers['x-admin-token'];
    }

    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
        sessions.delete(token);
        return null;
    }
    return session;
}

/* ==========================================================================
   Request Parser Utilities
   ========================================================================== */

function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            // Prevent payload flooding (> 15MB)
            if (body.length > 15 * 1024 * 1024) {
                req.destroy();
                reject(new Error('Payload too large'));
            }
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                const parsed = JSON.parse(body);
                resolve(parsed);
            } catch (e) {
                // Return plain string if not JSON
                resolve({ rawBody: body });
            }
        });
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, data) {
    const jsonStr = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Length': Buffer.byteLength(jsonStr),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    });
    res.end(jsonStr);
}

function sendError(res, statusCode, message) {
    sendJson(res, statusCode, { error: true, message });
}

/* ==========================================================================
   SEO Dynamic Server-Side Meta Injection Engine
   ========================================================================== */

function injectSeoMeta(htmlContent, pageKey, customPost = null) {
    const seoData = dbCache.seo || {};
    const globalSeo = seoData.global || {};
    const pageSeo = (seoData.pages && seoData.pages[pageKey]) || {};

    let title = customPost?.seo?.title || customPost?.title || pageSeo.title || globalSeo.defaultTitle || 'Dagar Foundation';
    let description = customPost?.seo?.description || customPost?.excerpt || pageSeo.description || globalSeo.defaultDescription || '';
    let keywords = customPost?.seo?.keywords || customPost?.tags?.join(', ') || pageSeo.keywords || globalSeo.defaultKeywords || '';
    let canonical = customPost?.seo?.canonical || pageSeo.canonical || globalSeo.canonicalDomain || 'https://www.dagarfoundation.org/';
    let ogImage = customPost?.seo?.ogImage || customPost?.coverImage || pageSeo.ogImage || globalSeo.ogImage || '/logo.png';
    let ogTitle = customPost?.seo?.title || pageSeo.ogTitle || title;
    let ogDescription = customPost?.seo?.description || pageSeo.ogDescription || description;
    let robots = pageSeo.robots || globalSeo.robots || 'index, follow';

    // Replace Title
    htmlContent = htmlContent.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

    // Replace or Insert Meta Description
    if (htmlContent.includes('<meta name="description"')) {
        htmlContent = htmlContent.replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(description)}">`);
    } else {
        htmlContent = htmlContent.replace('</head>', `    <meta name="description" content="${escapeHtml(description)}">\n</head>`);
    }

    // Replace or Insert Keywords
    if (htmlContent.includes('<meta name="keywords"')) {
        htmlContent = htmlContent.replace(/<meta name="keywords"[^>]*>/i, `<meta name="keywords" content="${escapeHtml(keywords)}">`);
    } else {
        htmlContent = htmlContent.replace('</head>', `    <meta name="keywords" content="${escapeHtml(keywords)}">\n</head>`);
    }

    // Replace or Insert Canonical
    if (htmlContent.includes('<link rel="canonical"')) {
        htmlContent = htmlContent.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}">`);
    } else {
        htmlContent = htmlContent.replace('</head>', `    <link rel="canonical" href="${escapeHtml(canonical)}">\n</head>`);
    }

    // Generate Open Graph & Twitter Meta block
    const socialMetaBlock = `
    <!-- Dynamic Open Graph & Social SEO -->
    <meta property="og:site_name" content="${escapeHtml(globalSeo.siteName || 'Dagar Foundation')}">
    <meta property="og:title" content="${escapeHtml(ogTitle)}">
    <meta property="og:description" content="${escapeHtml(ogDescription)}">
    <meta property="og:image" content="${escapeHtml(ogImage)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:type" content="${customPost ? 'article' : 'website'}">
    <meta name="robots" content="${escapeHtml(robots)}">
    <meta name="twitter:card" content="${escapeHtml(globalSeo.twitterCard || 'summary_large_image')}">
    <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
    <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
    <meta name="twitter:image" content="${escapeHtml(ogImage)}">
    `;

    // Remove older duplicate dynamic OG block if present and re-inject
    htmlContent = htmlContent.replace(/<!-- Dynamic Open Graph & Social SEO -->[\s\S]*?<meta name="twitter:image"[^>]*>/i, '');
    htmlContent = htmlContent.replace('</head>', `${socialMetaBlock}\n</head>`);

    // Schema.org JSON-LD
    let schemaObj = globalSeo.schemaOrg;
    if (customPost) {
        schemaObj = {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": customPost.title,
            "description": customPost.excerpt,
            "image": [customPost.coverImage],
            "datePublished": customPost.date,
            "author": {
                "@type": "Person",
                "name": customPost.author || "Dagar Foundation"
            },
            "publisher": globalSeo.schemaOrg || {
                "@type": "NGO",
                "name": "Dagar Foundation",
                "url": "https://www.dagarfoundation.org"
            }
        };
    }

    if (schemaObj) {
        const schemaString = `\n    <script type="application/ld+json" id="dagar-schema-json">\n${JSON.stringify(schemaObj, null, 2)}\n    </script>\n`;
        htmlContent = htmlContent.replace(/<script type="application\/ld\+json" id="dagar-schema-json">[\s\S]*?<\/script>/i, '');
        htmlContent = htmlContent.replace('</head>', `${schemaString}</head>`);
    }

    return htmlContent;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/* ==========================================================================
   Main Server & Router
   ========================================================================== */

const server = http.createServer(async (req, res) => {
    // Enable CORS for development flexibility
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        });
        return res.end();
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;
    const method = req.method;

    // Log request in dev
    // console.log(`[HTTP] ${method} ${pathname}`);

    /* ----------------------------------------------------------------------
       1. REST API Routing
       ---------------------------------------------------------------------- */
    if (pathname.startsWith('/api/')) {

        // --- System Health ---
        if (pathname === '/api/health' && method === 'GET') {
            return sendJson(res, 200, {
                status: 'operational',
                serverTime: new Date().toISOString(),
                uptime: process.uptime(),
                stats: {
                    blogsCount: dbCache.blogs?.length || 0,
                    messagesCount: dbCache.messages?.length || 0,
                    subscribersCount: dbCache.subscribers?.length || 0
                }
            });
        }

        // --- Authentication Endpoints ---
        if (pathname === '/api/auth/login' && method === 'POST') {
            try {
                const body = await parseRequestBody(req);
                const inputIdentifier = (body.username || '').trim().toLowerCase();
                const password = body.password || '';
                const admin = dbCache.admin;

                if (!inputIdentifier || !password) {
                    return sendError(res, 400, 'Username/Email and password are required');
                }

                const expectedHash = hashPassword(password, admin.salt);
                const matchesUser = inputIdentifier === (admin.username || '').toLowerCase() || 
                                    inputIdentifier === (admin.email || '').toLowerCase();

                if (matchesUser && expectedHash === admin.passwordHash) {
                    const token = createSession(admin.username);
                    admin.lastLogin = new Date().toISOString();
                    saveDatabase();
                    logActivity(`Admin login successful: ${admin.username}`, admin.username);
                    return sendJson(res, 200, {
                        success: true,
                        token,
                        user: { username: admin.username, email: admin.email }
                    });
                } else {
                    return sendError(res, 401, 'Invalid username or password');
                }
            } catch (err) {
                return sendError(res, 500, 'Authentication error: ' + err.message);
            }
        }

        if (pathname === '/api/auth/check' && method === 'GET') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Not authenticated');
            return sendJson(res, 200, {
                authenticated: true,
                username: session.username,
                email: dbCache.admin.email
            });
        }

        if (pathname === '/api/auth/logout' && method === 'POST') {
            const authHeader = req.headers['authorization'] || '';
            const token = authHeader.replace('Bearer ', '').trim();
            if (token) sessions.delete(token);
            return sendJson(res, 200, { success: true, message: 'Logged out successfully' });
        }

        if (pathname === '/api/auth/change-password' && method === 'POST') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Unauthorized');

            const body = await parseRequestBody(req);
            const { currentPassword, newPassword } = body;

            if (!currentPassword || !newPassword || newPassword.length < 6) {
                return sendError(res, 400, 'New password must be at least 6 characters');
            }

            const currentHash = hashPassword(currentPassword, dbCache.admin.salt);
            if (currentHash !== dbCache.admin.passwordHash) {
                return sendError(res, 400, 'Current password incorrect');
            }

            dbCache.admin.salt = crypto.randomBytes(16).toString('hex');
            dbCache.admin.passwordHash = hashPassword(newPassword, dbCache.admin.salt);
            saveDatabase(true);
            logActivity('Admin password changed successfully');
            return sendJson(res, 200, { success: true, message: 'Password updated successfully' });
        }

        // --- SEO Settings Endpoints ---
        if (pathname === '/api/seo' && method === 'GET') {
            return sendJson(res, 200, dbCache.seo || {});
        }

        if (pathname.startsWith('/api/seo/') && method === 'GET') {
            const pageName = pathname.replace('/api/seo/', '');
            const pageData = dbCache.seo?.pages?.[pageName] || null;
            return sendJson(res, 200, { page: pageName, seo: pageData, global: dbCache.seo?.global || {} });
        }

        if (pathname === '/api/seo' && method === 'PUT') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Unauthorized');

            const body = await parseRequestBody(req);
            if (!dbCache.seo) dbCache.seo = { global: {}, pages: {} };

            if (body.global) {
                dbCache.seo.global = { ...dbCache.seo.global, ...body.global };
            }
            if (body.pages) {
                dbCache.seo.pages = { ...dbCache.seo.pages, ...body.pages };
            }
            if (body.pageKey && body.pageData) {
                if (!dbCache.seo.pages) dbCache.seo.pages = {};
                dbCache.seo.pages[body.pageKey] = { ...dbCache.seo.pages[body.pageKey], ...body.pageData };
            }

            saveDatabase(true);
            logActivity('SEO Meta Tags updated across site/pages');
            return sendJson(res, 200, { success: true, message: 'SEO settings updated successfully', seo: dbCache.seo });
        }

        // --- Content Management Endpoints (Branding, Hero, Stats, About, Missions, Approach, Donation) ---
        if (pathname === '/api/content' && method === 'GET') {
            return sendJson(res, 200, dbCache.content || {});
        }

        if (pathname === '/api/content' && method === 'PUT') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Unauthorized');

            const body = await parseRequestBody(req);
            const { section, data } = body;

            if (section && data) {
                dbCache.content[section] = data;
            } else if (typeof body === 'object') {
                dbCache.content = { ...dbCache.content, ...body };
            }

            saveDatabase(true);
            logActivity(`Website section updated: ${section || 'General content'}`);
            return sendJson(res, 200, { success: true, message: 'Content updated successfully', content: dbCache.content });
        }

        // --- Blog Management Endpoints ---
        if (pathname === '/api/blogs' && method === 'GET') {
            const { category, tag, search, status } = query;
            let list = [...(dbCache.blogs || [])];

            const session = authenticateToken(req);
            // Non-authenticated users only see published posts
            if (!session) {
                list = list.filter(b => b.status === 'published');
            } else if (status) {
                list = list.filter(b => b.status === status);
            }

            if (category) {
                list = list.filter(b => b.category && b.category.toLowerCase() === category.toLowerCase());
            }

            if (tag) {
                list = list.filter(b => b.tags && b.tags.some(t => t.toLowerCase() === tag.toLowerCase() || t.toLowerCase() === '#' + tag.toLowerCase()));
            }

            if (search) {
                const s = search.toLowerCase();
                list = list.filter(b => (b.title && b.title.toLowerCase().includes(s)) || (b.excerpt && b.excerpt.toLowerCase().includes(s)) || (b.content && b.content.toLowerCase().includes(s)));
            }

            // Sort newest first
            list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            return sendJson(res, 200, list);
        }

        // Single Blog Post
        if (pathname.startsWith('/api/blogs/') && method === 'GET') {
            const identifier = pathname.replace('/api/blogs/', '').trim();
            const blog = dbCache.blogs.find(b => b.id === identifier || b.slug === identifier);
            if (!blog) return sendError(res, 404, 'Blog article not found');

            // Increment views count safely for public viewers
            const session = authenticateToken(req);
            if (!session) {
                blog.views = (blog.views || 0) + 1;
                saveDatabase();
            }

            return sendJson(res, 200, blog);
        }

        if (pathname === '/api/blogs' && method === 'POST') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Unauthorized');

            const body = await parseRequestBody(req);
            if (!body.title || !body.content) {
                return sendError(res, 400, 'Title and content are required');
            }

            const slug = body.slug ? slugify(body.slug) : slugify(body.title);
            // Check slug uniqueness
            let uniqueSlug = slug;
            let counter = 1;
            while (dbCache.blogs.some(b => b.slug === uniqueSlug)) {
                uniqueSlug = `${slug}-${counter++}`;
            }

            const newBlog = {
                id: 'blog-' + Date.now(),
                slug: uniqueSlug,
                title: body.title,
                category: body.category || 'General',
                author: body.author || 'Dagar Foundation',
                date: body.date || new Date().toISOString().split('T')[0],
                readTime: body.readTime || '4 min read',
                coverImage: body.coverImage || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80',
                excerpt: body.excerpt || body.content.replace(/<[^>]*>?/gm, '').substring(0, 160) + '...',
                content: body.content,
                tags: Array.isArray(body.tags) ? body.tags : (body.tags ? body.tags.split(',').map(t => t.trim()) : []),
                views: 0,
                featured: Boolean(body.featured),
                status: body.status || 'published',
                seo: {
                    title: body.seo?.title || body.title + ' | Dagar Foundation',
                    description: body.seo?.description || body.excerpt || '',
                    keywords: body.seo?.keywords || '',
                    canonical: `https://www.dagarfoundation.org/blog/${uniqueSlug}`,
                    ogImage: body.seo?.ogImage || body.coverImage
                }
            };

            dbCache.blogs.unshift(newBlog);
            saveDatabase(true);
            logActivity(`Created new blog article: "${newBlog.title}"`);
            return sendJson(res, 201, { success: true, blog: newBlog });
        }

        if (pathname.startsWith('/api/blogs/') && method === 'PUT') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Unauthorized');

            const id = pathname.replace('/api/blogs/', '').trim();
            const index = dbCache.blogs.findIndex(b => b.id === id || b.slug === id);
            if (index === -1) return sendError(res, 404, 'Blog not found');

            const body = await parseRequestBody(req);
            const current = dbCache.blogs[index];

            const updatedBlog = {
                ...current,
                ...body,
                id: current.id, // Immutable ID
                tags: Array.isArray(body.tags) ? body.tags : (body.tags ? body.tags.split(',').map(t => t.trim()) : current.tags),
                seo: {
                    ...current.seo,
                    ...(body.seo || {})
                }
            };

            dbCache.blogs[index] = updatedBlog;
            saveDatabase(true);
            logActivity(`Updated blog article: "${updatedBlog.title}"`);
            return sendJson(res, 200, { success: true, blog: updatedBlog });
        }

        if (pathname.startsWith('/api/blogs/') && method === 'DELETE') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Unauthorized');

            const id = pathname.replace('/api/blogs/', '').trim();
            const index = dbCache.blogs.findIndex(b => b.id === id || b.slug === id);
            if (index === -1) return sendError(res, 404, 'Blog not found');

            const deleted = dbCache.blogs.splice(index, 1)[0];
            saveDatabase(true);
            logActivity(`Deleted blog article: "${deleted.title}"`);
            return sendJson(res, 200, { success: true, message: 'Article deleted successfully' });
        }

        // --- Contact / Inquiries Endpoints ---
        if (pathname === '/api/contact' && method === 'POST') {
            const body = await parseRequestBody(req);
            if (!body.name || !body.email || !body.message) {
                return sendError(res, 400, 'Name, email, and message are required');
            }

            const newMsg = {
                id: 'msg-' + Date.now(),
                name: body.name.trim(),
                email: body.email.trim(),
                subject: body.subject ? body.subject.trim() : 'General Inquiry',
                message: body.message.trim(),
                date: new Date().toISOString(),
                status: 'unread'
            };

            if (!dbCache.messages) dbCache.messages = [];
            dbCache.messages.unshift(newMsg);
            saveDatabase();
            logActivity(`New message received from ${newMsg.name} (${newMsg.email})`, 'Public Visitor');
            return sendJson(res, 201, { success: true, message: 'Thank you! Your message has been sent successfully.' });
        }

        if (pathname === '/api/messages' && method === 'GET') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Unauthorized');
            return sendJson(res, 200, dbCache.messages || []);
        }

        if (pathname.startsWith('/api/messages/') && method === 'PATCH') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Unauthorized');

            const id = pathname.replace('/api/messages/', '').replace('/status', '').trim();
            const msg = dbCache.messages.find(m => m.id === id);
            if (!msg) return sendError(res, 404, 'Message not found');

            const body = await parseRequestBody(req);
            if (body.status) msg.status = body.status;
            saveDatabase();
            return sendJson(res, 200, { success: true, message: msg });
        }

        if (pathname.startsWith('/api/messages/') && method === 'DELETE') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Unauthorized');

            const id = pathname.replace('/api/messages/', '').trim();
            const idx = dbCache.messages.findIndex(m => m.id === id);
            if (idx === -1) return sendError(res, 404, 'Message not found');

            dbCache.messages.splice(idx, 1);
            saveDatabase(true);
            logActivity(`Deleted contact message ${id}`);
            return sendJson(res, 200, { success: true, message: 'Message removed' });
        }

        // --- Newsletter Subscriptions Endpoints ---
        if (pathname === '/api/newsletter' && method === 'POST') {
            const body = await parseRequestBody(req);
            if (!body.email || !body.email.includes('@')) {
                return sendError(res, 400, 'Valid email address is required');
            }

            const cleanEmail = body.email.trim().toLowerCase();
            if (!dbCache.subscribers) dbCache.subscribers = [];

            if (!dbCache.subscribers.some(s => s.email.toLowerCase() === cleanEmail)) {
                dbCache.subscribers.unshift({
                    id: 'sub-' + Date.now(),
                    email: cleanEmail,
                    date: new Date().toISOString()
                });
                saveDatabase();
                logActivity(`New newsletter subscriber: ${cleanEmail}`, 'Public Visitor');
            }
            return sendJson(res, 200, { success: true, message: 'Subscribed successfully!' });
        }

        if (pathname === '/api/subscribers' && method === 'GET') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Unauthorized');
            return sendJson(res, 200, dbCache.subscribers || []);
        }

        if (pathname.startsWith('/api/subscribers/') && method === 'DELETE') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Unauthorized');

            const id = pathname.replace('/api/subscribers/', '').trim();
            const idx = dbCache.subscribers.findIndex(s => s.id === id);
            if (idx === -1) return sendError(res, 404, 'Subscriber not found');

            dbCache.subscribers.splice(idx, 1);
            saveDatabase(true);
            return sendJson(res, 200, { success: true, message: 'Subscriber removed' });
        }

        // --- Media / Image Upload Endpoint (Base64 data or multipart) ---
        if (pathname === '/api/upload' && method === 'POST') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Unauthorized');

            const body = await parseRequestBody(req);
            let { base64Data, filename } = body;

            if (!base64Data) {
                return sendError(res, 400, 'base64Data is required for file upload');
            }

            const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            let ext = '.png';
            let bufferData;

            if (matches && matches.length === 3) {
                const mime = matches[1];
                if (mime === 'image/jpeg' || mime === 'image/jpg') ext = '.jpg';
                else if (mime === 'image/webp') ext = '.webp';
                else if (mime === 'image/svg+xml') ext = '.svg';
                bufferData = Buffer.from(matches[2], 'base64');
            } else {
                bufferData = Buffer.from(base64Data, 'base64');
            }

            const safeFilename = 'upload_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + ext;
            const targetPath = path.join(UPLOADS_DIR, safeFilename);

            fs.writeFileSync(targetPath, bufferData);
            logActivity(`Uploaded media file: ${safeFilename}`);

            return sendJson(res, 201, {
                success: true,
                url: `/uploads/${safeFilename}`,
                filename: safeFilename
            });
        }

        // --- Aggregated Stats & Audit Logs for Admin Dashboard ---
        if (pathname === '/api/dashboard' && method === 'GET') {
            const session = authenticateToken(req);
            if (!session) return sendError(res, 401, 'Unauthorized');

            const totalViews = (dbCache.blogs || []).reduce((acc, b) => acc + (b.views || 0), 0);
            const unreadMessages = (dbCache.messages || []).filter(m => m.status === 'unread').length;

            return sendJson(res, 200, {
                stats: {
                    totalBlogs: dbCache.blogs?.length || 0,
                    publishedBlogs: (dbCache.blogs || []).filter(b => b.status === 'published').length,
                    totalViews,
                    totalMessages: dbCache.messages?.length || 0,
                    unreadMessages,
                    totalSubscribers: dbCache.subscribers?.length || 0,
                    impactTrees: dbCache.content?.stats?.find(s => s.id === 'stat-trees')?.number || 15000,
                    impactChildren: dbCache.content?.stats?.find(s => s.id === 'stat-children')?.number || 1200
                },
                recentMessages: (dbCache.messages || []).slice(0, 5),
                recentBlogs: (dbCache.blogs || []).slice(0, 5),
                activityLogs: (dbCache.activityLogs || []).slice(0, 10)
            });
        }

        // Unmatched API Route
        return sendError(res, 404, `API route not found: ${method} ${pathname}`);
    }

    /* ----------------------------------------------------------------------
       2. Web Page Serving with SEO Dynamic SSR Injection
       ---------------------------------------------------------------------- */

    // Favicon handler
    if (pathname === '/favicon.ico') {
        const icoPath = path.join(__dirname, 'favicon.ico');
        const pngPath = path.join(__dirname, 'favicon-32x32.png');
        const targetPath = fs.existsSync(icoPath) ? icoPath : (fs.existsSync(pngPath) ? pngPath : path.join(__dirname, 'logo.png'));
        res.writeHead(200, {
            'Content-Type': 'image/x-icon',
            'Cache-Control': 'public, max-age=86400'
        });
        return fs.createReadStream(targetPath).pipe(res);
    }

    // Dynamic XML Sitemap Generator
    if (pathname === '/sitemap.xml') {
        const domain = dbCache.seo?.global?.canonicalDomain || 'https://www.dagarfoundation.org';
        const pages = [
            { loc: `${domain}/`, priority: '1.0', changefreq: 'daily' },
            { loc: `${domain}/about`, priority: '0.8', changefreq: 'weekly' },
            { loc: `${domain}/missions`, priority: '0.8', changefreq: 'weekly' },
            { loc: `${domain}/approach`, priority: '0.8', changefreq: 'monthly' },
            { loc: `${domain}/blog`, priority: '0.8', changefreq: 'daily' },
            { loc: `${domain}/donate`, priority: '0.9', changefreq: 'weekly' },
            { loc: `${domain}/contact`, priority: '0.8', changefreq: 'monthly' }
        ];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        pages.forEach(p => {
            xml += `  <url>\n`;
            xml += `    <loc>${p.loc}</loc>\n`;
            xml += `    <changefreq>${p.changefreq}</changefreq>\n`;
            xml += `    <priority>${p.priority}</priority>\n`;
            xml += `  </url>\n`;
        });

        // Add published blog articles
        const publishedBlogs = (dbCache.blogs || []).filter(b => b.status === 'published');
        publishedBlogs.forEach(b => {
            const blogUrl = `${domain}/blog/${b.slug || b.id}`;
            const lastmod = b.date ? new Date(b.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            xml += `  <url>\n`;
            xml += `    <loc>${blogUrl}</loc>\n`;
            xml += `    <lastmod>${lastmod}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>0.7</priority>\n`;
            xml += `  </url>\n`;
        });

        xml += `</urlset>`;
        res.writeHead(200, {
            'Content-Type': 'application/xml; charset=UTF-8',
            'Cache-Control': 'public, max-age=3600'
        });
        return res.end(xml);
    }

    // Dynamic Robots.txt Generator
    if (pathname === '/robots.txt') {
        const domain = dbCache.seo?.global?.canonicalDomain || 'https://www.dagarfoundation.org';
        const robotsTxt = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${domain}/sitemap.xml\n`;
        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=UTF-8',
            'Cache-Control': 'public, max-age=86400'
        });
        return res.end(robotsTxt);
    }

    // Admin CMS Page
    if (pathname === '/admin' || pathname === '/admin.html') {
        const adminFile = path.join(__dirname, 'admin.html');
        if (fs.existsSync(adminFile)) {
            const content = fs.readFileSync(adminFile, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
            return res.end(content);
        }
    }

    // Dedicated Blog Page & Single Blog URL Routing
    if (pathname === '/blog' || pathname === '/blog.html' || pathname.startsWith('/blog/')) {
        const blogFile = path.join(__dirname, 'blog.html');
        if (fs.existsSync(blogFile)) {
            let html = fs.readFileSync(blogFile, 'utf-8');
            let post = null;

            if (pathname.startsWith('/blog/')) {
                const slug = pathname.replace('/blog/', '').split('?')[0].trim();
                post = dbCache.blogs.find(b => b.slug === slug || b.id === slug);
            }

            // Inject dynamic SEO meta tags into blog page
            html = injectSeoMeta(html, 'blog', post);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
            return res.end(html);
        }
    }

    // Standalone Pages with Dynamic SSR SEO Meta Injection
    const pageRouteMap = {
        '/about': { file: 'about.html', key: 'about' },
        '/about.html': { file: 'about.html', key: 'about' },
        '/missions': { file: 'missions.html', key: 'missions' },
        '/missions.html': { file: 'missions.html', key: 'missions' },
        '/approach': { file: 'approach.html', key: 'approach' },
        '/approach.html': { file: 'approach.html', key: 'approach' },
        '/contact': { file: 'contact.html', key: 'contact' },
        '/contact.html': { file: 'contact.html', key: 'contact' },
        '/donate': { file: 'donate.html', key: 'donate' },
        '/donate.html': { file: 'donate.html', key: 'donate' }
    };

    if (pageRouteMap[pathname]) {
        const { file, key } = pageRouteMap[pathname];
        const targetPath = path.join(__dirname, file);
        if (fs.existsSync(targetPath)) {
            let html = fs.readFileSync(targetPath, 'utf-8');
            html = injectSeoMeta(html, key);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
            return res.end(html);
        }
    }

    // Homepage and General Page Serving with SEO SSR
    if (pathname === '/' || pathname === '/index.html') {
        const indexFile = path.join(__dirname, 'index.html');
        if (fs.existsSync(indexFile)) {
            let html = fs.readFileSync(indexFile, 'utf-8');
            const pageKey = query.page || 'home';
            html = injectSeoMeta(html, pageKey);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
            return res.end(html);
        }
    }

    /* ----------------------------------------------------------------------
       3. Static Assets Serving (style.css, script.js, uploads, images, etc.)
       ---------------------------------------------------------------------- */
    let filePath = path.join(__dirname, decodeURIComponent(pathname));

    // Security check to avoid directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        return res.end('Access Forbidden');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        // Cache-control for static assets (shorter for css/js during development)
        const isCode = ext === '.css' || ext === '.js';
        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': isCode ? 'no-cache, must-revalidate' : 'public, max-age=86400'
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        return;
    }

    // If static file not found, fallback to index.html with 404 or redirect
    res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
    res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>404 - Page Not Found | Dagar Foundation</title><link rel="stylesheet" href="/style.css"></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;font-family:sans-serif;text-align:center;padding:20px;">
            <h1 style="color:var(--primary, #1b5e20);font-size:3rem;margin-bottom:10px;">404</h1>
            <h2>Oops! Page Not Found</h2>
            <p style="color:#666;max-width:500px;margin:15px auto;">The requested resource at <code>${escapeHtml(pathname)}</code> does not exist.</p>
            <div style="margin-top:20px;display:flex;gap:15px;">
                <a href="/" class="btn btn-primary" style="background:#1b5e20;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Go to Homepage</a>
                <a href="/blog.html" class="btn btn-outline" style="border:1px solid #1b5e20;color:#1b5e20;padding:10px 20px;border-radius:6px;text-decoration:none;">Explore Blogs</a>
            </div>
        </body>
        </html>
    `);
});

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Dagar Foundation Backend Server running on port ${PORT}`);
    console.log(`🌐 Public Website:     http://localhost:${PORT}/`);
    console.log(`📖 Stories & Blog:     http://localhost:${PORT}/blog.html`);
    console.log(`⚙️  Admin CMS Portal:   http://localhost:${PORT}/admin`);
    console.log(`🔑 Default Admin:      admin / admin123`);
    console.log(`🔌 REST API Base:      http://localhost:${PORT}/api/`);
    console.log(`=======================================================`);
});
