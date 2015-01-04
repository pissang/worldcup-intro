define(function(require) {

    var Meta = require('qpf/meta/Meta');
    var ko = require("knockout");

    var KeyFrame = Meta.derive(function() {
        return {
            time: ko.observable(0)
        }
    }, {
        type: 'KEYFRAME',

        css: 'keyframe',

        template: '',

        initialize: function() {
            var parent = this.parent;
            var self = this;
            this.time.subscribe(function(val) {
                self.$el.css({
                    // 20ms per pixel
                    left: Math.round(val / 20) + 'px'
                })
            })
        },

        onResize: function() {
            if (this.parent) {
                this.height(this.parent.height());
            }
        }
    });

    return KeyFrame;
});