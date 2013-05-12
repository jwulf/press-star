/* JavaDoc Info: http://code.google.com/closure/compiler/docs/js-for-compiler.html
 * {!Object}	non-nullable type (never NULL)
 * {?string}	nullable type (sometimes NULL) - default for {Object}
 * {number=}	optional parameter
 * {*}			ALL types
 */

// We use this until we can get identity sorted out
var pressgang_userid,
    UNKNOWN_USER = 89, // default "unknown user" ID
    topicRevision; // used to check whether a new revision has been created on save
    
var previewRenderErrorMsg = '<p>Could not transform</p>';
window.refreshTime = 1000;
window.timerID = 0;
window.clientXSLFile = "assets/xsl/docbook2html.xsl";
window.mutex = 0;
var validationServerResponse,
    port,
    urlpath,
    serverURL,
    topicID,
    sectionNum, // comes from the editor link, used to preview the topic with the same section number as it appears in the book
    skynetURL,
    sectionNum,
    helpHintsOn,
    editorPlainText,
    editor,
    oldVal,
    originalTitle, // the original title of the page - used when flashing the tab for attention
    flash, // the timer for flashing the window title. Lets us clear it from wherever
    pressGangUIURL,
    specID, // editor links now include the specID of the book they come from. This allows default log messages to identify the book
    revHistoryFragment,
    STOP = false, // stop flashing
    FLASH = true, // start flashing
    Model = {
        modified: ko.observable(false),
        validated: ko.observable(),
        revision: ko.observable(),
        title: ko.observable(),
        htmlpreview: ko.observable(),
        helpHintsOn: ko.observable(false),
        pageTitle: ko.observable(),
        loglevel: ko.observable(),  // 1 = minor, 2 = major
        logmsg: ko.observable()
    };


// Execute on page load
$(function() {
    // Attach Save handlers
    $('.save-menu').click(getLogMessage);
    $('#commitmsg-button').click(doCommitLogSave);

    // Deal with the browser back button using the History API
    window.addEventListener('popstate', function(event) {
        if (Model.modified() && event.cancelable && confirm('Discard all changes and load new topic?')) {
            return false;
        }
        generateRESTParameters();
        loadSkynetTopic();
    });

    window.addEventListener('focus', function (event) {
        flashTitle(STOP);
    });

    window.opener && window.opener.registerCallback && window.opener.registerCallback(invokeOpen);

});

$(window).keypress(function(event) { // Ctrl-S  / Cmd-S
    if (!(event.which == 115 && event.ctrlKey) && !(event.which == 19)) return true;
    if (pageIsEditor) {
        // if the topic has been modified do the save event
        if (Model.modified()) doSave();
    }
    event.preventDefault();
    return false;
});

$(document).keydown(function(event) {
    // Ctrl-Shift-D hotkey for Tag Wrap
    if (String.fromCharCode(event.which).toLowerCase() == 'd' && event.ctrlKey && event.shiftKey) {
        doTagWrap();
        return false;
    }
    
    if (event.keyCode == 27) {
            closeMask ();
        }  

    // Ctrl-S hotkey for Save
    //19 for Mac Command+S
    if (!(String.fromCharCode(event.which).toLowerCase() == 's' && event.ctrlKey) && !(event.which == 19)) return true;

    if (pageIsEditor) {
        if (Model.modified()) doSave();
    }
    event.preventDefault();
    return false;
});

// Required because the observable function is only invoked
// when a state changes, and not every time an attempt is
// made to assign a value to it
function topicEdited() {
    Model.validated(false);
    Model.modified(true);
}

function getLogMessage (e) {
    var loginBox = '#login-box',
        _log_level, msg, _username,
        log_levels = {minor: 1, major: 2},
        log_level_text = {1: "Minor Commit Note", 2: "Revision History Entry"};
        
    // I put the "minor" and "major" keys in the rel attribute of the commit menu items
    // should go in a data- element
    Model.log_level = (this) ? log_levels[$(this).attr('rel')] : 1; // Default to minor revision

    _username = getCookie('username');
    if ($('#username').val() === '') { $('#userid').val(_username) }

    $('#commit-msg-type').html(log_level_text[Model.loglevel]);
    
    //Fade in the Popup
    $(loginBox).fadeIn(300);
    $('#save-dropup').removeClass('open');
    
    //Set the center alignment padding + border see css style
    var popMargTop = ($(loginBox).height() + 24) / 2; 
    var popMargLeft = ($(loginBox).width() + 24) / 2; 
    
    $(loginBox).css({ 
        'margin-top' : -popMargTop,
        'margin-left' : -popMargLeft
    });
    
    $("#commitmsg").keypress(function(event) {
        if (event.which == 13) {
            event.preventDefault();
            doCommitLogSave(_log_level);
        }
    });
    $("input").keypress(function(event) {
        if (event.keyCode == 27) {
            closeMask ();
        }    
    });
    
    // Add the mask to body
    $('body').append('<div id="mask"></div>');
    $('#mask').click(closeMask);
    $('.close').click(closeMask);
    $('#cancel-log-msg').click(closeMask)
    $('#mask').fadeIn(300);
    return false;
}

function doCommitLogSave () {
    var _log_msg, // the log message
        username,  // the stored user name
        thisusername, // the username currently requesting the commit
        user; // iterator for the PressGang user list
        
    _log_msg = $('#commitmsg').val();
     
    // If they change their username in the commit dialog, or it hasn't been set, then we verify it with pressgang
    // and set their userid

    pressgang_userid = getCookie('pressgang_userid'); // Do we have a PressGang user ID stored?
     username = getCookie('username'); // Do we have a username stored?
     thisusername = $('#userid').val(); // What name are they using for this commit?
    
    /* If we have not verified a PressGang ID for this user, or they are requesting a commit
        with a different user ID than the one we verified, we verify their ID. 
        
        It's not authentication or authorization, it's just identification, and it's completely open.
        
        The user gives us a user name, and we retrieve the unique ID to match from PressGang */

    //REFACTOR: this needs to come out of this method into its own function
    if (!pressgang_userid || (pressgang_userid == UNKNOWN_USER) || (thisusername != username)) { // either we have no verified PressGang userid, or else it differs from the requesting name
        pressgang_userid = UNKNOWN_USER;
            // Get all the users!
            var _url = (skynetURL.indexOf('http://') == -1) ? 'http://' + skynetURL : skynetURL;

        // REFACTOR:
        // Rather than getting all the users, we can query for the specific user like this:
        // http://skynet.usersys.redhat.com:8080/TopicIndex/seam/resource/rest/1/users/get/json/query;username=jwulf?expand=%7B%22branches%22%3A%5B%7B%22trunk%22%3A%20%7B%22name%22%3A%20%22users%22%7D%7D%5D%7D
        
        // NOTE:  Persist the user identity on the server when going offline!!!
        // Getting a user identity needs to be part of the offlining process
        
        $.get(_url + '/seam/resource/rest/1/users/get/json/all', 
            {expand: JSON.stringify({"branches":[{"trunk":{"name":"users"}}]})}, 
            function (result) {
                // Chrome gets result as a JSON object, FF 20 on Linux gets it as a string ???
                // jQuery $.get does "intelligent guess" for the returned datatype if none is specified
                // Try setting the datatype explicitly to json in $.get
                // Also hack around with JSON.parse:
                if (typeof result == 'string') result = JSON.parse(result); 

                for (var users = 0; users < result.items.length; users ++) {
                    user = result.items[users].item;
                    if (user.name === thisusername) { pressgang_userid = user.id; break;}
                }
                
                if (pressgang_userid !== UNKNOWN_USER) { // cool, we found them in there
                    setCookie('username', thisusername, 365);
                    setCookie('pressgang_userid', pressgang_userid, 365);
                    var author = result.items[users].item.description.split(' ');

                    var firstname = (author[0]) ? author[0] : 'Red Hat';
                    setCookie('userfirstname', firstname, 365);
                    var surname = (author[1]) ? author[1] : 'Engineering Content Services';
                    setCookie('usersurname', surname, 365);
                    var email = (author[2]) ? author [2] : 'www.redhat.com';
                    setCookie('useremail', email, 365);

                    doActualSave(Model.loglevel, _log_msg);
                    closeMask();
                }
                if (pressgang_userid === UNKNOWN_USER) { // We're still unknown!
                    if (confirm('No PressGang account for ' + thisusername + ' found. Click OK to commit as UNKNOWN. Click Cancel to change the user ID')) {
                        doActualSave(Model.loglevel, _log_msg);
                        closeMask();
                    }
                }
            }, 'json');
    } else { // It's all kosher, we've authenticated and cookied this user before
        doActualSave(Model.loglevel, _log_msg);
        closeMask();
    }
}

function closeMask () {
    $('#mask , .login-popup').fadeOut(300 , function() {
        $('#mask').remove();  
    }); 
    return false;
}

function timedRefresh() {
    updateXMLPreviewRoute(editor.getValue(), document.getElementsByClassName("div-preview"));
    if (window.timerID != 0) {
        clearTimeout(window.timerID);
        window.timerID = 0;
    }
}

window.onbeforeunload = function(e) {
    if (Model.modified()) return confirm('Discard unsaved changes?');
};

window.addEventListener('unload', function(event) {
    // I'm closing - let the book know that I'll be gone.
    // window.opener.unregisterCallback();
});

// callback function for use when a node server is generating the live HTML preview
function handleHTMLPreviewResponse (preview, serverFunction) {
    if (preview != previewRenderErrorMsg) {
        Model.htmlpreview(preview);
        /*
        var parser = new DOMParser();
        var doc = parser.parseFromString(preview, 'text/xml');
        var section = doc.getElementsByClassName("section");
        if (section.length !== 0) {
            Model.htmlpreview(section[0].innerHTML);
        } else { // the topic preview is empty, or is not a section, could it be an appendix, i.e: a Revision History?
            section = doc.getElementsByClassName("appendix");
            if (section !== null) {
                Model.htmlpreview(section[0].innerHTML);
            }
        } */
    } else {
        showStatusMessage('Topic cannot be rendered - XML not well-formed', '', 'alert-error');
    }
}

function doValidate(me, callback) {
    if (!Model.validated() || callback) {
        showStatusMessage("Performing validation check...", '', 'alert-info');
        serversideValidateTopic(editor, callback);
    }
}

// Checks if the topic is valid, and then persists it using a node proxy to do the PUT
function _doSave() {
    if (Model.modified()) {
        // if the topic is not validated we'll call validation before saving
        if (!Model.validated())
        { 
            doValidate(null, doActualSave);
        } else {
            doActualSave();
        }
    }
    return false;
}

function doSave() {
    clientsideIdentify(_doSave);
}

function doActualSave (log_level, log_msg) {
    var builtHTML, skynizzleURL, xmlText;

    // Grab the preview HTML now, when save is called.
    if ($('#div-preview-inline').find('.titlepage')) builtHTML = $('#div-preview-inline').html();

    if (!Model.validated() && validationServerResponse == 1) {
        // TODO: figure out why this is triggering false positive on a commit log message save
        alert("This is not valid Docbook XML. If you are using Skynet injections I cannot help you.");
        Model.validated(false);
    }

    if (validationServerResponse == 0) alert("Unable to perform validation. Saving without validation.");

    showStatusMessage("Performing Save...", '', 'alert-info');

    if (editorPlainText) { // get the xml  from the plain text editor
        xmlText = $('#code').val();
    } else { // of the code mirror editor, depending on which one is active
        xmlText = editor.getValue();
    }
    
    var saveObject = {
                        userid: pressgang_userid,
                        url: skynetURL,
                        id: topicID,
                        specid: specID,
                        xml: xmlText,
                        html: builtHTML,
                        log_level: log_level,
                        log_msg: log_msg,
                        revision: topicRevision
                        };
    
    saveTopic(saveObject, saveTopicCallback);
    
    function saveTopicCallback(data) {
        if (data.status == 200) { // We got a success response from the PressStar, which proxied it from PressGang if it's live
         
            var json = JSON.parse(data.responseText);
                
            if (json.revisionconflict) { // Topic was not saved because of revision conflict
                showStatusMessage("Revision conflict - you're editing " + topicRevision + ', in the meantime someone saved ' + json.revision + 
                    '<span class="pull-right"><small>[<a href="#">Click for details</a>]</small></span>', 
                    'While you were editing, someone saved a <a target="_blank" href="' + pressGangUIURL + 
                    '#SearchResultsAndTopicView;query;topicIds=' + topicID + '">new revision: ' + 
                    json.revision + '</a> of this topic.', 'alert-warning');
                topicEdited();
                flashTitle('Revision Conflict');
                // TODO: We will display a diff of the two in a mask similar to the commit message dialog, and allow you to overwrite the other save, or cancel back to your editor.
            } else {
                if (pageIsEditor) { // Reload the new xml
                    window.editor.setValue(json.xml);
                    $('#code').each(function(){this.value = json.xml;});
                    Model.modified(false);
                }
                if (json.revision != topicRevision) { //check if the topic returned from skynizzle has a different revision number
                    topicRevision = json.revision;
                    showStatusMessage('Saved OK: revision <a href="#">' + topicRevision + 
                        '</a> created. <span class="pull-right"><small>[<a href="#">Click for more detail</a>]</small></span', 
                        'The topic was saved and a new revision <a target="_blank" href="' + pressGangUIURL + 
                        '#SearchResultsAndTopicView;query;topicIds=' + topicID + '">new revision: ' + 
                    json.revision + '</a> created.' , 'alert-success');
                    $('#commitmsg').val(' '); // Scrub any commit message from the dialog, because it went through
                    updateXMLPreviewRoute(json.xml, document.getElementsByClassName("div-preview"));
                    //doValidate(); // The Validation message was overwriting the Save result message
                    setPageTitle(json.title);
                    flashTitle(STOP);
    
                } else {
                    showStatusMessage('No new revision was saved. ' + 
                        '<span class="pull-right"><small>[<a href="#">Click for more details</a>]' + 
                        '</small></span>',
                        'You must change the topic XML to save a new revision. ' + 
                        'Extraneous whitespace is stripped from topics before they are saved. ' + 
                        'If the only changes you make are stripped away, ' +
                        ' then a new revision is not created.', 'alert-info');
                }
            }
        } else { // Not code 0 from the Press Star
            showStatusMessage("Error saving. Status code: " + data.status + ' : ' + data.msg, '', 'alert-error');
            topicEdited();
        }
    }
}

function flashTitle(msg) {
    if (msg === false) {
        if (flash) {
            clearInterval(flash);
            flash = null;
        }
        document.title = (Model.pageTitle());
    } else {
        flashTitle(STOP); // clear any existing flashing first
        originalTitle = Model.pageTitle();
        flash = setInterval(function () {
             document.title = (document.title == originalTitle) ? msg: originalTitle;
        }, 750);
    }
};

// Sends the editor content to a node server for validation
function serversideValidateTopic(editor, cb) {
    var xmlText;

    function validationCallback(data, cb) {

        validationServerResponse = 1;
        if (data === "0") {
            showStatusMessage("Topic XML is valid Docbook 4.5", '', 'alert-success');
            Model.validated(true);
            if (cb && typeof(cb) == "function") cb();
        } else {
            showStatusMessage(data.errorSummary + '<span class="pull-right"><small>[<a id="click-to-reveal-hide" href="#"></a>]</small></span>', data.errorDetails , 'alert-error');
            Model.validated(false);
            cb && cb();
        }
    }
    
    if (editorPlainText) {
        xmlText = $('#code').val();
    } else {
        xmlText = editor.getValue();
    }

    $.post("/rest/1/dtdvalidate", {xml: xmlText},
        function(data) {
            validationCallback(data, cb);
        }).error(function(a) {
            // WORKAROUND: Google Chrome calls the error function on status 200, so this is workaround
            if (a.status == 200) {
                validationCallback(a.responseText, cb);
            }
            else {
                showStatusMessage("Communication error requesting validation: " + a.status + ':' + a.responseText, '', 'alert-error');
                if (cb) cb();
            }
    });
}

function updateXMLPreviewRoute (cm, preview) {
    // serverFunction = "validate";
    serverFunction = "preview";
    serversideUpdateXMLPreview(cm, "preview");
    //clientsideUpdateXMLPreview(cm,preview);
}

// Load a client-side xsl style sheet
function loadXMLDoc(dname) {
    if (window.XMLHttpRequest) {
        xhttp = new XMLHttpRequest();
    }
    else {
        xhttp = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xhttp.open("GET", dname, false);
    xhttp.send("");
    return xhttp.responseXML;
}


// This function generates the live HTML preview in the browser using XSLT
function clientsideUpdateXMLPreview(cm, preview) {
    xsl = loadXMLDoc(clientXSLFile);
    try {
        var xml = (new DOMParser()).parseFromString(cm, "text/xml");
        xsltProcessor = new XSLTProcessor();
        xsltProcessor.importStylesheet(xsl);
        resultDocument = xsltProcessor.transformToFragment(xml, document);
        $(preview).html(resultDocument);
    }
    catch (err) {
        donothing = 1;
    }
}

function invokeOpen(_url) {
    if (Model.modified() && !confirm('Discard your unsaved changes?')) {
        return; // cancel load
    } else {
        //push History
        history.pushState({}, Model.title(), _url);
        generateRESTParameters();
        loadSkynetTopic(FLASH);
    }
}

function generateRESTParameters() {
 //   var params = extractURLParameters();
    
   // http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values 
 
    var url = location.href;
    var qs = url.substring(url.indexOf('?') + 1).split('&');
    for(var i = 0, params = {}; i < qs.length; i++){
        qs[i] = qs[i].split('=');
        params[qs[i][0]] = decodeURIComponent(qs[i][1]);
    }
 
    skynetURL = params.skyneturl;
    pressGangUIURL = skynetURL.substr(0, skynetURL.indexOf('TopicIndex')) + 'pressgang-ccms-ui/';
    topicID = params.topicid;
    sectionNum = params.sectionNum;
    specID = params.specID;
    revHistoryFragment = params.revhistoryupdate || false;
}

// This function sends the editor content to a node server to get back a rendered HTML view
function serversideUpdateXMLPreview (cm, serverFunction) {
    var xmlText;

    // If we weren't called from the 2 second timer, we must have been called by the 
    // Enter key event. In that case we'll clear the timer

    if (editorPlainText) {
        xmlText = $('#code').val();
    }
    else {
        xmlText = editor.getValue();
    }
    //preview.innerHTML=cm.getValue();
    if (window.mutex == 0) {

        $.post("/rest/1/xmlpreview", {xml: xmlText, sectionNum: sectionNum, url: skynetURL},
        function(data) {
            handleHTMLPreviewResponse(data, serverFunction);
            window.mutex = 0;
        }).error(function(a) {
            window.mutex = 0;
            // WORKAROUND: Google Chrome calls the error function on status 200, so this is workaround
            // In Google Chrome we check the status and use the error handler to do the success behaviour
            if (a.status == 200) {
                handleHTMLPreviewResponse(a.responseText, serverFunction);
            }
            else {
                showStatusMessage("Communication error requesting preview: " + a.status + ':' + a.responseText, '', 'alert-error');
            }
        });
        window.mutex = 1;
    }

}

function setPageTitle (topicTitle) {
    var titleHTML;
    var pageTitle;
    //  $("#page-title").html(topicID + ": ");
    if (topicTitle) {
        pageTitle =  ('"' + topicTitle + '"' + ' - ID: ' + topicID + '  <small>[rev: ' + topicRevision + ']</small>');
        titleHTML = '<a href="'  + pressGangUIURL + 
                    '#SearchResultsAndTopicView;query;topicIds=' + topicID + '" target="_blank">' + pageTitle + '</a>';
        $("#page-title").html(titleHTML);
        Model.pageTitle(topicID + ' - ' + topicTitle);
        document.title = Model.pageTitle();
    }
}

// Creates a link to the read-only rendered view, useful for passing to people for preview
function injectPreviewLink() {
    $("#preview-link").html('<a href="preview.html?skyneturl=http://' + skynetURL + '&topicid=' + topicID + '">Preview Link</a>');
}

function loadSkynetTopic(_flash) {
    var  alwaysUseServerToLoadTopics = true;
    if (alwaysUseServerToLoadTopics)
    {
        loadTopicViaDeathStar(skynetURL, topicID, function (json) {
            if (json.errno) {
                var _msg = json.errno +  ' ' + json.syscall;
                if (json.errno == 'ENOTFOUND' && json.syscall == 'getaddrinfo') _msg = 'Error retrieving topic from Press Gang';
                showStatusMessage(_msg, 'Can the PressStar server reach ' + skynetURL +'?', 'alert-error');
            } else{
                if (json.xml == "") json.xml = "<section>\n\t<title>" + json.title + "</title>\n\n\t<para>Editor initialized empty topic content</para>\n\n</section>";
                if (pageIsEditor) {
                    window.editor.setValue(json.xml);
                    $('#code').each(function(){this.value = json.xml;});
                    Model.modified(false);
                    doValidate();
                    if (revHistoryFragment) {
                        window.opener.getRevHistoryFragment(json.xml, injectRevHistoryFragment);
                    }
                }
                topicRevision = json.revision;
                Model.title(json.title)
                setPageTitle(json.title);
                updateXMLPreviewRoute(json.xml, document.getElementsByClassName("div-preview"));
                _flash && flashTitle('Editing');
            }
        });
    } else {
        // This function loads the topic xml via JSONP, without a proxy        
        // It requires your web browser to have a connection to the PressGang server (On the same network or VPN)
        // but lessens the load on the server
        if (topicID && skynetURL) {
            loadTopicFromPressGangInBrowser(skynetURL, topicID, function(json) {
                if (json.xml == "") json.xml = "<section>\n\t<title>" + json.title + "</title>\n\n\t<para>Editor initialized empty topic content</para>\n\n</section>";
                if (pageIsEditor) {
                    window.editor.setValue(json.xml);
                    $('#code').each(function(){this.value = json.xml;});
                    Model.modified(false);
                    doValidate();
                }
                topicRevision = json.revision;
                setPageTitle(json.title);
                updateXMLPreviewRoute(json.xml, document.getElementsByClassName("div-preview"));

            });
        }
    }
}

// Passed in to the page through the revhistoryupdate parameter
function injectRevHistoryFragment(content, fragment){

    var doc = $.parseXML(content);
    var newEntry = $.parseXML(fragment);
     $('revhistory', doc).prepend($('revision', newEntry)[0]);
    var newHTML = new XMLSerializer().serializeToString(doc);
    window.editor.setValue(newHTML);
    $('#code').each(function(){this.value = newHTML;});
    Model.validated(false);
    Model.modified(true);
}

function newTopicXML () {
  // Update the page for new Topic XML wherever it came from
  // Account for both the plain text and the Code Mirror editors
}

function onPreviewPageLoad() {
    generateRESTParameters();
    loadSkynetTopic()
}

function serverTopicLoadCallback(topicAjaxRequest) {
    if (topicAjaxRequest.readyState == 4) {
        if (topicAjaxRequest.status == 200 || topicAjaxRequest.status == 304) {
            // Load the server response into the editor
            window.editor.setValue(topicAjaxRequest.response);
            Model.modified(false);
            doValidate();
            updateXMLPreviewRoute(editor, document.getElementsByClassName("div-preview"));
            editorTitle = document.getElementById("page-title");
            setEditorTitle(topicTitle[0].firstChild.nodeValue);
        }
    }

}

function doRevert() {
    if (confirm('Discard all changes and reload?'))
        loadSkynetTopic();
}

function toggleHelpHints(e) {
    Model.helpHintsOn(!Model.helpHintsOn());
    toggleButton('#helpHintToggle', Model.helpHintsOn());
    
    if (Model.helpHintsOn()) {
        $('.btn').popover({
            'trigger': 'hover'
        });
        $('.btn').popover('enable');
    }
    else {
        $('.btn').popover('disable')
    }

    if (e) setCookie('helpHintsOn', Model.helpHintsOn(), 365);
    return false;
}

function toggleButton (btn, state) {
    if (state) {
        $(btn).removeClass('btn-primary').addClass('btn-danger').addClass('active');
    }
    else {
        $(btn).removeClass('btn-danger').addClass('btn-primary').removeClass('active');
    }

}

function toggleAutoCloseTag() {
    var newState = !editor.getOption('closeTagEnabled');
    editor.setOption('closeTagEnabled', newState);
    setCookie('tagAutoClose', newState, 365);
    toggleButton('#tagCloseToggle', newState);
}

function resizePanes() {

    var paneSize;
    // resize codemirror editor width
    paneSize = $('.ui-layout-center').width();
    $('.CodeMirror, .CodeMirror-scroll').css('width', paneSize - 15);
    $('#code').css('width', paneSize - 15);

    // resize preview tab 
    $('#div-preview-pane').width(paneSize - 15);

    // resize codemirror editor height
    paneSize = $('.ui-layout-center').height();
    $('.CodeMirror, .CodeMirror-scroll').css('height', paneSize - 250);
    $('#code').css('height', paneSize - 270);

    $('.CodeMirror').trigger("resize");

    // resize preview east pane
    paneSize = $('.ui-layout-east').width();
    $('#div-preview-inline').width(paneSize - 15);
}

// This is the onload function for the editor page
function initializeTopicEditPage() {

    // Activate the knockout.js bindings
    ko.applyBindings(Model);
    
    // Whenever the topic is set modified, we set validated to false
    Model.modified.subscribe(function(modified) {
        Model.validated(!Model.modified);    
    });
    
    editorPlainText = true;
    togglePlainText(false);

    window.mutex = 0;

    /* Spell checking from http://stackoverflow.com/questions/12343922/codemirror-with-spell-checker */

    var AFF_DATA = 'assets/dictionaries/en_US/en_US.aff',
        DIC_DATA = 'assets/dictionaries/en_US/en_US.dic';

    var typo = new Typo("en_US", AFF_DATA, DIC_DATA, {
        platform: 'any'
    });

    var rx_word = "!\"#$%&()*+,-./:;<=>?@[\\\\\\]^_`{|}~";

    CodeMirror.defineMode("myoverlay", function(config, parserConfig) {
        var overlay = {
            token: function(stream, state) {

                if (stream.match(rx_word) && typo && !typo.check(stream.current()))

                return "spell-error"; //CSS class: cm-spell-error

                while (stream.next() != null) {
                    if (stream.match(rx_word, false)) return null;
                }

                return null;
            }
        };

        var mode = CodeMirror.getMode(
        config, parserConfig.backdrop || "text/x-myoverlay");

        return CodeMirror.overlayMode(mode, overlay);
    });


    // Toggle Close Tag
    $('#tagCloseToggle').click(toggleAutoCloseTag);

    // enable close tag by default
    editor.setOption('closeTagEnabled', true);
    $('#tagCloseToggle').button('toggle');
    toggleButton('#tagCloseToggle', true);

    // if there is a cookie to disable, then do that
    if (getCookie('tagAutoClose') == 'false') {
        editor.setOption('closeTagEnabled', false);
        $('#tagCloseToggle').button('toggle');
        toggleButton('#tagCloseToggle', false);
    }

    // Toggle Help Hints
    $('#helpHintToggle').click(toggleHelpHints);
    
    Model.helpHintsOn((getCookie('helpHintsOn') == 'true'));
    
    $('#helpHintsToggle').button('toggle');
    

    // Bind event handlers
    $("#validate-button").click(doValidate);
    $("#save-button").click(doSave);
    $("#revert-button").click(doRevert);
    $("#skynet-button").click(openTopicInSkynet);
    $("#codetabs-button").click(injectCodetabs);
    $("#tagwrap-button").click(doTagWrap);
    $("#codetabs-lite-button").click(injectCodetabsLite);
    $("#auto-complete-toggle").click(toggleAutoCloseTag);
    
    $("#plainTextToggle").click(togglePlainText);
    if (getCookie('editorPlainText') == 'true') togglePlainText();
    
    $("#find-button").click(doFind);
    $("#replace-button").click(doReplace);
    $("#find-next-button").click(doFindNext);
    $("#find-previous-button").click(doFindPrevious);
    $("#replace-all-button").click(doReplaceAll);

    $('.inject-template').click(injectTemplate);

    // function handler for the validation error text show/hide
    $('.validation-toggle').click(function(e) {
        adjustValidationLinkText(true); // send true to let the function know we are changing the visibility of the validation details
        $('.div-validation').slideToggle('slow'); // and do a funky slide animation, like a Boss!
        e.preventDefault();
    });

    myLayout = $('body').layout({
        applyDefaultStyles: true,
        stateManagement__enabled: true,
        onresize_end: resizePanes,
        useStateCookie: true,
        cookie: {
            //  State Management options
            name: "deathstar-topic-editor-layout", // If not specified, will use Layout.name
            autoSave: true, // Save cookie when page exits?
            autoLoad: true, // Load cookie when Layout inits?
            //  Cookie Options
            domain: "",
            path: "",
            expires: "30", // 'days' -- blank = session cookie
            secure: false,
            //  State to save in the cookie - must be pane-specific
            keys: "north.size,south.size,east.size,west.size," +
                "north.isClosed,south.isClosed,east.isClosed,west.isClosed," +
                "north.isHidden,south.isHidden,east.isHidden,west.isHidden"
        }
    });
    resizePanes();

    generateRESTParameters();
    loadSkynetTopic();
    skynetButtonURL = pressGangUIURL + '#SearchResultsAndTopicView;query;topicIds=' + topicID;
        
    // Set up identity user identity
    
    var username = getCookie('username');
    if (username) {
        $('#userid').val(username);
        $('#userid').removeAttr('autofocus');
        $('#commitmsg').attr('autofocus', 'autofocus');
    }
    
    // Get our id from the cookie, if we have one
    pressgang_userid = getCookie('pressgang_userid');
    // Otherwise commit as unknown user
    pressgang_userid = (pressgang_userid) ? pressgang_userid : UNKNOWN_USER;
}

function togglePlainText (e) {

    if (editorPlainText) {
        var myHeight = getCookie('editor.height') || "300px";
        var myWidth = getCookie('editor.width') || "770px";
        editorPlainText = false;
        // Create our Codemirror text editor
        window.editor = CodeMirror.fromTextArea(document.getElementById("code"), {
            mode: 'text/html',
            // mode: 'text/x-myoverlay',
            extraKeys: {
                "'>'": function(cm) {
                    cm.closeTag(cm, '>');
                },
                "'/'": function(cm) {
                    cm.closeTag(cm, '/');
                }
            },
            onChange: function(cm, e) {
                // commenting out to test effect in Firefox when saving topics
                // currently the refresh with the new xml from the server is causing
                // this to fire and obscure the "Saved successfully" messsage
            //    enableSaveRevert();
            //    makeValidityAmbiguous();
            },
            onKeyEvent: function(cm, e) {
                if (window.timerID == 0) window.timerID = setTimeout("timedRefresh()", window.refreshTime);
                k = e.keyCode;
                if (k != 16 && k != 17 && k != 18 && k != 20 && k != 19 && k != 27 && k != 36 && k != 37 && k != 38 && k != 39 && k != 40 && k != 45) {
                    topicEdited();
                }
                return false; // return false tells Codemirror to also process the key;
            },
            wordWrap: true,
            lineWrapping: true,
            height: myHeight,
            width: myWidth,
            disableSpellcheck: false,
            lineNumbers: true,
            onDragEvent: function(instance, event) {

                // http://stackoverflow.com/questions/6604622/file-drag-and-drop-event-in-jquery

                //stop the browser from opening the file
                event.preventDefault();

                if (event.type == 'drop') {

                    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0] &&
                            event.dataTransfer.files[0].type == 'image/png' && window.FileReader) {
                        var reader = new FileReader;
                        var _filename = event.dataTransfer.files[0].name;
                        reader.onload = function() {
                            var imgData = reader.result;

                            var byteEncodedImage   = new Int8Array( imgData );
                            var encodedImage = Array.apply( [], byteEncodedImage );

                            // Create an image in PressGang
                            var _url = skynetURL + '/seam/resource/rest/1/image/create/json?expand=' + encodeURI(JSON.stringify(
                                {"branches":[{"trunk":{"name": "languageImages"},"branches":[{"trunk":{"name": "imageDataBase64"}}]}]}
                            ));
                            var content = {
                                configuredParameters: ['languageImages'],
                                languageImages_OTM: {
                                    items: [
                                        { item:
                                        {configuredParameters: ['locale'],
                                            locale: "en-US"
                                        },
                                            state: "1" }]
                                }
                            };

                            $.ajax({
                                url: _url,
                                type: "POST",
                                data: JSON.stringify(content),
                                dataType: "json",
                                contentType: "application/json; charset=utf-8",
                                // and on success, upload the image data
                                success: function imageCreatedNowGetUploadID (result) {
                                    var imgid = result.id;
                                    if (!result.id) { return; }
                                    _url = skynetURL + '/seam/resource/rest/1/image/get/json/'+imgid+ '?expand=' +
                                        encodeURI(JSON.stringify({"branches":[{"trunk":{"name": "languageImages"},"branches":[{"trunk":{"name": "imageDataBase64"}}]}]}));

                                    $.ajax({
                                        url: _url,
                                        type: "GET",
                                        contentType: "application/json; charset=utf-8",
                                        success: function imageCreatedNowPostContent (result) {
                                            var uploadID = result.languageImages_OTM.items[0].item.id
                                            _url = skynetURL + '/seam/resource/rest/1/image/update/json?expand=' +
                                                encodeURI(JSON.stringify({"branches":[{"trunk":{"name": "languageImages"},"branches":[{"trunk":{"name": "imageDataBase64"}}]}]}));
                                            content = {configuredParameters: ["languageImages", "description"],
                                                id: imgid,
                                                description: "Uploaded from Press Star",
                                                languageImages_OTM: {items: [{item:{
                                                    configuredParameters: ['imageData', 'filename'],
                                                    filename: _filename,
                                                    id: uploadID,
                                                    imageData: encodedImage
                                                }, state: 3}]}}
                                            $.ajax({
                                                url: _url,
                                                type: "POST",
                                                data: JSON.stringify(content),
                                                dataType: "json",
                                                contentType: "application/json; charset=utf-8",
                                                // and on success, update the editor
                                                success: function () {
                                                    window.editor.replaceSelection('<figure>\n' +
                                                        '    <title>Title</title>\n' +
                                                        '    <mediaobject>\n' +
                                                        '        <imageobject>\n' +
                                                        '            <imagedata align="center" fileref="images/'+ imgid + '.png"/>\n' +
                                                        '        </imageobject>\n' +
                                                        '        <textobject>\n' +
                                                        '            <phrase>Description</phrase>\n' +
                                                        '        </textobject>\n' +
                                                        '    </mediaobject>\n' +
                                                        '</figure>\n');
                                                    updateXMLPreviewRoute(editor.getValue(), document.getElementsByClassName("div-preview"));
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                        reader.readAsArrayBuffer(event.dataTransfer.files[0]);

                        return true;  // stop the editor response
                    }

                };
            }
                // query {"branches":[{"trunk":{"name": "languageImages"},"branches":[{"trunk":{"name": "imageDataBase64"}}]}]}
                //     {"description":"Ninja Rockstar Javascript", "languageImages_OTM":{"items":[{"item":{"image":null, "imageData":[], "thumbnail":null, "imageDataBase64":null, "locale":null, "filename":"ninja rockstar.jpeg", "revisions":null, "id":2420, "revision":null, "configuredParameters":["imageData","filename"], "expand":null, "logDetails":null}, "state":3}], "size":null, "expand":null, "startExpandIndex":null, "endExpandIndex":null}, "revisions":null, "selfLink":null, "editLink":null, "deleteLink":null, "addLink":null, "id":2397, "revision":null, "configuredParameters":["description","languageImages"], "expand":null, "logDetails":null}
        });
        resizePanes();
        editor.getWrapperElement().addEventListener("paste",
            function(e) {

        });
    }
    else {
        window.editor.toTextArea();
        $('#code').change(function() {
            topicEdited();
        });
        $('#code').keydown(function(e) {
            if (window.timerID == 0) window.timerID = setTimeout("timedRefresh()", window.refreshTime);
            k = e.keyCode;
            if (k != 16 && k != 17 && k != 18 && k != 20 && k != 19 && k != 27 && k != 36 && k != 37 && k != 38 && k != 39 && k != 40 && k != 45) {
                topicEdited();
            }
        });
        editorPlainText = true;
        oldVal = $('#code').val();
        setTimer();

    }
    toggleButton('#plainTextToggle', editorPlainText);
    if (e) setCookie('editorPlainText', editorPlainText, 365);
    return false;
}

function setTimer() {
    setTimeout(function() {
        if ($('#code').val() != oldVal) {
            topicEdited();
            updateXMLPreviewRoute($('#code').val(), document.getElementsByClassName("div-preview"));
            oldVal = $('#code').val();
        }
        if (editorPlainText) setTimer();
    }, 500);
};

function doFindNext() {
    CodeMirror.commands.findNext(editor);
}

function doFindPrevious() {
    CodeMirror.commands.findPrev(editor);
}

function doReplaceAll() {
    CodeMirror.commands.replaceAll(editor);
}

function doFind() {
    CodeMirror.commands.find(editor);
}

function doReplace() {
    CodeMirror.commands.replace(editor);
}

// This is a generic click handler for Insert Docbook sub-menu entries
// It uses the id attribute of the sub-menu entry to look up the template in a 
// dictionary. 
function injectTemplate() {
    
    var d = new Date(); 
    var n = d.getMonth(); // we use n to dynamically populate the changelog with the current month 
    var month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    var longMonth = ['January', 'Feburary', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var y = d.getFullYear(); // likewise for the current year
    
    var templates = {
        'inject-varlistentry': '   <varlistentry>\n\
      <term></term>\n\
        <listitem>\n\
          <para></para>\n\
        </listitem>\n\
    </varlistentry>',
        'inject-twocolumntable': '   <table>\n\
     <title></title>\n\
      <tgroup cols="2">\n\
       <thead>\n\
         <row>\n\
           <entry>\n\
             Column 1 heading\n\
           </entry>\n\
            <entry>\n\
             Column 2 heading\n\
           </entry>\n\
         </row>\n\
       </thead>\n\
        <tbody>\n\
         <row>\n\
           <entry>\n\
              <para>\n\
              </para>\n\
           </entry>\n\
           <entry>\n\
             <para>\n\
             </para>\n\
           </entry>\n\
         </row>\n\
       </tbody>\n\
     </tgroup>\n\
   </table>',
        'inject-threecolumntable': '   <table>\n\
     <title></title>\n\
      <tgroup cols="3">\n\
       <thead>\n\
         <row>\n\
           <entry>\n\
             Column 1 heading\n\
           </entry>\n\
            <entry>\n\
             Column 2 heading\n\
           </entry>\n\
           <entry>\n\
             Column 3 heading\n\
           </entry>\n\
         </row>\n\
       </thead>\n\
        <tbody>\n\
         <row>\n\
           <entry>\n\
              <para>\n\
              </para>\n\
           </entry>\n\
           <entry>\n\
             <para>\n\
             </para>\n\
           </entry>\n\
           <entry>\n\
             <para>\n\
             </para>\n\
           </entry>\n\
         </row>\n\
       </tbody>\n\
     </tgroup>\n\
   </table>',
        'inject-picture': '   <figure>\n\
    <title></title>\n\
    <mediaobject>\n\
      <imageobject>\n\
        <imagedata align="center" fileref="images/PUTTHENUMBERHERE.png"/>\n\
      </imageobject>\n\
      <textobject>\n\
         <phrase>\n\
         </phrase>\n\
      </textobject>\n\
    </mediaobject>\n\
   </figure>',
        'inject-procedure': '   <procedure>\n\
      <title></title>\n\
      <step>\n\
         <para>\n\
         </para>\n\
      </step>\n\
      <step>\n\
         <substeps>\n\
            <step>\n\
               <para>\n\
               </para>\n\
            </step>\n\
         </substeps>\n\
      </step>\n\
   </procedure>\n\
   <formalpara>\n\
      <title>Result</title>\n\
      <para>\n\
      </para>\n\
   </formalpara>',
        'inject-changelog': '   <variablelist role="changelog">\n' +
                            '      <varlistentry>\n' + 
                            '         <term role="changelog-toggle">Changes</term>\n' + 
                            '         <listitem>\n' + 
                            '            <itemizedlist role="changelog-items">\n' + 
                            '               <listitem>\n' + 
                            '                  <para role="changelog-' + month[n] + '-' + y + '">\n' + 
                            '                     Updated ' + longMonth[n] + ' ' + y + '.\n' + 
                            '                  </para>\n' + 
                            '                  <!-- add the attribute role="changes-' + month[n] + '-' + y + '" to all elements affected by the change" -->\n' + 
                            '               </listitem>\n' + 
                            '            </itemizedlist>\n' + 
                            '         </listitem>\n' + 
                            '      </varlistentry>\n' + 
                            '   </variablelist>\n'
    };
    window.editor.replaceSelection(templates[this.id]);
    topicEdited();
    updateXMLPreviewRoute(editor.getValue(), document.getElementsByClassName("div-preview"));
}

function injectCodetabs() {
    var codetabblock = "<variablelist role=\"codetabs\">\n\
  <varlistentry>\n\
<!-- Other language terms: C#/.NET, Ruby, JavaScript, Node.js, HTML -->\n" + "    <term>Python</term>\n\
    <listitem>\n\
      <programlisting language=\"Python\">      </programlisting>\n\
    </listitem>\n\
  </varlistentry>\n\
  <varlistentry>\n\
    <term>C++</term>\n\
    <listitem>\n\
      <programlisting language=\"C++\">      </programlisting>\n\
    </listitem>\n\
  </varlistentry>\n\
  <varlistentry>\n\
    <term>Java</term>\n\
    <listitem>\n\
      <programlisting language=\"Java\">      </programlisting>\n\
    </listitem>\n\
  </varlistentry>\n\
</variablelist>\n";
    window.editor.replaceSelection(codetabblock);
    topicEdited();
    updateXMLPreviewRoute(editor.getValue(), document.getElementsByClassName("div-preview"));
}

function injectCodetabsLite() {
    var codetabblock1 = "<variablelist role=\"codetabs\">\n  <varlistentry>\n    <term>Python</term>\n    <listitem>\n";
    var codetabblock2 = "      <programlisting language=\"Python\">      </programlisting>\n";
    var codetabblock3 = "    </listitem>\n  </varlistentry>\n</variablelist>\n";
    var text = "";
    text = window.editor.getSelection();
    if (text) {
        newcode = codetabblock1 + text + codetabblock3;
    }
    else {
        newcode = codetabblock1 + codetabblock2 + codetabblock3;
    }
    window.editor.replaceSelection(newcode);
    topicEdited();
    updateXMLPreviewRoute(editor.getValue(), document.getElementsByClassName("div-preview"));
}


function doTagWrap() {
    var closetag;
    var tag = prompt("Wrap with tag", "tag");

    // This allows the user to enter attributes
    // We separate the tag from any attributes
    if (tag != '') {
        var space = tag.indexOf(' ');
        if (space == -1) closetag = tag;
        else closetag = tag.substring(0, space);

        currenttext = window.editor.getSelection();
        tag = tag.replace('<', '');
        tag = tag.replace('>', '');
        window.editor.replaceSelection('<' + tag + '>' + currenttext + '</' + closetag + '>');
        topicEdited();
        updateXMLPreviewRoute(editor.getValue(), document.getElementsByClassName("div-preview"));
    }
    return false;
}


function createCommentLinks() {
    var editlinks = document.getElementsByClassName('edittopiclink')
    for (var i = 0; i < editlinks.length; i++) {
        var div = document.createElement('div');
        var commentlink = document.createElement('a');
        var newhref = editlinks[i].href.split('editor/index').join('editor/preview');
        commentlink.setAttribute('href', newhref);
        commentlink.innerHTML = "Comments";
        commentlink.setAttribute('class', 'deathstar-preview-link');
        div.appendChild(commentlink);
        editlinks[i].parentNode.appendChild(commentlink);
    }
}

function openTopicInSkynet() {
    window.open(skynetButtonURL, '_blank');
}

/* This function synchronizes the "hide/reveal" message on the validation details expansion link
 It could be made insanely terse by using booleans, an array, and a span with a single word: 'hide' or 'reveal'
 However, we are not going to do that, in the interests of sanity

 This function is called when the error text is updated, in order to add the correct state link to the error text
 and also when the validation details expansion link is clicked, in order to update the link text with the correct
state.

  The changing_visibility boolean lets the function know if the state is changing. We have to do this before
  starting the state change, because the state change is a transition. We have a deterministic state before the transition
  starts, but after that we can't know what's going on. So we treat that case as the inverse. We are open, and *about to close*
  (so treat it as if it were closed).
  
  On the other hand, the state when called for a text update is the state that it will continue to be, so we treat it as closed and 
  staying closed.
  */
function adjustValidationLinkText (changing_visibility) {
    var style = $('.div-validation').attr('style'),
        hidden = (style == 'display: none;' || style == undefined);
        
    if (changing_visibility) {        
        // We are about to change the visibility state of the validation error details 
        if ( hidden ) { // it was hidden, going visible now
            $('#click-to-reveal-hide').html('Click to hide details')
        } else { // It was visible, going to hidden now
            $('#click-to-reveal-hide').html('Click to reveal details');
        }
    } else {
        if ( hidden ) { // it's hidden, or hasn't been shown yet
            $('#click-to-reveal-hide').html('Click to reveal details');
        } else { // it's visible
            $('#click-to-reveal-hide').html('Click to hide details')
        }
    }
}
