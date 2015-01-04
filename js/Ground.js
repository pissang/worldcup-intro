define(function (require) {
    
    var qtek = require('qtek');

    var grassData = require('./grassData');

    var Ground = qtek.Mesh.derive(function() {

        var planeGeo = new qtek.geometry.Plane();
        var material = new qtek.Material({
            shader: qtek.shader.library.get('buildin.physical', 'diffuseMap')
        });

        material.set('glossiness', 0.1);
        material.set('color', [1.5, 1.5, 1.5]);

        var diffuseTex = new qtek.texture.Texture2D({
            wrapS: qtek.Texture.REPEAT,
            wrapT: qtek.Texture.REPEAT,
            anisotropic: 8
        });
        diffuseTex.load(grassData);

        material.set('diffuseMap', diffuseTex);
        material.set('uvRepeat', [160, 160]);

        return {
            geometry : planeGeo,
            material: material
        }
    }, function() {

        this.scale.set(2000, 2000, 1);
        this.rotation.rotateX(-Math.PI/2);
        this.position.y = -16;
    })

    return Ground;
})