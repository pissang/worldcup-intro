define(function (require) {

    var qtek = require('qtek');

    var EntryScene = require('./EntryScene');

    var MainScene = require('./MainScene');

    var GenieEffect = require('./GenieEffect');

    var entryScene;

    var mainScene;

    var currentScene;

    var genieEffect;
    var genieEffectTime = 0;
    var genieEffectTimeTotal = 1000;

    var closed = false;

    var renderer;
    var animation;

    function close() {
        var dom = document.getElementById('worldcup-fx-webgl-main-close');
        if (dom) {
            dom.parentNode.removeChild(dom);
        }
        if (closed) {
            return;
        }
        closed = true;

        genieEffect = new GenieEffect();
        genieEffectTime = 0;

        if (currentScene && currentScene.compositor) {
            var lastNode = currentScene.compositor.getLastNode();
            if (lastNode.scene) {
                lastNode.scene.on('beforerender', beforeRender);
                lastNode.scene.on('afterrender', afterRender);
            }
            else if (lastNode.pass) {
                lastNode.pass.on('beforerender', beforeRender);
                lastNode.pass.on('afterrender', afterRender);
            }
        }
    }

    function beforeRender() {
        genieEffect.beforeRender(currentScene.renderer);
    }

    function afterRender() {
        genieEffect.afterRender(currentScene.renderer);
        genieEffect.render(currentScene.renderer);
    }

    function fitToScreen() {
        if (renderer) {
            renderer.resize(window.innerWidth, window.innerHeight);
        }
    }

    var playingBGM = false;

    var main = {
        start: function() {

            var container = document.querySelector('.opr-worldcup_2014');
            if (!container) {
                container = document.body;
            }

            renderer = new qtek.Renderer();
            renderer.canvas.style.position = 'fixed';
            renderer.canvas.id = 'worldcup-fx-webgl-main';
            renderer.canvas.className = 'OP_LOG_BTN';
            renderer.canvas.style.zIndex = 10000;

            container.appendChild(renderer.canvas);

            animation = new qtek.animation.Animation();
            animation.start();
            animation.on('frame', function(deltaTime) {
                var finished = main.frame(deltaTime);
                if (finished) {
                    main.dispose();
                }
            });

            main.renderer = renderer;
            main.animation = animation;

            // // entryScene = new EntryScene(renderer, animation, container);
            // // entryScene.init();
            // // entryScene.start();

            // // currentScene = entryScene;

            // // entryScene.on('enter', function() {
            // //     if (currentScene == entryScene) {
            // //         entryScene.dispose();

            // //         mainScene = new MainScene(renderer, animation, container);

            // //         fitToScreen();
            // //         renderer.setDevicePixelRatio(1.0);

            // //         window.addEventListener('resize', fitToScreen);
                    
            // //         setTimeout(function() {
            // //             playingBGM = true;
            // //             main.playBGM();
            // //         }, 100);

            // //         mainScene.init();
            // //         mainScene.start();

            // //         currentScene = mainScene;

            // //         mainScene.on('done', function() {
            // //             // setTimeout(close, 2000);
            // //         });
            // //         mainScene.on('close', function() {
            // //             close();
            // //         });
            // //     }
            // // });

            // // entryScene.on('close', function() {
            // //     main.dispose();
            // // });
            
            mainScene = new MainScene(renderer, animation, container);
            mainScene.init();
            mainScene.start();

            fitToScreen();
            renderer.setDevicePixelRatio(1.0);
            currentScene = mainScene;

            window.addEventListener('resize', fitToScreen);
        },

        frame: function(dTime) {
            if (genieEffect) {
                genieEffectTime += dTime;
                genieEffect.update(genieEffectTime / genieEffectTimeTotal);
            }

            if (currentScene) {
                currentScene.frame(dTime);
            }

            if (genieEffectTime - dTime > genieEffectTimeTotal) {
                return true;
            }
        },

        dispose: function() {
            mainScene && mainScene.dispose();
            entryScene && entryScene.dispose();

            mainScene = null;
            entryScene = null;
            currentScene = null;
            
            genieEffect && genieEffect.dispose();
            genieEffect = null;

            animation.off('frame');
            animation && animation.stop();
            animation = null;

            window.removeEventListener('resize', fitToScreen);
            if (renderer) {
                renderer.canvas.parentNode.removeChild(renderer.canvas);
            }
            renderer = null;

            if (playingBGM) {
                main.stopBGM();
                playingBGM = false;   
            }
        },

        playBGM: function() { console.log('BGM Start') },

        stopBGM: function() { console.log('BGM Stop') },

        onDone: function() { console.log('DONE') }
    }

    main.start();

    return main;
})