/* This is the demo function for this library. 
    Open a Death Star book in your browser - (hint: don't try this on the RHEV Admin Guide!)
    Open the Console. In Google Chrome I do Ctrl-Shift-I in Linux, or Cmd-Opt-I on the Mac. Not sure for Firefox.Firefox
    Anyway, copy and paste this file into the console, then type this:
    
    getLogMessagesForBookSince('01-01-2013');
    
    for great justice.
    
    1. For each topic, get the LogMessagesSince (date). [async]
    2. LogMessagesSince gets TopicRevisionsSince. [sync]
    3. TopicRevisionsSince gets all Topic revisions, then filters them. [sync] 
    4. LogMessageSince does for each revision get the log  [async]
    
    2 & 3 are synchronous in that they return a complete set before the next piece is fired (and that with a single call).
    1 & 4 are asynchronous in that they spawn a bunch of tasks (for each)    
    
    We know that once each topic has received its complete set of results, we have the complete set of results. 
    
    However, each topic does not know what its own complete set of results is. 
    
    At the TopicRevisionsSince point, the topic can know how many revisions it needs to hear back from. The answers can 
    be null. So at the point of TopicRevisionsSince a callback should populate an indexed field with the number of callbacks
    that the topic should expect. 
    
    Let's trace a single path of execution.
    
    We know how many topics we have. 
*/

// default rate limit one operation/500ms
// Note that the actual rate can be higher, because this is a rate limit per function
var _rate_limit = 500, // _rate_limit is global to allow all API calls to share a rate
// Could make it a global rate limit by pushing functions to an async queue that allows one
// simulataneous task and fires them with a timer
    _rest_calls, // How many REST calls we make for an operation, for interest
    _error_count, // Used for debugging, to track asynchronous errors globally
    _spawned_log_msgs; // Used to track async call return
    
function getLogMessagesForBookSince(date, url, sort_ascending, rate_limit, cb) {
    /* construct an array of sorted log messages for the book
    date: String (required), formatted 'DD-MM-YYYY', date to go back to. Log messages from 
        that date forward will be returned. 
    url: String (required), url of the PressGang server.
    sort_ascending: optional boolean, sort from earliest to most recent. By default
        log messages are sorted from most recent (index 0) to earliest (index n). 
        Set sort_ascending to true to get the earliest messsages first.
    rate_limit: optional number, set the rate limiter. By default the rate is 
        limited to 500ms per spawn of a topic search.    
    cb: callback to invoke when log messages are assembled. Receives an error object 
        and a result array of sorted log messages.
    */

    var start_time, // we will time the operation
        num_topics_to_check, // the total number of topics, and hence high-level async tasks
        _job_counter, // this is how we track completion. When this hits zero, all async tasks are done
        _results = [], // The log messages for this book
        _sort_asc, // reverse sort order flag
        _cb, // callback
        next, // index for triggering getLogMessagesSinceRequests
        _spawned_tasks; // keeps track of how many topics we are searching for log messages

    if (!date || !url) cb('How about providing a date and a URL?');
    
    _rest_calls = 0;
    _error_count = 0;
    _spawned_log_msgs = {};
    _spawned_tasks = 0;
    
    // Deal with the optional parameters
    _sort_asc = (sort_ascending === true); // by default sort descending unless explicitly told otherwise
    // cb could be in one of three places, depending on optional parameters
    if (cb && typeof cb === "function") _cb = cb;
    if (sort_ascending && typeof sort_ascending === "function") _cb = sort_ascending;
    if (rate_limit && typeof rate_limit === "function") cb = rate_limit;

    _rate_limit = (rate_limit && typeof rate_limit == "number") ? rate_limit : 500, // 500ms if nothing specified

    // The topics in the book are identified by scanning the DOM for the edit links
    num_topics_to_check = $('.RoleCreateBugPara > a').length;

    console.log('Searching for log messages for %s topics since %s', num_topics_to_check, date);

    start_time = new Date().getTime(); // We'll time the operation

    /* We compose and apply a logMessagesSince request for each topic in the book
     This allows us to rate limit the API calls using a timer
     Querying the log for each topic requires getting a list of revisions, then getting
     all of those revisions to get their log messages. That can be a lot of API calls,
     so we rate limit at two levels - how fast we spawn the search for each topic's revisions,
     and how fast we spawn the search for log messages for the revisions of each topic.
    */

    function composeLogMessagesSinceRequest(url, id, date, cb) {
        // return a log message search to be executed at will
        return function() {
            getLogMessagesSince(url, id, date, cb);
        };
    }

    function logMessageSearchCallback(result) {
        /* The callback function for a getLogMessagesSince search
        
         Push each of the log messages into our _results array
         result is an array of log messages for this topic
         _results is the array of log messages for the book
        */

        // push these log messages to our global result
        for (var i = 0; i < result.length; i++) 
            _results.push[result[i]];

        // Our job has returned, so we decrement the _job_counter
        _job_counter--;
        
        var current_time = new Date().getTime();
        var elapsed_time = Math.round((current_time - start_time) / 1000);
        console.log('[Spawned topic searches: %s] [Getting logs: %s] Completed %s of %s topics: %s log messages   [%s REST API requests (%s/s) in %ss] [%s errors]', 
            _spawned_tasks,
            Object.keys(_spawned_log_msgs).length,
            num_topics_to_check - _job_counter, 
            num_topics_to_check, 
            result.length, 
            _rest_calls, 
            Math.round(_rest_calls/elapsed_time),
            elapsed_time,
            _error_count
            );
            
        // Is this the last one?
        if (_job_counter === 1) allLogMessagesIn();
        // Spy on the log messages for each topic as they come in:
        // console.log('%s  | Topic %s | %s', result[i].date, result[i].topic, result[i].msg);
    
    }

    // This is our array of functions - each one an asynchronous API call to get the Log Messages for a topic
    var logMessagesSinceRequests = [];

    // We decrement the _job_counter each time a topic gets its Log Messages
    // when it hits zero, we are done
    _job_counter = num_topics_to_check;

    var _functions_to_compose = num_topics_to_check;

    // Compose a function for each topic in the book, launch the search when done
    $('.RoleCreateBugPara > a').each(function() {
        var target = $(this);
        // Get the topic ID from the bug link data
        var id = url_query_extract('topicid', target.attr('href')) || 'undefined-';

        logMessagesSinceRequests.push(composeLogMessagesSinceRequest(url, id, date, logMessageSearchCallback));
        _functions_to_compose--;
        // If this is the last function to be composed, start the search
        if (_functions_to_compose === 0) startSearch();
    });

    /* The ultimate result function. */
    function allLogMessagesIn() {
        var err; // err is not implemented yet
        _results.sort(function(x, y) {
            if (_sort_asc) { // oldest first
                return y.timestamp - x.timestamp;
            }
            else { // most recent first
                return x.timestamp - y.timestamp;
            }
        });

        /* Summary console output for great justice */
        console.log('%s log messages since %s', _results.length, date);
        for (var i = 0; i < _results.length; i++)
            console.log('%s  | Topic %s | %s', _results[i].date, _results[i].topic, _results[i].msg);
        console.log('Done!');
        console.log('%s REST calls', _rest_calls);
        var end_time = new Date().getTime();
        console.log("Time taken: " + (end_time - start_time) / 1000 + "s.");
        
        // And our call back with the ultimate roll-up of revision history
        if (-cb) _cb(err, _results);
    }

    // This is where we initiate the operation, once all our functions are composed
    function startSearch() {
        next = 0; // start at the beginning
        nextSearch();
    }

    function nextSearch() {
        next++;
        if (logMessagesSinceRequests[next]) { // If there is another search
            logMessagesSinceRequests[next](); // launch it
            _spawned_tasks ++;
            setTimeout(nextSearch, _rate_limit); // and come back in _rate_limit ms
        }
    }
}

function ObjToSource(o) {
    if (!o) return 'null';
    var k = "",
        na = typeof(o.length) == "undefined" ? 1 : 0,
        str = "";
    for (var p in o) {
        if (na) k = "'" + p + "':";
        if (typeof o[p] == "string") str += k + "'" + o[p] + "',";
        else if (typeof o[p] == "object") str += k + ObjToSource(o[p]) + ",";
        else str += k + o[p] + ",";
    }
    if (na) return "{" + str.slice(0, - 1) + "}";
    else return "[" + str.slice(0, - 1) + "]";
}

function url_query_extract(query, url) {
    // Parse URL Queries
    // from http://www.kevinleary.net/get-url-parameters-javascript-jquery/
    // Will parse the current window location if not passed a url
    query = query.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var expr = "[\\?&]" + query + "=([^&#]*)";
    var regex = new RegExp(expr);
    var results = regex.exec(url) || regex.exec(window.location.href);
    if (results !== null) {
        return results[1];
        return decodeURIComponent(results[1].replace(/\+/g, " "));
    }
    else {
        return false;
    }
}

function loadSkynetTopicJsonP(id, url, cb) {
    if (id && url) {
        var requestURL = "/seam/resource/rest/1/topic/get/jsonp/" + id + "?callback=?";
        var requeststring = url + requestURL;
        $.getJSON("http://" + requeststring, function(json) {
            cb && cb(json);
        });
    }
}

function getTopicRevisions(url, id, start, end, cb) {
    var _cb, _req;

    // omit start and end to return all revisions for a topic
    if ("function" == typeof start) {
        _cb = start;
        _req = JSON.stringify({
            "branches": [{
                "trunk": {
                    "name": "revisions"
                }
            }]
        });
    }
    else {
        // Supply a start and end to limit the revisions to a range
        _cb = cb;
        _req = JSON.stringify({
            "branches": [{
                "trunk": {
                    "name": "revisions",
                    start: start,
                    end: end
                }
            }]
        });
    }

    var request = $.get(url + '/seam/resource/rest/1/topic/get/json/' + id, {
        expand: _req
    }, _cb).fail(
        function(err) {
            console.log('yo, got an error for topic id %s: %s ', id, err);
            cb(null);
        });
    _rest_calls ++; // Who's counting?

    /* result.revisions.items is an array of topic revisions
     so results.revisions.items[0].item.lastmodified and results.revisions.items[0].item.revision
     is the latest one, and you track back through history with each successive item
     
     To get the human readable date from the revision lastmodified, do: 
     new Date(modified).toUTCString();
     */
}

function getTopicRevisionsSince(url, id, date, cb) {
    /* Get the revisions of a topic that were modified since the given date, up to today. 
      date should be a human readable date in this format:
      DD-MM-YYYY, for example: 26-02-2013
    */

    date = date.split("-");
    var newDate = date[1] + "/" + date[0] + "/" + date[2];
    var timestamp = new Date(newDate).getTime();

    // Now we have a timestamp to compare with 
    // Let's get all the revisions and test the date. If necessary we can optimise it later
    // to return batches of revisions

    getTopicRevisions(url, id, function(result) {
        // Get *all* the revisions
        var _result = [],
            _item,
            revisions = result.revisions.items;

        // Iterate through them, pushing them to our result array
        for (var item = 0; item < revisions.length; item++) {
            _item = revisions[item].item;
            if (_item['lastModified'] > timestamp) {
                _result.push(_item);
            }
            else { // break out when we encounter a revision prior to our timestamp
                // console.log('Got %s revisions for topic %s, %s in timeframe', revisions.length, id, item);            
                break;
            }
        }
        cb(_result);
    });
}

// Get a Log Message for a topic or a specified revision of a topic
function getLogMessage(url, id, rev, cb) {
    var _req, _rev;
    
    if (typeof rev == "function") { 
        cb = rev;
        rev = false;
    }
    _req = url + '/seam/resource/rest/1/topic/get/json/' + id;
    _req = (rev) ?  _req + '/r/' + rev : _req; // append a rev number if one is specified
        
    var request = $.get(_req, {
        expand: JSON.stringify({
            "branches": [{
                "trunk": {
                    "name": "logDetails"
                }
            }]
        })
    }, function(result) {
        // Send back an object {msg: <log message>, date: <log timestamp>}
        // Note that the log message could be blank
        if (result.logDetails && result.logDetails.message && (result.logDetails.flag == 1)) {
            // We will only return major revision log messages
            // 1 = minor, 2 = major
            // See: http://docbuilder.usersys.redhat.com/10914/#About_Logs
            return cb({
                topic: id,
                msg: result.logDetails.message,
                timestamp: result.logDetails.date,
                date: new Date(result.logDetails.date).toUTCString()
            });
        }
        return cb(null);
    }).fail(
        function(err) {
            console.log('Yo, got an error for topic %s revision %s: %s ', id, rev, err);
            cb(null)
        });
    if (_rest_calls) _rest_calls++; // Really, what's a few hundred API calls between friends?
}

/*  Return a sorted array of log messages for a topic since a given date
    The date is a string in the format 'DD-MM-YYYY' with the hyphens. 
    The parameter sort_reverse is optional. By default the messages will be from 
    most recent (index 0) to earliest (index n). Set sort_reverse true to make it 
    the opposite */

function getLogMessagesSince(url, id, date, sort_earliest_first, cb) {
    /* We have to get a little fancy with the asynchronous programming here.
    There are several asynchronous operations involved. First we get the 
    topic revisions since a date, then we get the log message for each one.
    
    When we have a response for every log message, we sort them, then call back.
*/
    var _logmsgs = [],
        _revisions_left_to_check, _cb;

    // Deal with the optional parameter
    if (cb) {
        _cb = cb;
    }
    else { // by default we sort latest log message first (index 0)
        _cb = sort_earliest_first;
        sort_earliest_first = false;
    }

    _spawned_log_msgs[id] = 'Searching'; // global counter
    
    // console.log('Searching for log messages for topic %s from %s', id, date);
    getTopicRevisionsSince(url, id, date, function(result) {
        // Our result is a collection of revisions
        // We will know collect the log message (if any) for each one
        
        _revisions_left_to_check = result.length; // we use this to know when all our async calls are done

        if (_revisions_left_to_check === 0)  _cb(null); // This topic has no revisions
        
        // console.log('Topic %s has %s revisions', id, _callbacks);
        
        function getLogMessageCallback(logmsg) {
            if (logmsg !== null) _logmsgs.push(logmsg);
            _revisions_left_to_check-- ; // local counter for our callback
            // console.log('Got %s of %s revisions for topic %s', result.length - _callbacks, result.length, id);

            if (_revisions_left_to_check === 0) { // we've heard back from all requests
                // console.log('... which is the last one I needed');
                // sort and return log messages
                _logmsgs.sort(function sortFunction(x, y) {
                    if (sort_earliest_first) {
                        return y.date - x.date;
                    }
                    else {
                        return x.date - y.date;
                    }
                });
                _cb(_logmsgs);
                delete _spawned_log_msgs[id];
            }
        }

        // We'll use a compose and apply pattern with a timer to apply the functions
        // In order to rate limit our requests to the PressGang API

        // It will slow the process down, but your browser, and everyone else's experience
        // of PressGang will thank you!

        // Compose a getLogMessage request
        function composeLogMessageRequest(url, id, revision, cb) {
            return function() {
                getLogMessage(url, id, revision, cb);
            };
        }

        // Apply a getLogMessage request
        function applyLogMessageRequest() {
            // We check if a request exists - if the request for Topic Revisions failed
            // this will be completely empty
            (logMessageRequests[currentRequest]) && logMessageRequests[currentRequest]();
            currentRequest++;
            //console.log(currentRequest);

            // If there is another request after this one, reset the timer
            if (logMessageRequests[currentRequest]) 
                setTimeout(applyLogMessageRequest, _rate_limit);
        }

        // Compose the functions
        var logMessageRequests = [];
        
        //console.log('We found %s revisions', result.length);
        
        // We will first of all look at the log message for the current revision of the topic
        logMessageRequests.push(composeLogMessageRequest(url, id, getLogMessageCallback));
        
        for (var topic = 0; topic < result.length; topic++)
            logMessageRequests.push(composeLogMessageRequest(url, id, result[topic].revision, getLogMessageCallback));

        // Now we call the functions in a setInterval, in order to rate limit the damage to the PressGang REST API
        var currentRequest = 0;

        applyLogMessageRequest();
    });
}
