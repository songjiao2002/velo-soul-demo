// The source preview communicates its breakpoint to its ride iframe in boot.js.
// A directly opened mobile page and an installed app have no preview iframe.
(() => {
  if (window !== window.top) return;
  const media = window.matchMedia('(max-width: 600px), (max-width: 1024px) and (pointer: coarse)');
  const native = window.Capacitor?.isNativePlatform?.() === true ||
    location.protocol === 'capacitor:' || !!window.androidBridge;
  const setLayout = () => document.documentElement.classList.toggle('mobile-layout', native || media.matches);
  setLayout();
  if (native) return;
  if (!media.matches) {
    location.replace('/device-preview.html' + location.search + location.hash);
    return;
  }
  media.addEventListener('change', setLayout);
})();
