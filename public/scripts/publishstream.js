var socket, io;

// Parse URL Queries
// from http://www.kevinleary.net/get-url-parameters-javascript-jquery/
function url_query( query ) {
    query = query.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var expr = "[\\?&]"+query+"=([^&#]*)";
    var regex = new RegExp( expr );
    var results = regex.exec( window.location.href );
    if( results !== null ) {
        //return results[1];
        return decodeURIComponent(results[1].replace(/\+/g, " "));
    } else {
        return false;
    }
}

function publish_stream_onLoad(){
    var publishID = url_query('publishid');
    socket || (socket = io.connect(window.location.origin));
    cmdOutput('Socket.io loaded\n\n');
    socket && socket.emit('getStream', {streamID: publishID} );
    socket.on('connect', function () {
        cmdOutput('Connected to server\n\n');

        socket.on('cmdoutput', function (msg){
            cmdOutput(msg);
        });
    });
}

function cmdOutput(text, newline){
    //var pretext='<pre>', posttext='</pre>';
    var pretext = '', posttext = '';
    var myDiv = document.getElementById('div-preview-inline');
    var s = myDiv.innerHTML;
    var anchor='<a id="end"></a>'
    var news = s.substring(0, s.indexOf(anchor)) + pretext + text + posttext + anchor;
    myDiv.innerHTML = news;
	document.getElementById('end').scrollIntoView();
//	myDiv.innerHTML += pretext + text + posttext + eol + '<a id="end"/>';
  
}