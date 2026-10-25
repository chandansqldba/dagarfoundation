/**
 * Dagar Foundation Website Script
 * Interactive behaviors, animations, and forms logic
 */

document.addEventListener('DOMContentLoaded', () => {

    /* ==========================================
       1. Sticky Header & Scroll Effects
       ========================================== */
    const header = document.getElementById('header');
    
    const handleScroll = () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Run once on startup


    /* ==========================================
       2. Mobile Responsive Menu
       ========================================== */
    const mobileNavToggle = document.getElementById('mobile-nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    const toggleMenu = () => {
        mobileNavToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
        // Prevent body scrolling when menu is open
        document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
    };

    const closeMenu = () => {
        mobileNavToggle.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
    };

    mobileNavToggle.addEventListener('click', toggleMenu);

    navLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });


    /* ==========================================
       3. Active Navigation Links on Scroll
       ========================================== */
    const sections = document.querySelectorAll('section[id]');
    
    const highlightNav = () => {
        const scrollY = window.pageYOffset;
        
        sections.forEach(current => {
            const sectionHeight = current.offsetHeight;
            const sectionTop = current.offsetTop - 120; // offset header
            const sectionId = current.getAttribute('id');
            const navLink = document.querySelector(`.nav-menu a[href*=${sectionId}]`);
            
            if (navLink) {
                if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                    navLinks.forEach(link => link.classList.remove('active'));
                    navLink.classList.add('active');
                }
            }
        });
    };
    
    window.addEventListener('scroll', highlightNav);


    /* ==========================================
       4. Stats Counter Animation
       ========================================== */
    const statsSection = document.getElementById('impact-stats');
    const statNumbers = document.querySelectorAll('.stat-number');
    let animated = false;

    const animateStats = () => {
        statNumbers.forEach(stat => {
            const target = parseInt(stat.getAttribute('data-target'), 10);
            const duration = 2000; // Animation duration in ms
            const stepTime = Math.abs(Math.floor(duration / target));
            let current = 0;
            
            // Adjust step values for larger numbers to keep fluid performance
            const increment = target > 1000 ? Math.ceil(target / 100) : 1;
            
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    stat.innerText = target.toLocaleString() + '+';
                    clearInterval(timer);
                } else {
                    stat.innerText = current.toLocaleString() + '+';
                }
            }, Math.max(stepTime, 15));
        });
    };

    // Use Intersection Observer for trigger point
    if ('IntersectionObserver' in window && statsSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !animated) {
                    animateStats();
                    animated = true;
                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.25 });

        statsObserver.observe(statsSection);
    } else {
        // Fallback for older browsers
        setTimeout(animateStats, 1000);
    }


    /* ==========================================
       5. Copy UPI ID to Clipboard
       ========================================== */
    const copyBtn = document.getElementById('copy-upi-btn');
    const copyBtnText = document.getElementById('copy-btn-text');
    const upiIdText = document.getElementById('upi-id-text').innerText;

    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            try {
                // Clipboard copy API
                await navigator.clipboard.writeText(upiIdText);
                
                // Success visual state feedback
                copyBtn.classList.add('copied');
                copyBtnText.innerHTML = '<i class="fa-solid fa-check" style="color: #2e7d32"></i> Copied!';
                
                // Revert to original text after 2 seconds
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtnText.innerHTML = '<i class="fa-regular fa-copy"></i> Copy UPI ID';
                }, 2000);
                
            } catch (err) {
                console.error('Failed to copy text: ', err);
                copyBtnText.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Fail to copy';
                setTimeout(() => {
                    copyBtnText.innerHTML = '<i class="fa-regular fa-copy"></i> Copy UPI ID';
                }, 2000);
            }
        });
    }


    /* ==========================================
       6. Contact Form Submission (Live REST API)
       ========================================== */
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status-msg');

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form values
            const name = document.getElementById('form-name').value.trim();
            const email = document.getElementById('form-email').value.trim();
            const subject = document.getElementById('form-subject').value.trim();
            const message = document.getElementById('form-message').value.trim();
            
            const submitBtn = document.getElementById('form-submit-btn');
            const originalBtnText = submitBtn.innerText;
            
            // Loading state UI
            submitBtn.disabled = true;
            submitBtn.innerText = 'Sending Message...';
            formStatus.className = 'form-status';
            formStatus.style.display = 'none';

            try {
                const res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, subject, message })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Submission failed');

                formStatus.className = 'form-status success';
                formStatus.style.display = 'block';
                formStatus.innerText = data.message || `Thank you, ${name}! Your message has been sent successfully.`;
                contactForm.reset();
            } catch (err) {
                formStatus.className = 'form-status error';
                formStatus.style.display = 'block';
                formStatus.innerText = 'Error: ' + err.message;
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
            }
        });
    }


    /* ==========================================
       7. Newsletter Subscription (Live REST API)
       ========================================== */
    const newsletterForm = document.getElementById('newsletter-form');
    const newsletterStatus = document.getElementById('newsletter-status-msg');

    if (newsletterForm) {
        newsletterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('newsletter-email');
            const submitBtn = newsletterForm.querySelector('button');
            const originalBtnIcon = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            newsletterStatus.className = 'newsletter-status';
            newsletterStatus.style.display = 'none';

            try {
                const res = await fetch('/api/newsletter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput.value.trim() })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Subscription failed');

                newsletterStatus.className = 'newsletter-status success';
                newsletterStatus.style.display = 'block';
                newsletterStatus.innerText = data.message || 'Successfully subscribed to our newsletter!';
                emailInput.value = '';

                setTimeout(() => {
                    newsletterStatus.style.display = 'none';
                }, 4000);
            } catch (err) {
                newsletterStatus.className = 'newsletter-status error';
                newsletterStatus.style.display = 'block';
                newsletterStatus.innerText = err.message || 'Failed to subscribe.';
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnIcon;
            }
        });
    }


    /* ==========================================
       8. Dynamic Content & Blog Previews Sync
       ========================================== */
    async function syncDynamicData() {
        // Load latest blog posts into homepage preview
        const blogGrid = document.getElementById('homepage-blog-grid');
        if (blogGrid) {
            try {
                const res = await fetch('/api/blogs');
                if (res.ok) {
                    const blogs = await res.json();
                    const top3 = blogs.slice(0, 3);
                    if (top3.length > 0) {
                        blogGrid.innerHTML = '';
                        top3.forEach(post => {
                            const card = document.createElement('article');
                            card.className = 'blog-item-card';
                            card.style.cssText = 'background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; display: flex; flex-direction: column; transition: transform 0.3s ease;';
                            card.innerHTML = `
                                <div style="height: 200px; position: relative; overflow: hidden;">
                                    <img src="${post.coverImage}" alt="${post.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='logo.png'">
                                    <span style="position: absolute; top: 12px; left: 12px; background: rgba(255,255,255,0.95); color: var(--primary); font-size: 0.75rem; font-weight: 700; padding: 4px 12px; border-radius: 20px;">${post.category}</span>
                                </div>
                                <div style="padding: 24px; display: flex; flex-direction: column; flex: 1;">
                                    <h3 style="font-size: 1.2rem; font-weight: 700; line-height: 1.4; margin-bottom: 10px; font-family: var(--font-secondary);">${post.title}</h3>
                                    <p style="font-size: 0.9rem; color: #4a5568; line-height: 1.6; margin-bottom: 16px; flex: 1;">${post.excerpt}</p>
                                    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #edf2f7; padding-top: 14px; font-size: 0.85rem;">
                                        <span style="color: #718096;"><i class="fa-regular fa-calendar"></i> ${post.date}</span>
                                        <a href="/blog.html?post=${post.slug}" style="color: var(--primary); font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                                            <span>Read Story</span> <i class="fa-solid fa-arrow-right"></i>
                                        </a>
                                    </div>
                                </div>
                            `;
                            blogGrid.appendChild(card);
                        });
                    }
                }
            } catch (err) {
                console.warn('Could not fetch blog previews:', err);
            }
        }

        // Synchronize live CMS content across all pages
        try {
            const res = await fetch('/api/content');
            if (res.ok) {
                const c = await res.json();
                
                // 1. Global Branding & Contact Information
                const brand = c.branding || {};
                const contact = c.contact || {};
                const phone = contact.phone || brand.phone;
                const email = contact.email || brand.email;
                const address = contact.address || brand.address;

                // Contact Page specific fields
                const contactPhoneEl = document.getElementById('contact-phone');
                if (contactPhoneEl && phone) {
                    contactPhoneEl.innerText = phone;
                    contactPhoneEl.href = `tel:${phone.replace(/[^0-9+]/g, '')}`;
                }
                const contactEmailEl = document.getElementById('contact-email');
                if (contactEmailEl && email) {
                    contactEmailEl.innerText = email;
                    contactEmailEl.href = `mailto:${email}`;
                }
                const contactAddrEl = document.getElementById('contact-address');
                if (contactAddrEl && address) {
                    contactAddrEl.innerText = address;
                }

                // Render dynamic FAQs on contact.html if present
                const faqContainer = document.querySelector('.faqs-container, .faq-grid');
                if (faqContainer && Array.isArray(contact.faqs) && contact.faqs.length > 0) {
                    faqContainer.innerHTML = '';
                    contact.faqs.forEach(f => {
                        const item = document.createElement('div');
                        item.className = 'faq-item';
                        item.innerHTML = `
                            <h4><i class="fa-solid fa-circle-question"></i> ${f.q}</h4>
                            <p>${f.a}</p>
                        `;
                        faqContainer.appendChild(item);
                    });
                }

                // 2. Hero Section (Homepage)
                if (c.hero?.title) {
                    const heroTitle = document.querySelector('.hero-title');
                    if (heroTitle) heroTitle.innerText = c.hero.title;
                }
                if (c.hero?.description) {
                    const heroDesc = document.querySelector('.hero-description');
                    if (heroDesc) heroDesc.innerText = c.hero.description;
                }
                if (c.hero?.badge) {
                    const heroBadge = document.querySelector('.hero-badge');
                    if (heroBadge) heroBadge.innerHTML = `<i class="fa-solid fa-earth-asia"></i> ${c.hero.badge}`;
                }

                // 3. Donation & UPI Details (Homepage & Donate Page)
                if (c.donation?.upiId) {
                    const upiText = document.getElementById('upi-id-text');
                    if (upiText) upiText.innerText = c.donation.upiId;
                    const mobileUpi = document.getElementById('mobile-upi-link');
                    if (mobileUpi) mobileUpi.href = `upi://pay?pa=${encodeURIComponent(c.donation.upiId)}&pn=Dagar%20Foundation&cu=INR`;
                }

                // 4. Impact Statistics Counters
                if (c.stats && Array.isArray(c.stats)) {
                    c.stats.forEach(st => {
                        const statNum = document.querySelector(`.stat-card [data-target="${st.number}"]`);
                        if (!statNum) {
                            // Find by label if number was edited
                            document.querySelectorAll('.stat-card').forEach(card => {
                                const label = card.querySelector('.stat-label');
                                const num = card.querySelector('.stat-number');
                                if (label && num && label.innerText.toLowerCase().includes(st.label.toLowerCase())) {
                                    num.setAttribute('data-target', st.number);
                                    num.innerText = Number(st.number).toLocaleString() + (st.suffix || '+');
                                }
                            });
                        }
                    });
                }

                // 5. About Page & Section
                if (c.about) {
                    const aboutLead = document.querySelector('.about-lead');
                    if (aboutLead && c.about.leadText) aboutLead.innerText = c.about.leadText;
                    const aboutBody = document.querySelector('.about-body');
                    if (aboutBody && c.about.bodyText) aboutBody.innerText = c.about.bodyText;
                }
            }
        } catch (e) {
            console.warn('Live content sync fallback to static HTML:', e);
        }
    }

    // Run dynamic synchronization
    syncDynamicData();

});

