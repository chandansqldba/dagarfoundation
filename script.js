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
       6. Contact Form Submission (Mock)
       ========================================== */
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status-msg');

    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Get form values
            const name = document.getElementById('form-name').value;
            const email = document.getElementById('form-email').value;
            const subject = document.getElementById('form-subject').value;
            const message = document.getElementById('form-message').value;
            
            const submitBtn = document.getElementById('form-submit-btn');
            const originalBtnText = submitBtn.innerText;
            
            // Loading state UI
            submitBtn.disabled = true;
            submitBtn.innerText = 'Sending Message...';
            formStatus.className = 'form-status';
            formStatus.style.display = 'none';

            // Simulate server network latency
            setTimeout(() => {
                // Reset button
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
                
                // Show success status message
                formStatus.className = 'form-status success';
                formStatus.innerText = `Thank you, ${name}! Your message has been sent successfully. We will get back to you soon.`;
                
                // Reset form inputs
                contactForm.reset();
            }, 1200);
        });
    }


    /* ==========================================
       7. Newsletter Subscription (Mock)
       ========================================== */
    const newsletterForm = document.getElementById('newsletter-form');
    const newsletterStatus = document.getElementById('newsletter-status-msg');

    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('newsletter-email');
            const submitBtn = newsletterForm.querySelector('button');
            const originalBtnIcon = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            newsletterStatus.className = 'newsletter-status';
            newsletterStatus.style.display = 'none';

            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnIcon;
                
                newsletterStatus.className = 'newsletter-status success';
                newsletterStatus.innerText = 'Successfully subscribed to our newsletter!';
                
                emailInput.value = '';
                
                setTimeout(() => {
                    newsletterStatus.style.display = 'none';
                }, 3000);
            }, 1000);
        });
    }

});
