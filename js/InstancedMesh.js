define(function(require) {

    var qtek = require('qtek');

    var Renderable = qtek.Renderable;
    var StaticGeometry = qtek.StaticGeometry;
    var Shader = qtek.Shader;
    var Material = qtek.Material;
    var meshUtil = qtek.util.mesh;
    var Matrix4 = qtek.math.Matrix4;
    var Matrix3 = qtek.math.Matrix3;

    Shader['import'](require('text!./instanced_standard.essl'));

    var shaderCache = {};

    var normalMatrix = new Matrix3();
    var tmpMat4 = new Matrix4();

    var InstancedMesh = Renderable.derive({

        _instancedMeshMatrices : null,

        _normalInView: false,

        _camera: null

    }, function() {

        this._meshes = [];

        if (!this.material) {
            this.material = new Material();
        }
    }, {

        addMesh: function(mesh) {
            this._meshes.push(mesh);
        },
        
        removeMesh: function(mesh) {
            this._meshes.splice(this._meshes.indexOf(mesh), 1);
        },

        instancing: function(options) {
            options = options || {};
            var len = this._meshes.length;
            if (options.normalInView && options.camera) {
                this._normalInView = true;

                this._camera = options.camera;
            }
            if (!shaderCache[len]) {
                shaderCache[len] = new Shader({
                    vertex: options.vertexShader || Shader.source('instanced_standard.vertex'),
                    fragment: options.fragmentShader || Shader.source('instanced_standard.fragment')
                });
                shaderCache[len].define('vertex', 'INSTANCING_NUMBER', len);
            }
            var shader = shaderCache[len];
            if (this.material.shader !== shader) {
                this.material.attachShader(shader);
            }
            var sampleGeometry = this._meshes[0].geometry;
            for (var i = 0; i < this._meshes.length; i++) {
                if (this._meshes[i].geometry !== sampleGeometry) {
                    throw new Error('Geometry of instanced meshes must be the same');
                }
            }

            for (var i = 0; i < this._meshes.length; i++) {
                var mesh = this._meshes[i];
                var geo = mesh.geometry;
                var nVertex = geo.getVertexNumber();

                // Make sure the vertices will not be affected by the transform when merging
                qtek.math.Matrix4.identity(mesh.localTransform);

                // Make mesh not renderable
                mesh.visible = false;
            }

            var result = meshUtil.merge(this._meshes, false);

            this.geometry = result.geometry;

            var nMeshVertex = sampleGeometry.getVertexNumber();
            var nVertex = nMeshVertex * this._meshes.length;

            this.geometry.createAttribute('meshIndex', 'float', 1);
            this.geometry.attributes.meshIndex.init(nVertex);

            var off = 0;
            for (var i = 0; i < this._meshes.length; i++) {
                for (var k = 0; k < nMeshVertex; k++) {
                    this.geometry.attributes.meshIndex.value[off++] = i;
                }
            }
        },

        render: function(gl, globalMaterial) {
            var len = this._meshes.length;
            var uniforms = this.material.uniforms;
            var meshMatrix = uniforms.meshMatrix.value;
            var meshNormalMatrix = uniforms.meshNormalMatrix.value;
            var meshColor = uniforms.meshColor.value;
            if (!meshMatrix || meshMatrix.length !== len * 16) {
                meshMatrix = uniforms.meshMatrix.value = new Float32Array(len * 16);
            }
            if (!meshNormalMatrix || meshNormalMatrix.length !== len * 9) {
                meshNormalMatrix = uniforms.meshNormalMatrix.value = new Float32Array(len * 9);
            }
            if (!meshColor || meshColor.length !== len * 3) {
                meshColor = uniforms.meshColor.value = new Float32Array(len * 3);
            }

            for (var i = 0; i < len; i++) {
                var mesh = this._meshes[i];
                if (this._normalInView) {
                    Matrix4.multiply(tmpMat4, this._camera.viewMatrix, mesh.worldTransform);
                    Matrix4.invert(tmpMat4, tmpMat4);
                } else {
                    Matrix4.invert(tmpMat4, mesh.worldTransform);
                }
                Matrix4.transpose(tmpMat4, tmpMat4);
                Matrix3.fromMat4(normalMatrix, tmpMat4);
                for (var j = 0; j < 16; j++) {
                    meshMatrix[i * 16 + j] = mesh.worldTransform._array[j];
                }
                for (var j = 0; j < 9; j++) {
                    meshNormalMatrix[i * 9 + j] = normalMatrix._array[j];
                }
                for (var j = 0; j < 3; j++) {
                    meshColor[i * 3 + j] = mesh.material.uniforms.color.value[j];
                }
            }

            Renderable.prototype.render.call(this, gl, globalMaterial);
        }
    });

    return InstancedMesh;
});