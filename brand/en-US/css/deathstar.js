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
  var editorURL, injectorURL, buildData, endLoc, topicID, skynetURL;
  
  skynetURL = 'http://skynet.usersys.redhat.com:8080/TopicIndex';
  editorURL = url_query('editorurl') || '../editor/index.html';  

  // rewrite bug links as editor links
  $('.RoleCreateBugPara > a').each(function(){
    buildData = url_query('cf_build_id', $(this).attr('href')) || 'undefined-';
    endLoc = buildData.indexOf('-');
    topicID = buildData.substr(0, endLoc);
    editURL = editorURL + '?skyneturl=' + skynetURL + '&topicid='+ topicID; 
    $(this).attr('href', editURL);
    $(this).attr('target', '_new');
    $(this).addClass('edittopiclink');
    $(this).text('Edit');
    $($(this).parents('.section')[0]).addClass('sectionTopic');
  }); 
}
