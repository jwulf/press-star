/* 

Code Tabs Code

This javascript code handles "Codetabs"  - displaying code samples in multiple programming languages as
tabbed dialogs. This way readers can choose which language they want to see, and the other languages can be hidden
"at one click's distance".

In Docbook, the author creates a variablelist with the role "codetabs". For example:

<variablelist role="codetabs">
*/

// Pseudo-code

// The page starts up and calls this function
// First:
// Check HTML5 Local Storage (fallback to cookie) for:
// a default programming language for this book
// a default programming language for our docs
// book.default = thisbook.default || docs.default 

// Second: 
// Scan the page and construct the code switchers. 
// foreach if thisbook.default){setTabTo(thisbook.default)}
// Keep a list of languages in the book

// Third:
// If the skynet-defaultcodeselector div is on this page, then:
// If length(langslist) > 0 {
// Detach all programming languages that are not in the list }
// If (book.default) set switcher to book.default
// else if (docs.default) set switcher to docs.default
// Attach event handler to skynet-defaultcodeselectorswitch
// set visible}

// skynet-defaultcodeselectorswitch onclick()
// thisDefault = skynet-defaultcodeselector.activetab
// writeCookie(thisBook, thisDefault)
// if (!cookie.docs) writeCookie(docs, thisDefault)
// scanpage and set default active

/*jslint indent: 2 */



// http://stackoverflow.com/questions/11509555/insert-new-list-sorted-in-alphabetical-order-javascript-or-jquery 
function addNewListItem($list, $element) { // inserts a listitem in alphabetical order
    var listItems;
    $list.append($element);
    listItems = $list.children('li').get();
    listItems.sort(function(a, b) {
        return $(a).text().toUpperCase().localeCompare($(b).text().toUpperCase());
    });
    $.each(listItems, function(index, item) {
        $list.append(item);
    });
}

// Make the first tab active - used when no default is selected, or the default is not available here
function makeFirstActive(thisCodeDiv) {
    var initialTab = thisCodeDiv.find('a:first');
    initialTab.addClass('active');
    thisCodeDiv.find('dd').hide();
    thisCodeDiv.find('.code-lang-' + initialTab.attr('rel')).show();
}

function hideIntroSection() {
    $('div.skynet-defaultcodeselector').each(function() {
        $(this).hide()
    });
}

function showIntroSection(tabsInBook) {
    var tab;
    // For all 
    $('div.skynet-defaultcodeselector').each(function () {
        $(this).removeClass('hidden'); // show the selector section           
        $(this).find('li').hide(); // hide all selectors by default

        for (tab in tabsInBook) {
            if (tabsInBook[tab]) // true if this code language is in the book
            {
                // Get this listitem in the master selector
                $(this).find('li').find('[' + tab + ']').each(

                function () {
                    var anchor = $('<a href="#" rel="' + tab + '">' + $(this).find('div.para').html() + '</a>');
                    $(this).prepend(anchor);

                    // click handler for the master selectors
                    anchor.click(

                    function (e) {
                        $('.codetabs-selector li a').removeClass('active');
                        $(this).addClass('active');
                        e.preventDefault();
                        $('div.codetabs').each(

                        function () {
                            var codelang = $(anchor).attr('rel');
                            var codesample = $(this).find('.code-lang-' + codelang);
                            if (codesample.length > 0) {
                                $(this).find('dd').hide();
                                codesample.show();
                                $(this).find('a').removeClass('active');
                                $(this).find('a[rel="' + codelang + '"]').addClass('active');
                            }
                        });
                    });

                    $(this).find('div.para').detach();
                    $(this).show();
                });
            }
        }
    });
}

function setUpCodeTabs() 
{
    // the main function, here we go through and change variablelists into tabbed code
    // displays
    var cssCode,
    linkEl,
    listItemEl,
    currentNamedAnchor,
    thisBookHasCodeTabs = false,

    // This array records what tabs are included in this book
    tabsInBook = { },
        /*    
    { 'js' : 0,
      'node' : 0,
      'cpp' : 0,
      'cs' : 0,
      'py' : 0,
      'rb' : 0,
      'java' : 0,
      'HTML' : 0 }       */
    
        /* 
      We use the short code in css classes and for link matching purposes.
      This is done because the human readable text can contain characters not allowed in css class names or JS object property names.
      The long name is used for the human readable text 
      */

    lookupCSSCodeFromLanguageName = 
    {
        'JavaScript': 'js',
        'Node.js': 'node',
        'C++': 'cpp',
        'C#/.NET': 'cs',
        'Python': 'py',
        'Ruby': 'rb',
        'Java': 'java',
        'html': 'HTML'
    };

    // Initialize the tabs in the book to 0 
    for (var humanReadableCodeLanguageName in lookupCSSCodeFromLanguageName) 
    {
        cssCode = lookupCSSCodeFromLanguageName[humanReadableCodeLanguageName];
        tabsInBook[cssCode] = false;
    }

    currentNamedAnchor = window.location.hash;

    $('div.codetabs').each(function () 
    { // Go through each of the codetabs in the book
        // This Docbook: <variablelist role="codetabs"> produces this HTML: <div class="codetabs">
        var thisCodeDiv = $(this);
        thisBookHasCodeTabs = true;

        // The code tab selectors will be li - listitem - elements inside a ul - unordered list - element
        // Create the ul element to add them to:
        var ul = $(document.createElement('ul'));
        // Code tabs are based on a Docbook varlist. The <varlistentry><term> is rendered as a dt - data term - element in HTML
        // Go through each of the tabs in this codetab:
        thisCodeDiv.find('dt').each(function () 
        {
            // This relies on the Docbook author using the Human Readable Names in lookupCSSCodeFromLanguageName
            // as the <variablelist><term>
            // Note that unpredictably things will happen if an author puts multiple occurrences of the same code language in a single codetab
            humanReadableCodeLanguageName = $(this).children('.term')[0].innerHTML;
            // We construct a link for the click handler. We'll misuse the rel attribute to hold a css classname
            linkEl = $('<a href="#" rel="' + lookupCSSCodeFromLanguageName[humanReadableCodeLanguageName] + '">' + humanReadableCodeLanguageName + '</a>');
            tabsInBook[lookupCSSCodeFromLanguageName[humanReadableCodeLanguageName]] = true;
            listItemEl = $('<li class="code-select-li"></li>');
            listItemEl.append(linkEl);
            // Directly following the human readable name is the code sample, it's in a dd element, but we rely on it's position here
            var proglisting = $(this).next();
            // We give it a css classname that we can use to match the programlisting with the selector    
            proglisting.addClass('code-lang-' + lookupCSSCodeFromLanguageName[humanReadableCodeLanguageName]);

            $(this).detach();

            // This is the click handler for the code tab selector
            linkEl.click(function (e) {
                e.preventDefault();

                // Do nothing if this one is already selected
                if ($(this).hasClass('active')) return;
                
               
                
                $('.set-as-default').removeClass('set-as-default-visible'); // make all invisible
                $(this).closest('ul').find('.set-as-default').addClass('set-as-default-visible'); // make ours visible
                
                $('.set-as-default-visible a').html("Set " + $(this).html() + " as default");

                // The <varlistentry><listitem> is rendered as a dd - data definition - element in HTML
                thisCodeDiv.find('dd').hide();
                thisCodeDiv.find('.code-lang-' + $(this).attr('rel')).show();
                thisCodeDiv.find('a').removeClass('active');
                $(this).addClass('active');
                
            });

            addNewListItem(ul, listItemEl);
        });


        // Create the "Set as Default" button for the tab
        // TODO: Localisation of link text
        var setAsDefaultLink = $('<a href="#">Set as Default</a>');
        var setAsDefaultListItem = $('<li class="code-select-li set-as-default"></li>');

        setAsDefaultLink.click(function (e) {
            e.preventDefault();
            $(this).closest('ul').find('.active').each(function () {
                setAsBookDefault($(this));
            });
            $('.set-as-default-visible').removeClass('set-as-default-visible');
        });

        setAsDefaultListItem.append(setAsDefaultLink);
        ul.append(setAsDefaultListItem);


        thisCodeDiv.prepend(ul);

        // atm default to first, but will store the lang pref (perhaps in a cookie)
        makeFirstActive(thisCodeDiv);
    });

    // if there *are* codetabs in this book, then show the Codetabs 
    // introductory section
    if (thisBookHasCodeTabs) {
        showIntroSection(tabsInBook); // going to deprecate this now we have pervasive default setting
        var myDefault = getDefaultProgrammingLanguageFromCookie();
        if (myDefault) switchBookToProgrammingLanguage (myDefault);
    }
    
    // The document has resized. If the user opened it on a named anchor, take
    // them to the new location for that point
    if (currentNamedAnchor && currentNamedAnchor != '#' && $(currentNamedAnchor)) $('html, body').animate({
        scrollTop: $(currentNamedAnchor).offset().top
    }, 'slow');

    function setAsBookDefault(thisElement) 
    {
        var desiredDefault = thisElement.attr('rel');
        $('.codetabs-selector li a').removeClass('active');
        
        // Figure out what the page is  scrolled to at the moment
        var viewportOffset = thisElement.offset().top - getPageScroll()[1];
        
        // Set all codetabs in the book to the default
        switchBookToProgrammingLanguage(desiredDefault);
        
        // Now move the page back to the element we were at before
        // http://answers.oreilly.com/topic/1626-how-to-center-an-element-within-the-viewport-using-jquery/
        $(window).scrollTop(thisElement.offset().top - viewportOffset);
        setDefaultProgrammingLanguageViaCookie(desiredDefault);
    }
}

function switchBookToProgrammingLanguage (programmingLanguage) {
        
        // Set all codetabs in the book to the default
        $('div.codetabs').each(function() 
        {
            var codesample = $(this).find('.code-lang-' + programmingLanguage);
            if (codesample.length > 0) 
            {
                $(this).find('dd').hide();
                codesample.show();
                $(this).find('a').removeClass('active');
                $(this).find('a[rel="' + programmingLanguage + '"]').addClass('active');
            }
        });    
}

// http://stackoverflow.com/questions/1567327/using-jquery-to-get-elements-position-relative-to-viewport
function getPageScroll() {
    var xScroll, yScroll;
    if (self.pageYOffset) {
      yScroll = self.pageYOffset;
      xScroll = self.pageXOffset;
    } else if (document.documentElement && document.documentElement.scrollTop) {
      yScroll = document.documentElement.scrollTop;
      xScroll = document.documentElement.scrollLeft;
    } else if (document.body) {// all other Explorers
      yScroll = document.body.scrollTop;
      xScroll = document.body.scrollLeft;
    }
    return new Array(xScroll,yScroll)
}