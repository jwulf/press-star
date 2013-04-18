var pressgang_rest_v1_url = '/seam/resource/rest/1/'

function saveTopicToPressGang (url, id, xml, log_level, log_msg, cb) {
   var _url, _cb, _log_level;
    
    // Deal with the optionality of log_level and log_msg;
    _cb = (typeof log_level === 'function') ? log_level : cb;
    
    // Log level defaults to 1 when none is supplied
    _log_level = (log_level && typeof log_level !== 'function') ? log_level : 1;
    
    if (url && id && xml) {
        // Add a leading 'http://' if the url doesn't already have one
        _url = (url.indexOf('http://') === 0) ? _url = url : _url = 'http://' + url;
        
        _url += pressgang_rest_v1_url+ 'topic/update/json';
        
        // Add the log message if one was specified
        if (log_msg) _url += '?flag=' + _log_level + '&message=' + encodeURI(log_msg);

        $.ajax ({
            url: _url,
            type: "POST",
            data: JSON.stringify({id: id, configuredParameters: ['xml'], xml: xml}),
            dataType: "json",
            contentType: "application/json; charset=utf-8",
            success: _cb
        });
    }    
}

/* Save a topic to the PressGang server */
function saveTopicViaDeathStar (url, id, xml, log_level, log_msg, cb) {
 
}

/* Send a livePatch notification to the Death Star server. 
    The server will then patch all books that use this topic
*/

function sendPatchNotification (url, id, html) {
    var _url, request;
    
    if (url && id && html) {
        // Add a leading 'http://' if the url doesn't already have one
        _url = (url.indexOf('http://') === 0) ? _url = url : _url = 'http://' + url;
    
        $.post('/rest/1/patch', {
            html: html,
            skynetURL: _url,
            topicID: id
        },

        function(data) {
            console.log(data);
        });
    }
}

/* Load a topic from the PressGang server directly via a JSONP Ajax call */
function loadTopicFromPressGang (url, id, cb) {
    var _url, request;
    
    if (id && url) 
    {
        // Add a leading 'http://' if the url doesn't already have one
        _url = (url.indexOf('http://') === 0) ? _url = url : _url = 'http://' + url;
        
        request = _url + pressgang_rest_v1_url + 'topic/get/jsonp/'+ id + '?callback=?';  
        
        $.getJSON(request, function(json) {
            cb && cb(json);
          });
    }
}

function loadTopicViaDeathStar () {
    
} 



/* This is the demo function for this library. 
    Open a Death Star book in your browser - (hint: don't try this on the RHEV Admin Guide!)
    Open the Console. In Google Chrome I do Ctrl-Shift-I in Linux, or Cmd-Opt-I on the Mac. Not sure for Firefox.Firefox
    Anyway, copy and paste this file into the console, then type this:
    
    getLogMessagesForBookSince('01-01-2013');
    
    for great justice.
*/

var start_time, end_time;

function getLogMessagesForBookSince(date) {
    var topics_to_check = $('.RoleCreateBugPara > a').length;
    console.log('Searching for log messages for %s topics since %s', topics_to_check, date);
    console.log("Note that this is asynchronous, and I have a rate limiter to stop me from " +
        "bringing the PressGang server to its knees - so just sit back and enjoy the show." + 
        " I'll let you know when I'm done!");
        
    var start_time = new Date().getTime();

    $('.RoleCreateBugPara > a').each(function() {
    
        var target = $(this);
            
        // Get the topic ID from the bug link data
        var id = url_query_extract('topicid', target.attr('href')) || 'undefined-';
        getLogMessagesSince('http://skynet.usersys.redhat.com:8080/TopicIndex', id, date, function (result) {
            // console.log(ObjToSource(result));
            for (var i = 0; i < result.length; i++) {
                console.log('%s  | Topic %s | %s', result[i].date, result[i].topic, result[i].msg);
             }
             topics_to_check --;
             if (topics_to_check === 1) { 
                console.log('Done!');
                end_time = new Date().getTime();
                console.log("Time taken: " + (end_time - start_time) / 1000 + "s.");
             }
        });
    });
}

function ObjToSource(o){
    if (!o) return 'null';
    var k="",na=typeof(o.length)=="undefined"?1:0,str="";
    for(var p in o){
        if (na) k = "'"+p+ "':";
        if (typeof o[p] == "string") str += k + "'" + o[p]+"',";
        else if (typeof o[p] == "object") str += k + ObjToSource(o[p])+",";
        else str += k + o[p] + ",";
    }
    if (na) return "{"+str.slice(0,-1)+"}";
    else return "["+str.slice(0,-1)+"]";
}

function url_query_extract( query, url ) {
  // Parse URL Queries
  // from http://www.kevinleary.net/get-url-parameters-javascript-jquery/
  // Will parse the current window location if not passed a url
    query = query.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var expr = "[\\?&]"+query+"=([^&#]*)";
	var regex = new RegExp( expr );
	var results = regex.exec( url) || regex.exec( window.location.href );
	if( results !== null ) {
		return results[1];
		return decodeURIComponent(results[1].replace(/\+/g, " "));
	} else {
		return false;
	}
}



function getTopicRevisions (url, id, start, end, cb) {
    var _cb, _req;
    
    // omit start and end to return all revisions for a topic
    if ("function" == typeof start) { 
        _cb = start; 
        _req = JSON.stringify({"branches":[{"trunk":{"name":"revisions"}}]});
    } else {
        // Supply a start and end to limit the revisions to a range
        _cb = cb;
        _req = JSON.stringify({"branches":[{"trunk":{"name":"revisions", start: start, end: end}}]})
    }
    
    $.get(url + '/seam/resource/rest/1/topic/get/json/' + id, {expand: _req}, _cb);    
        
    /* result.revisions.items is an array of topic revisions
     so results.revisions.items[0].item.lastmodified and results.revisions.items[0].item.revision
     is the latest one, and you track back through history with each successive item
     
     To get the human readable date from the revision lastmodified, do: 
     new Date(modified).toUTCString();
     */
}

function getTopicRevisionsSince (url, id, date, cb) {
    /* Get the revisions of a topic that were modified since the given date, up to today. 
      date should be a human readable date in this format:
      DD-MM-YYYY, for example: 26-02-2013
    */
      
    date = date.split("-");
    var newDate= date[1]+"/"+ date[0]+"/"+ date[2];
    var timestamp = new Date(newDate).getTime();
    
    // Now we have a timestamp to compare with 
    // Let's get all the revisions and test the date. If necessary we can optimise it later
    // to return batches of revisions
    
    getTopicRevisions(url, id, function (result) {
        // Get *all* the revisions
        var _result = [ ], _item, 
            revisions = result.revisions.items;
            
        // Iterate through them, pushing them to our result array
        for (var item = 0; item < revisions.length; item ++) {
            _item = revisions[item].item;
            if (_item['lastModified'] > timestamp) {
                _result.push(_item);   
            } else { // break out when we encounter a revision prior to our timestamp
                // console.log('Got %s revisions for topic %s, %s in timeframe', revisions.length, id, item);            
                break;
            }
        }
        cb(_result)
    }); 
}

function getLogMessage (url, id, rev, cb) {
    $.get(url + '/seam/resource/rest/1/topic/get/json/' + id + '/r/' + rev, 
        {expand: JSON.stringify({"branches":[{"trunk":{"name":"logDetails"}}]})}, function (result) {
            // Send back an object {msg: <log message>, date: <log timestamp>}
            // Note that the log message could be blank
        if (result.logDetails && result.logDetails.message) return cb({
            topic: id,
            msg: result.logDetails.message, 
            timestamp: result.logDetails.date,
            date: new Date(result.logDetails.date).toUTCString()});    
        cb(null);
    });     
}

/*  Returns a sorted array of log messages since a given date
    The date is a string in the format 'DD-MM-YYYY' with the hyphens. 
    The parameter sort_reverse is optional. By default the messages will be from 
    most recent (index 0) to earliest (index n). Set sort_reverse true to make it 
    the opposite */
    
function getLogMessagesSince (url, id, date, sort_earliest_first, cb){
/* We have to get a little fancy with the asynchronous programming here.
    There are several asynchronous operations involved. First we get the 
    topic revisions since a date, then we get the log message for each one.
    
    When we have a response for every log message, we sort them, then call back.
*/
    var _logmsgs = [ ], _callbacks, _cb;
    
    // Deal with the optional parameter
    if (cb) { 
        _cb = cb 
    } else { // by default we sort latest log message first (index 0)
        _cb = sort_earliest_first;
        sort_earliest_first = false;
    }
    
    // console.log('Searching for log messages for topic %s from %s', id, date);
    getTopicRevisionsSince(url, id, date, function (result) {
        _callbacks = result.length; // we use this to know when all our async calls are done
        
        function getLogMessageCallback (logmsg) {
            if (logmsg !== null) _logmsgs.push(logmsg);
            _callbacks --;
            if (_callbacks === 0) { // we've heard back from all requests
                // sort and return log messages
                _logmsgs.sort(function(x, y){
                    if (sort_earliest_first) {
                        return y.date - x.date;
                    } else {
                        return x.date - y.date;
                    }
                });
                _cb(_logmsgs);
            }
        }
        
        // We'll use a compose and apply pattern with a timer to apply the functions
        // In order to rate limit our requests to the PressGang API
        
        // It will slow the process down, but your browser, and everyone else's experience
        // of PressGang will thank you!
        
        // Compose a getLogMessage request
        function composeLogMessageRequest (url, id, revision, cb) {
            return function () {
                getLogMessage(url, id, revision, cb);
            }
        }
        
        // Apply a getLogMessage request
        function applyLogMessageRequest () {
            logMessageRequests[currentRequest]();
            currentRequest ++; 
        
            // If there is another request after this one, reset the timer
            if (logMessageRequests[currentRequest]) 
                setTimeout(applyLogMessageRequest, 500)
        }
        
        // Compose the functions
        var logMessageRequests = [];
        //console.log('We found %s revisions', result.length);
        for (var topic = 0; topic < result.length; topic ++) 
            logMessageRequests.push(composeLogMessageRequest (url, id, result[topic].revision, getLogMessageCallback)); 
        
        
        // Now we call the functions in a setInterval, in order to rate limit the damage to the PressGang REST API
        var currentRequest = 0;
        
        setTimeout(applyLogMessageRequest, 500) // two a second should be ok, no?
    });
}


// Parse URL Queries
// from http://www.kevinleary.net/get-url-parameters-javascript-jquery/
function url_query( query ) {
	query = query.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
	var expr = "[\\?&]"+query+"=([^&#]*)";
	var regex = new RegExp( expr );
	var results = regex.exec( window.location.href );
	if( results !== null ) {
		return results[1];
		return decodeURIComponent(results[1].replace(/\+/g, " "));
	} else {
		return false;
	}
}

function extractURLParameters(){
	var url_params = {
	skynetURL: '',
	nodeServer: '',
	topicID: 0
	};
	url_params.nodeServer = url_query('nodeserver') || '';
	url_params.topicID = url_query('topicid');
    url_params.sectionNum = url_query('sectionNum');
  	skynetURL = url_query('skyneturl');
  	if (skynetURL && skynetURL.indexOf("http://") !== -1)    
      skynetURL = skynetURL.substring(7);
  	url_params.skynetURL = skynetURL;
  	return url_params;
}

function setCookie(c_name,value,exdays)
{
var exdate=new Date();
exdate.setDate(exdate.getDate() + exdays);
var c_value=escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
document.cookie=c_name + "=" + c_value;
}

function getCookie(c_name)
{
var i,x,y,ARRcookies=document.cookie.split(";");
for (i=0;i<ARRcookies.length;i++)
{
  x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
  y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
  x=x.replace(/^\s+|\s+$/g,"");
  if (x==c_name)
    {
    return unescape(y);
    }
  }
}
