function prevSlideModern(button) {
  const carousel = button.closest('.modern-carousel');
  const slides = carousel.querySelectorAll('.carousel-slide');
  const currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
  const prevIndex = (currentIndex - 1 + slides.length) % slides.length;
  
  slides[currentIndex].classList.remove('active');
  slides[prevIndex].classList.add('active');
}

function nextSlideModern(button) {
  const carousel = button.closest('.modern-carousel');
  const slides = carousel.querySelectorAll('.carousel-slide');
  const currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
  const nextIndex = (currentIndex + 1) % slides.length;
  
  slides[currentIndex].classList.remove('active');
  slides[nextIndex].classList.add('active');
}

// Initialize all modern carousels
function initModernCarousels() {
  document.querySelectorAll('.modern-carousel').forEach(carousel => {
    const slides = carousel.querySelectorAll('.carousel-slide');
    if (slides.length > 0) {
      slides[0].classList.add('active');
      
      // Preload videos
      slides.forEach(slide => {
        const video = slide.querySelector('video');
        if (video) {
          video.load();
          video.addEventListener('error', () => {
            console.error(`Failed to load video: ${video.querySelector('source').src}`);
          });
        }
      });
    }
  });
}

// Initialize comparison panels
function initComparisonPanels() {
  const toggles = document.querySelectorAll('.comparison-toggle');
  const panels = document.querySelectorAll('.comparison-panel');
  
  if (!toggles.length || !panels.length) return;

  function activatePanel(target) {
    panels.forEach(panel => {
      panel.classList.toggle('is-active', 
        panel.getAttribute('data-comparison-panel') === target);
    });
    toggles.forEach(button => {
      const matches = button.getAttribute('data-comparison-toggle') === target;
      button.classList.toggle('is-info', matches);
      button.classList.toggle('is-outlined', matches);
      button.classList.toggle('is-light', !matches);
    });
  }

  toggles.forEach(button => {
    button.addEventListener('click', () => {
      activatePanel(button.getAttribute('data-comparison-toggle'));
    });
  });

  activatePanel(toggles[0].getAttribute('data-comparison-toggle'));
}

// Document ready
document.addEventListener('DOMContentLoaded', () => {
  // Navbar burger menu
  document.querySelectorAll('.navbar-burger').forEach(el => {
    el.addEventListener('click', () => {
      el.classList.toggle('is-active');
      document.querySelector('.navbar-menu').classList.toggle('is-active');
    });
  });

  // Initialize components
  initModernCarousels();
  initComparisonPanels();
  bulmaSlider.attach();
});
