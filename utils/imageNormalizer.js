const normalizePath = (rawUrl) => {
    try {
        const url = new URL(rawUrl);
        return url.pathname.replace(/^\/+/, '').replace(/\/{2,}/g, '/');
    } catch (err) {
        return '';
    }
};


export default normalizePath