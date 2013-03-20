var restler = require("restler")

exports.DEFAULT_URL = 'http://127.0.0.1:8080/TopicIndex';
exports.CONTENT_SPEC_TAG_ID = 268;
exports.REST_API_PATH = '/seam/resource/rest/';
exports.REST_UPDATE_TOPIC_PATH = 'topic/update/json';
exports.DEFAULT_REST_VER = 1;
exports.DEFAULT_LOG_LEVEL = 0;
exports.DEFAULT_AUTH_METHOD = '';
exports.DATA_REQ = {
    xml: 'xml',
    topic_tags: 'topic_tags',
    json: 'json'
};
exports.ContentSpecMetadataSchema = [
    {
        attr: 'specrevision',
        rule: /^SPECREVISION[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'product',
        rule: /^PRODUCT[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'checksum',
        rule: /^CHECKSUM[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'subtitle',
        rule: /^SUBTITLE[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'title',
        rule: /^TITLE[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'edition',
        rule: /^EDITION[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'bookversion',
        rule: /^BOOK VERSION[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'pubsnumber',
        rule: /^PUBSNUMBER[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'description',
        rule: /^(DESCRIPTION|ABSTRACT)[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'copyright',
        rule: /^COPYRIGHT HOLDER[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'debug',
        rule: /^DEBUG[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'version',
        rule: /^VERSION[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'brand',
        rule: /^BRAND[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'buglinks',
        rule: /^BUG[ ]*LINKS[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'bzproduct',
        rule: /^BZPRODUCT[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'bzcomponent',
        rule: /^BZCOMPONENT[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'bzversion',
        rule: /^BZVERSION[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'surveylinks',
        rule: /^SURVEY[ ]*LINKS[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'translocale',
        rule: /^TRANSLATION LOCALE[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'type',
        rule: /^TYPE[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'outputstyle',
        rule: /^OUTPUT STYLE[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'publican.cfg',
        rule: /^PUBLICAN\\.CFG[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'inlineinject',
        rule: /^INLINE INJECTION[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'space',
        rule: /^spaces[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'dtd',
        rule: /^DTD[ ]*((=.*)|$)/i
    }, 
    {
        attr: 'id',
        rule: /^ID[ ]*((=.*)|$)/i
    }, 
    
];
var PressGangCCMS = (function () {
    function PressGangCCMS(settings) {
        this.setSelf();
        this.url = exports.DEFAULT_URL;
        if('string' == typeof settings) {
            this.url = settings;
        }
        if('object' == typeof settings && settings.url) {
            this.url = settings.url;
        }
        this.restver = exports.DEFAULT_REST_VER;
        this.loglevel = exports.DEFAULT_LOG_LEVEL;
        if('object' == typeof settings) {
            for(var i in settings) {
                this[i] = settings[i];
            }
        }
    }
    PressGangCCMS.prototype.setSelf = function () {
        this.self = this;
    };
    PressGangCCMS.prototype.supportedDataRequests = function () {
        return exports.DATA_REQ;
    };
    PressGangCCMS.prototype.log = function (msg, msglevel) {
        if(this.loglevel > msglevel) {
            console.log(msg);
        }
    };
    PressGangCCMS.prototype.isContentSpec = function (topic_id, cb) {
        var _is_spec;
        _is_spec = false;
        if(typeof cb !== 'function') {
            return;
        }
        if(typeof topic_id !== 'number') {
            return cb('Need numeric Topic ID as first argument', false);
        }
        this.getTopicData('topic_tags', topic_id, function (err, result) {
            if(err) {
                return cb(err, null);
            }
            if(result && result.length > 0) {
                for(var i = 0; i < result.length; i++) {
                    if(result[i].item.id && result[i].item.id === exports.CONTENT_SPEC_TAG_ID) {
                        _is_spec = true;
                    }
                }
            }
            return cb(err, _is_spec);
        });
    };
    PressGangCCMS.prototype.getTopicXML = function (topic_id, rev, cb) {
        this.getTopicData('xml', topic_id, rev, cb);
    };
    PressGangCCMS.prototype.getTopicData = function (data_request, topic_id, revORcb, cb) {
        var _this = this;
        var _rev;
        var _restver;
        var _result;

        if('function' == typeof cb) {
            if('number' !== typeof revORcb) {
                if(cb) {
                    return cb('Need numerical topic revision as third argument', null);
                }
            }
        }
        if('function' == typeof revORcb) {
            cb = revORcb;
        }
        if(!cb) {
            return;
        }
        if(!exports.DATA_REQ[data_request]) {
            return cb('Unsupported operation ' + data_request + ' passed as first argument', null);
        }
        if('number' !== typeof topic_id) {
            return cb('Need numerical Topic ID as second argument', null);
        }
        if('undefined' == typeof this.url || 'null' == typeof this.url || '' === this.url) {
            return cb('No server URL specified', null);
        }
        if(('number' == typeof revORcb) && (-1 !== revORcb)) {
            _rev = revORcb;
        }
        this.getBaseRESTPath(function (requestPath) {
            switch(data_request) {
                case exports.DATA_REQ.xml:
                case exports.DATA_REQ.json: {
                    requestPath += '/topic/get/json/' + topic_id;
                    if(_rev) {
                        requestPath += '/r/' + _rev;
                    }
                    break;

                }
                case exports.DATA_REQ.topic_tags: {
                    requestPath += '/topic/get/json/' + topic_id;
                    if(_rev) {
                        requestPath += '/r/' + _rev;
                    }
                    requestPath += '?expand=';
                    requestPath += encodeURIComponent('{"branches":[{"trunk":{"name":"tags"}}]}');
                    break;

                }
            }
            _this.log(_this.url + requestPath, 2);
            restler.get(_this.url + requestPath).on('complete', function (result) {
                if(result instanceof Error) {
                    return cb('REST err: ' + result, null);
                }
                if(!result) {
                    return cb('Could not get data from server', null);
                }
                _result = result;
                switch(data_request) {
                    case exports.DATA_REQ.topic_tags: {
                        if(!result.tags) {
                            _result = [];
                        } else {
                            _result = result.tags.items;
                        }
                        break;

                    }
                    case exports.DATA_REQ.xml: {
                        _result = result.xml;
                        break;

                    }
                }
                if(cb) {
                    return cb(null, _result);
                }
            });
        });
    };
    PressGangCCMS.prototype.getSpec = function (spec_id, revORcb, cb) {
        var _this = this;
        var _rev;
        _rev = -1;
        if('function' == typeof revORcb) {
            cb = revORcb;
        }
        if('number' == typeof revORcb) {
            _rev = revORcb;
        }
        if('function' !== typeof cb) {
            return;
        }
        if('number' !== typeof spec_id) {
            cb('Numeric Spec ID needed as first argument', null);
        }
        this.isContentSpec(spec_id, function (err, is) {
            if(err) {
                return cb(err, null);
            }
            if(!is) {
                return cb('Requested ID is not a Content Specification', null);
            }
            _this.getTopicData(exports.DATA_REQ.xml, spec_id, _rev, function (err, result) {
                if(err) {
                    return cb(err, result);
                }
                _this.stripMetadata(result, function getSpecRevStripMetadataCall(err, result) {
                    return cb(err, result);
                });
            });
        });
    };
    PressGangCCMS.prototype.stripMetadata = function (spec, cb) {
        var err;
        var _result;
        var array;
        if('function' !== typeof cb) {
            return;
        }
        if('string' !== typeof spec || '' === spec) {
            return cb('Cannot parse spec - expected string value', null);
        }
        _result = {
        };
        _result.spec = spec;
        _result.metadata = {
            'serverurl': this.url
        };
        array = spec.split("\n");
        for(var i = 0; i < array.length; i++) {
            for(var j = 0; j < exports.ContentSpecMetadataSchema.length; j++) {
                if(array[i].match(exports.ContentSpecMetadataSchema[j].rule)) {
                    _result.metadata[exports.ContentSpecMetadataSchema[j].attr] = array[i].split('=')[1].replace(/^\s+|\s+$/g, '');
                }
            }
        }
        cb(err, _result);
    };
    PressGangCCMS.prototype.getBaseRESTPath = function (cb) {
        var requestPath;
        var _restver;

        requestPath = exports.REST_API_PATH;
        _restver = this.restver || exports.DEFAULT_REST_VER;
        requestPath += _restver;
        return cb(requestPath);
    };
    PressGangCCMS.prototype.saveTopic = function (topic, log_msg, change_impact, cb) {
        var CHANGE = {
            MINOR: 1,
            MAJOR: 2
        };
        this.getBaseRESTPath(function (requestPath) {
            requestPath += exports.REST_UPDATE_TOPIC_PATH;
            requestPath += '?message=';
            requestPath += encodeURIComponent(log_msg);
            requestPath += '&flag=';
            requestPath += '' + change_impact;
        });
    };
    return PressGangCCMS;
})();
exports.PressGangCCMS = PressGangCCMS;

