/**
 * Dagar Foundation - Executive Admin CMS & SEO Controller
 * Complete client-side application logic for site management
 */

document.addEventListener('DOMContentLoaded', () => {

    /* ==========================================================================
       State & Configuration
       ========================================================================== */
    const STATE = {
        token: localStorage.getItem('dagar_admin_token') || '',
        user: null,
        currentView: 'dashboard',
        currentSeoPage: 'home',
        seoData: null,
        contentData: null,
        blogsList: [],
        messagesList: [],
        subscribersList: [],
        dashboardData: null
    };

    const API_BASE = '/api';

    /* ==========================================================================
       Toast Notification System
       ========================================================================== */
    const toastContainer = document.getElementById('toast-container');

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `adm-toast ${type}`;
        
        let icon = 'fa-info-circle text-accent';
        if (type === 'success') icon = 'fa-circle-check text-success';
        if (type === 'error') icon = 'fa-circle-exclamation text-danger';

        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span style="font-size: 0.9rem; font-weight: 500;">${message}</span>
        `;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    /* ==========================================================================
       HTTP Helper with Automatic Auth Header
       ========================================================================== */
    async function apiRequest(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (STATE.token) {
            headers['Authorization'] = `Bearer ${STATE.token}`;
        }

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers
            });

            if (res.status === 401) {
                // Token expired or invalid
                handleLogout();
                showToast('Session expired. Please sign in again.', 'error');
                throw new Error('Unauthorized');
            }

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'API request failed');
            }
            return data;
        } catch (err) {
            console.error(`API Error [${endpoint}]:`, err);
            throw err;
        }
    }

    /* ==========================================================================
       Authentication & Session Management
       ========================================================================== */
    const authScreen = document.getElementById('auth-screen');
    const adminApp = document.getElementById('admin-app');
    const loginForm = document.getElementById('admin-login-form');
    const logoutBtn = document.getElementById('logout-btn');

    async function checkAuthStatus() {
        if (!STATE.token) {
            showLoginScreen();
            return;
        }

        try {
            const res = await apiRequest('/auth/check');
            if (res.authenticated) {
                STATE.user = { username: res.username, email: res.email };
                showAdminApp();
                initDashboard();
            } else {
                showLoginScreen();
            }
        } catch (e) {
            showLoginScreen();
        }
    }

    function showLoginScreen() {
        authScreen.style.display = 'flex';
        adminApp.style.display = 'none';
    }

    function showAdminApp() {
        authScreen.style.display = 'none';
        adminApp.style.display = 'flex';
        if (STATE.user) {
            document.getElementById('sidebar-user-name').innerText = STATE.user.username;
            document.getElementById('sidebar-user-avatar').innerText = STATE.user.username.charAt(0).toUpperCase();
        }
    }

    const togglePwdBtn = document.getElementById('toggle-pwd-visibility');
    const pwdInput = document.getElementById('login-password');
    const togglePwdIcon = document.getElementById('toggle-pwd-icon');

    if (togglePwdBtn && pwdInput) {
        togglePwdBtn.addEventListener('click', () => {
            const isPassword = pwdInput.type === 'password';
            pwdInput.type = isPassword ? 'text' : 'password';
            togglePwdIcon.className = isPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
        });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('login-submit-btn');

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Authenticating...';

        try {
            const data = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            STATE.token = data.token;
            STATE.user = data.user;
            localStorage.setItem('dagar_admin_token', data.token);

            showToast('Welcome back, Administrator!', 'success');
            showAdminApp();
            initDashboard();
        } catch (err) {
            showToast(err.message || 'Invalid login credentials', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Sign In to Dashboard</span><i class="fa-solid fa-arrow-right"></i>';
        }
    });

    function handleLogout() {
        if (STATE.token) {
            apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
        }
        STATE.token = '';
        STATE.user = null;
        localStorage.removeItem('dagar_admin_token');
        showLoginScreen();
    }

    logoutBtn.addEventListener('click', handleLogout);

    /* ==========================================================================
       View Navigation
       ========================================================================== */
    const navLinks = document.querySelectorAll('.menu-link[data-view]');
    const views = document.querySelectorAll('.admin-view');
    const headerTitle = document.getElementById('top-header-title');
    const headerSubtitle = document.getElementById('top-header-subtitle');

    const viewTitles = {
        dashboard: { title: 'Dashboard Overview', subtitle: 'Foundation metrics, recent inquiries, and quick shortcuts' },
        seo: { title: 'SEO & Meta Tags Controller', subtitle: 'Manage search engine titles, descriptions, social cards, and schema' },
        blogs: { title: 'Blog & Articles Engine', subtitle: 'Write, publish, and manage updates, stories, and field reports' },
        content: { title: 'Frontend Content Manager', subtitle: 'Edit each and every section, mission, approach, and headline' },
        messages: { title: 'Inquiries & Contact Leads', subtitle: 'Direct messages submitted through the website' },
        subscribers: { title: 'Newsletter Subscribers', subtitle: 'Community members receiving updates' },
        media: { title: 'Media & Uploads Library', subtitle: 'Upload and organize images and graphics' },
        settings: { title: 'Security & Admin Settings', subtitle: 'Manage credentials and administrative safety' }
    };

    function switchView(viewName) {
        STATE.currentView = viewName;

        navLinks.forEach(link => {
            if (link.getAttribute('data-view') === viewName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        views.forEach(v => {
            if (v.id === `view-${viewName}`) {
                v.classList.add('active');
            } else {
                v.classList.remove('active');
            }
        });

        if (viewTitles[viewName]) {
            headerTitle.innerText = viewTitles[viewName].title;
            headerSubtitle.innerText = viewTitles[viewName].subtitle;
        }

        // Lazy load specific view content
        if (viewName === 'dashboard') loadDashboardData();
        if (viewName === 'seo') loadSeoData();
        if (viewName === 'blogs') loadBlogsData();
        if (viewName === 'content') loadContentData();
        if (viewName === 'messages') loadMessagesData();
        if (viewName === 'subscribers') loadSubscribersData();
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            switchView(view);
        });
    });

    document.querySelectorAll('[data-switch-view]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const v = btn.getAttribute('data-switch-view');
            switchView(v);
        });
    });

    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    /* ==========================================================================
       1. Dashboard Data & Initialization
       ========================================================================== */
    async function initDashboard() {
        loadDashboardData();
        loadMessagesBadge();
    }

    async function loadDashboardData() {
        try {
            const data = await apiRequest('/dashboard');
            STATE.dashboardData = data;

            document.getElementById('stat-total-blogs').innerText = data.stats.totalBlogs || 0;
            document.getElementById('stat-total-views').innerText = (data.stats.totalViews || 0).toLocaleString();
            document.getElementById('stat-total-messages').innerText = data.stats.totalMessages || 0;
            document.getElementById('stat-unread-messages').innerText = data.stats.unreadMessages || 0;
            document.getElementById('stat-total-subscribers').innerText = data.stats.totalSubscribers || 0;

            // Render Recent Messages
            const tbody = document.getElementById('dashboard-messages-tbody');
            tbody.innerHTML = '';
            if (data.recentMessages && data.recentMessages.length > 0) {
                data.recentMessages.forEach(msg => {
                    const tr = document.createElement('tr');
                    const isUnread = msg.status === 'unread';
                    tr.innerHTML = `
                        <td><strong>${escapeHtml(msg.name)}</strong><br><small style="color: var(--adm-text-dim);">${escapeHtml(msg.email)}</small></td>
                        <td>${escapeHtml(msg.subject)}</td>
                        <td>${new Date(msg.date).toLocaleDateString()}</td>
                        <td><span class="status-pill ${isUnread ? 'status-unread' : 'status-read'}">${msg.status}</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--adm-text-dim);">No messages yet.</td></tr>`;
            }

            // Render Activity Logs
            const actList = document.getElementById('dashboard-activity-list');
            actList.innerHTML = '';
            if (data.activityLogs && data.activityLogs.length > 0) {
                data.activityLogs.forEach(act => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <i class="fa-solid fa-angle-right text-primary"></i> 
                        <strong>${escapeHtml(act.action)}</strong> 
                        <span style="color: var(--adm-text-dim); font-size: 0.75rem;">• ${timeAgo(new Date(act.timestamp))}</span>
                    `;
                    actList.appendChild(li);
                });
            }
        } catch (e) {
            console.error('Error loading dashboard data:', e);
        }
    }

    async function loadMessagesBadge() {
        try {
            const msgs = await apiRequest('/messages');
            const unreadCount = msgs.filter(m => m.status === 'unread').length;
            const badge = document.getElementById('sidebar-unread-badge');
            if (unreadCount > 0) {
                badge.style.display = 'inline-block';
                badge.innerText = unreadCount;
            } else {
                badge.style.display = 'none';
            }
        } catch (e) {}
    }

    /* ==========================================================================
       2. SEO Meta Tags Manager & Live SERP Preview
       ========================================================================== */
    const seoTabs = document.querySelectorAll('.seo-tab-btn[data-page]');
    const seoHeading = document.getElementById('seo-editing-heading');
    const inputTitle = document.getElementById('seo-input-title');
    const inputDesc = document.getElementById('seo-input-desc');
    const inputKeywords = document.getElementById('seo-input-keywords');
    const inputCanonical = document.getElementById('seo-input-canonical');
    const inputRobots = document.getElementById('seo-input-robots');
    const inputOgImage = document.getElementById('seo-input-ogimage');
    const inputOgTitle = document.getElementById('seo-input-ogtitle');
    const inputOgDesc = document.getElementById('seo-input-ogdesc');
    const inputSchema = document.getElementById('seo-input-schema');
    const globalExtraFields = document.getElementById('global-seo-extra-fields');

    const serpTitle = document.getElementById('serp-preview-title');
    const serpDesc = document.getElementById('serp-preview-desc');
    const serpUrl = document.getElementById('serp-preview-url');
    const socialTitle = document.getElementById('social-preview-title');
    const socialDesc = document.getElementById('social-preview-desc');
    const socialImg = document.getElementById('social-preview-img');
    const titleCount = document.getElementById('title-char-count');
    const descCount = document.getElementById('desc-char-count');
    const saveSeoBtn = document.getElementById('save-seo-btn');

    async function loadSeoData() {
        try {
            const data = await apiRequest('/seo');
            STATE.seoData = data;
            populateSeoForm(STATE.currentSeoPage);
        } catch (e) {
            showToast('Failed to load SEO configuration', 'error');
        }
    }

    function populateSeoForm(pageKey) {
        STATE.currentSeoPage = pageKey;

        seoTabs.forEach(tab => {
            if (tab.getAttribute('data-page') === pageKey) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        const isGlobal = pageKey === 'global';
        globalExtraFields.style.display = isGlobal ? 'block' : 'none';

        if (isGlobal) {
            seoHeading.innerHTML = `<i class="fa-solid fa-code text-accent"></i> Configuring: Global SEO Defaults & Schema.org`;
            const g = STATE.seoData?.global || {};
            inputTitle.value = g.defaultTitle || '';
            inputDesc.value = g.defaultDescription || '';
            inputKeywords.value = g.defaultKeywords || '';
            inputCanonical.value = g.canonicalDomain || 'https://www.dagarfoundation.org';
            inputRobots.value = g.robots || 'index, follow';
            inputOgImage.value = g.ogImage || '/logo.png';
            inputOgTitle.value = g.defaultTitle || '';
            inputOgDesc.value = g.defaultDescription || '';
            inputSchema.value = JSON.stringify(g.schemaOrg || {}, null, 2);
            serpUrl.innerText = g.canonicalDomain || 'https://www.dagarfoundation.org';
        } else {
            const pageNames = {
                home: 'Homepage (/)',
                about: 'About Us (/about.html)',
                missions: 'Our Missions (/missions.html)',
                approach: 'Our Approach (/approach.html)',
                blog: 'Blog Hub (/blog.html)',
                donate: 'Support & Donate (/donate.html)',
                contact: 'Contact & Volunteer (/contact.html)'
            };
            seoHeading.innerHTML = `<i class="fa-solid fa-magnifying-glass text-primary"></i> Configuring SEO for: ${pageNames[pageKey] || pageKey}`;

            const p = STATE.seoData?.pages?.[pageKey] || {};
            inputTitle.value = p.title || '';
            inputDesc.value = p.description || '';
            inputKeywords.value = p.keywords || '';
            inputCanonical.value = p.canonical || (pageKey === 'home' ? 'https://www.dagarfoundation.org/' : `https://www.dagarfoundation.org/${pageKey}.html`);
            inputRobots.value = p.robots || 'index, follow';
            inputOgImage.value = p.ogImage || '/logo.png';
            inputOgTitle.value = p.ogTitle || p.title || '';
            inputOgDesc.value = p.ogDescription || p.description || '';
            serpUrl.innerText = p.canonical || (pageKey === 'home' ? 'https://www.dagarfoundation.org/' : `https://www.dagarfoundation.org/${pageKey}.html`);
        }

        updateSeoPreview();
    }

    function updateSeoPreview() {
        const title = inputTitle.value.trim() || 'Dagar Foundation | Empowering Communities';
        const desc = inputDesc.value.trim() || 'Dagar Foundation is a non-governmental organization dedicated to environmental safety and education for all.';
        const canonical = inputCanonical.value.trim() || 'https://www.dagarfoundation.org';
        const ogTitle = inputOgTitle.value.trim() || title;
        const ogDesc = inputOgDesc.value.trim() || desc;
        const ogImg = inputOgImage.value.trim() || 'logo.png';

        // Google SERP Snippet
        serpTitle.innerText = title;
        serpDesc.innerText = desc;
        serpUrl.innerText = canonical;

        // Social Preview Card
        socialTitle.innerText = ogTitle;
        socialDesc.innerText = ogDesc;
        socialImg.src = ogImg;

        // Char counts
        const tLen = inputTitle.value.length;
        titleCount.innerText = `${tLen} / 60 chars`;
        titleCount.className = `char-count-badge ${tLen > 60 ? 'warning' : 'ok'}`;

        const dLen = inputDesc.value.length;
        descCount.innerText = `${dLen} / 160 chars`;
        descCount.className = `char-count-badge ${dLen > 160 ? 'warning' : 'ok'}`;
    }

    inputTitle.addEventListener('input', updateSeoPreview);
    inputDesc.addEventListener('input', updateSeoPreview);
    inputCanonical.addEventListener('input', updateSeoPreview);
    inputOgTitle.addEventListener('input', updateSeoPreview);
    inputOgDesc.addEventListener('input', updateSeoPreview);
    inputOgImage.addEventListener('input', updateSeoPreview);

    seoTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const page = tab.getAttribute('data-page');
            populateSeoForm(page);
        });
    });

    saveSeoBtn.addEventListener('click', async () => {
        saveSeoBtn.disabled = true;
        saveSeoBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';

        try {
            const pageKey = STATE.currentSeoPage;
            let payload = {};

            if (pageKey === 'global') {
                let parsedSchema = {};
                try {
                    parsedSchema = JSON.parse(inputSchema.value);
                } catch (err) {
                    showToast('Invalid JSON in Schema.org box. Please correct format.', 'error');
                    saveSeoBtn.disabled = false;
                    saveSeoBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save SEO Meta Tags';
                    return;
                }

                payload = {
                    global: {
                        defaultTitle: inputTitle.value.trim(),
                        defaultDescription: inputDesc.value.trim(),
                        defaultKeywords: inputKeywords.value.trim(),
                        canonicalDomain: inputCanonical.value.trim(),
                        robots: inputRobots.value,
                        ogImage: inputOgImage.value.trim(),
                        schemaOrg: parsedSchema
                    }
                };
            } else {
                payload = {
                    pageKey: pageKey,
                    pageData: {
                        title: inputTitle.value.trim(),
                        description: inputDesc.value.trim(),
                        keywords: inputKeywords.value.trim(),
                        canonical: inputCanonical.value.trim(),
                        robots: inputRobots.value,
                        ogImage: inputOgImage.value.trim(),
                        ogTitle: inputOgTitle.value.trim() || inputTitle.value.trim(),
                        ogDescription: inputOgDesc.value.trim() || inputDesc.value.trim()
                    }
                };
            }

            const res = await apiRequest('/seo', {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            STATE.seoData = res.seo;
            showToast(`SEO tags for ${pageKey.toUpperCase()} updated successfully!`, 'success');
        } catch (err) {
            showToast('Failed to save SEO tags: ' + err.message, 'error');
        } finally {
            saveSeoBtn.disabled = false;
            saveSeoBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save SEO Meta Tags';
        }
    });

    /* ==========================================================================
       3. Blog Articles Manager
       ========================================================================== */
    const blogsTbody = document.getElementById('blogs-table-tbody');
    const blogModal = document.getElementById('blog-modal');
    const closeBlogModalBtn = document.getElementById('close-blog-modal');
    const cancelBlogBtn = document.getElementById('cancel-blog-btn');
    const openNewBlogModalBtn = document.getElementById('open-new-blog-modal-btn');
    const headerNewBlogBtn = document.getElementById('header-new-blog-btn');
    const saveBlogPostBtn = document.getElementById('save-blog-post-btn');
    const blogSearchInput = document.getElementById('blog-search-input');
    const blogCatFilter = document.getElementById('blog-category-filter');
    const blogStatusFilter = document.getElementById('blog-status-filter');

    async function loadBlogsData() {
        try {
            const blogs = await apiRequest('/blogs');
            STATE.blogsList = blogs;
            renderBlogsTable();
        } catch (e) {
            showToast('Failed to load blog posts', 'error');
        }
    }

    function renderBlogsTable() {
        const query = (blogSearchInput.value || '').toLowerCase();
        const cat = blogCatFilter.value;
        const status = blogStatusFilter.value;

        let filtered = STATE.blogsList.filter(b => {
            if (cat && b.category !== cat) return false;
            if (status && b.status !== status) return false;
            if (query) {
                const matchTitle = b.title && b.title.toLowerCase().includes(query);
                const matchExcerpt = b.excerpt && b.excerpt.toLowerCase().includes(query);
                return matchTitle || matchExcerpt;
            }
            return true;
        });

        blogsTbody.innerHTML = '';
        if (filtered.length === 0) {
            blogsTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--adm-text-dim); padding: 24px;">No articles found matching filters.</td></tr>`;
            return;
        }

        filtered.forEach(post => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="table-post-title">
                        <img src="${post.coverImage || 'logo.png'}" class="post-table-thumb" alt="Thumb" onerror="this.src='logo.png'">
                        <div>
                            <div>${escapeHtml(post.title)}</div>
                            <small style="color: var(--adm-text-dim); font-size: 0.75rem;">/blog/${post.slug}</small>
                        </div>
                    </div>
                </td>
                <td><span style="font-weight: 600; color: var(--adm-accent);">${escapeHtml(post.category)}</span></td>
                <td>${escapeHtml(post.author || 'Editorial Desk')}</td>
                <td>${post.date || 'N/A'}</td>
                <td><strong>${(post.views || 0).toLocaleString()}</strong></td>
                <td><span class="status-pill ${post.status === 'published' ? 'status-published' : 'status-draft'}">${post.status}</span></td>
                <td>
                    <div class="table-actions">
                        <a href="/blog.html?post=${post.slug}" target="_blank" class="btn-action" title="View live"><i class="fa-solid fa-eye"></i></a>
                        <button class="btn-action edit-blog-btn" data-id="${post.id}" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn-action btn-delete delete-blog-btn" data-id="${post.id}" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            `;
            blogsTbody.appendChild(tr);
        });

        // Attach event listeners
        document.querySelectorAll('.edit-blog-btn').forEach(btn => {
            btn.addEventListener('click', () => openBlogModal(btn.getAttribute('data-id')));
        });
        document.querySelectorAll('.delete-blog-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteBlogPost(btn.getAttribute('data-id')));
        });
    }

    blogSearchInput.addEventListener('input', renderBlogsTable);
    blogCatFilter.addEventListener('change', renderBlogsTable);
    blogStatusFilter.addEventListener('change', renderBlogsTable);

    function openBlogModal(id = null) {
        const form = document.getElementById('blog-editor-form');
        form.reset();
        document.getElementById('blog-edit-id').value = id || '';

        if (id) {
            const post = STATE.blogsList.find(b => b.id === id);
            if (!post) return;
            document.getElementById('blog-modal-title').innerText = 'Edit Blog Article';
            document.getElementById('bm-title').value = post.title || '';
            document.getElementById('bm-slug').value = post.slug || '';
            document.getElementById('bm-category').value = post.category || 'Environment';
            document.getElementById('bm-author').value = post.author || 'Dagar Foundation';
            document.getElementById('bm-date').value = post.date || new Date().toISOString().split('T')[0];
            document.getElementById('bm-readtime').value = post.readTime || '4 min read';
            document.getElementById('bm-cover').value = post.coverImage || '';
            document.getElementById('bm-excerpt').value = post.excerpt || '';
            document.getElementById('bm-content').value = post.content || '';
            document.getElementById('bm-tags').value = (post.tags || []).join(', ');
            document.getElementById('bm-featured').checked = Boolean(post.featured);
            document.getElementById('bm-status').value = post.status || 'published';
            document.getElementById('bm-seo-title').value = post.seo?.title || '';
            document.getElementById('bm-seo-desc').value = post.seo?.description || '';
        } else {
            document.getElementById('blog-modal-title').innerText = 'Write New Blog Article';
            document.getElementById('bm-date').value = new Date().toISOString().split('T')[0];
        }

        blogModal.classList.add('active');
    }

    function closeBlogModal() {
        blogModal.classList.remove('active');
    }

    closeBlogModalBtn.addEventListener('click', closeBlogModal);
    cancelBlogBtn.addEventListener('click', closeBlogModal);
    openNewBlogModalBtn.addEventListener('click', () => openBlogModal());
    headerNewBlogBtn.addEventListener('click', () => {
        switchView('blogs');
        openBlogModal();
    });

    // Rich text quick wrapper
    document.querySelectorAll('.wysiwyg-toolbar .tb-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-tag');
            const textarea = document.getElementById('bm-content');
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selected = textarea.value.substring(start, end) || 'text';
            
            let wrapped = `<${tag}>${selected}</${tag}>`;
            if (tag === 'ul') wrapped = `<ul>\n  <li>${selected}</li>\n</ul>`;

            textarea.setRangeText(wrapped, start, end, 'end');
            textarea.focus();
        });
    });

    // Image Upload inside Blog Modal
    const bmUploadBtn = document.getElementById('bm-upload-btn');
    const bmFileInput = document.getElementById('bm-file-input');
    bmUploadBtn.addEventListener('click', () => bmFileInput.click());

    bmFileInput.addEventListener('change', async () => {
        if (!bmFileInput.files || !bmFileInput.files[0]) return;
        const file = bmFileInput.files[0];
        const reader = new FileReader();
        bmUploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        reader.onload = async () => {
            try {
                const res = await apiRequest('/upload', {
                    method: 'POST',
                    body: JSON.stringify({ base64Data: reader.result, filename: file.name })
                });
                document.getElementById('bm-cover').value = res.url;
                showToast('Image uploaded successfully!', 'success');
            } catch (err) {
                showToast('Upload failed: ' + err.message, 'error');
            } finally {
                bmUploadBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Upload';
            }
        };
        reader.readAsDataURL(file);
    });

    // Save Blog Post
    saveBlogPostBtn.addEventListener('click', async () => {
        const id = document.getElementById('blog-edit-id').value;
        const title = document.getElementById('bm-title').value.trim();
        const content = document.getElementById('bm-content').value.trim();
        const excerpt = document.getElementById('bm-excerpt').value.trim();

        if (!title || !content || !excerpt) {
            showToast('Please fill out the Title, Excerpt, and Article Content.', 'error');
            return;
        }

        saveBlogPostBtn.disabled = true;
        saveBlogPostBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving Article...';

        const payload = {
            title,
            slug: document.getElementById('bm-slug').value.trim(),
            category: document.getElementById('bm-category').value,
            author: document.getElementById('bm-author').value.trim(),
            date: document.getElementById('bm-date').value,
            readTime: document.getElementById('bm-readtime').value.trim() || '4 min read',
            coverImage: document.getElementById('bm-cover').value.trim() || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80',
            excerpt,
            content,
            tags: document.getElementById('bm-tags').value.split(',').map(t => t.trim()).filter(Boolean),
            featured: document.getElementById('bm-featured').checked,
            status: document.getElementById('bm-status').value,
            seo: {
                title: document.getElementById('bm-seo-title').value.trim() || title,
                description: document.getElementById('bm-seo-desc').value.trim() || excerpt
            }
        };

        try {
            if (id) {
                await apiRequest(`/blogs/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                showToast('Article updated successfully!', 'success');
            } else {
                await apiRequest('/blogs', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                showToast('New article published successfully!', 'success');
            }
            closeBlogModal();
            loadBlogsData();
        } catch (err) {
            showToast('Failed to save article: ' + err.message, 'error');
        } finally {
            saveBlogPostBtn.disabled = false;
            saveBlogPostBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save & Publish Article';
        }
    });

    async function deleteBlogPost(id) {
        if (!confirm('Are you sure you want to delete this blog post? This cannot be undone.')) return;
        try {
            await apiRequest(`/blogs/${id}`, { method: 'DELETE' });
            showToast('Article removed.', 'info');
            loadBlogsData();
        } catch (e) {
            showToast('Failed to delete article: ' + e.message, 'error');
        }
    }

    /* ==========================================================================
       4. Frontend Site Content Manager ("Manager each and every thing")
       ========================================================================== */
    const contentTabs = document.querySelectorAll('.seo-tab-btn[data-content-tab]');
    const contentPanes = document.querySelectorAll('.content-tab-pane');
    const saveAllContentBtn = document.getElementById('save-all-content-btn');

    contentTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-content-tab');
            contentTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            contentPanes.forEach(pane => {
                pane.style.display = pane.id === `content-tab-${target}` ? 'block' : 'none';
            });
        });
    });

    async function loadContentData() {
        try {
            const data = await apiRequest('/content');
            STATE.contentData = data;
            populateContentForm(data);
        } catch (e) {
            showToast('Failed to load website content', 'error');
        }
    }

    function populateContentForm(c) {
        // Branding
        const b = c.branding || {};
        document.getElementById('cnt-brand-name').value = b.siteName || '';
        document.getElementById('cnt-brand-tagline').value = b.tagline || '';
        document.getElementById('cnt-brand-email').value = b.email || '';
        document.getElementById('cnt-brand-phone').value = b.phone || '';
        document.getElementById('cnt-brand-address').value = b.address || '';
        document.getElementById('cnt-brand-website').value = b.website || '';
        const soc = b.socials || {};
        document.getElementById('cnt-social-fb').value = soc.facebook || '';
        document.getElementById('cnt-social-tw').value = soc.twitter || '';
        document.getElementById('cnt-social-ig').value = soc.instagram || '';
        document.getElementById('cnt-social-li').value = soc.linkedin || '';

        // Hero
        const h = c.hero || {};
        document.getElementById('cnt-hero-badge').value = h.badge || '';
        document.getElementById('cnt-hero-title').value = h.title || '';
        document.getElementById('cnt-hero-desc').value = h.description || '';
        document.getElementById('cnt-hero-btn1-txt').value = h.ctaPrimaryText || '';
        document.getElementById('cnt-hero-btn1-link').value = h.ctaPrimaryLink || '';
        document.getElementById('cnt-hero-btn2-txt').value = h.ctaSecondaryText || '';
        document.getElementById('cnt-hero-btn2-link').value = h.ctaSecondaryLink || '';

        // Stats
        renderStatsEditor(c.stats || []);

        // About
        const ab = c.about || {};
        document.getElementById('cnt-about-subtitle').value = ab.subTitle || '';
        document.getElementById('cnt-about-title').value = ab.title || '';
        document.getElementById('cnt-about-lead').value = ab.leadText || '';
        document.getElementById('cnt-about-body').value = ab.bodyText || '';
        document.getElementById('cnt-about-card-title').value = ab.cardTitle || '';
        document.getElementById('cnt-about-card-text').value = ab.cardText || '';

        // Missions
        renderMissionsEditor(c.missions || []);

        // Approach
        const ap = c.approach || {};
        document.getElementById('cnt-approach-title').value = ap.title || '';
        document.getElementById('cnt-approach-intro').value = ap.intro || '';
        renderApproachEditor(ap.steps || []);

        // Donation
        const dn = c.donation || {};
        document.getElementById('cnt-donation-beneficiary').value = dn.beneficiary || '';
        document.getElementById('cnt-donation-upi').value = dn.upiId || '';
        document.getElementById('cnt-donation-title').value = dn.title || '';
        document.getElementById('cnt-donation-intro').value = dn.intro || '';
        document.getElementById('cnt-donation-allocations').value = (dn.allocations || []).join('\n');

        const bk = dn.bankDetails || {};
        const bankNameEl = document.getElementById('cnt-bank-name');
        if (bankNameEl) bankNameEl.value = bk.accountName || '';
        const bankAccEl = document.getElementById('cnt-bank-acc');
        if (bankAccEl) bankAccEl.value = bk.accountNumber || '';
        const bankIfscEl = document.getElementById('cnt-bank-ifsc');
        if (bankIfscEl) bankIfscEl.value = bk.ifscCode || '';
        const bankBranchEl = document.getElementById('cnt-bank-branch');
        if (bankBranchEl) bankBranchEl.value = bk.bankName ? `${bk.bankName} - ${bk.branch || ''}` : '';

        // Contact Page & FAQs
        const ct = c.contact || {};
        const ctPhoneEl = document.getElementById('cnt-contact-phone');
        if (ctPhoneEl) ctPhoneEl.value = ct.phone || b.phone || '';
        const ctEmailEl = document.getElementById('cnt-contact-email');
        if (ctEmailEl) ctEmailEl.value = ct.email || b.email || '';
        const ctAddressEl = document.getElementById('cnt-contact-address');
        if (ctAddressEl) ctAddressEl.value = ct.address || b.address || '';
        const ctHoursEl = document.getElementById('cnt-contact-hours');
        if (ctHoursEl) ctHoursEl.value = ct.hours || 'Mon - Sat: 9:00 AM - 6:00 PM (IST)';
        const volTitleEl = document.getElementById('cnt-volunteer-title');
        if (volTitleEl) volTitleEl.value = ct.volunteerTitle || 'Volunteer With Us';
        const volTextEl = document.getElementById('cnt-volunteer-text');
        if (volTextEl) volTextEl.value = ct.volunteerText || '';
        renderFaqsEditor(ct.faqs || []);
    }

    function renderStatsEditor(stats) {
        const container = document.getElementById('stats-cards-container');
        container.innerHTML = '';
        stats.forEach((st, idx) => {
            const card = document.createElement('div');
            card.style.cssText = 'background: var(--adm-surface-card); border: 1px solid var(--adm-border); border-radius: 8px; padding: 16px;';
            card.innerHTML = `
                <div class="form-group">
                    <label class="form-label">Metric Label</label>
                    <input type="text" class="form-input stat-input-label" data-idx="${idx}" value="${escapeHtml(st.label)}">
                </div>
                <div class="form-group">
                    <label class="form-label">Numeric Target (e.g. 15000)</label>
                    <input type="number" class="form-input stat-input-num" data-idx="${idx}" value="${st.number}">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label">Icon Class</label>
                    <input type="text" class="form-input stat-input-icon" data-idx="${idx}" value="${escapeHtml(st.icon)}">
                </div>
            `;
            container.appendChild(card);
        });
    }

    function renderMissionsEditor(missions) {
        const container = document.getElementById('missions-list-container');
        container.innerHTML = '';
        missions.forEach((m, idx) => {
            const card = document.createElement('div');
            card.style.cssText = 'background: var(--adm-surface-card); border: 1px solid var(--adm-border); border-radius: 8px; padding: 18px;';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h4 style="color: var(--adm-accent);">Mission #${idx + 1}: ${escapeHtml(m.title)}</h4>
                    <button type="button" class="btn-action btn-delete delete-mission-btn" data-idx="${idx}" title="Remove"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 14px; margin-bottom: 12px;">
                    <div>
                        <label class="form-label">Title</label>
                        <input type="text" class="form-input mission-input-title" data-idx="${idx}" value="${escapeHtml(m.title)}">
                    </div>
                    <div>
                        <label class="form-label">Icon Class</label>
                        <input type="text" class="form-input mission-input-icon" data-idx="${idx}" value="${escapeHtml(m.icon)}">
                    </div>
                    <div>
                        <label class="form-label">Color Token</label>
                        <input type="text" class="form-input mission-input-color" data-idx="${idx}" value="${escapeHtml(m.colorVar || 'color-env')}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea class="form-textarea mission-input-desc" data-idx="${idx}" rows="2">${escapeHtml(m.desc)}</textarea>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label">Tags (comma separated)</label>
                    <input type="text" class="form-input mission-input-tags" data-idx="${idx}" value="${(m.tags || []).join(', ')}">
                </div>
            `;
            container.appendChild(card);
        });

        document.querySelectorAll('.delete-mission-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                STATE.contentData.missions.splice(idx, 1);
                renderMissionsEditor(STATE.contentData.missions);
            });
        });
    }

    document.getElementById('add-new-mission-btn').addEventListener('click', () => {
        if (!STATE.contentData.missions) STATE.contentData.missions = [];
        STATE.contentData.missions.push({
            id: 'mission-' + Date.now(),
            title: 'New Community Initiative',
            icon: 'fa-hand-holding-heart',
            colorVar: 'color-edu',
            desc: 'Describe your community program objectives and ongoing impact here.',
            tags: ['#Initiative', '#Community']
        });
        renderMissionsEditor(STATE.contentData.missions);
    });

    function renderApproachEditor(steps) {
        const container = document.getElementById('approach-steps-container');
        container.innerHTML = '';
        steps.forEach((st, idx) => {
            const card = document.createElement('div');
            card.style.cssText = 'background: var(--adm-surface-card); border: 1px solid var(--adm-border); border-radius: 8px; padding: 14px;';
            card.innerHTML = `
                <div style="display: grid; grid-template-columns: 80px 1fr; gap: 14px; margin-bottom: 8px;">
                    <div>
                        <label class="form-label">Step</label>
                        <input type="text" class="form-input step-input-num" data-idx="${idx}" value="${escapeHtml(st.num)}">
                    </div>
                    <div>
                        <label class="form-label">Step Title</label>
                        <input type="text" class="form-input step-input-title" data-idx="${idx}" value="${escapeHtml(st.title)}">
                    </div>
                </div>
                <div>
                    <label class="form-label">Step Description</label>
                    <textarea class="form-textarea step-input-desc" data-idx="${idx}" rows="2">${escapeHtml(st.desc)}</textarea>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function renderFaqsEditor(faqs) {
        const container = document.getElementById('faqs-list-container');
        if (!container) return;
        container.innerHTML = '';
        (faqs || []).forEach((faq, idx) => {
            const card = document.createElement('div');
            card.style.cssText = 'background: var(--adm-surface-card); border: 1px solid var(--adm-border); border-radius: 8px; padding: 14px;';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; color: var(--adm-primary);">FAQ #${idx + 1}</span>
                    <button type="button" class="btn-action btn-delete delete-faq-btn" data-idx="${idx}" title="Remove"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="form-group" style="margin-bottom: 10px;">
                    <label class="form-label">Question</label>
                    <input type="text" class="form-input faq-input-q" data-idx="${idx}" value="${escapeHtml(faq.q)}">
                </div>
                <div>
                    <label class="form-label">Answer</label>
                    <textarea class="form-textarea faq-input-a" data-idx="${idx}" rows="2">${escapeHtml(faq.a)}</textarea>
                </div>
            `;
            container.appendChild(card);
        });

        document.querySelectorAll('.delete-faq-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                if (!STATE.contentData.contact) STATE.contentData.contact = { faqs: [] };
                STATE.contentData.contact.faqs.splice(idx, 1);
                renderFaqsEditor(STATE.contentData.contact.faqs);
            });
        });
    }

    const addFaqBtn = document.getElementById('add-new-faq-btn');
    if (addFaqBtn) {
        addFaqBtn.addEventListener('click', () => {
            if (!STATE.contentData.contact) STATE.contentData.contact = { faqs: [] };
            if (!Array.isArray(STATE.contentData.contact.faqs)) STATE.contentData.contact.faqs = [];
            STATE.contentData.contact.faqs.push({
                q: 'New Question?',
                a: 'Helpful answer providing guidance to visitors or volunteers.'
            });
            renderFaqsEditor(STATE.contentData.contact.faqs);
        });
    }

    saveAllContentBtn.addEventListener('click', async () => {
        saveAllContentBtn.disabled = true;
        saveAllContentBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Updating Site Content...';

        // Gather updated stats
        const updatedStats = (STATE.contentData?.stats || []).map((st, idx) => {
            const labelEl = document.querySelector(`.stat-input-label[data-idx="${idx}"]`);
            const numEl = document.querySelector(`.stat-input-num[data-idx="${idx}"]`);
            const iconEl = document.querySelector(`.stat-input-icon[data-idx="${idx}"]`);
            return {
                ...st,
                label: labelEl ? labelEl.value.trim() : st.label,
                number: numEl ? parseInt(numEl.value, 10) || 0 : st.number,
                icon: iconEl ? iconEl.value.trim() : st.icon
            };
        });

        // Gather updated missions
        const updatedMissions = (STATE.contentData?.missions || []).map((m, idx) => {
            const titleEl = document.querySelector(`.mission-input-title[data-idx="${idx}"]`);
            const iconEl = document.querySelector(`.mission-input-icon[data-idx="${idx}"]`);
            const colorEl = document.querySelector(`.mission-input-color[data-idx="${idx}"]`);
            const descEl = document.querySelector(`.mission-input-desc[data-idx="${idx}"]`);
            const tagsEl = document.querySelector(`.mission-input-tags[data-idx="${idx}"]`);
            return {
                ...m,
                title: titleEl ? titleEl.value.trim() : m.title,
                icon: iconEl ? iconEl.value.trim() : m.icon,
                colorVar: colorEl ? colorEl.value.trim() : m.colorVar,
                desc: descEl ? descEl.value.trim() : m.desc,
                tags: tagsEl ? tagsEl.value.split(',').map(t => t.trim()).filter(Boolean) : m.tags
            };
        });

        // Gather updated approach steps
        const updatedSteps = (STATE.contentData?.approach?.steps || []).map((s, idx) => {
            const numEl = document.querySelector(`.step-input-num[data-idx="${idx}"]`);
            const titleEl = document.querySelector(`.step-input-title[data-idx="${idx}"]`);
            const descEl = document.querySelector(`.step-input-desc[data-idx="${idx}"]`);
            return {
                num: numEl ? numEl.value.trim() : s.num,
                title: titleEl ? titleEl.value.trim() : s.title,
                desc: descEl ? descEl.value.trim() : s.desc
            };
        });

        // Gather updated FAQs
        const updatedFaqs = (STATE.contentData?.contact?.faqs || []).map((f, idx) => {
            const qEl = document.querySelector(`.faq-input-q[data-idx="${idx}"]`);
            const aEl = document.querySelector(`.faq-input-a[data-idx="${idx}"]`);
            return {
                q: qEl ? qEl.value.trim() : f.q,
                a: aEl ? aEl.value.trim() : f.a
            };
        });

        const updatedContent = {
            branding: {
                siteName: document.getElementById('cnt-brand-name').value.trim(),
                tagline: document.getElementById('cnt-brand-tagline').value.trim(),
                email: document.getElementById('cnt-brand-email').value.trim(),
                phone: document.getElementById('cnt-brand-phone').value.trim(),
                address: document.getElementById('cnt-brand-address').value.trim(),
                website: document.getElementById('cnt-brand-website').value.trim(),
                socials: {
                    facebook: document.getElementById('cnt-social-fb').value.trim(),
                    twitter: document.getElementById('cnt-social-tw').value.trim(),
                    instagram: document.getElementById('cnt-social-ig').value.trim(),
                    linkedin: document.getElementById('cnt-social-li').value.trim()
                }
            },
            hero: {
                badge: document.getElementById('cnt-hero-badge').value.trim(),
                title: document.getElementById('cnt-hero-title').value.trim(),
                description: document.getElementById('cnt-hero-desc').value.trim(),
                ctaPrimaryText: document.getElementById('cnt-hero-btn1-txt').value.trim(),
                ctaPrimaryLink: document.getElementById('cnt-hero-btn1-link').value.trim(),
                ctaSecondaryText: document.getElementById('cnt-hero-btn2-txt').value.trim(),
                ctaSecondaryLink: document.getElementById('cnt-hero-btn2-link').value.trim()
            },
            stats: updatedStats,
            about: {
                subTitle: document.getElementById('cnt-about-subtitle').value.trim(),
                title: document.getElementById('cnt-about-title').value.trim(),
                leadText: document.getElementById('cnt-about-lead').value.trim(),
                bodyText: document.getElementById('cnt-about-body').value.trim(),
                cardTitle: document.getElementById('cnt-about-card-title').value.trim(),
                cardText: document.getElementById('cnt-about-card-text').value.trim(),
                features: STATE.contentData?.about?.features || []
            },
            missions: updatedMissions,
            approach: {
                subTitle: 'How We Work',
                title: document.getElementById('cnt-approach-title').value.trim(),
                intro: document.getElementById('cnt-approach-intro').value.trim(),
                steps: updatedSteps
            },
            contact: {
                phone: document.getElementById('cnt-contact-phone') ? document.getElementById('cnt-contact-phone').value.trim() : '',
                email: document.getElementById('cnt-contact-email') ? document.getElementById('cnt-contact-email').value.trim() : '',
                address: document.getElementById('cnt-contact-address') ? document.getElementById('cnt-contact-address').value.trim() : '',
                hours: document.getElementById('cnt-contact-hours') ? document.getElementById('cnt-contact-hours').value.trim() : '',
                volunteerTitle: document.getElementById('cnt-volunteer-title') ? document.getElementById('cnt-volunteer-title').value.trim() : '',
                volunteerText: document.getElementById('cnt-volunteer-text') ? document.getElementById('cnt-volunteer-text').value.trim() : '',
                faqs: updatedFaqs
            },
            donation: {
                beneficiary: document.getElementById('cnt-donation-beneficiary').value.trim(),
                upiId: document.getElementById('cnt-donation-upi').value.trim(),
                title: document.getElementById('cnt-donation-title').value.trim(),
                intro: document.getElementById('cnt-donation-intro').value.trim(),
                allocations: document.getElementById('cnt-donation-allocations').value.split('\n').map(a => a.trim()).filter(Boolean),
                bankDetails: {
                    accountName: document.getElementById('cnt-bank-name') ? document.getElementById('cnt-bank-name').value.trim() : '',
                    accountNumber: document.getElementById('cnt-bank-acc') ? document.getElementById('cnt-bank-acc').value.trim() : '',
                    ifscCode: document.getElementById('cnt-bank-ifsc') ? document.getElementById('cnt-bank-ifsc').value.trim() : '',
                    bankName: document.getElementById('cnt-bank-branch') ? document.getElementById('cnt-bank-branch').value.trim() : ''
                }
            }
        };

        try {
            const res = await apiRequest('/content', {
                method: 'PUT',
                body: JSON.stringify(updatedContent)
            });
            STATE.contentData = res.content;
            showToast('All frontend website content updated live!', 'success');
        } catch (err) {
            showToast('Failed to save website content: ' + err.message, 'error');
        } finally {
            saveAllContentBtn.disabled = false;
            saveAllContentBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Content Updates';
        }
    });

    /* ==========================================================================
       5. Messages & Inquiries Management
       ========================================================================== */
    const msgTbody = document.getElementById('messages-table-tbody');
    const msgStatusFilter = document.getElementById('messages-filter-status');
    const msgModal = document.getElementById('msg-modal');
    const msgModalBody = document.getElementById('msg-modal-body');
    const msgReplyLink = document.getElementById('msg-reply-link');
    const closeMsgModalBtn = document.getElementById('close-msg-modal');
    const closeMsgModalBtn2 = document.getElementById('close-msg-modal-btn');

    async function loadMessagesData() {
        try {
            const msgs = await apiRequest('/messages');
            STATE.messagesList = msgs;
            renderMessagesTable();
            loadMessagesBadge();
        } catch (e) {
            showToast('Failed to load inquiries', 'error');
        }
    }

    function renderMessagesTable() {
        const filter = msgStatusFilter.value;
        const filtered = STATE.messagesList.filter(m => !filter || m.status === filter);

        msgTbody.innerHTML = '';
        if (filtered.length === 0) {
            msgTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--adm-text-dim); padding: 24px;">No inquiries found.</td></tr>`;
            return;
        }

        filtered.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(m.name)}</strong></td>
                <td><a href="mailto:${escapeHtml(m.email)}" style="color: var(--adm-accent);">${escapeHtml(m.email)}</a></td>
                <td>${escapeHtml(m.subject)}</td>
                <td>${new Date(m.date).toLocaleString()}</td>
                <td><span class="status-pill ${m.status === 'unread' ? 'status-unread' : 'status-read'}">${m.status}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-action view-msg-btn" data-id="${m.id}" title="Read message"><i class="fa-solid fa-eye"></i></button>
                        <button class="btn-action btn-delete delete-msg-btn" data-id="${m.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;
            msgTbody.appendChild(tr);
        });

        document.querySelectorAll('.view-msg-btn').forEach(btn => {
            btn.addEventListener('click', () => openMessageModal(btn.getAttribute('data-id')));
        });
        document.querySelectorAll('.delete-msg-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteMessage(btn.getAttribute('data-id')));
        });
    }

    msgStatusFilter.addEventListener('change', renderMessagesTable);

    async function openMessageModal(id) {
        const msg = STATE.messagesList.find(m => m.id === id);
        if (!msg) return;

        // Auto mark as read
        if (msg.status === 'unread') {
            msg.status = 'read';
            apiRequest(`/messages/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'read' })
            }).catch(() => {});
            loadMessagesBadge();
            renderMessagesTable();
        }

        msgModalBody.innerHTML = `
            <div style="margin-bottom: 14px;">
                <label style="font-size: 0.75rem; color: var(--adm-text-dim); text-transform: uppercase;">Sender:</label>
                <div style="font-size: 1.05rem; font-weight: 700;">${escapeHtml(msg.name)} &lt;${escapeHtml(msg.email)}&gt;</div>
            </div>
            <div style="margin-bottom: 14px;">
                <label style="font-size: 0.75rem; color: var(--adm-text-dim); text-transform: uppercase;">Subject:</label>
                <div style="font-size: 1rem; font-weight: 600; color: var(--adm-accent);">${escapeHtml(msg.subject)}</div>
            </div>
            <div style="margin-bottom: 14px;">
                <label style="font-size: 0.75rem; color: var(--adm-text-dim); text-transform: uppercase;">Date Received:</label>
                <div>${new Date(msg.date).toLocaleString()}</div>
            </div>
            <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--adm-border);">
                <label style="font-size: 0.75rem; color: var(--adm-text-dim); text-transform: uppercase; margin-bottom: 8px; display: block;">Message:</label>
                <div style="background: var(--adm-surface-card); padding: 16px; border-radius: 8px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(msg.message)}</div>
            </div>
        `;

        msgReplyLink.href = `mailto:${encodeURIComponent(msg.email)}?subject=Re:%20${encodeURIComponent(msg.subject)}&body=Dear%20${encodeURIComponent(msg.name)},%0D%0A%0D%0AThank%20you%20for%20contacting%20Dagar%20Foundation.`;
        msgModal.classList.add('active');
    }

    closeMsgModalBtn.addEventListener('click', () => msgModal.classList.remove('active'));
    closeMsgModalBtn2.addEventListener('click', () => msgModal.classList.remove('active'));

    async function deleteMessage(id) {
        if (!confirm('Delete this message permanently?')) return;
        try {
            await apiRequest(`/messages/${id}`, { method: 'DELETE' });
            showToast('Message removed', 'info');
            loadMessagesData();
        } catch (e) {
            showToast('Failed to delete message: ' + e.message, 'error');
        }
    }

    /* ==========================================================================
       6. Subscribers List & Export
       ========================================================================== */
    const subTbody = document.getElementById('subscribers-table-tbody');
    const exportCsvBtn = document.getElementById('export-subscribers-csv-btn');

    async function loadSubscribersData() {
        try {
            const subs = await apiRequest('/subscribers');
            STATE.subscribersList = subs;
            renderSubscribersTable();
        } catch (e) {
            showToast('Failed to load subscribers', 'error');
        }
    }

    function renderSubscribersTable() {
        subTbody.innerHTML = '';
        if (STATE.subscribersList.length === 0) {
            subTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--adm-text-dim); padding: 24px;">No subscribers found.</td></tr>`;
            return;
        }

        STATE.subscribersList.forEach((sub, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td><strong style="color: var(--adm-text-main);">${escapeHtml(sub.email)}</strong></td>
                <td>${new Date(sub.date).toLocaleDateString()}</td>
                <td>
                    <button class="btn-action btn-delete delete-sub-btn" data-id="${sub.id}" title="Remove"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            subTbody.appendChild(tr);
        });

        document.querySelectorAll('.delete-sub-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (!confirm('Remove subscriber?')) return;
                try {
                    await apiRequest(`/subscribers/${id}`, { method: 'DELETE' });
                    showToast('Subscriber removed', 'info');
                    loadSubscribersData();
                } catch (e) {
                    showToast('Failed to remove: ' + e.message, 'error');
                }
            });
        });
    }

    exportCsvBtn.addEventListener('click', () => {
        if (!STATE.subscribersList || STATE.subscribersList.length === 0) {
            showToast('No subscribers to export.', 'info');
            return;
        }
        let csv = 'ID,Email,Date\n';
        STATE.subscribersList.forEach(s => {
            csv += `"${s.id}","${s.email}","${s.date}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dagar_subscribers_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Subscribers CSV exported successfully!', 'success');
    });

    /* ==========================================================================
       7. Media Uploads Center
       ========================================================================== */
    const mediaDropzone = document.getElementById('media-dropzone');
    const mediaFileInput = document.getElementById('media-file-input');
    const mediaGalleryGrid = document.getElementById('media-gallery-grid');

    mediaDropzone.addEventListener('click', () => mediaFileInput.click());

    mediaDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        mediaDropzone.style.borderColor = 'var(--adm-primary)';
        mediaDropzone.style.background = 'rgba(46, 125, 50, 0.1)';
    });

    mediaDropzone.addEventListener('dragleave', () => {
        mediaDropzone.style.borderColor = 'var(--adm-border)';
        mediaDropzone.style.background = 'var(--adm-surface-card)';
    });

    mediaDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        mediaDropzone.style.borderColor = 'var(--adm-border)';
        mediaDropzone.style.background = 'var(--adm-surface-card)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleMediaUpload(e.dataTransfer.files[0]);
        }
    });

    mediaFileInput.addEventListener('change', () => {
        if (mediaFileInput.files && mediaFileInput.files[0]) {
            handleMediaUpload(mediaFileInput.files[0]);
        }
    });

    function handleMediaUpload(file) {
        const reader = new FileReader();
        showToast('Uploading image file...', 'info');

        reader.onload = async () => {
            try {
                const res = await apiRequest('/upload', {
                    method: 'POST',
                    body: JSON.stringify({ base64Data: reader.result, filename: file.name })
                });

                showToast('Image uploaded successfully!', 'success');

                // Prepend to gallery
                const card = document.createElement('div');
                card.style.cssText = 'background: var(--adm-surface-card); border: 1px solid var(--adm-border); border-radius: 8px; padding: 12px; text-align: center;';
                card.innerHTML = `
                    <img src="${res.url}" style="height: 60px; margin: 0 auto 10px; object-fit: contain;">
                    <div style="font-size: 0.8rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(res.filename)}</div>
                    <button class="btn-action copy-link-btn" data-url="${res.url}" style="width: 100%; margin-top: 8px; font-size: 0.75rem;">Copy URL</button>
                `;
                mediaGalleryGrid.prepend(card);
                attachCopyButtons();
            } catch (err) {
                showToast('Upload failed: ' + err.message, 'error');
            }
        };
        reader.readAsDataURL(file);
    }

    function attachCopyButtons() {
        document.querySelectorAll('.copy-link-btn').forEach(btn => {
            btn.onclick = () => {
                const u = btn.getAttribute('data-url');
                navigator.clipboard.writeText(u);
                showToast(`Copied URL: ${u}`, 'success');
            };
        });
    }
    attachCopyButtons();

    /* ==========================================================================
       8. Settings & Change Password
       ========================================================================== */
    const changePwdForm = document.getElementById('change-password-form');
    changePwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cur = document.getElementById('pwd-current').value;
        const n1 = document.getElementById('pwd-new').value;
        const n2 = document.getElementById('pwd-confirm').value;

        if (n1 !== n2) {
            showToast('New passwords do not match!', 'error');
            return;
        }

        try {
            await apiRequest('/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword: cur, newPassword: n1 })
            });
            showToast('Admin password updated successfully!', 'success');
            changePwdForm.reset();
        } catch (err) {
            showToast('Password change failed: ' + err.message, 'error');
        }
    });

    /* ==========================================================================
       Helper Utilities
       ========================================================================== */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    }

    // Startup Execution
    checkAuthStatus();
});
