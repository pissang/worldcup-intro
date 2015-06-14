define(function(require) {

    var instancing = require('./instancing');
    var bokeh = require('./bokeh');
    var mosaic = require('./mosaic');

    var cubeGeo = require('./cubeGeo');
    var tracks = require('./tracksData');

    var skyData = require('./skyData');
    var logoData = require('./logoData');

    var closeData = require('./closeData');

    var Ground = require('./Ground');
    var Leaves = require('./Leaves');

    var qtek = require('qtek');

    var specularColor = [0.5, 0.5, 0.5];
    var emission = [0, 0, 0];
    var lineColor = [0, 0, 0];

    var closeStyle = {
        position: 'fixed',
        right: '30px',
        top: '30px',

        width: '21px',
        height: '21px',

        backgroundSize: '21px 21px',
        backgroundRepeat: 'no-repeat',

        backgroundImage: 'url(' + closeData +')',

        cursor: 'pointer',

        zIndex: 10010
    }

    var fadeInStyle = {
        position: 'fixed',
        left: '0px',
        right: '0px',
        top: '0px',
        bottom: '0px',

        backgroundColor: 'black',
        opacity: 0,
        zIndex: 10001
    }

    var cameraFar = 260;

    function MainScene(renderer, animation, container) {

        this.renderer = renderer;
        this.animation = animation;

        this.container = container;

        this.compositor = null;

        this._odx = 0;

        this._cubes = [];

        this._players = [];

        this.onMouseMove = this.onMouseMove.bind(this);
    }

    function isMacFireFox() {
        return window.navigator.userAgent.indexOf('Firefox') >= 0
            && window.navigator.userAgent.indexOf('Mac OS') >= 0
    }

    MainScene.prototype.init = function(callback) {
        var self = this;
        /////////////// Basic Scene
        var scene = this.scene = new qtek.Scene();
        var camera = this.camera = new qtek.camera.Perspective();

        var light = new qtek.light.Directional({
            intensity: 1
        });
        light.position.set(0, 40, 70);
        light.lookAt(qtek.math.Vector3.ZERO);
        scene.add(light);

        scene.add(new Ground());

        /////////////// Skydome
        var skyTexture = new qtek.Texture2D({
            flipY: false
        });
        skyTexture.load(skyData);
        var skydome = new qtek.plugin.Skydome({
            geometry: new qtek.geometry.Sphere({
                widthSegments: 30,
                heightSegements: 30,
                thetaLength : Math.PI / 1.8
            }),
            scene: scene
        });
        skydome.rotation.rotateY(Math.PI);
        skydome.material.set('diffuseMap', skyTexture);

        /////////////// Leaves FX
        this.leaves = new Leaves(camera);
        var leafList = this.leaves.init(2000);

        leafList.forEach(function(mesh) {
            mesh.visible = false;
            scene.add(mesh);
        });

        instancing(leafList, 20).forEach(function(mesh) {
            scene.add(mesh);
        });

        ////////////// Bokeh FX
        this.compositor = bokeh(this.renderer, scene, camera);

        ////////////// Players
        var count = tracks.players.length;
        for (var i = 0; i < tracks.players.length; i++) {
            this._createPlayer(tracks.players[i], function() {
                count--;
                if (count == 0) {
                    callback && callback();
                }
            });
        }

        ////////////// Logo data
        var logoImg = new Image();
        logoImg.onload = function() {
            var logoCubeData = mosaic(logoImg, 0, 0, logoImg.width, logoImg.height, 1, false);

            // Explosion data
            var randomExplodedPositions = [];
            var minR = 10;
            var maxR = 40;
            var minTheta = -Math.PI / 3;
            var maxTheta = Math.PI / 3;
            var rand = Math.random;

            for (var i = 0; i < logoCubeData.position.length; i++) {
                logoCubeData.position[i][0] *= 12;
                logoCubeData.position[i][1] *= 12;
                logoCubeData.position[i][2] *= 1;
                logoCubeData.color[i][0] /= 255;
                logoCubeData.color[i][1] /= 255;
                logoCubeData.color[i][2] /= 255;

                var r = rand() * (maxR - minR) + minR;
                var theta = rand() * (maxTheta - minTheta) + minTheta;
                var phi = rand() * Math.PI * 2;
                var arr = new Float32Array(3);
                arr[0] = Math.cos(phi) * r * Math.cos(theta);
                arr[1] = Math.sin(theta) * r;
                arr[2] = Math.sin(phi) * r * Math.cos(theta);
                randomExplodedPositions.push(arr);
            }

            self._logoCubeData = logoCubeData;
            self._randomExplodedPositions = randomExplodedPositions;
        }

        logoImg.src = logoData;
    }

    MainScene.prototype._createPlayer = function(obj, callback) {

        var img = new Image();
        var shader = qtek.shader.library.get('buildin.physical');
        
        var players = this._players;
        var cubes = this._cubes;
        var scene =  this.scene;

        var geo = cubeGeo.get();
        
        img.onload = function() {

            var res = mosaic(img, 0, 0, 0, 0, 0.8);
            
            var positionArr = res.position;
            var colorArr = res.color;

            var playerRoot = new qtek.Node();
            playerRoot.frustumCulling = true;

            var playerCubeList = [];

            for (var i = 0, j = 0; i< positionArr.length;) {
                var x = positionArr[i++];
                var y = positionArr[i++];
                var z = positionArr[i++];

                var r = colorArr[j++];
                var g = colorArr[j++];
                var b = colorArr[j++];

                var cubeMat = new qtek.Material({
                    shader: shader
                });

                cubeMat.set('color', [r / 255, g / 255, b / 255]);

                var mesh = new qtek.Mesh({
                    material: cubeMat,
                    geometry: geo
                });

                mesh.position.set(x * 15, y * 15, z);

                mesh.rotation.rotateX(Math.random() * Math.PI * 2);
                mesh.rotation.rotateZ(Math.random() * Math.PI * 2);

                var scale = obj.cubeSize * 0.12;
                mesh.scale.set(scale, scale, scale);
                mesh.visible = false;

                playerRoot.add(mesh);

                playerCubeList.push(mesh);

                cubes.push(mesh);
            }

            playerRoot.position.setArray(obj.position);
            playerRoot.rotation.rotateY(obj.rotation);
            playerRoot.scale.set(obj.scale, obj.scale, obj.scale);
            playerRoot.name = obj.title;

            scene.add(playerRoot);

            players.push(playerRoot);

            var instancedMeshes = instancing(playerCubeList, {
                max: 20
            });

            instancedMeshes.forEach(function(mesh) {
                mesh.frustumCulling = false;
                mesh.material.set('glossiness', 0.6)
                scene.add(mesh);
            });
            
            playerRoot._instancedMeshes = instancedMeshes;

            callback();
        }

        img.src = obj.image;
    }

    MainScene.prototype.start = function() {

        this.renderer.canvas.style.position = 'fixed';
        this.renderer.canvas.style.left = '0px';
        this.renderer.canvas.style.top = '0px';

        var self = this;

        if (!isMacFireFox()) {
            this.renderer.canvas.style.display = 'none';
        }

        setTimeout(function() { // Put in next tick
            // Mac 下的 firefox 淡出会死掉
            if (isMacFireFox()) {
                self._createCloseDom();

                self._trackAnimation(function() {
                    self._explosionAnimation();
                });
            } else {
                self._fadeIn(function() {

                    // self._createCloseDom();

                    self._trackAnimation(function() {
                        self._explosionAnimation();
                    });
                });
            }
        }, 20)
    }

    MainScene.prototype._createCloseDom = function() {
        var closeDom = document.createElement('div');
        closeDom.className = 'OP_LOG_BTN';
        closeDom.id = 'worldcup-fx-webgl-main-close';

        qtek.core.util.extend(closeDom.style, closeStyle);

        this.container.appendChild(closeDom);

        var self = this;
        closeDom.onclick = function() {
            self.container.removeChild(closeDom);
            if (self._fadeInDom) {
                self._fadeInDom.parentNode.removeChild(self._fadeInDom);
                self._fadeInDom = null;
            }
            self.trigger('close');
        }
    }

    MainScene.prototype._fadeIn = function(prepareTrackAnimation) {
        var fadeInDom = document.createElement('div');
        document.body.appendChild(fadeInDom);

        this._fadeInDom = fadeInDom;

        fadeInStyle.opacity = 0;
        qtek.core.util.extend(fadeInDom.style, fadeInStyle);

        var self = this;

        function during(target) {
            fadeInDom.style.opacity = target.opacity;
        }

        this.animation.animate(fadeInStyle)
            .when(1000, {
                opacity: 1
            })
            .during(during)
            .done(function() {

                self.animation.animate(fadeInStyle)
                .when(1000, {
                    opacity: 0
                })
                .during(during)
                .done(function() {
                    fadeInDom.parentNode.removeChild(fadeInDom);
                    self._fadeInDom = null;
                })
                .start();

                self.renderer.canvas.style.display = 'block';

                prepareTrackAnimation();
            })
            .start();
    }

    MainScene.prototype.stop = function() {
        document.body.removeEventListener('mousemove', this.onMouseMove);
    }

    MainScene.prototype.dispose = function() {
        this.stop();
        if (this.scene) {
            this.renderer.disposeScene(this.scene);
        }
        this.scene = null;
        this.camera = null;
        this.compositor = null;
    }

    MainScene.prototype.frame = function(deltaTime) {
        if (!this.scene) {
            return;
        }
        var camera = this.camera;
        var scene = this.scene;
        var compositor = this.compositor;
        var renderer = this.renderer;

        var players = this._players;
        var cubes = this._cubes;

        camera.far = cameraFar;
        camera.aspect = renderer.getViewportAspect();

        // Culling
        camera.update(true);
        
        var posInView = new qtek.math.Vector3();
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            if (!player.frustumCulling) {
                var hidden = false;
            } else {
                player.getWorldPosition(posInView);

                qtek.math.Vector3.transformMat4(posInView, posInView, camera.viewMatrix);

                var hidden = (-posInView._array[2] > camera.far + 1) || (posInView._array[2] >= 0);
            }
            
            for (var j = 0; j < player._instancedMeshes.length; j++) {
                player._instancedMeshes[j].visible = !hidden;
            }
        }

        compositor.updateParameters();
        compositor.render(renderer);

        for (var i = 0; i < cubes.length; i++) {
            qtek.math.Quaternion.rotateY(cubes[i].rotation, cubes[i].rotation, deltaTime / 500);
        }

        this.leaves.update(deltaTime);
    }

    MainScene.prototype._trackAnimation = function(callback) {

        var camera = this.camera;
        var animation = this.animation;
        var compositor = this.compositor;

        var obj = {
            focalPlane: 10,
            playbackRatio: 1
        }
        var positionDeferred = animation.animate(camera.position).delay(1200);
        var rotationDeferred = animation.animate(camera, {
            interpolater: qtek.math.Quaternion.slerp
        }).delay(1200);
        var focalPlaneDeferred = animation.animate(obj).delay(1200);
        var playbackRatioDeferred = animation.animate(obj).delay(1200);

        var ghostCamera = new qtek.camera.Perspective();
        var target = new qtek.math.Vector3();

        if (tracks.cameras.length > 0) {
            camera.position.setArray(tracks.cameras[0].position);
            target.setArray(tracks.cameras[0].target);
            camera.lookAt(target);
        }

        for (var i = 0; i < tracks.cameras.length; i++) {
            var kf = tracks.cameras[i];
            var time = kf.time;
            positionDeferred.when(time, {
                _array: kf.position
            });
            ghostCamera.position.setArray(kf.position);
            target.setArray(kf.target);
            ghostCamera.lookAt(target);
            rotationDeferred.when(time, {
                rotation: ghostCamera.rotation.clone()
            });
            focalPlaneDeferred.when(time, {
                focalPlane: kf.focalPlane
            });
            playbackRatioDeferred.when(time, {
                playbackRatio: kf.playbackRatio
            });
        }

        var clips = [];

        positionDeferred.during(function() {
            camera.position._dirty = true;
        })
        .done(callback)
        .start('spline');

        rotationDeferred.start();

        focalPlaneDeferred.during(function() {
            compositor.setFocalPlane(obj.focalPlane);
        }).start();
        playbackRatioDeferred.during(function() {
            for (var i = 0; i < clips.length; i++) {
                clips[i].playbackRate = obj.playbackRatio;
            }
        }).start();

        clips = positionDeferred.getClips()
            .concat(rotationDeferred.getClips())
            .concat(focalPlaneDeferred.getClips())
            .concat(playbackRatioDeferred.getClips());
    }

    MainScene.prototype._explosionAnimation = function() {

        var animation = this.animation;
        var camera = this.camera;

        var len = this._cubes.length;
        var count = this._randomExplodedPositions.length;

        var self = this;

        if (this.compositor) {
            this.compositor.setFStop(0.2);
        }

        var done = function() {
            count--;
            if (count == 0) {
                self._regroupAnimation();
            }
        }

        var during = function(target) {
            target._dirty = true;
        }

        var lastPlayer = this._players[this._players.length - 1];

        for (var i = 0; i < count; i++) { 

            var cube = this._cubes[len - i - 1];
            cube.getParent().frustumCulling = false;
            if (cube.getParent() != lastPlayer) {
                lastPlayer.add(cube);
            }

            animation.animate(cube.position)
                .when(700, {
                    _array: this._randomExplodedPositions[i]
                })
                .during(during)
                .done(done)
                .start('ExponentialOut');

            animation.animate(cube.material.uniforms.color)
                .when(700, {
                    value: this._logoCubeData.color[i]
                })
                .start('ExponentialOut');
        }

        var newPos = new qtek.math.Vector3();
        qtek.math.Vector3.scaleAndAdd(newPos, camera.position, camera.localTransform.z, -25);
        animation.animate(camera.position)
            .when(700, {
                _array: newPos._array
            })
            .during(during)
            .start('ExponentialOut');
    }
    
    MainScene.prototype._regroupAnimation = function() {
        var len = this._cubes.length;
        var count = this._randomExplodedPositions.length;
        var self = this;

        var animation = this.animation;
        var camera = this.camera;

        var done = function() {
            count--;
            if (count == 0) {
                document.body.addEventListener('mousemove', self.onMouseMove);
            }
        }
        var during = function(target) {
            target._dirty = true;
        }

        var lastPlayer = this._players[this._players.length - 1];
        
        var scale = [0.1, 0.1, 0.1];
        for (var i = 0; i < count; i++) {
            var cube = this._cubes[len - i - 1];

            var delay = Math.random() * 100;

            scale[0] = 0.1 * this._logoCubeData.scale[i];
            scale[1] = 0.1 * this._logoCubeData.scale[i];
            scale[2] = 0.1 * this._logoCubeData.scale[i];
            
            animation.animate(cube.position)
                .when(800, {
                    _array: this._logoCubeData.position[i]
                })
                .during(during)
                .done(done)
                .delay(delay)
                .start('ExponentialIn');

            animation.animate(cube.scale)
                .when(800, {
                    _array: scale
                })
                .done(done)
                .delay(delay)
                .start('ExponentialIn');
        }

        var newPos = new qtek.math.Vector3();
        qtek.math.Vector3.scaleAndAdd(newPos, camera.position, camera.localTransform.z, 25);
        animation.animate(camera.position)
            .when(800, {
                _array: newPos._array
            })
            .during(during)
            .start('ExponentialIn');
    }

    MainScene.prototype.onMouseMove = function(e) {
        var dx = e.pageX - this.renderer.getWidth() / 2;
        var offx = (dx - this._odx) / 700;

        var lastPlayer = this._players[this._players.length - 1];

        this.camera.rotateAround(lastPlayer.position, qtek.math.Vector3.UP, offx);

        this._odx = dx;
    }

    qtek.core.util.extend(MainScene.prototype, qtek.core.mixin.notifier);

    return MainScene
});