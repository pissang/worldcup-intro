define(function (require) {
        
    var qtek = require('qtek');

    function lerp(x, y, t) {
        return (y - x) * t + x;
    }

    var GenieEffect = function(opts) {
        opts = opts || {};

        this.segments = opts.segments || 30;

        this.side = opts.side || 'right';

        this.position = opts.position || 0.8;

        this.mesh = new qtek.Mesh({
            geometry: new qtek.StaticGeometry({
                hint: qtek.Geometry.DYNAMIC_DRAW
            }),
            material: new qtek.Material({
                shader: qtek.shader.library.get('buildin.basic', 'diffuseMap')
            }),
            culling: false
        });

        // this.mesh.material.shader.define('fragment', 'RENDER_TEXCOORD');

        this.mesh.position.x = -1;
        this.mesh.position.y = -1;
        this.mesh.position.z = -1;
        this.mesh.scale.set(2, 2, 2);
        this.mesh.update();

        var nVertices = Math.pow(this.segments + 1, 2);
        this.mesh.geometry.attributes.position.init(nVertices);
        this.mesh.geometry.attributes.texcoord0.init(nVertices);

        this._camera = new qtek.camera.Orthographic({
            far: 100
        });
        this._camera.update();

        this._frameBuffer = new qtek.FrameBuffer();

        switch (this.side) {
            case "right":
            default:
                this._coords = [
                    [0, 0],  // Left bottom
                    [0, 1],   // Left top
                    [1, 0],    // Right bottom
                    [1, 1],    // Right top
                ];

                break;
        }

        var coords = this.mesh.geometry.attributes.texcoord0.value;
        var faces = [];

        var off1 = 0;
        var segs = this.segments;

        for (var i = 0; i <= segs; i++) {
            var s = i / segs;

            for (var j = 0; j <= segs; j++) {
                var t = j / segs;


                coords[off1++] = s;
                coords[off1++] = t;

                if (i < segs && j < segs) {

                    var idx = j + i * (segs + 1);

                    faces.push(idx);
                    faces.push(idx+1);
                    faces.push(idx+segs+1);

                    faces.push(idx+segs+1);
                    faces.push(idx+1);
                    faces.push(idx+segs+2);
                }
            }
        }

        this.mesh.geometry.faces = new Uint16Array(faces);

        this.scene = new qtek.Scene();
        this.scene.add(this.mesh);
    }

    GenieEffect.prototype.update = function(percent) {
        if (this.side == 'right' || this.side == 'left') {
            var dim1 = 1;
            var dim2 = 0;
        } else {
            var dim1 = 0;
            var dim2 = 1;
        }

        if (percent > 1) {
            percent = 1;
        } else if (percent < 0) {
            percent = 0
        }

        var stage;
        // Stage 1
        if (percent < 0.5) {
            stage = 1;

            percent = percent / 0.5;

            var pos = this.position;

            this._coords[2][dim1] = lerp(0, pos, percent);
            this._coords[3][dim1] = lerp(1, pos, percent);
        }
        // Stage 2
        else {
            stage = 2;

            percent = (percent - 0.5) / 0.5;

            this._coords[0][dim2] = lerp(0, 1, percent);
            this._coords[1][dim2] = lerp(0, 1, percent);
        }

        var segs = this.segments;
        var off0 = 0;

        var position = this.mesh.geometry.attributes.position.value;

        for (var i = 0; i <= segs; i++) {
            var s = i / segs;

            var x = lerp(this._coords[0][0], this._coords[2][0], s);

            if (stage == 1) {
                var p = qtek.animation.easing.QuadraticInOut(s);
            } else {
                var p = qtek.animation.easing.QuadraticInOut(s * (1 - percent) + percent);
            }

            // Side 1
            var y0 = lerp(this._coords[0][1], this._coords[2][1], p);
            // Side 2
            var y1 = lerp(this._coords[1][1], this._coords[3][1], p);
            
            for (var j = 0; j <= segs; j++) {
                var t = j / segs;

                var y = lerp(y0, y1, t);

                position[off0++] = x;
                position[off0++] = y;
                position[off0++] = 0;
            }
        }

        this.mesh.geometry.dirty();

        return percent >= 1;
    }

    GenieEffect.prototype.beforeRender = function(renderer) {
        if (!this._texture || this._texture.width !== renderer.width || this._texture.height !== renderer.height) {
            if (this._texture) {
                this._texture.dispose(renderer.gl);
            }
            this._texture = new qtek.texture.Texture2D({
                width: renderer.width,
                height: renderer.height
            });

            this.mesh.material.set('diffuseMap', this._texture);
        }

        this._frameBuffer.attach(renderer.gl, this._texture);
        this._frameBuffer.bind(renderer);
    }

    GenieEffect.prototype.render = function(renderer) {
        var gl = renderer.gl;
        renderer.render(this.scene, this._camera);
    }

    GenieEffect.prototype.afterRender = function(renderer) {
        this._frameBuffer.unbind(renderer);
    }

    GenieEffect.prototype.dispose = function() {
        
    }

    return GenieEffect;
})