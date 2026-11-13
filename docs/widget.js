(async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('id') || 'client_default';

    // Create Iframe container (démo statique : charge widget.html local, pas de serveur)
    const iframe = document.createElement('iframe');
    iframe.id = 'demo-widget-frame';
    iframe.src = `widget.html?id=${clientId}`;
    iframe.style.display = 'none';
    iframe.style.width = '400px';
    iframe.style.height = '650px';
    iframe.style.position = 'fixed';
    iframe.style.bottom = '20px';
    iframe.style.right = '20px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '32px';
    iframe.style.zIndex = '999999';
    iframe.style.boxShadow = '0 20px 50px rgba(0,0,0,0.2)';
    iframe.style.transition = 'all 0.3s ease';

    document.body.appendChild(iframe);

    // Create Launcher Button
    const launcher = document.createElement('div');
    launcher.innerHTML = `
        <div style="width: 60px; height: 60px; background: #000; border-radius: 50%; display: flex; items-center; justify-content: center; cursor: pointer; position: fixed; bottom: 20px; right: 20px; z-index: 1000000; box-shadow: 0 10px 25px rgba(0,0,0,0.3); transition: transform 0.2s ease;" id="bot-launcher">
            <svg style="width: 28px; height: 28px; color: white; margin: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 1.657-1.343 3-3 3h-6c-1.657 0-3-1.343-3-3s1.343-3 3-3h6c1.657 0 3 1.343 3 3z" />
            </svg>
        </div>
    `;
    document.body.appendChild(launcher.firstElementChild);

    const btn = document.getElementById('bot-launcher');
    btn.onclick = () => {
        const isVisible = iframe.style.display === 'block';
        iframe.style.display = isVisible ? 'none' : 'block';
        btn.style.transform = isVisible ? 'scale(1)' : 'scale(0.9)';
    };
})();
