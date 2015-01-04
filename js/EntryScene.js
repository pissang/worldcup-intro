define(function(require) {

    var qtek = require('qtek');
    var cubeGeo = require('./cubeGeo');
    var OIMO = require('OIMO');

    var closeData = require('./closeData');

    var tipStyle = {
        position: 'fixed',
        bottom: '60px',
        width: '200px',
        cursor: 'pointer',

        fontSize: '14px',
        color: '#666',

        textAlign: 'center',

        zIndex: 10010
    }

    var closeStyle = {
        position: 'absolute',
        right: '10px',
        top: '-20px',

        width: '21px',
        height: '21px',

        backgroundSize: '21px 21px',
        backgroundRepeat: 'no-repeat',

        backgroundImage: 'url(' + closeData +')',

        cursor: 'pointer'
    }

    function EntryScene(renderer, animation, container) {

        this.renderer = renderer;
        this.animation = animation;

        this.container = container;

        this.radius = 7;

        this._cubes = [];

        this.onMouseMove = this.onMouseMove.bind(this);
    }

    EntryScene.prototype.init = function() {

        this.scene = new qtek.Scene();

        this.camera = new qtek.camera.Perspective({
            aspect: this.renderer.canvas.width / this.renderer.canvas.height,
            fov: 30
        });
        this.camera.position.z = 35;

        var light = new qtek.light.Directional({
            intensity: 1
        });
        light.position.set(0, 10, 50);
        light.lookAt(qtek.math.Vector3.ZERO);
        this.scene.add(light);

        this.scene.add(new qtek.light.Ambient({
            intensity: 0.1
        }));

        this._createCubes();

        this.world = new OIMO.World();
        this.world.gravity = new OIMO.Vec3(0, -5, 0);

        var ground = new OIMO.Body({
            size: [100, 40, 100],
            pos: [0, -26, 0],
            world: this.world
        });
    }

    EntryScene.prototype.start = function() {

        var renderer = this.renderer;
        var root = this.root;

        renderer.resize(200, 100);
        renderer.canvas.style.position = 'fixed';
        renderer.canvas.style.bottom = '0px';
        renderer.canvas.style.left = '0px';

        this.camera.aspect = 2;

        var contentRightDom = document.getElementById('content_right');
        var x0; 
        if (contentRightDom) {
            if (contentRightDom.getBoundingClientRect) {
                var bb = contentRightDom.getBoundingClientRect();
                x0 = bb.left - 143;
            }
        }
        if (!x0) {
            x0 = window.innerWidth / 2 - 50;
        }
        var obj = {
            angle : x0 / this.radius / 5,
            x: 0,
            y: 200
        }
        this.animation.animate(obj)
            .when(1300, {
                y: 0
            })
            .during(function() {
                renderer.canvas.style.bottom = obj.y + 'px';
            })
            .start('BounceOut');

        this.animation.animate(obj)
            .when(1300, {
                x: x0
            })
            .during(function() {
                renderer.canvas.style.left = obj.x + "px";
            })
            .start();

        root.rotation.rotateZ(obj.angle);

        this.animation.animate(obj)
            .when(1300, {
                angle: 0
            })
            .during(function() {
                root.rotation.identity();
                root.rotation.rotateZ(obj.angle);
            })
            .done(this._enablePhysics.bind(this))
            .start('QuadraticOut');
    }

    EntryScene.prototype.stop = function() {
        this.animation.off('frame', this.updatePhysics);
        document.body.removeEventListener('mousemove', this.onMouseMove);
    }

    EntryScene.prototype.frame = function() {
        if (!this.scene) {
            return;
        }
        this.renderer.render(this.scene, this.camera);
    }

    EntryScene.prototype.dispose = function() {
        this.stop();
        if (this.scene) {
            this.renderer.disposeScene(this.scene);
        }
        this.scene = null;
        this.camera = null;

        this.world = null;

        if (this._tipDom) {
            this._tipDom.parentNode.removeChild(this._tipDom);
            this._tipDom = null;
        }
    }

    EntryScene.prototype._createCubes = function() {

        var geo = cubeGeo.get();
        var shader = qtek.shader.library.get('buildin.physical');

        var root = new qtek.Node();
        this.scene.add(root);

        this.root = root;

        var R = this.radius;

        var segTheta = 8;
        var white = [1, 1, 1];
        var black = [0, 0, 0]
        for (var k = 0; k <= segTheta; k++) {
            var theta = (k - segTheta / 2) * Math.PI / segTheta;

            var r0 = Math.cos(theta) * R;
            var perimeter = r0 * Math.PI * 2;

            var steps = perimeter / (R * 2 * Math.PI / 16);
            for (var i = 0; i <= steps; i ++) {

                if (steps == 0) {
                    var phi = 0;
                } else {
                    var phi = i / steps * Math.PI * 2;
                }

                var scale = 1.5;
                var x = Math.cos(phi) * Math.cos(theta) * (R - scale / 2);
                var y = Math.sin(theta) * (R - scale / 2);
                var z = Math.sin(phi) * Math.cos(theta) * (R - scale / 2);

                var material = new qtek.Material({
                    shader: shader
                });
                material.set('glossiness', 0.6);
                material.set('specularColor', [0.2, 0.2, 0.2]);
                material.set('color', k % 2 ? white: (i % 2 == 0 ? black: white));

                var cube = new qtek.Mesh({
                    geometry: geo,
                    material: material
                });

                cube.position.set(x, y, z);

                cube.rotation.rotateY(-phi);
                cube.rotation.rotateZ(theta);
                cube.scale.set(scale, scale, scale);

                root.add(cube);

                this._cubes.push(cube);
            }
        }
    }

    EntryScene.prototype._enablePhysics = function() {

        var self = this;

        var count = this._cubes.length;

        this.camera.position.y = 5;
        this.camera.lookAt(qtek.math.Vector3.ZERO);

        for (var i = 0; i < count; i++) {
            var child = this._cubes[i];
            var body = new OIMO.Body({
                type: 'box',
                size: [child.scale.x, child.scale.y, child.scale.z],
                pos: [child.position.x, child.position.y, child.position.z],
                move: true,
                world: this.world
            });

            child._body = body;
        }

        this.animation.on('frame', this.updatePhysics, this);

        document.body.addEventListener('mousemove', this.onMouseMove);

        ////////////////  Show tip and close button
        var tipDom = document.createElement('div');
        tipDom.innerHTML = '点击查看世界杯特效';
        tipDom.className = 'OP_LOG_BTN';
        tipDom.id = 'worldcup-fx-webgl-tip';
        tipDom.style.left = this.renderer.canvas.style.left;

        qtek.core.util.extend(tipDom.style, tipStyle);
        this.container.appendChild(tipDom);

        var closeDom = document.createElement('div');
        closeDom.className = 'OP_LOG_BTN';
        closeDom.id = 'worldcup-fx-webgl-entry-close';

        qtek.core.util.extend(closeDom.style, closeStyle);
        tipDom.appendChild(closeDom);

        closeDom.addEventListener('click', function() {
            self.trigger('close');
        });

        this._tipDom = tipDom;

        function enter(e) {
            if (e.target != closeDom) {
                self.trigger('enter');
                self.renderer.canvas.removeEventListener('click', enter);
                self.renderer.canvas.style.cursor = 'default';
            }
        }

        tipDom.addEventListener('click', enter);
        this.renderer.canvas.addEventListener('click', enter);
        this.renderer.canvas.style.cursor = 'pointer';

        // Change position to percent
        this.renderer.canvas.style.left = Math.round(parseInt(this.renderer.canvas.style.left) / window.innerWidth * 100) + '%';
        this._tipDom.style.left = Math.round(parseInt(this._tipDom.style.left) / window.innerWidth * 100) + '%';
    }

    EntryScene.prototype.updatePhysics = function() {

        var noScale = new qtek.math.Vector3();

        this.world.step();

        var count = this._cubes.length;
        for (var i = 0; i < count; i++) {
            var cube = this._cubes[i];
            if (cube._body.body.sleeping) {
                continue;
            }
            var m = cube._body.body.getMatrix();

            for (var j = 0; j < 16; j++) {
                cube.worldTransform._array[j] = m[j];
            }
            cube.worldTransform.decomposeMatrix(noScale, cube.rotation, cube.position);
        }
    }

    EntryScene.prototype.onMouseMove = function(e) {
        var dx = e.pageX - this.renderer.width / 2;
        this.root.rotation.identity().rotateY(dx / 200);
    }

    qtek.core.util.extend(EntryScene.prototype, qtek.core.mixin.notifier);

    return EntryScene;
})