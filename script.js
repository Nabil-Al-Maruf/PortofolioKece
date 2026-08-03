const TOTAL_FRAMES = 240;
const frameImages = new Array(TOTAL_FRAMES);
const loadedFrames = new Set();

const canvas = document.getElementById('scroll-canvas');
const ctx = (canvas && typeof canvas.getContext === 'function') ? canvas.getContext('2d', { alpha: false }) : null;
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');

// Overlay sections
const secHero = document.getElementById('sec-hero');
const secAbout = document.getElementById('sec-about');
const secProjects = document.getElementById('sec-projects');
const secSkills = document.getElementById('sec-skills');
const secContact = document.getElementById('sec-contact');

// Controls
const openVideoBtn = document.getElementById('open-video-btn');
const closeVideoBtn = document.getElementById('close-modal-btn');
const videoModal = document.getElementById('video-modal');

// LERP Animation State
let currentFrameIndex = 0;
let targetFrameIndex = 0;
let lastDrawnFrameIndex = -1;

function getFrameUrl(index) {
  const paddedIndex = String(index + 1).padStart(3, '0');
  return `Frame/ezgif-frame-${paddedIndex}.webp`;
}

// Fit canvas to viewport resolution with retina DPI scaling
function resizeCanvas() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
}

// High performance frame drawer with fallback to nearest loaded frame
function drawFrame(targetIdx) {
  if (!canvas || !ctx) return;
  resizeCanvas();

  const dpr = window.devicePixelRatio || 1;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Find nearest loaded frame if target frame isn't ready
  let frameToDraw = null;
  let idxToDraw = targetIdx;

  if (loadedFrames.has(targetIdx)) {
    frameToDraw = frameImages[targetIdx];
  } else {
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      if (targetIdx - offset >= 0 && loadedFrames.has(targetIdx - offset)) {
        idxToDraw = targetIdx - offset;
        frameToDraw = frameImages[idxToDraw];
        break;
      }
      if (targetIdx + offset < TOTAL_FRAMES && loadedFrames.has(targetIdx + offset)) {
        idxToDraw = targetIdx + offset;
        frameToDraw = frameImages[idxToDraw];
        break;
      }
    }
  }

  if (!frameToDraw || !frameToDraw.complete || frameToDraw.naturalWidth === 0) return;

  // Clear full canvas buffer
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(dpr, dpr);

  // Cover aspect ratio strategy
  const imgRatio = frameToDraw.naturalWidth / frameToDraw.naturalHeight;
  const viewportRatio = viewportWidth / viewportHeight;

  let drawWidth, drawHeight, offsetX, offsetY;

  if (viewportRatio > imgRatio) {
    drawWidth = viewportWidth;
    drawHeight = viewportWidth / imgRatio;
    offsetX = 0;
    offsetY = (viewportHeight - drawHeight) / 2;
  } else {
    drawHeight = viewportHeight;
    drawWidth = viewportHeight * imgRatio;
    offsetX = (viewportWidth - drawWidth) / 2;
    offsetY = 0;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(frameToDraw, offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();

  lastDrawnFrameIndex = idxToDraw;
}

// Calculate target frame and active UI section from scroll position
function updateScrollTarget() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  const maxScroll = Math.max(1, (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight);

  const scrollFraction = Math.max(0, Math.min(1, scrollTop / maxScroll));
  targetFrameIndex = scrollFraction * (TOTAL_FRAMES - 1);

  // 5-Section visibility transitions based on scroll progress
  if (scrollFraction < 0.20) {
    switchSection(secHero);
  } else if (scrollFraction >= 0.20 && scrollFraction < 0.40) {
    switchSection(secAbout);
  } else if (scrollFraction >= 0.40 && scrollFraction < 0.70) {
    switchSection(secProjects);
  } else if (scrollFraction >= 0.70 && scrollFraction < 0.85) {
    switchSection(secSkills);
  } else {
    switchSection(secContact);
  }
}

function switchSection(activeSection) {
  [secHero, secAbout, secProjects, secSkills, secContact].forEach(sec => {
    if (sec && sec === activeSection) {
      sec.classList.add('active');
    } else if (sec) {
      sec.classList.remove('active');
    }
  });
}

// Animation loop using smooth LERP momentum
function animate() {
  const diff = targetFrameIndex - currentFrameIndex;

  if (Math.abs(diff) > 0.01) {
    currentFrameIndex += diff * 0.18;
  } else {
    currentFrameIndex = targetFrameIndex;
  }

  const roundedIndex = Math.round(currentFrameIndex);
  const clampedIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, roundedIndex));

  if (clampedIndex !== lastDrawnFrameIndex || loadedFrames.size < TOTAL_FRAMES) {
    drawFrame(clampedIndex);
  }

  requestAnimationFrame(animate);
}

// Fast Priority Preloader: Loads key initial frames first to unlock page in < 1 second!
function preloadFrames() {
  let loadedCount = 0;
  let priorityCount = 25; // First 25 WebP frames unlock the page instantly

  const loadSingleFrame = (i) => {
    const img = new Image();
    img.src = getFrameUrl(i);

    img.onload = () => {
      loadedFrames.add(i);
      loadedCount++;

      const progress = Math.round((loadedCount / TOTAL_FRAMES) * 100);
      if (loaderText) {
        loaderText.textContent = `Loading ${progress}%`;
      }

      if (i === 0) {
        drawFrame(0);
      }

      // Hide loader instantly when initial priority frames are ready
      if (loadedCount >= priorityCount && loader && !loader.classList.contains('hidden')) {
        loader.classList.add('hidden');
      }
    };

    img.onerror = () => {
      // Fallback to JPG if webp fails to load
      img.src = getFrameUrl(i).replace('.webp', '.jpg');
      loadedCount++;
      if (loadedCount >= priorityCount && loader && !loader.classList.contains('hidden')) {
        loader.classList.add('hidden');
      }
    };

    frameImages[i] = img;
  };

  // Phase 1: High priority load initial key frames
  for (let i = 0; i < priorityCount; i++) {
    loadSingleFrame(i);
  }

  // Phase 2: Progressively load remaining frames in background
  setTimeout(() => {
    for (let i = priorityCount; i < TOTAL_FRAMES; i++) {
      loadSingleFrame(i);
    }
  }, 150);
}

// PROJECTS DATA & DETAIL MODAL ENGINE (User's 7 Real Projects)
const PROJECTS_DATA = {
  laundry: {
    title: "LaundryEmme",
    category: "Android Mobile App",
    description: "A modern laundry management mobile application featuring automated order tracking, customer history, and cloud database sync. Built with Kotlin, Jetpack Compose, Supabase, and Kiro AI integration.",
    images: ["images/project_vintage.png", "images/developer_coding.png", "images/project_tokoku.png"],
    tags: ["Kotlin", "Jetpack Compose", "Supabase", "Kiro AI", "Android Native"],
    link: "http://github.com/Nabil-Al-Maruf/"
  },
  sqlserver: {
    title: "Android SQL Server 2008 Integration",
    category: "Android & Enterprise Database",
    description: "A collaborative enterprise Android application developed in partnership with my father to interface with a local SQL Server 2008 database server, enabling full real-time CRUD operations.",
    images: ["images/project_marco.png", "images/project_mozaik.png", "images/project_tokoku.png"],
    tags: ["Android Native", "SQL Server 2008", "CRUD System", "Local Server", "Java/Kotlin"],
    link: "http://github.com/Nabil-Al-Maruf/"
  },
  kasq: {
    title: "PWA KASQ (WhatsApp Debtor Alert)",
    category: "Progressive Web App (PWA)",
    description: "A Progressive Web App designed to track ledger debts with automated WhatsApp API integration to send debt reminder messages directly to debtors. Built with Vanilla JS & Supabase.",
    images: ["images/project_mozaik.png", "images/project_valkyrie.png", "images/project_marco.png"],
    tags: ["PWA", "Vanilla JS", "HTML5/CSS3", "Supabase", "WhatsApp API"],
    link: "http://github.com/Nabil-Al-Maruf/"
  },
  emmeshop: {
    title: "EmmeShop (Gemini CS Bot)",
    category: "Full-Stack E-Commerce & AI",
    description: "My personal online store for selling pre-owned electronics and home gadgets. Integrated with an intelligent AI Customer Service Bot powered by Google Gemini API Key and Supabase database.",
    images: ["images/project_tokoku.png", "images/project_vintage.png", "images/project_foodasa.png"],
    tags: ["HTML5/CSS3", "Vanilla JS", "Supabase", "Gemini AI API", "AI Bot"],
    link: "http://github.com/Nabil-Al-Maruf/"
  },
  barcode: {
    title: "Camera Barcode Scanner POS",
    category: "Web POS System",
    description: "Point of Sale web system featuring mobile camera barcode scanning for instant inventory lookup and checkout. Built using Vanilla JavaScript, HTML, CSS, and Supabase.",
    images: ["images/project_foodasa.png", "images/project_vintage.png", "images/project_tokoku.png"],
    tags: ["HTML5/CSS3", "Vanilla JS", "Supabase", "Camera Barcode API", "Web POS"],
    link: "http://github.com/Nabil-Al-Maruf/"
  },
  qrmenu: {
    title: "QR Menu & POS (Midtrans Sandbox)",
    category: "Full-Stack POS & Payment Gateway",
    description: "Contactless QR Code Menu and Point of Sale web application integrated with Midtrans Payment Gateway (Sandbox mode) for digital instant payments and order management.",
    images: ["images/project_valkyrie.png", "images/project_mozaik.png", "images/developer_coding.png"],
    tags: ["HTML5/CSS3", "Vanilla JS", "Supabase", "Midtrans Gateway", "QR System"],
    link: "http://github.com/Nabil-Al-Maruf/"
  },
  pudding: {
    title: "UMKM Pudding Sedot Landing Page",
    category: "Landing Page & WhatsApp Direct",
    description: "High-conversion business landing page built for a local MSME (UMKM) selling 'Pudding Sedot', integrated with direct WhatsApp order messaging for instant customer purchases.",
    images: ["images/developer_coding.png", "images/project_valkyrie.png", "images/project_mozaik.png"],
    tags: ["HTML5/CSS3", "Vanilla JS", "WhatsApp Order API", "UMKM Branding"],
    link: "http://github.com/Nabil-Al-Maruf/"
  }
};

const projectModal = document.getElementById('project-modal');
const closeProjectModalBtn = document.getElementById('close-project-modal-btn');
const pmCategory = document.getElementById('pm-category');
const pmTitle = document.getElementById('pm-title');
const pmMainImg = document.getElementById('pm-main-img');
const pmThumbs = document.getElementById('pm-thumbs');
const pmDescription = document.getElementById('pm-description');
const pmTags = document.getElementById('pm-tags');
const pmLink = document.getElementById('pm-link');

function openProjectModal(key) {
  const data = PROJECTS_DATA[key];
  if (!data || !projectModal) return;

  if (pmCategory) pmCategory.textContent = data.category;
  if (pmTitle) pmTitle.textContent = data.title;
  if (pmMainImg) pmMainImg.src = data.images[0];
  if (pmDescription) pmDescription.textContent = data.description;
  if (pmLink) pmLink.href = data.link;

  // Build Thumbnail Gallery
  if (pmThumbs) {
    pmThumbs.innerHTML = '';
    data.images.forEach((imgSrc, idx) => {
      const thumb = document.createElement('img');
      thumb.src = imgSrc;
      thumb.className = `gallery-thumb-item ${idx === 0 ? 'active' : ''}`;
      thumb.addEventListener('click', () => {
        pmMainImg.style.opacity = '0.4';
        setTimeout(() => {
          pmMainImg.src = imgSrc;
          pmMainImg.style.opacity = '1';
        }, 150);
        document.querySelectorAll('.gallery-thumb-item').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      });
      pmThumbs.appendChild(thumb);
    });
  }

  // Build Tech Tags
  if (pmTags) {
    pmTags.innerHTML = '';
    data.tags.forEach(tag => {
      const tagPill = document.createElement('span');
      tagPill.className = 'tech-tag-pill';
      tagPill.textContent = tag;
      pmTags.appendChild(tagPill);
    });
  }

  projectModal.classList.add('open');
}

function bindProjectCards() {
  document.querySelectorAll('[data-project]').forEach(card => {
    card.style.cursor = 'pointer';
    card.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = card.getAttribute('data-project');
      if (key) openProjectModal(key);
    };
  });
}

// Bind clicks on document load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindProjectCards);
} else {
  bindProjectCards();
}

// Event delegation fallback
document.addEventListener('click', (e) => {
  const card = e.target.closest('[data-project]');
  if (card) {
    const key = card.getAttribute('data-project');
    if (key) {
      e.preventDefault();
      openProjectModal(key);
    }
  }
});

if (closeProjectModalBtn && projectModal) {
  closeProjectModalBtn.addEventListener('click', () => {
    projectModal.classList.remove('open');
  });
}

if (projectModal) {
  projectModal.addEventListener('click', (e) => {
    if (e.target === projectModal) {
      projectModal.classList.remove('open');
    }
  });
}

// LANGUAGE TRANSLATION ENGINE (ID / EN)
let currentLang = localStorage.getItem('portfolio_lang') || 'id';

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('portfolio_lang', lang);

  const langLabel = document.getElementById('lang-label');
  if (langLabel) {
    langLabel.textContent = lang === 'id' ? '🇮🇩 ID' : '🇬🇧 EN';
  }

  document.querySelectorAll('[data-id][data-en]').forEach(el => {
    const text = el.getAttribute(`data-${lang}`);
    if (text) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = text;
      } else {
        el.textContent = text;
      }
    }
  });
}

const langToggleBtn = document.getElementById('lang-toggle-btn');
if (langToggleBtn) {
  langToggleBtn.addEventListener('click', () => {
    setLanguage(currentLang === 'id' ? 'en' : 'id');
  });
}

// Apply saved language on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setLanguage(currentLang));
} else {
  setLanguage(currentLang);
}

// Fullscreen Image Lightbox Controls
const imageLightbox = document.getElementById('image-lightbox');
const lightboxFullImg = document.getElementById('lightbox-full-img');
const closeLightboxBtn = document.getElementById('close-lightbox-btn');

if (pmMainImg) {
  pmMainImg.addEventListener('click', () => {
    if (lightboxFullImg && imageLightbox && pmMainImg.src) {
      lightboxFullImg.src = pmMainImg.src;
      imageLightbox.classList.add('open');
    }
  });
}

if (closeLightboxBtn && imageLightbox) {
  closeLightboxBtn.addEventListener('click', () => {
    imageLightbox.classList.remove('open');
  });
}

if (imageLightbox) {
  imageLightbox.addEventListener('click', (e) => {
    if (e.target === imageLightbox || e.target === lightboxFullImg) {
      imageLightbox.classList.remove('open');
    }
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (imageLightbox && imageLightbox.classList.contains('open')) {
      imageLightbox.classList.remove('open');
    } else if (projectModal && projectModal.classList.contains('open')) {
      projectModal.classList.remove('open');
    }
  }
});

// Footer Back To Top Control
const backToTopBtn = document.getElementById('back-to-top-btn');
if (backToTopBtn) {
  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Video Showcase Modal Controls
if (openVideoBtn && videoModal) {
  openVideoBtn.addEventListener('click', () => {
    videoModal.classList.add('open');
  });
}

if (closeVideoBtn && videoModal) {
  closeVideoBtn.addEventListener('click', () => {
    videoModal.classList.remove('open');
  });
}

if (videoModal) {
  videoModal.addEventListener('click', (e) => {
    if (e.target === videoModal) {
      videoModal.classList.remove('open');
    }
  });
}

// Canvas Animation Event Listeners & Initialization
if (canvas && ctx) {
  window.addEventListener('resize', () => {
    resizeCanvas();
    drawFrame(Math.round(currentFrameIndex));
  });

  window.addEventListener('scroll', updateScrollTarget, { passive: true });

  preloadFrames();
  updateScrollTarget();
  requestAnimationFrame(animate);
}

