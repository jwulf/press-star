var pressgang_rest_v1_url = '/seam/resource/rest/1/',
    deathstar_rest_v1_url = '/rest/1/';

/* global skynetURL, $, window */


function url_query_extract (query, url) {
    // Parse URL Queries
    // from http://www.kevinleary.net/get-url-parameters-javascript-jquery/
    // Will parse the current window location if not passed a url
    query = query.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var expr = "[\\?&]" + query + "=([^&#]*)",
        regex = new RegExp(expr),
        results = regex.exec(url) || regex.exec(window.location.href);
    if (results !== null) {
        return results[1];
        //return decodeURIComponent(results[1].replace(/\+/g, " "));
    }
    else {
        return false;
    }
}

/**
 *  Save the Topic directly to PressGang - no Death Star routing
 *  @param {number} userid  PressGang user id.
 *  @param {string} url PressGang server URL.
 *  @param {number} id Topic ID.
 *  @param {number} specid Content Specification ID where the
 *                          edit was performed.
 *  @param {string} xml Docbook XML of the topic.
 *  @param {?number} log_level Log message level (1 - minor or 2 - major).
 *  @param {?string} log_msg Log message text.
 *  @param {function(err, result) cb Callback function.
 */
function saveTopicToPressGangFromBrowser (userid, url, id, specid, xml, log_level, log_msg, cb) {

    var _url, _cb, _log_level;

    // Deal with the optionality of log_level and log_msg;
    _cb = (typeof log_level === 'function') ? log_level : cb;

    // Log level defaults to 1 when none is supplied
    _log_level = (log_level && typeof log_level !== 'function') ? log_level : 1;

    if (url && id && xml) {
        // Add a leading 'http://' if the url doesn't already have one
        _url = (url.indexOf('http://') === 0) ? url : 'http://' + url;

        _url += pressgang_rest_v1_url + 'topic/update/json';

        // Add the log message if one was specified
        if (log_msg) {
            _url += '?flag=' + _log_level + '&message=' + encodeURI(log_msg);
        }

        $.ajax({
            url: _url,
            type: "POST",
            data: JSON.stringify({id: id, configuredParameters: ['xml'], xml: xml}),
            dataType: "json",
            contentType: "application/json; charset=utf-8",
            success: _cb
        });
    }
}

/**
 * Save a topic to the PressGang server
 * @param {!{ userid: (number),
              url: (string),
              id: (number),
              specid: (number),
              xml: (string),
              html: (string),
              log_level: (number),
              log_msg: (string),
              revision: (number)}} save  Save operation details
 * @param {function(Object)} cb Callback function.
 */
function saveTopicViaDeathStar (save, cb) {
    var _url;

    save.log_level = save.log_level || 1; // default to minor revision (1)

    if (save.url && save.id && save.xml) {
        // url is the url of the PressGang server

        // Add a leading 'http://' if needed
        save.url = (save.url.indexOf('http://') === 0) ? save.url : 'http://' + save.url;

        // _url is the url for our ajax call to the Death Star
        _url = deathstar_rest_v1_url + 'topicupdate';

        $.ajax({
            url: _url,
            type: "POST",
            data: JSON.stringify(save),
            dataType: "json",
            contentType: "application/json; charset=utf-8",
            complete: cb
        });
    }
}

/**
 * Save action router
 * @param {!{ userid: number, url: string, id: number, specid: number,
     *    xml: string, html: string, log_level: number, log_msg: string,
     *    revision: number }} saveObject Save operation details
 * @param {function(Object)} cb callback function.
 */
function saveTopic (saveObject, cb) {
    saveTopicViaDeathStar(saveObject, cb);
}

/**
 * Load topic via the Death Star topic driver
 * @param {string} url PressGang server URL
 * @param {number} id Topic ID
 * @param {function(Object)} cb callback function.
 */
function loadTopicViaDeathStar(url, id, cb) {
    var _url;
    // Add a leading 'http://' if the url doesn't already have one
    _url = (url.indexOf('http://') === 0) ? url : 'http://' + url;

    $.get('/rest/1/gettopic', {url: _url, id: id}, cb);

    // Here's what you get back in the callback when the PG server cannot be reached: 
    //{code: "ENOTFOUND", errno: "ENOTFOUND", syscall: "getaddrinfo"}
    // Otherwise you get a topic
}

// Note that the actual rate can be higher, because this is a rate limit per function
var _rate_limit = 0, // _rate_limit in ms is global to allow all API calls to share a rate
// Could make it a global rate limit by pushing functions to an async queue that allows one
// simulataneous task and fires them with a timer
    _rest_calls, // How many REST calls we make for an operation, for interest
    _error_count, // Used for debugging, to track asynchronous errors globally
    _spawned_log_msgs; // Used to track async call return

/**
 * Generate a Revision History entry
 * @param {Array.<{ topic: (number),
                    msg: (string),
                    timestamp: (number),
                    date: (string),
                    author: {
                        firstname: (string),
                        surname: (string),
                        email: (string)
                        }
                    }>} results Revision History results.
 * @param {!function(string)} cb Callback, receives an XML revision element
 *          with a roll-up of revision history entries.
 */
function generateRevisionHistoryFragment(results, cb) {
    var revHistoryFragment, ourDate, result, splitDate, i, firstname, surname, email;

    ourDate = new Date().toDateString();

    // This information is created in a cookie when a log message is saved from the
    // topic editor
    firstname = getCookie('userfirstname') || 'Red Hat';
    surname = getCookie('usersurname') || 'Engineering Content Services';
    email = getCookie('useremail') || 'www.redhat.com';

    revHistoryFragment =  '            <revision>\n';
    revHistoryFragment += '            <!-- Automated Revision History Entry -->\n';
    revHistoryFragment += '                <!-- manually update revnumber, or publish will update it for you -->\n';
    revHistoryFragment += '                <revnumber>1.0-0</revnumber>\n';
    revHistoryFragment += '                <date>' + ourDate + '</date>\n';
    revHistoryFragment += '                <author>\n';
    revHistoryFragment += '                    <firstname>' + firstname + '</firstname>\n';
    revHistoryFragment += '                    <surname>' + surname + '</surname>\n';
    revHistoryFragment += '                    <email>' + email + '</email>\n';
    revHistoryFragment += '                </author>';
    revHistoryFragment += '                <revdescription>\n';
    revHistoryFragment += '                    <simplelist>\n';

    for (i = 0; i < results.length; i++) {
        result = results[i];

        // Revision History dates look like this: Tue Apr 23 2013
        // Our result dates look like this :  Fri, 19 Apr 2013 14:42:14 GM
        // Convert the result date into the Revision History date format
        splitDate = result.date.split(' ');
        result.revhistoryDate = splitDate[0].substr(0, 3) + ' ' + splitDate[2] + ' ' + splitDate[1] + ' ' + splitDate[4];
        // This date can be used to inject per-date revision history entries

        // In the initial release we do one single, anonymous, roll-up entry with today's date
        revHistoryFragment += '                        <member>' + result.msg + '</member>\n';
    }

    revHistoryFragment += '                    </simplelist>\n';
    revHistoryFragment += '                </revdescription>\n';
    revHistoryFragment += '            <!-- End Automated Revision History Fragment -->';
    revHistoryFragment += '            </revision>\n';

    if (cb) { cb(revHistoryFragment); }
}

/**
 * Load topic via the Death Star topic driver
 * @param {!string} date Date of last revision history entry, format
 *                  "DD-MM-YYYY".
 * @param {!string} url PressGang server URL.
 * @param {?boolean} sort_ascending Controls sort ordering.
 * @param {?function(string)} feedback Progress callback - passed percentage
 *              complete as string.
 * @param {!function(err, Array.<{ topic: (number),
                                   msg: (string),
                                   timestamp: (number),
                                   date: (string),
                                   author: {
                                        firstname: (string),
                                        surname: (string),
                                        email: (string)
                                   }
                                 }>)} cb Callback function.
 */
function getLogMessagesForBookSince(date, url, sort_ascending, feedback, cb) {
     var start_time, // we will time the operation
        num_topics_to_check, // the total number of topics, and hence high-level async tasks
        _job_counter, // this is how we track completion. When this hits zero, all async tasks are done
        _results = [], // The log messages for this book
        _sort_asc, // reverse sort order flag
        _cb, // callback
        next, // index for triggering getLogMessagesSinceRequests
        _feedback,
        _spawned_tasks; // keeps track of how many topics we are searching for log messages

    if (!url && skynetURL) {
        url = skynetURL;
    } // skynetURL is a dirty global in Death Star books. When, O When will we go all AMD Modular up in here?

    if (!date || !url) {
        cb('How about providing a date and a URL?');
    }

    _rest_calls = 0;
    _error_count = 0;
    _spawned_log_msgs = {};
    _spawned_tasks = 0;

    // Deal with the optional parameters
    _sort_asc = (sort_ascending === true); // by default sort descending unless explicitly told otherwise
    // cb could be in one of three places, depending on optional parameters
    if (cb && typeof cb === "function") {
        _cb = cb;
    }
    if (feedback && typeof feedback === "function" && !cb) {
        _cb = feedback;
    }
    if (sort_ascending && typeof sort_ascending === "function" && !cb) {
        _cb = sort_ascending;
    }

    if(feedback && typeof feedback === "function" && cb) {_feedback = feedback;}

    // The topics in the book are identified by scanning the DOM for the edit links
    num_topics_to_check = $('.RoleCreateBugPara > a').length;

    console.log('Searching server %s for log messages for %s topics since %s', url, num_topics_to_check, date);

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
        return function () {
            getLogMessagesSince(url, id, date, cb);
        };
    }

    function logMessageSearchCallback(result) {
        var i, percentageComplete, current_time, elapsed_time;
        /* The callback function for a getLogMessagesSince search

         Push each of the log messages into our _results array
         result is an array of log messages for this topic
         _results is the array of log messages for the book
         */

        // push these log messages to our global result
        if (result) {// result is null if there are no revisions
            for (i = 0; i < result.length; i++) {
                _results.push(result[i]);
            }
        }
        // Our job has returned, so we decrement the _job_counter
        _job_counter--;

        current_time = new Date().getTime();
        elapsed_time = Math.round((current_time - start_time) / 1000);
        console.log('[Spawned topic searches: %s] [Getting logs: %s] Completed %s of %s topics: %s log messages   [%s REST API requests (%s/s) in %ss] [%s errors]',
            _spawned_tasks,
            Object.keys(_spawned_log_msgs).length,
            num_topics_to_check - _job_counter,
            num_topics_to_check,
            _results.length,
            _rest_calls,
            Math.round(_rest_calls / elapsed_time),
            elapsed_time,
            _error_count
        );

        if (_feedback) { // update caller with progress
            percentageComplete = Math.round((num_topics_to_check - _job_counter) / num_topics_to_check * 100);
            _feedback(percentageComplete);
        }

        // Is this the last one?
        if (_job_counter === 0) {
            allLogMessagesIn();
        }
    }

    // This is our array of functions - each one an asynchronous API call to get the Log Messages for a topic
    var logMessagesSinceRequests = [];

    // We decrement the _job_counter each time a topic gets its Log Messages
    // when it hits zero, we are done
    _job_counter = num_topics_to_check;

    var _functions_to_compose = num_topics_to_check;

    // Compose a function for each topic in the book, launch the search when done
    $('.RoleCreateBugPara > a').each(function () {
        var target = $(this);
        // Get the topic ID from the bug link data
        var id = url_query_extract('topicid', target.attr('href')) || 'undefined-';

        logMessagesSinceRequests.push(composeLogMessagesSinceRequest(url, id, date, logMessageSearchCallback));
        _functions_to_compose--;
        // If this is the last function to be composed, start the search
        if (_functions_to_compose === 0) {
            startSearch();
        }
    });

    /* The ultimate result function. */
    function allLogMessagesIn() {
        var err; // err is not implemented yet
        _results.sort(function (x, y) {
            if (_sort_asc) { // oldest first
                return y.timestamp - x.timestamp;
            }
            else { // most recent first
                return x.timestamp - y.timestamp;
            }
        });

        /* Summary console output for great justice */
        console.log('%s log messages since %s', _results.length, date);
        for (var i = 0; i < _results.length; i++) {
            console.log('%s  | Topic %s | %s | %s %s %s', _results[i].date, _results[i].topic, _results[i].msg,
                _results[i].author.firstname, _results[i].author.surname, _results[i].author.email);
        }
        console.log('Done!');
        console.log('%s REST calls', _rest_calls);
        var end_time = new Date().getTime();
        console.log("Time taken: " + (end_time - start_time) / 1000 + "s.");

        generateRevisionHistoryFragment(_results, _cb);
    }

    // This is where we initiate the operation, once all our functions are composed
    function startSearch() {
        next = 0; // start at the beginning
        nextSearch();
    }

    function nextSearch () {
        if (logMessagesSinceRequests[next]) { // If there is another search
            logMessagesSinceRequests[next](); // launch it
            _spawned_tasks++; // increment the count of outstanding jobs
            next++; // increment the index for the next time round
            setTimeout(nextSearch, _rate_limit); // and come back in _rate_limit ms
        }
    }
}

function ObjToSource (o) {
    if (!o) {
        return 'null';
    }
    var k = "",
        na = typeof(o.length) === "undefined" ? 1 : 0,
        str = "";
    for (var p in o) {
        if (na) {
            k = "'" + p + "':";
        }
        if (typeof o[p] === "string") {
            str += k + "'" + o[p] + "',";
        }
        else if (typeof o[p] === "object") {
            str += k + ObjToSource(o[p]) + ",";
        }
        else {
            str += k + o[p] + ",";
        }
    }
    if (na) {
        return "{" + str.slice(0, -1) + "}";
    }
    else {
        return  "[" + str.slice(0, -1) + "]";
    }
}


function loadSkynetTopicJsonP (id, url, cb) {
    if (id && url) {
        var requestURL = "/seam/resource/rest/1/topic/get/jsonp/" + id + "?callback=?";
        var requeststring = url + requestURL;
        $.getJSON("http://" + requeststring, function (json) {
            cb && cb(json);
        });
    }
}

function getTopicRevisions (url, id, start, end, cb) {
    var _cb, _req;

    // omit start and end to return all revisions for a topic
    if ("function" === typeof start) {
        _cb = start;
        _req = JSON.stringify({
            "branches": [
                {
                    "trunk": {
                        "name": "revisions"
                    }
                }
            ]
        });
    }
    else {
        // Supply a start and end to limit the revisions to a range
        _cb = cb;
        _req = JSON.stringify({
            "branches": [
                {
                    "trunk": {
                        "name": "revisions",
                        start: start,
                        end: end
                    }
                }
            ]
        });
    }

    $.get(url + '/seam/resource/rest/1/topic/get/json/' + id, {
        expand: _req
    }, _cb).fail(
        function (err) {
            console.log('yo, got an error for topic id %s: %s ', id, err);
            cb(null);
        });
    _rest_calls++; // Who's counting?

    /* result.revisions.items is an array of topic revisions
     so results.revisions.items[0].item.lastmodified and results.revisions.items[0].item.revision
     is the latest one, and you track back through history with each successive item

     To get the human readable date from the revision lastmodified, do: 
     new Date(modified).toUTCString();
     */
}

function getTopicRevisionsSince (url, id, date, cb) {
    /* Get the revisions of a topic that were modified since the given date.
     date should be a human readable date in this format:
     DD-MM-YYYY, for example: 26-02-2013
     */

    date = date.split("-");
    var newDate = date[1] + "/" + date[0] + "/" + date[2];
    var timestamp = new Date(newDate).getTime();

    // Now we have a timestamp to compare with 
    // Let's get all the revisions and test the date. If necessary we can optimise it later
    // to return batches of revisions

    getTopicRevisions(url, id, function (result) {
        // Get *all* the revisions
        var _result = [],
            _item,
            revisions;

        revisions = (result.revisions && result.revisions.items) ? result.revisions.items : [];

        // Iterate through them, pushing them to our result array
        for (var item = 0; item < revisions.length; item++) {
            _item = revisions[item].item;
            if (_item.lastModified > timestamp) {
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
function getLogMessage (url, id, rev, cb) {
    var _req;

    if (typeof rev === "function") {
        cb = rev;
        rev = false;
    }
    _req = url + '/seam/resource/rest/1/topic/get/json/' + id;
    _req = (rev) ? _req + '/r/' + rev : _req; // append a rev number if one is specified

    $.get(_req, {
        expand: JSON.stringify({
            "branches": [
                {
                    "trunk": {
                        "name": "logDetails"
                    }
                }
            ]
        })
    },function (result) {
        // Send back an object {msg: <log message>, date: <log timestamp>}
        // Note that the log message could be blank
        var logDetails;

        logDetails = (result.logDetails && result.logDetails.message && result.logDetails.flag === 2) ? result.logDetails : undefined;

        if (logDetails) {
            // We will only return major revision log messages
            // 1 = minor, 2 = major
            // See: http://docbuilder.usersys.redhat.com/10914/#About_Logs

            var author = [];
            if (logDetails && logDetails.user && logDetails.user.description) {
                author = logDetails.user.description.split(' ');
            }
            var firstname = (author[0]) ? author[0] : 'Red Hat';
            var surname = (author[1]) ? author[1] : 'Engineering Content Services';
            var email = (author[2]) ? author [2] : 'www.redhat.com';

            var _log = {
                topic: id,
                msg: logDetails.message,
                timestamp: logDetails.date,
                date: new Date(logDetails.date).toUTCString(),
                author: {
                    firstname: firstname,
                    surname: surname,
                    email: email
                }
            };
            return cb(_log);
        }
        return cb(null);
    }).fail(
        function (err) {
            console.log('Yo, got an error for topic %s revision %s: %s ', id, rev, err);
            cb(null);
        });
    if (_rest_calls) {
        _rest_calls++;
    } // Really, what's a few hundred API calls between friends?
}

/*  Return a sorted array of log messages for a topic since a given date
 The date is a string in the format 'DD-MM-YYYY' with the hyphens.
 The parameter sort_reverse is optional. By default the messages will be from
 most recent (index 0) to earliest (index n). Set sort_reverse true to make it
 the opposite */

function getLogMessagesSince (url, id, date, sort_earliest_first, cb) {
    /*
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

    _spawned_log_msgs && (_spawned_log_msgs[id] = 'Searching'); // global counter

    getTopicRevisionsSince(url, id, date, function (result) {
        _revisions_left_to_check = result.length;
        if (_revisions_left_to_check === 0)  { _cb(null); } // This topic has no revisions

        function getLogMessageCallback (logmsg) {
            if (logmsg !== null) { _logmsgs.push(logmsg); }
            _revisions_left_to_check--; // local counter for our callback
            // console.log('Got %s of %s revisions for topic %s', result.length - _callbacks, result.length, id);

            if (_revisions_left_to_check === 0) { // we've heard back from all requests
                // console.log('... which is the last one I needed');
                // sort and return log messages
                _logmsgs.sort(function sortFunction (x, y) {
                    if (sort_earliest_first) {
                        return y.date - x.date;
                    }
                    else {
                        return x.date - y.date;
                    }
                });
                _cb(_logmsgs);
                if (_spawned_log_msgs[id]) { delete _spawned_log_msgs[id]; }
            }
        }

        // We'll use a compose and apply pattern with a timer to apply the functions
        // In order to rate limit our requests to the PressGang API

        // It will slow the process down, but your browser, and everyone else's experience
        // of PressGang will thank you!

        function composeLogMessageRequest (url, id, revision, cb) {
            return function () {
                getLogMessage(url, id, revision, cb);
            };
        }

        function applyLogMessageRequest () {
            if (logMessageRequests[currentRequest]) { logMessageRequests[currentRequest](); }
            currentRequest++;

            // If there is another request after this one, reset the timer
            if (logMessageRequests[currentRequest])
            { setTimeout(applyLogMessageRequest, _rate_limit); }
        }

        var logMessageRequests = [];

        //console.log('We found %s revisions', result.length);

        for (var topic = 0; topic < result.length; topic++) {
            logMessageRequests.push(composeLogMessageRequest(url, id, result[topic].revision, getLogMessageCallback));
        }
        // Now we call the functions in a setInterval, in order to rate limit the damage to the PressGang REST API
        var currentRequest = 0;
        applyLogMessageRequest();
    });
}
