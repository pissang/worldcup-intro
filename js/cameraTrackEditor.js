define(function(require) {

    var qtek = require('qtek');
    var mosaic = require('./mosaic');
    var DebugCamera = require('./DebugCamera');
    var KeyFrame = require('./ui/KeyFrame');
    var createDOFCompositor = require('./bokeh');
    var Ground = require('./Ground');
    var DebugCameraTrackLine = require('./DebugCameraTrackLine');
    var exampleTracksData = require('./tracksData.js');

    require('./ui/KeyFrameHandle');

    var appXML = require("text!./camera_track_editor.xml");

    var XMLParser = require('qpf/core/XMLParser');
    var ko = require('knockout');

    var renderer;
    var compositor;
    var scene = new qtek.Scene();
    var debugCameraScene = new qtek.Scene();
    var mainCamera = new qtek.camera.Perspective({
        far: 500
    });
    mainCamera.position.set(0, 0, 40);

    var freeCamera = mainCamera.clone();

    var light = new qtek.light.Directional();
    light.position.set(0, 40, 70);
    light.lookAt(scene.position);
    scene.add(light);

    scene.add(new Ground());

    var debugCameraTrack = new DebugCameraTrackLine();
    debugCameraScene.add(debugCameraTrack);

    var orbitControl = new qtek.plugin.OrbitControl({
        target: mainCamera
    });
    var firstPersonControl = new qtek.plugin.FirstPersonControl({
        target: mainCamera,
        speed: 0.8,
        sensitivity: 0.3,
        _oldPosition: new qtek.math.Vector3()
    });
    var cameraControl = orbitControl;

    var animation = new qtek.animation.Animation();
    animation.start();

    var cubeGeo;

    function CameraKF(camera) {
        this.camera = camera;

        this.time = ko.observable(0);

        this.cameraTitle = ko.observable(camera.name);

        this.title = ko.computed(function() {
            return this.cameraTitle() + '(' + this.time() + 'ms)';
        }, this);

        this.focalPlane = ko.observable(20);

        this.playbackRatio = ko.observable(1);
    }

    function Player(root) {
        this.root = root;
        this.title = ko.observable();

        this.cubeSize = ko.observable(1);

        this.scale = ko.observable(1),
        this.rotation = ko.observable(0);

        this.image = '';
    }

    var currentPlayer;
    var currentCamera;
    var currentKf;

    var changingUI = false;

    var freeCameraMode = true;

    // Animation
    var inPlayback = false;

    var currentPlaybackRatio = 1.0;

    var maxTime = 0;

    var animationClips = [];

    var viewModel = {

        currentTime: ko.observable(0),

        playerTitle: ko.observable(''),
        cameraTitle: ko.observable(''),

        playerList: ko.observableArray([]),
        cameraList: ko.observableArray([]),

        cameraX: ko.observable(0),
        cameraY: ko.observable(0),
        cameraZ: ko.observable(0),

        cameraTargetX: ko.observable(0),
        cameraTargetY: ko.observable(0),
        cameraTargetZ: ko.observable(0),

        cameraTime: ko.observable(0),

        focalPlane: ko.observable(20),

        playbackRatio: ko.observable(1.0),

        playerX: ko.observable(0),
        playerY: ko.observable(0),
        playerZ: ko.observable(0),

        playerScale: ko.observable(1),
        playerRotation: ko.observable(1),

        playerCubeCount: ko.observable("方块数: 0"),

        dofMode: ko.observable(false),

        cameraMode: ko.observable(false),
        playerMode: ko.observable(false),

        cubeSize: ko.observable(1),

        selectPlayer: function(data) {
            viewModel.cameraMode(false);
            viewModel.playerMode(true);

            currentCamera = null;
            currentKf = null;

            currentPlayer = data[0];
            var playerRoot = currentPlayer.root;
            changingUI = true;
            viewModel.playerX(playerRoot.position.x);
            viewModel.playerY(playerRoot.position.y);
            viewModel.playerZ(playerRoot.position.z);

            viewModel.playerScale(currentPlayer.scale());
            viewModel.playerRotation(Math.round(currentPlayer.rotation() / Math.PI * 180));

            viewModel.cubeSize(currentPlayer.cubeSize());

            viewModel.playerTitle(currentPlayer.title());

            viewModel.focus();

            viewModel.playerCubeCount("方块数: " + currentPlayer.root._children.length);
            changingUI = false;
        },

        selectCamera: function(data) {
            viewModel.cameraMode(true);
            viewModel.playerMode(false);

            currentPlayer = null;

            currentCamera = data[0].camera;
            currentKf = data[0];

            changingUI = true;
            viewModel.cameraX(currentCamera.position.x);
            viewModel.cameraY(currentCamera.position.y);
            viewModel.cameraZ(currentCamera.position.z);

            viewModel.cameraTargetX(currentCamera.target.x);
            viewModel.cameraTargetY(currentCamera.target.y);
            viewModel.cameraTargetZ(currentCamera.target.z);

            viewModel.cameraTime(currentKf.time());
            viewModel.focalPlane(currentKf.focalPlane());

            viewModel.cameraTitle(currentKf.cameraTitle());

            viewModel.currentTime(currentKf.time());

            if (compositor) {
                compositor.setFocalPlane(currentKf.focalPlane());
            }

            viewModel.playbackRatio(currentKf.playbackRatio());

            // Change camera
            if (!freeCameraMode) {
                mainCamera.position.copy(currentCamera.position);
                mainCamera.rotation.copy(currentCamera.rotation);

                orbitControl.origin
                    .copy(currentCamera.position)
                    .scaleAndAdd(currentCamera.localTransform.forward, -30);
            } else {
                viewModel.focus();
            }

            changingUI = false;
        },

        deleteCamera: function() {
            if (viewModel.cameraMode() && currentKf) {
                viewModel.cameraList.remove(currentKf);
                debugCameraScene.remove(currentCamera.debugCamera);
                currentCamera = null;
                currentKf = null;
                viewModel.cameraMode(false);
            }
        },

        deletePlayer: function() {
            if (currentPlayer) {
                viewModel.playerList.remove(currentPlayer);
                scene.remove(currentPlayer.root);

                currentPlayer = null;
                viewModel.playerMode(false);
            }
        },

        updateImage: function() {
            if (currentPlayer) {
                currentPlayer.root.children().forEach(function(child) {
                    currentPlayer.root.remove(child);
                });

                var $input = $("<input type='file' />");
                $input[0].addEventListener('change', function(e) {
                    var file = e.target.files[0];
                    if (file.type.match(/image.*/)) {
                        var fileReader = new FileReader();
                        fileReader.onload = function(e) {
                            var img = new Image();
                            img.onload = function() {
                                var res = mosaic(img);

                                var cubes = createPlayerCubes(res, currentPlayer.cubeSize());

                                cubes.forEach(function(cube) {
                                    currentPlayer.root.add(cube);
                                });
                            }
                            img.src = e.target.result;
                            currentPlayer.image = img;
                        }
                        fileReader.readAsDataURL(file);
                    }
                });
                $input.click();
            }
        },

        focus: function() {
            if (currentPlayer) {
                // Focus
                mainCamera.position.copy(currentPlayer.root.position);
                orbitControl.origin.copy(currentPlayer.root.position);
                mainCamera.position.z += 40;
                mainCamera.lookAt(currentPlayer.root.position, qtek.math.Vector3.UP);
            } else if (currentCamera) {
                mainCamera.position.copy(currentCamera.position);
                orbitControl.origin.copy(currentCamera.position);
                mainCamera.position.z += 40;
                mainCamera.lookAt(currentCamera.position, qtek.math.Vector3.UP);
            }
        },

        download: function() {
            var blob = new Blob([JSON.stringify(toJSON(), null, 2)], {
                type : "text/plain;charset=utf-8"
            });
            saveAs(blob, "tracks.json");
        },

        KeyFrameUI: KeyFrame
    }


    //----------------------------------
    // Prepare data
    //----------------------------------
    function start() {

        var dom = XMLParser.parse(appXML);

        document.body.appendChild(dom);

        ko.applyBindings(viewModel, dom);

        renderer = new qtek.Renderer({
            canvas : document.getElementById('viewport')
        });
        orbitControl.domElement = renderer.canvas;
        firstPersonControl.domElement = renderer.canvas;
        cameraControl.enable();

        var viewUI = $('#main').qpf('get')[0];
        viewUI.on('resize', function() {
            if (viewUI.width()) {
                renderer.resize(viewUI.width(), viewUI.height());
                renderer.setDevicePixelRatio(1.0);
                mainCamera.aspect = renderer.canvas.width / renderer.canvas.height;
            }
        });

        initPlayers(function() {
            restore();

            setInterval(function() {
                save();
            }, 2000);
        });

        // Create camera
        document.getElementById('create-camera-from-current').addEventListener('click', createCameraFromCurrent);
        // document.getElementById('create-camera').addEventListener('click', createCamera);
        document.getElementById('camera-control').addEventListener('click', changeCameraControl);
        document.getElementById('toggle-camera').addEventListener('click', toggleCamera);
        document.getElementById('focus').addEventListener('click', viewModel.focus);

        document.getElementById('download').addEventListener('click', viewModel.download);
        document.getElementById('play').addEventListener('click', togglePlay);
    }

    function createCameraFromCurrent() {
        var cameraKf = createCamera();
        var camera = cameraKf.camera;
        cameraKf.time(viewModel.currentTime());
        camera.position.copy(mainCamera.position);
        camera.target.copy(camera.position).scaleAndAdd(mainCamera.localTransform.forward, -40);
        camera.lookAt(camera.target, qtek.math.Vector3.UP);
        camera.update(true);

        // viewModel.selectCamera([cameraKf]);
    }

    function createCamera() {
        var camera = new qtek.camera.Perspective();
        camera.far = 5;
        camera.update(true);

        camera.target = new qtek.math.Vector3();
        camera.debugCamera = new DebugCamera();
        camera.debugCamera.camera = camera;
        camera.debugCamera.material.set('color', [Math.random(), Math.random(), Math.random()]);
        debugCameraScene.add(camera.debugCamera);

        camera.name = 'CAMERA_' + viewModel.cameraList().length;

        var kf = new CameraKF(camera);
        viewModel.cameraList.push(kf);

        return kf;
    }

    function toggleCamera() {
        if (freeCameraMode) {
            enterCamera();
        } else {
            leaveCamera();
        }
    }

    function enterCamera() {
        if (currentCamera) {
            freeCamera.rotation.copy(mainCamera.rotation);
            freeCamera.position.copy(mainCamera.position);

            mainCamera.position.copy(currentCamera.position);
            mainCamera.rotation.copy(currentCamera.rotation);

            document.getElementById('toggle-camera').innerHTML = '摄像机视角';
            document.getElementById('toggle-camera').style.color = 'red';
            freeCameraMode = false;
        }
    }

    function leaveCamera() {
        mainCamera.rotation.copy(freeCamera.rotation);
        mainCamera.position.copy(freeCamera.position);

        document.getElementById('toggle-camera').innerHTML = '自由视角'
        document.getElementById('toggle-camera').style.color = 'black';
        freeCameraMode = true;
    }

    function changeCameraControl() {
        cameraControl.disable();
        if (cameraControl == firstPersonControl) {
            // Pan the origin
            orbitControl.origin
                .add(mainCamera.position)
                .sub(firstPersonControl._oldPosition);
            this.innerHTML = '第三视角';
            cameraControl = orbitControl;
        } else {
            this.innerHTML = '第一视角';
            cameraControl = firstPersonControl;

            firstPersonControl._oldPosition.copy(mainCamera.position);
        }
        cameraControl.enable();
    }

    function createPlayerCubes(data, size) {

        var positionArr = data.position;
        var colorArr = data.color;

        var specularColor = [0.1, 0.1, 0.1];
        var emission = [0, 0, 0];
        var lineColor = [0, 0, 0];

        var shader = qtek.shader.library.get('buildin.physical');

        var meshList = [];
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
            cubeMat.set('specularColor', specularColor);
            cubeMat.set('emission', emission);
            cubeMat.set('lineColor', lineColor);
            cubeMat.set('glossiness', 0.6);

            cubeMat.set('color', [r / 255, g / 255, b / 255]);

            var mesh = new qtek.Mesh({
                material: cubeMat,
                geometry: cubeGeo
            });

            mesh.position.set(x * 15, y * 15, z);

            mesh.rotation.rotateX(Math.random() * Math.PI * 2);
            mesh.rotation.rotateZ(Math.random() * Math.PI * 2);

            var scale = size * 0.1;
            mesh.scale.set(scale, scale, scale);

            meshList.push(mesh);
        }

        return meshList;
    }

    function createPlayer(data, size) {

        var playerRoot = new qtek.Node();

        createPlayerCubes(data, size).forEach(function(mesh) {
            playerRoot.add(mesh);
        });

        var k = viewModel.playerList().length;
        playerRoot.position.z -= k * 10;
        playerRoot.name = 'PLAYER_' + k;

        var player = new Player(playerRoot);
        player.cubeSize(size);
        player.title(playerRoot.name);

        viewModel.playerList.push(player);

        return player;
    }

    function initPlayers(callback) {
        var gltfLoader = new qtek.loader.GLTF();
        gltfLoader.load('assets/cube/cube_2.json');

        gltfLoader.success(function(res) {

            cubeGeo = res.scene.getNode('Cube').geometry;

            compositor = createDOFCompositor(renderer, scene, mainCamera);

            animation.on('frame', function(deltaTime) {
                stats.begin();
                if (inPlayback) {
                    mainCamera.far = 200;
                }
                if (inPlayback || viewModel.dofMode()) {
                    compositor.updateParameters();
                    compositor.render(renderer);
                } else {
                    renderer.saveClear();
                    renderer.render(debugCameraScene, mainCamera);

                    renderer.clear = 0;
                    mainCamera.far = 500;
                    renderer.render(scene, mainCamera);

                    renderer.restoreClear();
                }
                stats.end();

                cameraControl.update(deltaTime);
                var playerList = viewModel.playerList();
                for (var k = 0; k < playerList.length; k++) {
                    var cubes = playerList[k].root._children;

                    for (var i = 0; i < cubes.length; i++) {
                        var cube = cubes[i];
                        qtek.math.Quaternion.rotateY(cube.rotation, cube.rotation, deltaTime / 500);
                    }
                }

                if (inPlayback) {
                    if (viewModel.currentTime() < maxTime) {
                        viewModel.currentTime(viewModel.currentTime() + deltaTime * currentPlaybackRatio);
                    }
                    for (var i = 0; i < animationClips.length; i++) {
                        animationClips[i].setTime(viewModel.currentTime());
                    }
                }

                if (!freeCameraMode) {
                    if (currentCamera) {
                        currentCamera.position.copy(mainCamera.position);
                        currentCamera.rotation.copy(mainCamera.rotation);
                        currentCamera.updateLocalTransform();

                        currentCamera.target
                            .copy(currentCamera.position)
                            .scaleAndAdd(currentCamera.localTransform.forward, -50);
                        changingUI = true;
                        viewModel.cameraX(currentCamera.position.x);
                        viewModel.cameraY(currentCamera.position.y);
                        viewModel.cameraZ(currentCamera.position.z);

                        viewModel.cameraTargetX(currentCamera.target.x);
                        viewModel.cameraTargetY(currentCamera.target.y);
                        viewModel.cameraTargetZ(currentCamera.target.z);
                        changingUI = false;
                    }
                }
            });

            callback && callback();
        });
    }

    //--------------------------------------------
    // view model listeners
    //--------------------------------------------
    // Player position
    ko.computed(function() {
        var x = viewModel.playerX();
        var y = viewModel.playerY();
        var z = viewModel.playerZ();

        var scale = viewModel.playerScale();
        var angle = viewModel.playerRotation() * Math.PI / 180;

        if (currentPlayer && !changingUI) {
            currentPlayer.root.position.set(x, y, z);
            currentPlayer.root.scale.set(scale, scale, scale);
            currentPlayer.root.rotation.identity().rotateY(angle);

            currentPlayer.scale(scale);
            currentPlayer.rotation(angle);
        }
    });

    // Camera
    ko.computed(function() {
        var x = viewModel.cameraX();
        var y = viewModel.cameraY();
        var z = viewModel.cameraZ();

        if (currentCamera && !changingUI) {
            // var dx = x - currentCamera.position.x;
            // var dy = y - currentCamera.position.y;
            // var dz = z - currentCamera.position.z;

            currentCamera.position.set(x, y, z);
            currentCamera.lookAt(currentCamera.target);

            // Pan the target
            // currentCamera.target.x += dx;
            // currentCamera.target.y += dy;
            // currentCamera.target.z += dz;

            // changingUI = true;
            // viewModel.cameraTargetX(currentCamera.target.x);
            // viewModel.cameraTargetY(currentCamera.target.y);
            // viewModel.cameraTargetZ(currentCamera.target.z);
            // changingUI = false;
        }
    });

    // Camera target position
    ko.computed(function() {
        var x = viewModel.cameraTargetX();
        var y = viewModel.cameraTargetY();
        var z = viewModel.cameraTargetZ();

        if (currentCamera && !changingUI) {
            currentCamera.target.set(x, y, z);
            currentCamera.lookAt(currentCamera.target, qtek.math.Vector3.UP);
        }
    });

    // Keyframe time
    ko.computed(function() {
        var time = viewModel.cameraTime();
        if (currentKf && !changingUI) {
            currentKf.time(time);
        }
    });

    // Focal plane
    ko.computed(function() {
        var focalPlane = viewModel.focalPlane();

        if (currentKf && !changingUI) {
            currentKf.focalPlane(focalPlane);
        }
        if (compositor) {
            compositor.setFocalPlane(focalPlane);
        }
    });

    // Current time
    ko.computed(function() {
        var time = viewModel.currentTime();
        if (!inPlayback) {
            if (!freeCameraMode) {
                leaveCamera();
            }
            for (var i = 0; i < animationClips.length; i++) {
                animationClips[i].setTime(viewModel.currentTime());
            }
        }
    });

    // Playback ratio
    ko.computed(function() {
        var ratio = viewModel.playbackRatio();

        if (currentKf) {
            currentKf.playbackRatio(ratio);
        }

        currentPlaybackRatio = ratio;
    });

    // Cube size
    ko.computed(function() {
        var cubeSize = viewModel.cubeSize();

        if (currentPlayer) {
            currentPlayer.cubeSize(cubeSize);
            var cubes = currentPlayer.root._children;
            var scale = cubeSize * 0.1;
            for (var i = 0; i < cubes.length; i++) {
                cubes[i].scale.set(scale, scale, scale);
            }
        }
    });

    // Title
    ko.computed(function() {
        var playerTitle = viewModel.playerTitle();
        var cameraTitle = viewModel.cameraTitle();

        if (currentPlayer) {
            currentPlayer.title(playerTitle);
        }
        if (currentKf) {
            currentKf.cameraTitle(cameraTitle);
        }
    })

    function togglePlay() {

        if (!freeCameraMode) {
            leaveCamera();
        }
        if (!inPlayback) {
            inPlayback = true;

            this.innerHTML = '停止';
        } else {
            inPlayback = false;
            this.innerHTML = '播放';
        }
    }

    // Play the track
    function createTrack() {
        if (inPlayback) {
            return;
        }

        animationClips = [];

        // Save the camera position and rotation
        freeCamera.position.copy(mainCamera.position);
        freeCamera.rotation.copy(mainCamera.rotation);

        var cameraKfs = viewModel.cameraList();
        if (cameraKfs.length < 2) {
            return;
        }

        var positionDeferred = animation.animate(mainCamera.position);
        var rotationDeferred = animation.animate(mainCamera, {
            interpolater: qtek.math.Quaternion.slerp
        });
        var obj = {
            focalPlane: 0,
            playbackRatio: 1
        }
        var focalPlaneDeferred = animation.animate(obj);
        var playbackRatioDeferred = animation.animate(obj);

        maxTime = 0;
        for (var i = 0; i < cameraKfs.length; i++) {
            var camera = cameraKfs[i].camera;
            var time = cameraKfs[i].time();
            positionDeferred.when(time, {
                _array: camera.position._array
            });
            rotationDeferred.when(time, {
                rotation: camera.rotation
            });
            focalPlaneDeferred.when(time, {
                focalPlane: cameraKfs[i].focalPlane()
            });
            playbackRatioDeferred.when(time, {
                playbackRatio: cameraKfs[i].playbackRatio()
            });

            if (time > maxTime) {
                maxTime = time;
            }
        }

        positionDeferred.during(function() {
            mainCamera.position._dirty = true;
        }).start('spline');
        rotationDeferred.done(function() {
            inPlayback = false;
        })
        .start();
        focalPlaneDeferred.during(function() {
            if (compositor) {
                compositor.setFocalPlane(obj.focalPlane);
            }
        })
        .start();
        playbackRatioDeferred.during(function() {
            currentPlaybackRatio = obj.playbackRatio;
        }).start();

        var playbackRatioClips = playbackRatioDeferred.getClips();

        animationClips = positionDeferred.getClips()
                        .concat(rotationDeferred.getClips())
                        .concat(focalPlaneDeferred.getClips())
                        .concat(playbackRatioClips);

        positionDeferred.stop();
        rotationDeferred.stop();
        focalPlaneDeferred.stop();
        playbackRatioDeferred.stop();


        for (var i = 0; i < cameraKfs.length; i++) {
            debugCameraTrack.keyframes[i] = cameraKfs[i].camera;
        }
        debugCameraTrack.keyframes.length = cameraKfs.length;
        debugCameraTrack.updateGeometry();
    }

    setInterval(createTrack, 1000);

    function save() {
        window.localStorage['camera-track-scene-2'] = JSON.stringify(toJSON());
    }

    function toJSON() {
        var cameraKfs = viewModel.cameraList();
        var playerList = viewModel.playerList();
        var json = {
            cameras: [],
            players: []
        };
        for (var i = 0; i < cameraKfs.length; i++) {
            var kf = cameraKfs[i];
            json.cameras.push({
                position: Array.prototype.slice.call(kf.camera.position._array),
                target: Array.prototype.slice.call(kf.camera.target._array),
                time: kf.time(),
                focalPlane: kf.focalPlane(),
                playbackRatio: kf.playbackRatio() || 1,
                title: kf.cameraTitle()
            });
        }
        for (var i = 0; i < playerList.length; i++) {
            var player = playerList[i];
            json.players.push({
                position: Array.prototype.slice.call(player.root.position._array),
                image: player.image.src,
                cubeSize: player.cubeSize(),
                scale: player.scale(),
                rotation: player.rotation(),
                title: player.title()
            });
        }
        return json;
    }

    function restore() {
        if (window.localStorage['camera-track-scene-2']) {
            fromJSON(JSON.parse(window.localStorage['camera-track-scene-2']));
        } else {
            fromJSON(exampleTracksData);
        }
    }

    function fromJSON(json) {
        if (!json) {
            return;
        }
        viewModel.playerList().forEach(function(player) {
            scene.remove(player.root);
        });

        viewModel.playerList([]);

        currentCamera = null;
        currentPlayer = null;

        for (var i = 0; i < json.players.length; i++) {
            var img = new Image();
            img.onload = (function(playerObj) {
                return function() {
                    var res = mosaic(this);

                    var player = createPlayer(res, playerObj.cubeSize || 1);

                    player.root.position.setArray(playerObj.position);
                    player.root.rotation.rotateY(playerObj.rotation);

                    var scale = playerObj.scale || 1;
                    player.rotation(playerObj.rotation || 0);
                    player.scale(scale);
                    player.root.scale.set(scale, scale, scale);

                    if (playerObj.title) {
                        player.title(playerObj.title);
                    }

                    player.image = this;

                    scene.add(player.root);
                }
            })(json.players[i])

            img.src = json.players[i].image;
        }

        json.cameras = json.cameras.sort(function(a, b) {
            return a.time - b.time;
        });

        viewModel.cameraList([]);
        for (var i = 0; i < json.cameras.length; i++) {
            var kf = createCamera();

            kf.camera.position.setArray(json.cameras[i].position);
            kf.camera.target.setArray(json.cameras[i].target);
            kf.time(json.cameras[i].time);
            kf.focalPlane(json.cameras[i].focalPlane);

            kf.playbackRatio(json.cameras[i].playbackRatio || 1)

            kf.camera.lookAt(kf.camera.target, qtek.math.Vector3.UP);

            if (json.cameras[i].title) {
                kf.cameraTitle(json.cameras[i].title);
            }
        }
    }

    // Dragin player img
    document.body.addEventListener("dragover", function(e){
        e.stopPropagation();
        e.preventDefault();
    }, false);
    document.body.addEventListener("drop", handleDrop, false);

    function handleDrop(e){
        e.stopPropagation();
        e.preventDefault();
        var file = e.dataTransfer.files[0];
        if(file.type.match('image.*')){
            var fileReader = new FileReader();
            fileReader.onload = function(e) {
                var img = new Image();
                img.onload = function() {
                    // var width = Math.min(img.width, 100);
                    var width = img.width;
                    var res = mosaic(img, 0, 0, img.width, img.height, width / img.width);

                    var player = createPlayer(res, 1);

                    var forward = mainCamera.localTransform.forward;
                    forward.y = 0;
                    forward.normalize();

                    player.root.position.copy(mainCamera.position).y = 0;
                    player.root.position.scaleAndAdd(forward, -40);

                    player.image = img;

                    var name = file.name.substr(0, file.name.length - 4);
                    player.title(name);

                    scene.add(player.root);

                    viewModel.selectPlayer([player]);
                }
                img.src = e.target.result;
            }
            fileReader.readAsDataURL(file);
        } else if (file.name.match(/json$/)) {
            var fileReader = new FileReader();
            fileReader.onload = function(e) {
                fromJSON(JSON.parse(e.target.result));
            }
            fileReader.readAsText(file);
        }
    }

    var stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.right = '5px';
    stats.domElement.style.bottom = '5px';
    stats.domElement.style.zIndex = '100';
    document.body.appendChild(stats.domElement);

    return {
        start: start
    }
});
