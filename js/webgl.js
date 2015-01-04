
function isWebGLAvailable () {
    try {
        var canvas = document.createElement('canvas');
        var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
            return false;
        }
    } catch (e) {
        return false;
    }

    return true;
}