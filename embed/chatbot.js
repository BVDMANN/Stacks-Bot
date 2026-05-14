(function() {
    const p = new URLSearchParams(window.location.search);
    const clientId = p.get('id') || 'client_default';
    const script = document.createElement('script');
    script.src = `${window.location.origin}/public/widget.js?id=${clientId}`;
    script.async = true;
    document.head.appendChild(script);
})();