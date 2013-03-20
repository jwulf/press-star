function indexRefresh(){
 window.refreshTimer = setInterval(function() {
     $.get('/booklist', {}, function(result) {
         $('#booklist').html(result);
     });
    }, 1000);   
}