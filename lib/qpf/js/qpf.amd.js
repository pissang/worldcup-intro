
define('qpf/core/mixin/derive',['require'],function(require) {



/**
 * derive a sub class from base class
 * @makeDefaultOpt [Object|Function] default option of this sub class, 
                        method of the sub can use this.xxx to access this option
 * @initialize [Function](optional) initialize after the sub class is instantiated
 * @proto [Object](optional) prototype methods/property of the sub class
 *
 * @export{object}
 */
function derive(makeDefaultOpt, initialize/*optional*/, proto/*optional*/) {

    if (typeof initialize == "object") {
        proto = initialize;
        initialize = null;
    }

    var _super = this;

    var propList;
    if (!(makeDefaultOpt instanceof Function)) {
        // Optimize the property iterate if it have been fixed
        propList = [];
        for (var propName in makeDefaultOpt) {
            if (makeDefaultOpt.hasOwnProperty(propName)) {
                propList.push(propName);
            }
        }
    }

    var sub = function(options) {

        // call super constructor
        _super.apply(this, arguments);

        if (makeDefaultOpt instanceof Function) {
            // call defaultOpt generate function each time
            // if it is a function, So we can make sure each 
            // property in the object is not shared by mutiple instances
            extend(this, makeDefaultOpt.call(this));
        } else {
            extendWithPropList(this, makeDefaultOpt, propList);
        }
        
        if (this.constructor === sub) {
            // PENDING
            if (options) {
                extend(this, options);
            }

            // Initialize function will be called in the order of inherit
            var base = sub;
            var initializers = sub.__initializers__;
            for (var i = 0; i < initializers.length; i++) {
                initializers[i].apply(this, arguments);
            }
        }
    };
    // save super constructor
    sub.__super__ = _super;
    // initialize function will be called after all the super constructor is called
    if (!_super.__initializers__) {
        sub.__initializers__ = [];
    } else {
        sub.__initializers__ = _super.__initializers__.slice();
    }
    if (initialize) {
        sub.__initializers__.push(initialize);
    }

    var Ctor = function() {};
    Ctor.prototype = _super.prototype;
    sub.prototype = new Ctor();
    sub.prototype.constructor = sub;
    extend(sub.prototype, proto);
    
    // extend the derive method as a static method;
    sub.derive = _super.derive;

    return sub;
}

function extend(target, source) {
    if (!source) {
        return;
    }
    for (var name in source) {
        if (source.hasOwnProperty(name)) {
            target[name] = source[name];
        }
    }
}

function extendWithPropList(target, source, propList) {
    for (var i = 0; i < propList.length; i++) {
        var propName = propList[i];
        target[propName] = source[propName];
    }   
}

return {
    derive : derive
}

});
define('qpf/core/mixin/notifier',[],function() {

    function Handler(action, context) {
        this.action = action;
        this.context = context;
    }

    return{
        trigger : function(name) {
            if (! this.hasOwnProperty('__handlers__')) {
                return;
            }
            if (!this.__handlers__.hasOwnProperty(name)) {
                return;
            }

            var hdls = this.__handlers__[name];
            var l = hdls.length, i = -1, args = arguments;
            // Optimize from backbone
            switch (args.length) {
                case 1: 
                    while (++i < l)
                        hdls[i].action.call(hdls[i].context);
                    return;
                case 2:
                    while (++i < l)
                        hdls[i].action.call(hdls[i].context, args[1]);
                    return;
                case 3:
                    while (++i < l)
                        hdls[i].action.call(hdls[i].context, args[1], args[2]);
                    return;
                case 4:
                    while (++i < l)
                        hdls[i].action.call(hdls[i].context, args[1], args[2], args[3]);
                    return;
                case 5:
                    while (++i < l)
                        hdls[i].action.call(hdls[i].context, args[1], args[2], args[3], args[4]);
                    return;
                default:
                    while (++i < l)
                        hdls[i].action.apply(hdls[i].context, Array.prototype.slice.call(args, 1));
                    return;
            }
        },
        
        on : function(name, action, context/*optional*/) {
            if (!name || !action) {
                return;
            }
            var handlers = this.__handlers__ || (this.__handlers__={});
            if (! handlers[name]) {
                handlers[name] = [];
            } else {
                if (this.has(name, action)) {
                    return;
                }   
            }
            var handler = new Handler(action, context || this);
            handlers[name].push(handler);

            return this;
        },

        once : function(name, action, context/*optional*/) {
            if (!name || !action) {
                return;
            }
            var self = this;
            function wrapper() {
                self.off(name, wrapper);
                action.apply(this, arguments);
            }
            return this.on(name, wrapper, context);
        },

        // Alias of on('before')
        before : function(name, action, context/*optional*/) {
            if (!name || !action) {
                return;
            }
            name = 'before' + name;
            return this.on(name, action, context);
        },

        // Alias of on('after')
        after : function(name, action, context/*optional*/) {
            if (!name || !action) {
                return;
            }
            name = 'after' + name;
            return this.on(name, action, context);
        },

        // Alias of once('success')
        success : function(action, context/*optional*/) {
            return this.once('success', action, context);
        },

        // Alias of once('error')
        error : function(action, context/*optional*/) {
            return this.once('error', action, context);
        },

        off : function(name, action/*optional*/) {
            
            var handlers = this.__handlers__ || (this.__handlers__={});

            if (!action) {
                handlers[name] = [];
                return;
            }
            if (handlers[name]) {
                var hdls = handlers[name];
                // Splice is evil!!
                var retains = [];
                for (var i = 0; i < hdls.length; i++) {
                    if (action && hdls[i].action !== action) {
                        retains.push(hdls[i]);
                    }
                }
                handlers[name] = retains;
            } 

            return this;
        },

        has : function(name, action) {
            var handlers = this.__handlers__;

            if (! handlers ||
                ! handlers[name]) {
                return false;
            }
            var hdls = handlers[name];
            for (var i = 0; i < hdls.length; i++) {
                if (hdls[i].action === action) {
                    return true;
                }
            }
        }
    }
    
});
define('qpf/core/Clazz',['require','./mixin/derive','./mixin/notifier','_'],function(require){

    var deriveMixin = require("./mixin/derive");
    var notifierMixin = require("./mixin/notifier");
    var _ = require("_");

    var Clazz = new Function();
    _.extend(Clazz, deriveMixin);
    _.extend(Clazz.prototype, notifierMixin);

    return Clazz;
});
/**
 * Base class of all components
 * it also provides some util methods like
 */
define('qpf/Base',['require','./core/Clazz','./core/mixin/notifier','knockout','$','_'],function(require) {

    

    var Clazz = require("./core/Clazz");
    var notifier = require("./core/mixin/notifier");
    var ko = require("knockout");
    var $ = require("$");
    var _ = require("_");

    var repository = {};    //repository to store all the component instance

    var Base = Clazz.derive(function() {
        return {    // Public properties
            // Name of component, will be used in the query of the component
            name : "",
            // Tag of wrapper element
            tag : "div",
            // Attribute of the wrapper element
            attr : {},
            // Jquery element as a wrapper
            // It will be created in the constructor
            $el : null,
            // Attribute will be applied to self
            // WARNING: It will be only used in the constructor
            // So there is no need to re-assign a new viewModel when created an instance
            // if property in the attribute is a observable
            // it will be binded to the property in viewModel
            attributes : {},
            
            parent : null,
            // ui skin
            skin : "",
            // Class prefix
            classPrefix : "qpf-ui-",
            // Skin prefix
            skinPrefix : "qpf-skin-",

            id : ko.observable(""),
            width : ko.observable(),
            class : ko.observable(),
            height : ko.observable(),
            visible : ko.observable(true),
            disable : ko.observable(false),
            style : ko.observable(""),

            // If the temporary is set true,
            // It will not be stored in the repository and 
            // will be destroyed when there are no reference any more
            // Maybe a ugly solution to prevent memory leak 
            temporary : false,
            // events list inited at first time
            events : {}
        }
    }, function() { //constructor

        this.__GUID__ = genGUID();
        // add to repository
        if (! this.temporary) {
            repository[this.__GUID__] = this;
        }

        if (!this.$el) {
            this.$el = $(document.createElement(this.tag));
        }
        this.$el[0].setAttribute("data-qpf-guid", this.__GUID__);

        this.$el.attr(this.attr);
        if (this.skin) {
            this.$el.addClass(this._withPrefix(this.skin, this.skinPrefix));
        }

        if (this.css) {
            _.each(_.union(this.css), function(className) {
                this.$el.addClass(this._withPrefix(className, this.classPrefix));
            }, this)
        }
        this.width.subscribe(function(newValue) {
            this.$el.width(newValue);
            this.onResize();
        }, this);
        this.height.subscribe(function(newValue) {
            this.$el.height(newValue);
            this.onResize();
        }, this);
        this.disable.subscribe(function(newValue) {
            this.$el[newValue?"addClass":"removeClass"]("qpf-disable");
        }, this);
        this.id.subscribe(function(newValue) {
            this.$el.attr("id", newValue);
        }, this);
        var prevClass = this.class();
        this.class.subscribe(function(newValue) {
            if (prevClass) {
                this.$el.removeClass(prevClass);
            }
            this.$el.addClass(newValue);
            prevClass = newValue;
        }, this);
        this.visible.subscribe(function(newValue) {
            newValue ? this.$el.show() : this.$el.hide();
        }, this);
        this.style.subscribe(function(newValue) {
            var valueSv = newValue;
            var styleRegex = /(\S*?)\s*:\s*(.*)/g;
            var tmp = newValue.split(";");
            tmp = _.map(tmp, function(item) {
                return item.replace(/(^\s*)|(\s*$)/g, "") //trim
                            .replace(styleRegex, '"$1":"$2"');
            });
            tmp = _.filter(tmp, function(item) {return item;});
            // preprocess the style string
            newValue = "{" + tmp.join(",") + "}";
            try{
                var obj = ko.utils.parseJson(newValue);
                this.$el.css(obj);
            }catch(e) {
                throw new Error("Syntax Error of style: "+ valueSv);
            }
        }, this);

        // register the events before initialize
        for(var name in this.events) {
            var handler = this.events[name];
            if (typeof(handler) == "function") {
                this.on(name, handler);
            }
        }

        // apply attribute 
        this._mappingAttributes(this.attributes);

        this.initialize();
        this.trigger("initialize");
        // Here we removed auto rendering at constructor
        // to support deferred rendering after the $el is attached
        // to the document
        // this.render();

    }, {// Prototype
        // Type of component. The className of the wrapper element is
        // depend on the type
        type : "BASE",
        // Template of the component, will be applyed binging with viewModel
        template : "",
        // Declare the events that will be provided 
        // Developers can use on method to subscribe these events
        // It is used in the binding handlers to judge which parameter
        // passed in is events
        eventsProvided : ["click", "dblclick", "mousedown", "mouseup", "mousemove", "resize",
                            "initialize", "beforerender", "render", "dispose"],

        // Will be called after the component first created
        initialize : function() {},
        // set the attribute in the modelView
        set : function(key, value) {
            if (typeof(key) == "string") {
                var source = {};
                source[key] = value;
            } else {
                source = key;
            };
            this._mappingAttributes(source, true);
        },
        // Call to refresh the component
        // Will trigger beforeRender and afterRender hooks
        // beforeRender and afterRender hooks is mainly provide for
        // the subclasses
        render : function() {
            this.beforeRender && this.beforeRender();
            this.trigger("beforerender");

            this.doRender();
            this.afterRender && this.afterRender();

            this.trigger("render");
            // trigger the resize events
            this.onResize();
        },
        // Default render method
        doRender : function() {
            this.$el.children().each(function() {
                Base.disposeDom(this);
            })

            this.$el.html(this.template);
            ko.applyBindings(this, this.$el[0]);
        },
        // Dispose the component instance
        dispose : function() {
            if (this.$el) {
                // remove the dom element
                this.$el.remove()
            }
            // remove from repository
            repository[this.__GUID__] = null;

            this.trigger("dispose");
        },
        resize : function(width, height) {
            this.width(+width);
            this.height(+height);
        },
        onResize : function() {
            this.trigger('resize');
        },
        _withPrefix : function(className, prefix) {
            if (className.indexOf(prefix) != 0) {
                return prefix + className;
            }
        },
        _withoutPrefix : function(className, prefix) {
            if (className.indexOf(prefix) == 0) {
                return className.substr(prefix.length);
            }
        },
        _mappingAttributes : function(attributes, onlyUpdate) {
            for(var name in attributes) {
                var attr = attributes[name];
                var propInVM = this[name];
                // create new attribute when property is not existed, even if it will not be used
                if (typeof(propInVM) === "undefined") {
                    var value = ko.utils.unwrapObservable(attr);
                    // is observableArray or plain array
                    if ((ko.isObservable(attr) && attr.push) || attr instanceof Array) {
                        this[name] = ko.observableArray(value);
                    } else {
                        this[name] = ko.observable(value);
                    }
                    propInVM = this[name];
                }
                else if (ko.isObservable(propInVM)) {
                    propInVM(ko.utils.unwrapObservable(attr));
                } else {
                    this[name] = ko.utils.unwrapObservable(attr);
                }
                if (! onlyUpdate) {
                    // Two-way data binding if the attribute is an observable
                    if (ko.isObservable(attr)) {
                        bridge(propInVM, attr);
                    }
                }
            }   
        }
    })

    // register proxy events of dom
    var proxyEvents = ["click", "mousedown", "mouseup", "mousemove"];
    Base.prototype.on = function(eventName) {
        // lazy register events
        if (proxyEvents.indexOf(eventName) >= 0) {
            this.$el.unbind(eventName, proxyHandler)
            .bind(eventName, {context : this}, proxyHandler);
        }
        notifier.on.apply(this, arguments);
    }
    function proxyHandler(e) {
        var context = e.data.context;
        var eventType = e.type;

        context.trigger(eventType);
    }


    // get a unique component by guid
    Base.get = function(guid) {
        return repository[guid];
    }
    Base.getByDom = function(domNode) {
        var guid = domNode.getAttribute("data-qpf-guid");
        return Base.get(guid);
    }

    // dispose all the components attached in the domNode and
    // its children(if recursive is set true)
    Base.disposeDom = function(domNode, recursive) {

        if (typeof(recursive) == "undefined") {
            recursive = true;
        }

        function dispose(node) {
            var guid = node.getAttribute("data-qpf-guid");
            var component = Base.get(guid);
            if (component) {
                // do not recursive traverse the children of component
                // element
                // hand over dispose of sub element task to the components
                // it self
                component.dispose();
            } else {
                if (recursive) {
                    for(var i = 0; i < node.childNodes.length; i++) {
                        var child = node.childNodes[i];
                        if (child.nodeType == 1) {
                            dispose(child);
                        }
                    }
                }
            }
        }

        dispose(domNode);
    }

    // util function of generate a unique id
    var genGUID = (function() {
        var id = 0;
        return function() {
            return id++;
        }
    })();

    //----------------------------
    // knockout extenders
    ko.extenders.numeric = function(target, precision) {

        var fixer = ko.computed({
            read : target,
            write : function(newValue) { 
                if (newValue === "") {
                    target("");
                    return;
                } else {
                    var val = parseFloat(newValue);
                }
                val = isNaN(val) ? 0 : val;
                var precisionValue = parseFloat(ko.utils.unwrapObservable(precision));
                if (! isNaN(precisionValue)) {
                    var multiplier = Math.pow(10, precisionValue);
                    val = Math.round(val * multiplier) / multiplier;
                }
                target(val);
            }
        });

        fixer(target());

        return fixer;
    };

    ko.extenders.clamp = function(target, options) {
        var min = options.min;
        var max = options.max;

        var clamper = ko.computed({
            read : target,
            write : function(value) {
                var minValue = parseFloat(ko.utils.unwrapObservable(min)),
                    maxValue = parseFloat(ko.utils.unwrapObservable(max));
                if (! isNaN(minValue)) {
                    value = Math.max(minValue, value);
                }
                if (! isNaN(maxValue)) {
                    value = Math.min(maxValue, value);
                }
                target(value);
            }
        })

        clamper(target());
        return clamper;
    }

    //-------------------------------------------
    // Handle bingings in the knockout template

    var _bindings = {};
    Base.provideBinding = function(name, Component) {
        _bindings[name] = Component;
    }

    Base.create = function(name, config) {
        var Constructor = _bindings[name];
        if (Constructor) {
            return new Constructor(config);
        }
    }

    // provide bindings to knockout
    ko.bindingHandlers["qpf"] = {

        createComponent : function(element, valueAccessor) {
            // dispose the previous component host on the element
            var prevComponent = Base.getByDom(element);
            if (prevComponent) {
                prevComponent.dispose();
            }
            var component = createComponentFromDataBinding(element, valueAccessor);
            return component;
        },

        init : function(element, valueAccessor) {

            var component = ko.bindingHandlers["qpf"].createComponent(element, valueAccessor);

            component.render();
            // not apply bindings to the descendant doms in the UI component
            return { 'controlsDescendantBindings': true };
        },

        update : function(element, valueAccessor) {}
    }

    // append the element of view in the binding
    ko.bindingHandlers["qpf_view"] = {
        init : function(element, valueAccessor) {
            var value = valueAccessor();

            var subView = ko.utils.unwrapObservable(value);
            if (subView && subView.$el) {
                Base.disposeDom(element);
                element.parentNode.replaceChild(subView.$el[0], element);
            }
            // PENDING
            // handle disposal (if KO removes by the template binding)
            // ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
            //     subView.dispose();
            // });

            return { 'controlsDescendantBindings': true };
        },

        update : function(element, valueAccessor) {
        }
    }

    //-----------------------------------
    // Provide plugins to jquery
    $.fn.qpf = function(op, viewModel) {
        op = op || "get";
        if (op === "get") {
            var result = [];
            this.each(function() {
                var item = Base.getByDom(this);
                if (item) {
                    result.push(item);
                }
            })
            return result;
        } else if (op === "init") {
            this.each(function() {
                ko.applyBindings(viewModel, this);
            });
            return this.qpf("get");
        } else if (op === "dispose") {
            this.each(function() {
                Base.disposeDom(this);
            })
        }
    }

    //------------------------------------
    // Util functions
    var unwrap = ko.utils.unwrapObservable;

    function createComponentFromDataBinding(element, valueAccessor) {

        var value = valueAccessor();
        
        var options = unwrap(value) || {};
        var type = unwrap(options.type);

        if (type) {
            var Constructor = _bindings[type];

            if (Constructor) {
                var component = createComponentFromJSON(options, Constructor)
                if (component) {
                    element.innerHTML = "";
                    element.appendChild(component.$el[0]);
                    
                    $(element).addClass("qpf-wrapper");
                }
                // save the guid in the element data attribute
                element.setAttribute("data-qpf-guid", component.__GUID__);
            } else {
                throw new Error("Unkown UI type, " + type);
            }
        } else {
            throw new Error("UI type is needed");
        }
        return component;
    }

    function createComponentFromJSON(options, Constructor) {

        var type = unwrap(options.type);
        var name = unwrap(options.name);
        var attr = _.omit(options, "type", "name");

        var events = {};

        // Find which property is event
        _.each(attr, function(value, key) {
            if (key.indexOf("on") == 0 &&
                Constructor.prototype.eventsProvided.indexOf(key.substr("on".length)) >= 0 &&
                typeof(value) == "function") {
                delete attr[key];
                events[key.substr("on".length)] = value;
            }
        })

        var component = new Constructor({
            name : name || "",
            attributes : attr,
            events : events
        });

        return component;
    }

    // build a bridge of twe observables
    // and update the value from source to target
    // at first time
    function bridge(target, source) {
        
        target(source());

        // Save the previous value with clone method in underscore
        // In case the notification is triggered by push methods of
        // Observable Array and the commonValue instance is same with new value
        // instance
        // Reference : `set` method in backbone
        var commonValue = _.clone(target());
        target.subscribe(function(newValue) {
            // Knockout will always suppose the value is mutated each time it is written
            // the value which is not primitive type(like array)
            // So here will cause a recurse trigger if the value is not a primitive type
            // We use underscore deep compare function to evaluate if the value is changed
            // PENDING : use shallow compare function?
            try{
                if (! _.isEqual(commonValue, newValue)) {
                    commonValue = _.clone(newValue);
                    source(newValue);
                }
            }catch(e) {
                // Normally when source is computed value
                // and it don't have a write function
                console.error(e.toString());
            }
        })
        source.subscribe(function(newValue) {
            try{
                if (! _.isEqual(commonValue, newValue)) {
                    commonValue = _.clone(newValue);
                    target(newValue);
                }
            }catch(e) {
                console.error(e.toString());
            }
        })
    }

    // export the interface
    return Base;

});
/**
 * mixin to provide draggable interaction
 * support multiple selection
 *
 * @property    helper
 * @property    axis "x" | "y"
 * @property    container
 * @method      add(target[, handle])
 * @method      remove(target)
 **/

define('qpf/helper/Draggable',['require','../core/Clazz','knockout','$','_'],function(require) {

    

    var Clazz = require('../core/Clazz');
    var ko = require("knockout");
    var $ = require("$");
    var _ = require("_");

    var DraggableItem = Clazz.derive(function() {
        return {

            id : 0,

            target : null,

            handle : null,

            margins : {},

            // original position of the target relative to 
            // its offsetParent, here we get it with jQuery.position method
            originPosition : {},

            // offset of the offsetParent, which is get with jQuery.offset
            // method
            offsetParentOffset : {},
            // cache the size of the draggable target
            width : 0,
            height : 0,
            // save the original css position of dragging target
            // to be restored when stop the drag
            positionType : "",
            //
            // data to be transferred
            data : {},

            // instance of [Draggable]
            host : null
        };
    }, {
        
        setData : function(data) {

        },

        remove : function() {
            this.host.remove(this.target);
        }
    });

    var Draggable = Clazz.derive(function() {
        return {

            items : {}, 

            axis : null,

            // the container where draggable item is limited
            // can be an array of boundingbox or HTMLDomElement or jquery selector
            container : null,

            helper : null,

            // If update dom position is set false, it is only a proxy
            // Like handles in Resizable
            updateDomPosition : true,

            //private properties
            // boundingbox of container compatible with getBoundingClientRect method
            _boundingBox : null,

            _mouseStart : {},
            _$helper : null
        }
    }, {

        add : function(elem, handle) {
            
            var id = genGUID(),
                $elem = $(elem);
            if (handle) {
                var $handle = $(handle);
            }

            $elem.attr("data-qpf-draggable", id)
                .addClass("qpf-draggable");
            
            (handle ? $(handle) : $elem)
                .unbind("mousedown", this._mouseDown)
                .bind("mousedown", {context:this}, this._mouseDown);

            var newItem = new DraggableItem({
                id : id,
                target : elem,
                host : this,
                handle : handle
            })
            this.items[id] = newItem;

            return newItem;
        },

        remove : function(elem) {

            if (elem instanceof DraggableItem) {
                var item = elem,
                    $elem = $(item.elem),
                    id = item.id;
            } else {
                var $elem = $(elem),
                    id = $elem.attr("data-qpf-draggable");
                
                if (id ) {
                    var item = this.items[id];
                }
            }   
            delete this.items[id];

            
            $elem.removeAttr("data-qpf-draggable")
                .removeClass("qpf-draggable");
            // remove the events binded to it
            (item.handle ? $(item.handle) : $elem)
                .unbind("mousedown", this._mouseDown);
        },

        clear : function() {

            _.each(this.items, function(item) {
                this.remove(item.target);
            }, this);
        },

        _save : function() {

            _.each(this.items, function(item) {

                var $elem = $(item.target);
                var $offsetParent = $elem.offsetParent();
                var position = $elem.position();
                var offsetParentOffset = $offsetParent.offset();
                var margin = {
                    left: parseInt($elem.css("marginLeft")) || 0,
                    top: parseInt($elem.css("marginTop")) || 0
                };

                item.margin = margin;
                // fix the position with margin
                item.originPosition = {
                    left: position.left - margin.left,
                    top: position.top - margin.top
                },
                item.offsetParentOffset = offsetParentOffset;
                // cache the size of the dom element
                item.width = $elem.width(),
                item.height = $elem.height(),
                // save the position info for restoring after drop
                item.positionType = $elem.css("position");

            }, this);

        },

        _restore : function(restorePosition) {

            _.each(this.items, function(item) {

                var $elem = $(item.target);
                var position = $elem.offset();
                $elem.css("position", item.positionType);

                if (restorePosition) {
                    $elem.offset({
                        left: item.originPosition.left + item.margin.left,
                        top: item.originPosition.top + item.margin.top
                    });
                } else {
                    $elem.offset(position);
                }
            }, this);
        },

        _mouseDown : function(e) {
            
            if (e.which !== 1) {
                return;
            }

            var self = e.data.context;

            if (self.updateDomPosition) {
                self._save();
            }

            self._triggerProxy("dragstart", e);

            if (! self.helper) {

                _.each(self.items, function(item) {
                    
                    var $elem = $(item.target);

                    $elem.addClass("qpf-draggable-dragging");

                    if (self.updateDomPosition) {
                        $elem.css({
                            position: "absolute",
                            left: (item.originPosition.left)+"px",
                            top: (item.originPosition.top)+"px"
                        });   
                    }

                }, self);

                if (self.container) {
                    self._boundingBox = self._computeBoundingBox(self.container);
                } else {
                    self._boundingBox = null;
                }

            } else {

                self._$helper = $(self.helper);
                document.body.appendChild(self._$helper[0]);
                self._$helper.css({
                    left: e.pageX,
                    top: e.pageY
                });
            }

            $(document.body)
                .unbind("mousemove", self._mouseMove)
                .bind("mousemove", {context:self}, self._mouseMove)
                .unbind("mouseout", self._mouseOut)
                .bind("mouseout", {context:self}, self._mouseOut)
                .unbind('mouseup', self._mouseUp)
                .bind("mouseup", {context:self}, self._mouseUp);

            self._mouseStart = {
                x : e.pageX,
                y : e.pageY
            };

        },

        _computeBoundingBox : function(container) {

            if (_.isArray(container)) {

                return {
                    left : container[0][0],
                    top : container[0][1],
                    right : container[1][0],
                    bottom : container[1][1]
                }

            } else if (container.left && 
                        container.right &&
                        container.top &&
                        container.bottom) {

                return container;
            } else {
                // using getBoundingClientRect to get the bounding box
                // of HTMLDomElement
                try {
                    var $container = $(container);
                    var offset = $container.offset();
                    var bb = {
                        left : offset.left + parseInt($container.css("padding-left")) || 0,
                        top : offset.top + parseInt($container.css("padding-top")) || 0,
                        right : offset.left + $container.width() - parseInt($container.css("padding-right")) || 0,
                        bottom : offset.top + $container.height() - parseInt($container.css("padding-bottom")) || 0
                    };
                    
                    return bb;
                } catch (e) {
                    console.error("Invalid container type");
                }
            }

        },

        _mouseMove : function(e) {

            var self = e.data.context;

            if (!self.updateDomPosition) {
                self._triggerProxy("drag", e);
                return;
            }

            var offset = {
                x : e.pageX - self._mouseStart.x,
                y : e.pageY - self._mouseStart.y
            }

            if (! self._$helper) {

                _.each(self.items, function(item) {
                    // calculate the offset position to the document
                    var left = item.originPosition.left + item.offsetParentOffset.left + offset.x,
                        top = item.originPosition.top + item.offsetParentOffset.top + offset.y;
                    // constrained in the area of container
                    if (self._boundingBox) {
                        var bb = self._boundingBox;
                        left = left > bb.left ? 
                                        (left+item.width < bb.right ? left : bb.right-item.width)
                                         : bb.left;
                        top = top > bb.top ? 
                                    (top+item.height < bb.bottom ? top : bb.bottom-item.height)
                                    : bb.top;
                    }

                    var axis = ko.utils.unwrapObservable(self.axis);
                    if (!axis || axis.toLowerCase() !== "y") {
                        $(item.target).css("left", left - item.offsetParentOffset.left + "px");
                    }
                    if (!axis || axis.toLowerCase() !== "x") {
                        $(item.target).css("top", top - item.offsetParentOffset.top + "px");
                    }

                }, self);


            } else {

                self._$helper.css({
                    "left" : e.pageX,
                    "top" : e.pageY
                })
            };

            self._triggerProxy("drag", e);
        },

        _mouseUp : function(e) {

            var self = e.data.context;

            $(document.body).unbind("mousemove", self._mouseMove)
                .unbind("mouseout", self._mouseOut)
                .unbind("mouseup", self._mouseUp);

            if (self._$helper) {

                self._$helper.remove();
            } else {

                _.each(self.items, function(item) {

                    var $elem = $(item.target);

                    $elem.removeClass("qpf-draggable-dragging");

                }, self);
            }

            if (self.updateDomPosition) {
                self._restore();
            }

            self._triggerProxy("dragend", e);
        },

        _mouseOut : function(e) {
            // PENDING
            // this._mouseUp.call(this, e);
        },

        _triggerProxy : function() {
            var args = arguments;
            for (var name in this.items) {
                this.items[name].trigger.apply(this.items[name], args);
            }

            this.trigger.apply(this, args);
        }

    });


    var genGUID = (function() {
        var id = 1;
        return function() {
            return id++;
        }
    }) ();

    Draggable.applyTo = function(target, options) {
        target.draggable = new Draggable(options);        
    }
    return Draggable;

});
define('qpf/helper/Resizable',['require','../core/Clazz','./Draggable','knockout','_','$'],function(require) {

    

    var Clazz = require('../core/Clazz');
    var Draggable = require('./Draggable');
    var ko = require("knockout");
    var _ = require("_");
    var $ = require("$");

    var Resizable = Clazz.derive(function() {
        return {
            
            container : null,

            $container : null,
            
            maxWidth : Infinity,
            
            minWidth : 0,
            
            maxHeight : Infinity,
            
            minHeight : 0,

            handles : 'r,b,rb',

            handleSize : 10,

            _x0 : 0,
            _y0 : 0,

            _isContainerAbsolute : false
        }
    }, {

        enable : function() {
            this.$container = $(this.container);
            this._addHandlers();

            if (!this._isContainerAbsolute) {
                this.$container.css('position', 'relative');
            }
        },

        disable : function() {
            this.$container.children('.qpf-resizable-handler').remove();
        },

        _addHandlers : function() {
            var handles = this.handles.split(/\s*,\s*/);
            _.each(handles, function(handle) {
                switch(handle) {
                    case 'r':
                        this._addRightHandler();
                        break;
                    case 'b':
                        this._addBottomHandler();
                        break;
                    case 'l':
                        this._addLeftHandler();
                        break;
                    case 't':
                        this._addTopHandler();
                        break;
                    case 'rb':

                        break;
                }
            }, this);
        },

        _addRightHandler : function() {
            var $handler = this._createHandler('right');
            $handler.css({
                right: '0px',
                top: '0px',
                bottom: '0px',
                width: this.handleSize + 'px'
            });
            var draggable = new Draggable();
            draggable.updateDomPosition = false;
            draggable.add($handler);
            draggable.on('dragstart', this._onResizeStart, this);
            draggable.on('drag', this._onRightResize, this);
        },

        _addTopHandler : function() {
            var $handler = this._createHandler('top');
            $handler.css({
                left: '0px',
                top: '0px',
                right: '0px',
                height: this.handleSize + 'px'
            });
            var draggable = new Draggable();
            draggable.updateDomPosition = false;
            draggable.add($handler);
            draggable.on('dragstart', this._onResizeStart, this);
            draggable.on('drag', this._onTopResize, this);
        },

        _addLeftHandler : function() {
            var $handler = this._createHandler('left');
            $handler.css({
                left: '0px',
                top: '0px',
                bottom: '0px',
                width: this.handleSize + 'px'
            });
            var draggable = new Draggable();
            draggable.updateDomPosition = false;
            draggable.add($handler);
            draggable.on('dragstart', this._onResizeStart, this);
            draggable.on('drag', this._onLeftResize, this);
        },

        _addBottomHandler : function() {
            var $handler = this._createHandler('bottom');
            $handler.css({
                left: '0px',
                bottom: '0px',
                right: '0px',
                height: this.handleSize + 'px'
            });
            var draggable = new Draggable();
            draggable.updateDomPosition = false;
            draggable.add($handler);
            draggable.on('dragstart', this._onResizeStart, this);
            draggable.on('drag', this._onBottomResize, this);
        },

        _onResizeStart : function(e) {
            this._x0 = e.pageX;
            this._y0 = e.pageY;
        },

        _onTopResize : function(e, width, height, silent) {
            var oy = -(e.pageY - this._y0);

            var width = width || this.$container.width();
            var height = height || this.$container.height();
            var topName = this.$container.css('position') == 'absolute' ?
                                'top' : 'marginTop';

            var top = parseInt(this.$container.css(topName)) || 0;

            if (height + oy > this.maxHeight) {
                oy = this.maxHeight - height;
            } else if (height + oy < this.minHeight) {
                oy = this.minHeight - height;
            }
            this.$container.height(height + oy);
            this.$container.css(topName, (top - oy) + 'px');

            this._y0 = e.pageY;

            if (!silent) {
                this.trigger('resize', {
                    width : width,
                    height : height + oy
                });   
            }
        },

        _onBottomResize : function(e, width, height, silent) {
            var oy = e.pageY - this._y0;

            var width = width || this.$container.width();
            var height = height || this.$container.height();

            if (height + oy > this.maxHeight) {
                oy = this.maxHeight - height;
            } else if (height + oy < this.minHeight) {
                oy = this.minHeight - height;
            }
            this.$container.height(height + oy);

            this._y0 = e.pageY;

            if (!silent) {
                this.trigger('resize', {
                    width : width,
                    height : height + oy
                });
            }
        },

        _onLeftResize : function(e, width, height, silent) {
            var ox = -(e.pageX - this._x0);

            var width = width || this.$container.width();
            var height = height || this.$container.height();

            var leftName = this.$container.css('position') == 'absolute'
                                ? 'left' : 'marginLeft';
            var left = parseInt(this.$container.css(leftName)) || 0;

            if (width + ox > this.maxWidth) {
                ox = this.maxWidth - width;
            } else if (width + ox < this.minWidth) {
                ox = this.minWidth - width;
            }

            this.$container.width(width + ox);
            this.$container.css(leftName, (left - ox) + 'px');

            this._x0 = e.pageX;

            if (!silent) {
                this.trigger('resize', {
                    width : width + ox,
                    height : height
                });
            }
        },

        _onRightResize : function(e, width, height, silent) {
            var ox = e.pageX - this._x0;
            var width = width || this.$container.width();

            if (width + ox > this.maxWidth) {
                ox = this.maxWidth - width;
            } else if (width + ox < this.minWidth) {
                ox = this.minWidth - width;
            }

            this.$container.width(width + ox);

            this._x0 = e.pageX;

            if (!silent) {
                this.trigger('resize', {
                    width : width + ox,
                    height : height
                });
            }
        },

        _onRightBottomResize : function(e) {
            // Avoid width() and height() cause reflow
            var width = this.$container.width();
            var height = this.$container.height();

            this._onRightResize(e, width, height, true);
            this._onBottomResize(e, height, height, true);

            this.trigger('resize', {
                width : width,
                height : height
            })
        },

        _createHandler : function(className) {
            var $handler = $('<div></div>').css("position", "absolute");
            $handler.addClass('qpf-resizable-handler');
            $handler.addClass('qpf-' + className);
            this.$container.append($handler);
            return $handler;
        }
    });

    Resizable.applyTo = function(target, options) {
        target.resizable = new Resizable(options);
        target.resizable.enable();
    }

    return Resizable;
});
/**
 * Base class of all container component
 */
define('qpf/container/Container',['require','../Base','../helper/Resizable','knockout','$','_'],function(require) {

    var Base = require("../Base");
    var Resizable = require('../helper/Resizable');
    var ko = require("knockout");
    var $ = require("$");
    var _ = require("_");

    var Container = Base.derive(function() {
        return {
            children : ko.observableArray(),
            
            resizable : false,

            resizeHandles : 'r,b,rb',

            resizeMinWidth : 0,

            resizeMaxWidth : Infinity,

            resizeMinHeight : 0,

            resizeMaxHeight : Infinity
        }
    }, {

        type : "CONTAINER",

        css : 'container',
        
        template : '<div data-bind="foreach:children" class="qpf-children">\
                        <div data-bind="qpf_view:$data"></div>\
                    </div>',

        initialize : function() {
            var self = this;
            var oldArray = this.children().slice();

            this.children.subscribe(function(newArray) {
                var differences = ko.utils.compareArrays(oldArray, newArray);
                _.each(differences, function(item) {
                    // In case the dispose operation is launched by the child component
                    if (item.status == "added") {
                        item.value.parent = this;
                        item.value.on("dispose", _onItemDispose, item.value);
                    }else if (item.status == "deleted") {
                        item.value.parent = null;
                        item.value.off("dispose", _onItemDispose);
                    }
                }, self);
            });
            function _onItemDispose() {  
                self.remove(this);
            }

        },

        _onResizableResize : function(opts) {
            this.width(opts.width);
            this.height(opts.height);
        },

        // add child component
        add : function(sub) {
            sub.parent = this;
            this.children.push(sub);
            // Resize the child to fit the parent
            sub.onResize();
        },
        
        // remove child component
        remove : function(sub) {
            sub.parent = null;
            this.children.remove(sub);
        },
        
        removeAll : function() {
            _.each(this.children(), function(child) {
                child.parent = null;
            }, this);
            this.children([]);
        },
        
        children : function() {
            return this.children();
        },
        
        doRender : function() {
            // do render in the hierarchy from parent to child
            // traverse tree in pre-order
            Base.prototype.doRender.call(this);

            _.each(this.children(), function(child) {
                child.render();
            });

            if (this.resizable) {
                Resizable.applyTo(this, {
                    container : this.$el,
                    handles : this.resizeHandles,
                    minWidth : this.resizeMinWidth,
                    maxWidth : this.resizeMaxWidth,
                    minHeight : this.resizeMinHeight,
                    maxHeight : this.resizeMaxHeight
                });

                this.resizable.on('resize', this._onResizableResize, this);
            }
        },
        
        // resize when width or height is changed
        onResize : function() {
            // stretch the children
            if (this.height()) {
                this.$el.children(".qpf-children").height(this.height()); 
            }
            // trigger the after resize event in post-order
            _.each(this.children(), function(child) {
                child.onResize();
            }, this);
            Base.prototype.onResize.call(this);
        },

        dispose : function() {
            
            _.each(this.children(), function(child) {
                child.dispose();
            });

            Base.prototype.dispose.call(this);
        },

        // get child component by name
        get : function(name) {
            if (!name) {
                return;
            }
            return _.filter(this.children(), function(item) { return item.name === name })[0];
        }
    })

    Container.provideBinding = Base.provideBinding;

    // modify the qpf bindler
    var baseBindler = ko.bindingHandlers["qpf"];
    ko.bindingHandlers["qpf"] = {

        init : function(element, valueAccessor, allBindingsAccessor, viewModel) {
            
            //save the child nodes before the element's innerHTML is changed in the createComponentFromDataBinding method
            var childNodes = Array.prototype.slice.call(element.childNodes);

            var component = baseBindler.createComponent(element, valueAccessor);

            if (component instanceof Container) {
                // hold the renderring of children until parent is renderred
                // If the child renders first, the element is still not attached
                // to the document. So any changes of observable will not work.
                // Even worse, the dependantObservable is disposed so the observable
                // is detached in to the dom
                // https://groups.google.com/forum/?fromgroups=#!topic/knockoutjs/aREJNrD-Miw
                var subViewModel = {
                    '__deferredrender__' : true 
                }
                _.extend(subViewModel, viewModel);
                // initialize from the dom element
                for(var i = 0; i < childNodes.length; i++) {
                    var child = childNodes[i];
                    if (ko.bindingProvider.prototype.nodeHasBindings(child)) {
                        // Binding with the container's viewModel
                        ko.applyBindings(subViewModel, child);
                        var sub = Base.getByDom(child);
                        if (sub) {
                            component.add(sub);
                        }
                    }
                }
            }
            if (! viewModel['__deferredrender__']) {
                
                component.render();
            }

            return { 'controlsDescendantBindings': true };

        },
        update : function(element, valueAccessor) {
            baseBindler.update(element, valueAccessor);
        }
    }

    Container.provideBinding("container", Container);

    return Container;

});
/**
 * Panel
 * Container has title and content
 */
define('qpf/container/Panel',['require','./Container','knockout','$'],function(require) {

    

    var Container = require("./Container");

    var ko = require("knockout");
    var $ = require("$");

    var Panel = Container.derive(function() {
        return {
            title : ko.observable(""),

        }
    }, {

        type : 'PANEL',

        css : 'panel',

        template : '<div class="qpf-panel-header">\
                        <div class="qpf-panel-title" data-bind="html:title"></div>\
                        <div class="qpf-panel-tools"></div>\
                    </div>\
                    <div class="qpf-panel-body" data-bind="foreach:children" class="qpf-children">\
                        <div data-bind="qpf_view:$data"></div>\
                    </div>\
                    <div class="qpf-panel-footer"></div>',
        
        afterRender : function() {
            var $el = this.$el;
            this._$header = $el.children(".qpf-panel-header");
            this._$tools = this._$header.children(".qpf-panel-tools");
            this._$body = $el.children(".qpf-panel-body");
            this._$footer = $el.children(".qpf-panel-footer");
        },

        onResize : function() {
            // stretch the body when the panel's height is given
            if (this._$body && this.height()) {
                var headerHeight = this._$header.height();
                var footerHeight = this._$footer.height();

                // PENDING : here use jquery innerHeight method ?because we still 
                // need to consider the padding of body
                this._$body.innerHeight(this.$el.height() - headerHeight - footerHeight );
        
            }
            Container.prototype.onResize.call(this);
        }
    })

    Container.provideBinding("panel", Panel);

    return Panel;

})

;

/**
 * Accordion Container
 * Children of accordion container must be a panel
 */
define('qpf/container/Accordian',['require','./Container','./Panel','knockout','$','_'],function(require) {

var Container = require("./Container");
var Panel = require("./Panel");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var Accordion = Container.derive(function() {

    var ret = {
        actived : ko.observable(0)
    }
    ret.actived.subscribe(function(idx) {
        this._active(idx);
    }, this);
    return ret;
}, {

    type : "ACCORDIAN",
    css : 'tab',

    add : function(item) {
        if (item instanceof Panel) {
            Panel.prototype.add.call(this, item);
        } else {
            console.error("Children of accordion container must be instance of panel");
        }
        this._active(this.actived());
    },

    eventsProvided : _.union('change', Container.prototype.eventsProvided),

    initialize : function() {
        this.children.subscribe(function() {
            this._updateSize();
        }, this);

        Container.prototype.initialize.call(this);
    },

    template : '',

    onResize : function() {

    },

    _updateSize : function() {

    },

    _active : function() {
        
    }
});

Container.provideBinding("accordion", Accordion);

return Accordion;
});
/**
 * application.js
 * Container of the whole web app, mainly for monitor the resize
 * event of Window and resize all the component in the app
 */

define('qpf/container/Application',['require','./Container','knockout','$'],function(require) {

    

    var Container = require("./Container");
    var ko = require("knockout");
    var $ = require("$");

    var Application = Container.derive({

    }, {

        type : "APPLICATION",
        
        css : "application",

        initialize : function() {
            $(window).resize(this._resize.bind(this));
            this._resize();
        },

        _resize : function() {
            this.width($(window).width());
            this.height($(window).height());
        }
    })

    Container.provideBinding("application", Application);

    return Application;

});
/**
 * base class of vbox and hbox
 */

define('qpf/container/Box',['require','../Base','./Container','knockout','$','_'],function(require) {

    var Base = require('../Base');
    var Container = require("./Container");
    var ko = require("knockout");
    var $ = require("$");
    var _ = require("_");

    var Box = Container.derive({
        _inResize : false
    }, {

        type : 'BOX',

        css : 'box',

        initialize : function() {

            this.children.subscribe(this._onChildrenChanged, this);

            this.$el.css("position", "relative");

            Container.prototype.initialize.call(this);
        },

        _onChildrenChanged : function(children) {
            this.onResize();
            _.each(children, function(child) {
                child.on('resize', this.onResize, this);
            }, this);
        },

        _getMargin : function($el) {
            return {
                left : parseInt($el.css("marginLeft")) || 0,
                top : parseInt($el.css("marginTop")) || 0,
                bottom : parseInt($el.css("marginBottom")) || 0,
                right : parseInt($el.css("marginRight")) || 0,
            }
        },

        _resizeTimeout : 0,

        onResize : function() {
            // Avoid recursive call from children
            if (this._inResize) {
                return;
            }
            var self = this;
            // put resize in next tick,
            // if multiple child have triggered the resize event
            // it will do only once;
            if (this._resizeTimeout) {
                clearTimeout(this._resizeTimeout);
            }
            this._resizeTimeout = setTimeout(function() {
                self._inResize = true;
                self.resizeChildren();
                Base.prototype.onResize.call(self);
                self._inResize = false;
            }, 1);
        }
    })


    // Container.provideBinding("box", Box);

    return Box;

});
/**
 * hbox layout
 *
 * Items of hbox can have flex and prefer two extra properties
 * About this tow properties, you can reference to flexbox in css3
 * http://www.w3.org/TR/css3-flexbox/
 * https://github.com/doctyper/flexie/blob/master/src/flexie.js
 */

define('qpf/container/HBox',['require','./Container','./Box','knockout','$','_'],function(require) {

    var Container = require("./Container");
    var Box = require("./Box");
    var ko = require("knockout");
    var $ = require("$");
    var _ = require("_");

    var hBox = Box.derive({
        _flexSum : 0,
        _childrenWithFlex : [],
        _marginCache : [],
        _marginCacheWithFlex : [],
        _remainderWidth : 0,
        _accWidth : 0
    }, {

        type : 'HBOX',

        css : 'hbox',

        resizeChildren : function() {

            this._flexSum = 0;
            this._accWidth = 0;
            this._childrenWithFlex = [];
            this._marginCache = [];
            this._marginCacheWithFlex = [];
            this._remainderWidth = this.$el.width();

            _.each(this.children(), this._iterateChildren, this);

            _.each(this._childrenWithFlex, this._updateChildrenWidth, this)

            _.each(this.children(), this._updateChildrenPosition, this);
        },

        _iterateChildren : function(child, idx) {
            if (!child.visible()) {
                return;
            }
            var margin = this._getMargin(child.$el);
            this._marginCache.push(margin);
            // stretch the height
            // (when align is stretch)
            child.height(this.$el.height() - margin.top - margin.bottom );

            var prefer = ko.utils.unwrapObservable(child.prefer);
            var resizable = ko.utils.unwrapObservable(child.resizable);
            // Item is resizable, use the width and height directly
            if (resizable) {
                var width = +child.width() || 0;
                this._remainderWidth -= width + margin.left + margin.right;
            }
            // item has a prefer size (not null or undefined);
            else if (prefer != null) {
                // TODO : if the prefer size is larger than vbox size??
                prefer = Math.min(prefer, this._remainderWidth);
                child.width(prefer);

                this._remainderWidth -= prefer + margin.left + margin.right;
            } else {
                var flex = parseInt(ko.utils.unwrapObservable(child.flex ) || 1);
                // put it in the next step to compute
                // the height based on the flex property
                this._childrenWithFlex.push(child);
                this._marginCacheWithFlex.push(margin);

                this._flexSum += flex;
            }
        },

        _updateChildrenPosition : function(child, idx) {
            if (!child.visible()) {
                return;
            }
            var margin = this._marginCache[idx];
            child.$el.css({
                "position" : "absolute",
                "top" : '0px',
                "left" : this._accWidth + "px"
            });
            this._accWidth += +child.width() + margin.left + margin.right;
        },

        _updateChildrenWidth : function(child, idx) {
            if (!child.visible()) {
                return;
            }
            var margin = this._marginCacheWithFlex[idx];
            var flex = parseInt(ko.utils.unwrapObservable(child.flex ) || 1);
            var ratio = flex / this._flexSum;

            child.width(Math.floor(this._remainderWidth * ratio) - margin.left - margin.right);   
        }
    })


    Container.provideBinding("hbox", hBox);

    return hBox;

});
/**
 * Inline Layout
 */
define('qpf/container/Inline',['require','./Container','knockout','$'],function(require){

var Container = require("./Container");
var ko = require("knockout");
var $ = require("$");

var Inline = Container.derive({
}, {

    type : "INLINE",

    css : "inline",

    template : '<div data-bind="foreach:children" class="qpf-children">\
                    <div data-bind="qpf_view:$data"></div>\
                </div>\
                <div style="clear:both"></div>'
})

Container.provideBinding("inline", Inline);

return Inline;

});
/**
 * Base class of all meta component
 * Meta component is the ui component
 * that has no children
 */
define('qpf/meta/Meta',['require','../Base','knockout'],function(require) {

    var Base = require("../Base");
    var ko = require("knockout");

    var Meta = Base.derive(
    {
    }, {
        type : "META",

        css : 'meta'
    });

    // Inherit the static methods
    Meta.provideBinding = Base.provideBinding;

    Meta.provideBinding("meta", Meta);

    return Meta;

});
// Default list item component
// Specially provide for List container
define('qpf/meta/ListItem',['require','./Meta','knockout'],function(require){

    var Meta = require("./Meta");
    var ko = require("knockout");

    var ListItem = Meta.derive(function(){
        return {
            title : ko.observable("")
        }
    }, {
        type : "LISTITEM",
        
        css : "list-item",

        initialize : function(){
            this.$el.mousedown(function(e){
                e.preventDefault();
            });
        },

        template : '<div class="qpf-list-item-title" data-bind="html:title"></div>'
    })

    return ListItem;
});
define('qpf/container/List',['require','./Container','knockout','../meta/ListItem','_'],function(require) {

    var Container = require("./Container");
    var ko = require("knockout");
    var ListItem = require("../meta/ListItem");
    var _ = require('_');

    var List = Container.derive(function() {

        return {
            
            dataSource : ko.observableArray([]),

            itemView : ko.observable(ListItem), // item component constructor
            
            selected : ko.observableArray([]),

            multipleSelect : false,
            dragSort : false
        }
    }, {
        type : "LIST",
        
        css : "list",

        template : '<div data-bind="foreach:children" >\
                        <div class="qpf-container-item">\
                            <div data-bind="qpf_view:$data"></div>\
                        </div>\
                    </div>',

        eventsProvided : _.union(Container.prototype.eventsProvided, "select"),

        initialize : function() {

            Container.prototype.initialize.call(this);

            var oldArray = _.clone(this.dataSource());
            var self = this;
            
            this.dataSource.subscribe(function(newArray) {
                this._update(oldArray, newArray);
                oldArray = _.clone(newArray);
                _.each(oldArray, function(item, idx) {
                    if(ko.utils.unwrapObservable(item.selected)) {
                        this.selected(idx)
                    }
                }, this);
            }, this);

            this.selected.subscribe(function(idxList) {
                this._unSelectAll();

                _.each(idxList, function(idx) {
                    var child = this.children()[idx];
                    child &&
                        child.$el.addClass("selected");
                }, this)

                self.trigger("select", this._getSelectedData());
            }, this);

            this.$el.delegate(".qpf-container-item", "click", function() {
                var context = ko.contextFor(this);
                self.selected([context.$index()]);
            });

            this._update([], oldArray);
        },

        _getSelectedData : function() {
            var dataSource = this.dataSource();
            var result = _.map(this.selected(), function(idx) {
                return dataSource[idx];
            }, this);
            return result;
        },

        _update : function(oldArray, newArray) {

            var children = this.children();
            var ItemView = this.itemView();
            var result = [];

            var differences = ko.utils.compareArrays(oldArray, newArray);
            var newChildren = [];
            _.each(differences, function(item) {
                if (item.status === "retained") {
                    var index = oldArray.indexOf(item.value);
                    result.push(children[index]);
                } else if(item.status === "added") {
                    var newChild = new ItemView({
                        attributes : item.value
                    });
                    result[item.index] = newChild;
                    children.splice(item.index, 0, newChild);
                    newChildren.push(newChild);
                }
            }, this)
            this.children(result);
            // render after it is appended in the dom
            // so the component like range will be resized proply
            _.each(newChildren, function(child) {
                child.render();
            });
        },

        _unSelectAll : function() {
            _.each(this.children(), function(child, idx) {
                if(child) {
                    child.$el.removeClass("selected")
                }
            }, this);
        }

    });

    Container.provideBinding("list", List);

    return List;
});
//============================================
// Tab Container
// Children of tab container must be a panel
//============================================
define('qpf/container/Tab',['require','./Container','./Panel','knockout','$','_'],function(require) {

    

    var Container = require("./Container");
    var Panel = require("./Panel");
    var ko = require("knockout");
    var $ = require("$");
    var _ = require("_");

    var Tab = Panel.derive(function() {
        return {
            actived : ko.observable(0),

            maxTabWidth : 100,

            minTabWidth : 30
        }
    }, function() {
        this.actived.subscribe(function(idx) {
            this._active(idx);
        }, this);
    }, {

        type : "TAB",

        css : 'tab',

        add : function(item) {
            if (item instanceof Panel) {
                Panel.prototype.add.call(this, item);
            } else {
                console.error("Children of tab container must be instance of panel");
            }
            this._active(this.actived());
        },

        eventsProvided : _.union('change', Container.prototype.eventsProvided),

        initialize : function() {
            // compute the tab value;
            this.children.subscribe(function() {
                this._updateTabSize();
                this._active(this.actived());
            }, this);

            Panel.prototype.initialize.call(this);
        },

        template : '<div class="qpf-tab-header">\
                        <ul class="qpf-tab-tabs" data-bind="foreach:children">\
                            <li data-bind="click:$parent.actived.bind($data, $index())">\
                                <a data-bind="html:title"></a>\
                            </li>\
                        </ul>\
                        <div class="qpf-tab-tools"></div>\
                    </div>\
                    <div class="qpf-tab-body">\
                        <div class="qpf-tab-views" data-bind="foreach:children" class="qpf-children">\
                            <div data-bind="qpf_view:$data"></div>\
                        </div>\
                    </div>\
                    <div class="qpf-tab-footer"></div>',

        afterRender : function() {
            this._updateTabSize();
            // cache the $element will be used
            var $el = this.$el;
            this._$header = $el.children(".qpf-tab-header");
            this._$tools = this._$header.children(".qpf-tab-tools");
            this._$body = $el.children(".qpf-tab-body");
            this._$footer = $el.children('.qpf-tab-footer');

            this._active(this.actived());
        },

        onResize : function() {
            this._adjustCurrentSize();
            this._updateTabSize();
            Container.prototype.onResize.call(this);
        },

        _unActiveAll : function() {
            _.each(this.children(), function(child) {
                child.$el.css("display", "none");
            });
        },

        _updateTabSize : function() {
            var length = this.children().length,
                tabSize = Math.floor((this.$el.width()-20)/length);
            // clamp
            tabSize = Math.min(this.maxTabWidth, Math.max(this.minTabWidth, tabSize));

            this.$el.find(".qpf-tab-header>.qpf-tab-tabs>li").width(tabSize);
        },

        _adjustCurrentSize : function() {

            var current = this.children()[ this.actived() ];
            if (current && this._$body) {
                var headerHeight = this._$header.height(),
                    footerHeight = this._$footer.height();

                if (this.height() &&
                    this.height() !== "auto") {
                    current.height(this.$el.height() - headerHeight - footerHeight);
                }
                // PENDING : compute the width ???
                if (this.width() == "auto") {
                }
            }
        },

        _active : function(idx) {
            this._unActiveAll();
            var current = this.children()[idx];
            if (current) {
                current.$el.css("display", "block");

                // Trigger the resize events manually
                // Because the width and height is zero when the panel is hidden,
                // so the children may not be properly layouted, We need to force the
                // children do layout again when panel is visible;
                this._adjustCurrentSize();
                current.onResize();

                this.trigger('change', idx, current);
            }

            this.$el.find(".qpf-tab-header>.qpf-tab-tabs>li")
                    .removeClass("actived")
                    .eq(idx).addClass("actived");
        }

    })

    Container.provideBinding("tab", Tab);

    return Tab;

});
/**
 * vbox layout
 * 
 * Items of vbox can have flex and prefer two extra properties
 * About this tow properties, you can reference to flexbox in css3
 * http://www.w3.org/TR/css3-flexbox/
 * https://github.com/doctyper/flexie/blob/master/src/flexie.js
 * TODO : add flexbox support
 *       align 
 *      padding ????
 */

define('qpf/container/VBox',['require','./Container','./Box','knockout','$','_'],function(require) {

    var Container = require("./Container");
    var Box = require("./Box");
    var ko = require("knockout");
    var $ = require("$");
    var _ = require("_");

    var vBox = Box.derive({
        _flexSum : 0,
        _childrenWithFlex : [],
        _marginCache : [],
        _marginCacheWithFlex : [],
        _remainderHeight : 0,
        _accHeight : 0
    }, {

        type : 'VBOX',

        css : 'vbox',

        resizeChildren : function() {

            this._flexSum = 0;
            this._accHeight = 0;
            this._childrenWithFlex = [];
            this._marginCache = [];
            this._marginCacheWithFlex = [];
            this._remainderHeight = this.$el.height();

            _.each(this.children(), this._iterateChildren, this);

            _.each(this._childrenWithFlex, this._updateChildrenHeight, this)

            _.each(this.children(), this._updateChildrenPosition, this);
        },


        _iterateChildren : function(child) {
            if (!child.visible()) {
                return;
            }
            var margin = this._getMargin(child.$el);
            this._marginCache.push(margin);
            // stretch the width
            // (when align is stretch)
            child.width(this.$el.width() - margin.left - margin.right);

            var prefer = ko.utils.unwrapObservable(child.prefer);
            var resizable = ko.utils.unwrapObservable(child.resizable);
            // Item is resizable, use the width and height directly
            if (resizable) {
                var height = +child.height() || 0;
                this._remainderHeight -= height + margin.top + margin.bottom;
            }
            // item has a prefer size (not null or undefined);
            else if (prefer != null) {
                // TODO : if the prefer size is larger than vbox size??
                prefer = Math.min(prefer, this._remainderHeight);
                child.height(prefer);

                this._remainderHeight -= prefer + margin.top + margin.bottom;
            } else {
                var flex = parseInt(ko.utils.unwrapObservable(child.flex) || 1);
                // put it in the next step to compute
                // the height based on the flex property
                this._childrenWithFlex.push(child);
                this._marginCacheWithFlex.push(margin);

                this._flexSum += flex;
            }
        },

        _updateChildrenPosition : function(child, idx) {
            if (!child.visible()) {
                return;
            }
            var margin = this._marginCache[idx];
            child.$el.css({
                "position" : "absolute",
                "left" : '0px', // still set left to zero, use margin to fix the layout
                "top" : this._accHeight + "px"
            })
            this._accHeight += +child.height() + margin.top + margin.bottom;
        },

        _updateChildrenHeight : function(child, idx) {
            if (!child.visible()) {
                return;
            }
            var margin = this._marginCacheWithFlex[idx];
            var flex = parseInt(ko.utils.unwrapObservable(child.flex) || 1),
                ratio = flex / this._flexSum;
            child.height(Math.floor(this._remainderHeight*ratio) - margin.top - margin.bottom); 
        }
    });


    Container.provideBinding("vbox", vBox);

    return vBox;

});
/**
 * Window componennt
 * Window is a panel wich can be drag
 * and close
 */
define('qpf/container/Window',['require','./Container','./Panel','../helper/Draggable','knockout','$','_'],function(require) {

    

    var Container = require("./Container");
    var Panel = require("./Panel");
    var Draggable = require("../helper/Draggable");
    var ko = require("knockout");
    var $ = require("$");
    var _ = require("_");

    var Window = Panel.derive(function() {
        return {

            $el : $('<div data-bind="style:{left:_leftPx, top:_topPx}"></div>'),

            children : ko.observableArray(),
            title : ko.observable("Window"),

            left : ko.observable(0),
            top : ko.observable(0),

            _leftPx : ko.computed(function() {
                return this.left()+"px";
            }, this, {
                deferEvaluation : true
            }),
            _topPx : ko.computed(function() {
                return this.top()+"px";
            }, this, {
                deferEvaluation : true
            })
            
        }
    }, {

        type : 'WINDOW',

        css : _.union('window', Panel.prototype.css),

        initialize : function() {
            Draggable.applyTo(this);
            
            Panel.prototype.initialize.call(this);
        },

        afterRender : function() {
            
            Panel.prototype.afterRender.call(this);

            this.draggable.add(this.$el, this._$header);
            
        }
    })

    Container.provideBinding("window", Window);

    return Window;

});
/**
 * Xml Parser
 * parse wml and convert it to dom with knockout data-binding
 * TODO xml valid checking, 
 *      provide xml childNodes Handler in the Components
 */
define('qpf/core/XMLParser',['require','exports','module','_'],function(require, exports, module) {
    
    var _ = require("_");
    
    // return document fragment converted from the xml
    var parse = function(xmlString, dom) {
        
        if (typeof(xmlString) == "string") {
            var xml = parseXML(xmlString);
        } else {
            var xml = xmlString;
        }
        if (xml) {

            var rootDomNode = dom || document.createElement("div");

            convert(xml, rootDomNode);

            return rootDomNode;
        }
    }

    function parseXML(xmlString) {
        var xml, parser;
        try{
            if (window.DOMParser) {
                xml = (new DOMParser()).parseFromString(xmlString, "text/xml");
            } else {
                xml = new ActiveXObject("Microsoft.XMLDOM");
                xml.async = "false";
                xml.loadXML(xmlString);
            }
            return xml;
        }catch(e) {
            console.error("Invalid XML:" + xmlString);
        }
    }

    var customParsers = {};
    // provided custom parser from Compositor
    // parser need to return a plain object which key is attributeName
    // and value is attributeValue
    function provideParser(componentType /*tagName*/, parser) {
        customParsers[componentType] = parser;
    }

    function parseXMLNode(xmlNode) {
        if (xmlNode.nodeType === 1) {
            
            var bindingResults = {
                type : xmlNode.tagName.toLowerCase()
            } 

            var convertedAttr = convertAttributes(xmlNode.attributes);
            var customParser = customParsers[bindingResults.type];
            if (customParser) {
                var result = customParser(xmlNode);
                if (result &&
                    typeof(result) !="object") {
                    console.error("Parser must return an object converted from attributes")
                } else {
                    // data in the attributes has higher priority than
                    // the data from the children
                    _.extend(convertedAttr, result);
                }
            }

            var bindingString = objectToDataBindingFormat(convertedAttr, bindingResults);

            var domNode = document.createElement('div');
            domNode.setAttribute('data-bind',  "qpf:"+bindingString);

            return domNode;
        } else if (xmlNode.nodeType === 8) {// comment node, offer for virtual binding in knockout
            // return xmlNode;
            return;
        } else {
            return;
        }
    }

    function convertAttributes(attributes) {
        var ret = {};
        for (var i = 0; i < attributes.length; i++) {
            var attr = attributes[i];
            ret[attr.nodeName] = attr.nodeValue;
        }
        return ret;
    }

    function objectToDataBindingFormat(attributes, bindingResults) {

        bindingResults = bindingResults || {};

        var preProcess = function(attributes, bindingResults) {

            _.each(attributes, function(value, name) {
                // recursive
                if (value.constructor == Array) {
                    bindingResults[name] = [];
                    preProcess(value, bindingResults[name]);
                } else if (value.constructor == Object) {
                    bindingResults[name] = {};
                    preProcess(value, bindingResults[name]);
                } else if (typeof(value) !== "undefined") {
                    // this value is an expression or observable
                    // in the viewModel if it has @binding[] flag
                    var isBinding = /^\s*@binding\[(.*?)\]\s*$/.exec(value);
                    if (isBinding) {
                        // add a tag to remove quotation the afterwards
                        // conveniently, or knockout will treat it as a 
                        // normal string, not expression
                        value = "{{BINDINGSTART" + isBinding[1] + "BINDINGEND}}";

                    }
                    bindingResults[name] = value
                }
            });
        }
        preProcess(attributes, bindingResults);

        var bindingString = JSON.stringify(bindingResults);
        
        bindingString = bindingString.replace(/\"\{\{BINDINGSTART(.*?)BINDINGEND\}\}\"/g, "$1");

        return bindingString;
    }

    function convert(root, parent) {

        var children = getChildren(root);

        for(var i = 0; i < children.length; i++) {
            var node = parseXMLNode(children[i]);
            if (node) {
                parent.appendChild(node);
                convert(children[i], node);
            }
        }
    }

    function getChildren(parent) {
        
        var children = [];
        var node = parent.firstChild;
        while(node) {
            children.push(node);
            node = node.nextSibling;
        }
        return children;
    }

    function getChildrenByTagName(parent, tagName) {
        var children = getChildren(parent);
        
        return _.filter(children, function(child) {
            return child.tagName && child.tagName.toLowerCase() === tagName;
        })
    }


    exports.parse = parse;
    //---------------------------------
    // some util functions provided for the components
    exports.provideParser = provideParser;

    function getTextContent(xmlNode) {
        var children = getChildren(xmlNode);
        var text = '';
        _.each(children, function(child) {
            if (child.nodeType==3) {
                text += child.textContent.replace(/(^\s*)|(\s*$)/g, "");
            }
        })
        return text;
    }

    exports.util = {
        convertAttributes : convertAttributes,
        objectToDataBindingFormat : objectToDataBindingFormat,
        getChildren : getChildren,
        getChildrenByTagName : getChildrenByTagName,
        getTextContent : getTextContent
    }
});
// (c) Dean McNamee <dean@gmail.com>, 2012.
//
// https://github.com/deanm/css-color-parser-js
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.

define('qpf/core/color',[],function() {
    // http://www.w3.org/TR/css3-color/
    var kCSSColorTable = {
        "transparent": [0,0,0,0], "aliceblue": [240,248,255,1],
        "antiquewhite": [250,235,215,1], "aqua": [0,255,255,1],
        "aquamarine": [127,255,212,1], "azure": [240,255,255,1],
        "beige": [245,245,220,1], "bisque": [255,228,196,1],
        "black": [0,0,0,1], "blanchedalmond": [255,235,205,1],
        "blue": [0,0,255,1], "blueviolet": [138,43,226,1],
        "brown": [165,42,42,1], "burlywood": [222,184,135,1],
        "cadetblue": [95,158,160,1], "chartreuse": [127,255,0,1],
        "chocolate": [210,105,30,1], "coral": [255,127,80,1],
        "cornflowerblue": [100,149,237,1], "cornsilk": [255,248,220,1],
        "crimson": [220,20,60,1], "cyan": [0,255,255,1],
        "darkblue": [0,0,139,1], "darkcyan": [0,139,139,1],
        "darkgoldenrod": [184,134,11,1], "darkgray": [169,169,169,1],
        "darkgreen": [0,100,0,1], "darkgrey": [169,169,169,1],
        "darkkhaki": [189,183,107,1], "darkmagenta": [139,0,139,1],
        "darkolivegreen": [85,107,47,1], "darkorange": [255,140,0,1],
        "darkorchid": [153,50,204,1], "darkred": [139,0,0,1],
        "darksalmon": [233,150,122,1], "darkseagreen": [143,188,143,1],
        "darkslateblue": [72,61,139,1], "darkslategray": [47,79,79,1],
        "darkslategrey": [47,79,79,1], "darkturquoise": [0,206,209,1],
        "darkviolet": [148,0,211,1], "deeppink": [255,20,147,1],
        "deepskyblue": [0,191,255,1], "dimgray": [105,105,105,1],
        "dimgrey": [105,105,105,1], "dodgerblue": [30,144,255,1],
        "firebrick": [178,34,34,1], "floralwhite": [255,250,240,1],
        "forestgreen": [34,139,34,1], "fuchsia": [255,0,255,1],
        "gainsboro": [220,220,220,1], "ghostwhite": [248,248,255,1],
        "gold": [255,215,0,1], "goldenrod": [218,165,32,1],
        "gray": [128,128,128,1], "green": [0,128,0,1],
        "greenyellow": [173,255,47,1], "grey": [128,128,128,1],
        "honeydew": [240,255,240,1], "hotpink": [255,105,180,1],
        "indianred": [205,92,92,1], "indigo": [75,0,130,1],
        "ivory": [255,255,240,1], "khaki": [240,230,140,1],
        "lavender": [230,230,250,1], "lavenderblush": [255,240,245,1],
        "lawngreen": [124,252,0,1], "lemonchiffon": [255,250,205,1],
        "lightblue": [173,216,230,1], "lightcoral": [240,128,128,1],
        "lightcyan": [224,255,255,1], "lightgoldenrodyellow": [250,250,210,1],
        "lightgray": [211,211,211,1], "lightgreen": [144,238,144,1],
        "lightgrey": [211,211,211,1], "lightpink": [255,182,193,1],
        "lightsalmon": [255,160,122,1], "lightseagreen": [32,178,170,1],
        "lightskyblue": [135,206,250,1], "lightslategray": [119,136,153,1],
        "lightslategrey": [119,136,153,1], "lightsteelblue": [176,196,222,1],
        "lightyellow": [255,255,224,1], "lime": [0,255,0,1],
        "limegreen": [50,205,50,1], "linen": [250,240,230,1],
        "magenta": [255,0,255,1], "maroon": [128,0,0,1],
        "mediumaquamarine": [102,205,170,1], "mediumblue": [0,0,205,1],
        "mediumorchid": [186,85,211,1], "mediumpurple": [147,112,219,1],
        "mediumseagreen": [60,179,113,1], "mediumslateblue": [123,104,238,1],
        "mediumspringgreen": [0,250,154,1], "mediumturquoise": [72,209,204,1],
        "mediumvioletred": [199,21,133,1], "midnightblue": [25,25,112,1],
        "mintcream": [245,255,250,1], "mistyrose": [255,228,225,1],
        "moccasin": [255,228,181,1], "navajowhite": [255,222,173,1],
        "navy": [0,0,128,1], "oldlace": [253,245,230,1],
        "olive": [128,128,0,1], "olivedrab": [107,142,35,1],
        "orange": [255,165,0,1], "orangered": [255,69,0,1],
        "orchid": [218,112,214,1], "palegoldenrod": [238,232,170,1],
        "palegreen": [152,251,152,1], "paleturquoise": [175,238,238,1],
        "palevioletred": [219,112,147,1], "papayawhip": [255,239,213,1],
        "peachpuff": [255,218,185,1], "peru": [205,133,63,1],
        "pink": [255,192,203,1], "plum": [221,160,221,1],
        "powderblue": [176,224,230,1], "purple": [128,0,128,1],
        "red": [255,0,0,1], "rosybrown": [188,143,143,1],
        "royalblue": [65,105,225,1], "saddlebrown": [139,69,19,1],
        "salmon": [250,128,114,1], "sandybrown": [244,164,96,1],
        "seagreen": [46,139,87,1], "seashell": [255,245,238,1],
        "sienna": [160,82,45,1], "silver": [192,192,192,1],
        "skyblue": [135,206,235,1], "slateblue": [106,90,205,1],
        "slategray": [112,128,144,1], "slategrey": [112,128,144,1],
        "snow": [255,250,250,1], "springgreen": [0,255,127,1],
        "steelblue": [70,130,180,1], "tan": [210,180,140,1],
        "teal": [0,128,128,1], "thistle": [216,191,216,1],
        "tomato": [255,99,71,1], "turquoise": [64,224,208,1],
        "violet": [238,130,238,1], "wheat": [245,222,179,1],
        "white": [255,255,255,1], "whitesmoke": [245,245,245,1],
        "yellow": [255,255,0,1], "yellowgreen": [154,205,50,1]
    }

    function clamp_css_byte(i) {  // Clamp to integer 0 .. 255.
        i = Math.round(i);  // Seems to be what Chrome does (vs truncation).
        return i < 0 ? 0 : i > 255 ? 255 : i;
    }

    function clamp_css_float(f) {  // Clamp to float 0.0 .. 1.0.
        return f < 0 ? 0 : f > 1 ? 1 : f;
    }

    function parse_css_int(str) {  // int or percentage.
        if (str[str.length - 1] === '%')
            return clamp_css_byte(parseFloat(str) / 100 * 255);
        return clamp_css_byte(parseInt(str));
    }

    function parse_css_float(str) {  // float or percentage.
        if (str[str.length - 1] === '%')
            return clamp_css_float(parseFloat(str) / 100);
        return clamp_css_float(parseFloat(str));
    }

    function css_hue_to_rgb(m1, m2, h) {
      if (h < 0) h += 1;
      else if (h > 1) h -= 1;

      if (h * 6 < 1) return m1 + (m2 - m1) * h * 6;
      if (h * 2 < 1) return m2;
      if (h * 3 < 2) return m1 + (m2 - m1) * (2/3 - h) * 6;
      return m1;
    }

    function parse(css_str) {
        // Remove all whitespace, not compliant, but should just be more accepting.
        var str = css_str.replace(/ /g, '').toLowerCase();

        // Color keywords (and transparent) lookup.
        if (str in kCSSColorTable)
            return kCSSColorTable[str].slice();  // dup.

        // #abc and #abc123 syntax.
        if (str[0] === '#') {
            if (str.length === 4) {
                var iv = parseInt(str.substr(1), 16);  // TODO(deanm): Stricter parsing.
                if (!(iv >= 0 && iv <= 0xfff)) return null;  // Covers NaN.
                return [
                    ((iv & 0xf00) >> 4) | ((iv & 0xf00) >> 8),
                    (iv & 0xf0) | ((iv & 0xf0) >> 4),
                    (iv & 0xf) | ((iv & 0xf) << 4),
                    1
                ];
            }
            else if (str.length === 7) {
                var iv = parseInt(str.substr(1), 16);  // TODO(deanm): Stricter parsing.
                if (!(iv >= 0 && iv <= 0xffffff)) return null;  // Covers NaN.
                return [
                    (iv & 0xff0000) >> 16,
                    (iv & 0xff00) >> 8,
                    iv & 0xff,
                    1
                ];
            }
        
            return null;
        }

        var op = str.indexOf('('), ep = str.indexOf(')');
        if (op !== -1 && ep + 1 === str.length) {
            var fname = str.substr(0, op);
            var params = str.substr(op+1, ep-(op+1)).split(',');
            var alpha = 1;  // To allow case fallthrough.
            switch (fname) {
                case 'rgba':
                    if (params.length !== 4) return null;
                    alpha = parse_css_float(params.pop());
                // Fall through.
                case 'rgb':
                    if (params.length !== 3) return null;
                    return [
                        parse_css_int(params[0]),
                        parse_css_int(params[1]),
                        parse_css_int(params[2]),
                        alpha
                    ];
                case 'hsla':
                    if (params.length !== 4) return null;
                    alpha = parse_css_float(params.pop());
                // Fall through.
                case 'hsl':
                    if (params.length !== 3) return null;
                    var h = (((parseFloat(params[0]) % 360) + 360) % 360) / 360;  // 0 .. 1
                    // NOTE(deanm): According to the CSS spec s/l should only be
                    // percentages, but we don't bother and let float or percentage.
                    var s = parse_css_float(params[1]);
                    var l = parse_css_float(params[2]);
                    var m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
                    var m1 = l * 2 - m2;
                    return [
                        clamp_css_byte(css_hue_to_rgb(m1, m2, h+1/3) * 255),
                        clamp_css_byte(css_hue_to_rgb(m1, m2, h) * 255),
                        clamp_css_byte(css_hue_to_rgb(m1, m2, h-1/3) * 255),
                        alpha
                    ];
                default:
                    return null;
            }
        }

        return null;
    }

    return {
        parse : parse
    }
});
//======================================
// Button component
//======================================
define('qpf/meta/Button',['require','./Meta','../core/XMLParser','knockout','$','_'],function(require) {

    var Meta = require("./Meta");
    var XMLParser = require("../core/XMLParser");
    var ko = require("knockout");
    var $ = require("$");
    var _ = require("_");

    var Button = Meta.derive(function() {
        return {
            $el : $('<button data-bind="html:text"></button>'),
            
            // value of the button
            text : ko.observable('Button')   
        };
    }, {

        type : 'BUTTON',

        css : 'button',

        afterRender : function() {
            var me = this;
        }
    });

    Meta.provideBinding("button", Button);

    // provide parser when do xmlparsing
    XMLParser.provideParser("button", function(xmlNode) {
        
        var text = XMLParser.util.getTextContent(xmlNode);
        if (text) {
            return {
                text : text
            }
        }
    })

    return Button;

});
/**
 * Checkbox component
 */
define('qpf/meta/CheckBox',['require','./Meta','knockout','$','_'],function(require) {

var Meta = require("./Meta");
var ko = require('knockout');
var $ = require("$");
var _ = require("_");

var Checkbox = Meta.derive(function() {
    return {   
        // value of the button
        checked : ko.observable(false),

        label : ko.observable("")
    };
}, {

    template : '<input type="checkbox" data-bind="checked:checked" />\
                <span data-bind="css:{checked:checked}"></span>\
                <label data-bind="text:label"></label>',

    type : 'CHECKBOX',
    css : 'checkbox',

    // binding events
    afterRender : function() {
        var self = this;
        this.$el.click(function() {
            self.checked( ! self.checked() );
        })
    }
});

Meta.provideBinding("checkbox", Checkbox);

return Checkbox;

})  ;
/**
 * Base class of all widget component
 * Widget is component mixed with meta 
 * containers and other HTMLDOMElenents
 */
define('qpf/widget/Widget',['require','../Base','../meta/Meta','../container/Container','knockout','_'],function(require) {

var Base = require("../Base");
var Meta = require("../meta/Meta");
var Container = require("../container/Container");
var ko = require("knockout");
var _ = require("_");

var Widget = Base.derive(
{

}, {
    type : "WIDGET",

    css : 'widget'

});

//-------------------------------------------
// Handle bingings in the knockout template
Widget.provideBinding = Base.provideBinding;
Widget.provideBinding("widget", Widget);

return Widget;

});
/**
 * view model for color
 * supply hsv and rgb color space
 * http://en.wikipedia.org/wiki/HSV_color_space.
 */
define('qpf/widget/ColorViewModel',['require','../core/Clazz','knockout','_'],function(require) {

    var Clazz = require("../core/Clazz");
    var ko = require("knockout");
    var _ = require("_");


    function rgbToHsv(r, g, b) {
        r = r/255, g = g/255, b = b/255;

        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h, s, v = max;

        var d = max - min;
        s = max == 0 ? 0 : d / max;

        if(max == min) {
            h = 0; // achromatic
        }else{
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return [h*360, s*100, v*100];
    }

    function hsvToRgb(h, s, v) {

        h = h/360;
        s = s/100;
        v = v/100;

        var r, g, b;

        var i = Math.floor(h * 6);
        var f = h * 6 - i;
        var p = v * (1 - s);
        var q = v * (1 - f * s);
        var t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }


    function intToRgb(value) {
        var r = (value >> 16) & 0xff;
        var g = (value >> 8) & 0xff;
        var b = value & 0xff;
        return [r, g, b];
    }

    function rgbToInt(r, g, b) {
        return r << 16 | g << 8 | b;
    }

    function intToHsv(value) {
        var rgb = intToRgb(value);
        return rgbToHsv(rgb[0], rgb[1], rgb[2]);
    }

    function hsvToInt(h, s, v) {
        return rgbToInt(hsvToRgb(h, s, v));
    }

    // hsv to rgb is multiple to one
    // dependency relationship
    // h,s,v(w)------->rgb(r)----->r,g,b(w)
    // r,g,b(w)------->hex(r)
    // hex(w)------->hsv(w)
    // hex(rw)<------->hexString(rw)
    //
    // so writing hsv will not result circular update
    //
    var Color = Clazz.derive(function() {
        return {
            //--------------------rgb color space
            _r : ko.observable().extend({numeric:0}),
            _g : ko.observable().extend({numeric:0}),
            _b : ko.observable().extend({numeric:0}),
            //--------------------hsv color space
            _h : ko.observable().extend({clamp:{min:0,max:360}}),
            _s : ko.observable().extend({clamp:{min:0,max:100}}),
            _v : ko.observable().extend({clamp:{min:0,max:100}}),
            alpha : ko.observable(1).extend({numeric:2, clamp:{min:0, max:1}})
        }
    }, function() {

        this.hex = ko.computed({
            read : function() {
                return rgbToInt( this._r(), this._g(), this._b() );
            },
            write : function(value) {
                var hsv = intToHsv(value);
                this._h(hsv[0]);
                this._s(hsv[1]);
                this._v(hsv[2]);
            }
        }, this);

        // bridge of hsv to rgb
        this.rgb = ko.computed({
            read : function() {
                var rgb = hsvToRgb(this._h(), this._s(), this._v());
                this._r(rgb[0]);
                this._g(rgb[1]);
                this._b(rgb[2]);

                return rgb;
            }
        }, this);

        this.hsv = ko.computed(function() {
            return [this._h(), this._s(), this._v()];
        }, this);

        // set rgb and hsv from hex manually
        this.set = function(hex) {
            var hsv = intToHsv(hex);
            var rgb = intToRgb(hex);
            this._h(hsv[0]);
            this._s(hsv[1]);
            this._v(hsv[2]);
            this._r(rgb[0]);
            this._g(rgb[1]);
            this._b(rgb[2]);
        }
        //---------------string of hex
        this.hexString = ko.computed({
            read : function() {
                var string = this.hex().toString(16),
                    fill = [];
                for (var i = 0; i < 6-string.length; i++) {
                    fill.push('0');
                }
                return fill.join("")+string;
            },
            write : function() {}
        }, this);

        //-----------------rgb color of hue when value and saturation is 100%
        this.hueRGB = ko.computed(function() {
            return "rgb(" + hsvToRgb(this._h(), 100, 100).join(",") + ")";
        }, this);

        //---------------items data for vector(rgb and hsv)
        var vector = ['_r', '_g', '_b'];
        this.rgbVector = [];
        for (var i = 0; i < 3; i++) {
            this.rgbVector.push({
                type : "spinner",
                min : 0,
                max : 255,
                step : 1,
                precision : 0,
                value : this[vector[i]]
            })
        }
        var vector = ['_h', '_s', '_v'];
        this.hsvVector = [];
        for (var i = 0; i < 3; i++) {
            this.hsvVector.push({
                type : "spinner",
                min : 0,
                max : 100,
                step : 1,
                precision : 0,
                value : this[vector[i]]
            })
        }
        // modify the hue
        this.hsvVector[0].max = 360;

        // set default 0xffffff
        this.set(0xffffff);
    });

    Color.intToRgb = intToRgb;
    Color.rgbToInt = rgbToInt;
    Color.rgbToHsv = rgbToHsv;
    Color.hsvToRgb = hsvToRgb;
    Color.intToHsv = intToHsv;
    Color.hsvToInt = hsvToInt;

    return Color;
});
/**
 * Slider component
 * 
 * @VMProp value
 * @VMProp step
 * @VMProp min
 * @VMProp max
 * @VMProp orientation
 * @VMProp format
 *
 * @method computePercentage
 * @method updatePosition   update the slider position manually
 * @event change newValue prevValue self[Slider]
 */
define('qpf/meta/Slider',['require','./Meta','../helper/Draggable','knockout','$','_'],function(require){

    

    var Meta = require("./Meta");
    var Draggable = require("../helper/Draggable");
    var ko = require("knockout");
    var $ = require("$");
    var _ = require("_");

    var Slider = Meta.derive(function(){

        var ret =  {

            $el : $('<div data-bind="css:orientation"></div>'),

            step : ko.observable(1),

            min : ko.observable(-100),

            max : ko.observable(100),

            orientation : ko.observable("horizontal"),// horizontal | vertical

            format : "{{value}}",

            _format : function(number){
                return this.format.replace("{{value}}", number);
            },

            // compute size dynamically when dragging
            autoResize : true
        }

        ret.value = ko.observable(1).extend({
            clamp : { 
                max : ret.max,
                min : ret.min
            }
        });

        var precision = 0;
        ko.computed(function() {
            var tmp = ret.step().toString().split('.');
            var fraction = tmp[1];
            if (fraction) {
                precision = fraction.length;
            } else {
                precision = 0;
            }
        });
        ret._valueNumeric = ko.computed(function(){
            return ret.value().toFixed(precision);
        });

        ret._percentageStr = ko.computed({
            read : function(){
                var min = ret.min();
                var max = ret.max();
                var value = ret.value();
                var percentage = ( value - min ) / ( max - min );
                
                return percentage * 100 + "%";
            },
            deferEvaluation : true
        })
        return ret;

    }, {

        type : "SLIDER",

        css : 'slider',

        template : '<div class="qpf-slider-groove-box">\
                        <div class="qpf-slider-groove">\
                            <div class="qpf-slider-percentage" data-bind="style:{width:_percentageStr}"></div>\
                        </div>\
                    </div>\
                    <div class="qpf-slider-min" data-bind="text:_format(min())"></div>\
                    <div class="qpf-slider-max" data-bind="text:_format(max())"></div>\
                    <div class="qpf-slider-control" data-bind="style:{left:_percentageStr}">\
                        <div class="qpf-slider-control-inner"></div>\
                        <div class="qpf-slider-value" data-bind="text:_format(_valueNumeric())"></div>\
                    </div>',

        eventsProvided : _.union(Meta.prototype.eventsProvided, "change"),
        
        initialize : function(){
            var min = this.min();
            var max = this.max();
            // Clamp
            this.value(Math.min(Math.max(this.value(), min), max));
            // add draggable mixin
            Draggable.applyTo( this, {
                axis : ko.computed(function(){
                    return this.orientation() == "horizontal" ? "x" : "y"
                }, this)
            });

            var prevValue = this._valueNumeric();
            this.value.subscribe(function(){
                this.trigger("change", this._valueNumeric(), prevValue, this);
                prevValue = this._valueNumeric();
            }, this);
        },

        afterRender : function(){

            // cache the element;
            this._$groove = this.$el.find(".qpf-slider-groove");
            this._$percentage = this.$el.find(".qpf-slider-percentage");
            this._$control = this.$el.find(".qpf-slider-control");

            this.draggable.container = this._$groove;
            var item = this.draggable.add( this._$control );
            
            item.on("drag", this._dragHandler, this);

            // disable text selection
            this.$el.mousedown(function(e){
                e.preventDefault();
            });
        },

        onResize : function(){
            Meta.prototype.onResize.call(this);
        },

        computePercentage : function(){

            if( this.autoResize ){
                this._cacheSize();
            }

            var offset = this._computeOffset();
            return offset / ( this._grooveSize - this._sliderSize );
        },

        _cacheSize : function(){

            // cache the size of the groove and slider
            var isHorizontal =this._isHorizontal();
            this._grooveSize =  isHorizontal ?
                                this._$groove.width() :
                                this._$groove.height();
            this._sliderSize = isHorizontal ?
                                this._$control.width() :
                                this._$control.height();
        },

        _computeOffset : function(){

            var isHorizontal = this._isHorizontal();
            var grooveOffset = isHorizontal ?
                                this._$groove.offset().left :
                                this._$groove.offset().top;
            var sliderOffset = isHorizontal ? 
                                this._$control.offset().left :
                                this._$control.offset().top;

            return sliderOffset - grooveOffset;
        },

        _dragHandler : function(){

            var percentage = this.computePercentage(),
                min = parseFloat( this.min() ),
                max = parseFloat( this.max() ),
                value = (max-min)*percentage+min;

            this.value( value );  
        },

        _isHorizontal : function(){
            return ko.utils.unwrapObservable( this.orientation ) == "horizontal";
        },
    })

    Meta.provideBinding("slider", Slider);

    return Slider;

});
/**
 * Spinner component
 *
 * @VMProp step
 * @VMProp value
 * @VMProp precision
 *
 * @event change newValue prevValue self[Spinner]
 */
define('qpf/meta/Spinner',['require','./Meta','knockout','$','_','../helper/Draggable'],function(require) {

	

	var Meta = require("./Meta");
	var ko = require("knockout");
	var $ = require('$');
	var _ = require("_");

	var Draggable = require('../helper/Draggable');

	function increase() {
		this.value(parseFloat(this.value()) + parseFloat(this.step()));
	}

	function decrease() {
		this.value(parseFloat(this.value()) - parseFloat(this.step()));
	}

	var Spinner = Meta.derive(function() {
		var ret = {
			step : ko.observable(1),
			valueUpdate : "", //"keypress" "keyup" "afterkeydown" "input"
			precision : ko.observable(2),
			min : ko.observable(null),
			max : ko.observable(null),
			increase : increase,
			decrease : decrease
		};
		ret.value = ko.observable(1).extend({
			numeric : ret.precision,
			clamp : { 
						max : ret.max,
						min : ret.min
					}
		});
		return ret;
	}, {
		type : 'SPINNER',

		css : 'spinner',

		initialize : function() {
			var prevValue = this.value() || 0;
			this.value.subscribe(function(newValue) {
				this.trigger("change", parseFloat(newValue), parseFloat(prevValue), this);
				prevValue = newValue;
			}, this)
		},

		eventsProvided : _.union(Meta.prototype.eventsProvided, "change"),

		template : '<div class="qpf-left">\
						<input type="text" class="qpf-spinner-value" data-bind="value:value,valueUpdate:valueUpdate" />\
					</div>\
					<div class="qpf-right">\
						<div class="qpf-common-button qpf-increase" data-bind="click:increase">\
						+</div>\
						<div class="qpf-common-button qpf-decrease" data-bind="click:decrease">\
						-</div>\
					</div>',

		afterRender : function() {
			var self = this;
			// disable selection
			this.$el.find('.qpf-increase,.qpf-decrease').mousedown(function(e) {
				e.preventDefault();
			});

			Draggable.applyTo(this, {
				updateDomPosition: false
			});

			this.draggable.add(this.$el.find('.qpf-right'));
			this.draggable.on('dragstart', this._onDragStart, this);
			this.draggable.on('drag', this._onDrag, this);

			this._$value = this.$el.find(".qpf-spinner-value")
			// numeric input only
			this._$value.keydown(function(event) {
				var keyCode = event.keyCode;
				// Allow: backspace, delete, tab, escape, minus, dot, enter
				if (
					keyCode == 46 || keyCode == 8 || keyCode == 9 || keyCode == 27 || keyCode == 190 || keyCode == 189 || keyCode == 13 ||
					 // Allow: Ctrl+A
					(keyCode == 65 && event.ctrlKey === true) || 
					// Allow: home, end, left, right
					(keyCode >= 35 && keyCode <= 39)
				) {
					// let it happen, don't do anything
					return;
				}
				else {
					// Ensure that it is a number and stop the keypress
					if (event.shiftKey || (keyCode < 48 || keyCode > 57) && (keyCode < 96 || keyCode > 105)) {
						event.preventDefault(); 
					}
		        }
			});

			this._$value.change(function() {
				// sync the value in the input
				if (this.value !== self.value().toString()) {
					this.value = self.value();
				}
			})
		},

		_onDragStart : function(e) {
			this._y0 = e.pageY;
		},

		_onDrag : function(e) {
			var oy = e.pageY - this._y0;
			if (oy < 0) {
				oy = Math.floor(oy / 5);
			} else {
				oy = Math.ceil(oy / 5);
			}
			this.value(this.value() - this.step() * oy);
			this._y0 = e.pageY;
		}
	})

	Meta.provideBinding('spinner', Spinner);

	return Spinner;
});
/**
 * Vector widget
 * 
 * @VMProp  items
 * @VMProp  constrainProportion
 * @VMProp  constrainType
 * @VMProp  constrainRatio
 */
define('qpf/widget/Vector',['require','./Widget','../Base','../core/XMLParser','../meta/Slider','../meta/Spinner','knockout','$','_'],function(require) {

var Widget = require("./Widget");
var Base = require("../Base");
var XMLParser = require("../core/XMLParser");
var Slider = require("../meta/Slider");
var Spinner = require("../meta/Spinner");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var Vector = Widget.derive(function() {
    return {
        // data source of item can be spinner type
        // or slider type, distinguish with type field
        // @field type  spinner | slider
        items : ko.observableArray(),

        // set true if you want to constrain the proportions
        constrainProportion : ko.observable(false),

        constrainType : ko.observable("diff"),  //diff | ratio

        _toggleConstrain : function() {
            this.constrainProportion(! this.constrainProportion());
        },
        
        // Constrain ratio is only used when constrain type is ratio
        _constrainRatio : [],
        // Constrain diff is only uese when constrain type is diff
        _constrainDiff : [],
        // cache all sub spinner or slider components
        _sub : []
    }
}, {

    type : "VECTOR",

    css : 'vector',

    initialize : function() {
        this.$el.attr("data-bind", 'css:{"qpf-vector-constrain":constrainProportion}')
        // here has a problem that we cant be notified 
        // if the object in the array is updated
        this.items.subscribe(function(item) {
            // make sure self has been rendered
            if (this._$list) {
                this._cacheSubComponents();
                this._updateConstraint();
            }
        }, this);

        this.constrainProportion.subscribe(function(constrain) {
            if (constrain) {
                this._computeContraintInfo();
            }
        }, this);
    },

    eventsProvided : _.union(Widget.prototype.eventsProvided, "change"),

    template : '<div class="qpf-left">\
                    <div class="qpf-vector-link" data-bind="click:_toggleConstrain"></div>\
                </div>\
                <div class="qpf-right" >\
                    <ul class="qpf-list" data-bind="foreach:items">\
                        <li data-bind="qpf:$data"></li>\
                    </ul>\
                </div>',

    afterRender : function() {
        // cache the list element
        this._$list = this.$el.find(".qpf-list");

        this._cacheSubComponents();
        this._updateConstraint();
    },

    onResize : function() {
        _.each(this._sub, function(item) {
            item.onResize();
        })
        Widget.prototype.onResize.call(this);
    },

    dispose : function() {
        _.each(this._sub, function(item) {
            item.dispose();
        });
        Base.prototype.dispose.call(this);
    },

    _cacheSubComponents : function() {

        var self = this;
        self._sub = [];

        this._$list.children().each(function() {
            
            var component = Base.getByDom(this);
            self._sub.push(component);
        });

        this._computeContraintInfo();
    },

    _computeContraintInfo : function() {
        this._constrainDiff = [];
        this._constrainRatio = [];
        _.each(this._sub, function(sub, idx) {
            var next = this._sub[idx+1];
            if (! next) {
                return;
            }
            var value = sub.value(),
                nextValue = next.value();
            this._constrainDiff.push(nextValue-value);

            this._constrainRatio.push(value == 0 ? 1 : nextValue/value);

        }, this);
    },

    _updateConstraint : function() {

        _.each(this._sub, function(sub) {

            sub.on("change", this._constrainHandler, this);
        }, this)
    },

    _constrainHandler : function(newValue, prevValue, sub) {

        if (this.constrainProportion()) {

            var selfIdx = this._sub.indexOf(sub),
                constrainType = this.constrainType();

            for (var i = selfIdx; i > 0; i--) {
                var current = this._sub[i].value,
                    prev = this._sub[i-1].value;
                if (constrainType == "diff") {
                    var diff = this._constrainDiff[i-1];
                    prev(current() - diff);
                } else if (constrainType == "ratio") {
                    var ratio = this._constrainRatio[i-1];
                    prev(current() / ratio);
                }

            }
            for (var i = selfIdx; i < this._sub.length-1; i++) {
                var current = this._sub[i].value,
                    next = this._sub[i+1].value;

                if (constrainType == "diff") {
                    var diff = this._constrainDiff[i];
                    next(current() + diff);
                } else if (constrainType == "ratio") {
                    var ratio = this._constrainRatio[i];
                    next(current() * ratio);
                }
            }
        }
    }
})

Widget.provideBinding("vector", Vector);

XMLParser.provideParser("vector", function(xmlNode) {
    var items = [];
    var children = XMLParser.util.getChildren(xmlNode);
    
    children = _.filter(children, function(child) {
        var tagName = child.tagName && child.tagName.toLowerCase();
        return tagName && (tagName === "spinner" || tagName === "slider");
    });
    _.each(children, function(child) {
        var attributes = XMLParser.util.convertAttributes(child.attributes);
        attributes.type = child.tagName.toLowerCase();
        items.push(attributes);
    });
    if (items.length) {
        return {
            items : items
        }
    }
})

return Vector;

});
/**
 * Textfiled component
 *
 * @VMProp text
 * @VMProp placeholder
 *
 */
define('qpf/meta/TextField',['require','./Meta','knockout','_'],function(require) {

    var Meta = require("./Meta");
    var ko = require("knockout");
    var _ = require("_");

    var TextField = Meta.derive(function() {
        return {
            tag : "div",

            text : ko.observable(""),
                
            placeholder : ko.observable("")
        };
    }, {
        
        type : "TEXTFIELD",

        css : 'textfield',

        template : '<input type="text" data-bind="attr:{placeholder:placeholder}, value:text"/>',

        onResize : function() {
            this.$el.find("input").width( this.width() );
            Meta.prototype.onResize.call(this);
        }
    })

    Meta.provideBinding("textfield", TextField);

    return TextField;
});
/**
 * Palette
 */
define('qpf/widget/Palette',['require','./Widget','./ColorViewModel','knockout','$','_','./Vector','../meta/TextField','../meta/Slider'],function(require) {

    var Widget = require("./Widget");
    var ColorViewModel = require("./ColorViewModel");
    var ko = require("knockout");
    var $ = require("$");
    var _ = require("_");

    // component will be used in the widget
    require("./Vector");
    require("../meta/TextField");
    require("../meta/Slider");

    var Palette = Widget.derive(function() {
        var ret = new ColorViewModel;
        var self = this;

        _.extend(ret, {
            _recent : ko.observableArray(),
            _recentMax : 5
        });
        return ret;
    }, {

        type : 'PALETTE',

        css : 'palette',

        eventsProvided : _.union(Widget.prototype.eventsProvided, ['change', 'apply', 'cancel']),

        template :  '<div class="qpf-palette-adjuster">\
                        <div class="qpf-left">\
                            <div class="qpf-palette-picksv" data-bind="style:{backgroundColor:hueRGB}">\
                                <div class="qpf-palette-saturation">\
                                    <div class="qpf-palette-value"></div>\
                                </div>\
                                <div class="qpf-palette-picker"></div>\
                            </div>\
                            <div class="qpf-palette-pickh">\
                                <div class="qpf-palette-picker"></div>\
                            </div>\
                            <div style="clear:both"></div>\
                            <div class="qpf-palette-alpha">\
                                <div class="qpf-palette-alpha-slider" data-bind="qpf:{type:\'slider\', min:0, max:1, value:alpha, precision:2}"></div>\
                            </div>\
                        </div>\
                        <div class="qpf-right">\
                            <div class="qpf-palette-rgb">\
                                <div data-bind="qpf:{type:\'label\', text:\'RGB\'}"></div>\
                                <div data-bind="qpf:{type:\'vector\', items:rgbVector}"></div>\
                            </div>\
                            <div class="qpf-palette-hsv">\
                                <div data-bind="qpf:{type:\'label\', text:\'HSV\'}"></div>\
                                <div data-bind="qpf:{type:\'vector\', items:hsvVector}"></div>\
                            </div>\
                            <div class="qpf-palette-hex">\
                                <div data-bind="qpf:{type:\'label\', text:\'#\'}"></div>\
                                <div data-bind="qpf:{type:\'textfield\',text:hexString}"></div>\
                            </div>\
                        </div>\
                    </div>\
                    <div style="clear:both"></div>\
                    <ul class="qpf-palette-recent" data-bind="foreach:_recent">\
                        <li data-bind="style:{backgroundColor:rgbString},\
                                        attr:{title:hexString},\
                                        click:$parent.hex.bind($parent, hex)"></li>\
                    </ul>\
                    <div class="qpf-palette-buttons">\
                        <div data-bind="qpf:{type:\'button\', text:\'Cancel\', class:\'small\', onclick:_cancel.bind($data)}"></div>\
                        <div data-bind="qpf:{type:\'button\', text:\'Apply\', class:\'small\', onclick:_apply.bind($data)}"></div>\
                    </div>',

        initialize : function() {
            this.hsv.subscribe(function(hsv) {
                this._setPickerPosition();
                this.trigger("change", this.hex());
            }, this);
            // incase the saturation and value is both zero or one, and
            // the rgb value not change when hue is changed
            this._h.subscribe(this._setPickerPosition, this);
        },
        afterRender : function() {
            this._$svSpace = this.$el.find('.qpf-palette-picksv');
            this._$hSpace = this.$el.find('.qpf-palette-pickh');
            this._$svPicker = this._$svSpace.children('.qpf-palette-picker');
            this._$hPicker = this._$hSpace.children('.qpf-palette-picker');

            this._svSize = this._$svSpace.height();
            this._hSize = this._$hSpace.height();

            this._setPickerPosition();
            this._setupSvDragHandler();
            this._setupHDragHandler();
        },
        onResize : function() {
            var $slider = this.$el.find(".qpf-palette-alpha-slider");
            if ($slider.length) {
                $slider.qpf("get")[0].onResize();
            }

            if (this._$svSpace) {
                this._svSize = this._$svSpace.height();
                this._hSize = this._$hSpace.height();
            }

            Widget.prototype.onResize.call(this);
        },

        _setupSvDragHandler : function() {
            var self = this;

            var _getMousePos = function(e) {
                var offset = self._$svSpace.offset(),
                    left = e.pageX - offset.left,
                    top = e.pageY - offset.top;
                return {
                    left :left,
                    top : top
                }
            };
            var _mouseMoveHandler = function(e) {
                var pos = _getMousePos(e);
                self._computeSV(pos.left, pos.top);
            }
            var _mouseUpHandler = function(e) {
                $(document.body).unbind("mousemove", _mouseMoveHandler)
                                .unbind("mouseup", _mouseUpHandler)
                                .unbind('mousedown', _disableSelect);
            }
            var _disableSelect = function(e) {
                e.preventDefault();
            }
            this._$svSpace.mousedown(function(e) {
                var pos = _getMousePos(e);
                self._computeSV(pos.left, pos.top);

                $(document.body).bind("mousemove", _mouseMoveHandler)
                                .bind("mouseup", _mouseUpHandler)
                                .bind("mousedown", _disableSelect);
            })
        },

        _setupHDragHandler : function() {
            var self = this;

            var _getMousePos = function(e) {
                var offset = self._$hSpace.offset(),
                    top = e.pageY - offset.top;
                return top;
            };
            var _mouseMoveHandler = function(e) {
                self._computeH(_getMousePos(e));
            };
            var _disableSelect = function(e) {
                e.preventDefault();
            }
            var _mouseUpHandler = function(e) {
                $(document.body).unbind("mousemove", _mouseMoveHandler)
                                .unbind("mouseup", _mouseUpHandler)
                                .unbind('mousedown', _disableSelect);
            }

            this._$hSpace.mousedown(function(e) {
                self._computeH(_getMousePos(e));

                $(document.body).bind("mousemove", _mouseMoveHandler)
                                .bind("mouseup", _mouseUpHandler)
                                .bind("mousedown", _disableSelect);
            })

        },

        _computeSV : function(left, top) {
            var saturation = left / this._svSize,
                value = (this._svSize-top)/this._svSize;

            this._s(saturation*100);
            this._v(value*100);
        },

        _computeH : function(top) {

            this._h(top/this._hSize * 360);
        },

        _setPickerPosition : function() {
            if (this._$svPicker) {
                var hsv = this.hsv();
                var hue = hsv[0];
                var saturation = hsv[1];
                var value = hsv[2];
                
                // set position relitave to space
                this._$svPicker.css({
                    left : Math.round(saturation/100 * this._svSize) + "px",
                    top : Math.round((100-value)/100 * this._svSize) + "px"
                });
                this._$hPicker.css({
                    top : Math.round(hue/360 * this._hSize) + "px"
                });
            }
        },

        _apply : function() {
            if (this._recent().length > this._recentMax) {
                this._recent.shift();
            }
            this._recent.push({
                rgbString : "rgb(" + this.rgb().join(",") + ")",
                hexString : this.hexString(),
                hex : this.hex()
            });
            
            this.trigger("apply", this.hex());
        },

        _cancel : function() {
            this.trigger("cancel")
        }
    })

    Widget.provideBinding("palette", Palette);

    return Palette;
});
define('qpf/widget/PaletteWindow',['require','./Palette','../container/Window','knockout','_'],function(require){
    
    var Palette = require("./Palette");
    var Window = require('../container/Window')
    var ko = require("knockout");

    var _ = require('_');

    var PaletteWindow = Window.derive({
        
        _palette: null

    }, {
        type: 'PALETTEWINDOW',

        css: _.union('palette-window', Window.prototype.css),

        initialize: function() {

            Window.prototype.initialize.call(this);
            
            this._palette = new Palette();

            this._palette.width(370);

            this.add(this._palette);

            this.title("Palette");
        },

        show: function() {
            this.$el.show();

            this.$el.css({
                left: Math.round($(window).width() / 2 - this.$el.width() / 2) + 'px',
                top: Math.round($(window).height() / 2 - this.$el.height() / 2) + 'px',
            });
        },

        hide: function() {
            this.$el.hide();
        },

        getPalette: function() {
            return this._palette;
        }
    });

    return PaletteWindow;
});
define('qpf/meta/Color',['require','./Meta','knockout','../core/color','../widget/PaletteWindow'],function(require) {

    var Meta = require('./Meta');
    var ko = require('knockout');
    var colorUtil = require('../core/color');

    var PaletteWindow = require('../widget/PaletteWindow');

    function hexToString(hex) {
        var string = hex.toString(16);
        var fill = [];
        for (var i = 0; i < 6-string.length; i++) {
            fill.push('0');
        }
        return "#" + fill.join("") + string;
    }

    function hexToRgb(value) {
        var r = (value >> 16) & 0xff;
        var g = (value >> 8) & 0xff;
        var b = value & 0xff;
        return [r, g, b];
    }

    function rgbToHex(r, g, b) {
        return r << 16 | g << 8 | b;
    }

    // Share one palette window instance
    var _paletteWindow = null;

    var Color = Meta.derive(function() {
        var ret = {

            color: ko.observable('#ffffff'),

            _palette: null
        }
        var self = this;

        ret._colorHexStr = ko.computed(function() {
            var color = ret.color();
            if (typeof(color) == 'string') {
                var rgb = colorUtil.parse(ret.color());
                var hex = rgbToHex(rgb[0], rgb[1], rgb[2]);   
            } else {
                var hex = color;
            }
            return hexToString(hex).toUpperCase();
        });

        return ret;
    }, {

        type: 'COLOR',

        css: 'color',

        template : '<div data-bind="text:_colorHexStr" class="qpf-color-hex"></div>\
                    <div class="qpf-color-preview" data-bind="style:{backgroundColor:_colorHexStr()}"></div>',

        initialize: function() {
            var self = this;

            if (!_paletteWindow) {

                _paletteWindow = new PaletteWindow({
                    temporary: true
                });
                _paletteWindow.$el.hide();

                document.body.appendChild(_paletteWindow.$el[0]);

                _paletteWindow.render();
            }

            this._palette = _paletteWindow.getPalette();

            this.$el.click(function(){
                self.showPalette();
            });
        },

        showPalette : function(){

            _paletteWindow.show();

            this._palette.on("change", this._paletteChange, this);
            this._palette.on("cancel", this._paletteCancel, this);
            this._palette.on("apply", this._paletteApply, this);


            var color = this.color();
            if (typeof(color) == 'string') {
                var rgb = colorUtil.parse(this.color());
            } else {
                var rgb = hexToRgb(color);
            }

            this._palette.set(rgbToHex(rgb[0], rgb[1], rgb[2]));
        },

        _paletteChange : function(hex) {
            if (typeof(this.color()) == 'string') {
                this.color(hexToString(hex));
            } else {
                this.color(hex);
            }
        },

        _paletteCancel : function(){

            _paletteWindow.hide();
            
            this._palette.off("change");
            this._palette.off("apply");
            this._palette.off("cancel");
        },

        _paletteApply : function(){
            this._paletteCancel();
        }
    });
    
    Meta.provideBinding('color', Color);

    return Color;
});
/**
 * Combobox component
 * 
 * @VMProp  value
 * @VMProp  items
 *          @property   value
 *          @property   text
 */
define('qpf/meta/ComboBox',['require','./Meta','../core/XMLParser','knockout','$','_'],function(require) {

var Meta = require("./Meta");
var XMLParser = require("../core/XMLParser");
var ko = require("knockout");
var $ = require("$");
var _ = require("_");

var Combobox = Meta.derive(function() {
    return {
        $el : $('<div data-bind="css:{active:active}" tabindex="0"></div>'),

        value : ko.observable(),

        items : ko.observableArray(),   //{value, text}

        defaultText : ko.observable("select"),

        active : ko.observable(false),
    };
}, {
    
    type : 'COMBOBOX',

    css : 'combobox',

    eventsProvided : _.union(Meta.prototype.eventsProvided, "change"),

    initialize : function() {

        this.selectedText = ko.computed(function() {
            var val = this.value();
            var result =  _.filter(this.items(), function(item) {
                return ko.utils.unwrapObservable(item.value) == val;
            })[0];
            if (typeof(result) == "undefined") {
                return this.defaultText();
            }
            return ko.utils.unwrapObservable(result.text);
        }, this);

    },

    template : '<div class="qpf-combobox-selected" data-bind="click:_toggle">\
                    <div class="qpf-left" data-bind="html:selectedText"></div>\
                    <div class="qpf-right qpf-common-button">\
                        <div class="qpf-icon"></div>\
                    </div>\
                </div>\
                <ul class="qpf-combobox-items" data-bind="foreach:items">\
                    <li data-bind="html:text,attr:{\'data-qpf-value\':value},click:$parent._select.bind($parent,value),css:{selected:$parent._isSelected(value)}"></li>\
                </ul>',

    afterRender : function() {

        var self = this;
        this._$selected = this.$el.find(".qpf-combobox-selected");
        this._$items = this.$el.find(".qpf-combobox-items");

        this.$el.blur(function() {
            self._blur();
        })

    },

    //events
    _focus : function() {
        this.active(true);
    },
    _blur : function() {
        this.active(false);
    },
    _toggle : function() {
        this.active(! this.active());
    },
    _select : function(value) {
        value = ko.utils.unwrapObservable(value);
        this.value(value);
        this._blur();
    },
    _isSelected : function(value) {
        return this.value() === ko.utils.unwrapObservable(value);
    }
})

Meta.provideBinding("combobox", Combobox);

XMLParser.provideParser('combobox', function(xmlNode) {
    var items = [];
    var nodes = XMLParser.util.getChildrenByTagName(xmlNode, "item");
    _.each(nodes, function(child) {
        // Data source can from item tags of the children
        var value = child.getAttribute("value");
        var text = child.getAttribute("text") ||
                    XMLParser.util.getTextContent(child);

        if (value !== null) {
            items.push({
                value : value,
                text : text
            })
        }
    })
    if (items.length) {
        return {
            items : items
        }
    }
})


return Combobox;

});
define('qpf/meta/IconButton',['require','./Button','./Meta','knockout'],function(require){

    var Button = require("./Button");
    var Meta = require("./Meta");
    var ko = require("knockout");

    var IconButton = Button.derive(function(){
        return {
            $el : $("<div></div>"),
            icon : ko.observable("")
        }
    }, {
        type : "ICONBUTTON",
        css : _.union("icon-button", Button.prototype.css),

        template : '<div class="qpf-icon" data-bind="css:icon"></div>',
    })

    Meta.provideBinding("iconbutton", IconButton);

    return IconButton;

});
/**
 * Label component
 */
define('qpf/meta/Label',['require','./Meta','../core/XMLParser','knockout','$','_'],function(require) {

    var Meta = require("./Meta");
    var XMLParser = require("../core/XMLParser");
    var ko = require("knockout");
    var $ = require("$");
    var _ = require("_");

    var Label = Meta.derive(function() {
        return {
            // value of the Label
            text : ko.observable('Label')        
        };
    }, {

        template : '<Label data-bind="html:text"></Label>',

        type : 'LABEL',

        css : 'label'
    });

    Meta.provideBinding("label", Label);

    // provide parser when do xmlparsing
    XMLParser.provideParser("label", function(xmlNode) {
        var text = XMLParser.util.getTextContent(xmlNode);
        if (text) {
            return {
                text : text
            }
        }
    })

    return Label;

});
// default list item component
define('qpf/meta/NativeHtml',['require','./Meta','../core/XMLParser','knockout','_'],function(require){

    var Meta = require("./Meta");
    var XMLParser = require("../core/XMLParser");
    var ko = require("knockout");
    var _ = require("_");

    var NativeHtml = Meta.derive(function(){
        return {
            $el : $('<div data-bind="html:html"></div>'),
            html : ko.observable("")
        }
    }, {
        type : "NATIVEHTML",
        
        css : "native-html"
    })

    Meta.provideBinding("nativehtml", NativeHtml);

    XMLParser.provideParser("nativehtml", function(xmlNode){
        var children = XMLParser.util.getChildren(xmlNode);
        var html = "";
        _.each(children, function(child){
            // CDATA
            if(child.nodeType === 4){
                html += child.textContent;
            }
        });
        if( html ){
            return {
                html : html
            }
        }
    })

    return NativeHtml;
});
/**
 * Tree Component
 * Example
 * ----------------xml---------------
 * <tree>
 *   <item icon="assets/imgs/file.gif">foo</item>
 *   <item css="folder">
 *     <item title="bar" icon="assets/imgs/file.gif"></item>
 *   </item>
 * </tree>
 * ----------------------------------
 * 
 */
define('qpf/meta/Tree',['require','./Meta','knockout','$','_','../core/XMLParser'],function(require) {

    var Meta = require("./Meta");
    var ko = require('knockout');
    var $ = require('$');
    var _ = require("_");
    var XMLParser = require('../core/XMLParser');

    var Tree = Meta.derive(function() {
        return {
            // Example
            // [{
            //    title : "" | ko.observable(),
            //    icon  : "" | ko.observable(),      //icon img url
            //    css   : "" | ko.observable(),      //css class
            //    items : [] | ko.observableArray()  //sub items
            // }]
            items : ko.observableArray(),

            draggable : ko.observable(false),

            renamble : ko.observable(false),

            indent : ko.observable(20),

            // the depth of node, root is 0;
            __depth__ : 0,
            __nodeIndex__ : 0,

            __root__ : this
        };
    }, {

        type : "TREE",
        
        css : 'tree',

        template : '<ul data-bind="foreach:items">\
                        <li data-bind="qpf_tree_itemview:$data"></li>\
                    </ul>'
    })

    var itemTemplate = '<li class="qpf-tree-item">\
                            <div class="qpf-tree-item-title"\
                                    data-bind="style:{paddingLeft:_paddingLeftPx}">\
                                <!--ko if:items-->\
                                <span class="qpf-tree-unfold"></span>\
                                <!--/ko-->\
                                <span class="qpf-tree-icon" data-bind="css:css"></span>\
                                <a class="qpf-tree-item-caption" data-bind="text:title"></a>\
                            </div>\
                            <!--ko if:items-->\
                            <ul class="qpf-tree-subitems" data-bind="foreach:items">\
                                <li data-bind="qpf_tree_itemview:$data"></li>\
                            </ul>\
                            <!--/ko-->\
                        </li>';

    ko.bindingHandlers["qpf_tree_itemview"] = {
        init : function(element, valueAccessor, allBindingAccessor, viewModel, bindingContext) {
            var data = bindingContext.$data;
            var parent = bindingContext.$parent;
            var root = parent.__root__;

            var $itemEl = $(itemTemplate);

            // Default properties
            // In case there is no items property in data
            if( ! data.items){   
                data.items = null;
            }
            if( ! data.css) {
                data.css = data.items ? "qpf-tree-folder" : "qpf-tree-file";
            }
            // private data
            data.__root__ = root;
            data.__depth__ = parent.__depth__+1;

            data._paddingLeftPx = ko.computed(function() {
                return data.__depth__ * ko.utils.unwrapObservable( root.indent ) + "px";
            });
            data

            element.parentNode.replaceChild($itemEl[0], element);
            ko.applyBindings(data, $itemEl[0]);

            return { 'controlsDescendantBindings': true };

        }
    }

    Meta.provideBinding("tree", Tree);

    return Tree;
});
/**
 * Util.js
 * provide util function to operate
 * the components
 */
define('qpf/util',['require','knockout','./core/XMLParser','./Base'],function(require) {

    var ko = require("knockout");
    var XMLParser = require("./core/XMLParser");
    var Base = require("./Base");
    var exports = {};

    // Return an array of components created from XML
    exports.createComponentsFromXML = function(XMLString, viewModel) {
        var dom = XMLParser.parse(XMLString);
        ko.applyBindings(viewModel || {}, dom);
        var ret = [];
        var node = dom.firstChild;
        while (node) {
            var component = Base.getByDom(node);
            if (component) {
                ret.push(component);
            }
            node = node.nextSibling;
        }
        return ret;
    }

    exports.initFromXML = function(dom, XMLString, viewModel) {
        var components = exports.createComponentsFromXML(XMLString, viewModel);
        for (var i = 0; i < components.length; i++) {
            dom.appendChild(components[i].$el[0]);
        }
        return components;
    }

    exports.init = function(dom, viewModel, callback) {
        ko.applyBindings(dom, viewModel);

        var xmlPath = dom.getAttribute('data-qpf-xml');
        if (xmlPath) {
            $.get(xmlPath, function(XMLString) {
                exports.initFromXML(dom, XMLString, viewModel);
                callback && callback();
            }, 'text');
        }
    }

    return exports;

})
;
define('qpf/qpf',['require','qpf/Base','qpf/container/Accordian','qpf/container/Application','qpf/container/Box','qpf/container/Container','qpf/container/HBox','qpf/container/Inline','qpf/container/List','qpf/container/Panel','qpf/container/Tab','qpf/container/VBox','qpf/container/Window','qpf/core/Clazz','qpf/core/XMLParser','qpf/core/color','qpf/core/mixin/derive','qpf/core/mixin/notifier','qpf/helper/Draggable','qpf/helper/Resizable','qpf/meta/Button','qpf/meta/CheckBox','qpf/meta/Color','qpf/meta/ComboBox','qpf/meta/IconButton','qpf/meta/Label','qpf/meta/ListItem','qpf/meta/Meta','qpf/meta/NativeHtml','qpf/meta/Slider','qpf/meta/Spinner','qpf/meta/TextField','qpf/meta/Tree','qpf/util','qpf/widget/ColorViewModel','qpf/widget/Palette','qpf/widget/PaletteWindow','qpf/widget/Vector','qpf/widget/Widget'],function(require){
    
    var qpf =  {
	"Base": require('qpf/Base'),
	"container": {
		"Accordian": require('qpf/container/Accordian'),
		"Application": require('qpf/container/Application'),
		"Box": require('qpf/container/Box'),
		"Container": require('qpf/container/Container'),
		"HBox": require('qpf/container/HBox'),
		"Inline": require('qpf/container/Inline'),
		"List": require('qpf/container/List'),
		"Panel": require('qpf/container/Panel'),
		"Tab": require('qpf/container/Tab'),
		"VBox": require('qpf/container/VBox'),
		"Window": require('qpf/container/Window')
	},
	"core": {
		"Clazz": require('qpf/core/Clazz'),
		"XMLParser": require('qpf/core/XMLParser'),
		"color": require('qpf/core/color'),
		"mixin": {
			"derive": require('qpf/core/mixin/derive'),
			"notifier": require('qpf/core/mixin/notifier')
		}
	},
	"helper": {
		"Draggable": require('qpf/helper/Draggable'),
		"Resizable": require('qpf/helper/Resizable')
	},
	"meta": {
		"Button": require('qpf/meta/Button'),
		"CheckBox": require('qpf/meta/CheckBox'),
		"Color": require('qpf/meta/Color'),
		"ComboBox": require('qpf/meta/ComboBox'),
		"IconButton": require('qpf/meta/IconButton'),
		"Label": require('qpf/meta/Label'),
		"ListItem": require('qpf/meta/ListItem'),
		"Meta": require('qpf/meta/Meta'),
		"NativeHtml": require('qpf/meta/NativeHtml'),
		"Slider": require('qpf/meta/Slider'),
		"Spinner": require('qpf/meta/Spinner'),
		"TextField": require('qpf/meta/TextField'),
		"Tree": require('qpf/meta/Tree')
	},
	"util": require('qpf/util'),
	"widget": {
		"ColorViewModel": require('qpf/widget/ColorViewModel'),
		"Palette": require('qpf/widget/Palette'),
		"PaletteWindow": require('qpf/widget/PaletteWindow'),
		"Vector": require('qpf/widget/Vector'),
		"Widget": require('qpf/widget/Widget')
	}
};

    qpf.create = qpf.Base.create;
    
    qpf.init = qpf.util.init;

    return qpf;
});
define('qpf', ['qpf/qpf'], function (main) { return main; });
