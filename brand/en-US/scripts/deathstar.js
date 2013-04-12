var flash, original;

function url_query( query, url ) {
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

function deathstarItUp()
{
    var editorURL, injectorURL, buildData, endLoc, topicID, socket;
    
    socket || (socket = io.connect()); 
    
    socket.on('connect', function () { // TIP: you can avoid listening on `connect` and listen on events directly too!
        console.log('Websocket connected to server');
        socket.emit('patchSubscribe', {skynetURL: skynetURL, id: thisBookID})
    });
    
    socket.on('patchBookinBrowser', patchTopic);
    
    socket.on('bookRebuiltNotification', bookRebuiltNotification);
    
    socket.on('notification', displayNotification);
    
    $('.notifier').click(clearNotifier);
  
}

function displayNotification (msg) {
   flashTitle('Your attention please');
   $('.notifier').html(msg);
   $('.notifier').removeClass('invisible');
}

function clearNotifier () {
    clearInterval(flash);
    document.title = original;
    $('.notifier').addClass('invisible');
    return true;
}

function flashTitle (msg) {
    original = document.title;  

    flash = setInterval(function () { 
        document.title = (document.title == original) ? msg : original; 
        }, 500);    
}

function bookRebuiltNotification () {
    flashTitle('Updated');
    $('.notify-rebuilt').removeClass('invisible');   

}

function reload () {
    location.reload(true);
}

// Invoked via websocket from the server
function patchTopic (msg) {
    console.log('Received patch for Topic ' + msg.topicID);
    if (msg.topicID && msg.html) {
        
        // Locate the sectionTopic
        var target = $('.sectionTopic' + msg.topicID);
    
        if (!target) return;
    
        // Locate and preserve its .prereqs-list child, if it exists
        var prereq = target.children('.prereqs-list').detach();
        
        // Locate and preserve its .see-also-list child, if it exists
        var seealso = target.children('.see-also-list').detach();
        
        // Locate and preserve the bug link / edit child
        var buglink = target.children('.bug-link').detach();
        
        // Get the title from the existing topic - this gets us the TOC anchor and correct section number
        var title = target.find('.title')[0];
        
        // Update the content
        target.html(msg.html);
        
        // Now replace the title to get the TOC anchor and the correct section numbering
        $(target.find('.title')[0]).replaceWith(title);
        
        // Restore injected content
        if (prereq) prereq.insertAfter(target.find('hr'));
        if (seealso) seealso.appendTo(target);
        if (buglink) buglink.appendTo(target);
            
    }    
}
    
