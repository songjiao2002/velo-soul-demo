// Keep the server-delivered character cards visible until the interactive app
// is ready. A failed module load must never leave an unexplained empty screen.
(function () {
  var notice = document.getElementById('startupNotice');
  var message = document.getElementById('startupMessage');
  var retry = document.getElementById('startupRetry');
  var details = document.getElementById('startupDetails');
  var errorText = document.getElementById('startupError');
  var app = document.getElementById('app');
  var fallback = app.innerHTML;
  var ready = false;
  var timeout;
  function failed(error) {
    if (ready) return;
    clearTimeout(timeout);
    if (!app.innerHTML.trim()) app.innerHTML = fallback;
    notice.hidden = false;
    message.textContent = '연결이 지연되거나 시작하지 못했어요. 다시 열어주세요. · Could not finish loading. Please reload. · 页面功能未能启动，请重新加载。';
    retry.hidden = false;
    details.hidden = false;
    errorText.textContent = error && error.message ? error.message : String(error || 'Startup did not complete.');
  }
  retry.addEventListener('click', function () {
    var url = new URL(window.location.href);
    url.searchParams.set('reload', Date.now().toString());
    window.location.replace(url.href);
  });
  window.addEventListener('error', function (event) { failed(event.error || event.message); });
  window.addEventListener('unhandledrejection', function (event) { failed(event.reason); });
  timeout = setTimeout(function () { failed(new Error('Startup timed out. Check your connection and reload.')); }, 12000);
  window.addEventListener('velo:ready', function () {
    ready = true;
    clearTimeout(timeout);
    notice.hidden = true;
    document.documentElement.dataset.veloReady = 'true';
  });
  // One classic bundle avoids a chain of module requests and partial versions.
  var script = document.createElement('script');
  script.src = '/app.bundle.js?v=20261025-media20';
  // A retry must also bypass a partially cached script, not only the HTML.
  var reload = new URL(window.location.href).searchParams.get('reload');
  if (reload) script.src += '&reload=' + encodeURIComponent(reload);
  script.async = true;
  script.onerror = function () { failed(new Error('Could not download the app. Please reload.')); };
  script.onload = function () { if (!ready) failed(new Error('App startup did not complete. Please reload.')); };
  document.head.appendChild(script);
})();
