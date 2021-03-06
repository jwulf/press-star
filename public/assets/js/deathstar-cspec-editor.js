
var url, id;
var socket,
    Model = {
        modified: ko.observable(false),
        socket_operation: '',
        username: ''
    };
    
function disable(selector) {
    $(selector).prop("disabled", true);
    $(selector).popover('hide');
}

window.onbeforeunload = function(e) {
   if (Model.modified()) { return 'You have unsaved changes.'; }
};

function errorOutput(text) {
    cmdOutput(text, true, 'errormsg');
}

function debugOutput(text, newline) {
    cmdOutput(text, newline, 'cmdmsg');
}

function successOutput(text) {
    cmdOutput(text, true, 'successmsg');
}

function timestampOutput(text) {
    cmdOutput(getDate() + ' ' + text, true, 'timestampmsg');
}

function cmdOutput(text, newline, cmdclass) {
    var pretext = '',
        posttext = '';
    if (cmdclass) {
        pretext = '<span class="' + cmdclass + '">';
        posttext = '</span>'
    }
    var eol = newline ? '<br><br>' : '<br>';
    var myDiv = document.getElementById('div-preview-inline');
    var s = myDiv.innerHTML;
    var anchor = '<a id="end"></a>'
    var news = s.substring(0, s.indexOf(anchor)) + pretext + text + posttext + eol + anchor;
    myDiv.innerHTML = news;
    document.getElementById('end').scrollIntoView();
    //	myDiv.innerHTML += pretext + text + posttext + eol + '<a id="end"/>';

}

function newCmdOutput(text) {
    $('#div-preview-inline > div').css('color', 'grey');
    $('#div-preview-inline').append('<div></div>');
    text && cmdOutput(text);
}

function specEditorload() {
    id = url_query('topicid')
    url = url_query('skyneturl');
    pageSetup();
    loadSkynetTopic();
}

function loadSkynetTopic() {
    //loadTopicFromPressGangInBrowser( deets.skynetURL, deets.topicID, updateSpecText);
    loadSpecViaDeathStar(url, id, updateSpecText);
}

function revert() {
    if (Model.modified() && confirm('Discard changes and reload?')) {
        loadSkynetTopic(); 
    } else {
        loadSkynetTopic();
    }
}

function updateSpecText(json) {
    if (json.code) {
        alert('REST Communication Error while retrieving Spec: ' + json.code);
    } else {
    	editor.setValue(json);
        $("#page-title").html("Content Spec: " + id + " - " + json.title);
        document.title = id + ' - ' + json.title;
        Model.modified(false);
    }
}

function pageSetup() {

    ko.applyBindings(Model);
    
    newCmdOutput();

    window.mutex = 0;
    var myHeight = getCookie('cspec-editor.height') || "300px";
    var myWidth = getCookie('cspec-editor.width') || "770px";

    // Create our Codemirror text editor
    window.editor = CodeMirror.fromTextArea(document.getElementById("code"), {
        mode: 'text/plaintext',
        onChange: function(cm, e) {
            Model.modified(true);
        },
        onKeyEvent: function(cm, e) {
            if (window.timerID == 0) window.timerID = setTimeout("timedRefresh()", window.refreshTime);
            k = e.keyCode;
            if (k != 16 && k != 17 && k != 18 && k != 20 && k != 19 && k != 27 && k != 36 && k != 37 && k != 38 && k != 39 && k != 40 && k != 45) {
                Model.modified(true);
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

    //  $(window).unload(function(){ layoutState.save('deathstar-spec-editor-layout') });

    var myLayout = $('body').layout({
        applyDefaultStyles: true,
        stateManagement__enabled: true,
        onresize_end: resizePanes,
        useStateCookie: true,
        cookie: {
            //  State Management options
            name: "deathstar-spec-editor-layout" // If not specified, will use Layout.name
            ,
            autoSave: true // Save cookie when page exits?
            ,
            autoLoad: true // Load cookie when Layout inits?
            //  Cookie Options
            ,
            domain: "",
            path: "",
            expires: "30", // 'days' -- blank = session cookie
            secure: false, //  State to save in the cookie - must be pane-specific
            keys: "north.size,south.size,east.size,west.size," + "north.isClosed,south.isClosed,east.isClosed,west.isClosed," + "north.isHidden,south.isHidden,east.isHidden,west.isHidden"
        }
    });

    socket || (socket = io.connect());
    socket.on('connect', function() {
        debugOutput('Connected to server');
    });

    socket.on('cmdexit', function(msg) {
        var MSG = { 'success' : { 'push' : 'Content Specification pushed successfully',
                                  'validate' : 'The Content Specification is valid'},
                    'failure' : {'push' : 'The push was not successful.',
                                  'validate' : 'Could not validate the Content Specification'}}
        if (msg == '0') {
            successOutput(MSG.success[Model.socket_operation], true);
            if (Model.socket_operation === 'push') { loadSkynetTopic(); }
        }
        else {
            errorOutput(MSG.failure[Model.socket_operation], true);
        }
        endServerTask();
    });

    socket.on('cmdoutput', function(msg) {
        cmdOutput(msg);
    });

    $('#save-button').click(pushSpec);
    $('#push-align').click(pushSpecPermissive);
    $('#validate-button').click(validateSpec);
    $('#revert-button').click(revert);
    Model.modified(false);
    resizePanes();
}

function resizePanes() {

    var paneSize;
    // resize codemirror editor width
    paneSize = $('.ui-layout-center').width();
    $('.CodeMirror, .CodeMirror-scroll').css('width', paneSize - 15);

    // resize preview tab 
    $('#div-preview-pane').width(paneSize - 15);

    // resize codemirror editor height
    paneSize = $('.ui-layout-center').height();
    $('.CodeMirror, .CodeMirror-scroll').css('height', paneSize - 160);

    $('.CodeMirror').trigger("resize");

    // resize preview east pane
    paneSize = $('.ui-layout-east').width();
    $('#div-preview-inline').width(paneSize - 15);
}

function pushSpec() {
    pushSpecRoute('push');
}

function pushSpecPermissive() {
    if (confirm('Rewrite topic titles to align them with the latest edits?')) { pushSpecRoute('push', '-p'); }
}

function pushSpecRoute(cmd, opts) {
    socket && (Model.socket_operation = 'push') && emitPush(cmd, opts);
}


function emitPush(cmd,opts) {
    mapIdentity(function() { _emitPush(cmd, opts);});
}

function _emitPush(cmd, opts) {
    var cmdobj = {
        command: cmd,
        server: url,
        username: Model.username,
        spec: editor.getValue(),
        id: id
    };
    if (opts) cmdobj.opts = opts;
    timestampOutput(' Initiating ' + cmd);
    socket.emit('pushspec', cmdobj);
    startServerTask();
}

function mapIdentity(callback) {
    clientsideIdentify( function (identity) {
        if (identity.identified) {
            Model.username = identity.username;
            if (callback) callback();
        }
    }, url);
}

function validateSpec() {
    socket || (socket = io.connect()); // TIP: .connect with no args does auto-discovery
     emitValidate();
}

function emitValidate() {
    mapIdentity(_emitValidate);
}

function _emitValidate() {
    timestampOutput(' Initiating validate');
    newCmdOutput();
    if (socket) {
        Model.socket_operation = 'validate';
        socket.emit('pushspec', {
            command: 'validate',
            server: url,
            spec: editor.getValue(),
            username: Model.username,
            id: id
        });
        startServerTask();
    }
}

function startServerTask() {
    $("#save-button").button('loading');
    $("#push-menu").button('loading');
    $("#validate-button").button('loading');
    $("#revert-button").button('loading');
    editor.setOption('readOnly', 'nocursor');
    $('.CodeMirror').addClass('editor-readonly');

}

function endServerTask() {
    $("#save-button").button('reset');
    $('#push-align').click(pushSpecPermissive);
    $("#push-menu").button('reset');
    $("#validate-button").button('reset');
    $("#revert-button").button('reset');
    editor.setOption('readOnly', false);
    $('.CodeMirror').removeClass('editor-readonly');
}