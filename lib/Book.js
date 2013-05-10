var EventEmitter = require("events").EventEmitter,
    livePatch = require('./livePatch');

// http://www.bennadel.com/blog/2187-Extending-EventEmitter-To-Create-An-Evented-Cache-In-Node-js.htm

// Include the events library so we can extend the EventEmitter
// class. This will allow our evented cache to emit() events
// when various mutations take place.
var EventEmitter = require("events").EventEmitter;


// ---------------------------------------------------------- //
// ---------------------------------------------------------- //


// I am the Book constructor. I have properties that are key:value pairs, which can optionally
// emit events. I can also take a shadow object as a parameter to my constructor
// The shadow object is updated with a copy of my event emitting keys.
function Book(shadow) {
    var EMIT_EVENTS = true;

    // Call the super constructor.
    EventEmitter.call(this);

    // The shadow object is a view of the event emitting keys only
    this._shadow = shadow;

    // I am the cache of name-value pairs being stored.
    this._cache = {};

    // I am the collection of values added as implicit getter /
    // setters. We need to keep track of these so that when the
    // value gets removed from the cache, we'll know if we need to
    // remove the implicit getter / setter.
    this._getterSetters = {};

    this.set('serverurl', '');
    this.set('id', '', EMIT_EVENTS);
    this.set('description', '');
    this.set('title', '', EMIT_EVENTS);
    this.set('subtitle', '');
    this.set('uuid', '', EMIT_EVENTS);
    this.set('building', '', EMIT_EVENTS);
    this.set('publishing', false, EMIT_EVENTS)
    this.set('publishID', '', EMIT_EVENTS);
    this.set('brewTask', '', EMIT_EVENTS);
    this.set('inBrew', false, EMIT_EVENTS);
    this.set('onPublishQueue', false, EMIT_EVENTS);
    this.set('product', '', EMIT_EVENTS);
    this.set('version', '', EMIT_EVENTS);
    this.set('building', false, EMIT_EVENTS);
    this.set('onBuildQueue', false, EMIT_EVENTS);
    this.set('onQueue', false, EMIT_EVENTS);
    this.set('buildingForReals', true, EMIT_EVENTS);
    this.set('edition', '');
    this.set('pubsnumber', '');
    this.set('dtd', '');
    this.set('copyright', '');
    this.set('bzcomponent', '');
    this.set('bzproduct', '');
    this.set('brand', '');
    this.set('revhistory', '');
    this.set('entityfile', '');
    this.set('bookdir', '');
    this.set('url', '');
    this.set('assemblylog', '');
    this.set('lastBuildSpecRevision', '');
    this.set('contentSpec', '');
    this.set('builtFilename', '');
    this.set('publicanDirectory', '');
    this.set('prePublishDir', '');
    this.set('publishDir', '');
    this.set('HTMLPrePublish', '');
    this.set('HTMLPostPublish', '');
    this.set('fixedRevisionTopics', {});
    this.set('topicRevisions', {});
    this.set('buildlogURL', '');
    
    // Return this object reference.
    return (this);
}

// Extend the event emitter class so that we can use on() and emit()
// in conjunction with cache-based mutations.
Book.prototype = Object.create(EventEmitter.prototype);


// I clear the local cache.
Book.prototype.clear = function() {

    // Keep track of the number of items being cleared.
    var clearCount = 0;

    // Loop over the object to remove each key individually. This
    // will allow a "remove" event to be emitted for each key in the
    // current cache.
    for (var key in this._cache) {

        // Make sure this is a local property (and is not a property
        // coming from higher up in the prototype chain).
        if (this._cache.hasOwnProperty(key)) {

            // Remove the key.
            this.remove(key);

            // Increment our clear counter.
            clearCount++;

        }

    }

    // Emit the clear event.
    this.emit("clear", clearCount);

    // Return this object reference for method chaining.
    return (this);

};


// I get the value at the given key. If no value exists, an optional
// default value can be returned.
Book.prototype.get = function(name, defaultValue) {

    // Check to see if the name exists in the local cache.
    if (this._cache.hasOwnProperty(name)) {

        // Return the currently stored value.
        return (this._cache[name]._value);

    }

    // Return the default value (if it was provided) or null.
    return ((arguments.length == 2) ? defaultValue : null);

};


// I get all the values in the local cache. This does not break
// encapsulation - it does not return a reference to the internal
// cache store.
//
// NOTE: Cached complex objects are still passed by reference.
Book.prototype.getAll = function() {

    // Create a new transport object for our values. We don't want
    // to pass back the underlying cache value as that breaks our
    // layer of encapsulation.
    var transport = {};

    // Loop over each key and transfer it to the transport object.
    for (var key in this._cache) {

        // Make sure that this key is part of the actual cache.
        if (this._cache.hasOwnProperty(key)) {

            // Copy key/value pair over.
            transport[key] = this._cache[key]._value;

        }

    }
 
    // Return the collection.
    return (transport);

};


// I remove any value at the given name.
Book.prototype.remove = function(name) {

    // Check to see if the given name even exists in the local cache.
    if (this._cache.hasOwnProperty(name)) {

        // Get the current value.
        var value = this._cache[name];

        // Delete the cache entry.
        delete(this._cache[name]);

        // Delete any implicit getter / setter we created.
        this._removeGetterSetter(name);

        // Emit the remove event.
        this.emit("remove", name, value);

    }

    // Return this object reference for method chaining.
    return (this);

};


// I try to remove the implicit getter / setter properties.
Book.prototype._removeGetterSetter = function(name) {

    // Before we delete anything, make sure that the given property
    // was added as a getter / setter.
    if (!this._getterSetters.hasOwnProperty(name)) {

        // Return out - this property was not added as a getter /
        // setter. We don't want to run the risk of deleting a
        // critical value.
        return;

    }

    // Delete the getter / setter.
    delete(this[name]);

    // Delete the tracking of this value.
    delete(this._getterSetters[name]);

    // Return this object reference for method chaining.
    return (this);

};

// Allows you to set a bunch of values and suppress event emission for them
Book.prototype.setMany = function(values) {
    var NO_EVENT = true;

    if (values && typeof values == "object") {
        for (var key in values)
            this.set(key, values[key], null, NO_EVENT);
    }
}

// I set the value at the given name.
Book.prototype.set = function(name, value, emitter, suppress) {

    if (this._cache[name]) { // if it already exists
        // Store the value in the local cache.
        this._cache[name]._value = value;
    } else { // creating new property
        this._cache[name] = {};
        this._cache[name]._value = value;
        this._cache[name]._emit = (emitter) ? true: false;
    }

    // Try to add an implicit getter / setter for this value.
    this._setGetterSetter(name);

    // Emit the change event.
    if (this._cache[name]._emit && suppress !== true) {
        if (this._shadow) {
            this._shadow[name] = value;
        }

        var _event = {id: this.id, url: this.url, _name: name, _value: value};
        _event[name] = value;
        this.emit("change", _event);
    }
    // Return this object reference for method chaining.
    return (this);

};

Book.prototype.notify = function (type, msg, opts) {
    var _msg, _type, _id, _url, _opts, _notification;
    
    if (msg) {
        _type = type;
        _msg = msg;
    } else {
        _type = 'notification';
        _msg = type;
    }
    
    _id = this.get('id');
    _url = this.get('url');
    
    _notification = {};
    _notification[_type] = true;
    _notification.data = {};
    _notification.data.msg = _msg;
    
    if (opts) 
        for (var key in opts)
            _notification.data[key] = opts[key]._value;
            
    if (_id && _url) {
        if (livePatch.bookNotificationStreams[_url][_id]) {
            livePatch.bookNotificationStreams[_url][_id].write(_notification);
        }  
    }   
}

// I try to add the implicit getter / setter properties.
Book.prototype._setGetterSetter = function(name) {

    var that = this;

    // If the property already exists on the object (whether as
    // a getter/setter or a different value), we do not want to
    // overwrite it.
    if (name in this) {

        // Return out - we can't add the getter / setter without
        // possibly corrupting the instance API.
        return;

    }

    // Define the implicit getter.
    this.__defineGetter__(
    name,

    function() {
        return (that.get(name));
    });

    // Define the implicit setter.
    this.__defineSetter__(
    name,

    function(value, emit) {
        return (that.set(name, value, emit));
    });

    // Keep track of the getter / setter.
    this._getterSetters[name] = true;

    // Return this object reference for method chaining.
    return (this);

};


// ---------------------------------------------------------- //
// ---------------------------------------------------------- //


// Since this class is meant to be extended, export the constructor.
exports.Book = Book;