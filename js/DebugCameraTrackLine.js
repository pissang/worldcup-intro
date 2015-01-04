define(function(require) {
    
    var qtek = require('qtek');

    var shader = qtek.shader.library.get('buildin.basic');
    var vertexIndices = [0, 1, 3, 2];

    function _catmullRomInterpolate(p0, p1, p2, p3, t) {
        var v0 = (p2 - p0) * 0.5;
        var v1 = (p3 - p1) * 0.5;
        return (2 * (p1 - p2) + v0 + v1) * t * t * t 
                + (- 3 * (p1 - p2) - 2 * v0 - v1) * t * t
                + v0 * t + p1;
    }

    var DebugCamera = qtek.Mesh.derive({
        mode: qtek.Mesh.LINE_STRIP,
        keyframes: [],
        lineWidth: 2
    }, function() {
        if (!this.geometry) {
            this.geometry = new qtek.StaticGeometry({
                hint: qtek.Geometry.DYNAMIC_DRAW
            });
        }
        if (!this.material) {
            this.material = new qtek.Material({
                shader: shader
            });
        }
    }, {

        updateGeometry: function() {
            if (!this.keyframes) {
                return this._renderInfo;
            }
            var nKf = this.keyframes.length;
            if (nKf == 0) {
                return this._renderInfo;
            }
            this.geometry.attributes.position.init(nKf * 10 + 1);
            var positionArr = this.geometry.attributes.position.value;
            var off = 0;

            positionArr[off++] = this.keyframes[0].position._array[0];
            positionArr[off++] = this.keyframes[0].position._array[1];
            positionArr[off++] = this.keyframes[0].position._array[2];

            for (var i = 0; i < nKf; i++) {
                var p1 = this.keyframes[i].position._array;
                var p0 = this.keyframes[i == 0 ? i : i - 1].position._array;
                var p2 = this.keyframes[i > nKf - 2 ? nKf - 1 : i + 1].position._array;
                var p3 = this.keyframes[i > nKf - 3 ? nKf - 1 : i + 2].position._array;
                for (var k = 1; k < 11; k++) {
                    var t = k / 10;
                    for (var j = 0; j < 3; j++) {
                        positionArr[off++] = _catmullRomInterpolate(p0[j], p1[j], p2[j], p3[j], t);
                    }
                }
            }

            this.geometry.dirty();
        }
    });

    return DebugCamera;
});