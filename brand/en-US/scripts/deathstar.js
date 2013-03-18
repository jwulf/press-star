// Rewrite 


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
  var editorURL, injectorURL, buildData, endLoc, topicID;
  
  editorURL = '/edit.html';  
  // skynetURL is provided by skynetURL.js

  // rewrite bug links as editor links
  $('.RoleCreateBugPara > a').each(function(){
	var target = $(this);
    buildData = url_query('cf_build_id', target.attr('href')) || 'undefined-';
    endLoc = buildData.indexOf('-');
    topicID = buildData.substr(0, endLoc);
    var editURL = editorURL + '?skyneturl=' + skynetURL + '&topicid=' + topicID; 
    target.attr('href', editURL);
    target.attr('target', 'new');
    target.addClass('edittopiclink');
    target.text('Edit');

	// Identify the bug link, to allow us to preserve it when updating the DOM
	$(target.parents('.simplesect')).addClass('bug-link');
	// Identify the div containing the Topic as a topic, and uniquely with the Topic ID
    $(target.parents('.section')[0]).addClass('sectionTopic sectionTopic' + topicID);

  }); 
}

// This function is typically invoked from a child window containing an editor
// It updates the DOM of the book in the browser, allowing topic edits to be
// seen immediately
function updateTopic (topicid, newContent) {

	// Locate the sectionTopic
	var target = $('.sectionTopic' + topicid);

	if (!target) return;

	// Locate and preserve its .prereqs-list child, if it exists
	var prereq = target.children('.prereqs-list').detach();

	// Locate and preserve its .see-also-list child, if it exists
	var seealso = target.children('.see-also-list').detach();

	// Locate and preserve the bug link / edit child
	var buglink = target.children('.bug-link').detach();
	
	// Update the content
	target.html(newContent);
	
	// Restore injected content
	if (prereq) prereq.prependTo(target);
	if (seealso) seealso.appendTo(target);
	if (buglink) buglink.appendTo(target);
}
