define(function(require) {
    
    var qtek = require('qtek');

    var shader = qtek.shader.library.get('buildin.basic');
    var vertexIndices = [0, 1, 3, 2];

    var DebugCamera = qtek.Mesh.derive({
        mode: qtek.Mesh.LINES,
        camera: null,
        lineWidth: 1
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

        update: function() {
            this.position.copy(this.camera.position);
            this.rotation.copy(this.camera.rotation);
            qtek.Mesh.prototype.update.call(this);

            this._updateGeometry();
        },

        _updateGeometry: function() {
            if (!this.camera) {
                return this._renderInfo;
            }
            if (!this.geometry.attributes.position.value) {
                this.geometry.attributes.position.init(12 * 2 + 2);
            }
            var vertices = this.camera.frustum.vertices;
            var positionArr = this.geometry.attributes.position.value;
            var off = 0;
            // Far plane
            for (var i = 0; i < 4; i++) {
                var idx0 = vertexIndices[i];
                var idx1 = vertexIndices[(i+1) % 4];
                for (var k = 0; k < 3; k++) {
                    positionArr[off++] = vertices[idx0][k];
                }
                for (var k = 0; k < 3; k++) {
                    positionArr[off++] = vertices[idx1][k];
                }
            }
            // Near plane
            for (var i = 0; i < 4; i++) {
                var idx0 = vertexIndices[i] + 4;
                var idx1 = vertexIndices[(i+1) % 4] + 4;
                for (var k = 0; k < 3; k++) {
                    positionArr[off++] = vertices[idx0][k];
                }
                for (var k = 0; k < 3; k++) {
                    positionArr[off++] = vertices[idx1][k];
                }
            }
            // Connect near plane and far plane
            for (var i = 0; i < 4; i++) {
                for (var k = 0; k < 3; k++) {
                    positionArr[off++] = vertices[i][k];
                }
                for (var k = 0; k < 3; k++) {
                    positionArr[off++] = vertices[i + 4][k];
                }
            }
            // Direction line
            off += 5;
            var len = this.camera.far * 1.7;
            positionArr[off++] = -len;
            
            this.geometry.dirty();
        }
    });

    return DebugCamera;
});