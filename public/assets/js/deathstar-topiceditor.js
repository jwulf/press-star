// TODO:
// 1. Add the ability to click on the title and edit it

// We use this until we can get identity sorted out
var pressgang_userid = 89; // default "unknown user" ID

var previewRenderErrorMsg = '<p>Could not transform</p>'
// window.previewserverurl="http://127.0.0.1:8888";
var nodeServer;
window.refreshTime = 1000;
window.timerID = 0;
window.clientXSLFile = "assets/xsl/docbook2html.xsl";
// window.restProxy="http://127.0.0.1:8888/";
window.mutex = 0;
var validXML = false,
    validationServerResponse,
    port,
    urlpath,
    serverURL,
    topicID,
    sectionNum,
    skynetURL,
    sectionNum,
    helpHintsOn,
    editorPlainText,
    editor,
    oldVal, 
    globalLogLevel;

// Execute on page load
$(function() {
    // Attach Save handlers
    $('.save-menu').click(getLogMessage);
    $('#commitmsg-button').click(doCommitLogSave);
});

    
$(window).keypress(function(event) { // Ctrl-S  / Cmd-S
    if (!(event.which == 115 && event.ctrlKey) && !(event.which == 19)) return true;
    if (pageIsEditor) {
        // if the Save button is not disabled, do the save event
        if (!$("#save-button").prop("disabled")) doSave();
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
        if (!$("#save-button").prop("disabled")) doSave();
    }
    event.preventDefault();
    return false;
});

function getLogMessage (e) {
    
    var loginBox = '#login-box',
        _log_level, msg,
        log_levels = {minor: 1, major: 2},
        log_level_text = {1: "Minor Commit Note", 2: "Revision History Entry"};
        
    // I put the "minor" and "major" keys in the rel attribute of the commit menu items    
    globalLogLevel = (this) ? log_levels[$(this).attr('rel')] : 1; // Default to minor revision
    
    $('#commit-msg-type').html(log_level_text[globalLogLevel]);
    $('#commitmsg-save').attr('rel', globalLogLevel); // set the rel attribute on the commit message save button
    // There is something very dirty about all this attaching data to DOM elements or putting it in global variables
    // I'm feeling the need to implement some kind of model layer with wiring to elements
    // Soon, my precious, soon...
    
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
    var _log_msg = $('#commitmsg').val();
    
    // We will cookie store your username here for the time being
    // In the very near future we'll need to do the API call to verify your identity and get your userid
    // We'll store that in a cookie, so that we can use it when the Death Star is offline
    // One step at a time
    
    setCookie('username', $('#userid').val(), 365);
    
    doActualSave(globalLogLevel, _log_msg);
    closeMask ();
}

function closeMask () {
    $('#mask , .login-popup').fadeOut(300 , function() {
        $('#mask').remove();  
    }); 
    return false;
}


function disable(selector) {
    $(selector).prop("disabled", true);
    $(selector).popover('hide');
}

function timedRefresh() {
    updateXMLPreviewRoute(editor.getValue(), document.getElementsByClassName("div-preview"));
    if (window.timerID != 0) {
        clearTimeout(window.timerID);
        window.timerID = 0;
    }
}

window.onbeforeunload = function(e) {
    if (!$("#save-button").prop("disabled") === true) return 'You have unsaved changes.';
};

// callback function for use when a node server is generating the live HTML preview
function handleHTMLPreviewResponse(preview, serverFunction) {
    if (preview != previewRenderErrorMsg) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(preview, 'text/xml');
        var section = doc.getElementsByClassName("section");
        if (section !== null) {
            $(".div-preview").empty();
            $(".div-preview").append(section[0]);
        } else { // the topic preview is empty, or is not a section, could it be an appendix, i.e: a Revision History?
            section = doc.getElementsByClassName("appendix");
            if (section !== null) {
                $(".div-preview").empty();
                $(".div-preview").append(section[0]);
            }
        }
    } else {
        showStatusMessage('Topic cannot be rendered - XML not well-formed', '', 'alert-error');

    }
}

function doValidate(me, callback) {
    if (!$("#validate-button").prop("disabled") == true || callback) {
        showStatusMessage("Performing validation check...", '', 'alert-info');
        serversideValidateTopic(editor, callback);
    }
}

// Checks if the topic is valid, and then persists it using a node proxy to do the PUT
function doSave() {
    if ($("#save-button").prop('disabled') === false) { // If the Save button is enabled
        disableSaveRevert();
        // if the validate button is enabled, then we'll call validation before saving
        if ($("#validate-button").prop('disabled') == false)
        { // This needs to be a callback, because validation is asynchronous
            doValidate(null, doActualSave);
        } else {
            doActualSave();
        }
    }
    return false;
}

function doActualSave (log_level, log_msg) {
    var builtHTML, skynizzleURL, xmlText;

    // Grab the preview HTML now, when save is called.
    if ($('#div-preview-inline').find('.titlepage')) builtHTML = $('#div-preview-inline').html();

    if (!validXML && validationServerResponse == 1) {
        alert("This is not valid Docbook XML. If you are using Skynet injections I cannot help you.");
        $("#validate-button").prop("disabled", false);
    }

    if (validationServerResponse == 0) alert("Unable to perform validation. Saving without validation.");

    showStatusMessage("Performing Save...", '', 'alert-info');

    if (editorPlainText) { // get the xml  from the plain text editor
        xmlText = $('#code').val();
    } else { // of the code mirror editor, depending on which one is active
        xmlText = editor.getValue();
    }
    
    saveTopic(pressgang_userid, skynetURL, topicID, xmlText, log_level, log_msg, saveTopicCallback);
    
    function saveTopicCallback(data) {
        if (data.code == 0) { // We got a sucess response from the Death Star, which proxied it from PressGang if it's live
            showStatusMessage("Saved OK", '', 'alert-success');
            disable("#save-button");
            disable("#revert-button");
            $('#commitmsg').val(' '); // Scrub any commit message from the dialog, because it went through

            // Send the topic HTML to the server for patching
            if (builtHTML) {
                sendPatchNotification(skynetURL, topicID, builtHTML);
                console.log('Sending Patch Notification for topic %s', topicID);
            }

            if (!validXML) doValidate();
        } else { // Not code 0 from the Death Star
           showStatusMessage("Error saving. Status code: " + data.code + ' : ' + data.msg, '', 'alert-error');
            enableSaveRevert();
        }
    }
}

// Sends the editor content to a node server for validation
function serversideValidateTopic(editor, cb) {
    var xmlText;

    function validationCallback(data, cb) {

        validationServerResponse = 1;
        if (data === "0") {
            showStatusMessage("Topic XML is valid Docbook 4.5", '', 'alert-success');
            validXML = true;
            disable("#validate-button");
            if (cb && typeof(cb) == "function") cb();
        } else {
            showStatusMessage(data.errorSummary + '<span class="pull-right"><small>[<a id="click-to-reveal-hide" href="#"></a>]</small></span>', data.errorDetails , 'alert-error');
            validXML = false;
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

function updateXMLPreviewRoute(cm, preview) {
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

function generateRESTParameters() {
    var params = extractURLParameters();

    skynetURL = params.skynetURL;
    topicID = params.topicID;
    sectionNum = params.sectionNum;
}

// This function sends the editor content to a node server to get back a rendered HTML view
function serversideUpdateXMLPreview(cm, serverFunction) {
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

/*function onUnload()
{
  if ( document.getElementbyId("button-save") && ! document.getElementById("button-save").disabled)
  {
    var r=confirm("You have unsaved changes. Do you want to discard them?");
  }
}*/

function setPageTitle (topicTitle) {
    var titleHTML;
    var pageTitle;
    //  $("#page-title").html(topicID + ": ");
    if (topicTitle) {
        pageTitle = topicID + ': ' + topicTitle;
        titleHTML = '<a href="' + skynetButtonURL + '" target="_blank">' + pageTitle + '</a>';
        $("#page-title").html(titleHTML);
        document.title = pageTitle;
    }
}

// Creates a link to the read-only rendered view, useful for passing to people for preview
function injectPreviewLink() {
    $("#preview-link").html('<a href="preview.html?skyneturl=http://' + skynetURL + '&topicid=' + topicID + '">Preview Link</a>');
}

function loadSkynetTopic() {
    if (alwaysUseServerToLoadTopics || editingOffline)
    {
        loadTopicViaServer();
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
                    disableSaveRevert();
                    doValidate();
                    injectPreviewLink();
                }
                setPageTitle(json.title);
                updateXMLPreviewRoute(json.xml, document.getElementsByClassName("div-preview"));
                window.title = json.title;
            });
        }
    }
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
            disableSaveRevert();
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
    helpHintsOn = !helpHintsOn;
    toggleButton('#helpHintToggle', helpHintsOn);
    
    if (helpHintsOn) {
        $('.btn').popover({
            'trigger': 'hover'
        });
        $('.btn').popover('enable');
    }
    else {
        $('.btn').popover('disable')
    }

    if (e) setCookie('helpHintsOn', helpHintsOn, 365);
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
    
    helpHintsOn = true;
    toggleHelpHints();
    if (getCookie('helpHintsOn') == 'true') {
        $('#helpHintsToggle').button('toggle');
        toggleHelpHints();
    }

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
            name: "deathstar-topic-editor-layout" // If not specified, will use Layout.name
            ,
            autoSave: true // Save cookie when page exits?
            ,
            autoLoad: true // Load cookie when Layout inits?
            //  Cookie Options
            ,
            domain: "",
            path: "",
            expires: "30" // 'days' -- blank = session cookie
            ,
            secure: false
            //  State to save in the cookie - must be pane-specific
            ,
            keys: "north.size,south.size,east.size,west.size," +

            "north.isClosed,south.isClosed,east.isClosed,west.isClosed," +

            "north.isHidden,south.isHidden,east.isHidden,west.isHidden"
        }
    });
    resizePanes();

    generateRESTParameters();
    loadSkynetTopic();
    skynetButtonURL = "http://" + skynetURL + "/pressgang-ccms-ui/#SearchResultsAndTopicView;query;topicIds=" + topicID;
        
    // Set up identity user identity
    
    var username = getCookie('username');
    if (username) {
        $('#userid').val(username);
        $('#userid').removeAttr('autofocus');
        $('#commitmsg').attr('autofocus', 'autofocus');
    }
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
                enableSaveRevert();
                makeValidityAmbiguous();
            },
            onKeyEvent: function(cm, e) {
                if (window.timerID == 0) window.timerID = setTimeout("timedRefresh()", window.refreshTime);
                k = e.keyCode;
                if (k != 16 && k != 17 && k != 18 && k != 20 && k != 19 && k != 27 && k != 36 && k != 37 && k != 38 && k != 39 && k != 40 && k != 45) {
                    enableSaveRevert();
                    makeValidityAmbiguous();
                }
                return false; // return false tells Codemirror to also process the key;
            },
            wordWrap: true,
            lineWrapping: true,
            height: myHeight,
            width: myWidth,
            disableSpellcheck: false,
            lineNumbers: true
        });
        resizePanes();
    }
    else {
        window.editor.toTextArea();
        $('#code').change(function() {
            enableSaveRevert();
            makeValidityAmbiguous();
        });
        $('#code').keydown(function(e) {
            if (window.timerID == 0) window.timerID = setTimeout("timedRefresh()", window.refreshTime);
            k = e.keyCode;
            if (k != 16 && k != 17 && k != 18 && k != 20 && k != 19 && k != 27 && k != 36 && k != 37 && k != 38 && k != 39 && k != 40 && k != 45) {
                enableSaveRevert();
                makeValidityAmbiguous();
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
            makeValidityAmbiguous();
            enableSaveRevert();
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
                            '                  <!-- add the role "changes-' + month[n] + '-' + y + '" to all elements affected by the change" -->\n' + 
                            '               </listitem>\n' + 
                            '            </itemizedlist>\n' + 
                            '         </listitem>\n' + 
                            '      </varlistentry>\n' + 
                            '   </variablelist>\n'
    };
    window.editor.replaceSelection(templates[this.id]);
    makeValidityAmbiguous();
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
    makeValidityAmbiguous();
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
    makeValidityAmbiguous();
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
        makeValidityAmbiguous();
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