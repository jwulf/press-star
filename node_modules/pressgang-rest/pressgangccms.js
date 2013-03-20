/*!
 * pressgang-ccms-rest-node
 * Copyright(c) 2012 Red Hat <jwulf@learnboost.com>
 * BSD Licensed
 */
 
// pressgang-ccms-rest-node is a module for communicating with a PressGang CCMS server
// via its REST interface

var rest = require('restler');
var eventEmitter = require('events').EventEmitter;
var util = require('util');

var constants = { contentSpecTagID: 268 }

module.exports.PressGangCCMS = PressGangCCMS;

function PressGangCCMS(options){

	if ('string' == typeof options)
		this.url = options;
    if (options.url)
        this.url = options.url;

// Authentication is not implemented in PressGang yet
    this.settings = {
        username: '',
        authmethod: '',
        authtoken: '',
        restver: 1,
		loglevel: 0
    }

    if (options && options.key){
        for (var i in options) {
            if (options.hasOwnProperty(i)) {
                this.settings[i] = options[i];
            }
        }
    }
}

util.inherits(PressGangCCMS, eventEmitter);

PressGangCCMS.prototype.log = function(msg, lvl) {
    if (this.settings.loglevel > lvl) console.log(msg);
}

PressGangCCMS.prototype.get = function (key) {
  return this.settings[key];
}

PressGangCCMS.prototype.set = function (key, value) {
  if (arguments.length == 1) return this.get(key);
  this.settings[key] = value;
  this.emit('set:' + key, this.settings[key], key);
  return this;
};


PressGangCCMS.prototype.isContentSpec = function(topic_id, cb)
{
    this.getTopicData('topic-tags', topic_id, function(err, result){ 
        if (!err)
        {
            var is_spec = false;
            if (result && result.length > 0){
                for (var i = 0; i < result.length; i ++){
                    if (result[i].item.id == constants.contentSpecTagID) is_spec = true;
                }
            }
        }
        cb(err, is_spec);
    });
}

PressGangCCMS.prototype.getTopicData = function(data_request, topic_id, cb)
{
    this.log(this.settings,2);
    if (this.url)
    {
        var requestpath;

        // assemble the request path from the url, data_request, and topic id
        switch (this.settings.restver){
            case 1: // REST API v.1
                switch(data_request){ // These are the different data requests we support
                
                    // 'xml': Return the topic xml (plain text in the case of a Content Spec
                    case 'xml':
                        requestpath = '/seam/resource/rest/1/topic/get/xml/' + topic_id +'/xml';
                        break;
                   
                    // 'json-topic': Return the json representation of a topic
                    case 'json-topic':
                        requestpath = '/seam/resource/rest/1/topic/get/json/' + topic_id;
                        break;
                
                    // 'topic-tags': Return an expanded collection of tags
                    case 'topic-tags':
                        requestpath = '/seam/resource/rest/1/topic/get/json/' + topic_id + '?expand='
                        requestpath = requestpath + encodeURIComponent('{"branches":[{"trunk":{"name":"tags"}}]}'); 
                        break;
            }
            break;
        }
        
        this.log(this.url + requestpath, 2);
        
        rest.get(this.url + requestpath).on('complete', function(result){
            if (result instanceof Error)
            {
                if ('function' == typeof cb) cb(result);
            }
            else
            {
                var parsed_result = result;
                
                // Will need to be switched on REST ver in the future also, 
                // or perhaps a single switch that encompasses the entire pathway
                // including the REST call
                switch(data_request){
                    case 'topic-tags':
                        parsed_result = result.tags.items; 
                }
                
                cb(null, parsed_result);
            }
        });
    }
    else
    {
        cb(new Error('No server URL specified'));
    }
}


