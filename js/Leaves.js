define(function (require) {
    
    var qtek = require('qtek');

    var rand = Math.random;

    var shader = qtek.shader.library.get('buildin.physical');

    var Leaves = function(camera) {

        this.leaves = [];

        this.camera = camera;

        this.xRange = 200;
        this.zRange = 200;
        
        this.planeGeo = new qtek.geometry.Plane();
    }

    Leaves.prototype._resetLeaaf = function(node) {
        node.position._array[0] = this.xRange - rand() * this.xRange * 2;
        node.position._array[1] = -10 + rand() * 40;
        node.position._array[2] = -rand() * this.zRange - 10;

        if (this.camera) {
            // Before camera
            node.position._array[0] += this.camera.position._array[0];
            node.position._array[1] += this.camera.position._array[1];
            node.position._array[2] += this.camera.position._array[2];
        }
        
        node.life = 1000 + rand() * 2000;

        qtek.math.Vector3.set(
            node.scale,
            rand() * 0.3 + 0.1,
            rand() * 0.3 + 0.1, 
            1
        );
        qtek.math.Quaternion.rotateX(node.rotation, node.rotation, rand() * Math.PI * 2);
        qtek.math.Quaternion.rotateZ(node.rotation, node.rotation, rand() * Math.PI * 2);
    }

    Leaves.prototype.init = function(number) {
        
        this.leaves.length = 0;

        for (var i = 0; i < number; i++) {
            var material = new qtek.Material({
                shader: shader
            });
            material.set('color', [0.7, rand(), rand()]);

            var mesh = new qtek.Mesh({
                geometry: this.planeGeo,
                material: material,
                culling: false
            });

            this._resetLeaaf(mesh);

            this.leaves.push(mesh);
        }

        return this.leaves;
    }

    Leaves.prototype.update = function(deltaTime) {

        for (var i = 0; i < this.leaves.length; i++) {
            var leaf = this.leaves[i];
            qtek.math.Quaternion.rotateY(leaf.rotation, leaf.rotation, deltaTime / 1000);
            leaf.position._array[1] -= deltaTime / 1000;
            leaf.life -= deltaTime;
            if (leaf.life < 0) {
            // if (leaf.z < -20) {
                this._resetLeaaf(leaf);
            // }
            }
        }
    }

    Leaves.prototype.dispose = function() {
        
    }

    return Leaves;
})