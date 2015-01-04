define(function(require) {

    var Meta = require('qpf/meta/Meta');
    var ko = require("knockout");

    var Draggable = require('qpf/helper/Draggable');

    var KeyFrameHandle = Meta.derive(function() {
        return {
            time: ko.observable(0).extend({
                clamp: {
                    min: 0
                },
                numeric: 0
            })
        }
    }, {
        type: 'KEYFRAMEHANDLE',

        css: 'keyframe-handle',

        template: '<div class="qpf-keyframe-handle-handle" data-bind="html: time"></div>\
                  <div class="qpf-keyframe-handle-line"></div>',

        initialize: function() {
            var parent = this.parent;
            var self = this;

            this.time.subscribe(function(val) {
                self.$el.css({
                    // 20ms per pixel
                    left: Math.round(val / 20) + 'px'
                })
            });

            this.draggable = new Draggable({
                axis: "x"
            });

            var item = this.draggable.add(this.$el);
            item.on('drag', this._dragHandler, this)
        },

        _dragHandler: function() {
            this.time(parseInt(this.$el.css('left')) * 20);
        },

        onResize: function() {
            if (this.parent) {
                this.height(this.parent.height());
            }
        }
    });

    Meta.provideBinding('keyframehandle', KeyFrameHandle);

    return KeyFrameHandle;
});