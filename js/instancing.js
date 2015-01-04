define(function(require) {

    var InstancedMesh = require('./InstancedMesh');
    var qtek = require('qtek');

    return function(cubeList, options) {
        if (typeof(options) == 'number') {
            var max = options;
            options = {};
        } else {
            options = options || {};
            var max = options.max || 20;
        }

        var n = 0;
        var res = [];

        if (cubeList.length > max) {
            var count = 0;
            var instancedMesh = new InstancedMesh();
            for (var i = 0; i < max; i++) {
                n++;
                instancedMesh.addMesh(cubeList[i]);
                count++;
            }
            instancedMesh.instancing(options);
            res.push(instancedMesh);

            for (var i = 1; i < Math.floor(cubeList.length / max); i++) {
                var instancedMesh = new InstancedMesh({
                    geometry: instancedMesh.geometry,
                    material: new qtek.Material({
                        shader: instancedMesh.material.shader
                    })
                });
                for (var k = 0; k < max; k++) {
                    instancedMesh.addMesh(cubeList[n++]);
                }
                res.push(instancedMesh);
            }
        }

        if (cubeList.length - 1 > n) {
            var instancedMesh = new InstancedMesh();
            for (var i = n; i < cubeList.length; i++) {
                instancedMesh.addMesh(cubeList[i]);
            }
            instancedMesh.instancing(options);

            res.push(instancedMesh);
        }

        return res;
    }
});