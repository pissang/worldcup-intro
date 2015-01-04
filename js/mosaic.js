define(function (require) {
    
    var canvas;

    var ctx;

    function mosaic(img, sx, sy, sw, sh, scale, flat) {
        if (!canvas) {
            canvas = document.createElement('canvas');
            ctx = canvas.getContext('2d');
        }
        sx = sx || 0;
        sy = sy ||0;

        sw = sw || img.width;
        sh = sh || img.height;

        scale = scale || 1;
        var tw = Math.round(sw * scale);
        var th = Math.round(sh * scale);

        if (typeof(flat) == 'undefined') {
            flat = true;
        }

        canvas.width = tw;
        canvas.height = th;

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
        var pixels = ctx.getImageData(0, 0, tw, th).data;

        var positionArr = [];
        var colorArr = [];
        var scaleArr = [];

        for (var i = 0; i < pixels.length;) {
            var idx = i / 4;

            var r = pixels[i++];
            var g = pixels[i++];
            var b = pixels[i++];
            var a = pixels[i++];
            // Transparent pixel
            // TODO threshold
            if (a < 150) {
                continue;
            }

            var x = (idx % tw) / tw * 2 - 1;
            var y = 1 - Math.floor(idx / tw) / th * 2;
            // Scale to fit the aspect
            if (tw < th) {
                x *= tw / th;
            } else {
                y *= th / tw;
            }

            var z = Math.random() * 0.2;

            if (flat) {
                positionArr.push(x);
                positionArr.push(y);
                positionArr.push(z);

                colorArr.push(r);
                colorArr.push(g);
                colorArr.push(b);
            } else {
                var arr = new Float32Array(3);
                arr[0] = x;
                arr[1] = y;
                arr[2] = z;
                positionArr.push(arr);

                arr = new Float32Array(3);
                arr[0] = r;
                arr[1] = g;
                arr[2] = b;
                colorArr.push(arr);
            }
            
            scaleArr.push(a / 255);
        }

        if (flat) {
            positionArr = new Float32Array(positionArr);
            colorArr = new Float32Array(colorArr);
        }
        scaleArr = new Float32Array(scaleArr);
        return {
            position: positionArr,
            color: colorArr,
            scale: scaleArr
        }
    }

    return mosaic;
});