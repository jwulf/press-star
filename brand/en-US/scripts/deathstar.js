/*jshint global skynetURL, $ */

var flash,
    originalTitle,
    bookmd,
    socketConnected = false,
    NO_FLASH = false,
    retries,
    beenConnected,
    work,
    updatingRevHistory = false,
    revHistoryFragment,
    openNewURL,
    zenMode = false,
    Bookmd = { // Book metadata
        building: false,
        publishing: false,
        onPublishQueue: false,
        onBuildQueue: false,
        id: 0,
        onQueue: false
    };

function url_query (query, url) {
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

function setCookie(c_name,value,exdays)
{
    var exdate=new Date();
    exdate.setDate(exdate.getDate() + exdays);
    var c_value=escape(value) + ((exdays==null) ? "" : "; expires=" + exdate.toUTCString());
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

function deathstarItUp ()
{
    var editorURL, injectorURL, buildData, endLoc, topicID;

    retries = 0;
    beenConnected = false;
    originalTitle = document.title;
    connectSocket();

    getBookmd();

    $('.notifier').click(clearNotifier);

    $("#floatingtoc").load('index.html .toc:eq(0)');
    $("body").click(function(){
        work = 1;
        retract_menu('floatingtoc');
    });
    $(".docnav li.home").click(function(e){
        work = 1;
        toggle(e, 'floatingtoc');
        return false;
    });

    $('a.edittopiclink').click(function editTopicClick (e) {

        // Check if we have a child editor window
        if (openNewURL)
        { // if we do, invoke the open operation
            openNewURL && openNewURL($(this).attr('href'));
            e.preventDefault();
            return false;
        } else {
            window.open($(this).attr('href'), '_blank');
            e.preventDefault();
            return false;
        }
    });
    addZenLinks();
    scanForUpstreamUpdates();
}

function addZenLinks() {
    var _class,
        CLASSES = {sectionTopic: '.sectionTopic', section: '.section', chapter: '.chapter', appendix: '.appendix', preface: '.preface'};

    for (_class in CLASSES) {
        $(CLASSES[_class]).each( function () {

            // Don't add the section rel to .sectionTopics
            if (!($(this).hasClass('sectionTopic') && _class === 'section')) {
                if ($(this).parents('dt').length === 0) {
                    $(this).prepend('<a class="zen-click" rel="' + _class + '" href="#zen-mode"><span class="img-zenmode"></span></a>');
                }
            }
        });
    }
    $('.zen-click').click(function (e) {
        e.preventDefault();
        if (zenMode) {
            $('*').removeClass('zen-invisible');
            zenMode = false;
            // Figure out what the page is  scrolled to at the moment
            //var viewportOffset = $(this).offset().top - getPageScroll()[1];
            $(window).scrollTop($(this).offset().top - 100);
        } else {
            $('*').addClass('zen-invisible');

            zenMode = true;
            $(this).parents().each(function () { $(this).removeClass('zen-invisible'); });
            $(this).children().each(function () { $(this).removeClass('zen-invisible'); });

            $(this).parents('.' + $(this).attr('rel')).find('*').each(function () { $(this).removeClass('zen-invisible') });

            $('.control-panel').removeClass('zen-invisible');
            $('.control-panel').parents().each( function () { $(this).removeClass('zen-invisible'); });


            // Figure out what the page is  scrolled to at the moment
            var viewportOffset = $(this).offset().top - getPageScroll()[1];
            $(window).scrollTop($(this).offset().top - viewportOffset);


        }
    });
}


function scanForUpstreamUpdates () {
    var _revision, _id, _upstream_revision, _this;
    $('.fixedRevTopic').each(function () {
            _this = this;   // different this inside the callback
            _revision = this.dataset.pgTopicRev;
            _id = this.dataset.pgTopicId;
            getTopicViaBrowser(skynetURL, _id, function (result) {
                if (result.revision && result.revision > _revision) {
                  $(_this).addClass('pg-topic-update-available').find('a').text('Updated upstream');
                }
            });
        }
    );
}

/**
 * Register a callback function from a child editor
 * Invoked from a child editor window.
 * Used to open topics in the editor without reloading
 * the editor page
 * @param callback {function (url) } the callback function
 * in the child editor to call to have the editor load a topic
 */
function registerCallback(callback) {
    openNewURL = callback;
}

function updateRevHistory (e) {
    var _revhistoryid,
        _classes,  // css classes to extract the Revision History ID
        _class,
        parser,
        doc,
        _latest_rev_history_entry,
        timestamp;

    console.log('Update Rev History 0.1');
    (e && e.preventDefault());

    // Extract the topic ID from the custom class
    if ($('.customrevhistory').length > 0) {
        _classes = $($('.customrevhistory')[0]).attr('class').split(' ');
        for (_class = 0; _class < _classes.length; _class ++)
            if (_classes[_class].indexOf('pg-topic-id-') !== -1)
                _revhistoryid = _classes[_class].substr(12);

        if (_revhistoryid) { // we have a revision history topic
            console.log('Revision History topic ' + _revhistoryid);
            loadTopicViaDeathStar(skynetURL, _revhistoryid, function (result){
                // Topic loaded, now DOM parse it for the most recent entry (dateA)
                 parser = new DOMParser();
                 doc = parser.parseFromString(result.xml, 'text/xml');
                 _latest_rev_history_entry = $(doc.getElementsByTagName('date')[0]);

                _latest_rev_history_entry =  (_latest_rev_history_entry) ? _latest_rev_history_entry.text() : undefined;


                console.log('Revision History entry: ' + _latest_rev_history_entry);
                timestamp = (_latest_rev_history_entry) ? new Date(Date.parse(_latest_rev_history_entry)) : undefined;


                if (timestamp) {
                    console.log('Latest Revision History entry was ' + timestamp);
                    var _day = timestamp.getDate().toString();
                    _day = (_day.length == 1) ? '0' + _day : _day;
                    var _month = (timestamp.getMonth() + 1).toString(); //month is 0 based
                    _month = (_month.length == 1) ? '0' + _month : _month ;
                    var _year = timestamp.getFullYear().toString();
                    var _target_date = _day + '-' + _month + '-' + _year;
                } else {
                    _target_date = '01-01-2012';
                }

                console.log('Initiating search for log messages since %s', _target_date);

                updatingRevHistory = true;
                if (md) { updateControlPanel(md)
                } else {
                    getBookmd()
                }; // update control panel

                // At the moment our injected Revision History number is 1.0
                // This is here as a stub to creating a more intelligent default
                var revEntry = null; //$(doc.getElementsByTagName('revnumber')[0]).text();

                $.get('/rest/1/getlatestpackagenumber', {url: skynetURL, id: thisBookID}, function (result){
                    revEntry = result.pubsnum;
                });

                var sort_ascending = true;
                getLogMessagesForBookSince(_target_date, skynetURL, sort_ascending, revHistoryFeedback, function(result){
                    console.log(result);
                    updatingRevHistory = false;
                    updateControlPanel(md); // turn off "Generating Revision History" message
                    if (result) {
                        revEntry = (revEntry) ? revEntry : '1.0-0';
                        var _rev = $.parseXML(result);
                        $(_rev).find('revision revnumber').first().text(revEntry);
                        revHistoryFragment = (new XMLSerializer()).serializeToString(_rev);
                        // Open editor for Revision History topic, and inject the revision history fragment
                        window.open('/edit?skyneturl=' + skynetURL + '&topicid=' + _revhistoryid +
                                    '&revhistoryupdate=true', '_blank');
                    }

                });
            });
        } else {
            console.log('Could not locate a revision history topic in this book');
        }
    }
}

// inject the Revision History fragment to a child editor when requested by that window
function getRevHistoryFragment(content, callback) {
    callback(content, revHistoryFragment);
}

function revHistoryFeedback (percentage) {
    updateControlPanel(Bookmd, percentage);
}

function retract_menu (id) {
    if(work) {
        work = 0;
        var entity = document.getElementById(id);
        if(entity) {
            var my_class = entity.className;
            var my_parent = entity.parentNode;
            if(my_class.indexOf("visible") != -1) {
                entity.className = my_class.replace(/visible/,"hidden");
                my_parent.className = my_parent.className.replace(/expanded/,"collapsed");
            }
        }
    }
}

function toggle (e, id) {
    if(work) {
        work = 0;
        var entity = document.getElementById(id);
        if(entity) {
            var my_class = entity.className;
            var my_parent = entity.parentNode;
            if(my_class.indexOf("hidden") != -1) {
                entity.className = my_class.replace(/hidden/,"visible");
                my_parent.className = my_parent.className.replace(/collapsed/,"expanded");

            }
            else if(my_class.indexOf("visible") != -1) {
                entity.className = my_class.replace(/visible/,"hidden");
                my_parent.className = my_parent.className.replace(/expanded/,"collapsed");

            }
            else {

            }
        }
    }
}

function disconnectedNotifier () {
    var _text;
    if (!socketConnected) {
        retries ++;
        displayNotification('Attempting to contact server... lost connection ' + (retries * 5) + ' seconds ago', NO_FLASH);
        setTimeout(disconnectedNotifier, 5000); // retry the socket connection every 1 second    
    } else {
        _text = $('.notifier').html();
        if (_text.indexOf('Attempting to contact') != -1 || _text.indexOf('Lost connection to server') != -1)
            clearNotifier();
    }
}

function connectSocket () {
    var socket;

    // This code handles disconnection events (for example a server bounce, or the client switching networks)
    if (! socketConnected) {
        if (!beenConnected) {
            socket = io.connect();

            socket.on('connect', function () { // TIP: you can avoid listening on `connect` and listen on events directly too!
                socketConnected = true;
                if (retries > 0) clearNotifier();
                retries = 0;
                beenConnected = true;
                console.log('Websocket connected to server');
                socket.emit('subscribeToBookPatch', {url: skynetURL, id: thisBookID});
                socket.emit('subscribeToBookState', {url: skynetURL, id: thisBookID});
                socket.emit('subscribeToBookNotification', {url: skynetURL, id: thisBookID});

                socket.on('disconnect', function () {
                    displayNotification('Lost connection to server...', NO_FLASH);
                    setTimeout(disconnectedNotifier, 5000);
                    socketConnected = false;
                    retries = 0;
                });
            });

            socket.on('patch', patchTopic);
            socket.on('statechange', updateBookMetadata);
            //socket.on('bookRebuiltNotification', bookRebuiltNotification);
            socket.on('notification', routeNotification);


            /* State change is sent every time the book's metadata structure changes on the
             server. It is used to update client-side views of building / publishing / error status

             The Death Star Control Panel uses client-side Embedded JavaScript Templating in 
             conjunction with this event to maintain a real-time view of the book's activity on the
             server.
             */

        }
    }
}

function updateBookMetadata (data) {
    console.log(data);
    Bookmd[data._name] = data._value;
    updateControlPanel(Bookmd);
}

function getBookmd () {
    $.get('/rest/1/getBookmd', {url: skynetURL, id: thisBookID},
        function (result) {
            console.log(result);
            Bookmd = result;
            md = result;
            updateControlPanel(md);
        });
}

function updateControlPanel (md, percentage) {
    var _percentage;

    _percentage = percentage || 0;
    new EJS({url: 'Common_Content/scripts/control-panel.ejs'}).update('ds-control-panel', {bookmd: md,
                updatingRevHistory: updatingRevHistory, percentage: _percentage});

    $('#rebuild-link').click(clickBuild);
    $('#edit-structure').click(clickEditStructure);
    $('#click-publish').click(clickPublish);
    $('#go-home').click(clickGoHome);
    $('#update-revhistory').click(updateRevHistory);
}

function clickGoHome (e) {
    e.preventDefault();
    window.open('/', '_deathstar');
    return false;
}

function routeNotification (data) {
    console.log('Notification:');
    console.log(data);
    if (data.bookRebuilt) {
       bookRebuiltNotification(data);
    } else {
        displayNotification(data);
    }
}

function buildNotification (data) {
    $('#rebuild-link').html(data.msg);
    if (data.blink) {
        $('#rebuild-link').addClass('css3-blink');
    } else {
        $('#rebuild-link').removeClass('css3-blink');
    }
}

function clickBuild (e) {
    e.preventDefault();
    if (e) {
        var url = $(this).attr('rel');

        if ( url == 'rebuild') {
            $.get('/rest/1/build', {url: skynetURL, id: thisBookID}, function (result){
                console.log(result);
                return false;
            });
        } else if ( url == 'reload' ) {
            reload()
        } else {
            window.open(url, '_blank');
            return false;
        }
    }
}

function clickPublish (e) {
    var _url, _target;

    e.preventDefault();
    _target = '_blank';
    _url = $(this).attr('rel');

    if (_url == '/publish') _target = '_deathstar';

    window.open(_url, _target);
    return false;
}

function clickEditStructure (e) {
    e.preventDefault();
    window.open('/cspec-editor.html?skyneturl=' + skynetURL + '&topicid=' + thisBookID);
    return false;
}

function displayNotification (data, flash) {
    var _flash, _msg, _title = 'Notification';

    if ("string" == typeof data) _msg = data;
    if ("object" == typeof data) {
        _msg = data.msg;
        if (data.title) _title = data.title;
    }

    _flash = (flash !== false); // means true unless flash is really set to false, not just null

    if (_flash) flashTitle(_title);

    $('.notifier').html(_msg);
    $('.notifier').removeClass('invisible');
}

function clearNotifier () {
    clearInterval(flash);
    document.title = originalTitle;
    $('.notifier').addClass('invisible');
    return true;
}

function flashTitle (msg) {

    flash = setInterval(function () {
        document.title = (document.title == originalTitle) ? msg : originalTitle;
    }, 500);
}

function bookRebuiltNotification () {
    flashTitle('Updated');
    $('.notify-rebuilt').removeClass('invisible');
    $('#rebuild-link').attr('rel', 'reload');
    $('#rebuild-link').html('Reload');
}

function reload () {
    location.reload(true);
}

// Invoked via websocket from the server
function patchTopic (msg) {
    var target;
    console.log('Received patch for Topic ' + msg.topicID);
    if (msg.topicID && msg.html) {

        $('.pg-topic-id-' + msg.topicID).each(function(){
            // Locate the sectionTopic
            var target = $(this);

            // Locate and preserve its .changelog child, if it exists
            var changelog = target.children('.changelog').detach();

            // Locate and preserve its .prereqs-list child, if it exists
            var prereq = target.children('.prereqs-list').detach();

            // Locate and preserve its .see-also-list child, if it exists
            var seealso = target.children('.see-also-list').detach();
            
          	// Locate and preserve the zen mode link
    		var zenmode = target.children('.zen-click').detach();            

            // Locate and preserve the bug link / edit child
            var buglink = target.children('.RoleCreateBugPara').detach();

            // Get the title from the existing topic - this gets us the TOC anchor and correct section number
            var title = target.find('.title')[0];

            // Update the content
            target.html(msg.html);

            /* titles look like this:

             <h2 class="title"><a id="Creating_and_Adding_Books"></a>2.1.&nbsp;Creating and Adding Books</h2>

             We will take the section number and keep it. We will replace the title text with the new title.
             We will keep the <a> element to allow the section to be the target of a TOC link.

             */

            var new_title_text = $(target.find('.title')[0]).text();  // Grab the new title

            // fromCharCode(160) is &nbsp; <- what the xsl renderer puts in after the section number
            new_title_text = (new_title_text.substr(new_title_text.indexOf(String.fromCharCode(160)))); // remove the section number

            $(target.find('.title')[0]).replaceWith(title); // Old TOC anchor and section number

            var old_section_num = $(title).text().substr(0, $(title).text().indexOf(String.fromCharCode(160))); // separate old section number

            var _a = $(target.find('.title')[0]).children('a').detach();  // grab the anchor target
            $(target.find('.title')[0]).text(old_section_num + ' ' + new_title_text); // new title
            $(target.find('.title')[0]).prepend(_a);
            var _id = _a.attr('id'); // anchor
            console.log('scanning TOC for ' + _id);
            $("[href='#" + _id + "']").text(old_section_num + ' ' + new_title_text); // TOC links


            // Update the revision information stored in the css
            // http://stackoverflow.com/questions/2644299/jquery-removeclass-wildcard
            target.removeClass(function (index, css) {
                return (css.match (/\bpg-topic-rev\S+/g) || []).join(' ');
            }); // get rid of previous revision information

            target.addClass('pg-topic-rev-' + msg.revision); // Add current revision

            // Restore injected content
            if (prereq) prereq.insertAfter(target.find('hr'));
            if (changelog) changelog.insertAfter(target.find('hr'));
            if (seealso) seealso.appendTo(target);
            if (buglink) buglink.appendTo(target);
            if (zenmode) zenmode.appendTo(target);
        });

    }
}
    
