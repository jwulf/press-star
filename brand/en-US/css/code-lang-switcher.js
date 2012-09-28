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

function setUpCodeTabs() {

  function setCookie(bookname, bookver, codelang)
  {
    var exdate=new Date();
    exdate.setDate(exdate.getDate() + exdays);
    var c_value=escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
    document.cookie=c_name + "=" + c_value;
  }


  function getCookie(bookname, bookver, codelang)
  {
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
      $.each(listItems, function(idx, itm) { $list.append(itm); });
  }

// Make the first tab active - used when no default is selected, or the default is not available here
  function makeFirstActive (div_code) {
    initialtab = div_code.find('a:first');
    initialtab.addClass('active');
    div_code.find('dd').hide();
    div_code.find('.code-lang-' + initialtab.attr('rel')).show();
  }

  function hideIntroSection(){
    $('div.skynet-defaultcodeselector').each(function(){$(this).hide()});
  }

  function showIntroSection(tabsInBook){
    var tab;
    // For all 
    $('div.skynet-defaultcodeselector').each(function (){
      // show the selector section      
      $(this).removeClass('hidden');
      // hide all selectors by default
      $(this).find('li').hide();

      // Iterate through all the code tabs
      for (tab in tabsInBook){
        // If this code has tabs in the book, we'll find its selector
        // and enable it
        if (tabsInBook[tab] == 1) {
          // Loop through the listitems in the master selector
          $(this).find('li').each(function(){
            // Compare its class with the code we seek
            if ($(this).hasClass(tab)){
              var anchor =  $('<a href="#" rel="' + tab + '">' + $(this).find('div.para').html() +
         '</a>');
              $(this).prepend(anchor);
              
              anchor.click(function (e) {
                e.preventDefault();
                $('div.codetabs').each(function(){
                  codelang = $(anchor).attr('rel');
                  codesample = $(this).find('.code-lang-'+ codelang);
                  if (codesample.length > 0){
                    $(this).find('dd').hide();                    
                    codesample.show();
                    $(this).find('a').removeClass('active');
                    $(this).find('a[rel="' + codelang + '"]') .addClass('active');
                  }
                });                
              });

              $(this).find('div.para').detach();
              $(this).show();
            }
          });
        }
      }
      // Now we need to set one of them as the default active one
      //makeFirstActive($(this)); 
    });
  }

// the main function, here we go through and change variablelists into tabbed code
// displays
  var code;
  var counter;
  var linkEl;
  var listItemEl;
  var currentNamedAnchor;
  // Will be true if codetabs are in the book
  var tabs;
  // We use the short code in css classes and for link matching purposes
  // The long name is used for the human readable text
  var language_css_codes = {
      'JavaScript' : 'js',
      'Node.js' : 'node',
      'C++' : 'cpp',
      'C#/.NET' : 'cs',
      'Python': 'py',
      'Ruby': 'rb',
      'Java': 'java',
      'html': 'HTML'
    };
  // This array records what tabs are included in this book
  var tabsInBook = {
/*      'js' : 0,
      'node' : 0,
      'cpp' : 0,
      'cs' : 0,
      'py' : 0,
      'rb' : 0,
      'java' : 0,
      'HTML' : 0 */
    };

  // Initialize the tabs in the book to 0 
  for (code in language_css_codes){
    tabsInBook[language_css_codes[code]] = 0;
  }

  currentNamedAnchor = window.location.hash;

  // hide the introductory section with the Codetabs selector by default
  
// Commented out for now - if there are no code selections, we might
  // change the wording of the intro rather than hide the whole thing
  //  hideIntroSection();

  tabs = false;
  $('div.codetabs').each(function () {
    var div_code = $(this);
    tabs = true;
    counter = 0;
    ul = $(document.createElement('ul'));
    div_code.find('dt').each(function () {
      lang = $(this).children('.term')[0].innerHTML;
      linkEl = $('<a href="#" rel="' + language_css_codes[lang] + '">' + lang +
         '</a>');
      tabsInBook[language_css_codes[lang]] = 1;
      listItemEl = $('<li class="code-select-li"></li>');
      listItemEl.append(linkEl);
      proglisting = $(this).next();
      proglisting.addClass('code-lang-' + language_css_codes[lang]);

      $(this).detach();

      linkEl.click(function (e) {
        e.preventDefault();

        if ($(this).hasClass('active')) return;

        div_code.find('dd').hide();
        div_code.find('.code-lang-'+$(this).attr('rel')).show();
        div_code.find('a').removeClass('active');
        $(this).addClass('active');
      });

      addNewListItem(ul, listItemEl);
    });
    div_code.prepend(ul);

    // atm default to first, but will store the lang pref (perhaps in a cookie)
    makeFirstActive(div_code); 
  });

  // if there *are* codetabs in this book, then show the Codetabs 
  // introductory section
  if (tabs) showIntroSection(tabsInBook);

  // The document has resized. If the user opened it on a named anchor, take
  // them to the new location for that point
  if (currentNamedAnchor)
    $('html, body').animate({ scrollTop: $(currentNamedAnchor).offset().top }, 'slow');
}
