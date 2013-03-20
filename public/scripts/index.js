
function indexRefresh(){
 window.refreshTimer = setInterval(function() {
     $.get(window.sourceURL, {}, function(result) {
         $('#booklist').html(result);
     });
    }, 1000);   
}