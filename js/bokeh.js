define(function(require) {

    var qtek = require('qtek');

    qtek.Shader['import'](require('text!./bokeh.essl'));

    return function (renderer, scene, camera) {
        
        var floatEnabled = qtek.core.glinfo.getExtension(renderer.gl, 'OES_texture_float');
        var depthTextureEnabled = qtek.core.glinfo.getExtension(renderer.gl, 'WEBGL_depth_texture');
        // var depthTextureEnabled = null;

        var compositor = new qtek.compositor.Compositor();
        var sceneNode = new qtek.compositor.SceneNode({
            name: "scene",
            scene: scene,
            camera: camera,
            outputs: {
                color: {
                    parameters: {
                        // Half Float
                        type: floatEnabled ? 36193 : qtek.Texture.UNSIGNED_BYTE,
                        width: function(renderer) {return renderer.width},
                        height: function(renderer) {return renderer.height},
                        minFilter: qtek.Texture.NEAREST,
                        magFilter: qtek.Texture.NEAREST
                    }
                },
                depth: {
                    attachment: 'DEPTH_ATTACHMENT',
                    parameters: {
                        width: function(renderer) {return renderer.width},
                        height: function(renderer) {return renderer.height},
                        type: qtek.Texture.UNSIGNED_SHORT,
                        format: qtek.Texture.DEPTH_COMPONENT,
                        minFilter: qtek.Texture.NEAREST,
                        magFilter: qtek.Texture.NEAREST
                    }
                }
            }
        });

        var bokehNode = new qtek.compositor.Node({
            name: 'bokeh',
            shader: qtek.Shader.source('bokeh'),
            inputs: {
                tColor: {
                    node: sceneNode,
                    pin: 'color'
                },
                tDepth: {
                    node: sceneNode,
                    pin: 'depth'
                }
            }
        });

        // Try compiling shader
        var errMsg = bokehNode.pass.material.shader.bind(renderer.gl);
        if (errMsg || !depthTextureEnabled) {
            compositor.updateParameters = function() {};
            compositor.setFocalPlane = function() {};
            compositor.setFStop = function() {};
            compositor.getLastNode = function() {
                return sceneNode;
            }

            sceneNode.outputs = null;

            compositor.addNode(sceneNode);

        } else {
            compositor.addNode(bokehNode);
            compositor.addNode(sceneNode);

            compositor.updateParameters = function() {
                bokehNode.setParameter('textureWidth', renderer.width);
                bokehNode.setParameter('textureHeight', renderer.height);

                bokehNode.setParameter('znear', camera.near);
                bokehNode.setParameter('zfar', camera.far);
            }

            compositor.setFocalPlane = function(val) {
                bokehNode.setParameter('focalDepth', val);
            }

            compositor.setFStop = function(fstop) {
                bokehNode.setParameter('fstop', fstop);
            }

            compositor.getLastNode = function() {
                return bokehNode;
            }

            bokehNode.setParameter('focalDepth', 30);
            bokehNode.setParameter('fstop', 0.8);
            bokehNode.setParameter('maxBlur', 1.6);
            bokehNode.setParameter('gain', 2);

            camera.fov = 2 * Math.atan(24 / (35 * 2)) / (Math.PI * 2) * 360;
            // bokehNode.setParameter('shaderFocus', true);
        }

        return compositor;
    }

});