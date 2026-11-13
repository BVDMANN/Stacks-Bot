(async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('id') || 'client_default';

    // Create Iframe container (démo statique : charge widget.html local, pas de serveur)
    const iframe = document.createElement('iframe');
    iframe.id = 'demo-widget-frame';
    iframe.src = `widget.html?id=${clientId}`;
    iframe.title = 'StacksBot — démonstration';
    iframe.style.display = 'none';
    iframe.style.width = 'min(400px, calc(100vw - 40px))';
    iframe.style.height = 'min(650px, calc(100vh - 40px))';
    iframe.style.position = 'fixed';
    iframe.style.bottom = '20px';
    iframe.style.right = '20px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '32px';
    iframe.style.zIndex = '999999';
    iframe.style.boxShadow = '0 20px 50px rgba(0,0,0,0.2)';
    iframe.style.transition = 'all 0.3s ease';
    iframe.style.background = '#fff';

    document.body.appendChild(iframe);

    // Create Launcher Button (unique bouton rond — le lanceur interne de
    // widget.html est masqué en mode intégré pour éviter tout doublon).
    const launcher = document.createElement('div');
    launcher.id = 'bot-launcher';
    launcher.setAttribute('role', 'button');
    launcher.setAttribute('aria-label', 'Ouvrir le chatbot de démonstration');
    launcher.style.cssText = 'width:60px;height:60px;background:#000;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;position:fixed;bottom:20px;right:20px;z-index:1000000;box-shadow:0 10px 25px rgba(0,0,0,0.3);transition:transform 0.2s ease;';
    launcher.innerHTML = `
        <svg style="width:28px;height:28px;color:white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 1.657-1.343 3-3 3h-6c-1.657 0-3-1.343-3-3s1.343-3 3-3h6c1.657 0 3 1.343 3 3z" />
        </svg>
    `;
    document.body.appendChild(launcher);

    function openWidget() {
        iframe.style.display = 'block';
        launcher.style.display = 'none';
        try {
            const input = iframe.contentWindow && iframe.contentWindow.document.getElementById('chat-input');
            if (input) input.focus();
        } catch (e) { /* même origine attendue, on ignore sinon */ }
    }

    function closeWidget() {
        iframe.style.display = 'none';
        launcher.style.display = 'flex';
    }

    launcher.addEventListener('click', function () {
        if (iframe.style.display === 'block') closeWidget();
        else openWidget();
    });

    // Le bouton ✕ dans l'en-tête du widget demande la fermeture à la page parente.
    window.addEventListener('message', function (e) {
        if (e.data && e.data.type === 'stacksbot-widget-close') closeWidget();
    });
})();
