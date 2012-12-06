// Pseudo-code

// The page starts up and calls this function

/* 

    TODO
    
    Cookies for persistence of preference
    
        1. Check cookie for:
            a default programming language for this book
            a default programming language for our docs
     
        book.default = thisbook.default || docs.default 
        
        2. On a master selection:
        
            writeCookie(thisBook, thisDefault)
            if (!cookie.docs) writeCookie(docs, thisDefault)
     
    Make it possible to switch the whole book from any code sample
    
        This one will need some thought for the UI, but the user won't
        be able to discover the master switcher from deep in the book.
        
        They should be able to switch the whole book from anywhere in the book,
        as well as look at the different languages for a single sample.
*/

/*jslint indent: 4 */

function setUpCodeTabs() {

    function setCookie(bookname, bookver, codelang) {
        var exdate = new Date();
        exdate.setDate(exdate.getDate() + exdays);
        var c_value = escape(value) + ((exdays == null) ? "" : "; expires=" + exdate.toUTCString());
        document.cookie = c_name + "=" + c_value;
    }


    function getCookie(bookname, bookver, codelang) {
        var tab
        tab = 0;
    }

    // http://stackoverflow.com/questions/11509555/insert-new-list-sorted-in-alphabetical-order-javascript-or-jquery 
    function addNewListItem($list, $ele) { // inserts a listitem in alphabetical order
        var listItems;
        $list.append($ele);
        listItems = $list.children('li').get();
        listItems.sort(function (a, b) {
            return $(a).text().toUpperCase().localeCompare($(b).text().toUpperCase());
        });
        $.each(listItems, function (idx, itm) {
            $list.append(itm);
        });
    }

    /*
        Make the first tab active - used when no default is selected, 
        or the default is not available here 
    */

    function makeFirstActive(div_code) {
        var initialtab = div_code.find('a:first');
        initialtab.addClass('active');
        div_code.find('dd').hide();
        div_code.find('.code-lang-' + initialtab.attr('rel')).show();
    }

    function hideIntroSection() {
        $('div.skynet-defaultcodeselector').hide();
    }

    function showIntroSection(languagesInThisBook) {

        /* 
        languagesInThisBook is an object with this format:
      
        { 
            [language short code] : [true|false],
            ... 
        }
        
        It is created by scanning through the code samples in the book on
        page load, then passed into this function to configure the master
        selector.

    */

        $('div.skynet-defaultcodeselector').each(function () {

            // show the selector section      
            $(this).removeClass('hidden');

            // hide all selectors by default
            $(this).find('li').hide();

            // Iterate through the code languages in this book
            for (var language in languagesInThisBook) {

                if (languagesInThisBook[language]) {

                    /* 
                        If this language has code in the book, we'll find its 
                        selector and enable it.
                        
                        I use .each here as shortcut for a test for existence.
                        It will skip if the selector doesn't exist in the DOM.
                        
                    */

                    $(this).find('li.' + language).each(function () {

                        /*
                            Create a clickable link and add it to listitem
                        */

                        var anchor = $('<a href="#" rel="' + language + '">' + $(this).find('div.para').html() + '</a>');
                        $(this).prepend(anchor);

                        /*  
                            Master selector click functionality.
                        */

                        anchor.click(function (e) {
                            e.preventDefault(); // don't reload the page

                            /* 
                                We can get our own language either through
                                $(this) or via a closure
                            */

                            var codelang = $(anchor).attr('rel');

                            /* 
                                When the selector is clicked, iterate through
                                the book, and activate all code samples for 
                                that language, when they are available.
                            */

                            $('div.codetabs').each(function () {
                                /* 
                                    (small?) performance optimization possible
                                    with impact on readability:
                                    
                                    .each vs for-loop
                                    anonymous vs named function
                                    
http://stackoverflow.com/questions/11823965/jquery-each-performance-of-anonymous-function
                                    

                                */

                                var codesample = $(this).find('.code-lang-' + codelang);

                                if (codesample.length > 0) {

                                    /*
                                        Hide all the code samples, then
                                        show the code sample for this language
                                    */

                                    $(this).find('dd').hide();
                                    codesample.show();

                                    /* 
                                        Make all the local code selectors
                                        unselected, then set the current one
                                        selected.
                                    */

                                    $(this).find('a').removeClass('active');
                                    $(this).find('a[rel="' + codelang + '"]').addClass('active');
                                }
                            });

                            /*
                                Make all the master selectors inactive
                                The make the current selection active
                            */

                            $('ul.codetabs-selector a.active').removeClass('active');
                            $(this).addClass('active');
                        });

                        $(this).find('div.para').detach();
                        $(this).show();
                    });
                }
            } // iterate through languages in the book

            // Now we need to set one of them as the default active one
            //makeFirstActive($(this)); 
        });
    }

    // the main function, here we go through and change <dl> into tabbed code
    // displays

    var linkEl, listItemEl, currentNamedAnchor, shortCode, bookHasCodetabs, 
        language, shortCodesFromHumanLabels, languagesInThisBook;

    shortCodesFromHumanLabels = {
        /*
     The long name is used for the human readable text.
     
     The short code is used a css class selector and in the rel attribute
     of the code tab selector links.    
    */

        'JavaScript': 'js',
        'Node.js': 'node',
        'C++': 'cpp',
        'C#/.NET': 'cs',
        'Python': 'py',
        'Ruby': 'rb',
        'Java': 'java',
        'html': 'HTML'
    };

    /* 
        The languagesInThisBook object records which language tabs are included 
        in this book, indexed on the short code.
    */

    languagesInThisBook = {};

    // Initialize all languages to false 
    for (language in shortCodesFromHumanLabels) {

        shortCode = shortCodesFromHumanLabels[language];

        languagesInThisBook[shortCode] = false;

    }

    // Save this in case the user jumped into the page to a named anchor
    currentNamedAnchor = window.location.hash;

    /* 
     Here we go through all the divs (in the document) that have the class
     'codetabs'. These are the candidates for tabbed code listings.
        
     Here's what the standard Publican-rendered output looks:
    
    <div class="variablelist codetabs">
        <dl>
            <dt class="varlistentry">
                <span class="term">Python</span>
            </dt>
            <dd>
                <pre class="programlisting python">
                </pre>
            </dd>
        </dl>
    </div>
    
    The 'codetabs' class on the <div> identifies it as a tabbed code dialog 
    candidate.
    
    The various code sample programming language versions are in <dt><dd> pairs
    in the <dl>.
    
    The <dt> element child with the class 'term' contains the human-readable name
    of the code sample programming language.
    
    */

    bookHasCodetabs = false;

    /*
     Each <div> element with the 'codetabs' class contains candidates for 
     tabbed code samples display
    */

    $('div.codetabs').each(function () {
        var ul, div_code;
        
        div_code = $(this);
        bookHasCodetabs = true;

        /* 
         The code tabs candidates are in a definition list <dl> child of the div.
         We will convert this to an unordered list <ul>
         Create new <ul> to hold tabbed code samples
        */

        ul = $(document.createElement('ul'));

        /* 
         Find each of the <dt> elements in the <dl>. 
         Each <dt> is a programming language
        */

        div_code.find('dt').each(function () {

            var proglisting, thisCodeSampleHumanLabel;
            
            /* 
             Each <dt> has a <span> child element. That span has the class
             'term'. This contains the human-readable programming language name
            */

            thisCodeSampleHumanLabel = $(this).children('.term')[0].innerHTML;

            /* We create an <a> element to be our click target. We use the 
             'rel' attribute of the <a> to store the code for the programming
             language
            */

            shortCode = shortCodesFromHumanLabels[thisCodeSampleHumanLabel];
            languagesInThisBook[shortCode] = true;

            linkEl = $('<a href="#" rel="' + shortCode + '">' + thisCodeSampleHumanLabel + '</a>');

            listItemEl = $('<li class="code-select-li"></li>');
            listItemEl.append(linkEl);

            // The <dd> containing the actual code sample always follows the <dt> 
            proglisting = $(this).next();

            /*
             Give the code listing a class based on the shortcode version of the 
             programming language
            */

            proglisting.addClass('code-lang-' + shortCode);

            /* 
             We now have a new li to hold the Human label, so we remove
             the <dt>
            */

            $(this).detach();

            // The click handler for the code tab
            linkEl.click(function (e) {
                var desiredTabClass;
                
                // we don't want the anchor to cause the page to reload
                e.preventDefault();

                // repeatedly clicking the same tab does ...
                if ($(this).hasClass('active')) return;

                // Hide all code tabs
                div_code.find('dd').hide();

                /*
                 Use the 'rel' attribute of the link to identify which
                 code tab we want. The rel attribute has the shortcode
                */

                desiredTabClass = '.code-lang-' + $(this).attr('rel');
                div_code.find(desiredTabClass).show();

                // Make all of the code tabs selectors "unselected"
                div_code.find('a').removeClass('active');

                // Make this code tab selector the visually selected one
                $(this).addClass('active');
            });

            addNewListItem(ul, listItemEl);
        });
        div_code.prepend(ul);

        // atm default to first, but will store the lang pref (perhaps in a cookie)
        makeFirstActive(div_code);
    });

    /*
     If there *are* codetabs in this book, then show the Codetabs 
     introductory section
     */

    if (bookHasCodetabs) showIntroSection(languagesInThisBook);

    /* 
     The document has resized due to our collapsing of code samples into tabs.
     If the user opened it on a named anchor, take
     them to the new location for that point
    */

    if (currentNamedAnchor) $('html, body').animate({
            scrollTop: $(currentNamedAnchor).offset().top
        }, 'slow');
}

