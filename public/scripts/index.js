var oldBookList;

function indexRefresh (){
 window.refreshTimer = setInterval(function() {
     $.get(window.sourceURL, {}, function(result) {
         if (result != oldBookList) {
             $('#booklist').html(result);
             oldBookList = result;
         }
     });
    }, 1000);   
}