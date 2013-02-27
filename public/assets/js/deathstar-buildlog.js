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

function onLoad(){
    var buildID = url_query('buildid');
    $.getScript('/socket.io/socket.io.js', function(){cmdOutput('Socket.io loaded', true);});
    socket || (socket = io.connect(window.location.origin));     
	socket && socket.emit('getBuildLog', {buildID: buildID} );
	socket.on('connect', function () {
		cmdOutput('Connected to server');

		socket.on('cmdoutput', function (msg){
			cmdOutput(msg);
		});
	});
}

function cmdOutput(text, newline, cmdclass){
    var pretext='', posttext='';
	if (cmdclass) {
		pretext = '<span class="' + cmdclass + '">';
		posttext = '</span>'
	}
	var eol = newline ? '<br><br>' : '<br>';
	var myDiv = document.getElementById('div-preview-inline');
	var s = myDiv.innerHTML;
	var anchor='<a id="end"></a>'
	var news = s.substring(0, s.indexOf(anchor)) + pretext + text + posttext + eol + anchor;
	myDiv.innerHTML = news;
	document.getElementById('end').scrollIntoView();
//	myDiv.innerHTML += pretext + text + posttext + eol + '<a id="end"/>';
  
}